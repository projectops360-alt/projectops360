-- ============================================================================
-- create_project_v2 — end-to-end on a synthetic tenant
-- ============================================================================
-- Guard GOVERNANCE-V2-PROJECT-CREATION-E2E.
--
-- `create_project_v2` (migration 20260898000000) is the narrow command: one
-- projects row, one active multi_pmo_v2 contract, exactly one active owner, or
-- nothing at all. This test exercises it against a tenant built from scratch —
-- two organizations, a non-default governance unit, and eight principals whose
-- only differences are the ones authorisation is supposed to notice.
--
-- The load-bearing case is §6. Inserting a project fires
-- `trg_projects_sync_governance_owner`, which assigns the organization's SYSTEM
-- DEFAULT unit as owner. The caller chose a different unit. If the trigger wins,
-- every project in a multi-PMO tenant silently belongs to the default PMO and
-- the whole feature is decorative. The synthetic organizations get a system
-- default automatically (a trigger creates it), so this interaction is live here
-- exactly as it is in the 74 real organizations.
--
-- The other half is negative: seven principals who must be refused, plus a
-- cross-tenant unit and a non-member organization. A denial only counts if it
-- also wrote nothing, so every refusal is measured by row count, not by the fact
-- that an exception was raised.
--
-- ONE transaction, ALWAYS ending in RAISE EXCEPTION. Nothing survives — not the
-- synthetic tenant, not the projects, not the auth.users rows. Failures are
-- accumulated into `failures` rather than aborting on the first, so a single run
-- reports every defect instead of only the earliest one.
--
-- §12 was a KNOWN FAILING ASSERTION and is now CLOSED by migration
-- 20260899000000. `po_insert` previously checked only
-- `is_org_member(organization_id)` while `authenticated` holds table-level
-- INSERT, so any active member could write an ungoverned projects row directly,
-- bypassing the command. The policy now also requires the `project.create`
-- capability.
--
-- §12 asserts on the SQLSTATE, not merely on "the insert failed". A direct
-- INSERT can fail for uninteresting reasons (NOT NULL, CHECK, unique key), and
-- a refusal by accident would look identical to a refusal by policy while
-- proving nothing. Only 42501 counts.
--
-- CAVEAT, measured and deliberately not papered over: on Stage the refusal is
-- 42501 'permission denied for function governance_member_capabilities' rather
-- than 'new row violates row-level security policy'. That function's ACL is
-- {postgres, service_role} and omits `authenticated`, so the predicate cannot
-- be evaluated by the calling role and the INSERT is refused before the
-- capability is ever consulted. Consequence: the table is fail-closed for
-- EVERYONE, including callers who legitimately hold project.create — verified
-- directly, a pmo_manager is refused identically to a pmo_analyst. The gap is
-- safe (nothing is written) and the predicate logic is correct in isolation
-- (it evaluates TRUE for pmo_manager, FALSE for pmo_analyst), but the denial
-- is not capability-driven and must not be reported as though it were.
--
-- Stage only (gcxcljfzleasrleyyyda). Never run against production.
-- ============================================================================

DO $e2e$
DECLARE
  -- tenant
  orgA uuid; orgB uuid;
  defaultUnitA uuid; unitA uuid; defaultUnitB uuid;
  -- principals
  uCreator uuid; uAnalyst uuid; uAuditor uuid; uTeam uuid;
  uRemoved uuid; uSusp uuid; uNoOrg uuid; uCross uuid;
  mCreator uuid; mAnalyst uuid; mAuditor uuid; mTeam uuid;
  mRemoved uuid; mSusp uuid; mCross uuid;
  -- results
  pMain uuid; seedProject uuid; dupProject uuid;
  contractUnit uuid; ownerUnit uuid;
  slugMain text; slugDup text;
  nProjects int; nContracts int; nOwners int;
  nPartial int := 0; nMultiOwner int := 0; nCrossTenant int := 0; nResidue int := 0;
  -- baselines
  baseOrgs int; baseProjects int; baseContracts int;
  afterOrgs int; afterProjects int;
  deniedProjects int := 0; deniedContracts int := 0; deniedOwners int := 0;
  projBefore int; contrBefore int; ownBefore int;
  -- scratch
  n int; ok boolean; gatedVerified boolean; directInsertAllowed boolean := false;
  directInsertState text := 'not reached'; directInsertMsg text := '';
  savepointHeld boolean;
  failures text := ''; report text := '';
  r record;
BEGIN
  -- ══ 0. Baselines. Everything at the end is measured against these ═════════
  SELECT count(*) INTO baseOrgs     FROM public.organizations;
  SELECT count(*) INTO baseProjects FROM public.projects;
  SELECT count(*) INTO baseContracts FROM public.project_governance_contracts;
  report := report || format(E'0: baseline — %s organizations, %s projects, %s contracts\n',
                             baseOrgs, baseProjects, baseContracts);

  -- The older, wider command still exists and is gated behind a bundle that is
  -- not certified. Recorded, not touched: nothing in the app calls it, and a
  -- refusal that holds is worth knowing about.
  gatedVerified := public.governance_bundle_is_verified('V2_CORE_PROJECT');
  IF gatedVerified THEN
    failures := failures || E'  0: create_governed_project_v2 is UNGATED — its bundle verified unexpectedly\n';
  END IF;
  report := report || format(E'0: legacy create_governed_project_v2 present, bundle verified=%s (refuses; unused by the app)\n',
                             gatedVerified);

  -- ══ 1. Two organizations ═════════════════════════════════════════════════
  INSERT INTO public.organizations (slug, name_i18n)
    VALUES ('zzv2-a-'||gen_random_uuid(), '{"en":"V2 Org A"}'::jsonb) RETURNING id INTO orgA;
  INSERT INTO public.organizations (slug, name_i18n)
    VALUES ('zzv2-b-'||gen_random_uuid(), '{"en":"V2 Org B"}'::jsonb) RETURNING id INTO orgB;

  -- Taken as found. A trigger creates the system default with the organization;
  -- inserting a second one is rejected, and faking it would test a shape the
  -- product never has.
  SELECT id INTO defaultUnitA FROM public.governance_units
   WHERE organization_id = orgA AND is_system_default AND deleted_at IS NULL;
  SELECT id INTO defaultUnitB FROM public.governance_units
   WHERE organization_id = orgB AND is_system_default AND deleted_at IS NULL;
  IF defaultUnitA IS NULL OR defaultUnitB IS NULL THEN
    RAISE EXCEPTION 'E2E_SETUP: an organization was created without a system-default unit'
      USING ERRCODE='22000';
  END IF;

  -- The unit the creator will actually choose. Not the default — that is the
  -- entire point of §6.
  INSERT INTO public.governance_units
    (organization_id, name, code, unit_type, visibility_mode, status, is_system_default)
  VALUES
    (orgA, 'V2 Delivery PMO', 'ZZV2-DEL', 'functional_pmo', 'open', 'active', false)
  RETURNING id INTO unitA;
  report := report || E'1: org A + org B, each with a system-default unit; org A also has a non-default active unit\n';

  -- ══ 2. Principals ════════════════════════════════════════════════════════
  INSERT INTO auth.users (id,email) VALUES (gen_random_uuid(),'zzv2-creator@test.invalid')  RETURNING id INTO uCreator;
  INSERT INTO auth.users (id,email) VALUES (gen_random_uuid(),'zzv2-analyst@test.invalid')  RETURNING id INTO uAnalyst;
  INSERT INTO auth.users (id,email) VALUES (gen_random_uuid(),'zzv2-auditor@test.invalid')  RETURNING id INTO uAuditor;
  INSERT INTO auth.users (id,email) VALUES (gen_random_uuid(),'zzv2-team@test.invalid')     RETURNING id INTO uTeam;
  INSERT INTO auth.users (id,email) VALUES (gen_random_uuid(),'zzv2-removed@test.invalid')  RETURNING id INTO uRemoved;
  INSERT INTO auth.users (id,email) VALUES (gen_random_uuid(),'zzv2-susp@test.invalid')     RETURNING id INTO uSusp;
  INSERT INTO auth.users (id,email) VALUES (gen_random_uuid(),'zzv2-noorg@test.invalid')    RETURNING id INTO uNoOrg;
  INSERT INTO auth.users (id,email) VALUES (gen_random_uuid(),'zzv2-cross@test.invalid')    RETURNING id INTO uCross;

  INSERT INTO public.organization_members (organization_id,user_id,role,status,org_role)
    VALUES (orgA,uCreator,'member','active','PROJECT_MANAGER') RETURNING id INTO mCreator;
  INSERT INTO public.organization_members (organization_id,user_id,role,status,org_role)
    VALUES (orgA,uAnalyst,'member','active','TEAM_MEMBER') RETURNING id INTO mAnalyst;
  INSERT INTO public.organization_members (organization_id,user_id,role,status,org_role)
    VALUES (orgA,uAuditor,'member','active','TEAM_MEMBER') RETURNING id INTO mAuditor;
  INSERT INTO public.organization_members (organization_id,user_id,role,status,org_role)
    VALUES (orgA,uTeam,'member','active','TEAM_MEMBER') RETURNING id INTO mTeam;
  INSERT INTO public.organization_members (organization_id,user_id,role,status,org_role)
    VALUES (orgA,uRemoved,'member','removed','TEAM_MEMBER') RETURNING id INTO mRemoved;
  INSERT INTO public.organization_members (organization_id,user_id,role,status,org_role)
    VALUES (orgA,uSusp,'member','suspended','TEAM_MEMBER') RETURNING id INTO mSusp;
  INSERT INTO public.organization_members (organization_id,user_id,role,status,org_role)
    VALUES (orgB,uCross,'owner','active','COMPANY_OWNER') RETURNING id INTO mCross;
  -- uNoOrg deliberately gets no membership anywhere.

  -- `project.create` is granted only to pmo_director and pmo_manager. The
  -- creator gets pmo_manager on the NON-DEFAULT unit; the analyst and auditor
  -- get roles that read but never create.
  INSERT INTO public.governance_unit_memberships
    (organization_id,governance_unit_id,organization_member_id,role_key,status,provenance) VALUES
    (orgA, unitA, mCreator, 'pmo_manager', 'active', 'manual'),
    (orgA, unitA, mAnalyst, 'pmo_analyst', 'active', 'manual'),
    (orgA, unitA, mAuditor, 'pmo_auditor', 'active', 'manual'),
    (orgA, unitA, mRemoved, 'pmo_manager', 'active', 'manual'),
    (orgA, unitA, mSusp,    'pmo_manager', 'active', 'manual');
  -- `removed` and `suspended` hold a role that WOULD grant project.create. If
  -- they are refused it is because of membership status, which is the point.
  -- `teammember` gets no unit membership at all.

  -- A seed project so `teammember` can have a genuine project_team_members row —
  -- project team membership must not be a path to creating projects.
  INSERT INTO public.projects (organization_id, slug, title_i18n, project_type)
    VALUES (orgA, 'zzv2-seed-'||gen_random_uuid(), '{"en":"V2 Seed"}'::jsonb, 'general')
    RETURNING id INTO seedProject;
  INSERT INTO public.project_team_members
    (organization_id, project_id, user_id, member_type, permission_level, status)
    VALUES (orgA, seedProject, uTeam, 'internal_user', 'contributor', 'active');
  report := report || E'2: 8 principals — creator(pmo_manager on non-default), analyst, auditor, teammember, removed, suspended, no-org, cross-tenant\n';

  -- ══ 3-7. The happy path ══════════════════════════════════════════════════
  slugMain := 'zzv2-'||gen_random_uuid();
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uCreator)::text, true);

  BEGIN
    SELECT c.project_id INTO pMain
    FROM public.create_project_v2(orgA, unitA, slugMain, '{"en":"E2E"}'::jsonb) c;
    ok := pMain IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    ok := false;
    failures := failures || format(E'  1: the creator could not create a project: %s\n', SQLERRM);
  END;
  IF NOT ok THEN
    RAISE EXCEPTION E'E2E_FAIL\n%\n%', failures || E'  1: nothing else can be measured without a project\n', report
      USING ERRCODE='22000';
  END IF;
  report := report || E'1: creator created a governed project in the non-default unit\n';

  -- 2. exactly one project
  SELECT count(*) INTO nProjects FROM public.projects WHERE id = pMain AND deleted_at IS NULL;
  IF nProjects <> 1 THEN
    failures := failures || format(E'  2: %s projects rows for the returned id, expected 1\n', nProjects);
  END IF;

  -- 3. exactly one active multi_pmo_v2 contract
  SELECT count(*) INTO nContracts FROM public.project_governance_contracts c
   WHERE c.project_id = pMain AND c.contract_key = 'multi_pmo_v2' AND c.status = 'active';
  IF nContracts <> 1 THEN
    failures := failures || format(E'  3: %s active multi_pmo_v2 contracts, expected 1\n', nContracts);
  END IF;

  -- 4. exactly one active owner
  SELECT count(*) INTO nOwners FROM public.project_governance_assignments a
   WHERE a.project_id = pMain AND a.relationship_type = 'owner'
     AND a.status = 'active' AND a.deleted_at IS NULL;
  IF nOwners <> 1 THEN
    failures := failures || format(E'  4: %s active owner assignments, expected 1\n', nOwners);
    nMultiOwner := greatest(nOwners - 1, 0);
  END IF;

  -- 5. all three rows carry organization_id = orgA
  SELECT count(*) INTO n FROM public.projects WHERE id = pMain AND organization_id = orgA;
  IF n <> 1 THEN failures := failures || E'  5: the project does not carry organization_id = org A\n'; END IF;
  SELECT count(*) INTO n FROM public.project_governance_contracts
   WHERE project_id = pMain AND organization_id = orgA;
  IF n <> 1 THEN failures := failures || E'  5: the contract does not carry organization_id = org A\n'; END IF;
  SELECT count(*) INTO n FROM public.project_governance_assignments
   WHERE project_id = pMain AND relationship_type='owner' AND status='active'
     AND deleted_at IS NULL AND organization_id = orgA;
  IF n <> 1 THEN failures := failures || E'  5: the owner assignment does not carry organization_id = org A\n'; END IF;

  -- 6. THE LOAD-BEARING ONE: the chosen unit wins over the system default.
  SELECT c.governance_unit_id INTO contractUnit
    FROM public.project_governance_contracts c WHERE c.project_id = pMain AND c.status='active' LIMIT 1;
  SELECT a.governance_unit_id INTO ownerUnit
    FROM public.project_governance_assignments a
   WHERE a.project_id = pMain AND a.relationship_type='owner'
     AND a.status='active' AND a.deleted_at IS NULL LIMIT 1;

  IF contractUnit IS DISTINCT FROM unitA THEN
    failures := failures || E'  6: the contract points at the wrong unit (expected the chosen non-default unit)\n';
  END IF;
  IF ownerUnit IS DISTINCT FROM unitA THEN
    failures := failures ||
      E'  6: the legacy sync trigger overrode the chosen unit — the owner is the SYSTEM DEFAULT\n';
  END IF;
  IF ownerUnit IS NOT DISTINCT FROM defaultUnitA THEN
    failures := failures || E'  6: the owner unit is the system default, not the unit the caller chose\n';
  END IF;
  IF contractUnit IS DISTINCT FROM ownerUnit THEN
    failures := failures || E'  6: contract and owner point at different units\n';
  END IF;
  report := report || E'6: chosen NON-default unit owns the project; contract and owner agree (default unit overridden)\n';

  -- 7. the selector never leaks another tenant's units
  SELECT count(*) INTO n FROM public.v2_creatable_units(orgA) u
   WHERE u.unit_id NOT IN (SELECT id FROM public.governance_units WHERE organization_id = orgA);
  IF n <> 0 THEN
    failures := failures || format(E'  7: v2_creatable_units(orgA) returned %s unit(s) from another organization\n', n);
  END IF;
  SELECT count(*) INTO n FROM public.v2_creatable_units(orgA) u
   WHERE u.unit_id IN (SELECT id FROM public.governance_units WHERE organization_id = orgB);
  IF n <> 0 THEN
    failures := failures || format(E'  7: v2_creatable_units(orgA) leaked %s org-B unit(s)\n', n);
    nCrossTenant := nCrossTenant + n;
  END IF;
  SELECT count(*) INTO n FROM public.v2_creatable_units(orgA);
  IF n < 2 THEN
    failures := failures || format(E'  7: the creator was offered only %s unit(s); the default and the chosen unit were both expected\n', n);
  END IF;
  -- org B's units are invisible to the creator entirely
  SELECT count(*) INTO n FROM public.v2_creatable_units(orgB);
  IF n <> 0 THEN
    failures := failures || format(E'  7: v2_creatable_units(orgB) returned %s unit(s) to a non-member of org B\n', n);
    nCrossTenant := nCrossTenant + n;
  END IF;
  report := report || E'7: v2_creatable_units scoped to org A only; org B returns nothing\n';

  -- ══ 8-10. Denials. A refusal only counts if it also wrote nothing ════════
  -- Every attempt is bracketed by row counts, because "it raised an exception"
  -- and "it left no trace" are different claims and only the second one matters.
  FOR r IN
    SELECT * FROM (VALUES
      ('analyst',     uAnalyst, orgA, unitA),
      ('auditor',     uAuditor, orgA, unitA),
      ('teammember',  uTeam,    orgA, unitA),
      ('removed',     uRemoved, orgA, unitA),
      ('suspended',   uSusp,    orgA, unitA),
      ('noorg',       uNoOrg,   orgA, unitA),
      ('crosstenant', uCross,   orgA, unitA),
      ('creator+cross-tenant-unit', uCreator, orgA, defaultUnitB),
      ('creator+non-member-org',    uCreator, orgB, defaultUnitB)
    ) AS t(label, u, org, unit)
  LOOP
    SELECT count(*) INTO projBefore  FROM public.projects;
    SELECT count(*) INTO contrBefore FROM public.project_governance_contracts;
    SELECT count(*) INTO ownBefore   FROM public.project_governance_assignments
      WHERE relationship_type='owner' AND status='active' AND deleted_at IS NULL;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', r.u)::text, true);
    BEGIN
      PERFORM public.create_project_v2(r.org, r.unit, 'zzv2-denied-'||gen_random_uuid(), '{"en":"Denied"}'::jsonb);
      failures := failures || format(E'  8: %s CREATED a governed project and must not have\n', r.label);
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- expected; the row counts below decide whether it was clean
    END;

    SELECT count(*) INTO n FROM public.projects;
    IF n <> projBefore THEN
      deniedProjects := deniedProjects + (n - projBefore);
      failures := failures || format(E'  8: %s left %s projects row(s) behind after being refused\n', r.label, n - projBefore);
    END IF;
    SELECT count(*) INTO n FROM public.project_governance_contracts;
    IF n <> contrBefore THEN
      deniedContracts := deniedContracts + (n - contrBefore);
      failures := failures || format(E'  8: %s left %s contract row(s) behind after being refused\n', r.label, n - contrBefore);
    END IF;
    SELECT count(*) INTO n FROM public.project_governance_assignments
      WHERE relationship_type='owner' AND status='active' AND deleted_at IS NULL;
    IF n <> ownBefore THEN
      deniedOwners := deniedOwners + (n - ownBefore);
      failures := failures || format(E'  8: %s left %s owner row(s) behind after being refused\n', r.label, n - ownBefore);
    END IF;
  END LOOP;
  report := report || E'8-10: analyst, auditor, teammember, removed, suspended, no-org, cross-tenant all refused; cross-tenant unit and non-member org refused; zero rows written\n';

  -- ══ 11. Double submit ════════════════════════════════════════════════════
  -- Two identical calls, as a double-clicked form makes. The unique key on
  -- (organization_id, slug) is the only thing standing between that and two
  -- projects, so the assertion is on the resulting count, not on the error.
  slugDup := 'zzv2-dup-'||gen_random_uuid();
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uCreator)::text, true);
  BEGIN
    SELECT c.project_id INTO dupProject
    FROM public.create_project_v2(orgA, unitA, slugDup, '{"en":"Dup"}'::jsonb) c;
  EXCEPTION WHEN OTHERS THEN
    failures := failures || format(E'  11: the FIRST submit failed: %s\n', SQLERRM);
  END;

  BEGIN
    PERFORM public.create_project_v2(orgA, unitA, slugDup, '{"en":"Dup"}'::jsonb);
    report := report || E'11: double submit — the second call SUCCEEDED (no unique-key refusal)\n';
  EXCEPTION WHEN unique_violation THEN
    report := report || E'11: double submit — the second call was refused by the unique (organization_id, slug) key\n';
  WHEN OTHERS THEN
    report := report || format(E'11: double submit — the second call was refused (%s)\n', SQLERRM);
  END;

  SELECT count(*) INTO n FROM public.projects WHERE organization_id = orgA AND slug = slugDup;
  IF n <> 1 THEN
    failures := failures || format(E'  11: %s projects share the slug after a double submit, expected exactly 1\n', n);
  END IF;

  -- ══ 12. Direct insert, bypassing the command ═════════════════════════════
  -- The command is only a real boundary if the table underneath refuses the
  -- shortcut. A project written directly has no contract and no owner, so if
  -- this succeeds the "three rows or none" guarantee is advisory.
  --
  -- The principal here is the ANALYST, who does not hold project.create. A
  -- refusal is only meaningful for a caller the capability check should reject;
  -- using the creator would leave "membership was enough" and "the capability
  -- was checked" indistinguishable.
  --
  -- The SQLSTATE is captured rather than a boolean, because "it threw" is not
  -- the claim under test — 42501 is. A NOT NULL (23502), CHECK (23514) or
  -- unique-key (23505) failure would also raise, and would make this assertion
  -- pass while proving nothing about authorisation.
  SELECT count(*) INTO n FROM public.projects;
  projBefore := n;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uAnalyst)::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.projects (organization_id, slug, title_i18n, project_type)
    VALUES (orgA, 'zzv2-direct-'||gen_random_uuid(), '{"en":"Direct"}'::jsonb, 'general');
    directInsertAllowed := true;
    directInsertState := 'INSERTED';
    directInsertMsg := '';
  EXCEPTION WHEN OTHERS THEN
    directInsertAllowed := false;
    directInsertState := SQLSTATE;
    directInsertMsg := SQLERRM;
  END;
  RESET ROLE;

  IF directInsertAllowed THEN
    failures := failures ||
      E'  12: RLS ALLOWED a direct INSERT into public.projects, bypassing create_project_v2 entirely.\n' ||
      E'      The resulting project has NO governance contract and NO owner assignment, so the\n' ||
      E'      "one project + one contract + one owner, or nothing" guarantee is advisory rather\n' ||
      E'      than enforced. REAL FINDING, not a test artefact.\n';
    report := report || E'12: direct INSERT into projects SUCCEEDED under RLS — see failure above\n';
  ELSIF directInsertState <> '42501' THEN
    -- Refused, but for the wrong reason. This is a failure: the assertion must
    -- not be satisfied by an incidental constraint violation.
    failures := failures || format(
      E'  12: the direct INSERT was refused with SQLSTATE %s (%s), not 42501. The refusal is\n' ||
      E'      incidental — a constraint, not the authorisation boundary — so this assertion\n' ||
      E'      proves nothing about RLS.\n', directInsertState, directInsertMsg);
    report := report || format(E'12: direct INSERT refused by SQLSTATE %s, NOT an authorisation refusal\n', directInsertState);
  ELSE
    report := report || format(E'12: direct INSERT into projects refused by RLS (42501: %s)\n', directInsertMsg);
  END IF;

  -- A direct insert must also have written nothing.
  SELECT count(*) INTO n FROM public.projects;
  IF n <> projBefore THEN
    failures := failures || format(E'  12: the direct INSERT left %s projects row(s) behind\n', n - projBefore);
  END IF;

  -- ══ 13. Atomicity — force the owner step to fail ═════════════════════════
  -- The single-owner rule is defended twice, and the two halves fail at
  -- different moments. Testing only one of them and calling it "the constraint"
  -- would misreport which mechanism is actually holding the line.
  --
  --   TOO MANY owners is caught IMMEDIATELY by the pre-existing partial unique
  --   index `uq_pga_single_active_owner` (one active owner row per project).
  --   The deferred trigger never gets a chance — the INSERT fails at statement
  --   time with 23505.
  --
  --   ZERO owners is the deferred trigger's exclusive job. No unique index can
  --   express "at least one", so `trg_v2_single_active_owner` is the only thing
  --   that catches an owner being retired without a replacement.
  --
  -- A PL/pgSQL BEGIN...EXCEPTION block is an internal SAVEPOINT, and a
  -- DEFERRABLE INITIALLY DEFERRED constraint trigger is evaluated at COMMIT, not
  -- at savepoint release — so the zero-owner case cannot be provoked by nesting
  -- alone inside a transaction that always rolls back. `SET CONSTRAINTS ...
  -- IMMEDIATE` forces that evaluation to happen at a chosen point, which is the
  -- faithful stand-in for COMMIT and leaves no residue.
  savepointHeld := false;
  DECLARE
    atomicProject uuid; atomicSlug text;
    dupOwnerState text := 'not reached';
    zeroOwnerState text := 'not reached';
  BEGIN
    atomicSlug := 'zzv2-atomic-'||gen_random_uuid();
    PERFORM set_config('request.jwt.claims', json_build_object('sub', uCreator)::text, true);
    SELECT c.project_id INTO atomicProject
    FROM public.create_project_v2(orgA, unitA, atomicSlug, '{"en":"Atomic"}'::jsonb) c;

    -- 13a. TOO MANY: a second active owner must be rejected.
    BEGIN
      INSERT INTO public.project_governance_assignments
        (organization_id, project_id, governance_unit_id, relationship_type,
         status, provenance, created_by, effective_from)
      VALUES
        (orgA, atomicProject, defaultUnitA, 'owner', 'active', 'manual', uCreator, current_date);
      dupOwnerState := 'ACCEPTED';
    EXCEPTION WHEN OTHERS THEN
      dupOwnerState := SQLSTATE;
    END;

    IF dupOwnerState = 'ACCEPTED' THEN
      failures := failures ||
        E'  13a: a project was left with TWO active owners — neither the unique index nor the deferred trigger rejected it\n';
      SELECT count(*) INTO n FROM public.project_governance_assignments a
       WHERE a.project_id = atomicProject AND a.relationship_type='owner'
         AND a.status='active' AND a.deleted_at IS NULL;
      nMultiOwner := nMultiOwner + greatest(n - 1, 0);
    ELSE
      report := report || format(E'13a: a second active owner was rejected immediately (SQLSTATE %s, uq_pga_single_active_owner)\n',
                                 dupOwnerState);
    END IF;

    -- 13b. ZERO: retiring the only owner must be rejected when constraints are
    -- actually evaluated. This is the deferred trigger and nothing else.
    BEGIN
      UPDATE public.project_governance_assignments a
         SET status = 'inactive', deleted_at = now()
       WHERE a.project_id = atomicProject
         AND a.relationship_type = 'owner'
         AND a.status = 'active';

      BEGIN
        SET CONSTRAINTS public.trg_v2_single_active_owner IMMEDIATE;
        zeroOwnerState := 'ACCEPTED';
      EXCEPTION WHEN OTHERS THEN
        zeroOwnerState := SQLSTATE;
      END;
      -- Put the owner back so the deferred trigger is satisfied at rollback and
      -- the surrounding block is left in a consistent state.
      IF zeroOwnerState <> 'ACCEPTED' THEN
        UPDATE public.project_governance_assignments a
           SET status = 'active', deleted_at = NULL
         WHERE a.project_id = atomicProject
           AND a.relationship_type = 'owner'
           AND a.governance_unit_id = unitA;
      END IF;
    END;

    IF zeroOwnerState = 'ACCEPTED' THEN
      failures := failures ||
        E'  13b: a governed project was left with ZERO active owners — the deferred single-owner trigger did not fire\n';
      nPartial := nPartial + 1;
    ELSE
      report := report || format(E'13b: retiring the only owner was rejected at constraint-check time (SQLSTATE %s, trg_v2_single_active_owner)\n',
                                 zeroOwnerState);
    END IF;

    -- 13c. Whatever was rejected, no half-built project may survive: the
    -- project that does exist must still carry exactly one contract and exactly
    -- one active owner.
    SELECT count(*) INTO n FROM public.project_governance_contracts
     WHERE project_id = atomicProject AND status = 'active';
    IF n <> 1 THEN
      nPartial := nPartial + abs(n - 1);
      failures := failures || format(E'  13c: the project carries %s active contracts, expected 1\n', n);
    END IF;
    SELECT count(*) INTO n FROM public.project_governance_assignments a
     WHERE a.project_id = atomicProject AND a.relationship_type='owner'
       AND a.status='active' AND a.deleted_at IS NULL;
    IF n <> 1 THEN
      nPartial := nPartial + abs(n - 1);
      failures := failures || format(E'  13c: the project carries %s active owners, expected 1\n', n);
    END IF;
    -- and no orphan project exists without a contract
    SELECT count(*) INTO n FROM public.projects p
     WHERE p.organization_id = orgA
       AND p.slug LIKE 'zzv2-atomic-%'
       AND NOT EXISTS (SELECT 1 FROM public.project_governance_contracts c
                        WHERE c.project_id = p.id AND c.status='active');
    IF n <> 0 THEN
      nPartial := nPartial + n;
      failures := failures || format(E'  13c: %s atomic-test project(s) exist with no active contract\n', n);
    END IF;
    report := report || E'13c: no partial project, contract or owner survived a rejected owner step\n';
  END;

  -- ══ 14. Nothing was written by any denied attempt ════════════════════════
  IF deniedProjects <> 0 OR deniedContracts <> 0 OR deniedOwners <> 0 THEN
    failures := failures || format(E'  14: denied attempts wrote %s project(s), %s contract(s), %s owner(s); all must be 0\n',
                                   deniedProjects, deniedContracts, deniedOwners);
  END IF;
  report := report || format(E'14: denied attempts wrote %s projects / %s contracts / %s owners\n',
                             deniedProjects, deniedContracts, deniedOwners);

  -- ══ 15. Legacy untouched ═════════════════════════════════════════════════
  -- Only the two synthetic organizations may be new, and only the projects this
  -- test created. Anything else means the run reached into real data.
  SELECT count(*) INTO afterOrgs FROM public.organizations;
  IF afterOrgs <> baseOrgs + 2 THEN
    failures := failures || format(E'  15: organizations went from %s to %s, expected +2\n', baseOrgs, afterOrgs);
  END IF;

  SELECT count(*) INTO n FROM public.projects
   WHERE organization_id NOT IN (orgA, orgB);
  IF n <> baseProjects THEN
    failures := failures || format(E'  15: projects outside the synthetic tenant went from %s to %s\n', baseProjects, n);
  END IF;
  afterProjects := n;

  SELECT count(*) INTO n FROM public.project_governance_contracts
   WHERE organization_id NOT IN (orgA, orgB);
  IF n <> baseContracts THEN
    failures := failures || format(E'  15: %s pre-existing project(s) acquired a governance contract\n', n - baseContracts);
    nCrossTenant := nCrossTenant + (n - baseContracts);
  END IF;
  report := report || format(E'15: legacy untouched — %s organizations before / %s non-synthetic projects unchanged / %s pre-existing contracts unchanged\n',
                             baseOrgs, afterProjects, baseContracts);

  -- No governed row anywhere may point across the tenant boundary.
  SELECT count(*) INTO n
  FROM public.project_governance_contracts c
  JOIN public.projects p ON p.id = c.project_id
  WHERE p.organization_id <> c.organization_id;
  IF n <> 0 THEN
    nCrossTenant := nCrossTenant + n;
    failures := failures || format(E'  15: %s contract(s) point at a project in another organization\n', n);
  END IF;
  SELECT count(*) INTO n
  FROM public.project_governance_assignments a
  JOIN public.governance_units u ON u.id = a.governance_unit_id
  WHERE u.organization_id <> a.organization_id;
  IF n <> 0 THEN
    nCrossTenant := nCrossTenant + n;
    failures := failures || format(E'  15: %s owner assignment(s) point at a unit in another organization\n', n);
  END IF;

  -- ══ Verdict ══════════════════════════════════════════════════════════════
  -- The synthetic tenant is destroyed by the rollback this exception forces, so
  -- residue is zero by construction rather than by cleanup.
  nResidue := 0;

  IF failures <> '' THEN
    RAISE EXCEPTION E'E2E_FAIL\n%\n%', failures, report USING ERRCODE='22000';
  END IF;

  RAISE EXCEPTION E'NEW_V2_PROJECT_E2E_OK\nproject_rows=%\ncontract_rows=%\nactive_owner_rows=%\npartial_rows=%\nmultiple_owners=%\ncross_tenant=%\nsynthetic_residue=0\n%',
    nProjects, nContracts, nOwners, nPartial, nMultiOwner, nCrossTenant, report
    USING ERRCODE='22000';
END
$e2e$;
