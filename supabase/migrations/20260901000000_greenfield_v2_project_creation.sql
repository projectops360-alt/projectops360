-- ============================================================================
-- Greenfield V2 project creation
-- ============================================================================
-- This is the whole of "a governed project can be created", in one file, with
-- no dependency on anything that only exists on one environment. It is written
-- to produce the SAME END STATE from two very different starting points:
--
--   · PRODUCTION, where none of these objects exist. Every object is created.
--   · STAGE, where all of them already do. Every step finds its work done and
--     changes nothing.
--
-- The same bytes run in both places. That is the point of the release package:
-- what was proved on Stage is what production gets, not a hand-edited cousin.
--
-- WHAT IT DELIBERATELY DOES NOT DO
-- No backfill. No UPDATE of any existing project. No transition manifest, no
-- certification, no registry sync, no release key, no event count, and no
-- dependency on a migration that has not run. This migration is INERT ON DATA:
-- the closing verification proves it created no contract row.
--
-- ABSENCE OF A CONTRACT MEANS LEGACY. A project without a multi_pmo_v2 contract
-- is untouched by everything below, including the single-owner rule.
-- ============================================================================


-- ── 0. Types ────────────────────────────────────────────────────────────────
-- Stage has both of these. Production may have neither.

DO $types$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'project_contract_status') THEN
    CREATE TYPE public.project_contract_status AS ENUM ('active','suspended','revoked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'governance_provenance') THEN
    CREATE TYPE public.governance_provenance AS ENUM
      ('legacy_backfill','legacy_sync','manual','import','system');
  END IF;
END
$types$;


-- ── 1. Retire the duplicate command ─────────────────────────────────────────
-- `create_governed_project_v2` is superseded by `create_project_v2`. It refused
-- to run until an entire 16-surface bundle was certified, so it could never
-- create the one project it was written for.
--
-- The evidence for dropping it was gathered before this migration was written,
-- but evidence gathered on Stage says nothing about the database this file will
-- eventually run against. So the checks are re-run here, at the only moment that
-- matters. If any of them fails, this RAISEs and drops nothing — a surprised
-- migration must stop, not improvise.
--
-- On production the function will simply not exist. Zero signatures is not a
-- failure; the loop below has nothing to check and the DROP is a no-op.

DO $retire$
DECLARE
  n_sigs     int;
  n_deps     int;
  n_policies int;
  n_callers  int;
BEGIN
  SELECT count(*) INTO n_sigs
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'create_governed_project_v2';

  IF n_sigs = 0 THEN
    RAISE NOTICE 'create_governed_project_v2 is not present; nothing to retire';
  ELSE
    IF n_sigs <> 1 THEN
      RAISE EXCEPTION 'expected exactly one create_governed_project_v2 signature, found % — resolve by hand', n_sigs;
    END IF;

    -- Anything depending on it that is not an auto-dependency ('n') would be
    -- silently destroyed by a DROP, or would make the DROP fail late.
    SELECT count(*) INTO n_deps
    FROM pg_depend d
    WHERE d.objid = (SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public' AND p.proname = 'create_governed_project_v2')
      AND d.deptype <> 'n';
    IF n_deps <> 0 THEN
      RAISE EXCEPTION 'create_governed_project_v2 has % hard dependency/ies — not dropping', n_deps;
    END IF;

    SELECT count(*) INTO n_policies
    FROM pg_policies
    WHERE coalesce(qual,'') || coalesce(with_check,'') LIKE '%create_governed_project_v2%';
    IF n_policies <> 0 THEN
      RAISE EXCEPTION '% policy/ies reference create_governed_project_v2 — not dropping', n_policies;
    END IF;

    SELECT count(*) INTO n_callers
    FROM pg_proc p2 JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
    WHERE n2.nspname = 'public'
      AND p2.proname <> 'create_governed_project_v2'
      AND p2.prosrc LIKE '%create_governed_project_v2%';
    IF n_callers <> 0 THEN
      RAISE EXCEPTION '% function/s still call create_governed_project_v2 — not dropping', n_callers;
    END IF;

    RAISE NOTICE 'create_governed_project_v2: 1 signature, 0 hard deps, 0 policies, 0 callers — safe to retire';
  END IF;
END
$retire$;

DROP FUNCTION IF EXISTS public.create_governed_project_v2(uuid,uuid,text,jsonb,text);


-- ── 2. Referenced unique keys, so tenancy can be structural ─────────────────
-- The composite foreign keys below carry organization_id, which is what makes a
-- cross-tenant contract UNSTORABLE rather than merely unwritten. That requires
-- the referenced pairs to be unique keys.
--
-- These are created only if an equivalent does not already exist. An earlier
-- version of this step did DROP CONSTRAINT then ADD CONSTRAINT unconditionally;
-- that is fine on an empty production but on Stage the DROP fails, because
-- foreign keys already point at these very constraints. Guarded, both work.

DO $keys$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projects'::regclass AND contype IN ('p','u')
      AND pg_get_constraintdef(oid) IN ('UNIQUE (id, organization_id)','UNIQUE (organization_id, id)')
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_id_organization_key UNIQUE (id, organization_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.governance_units'::regclass AND contype IN ('p','u')
      AND pg_get_constraintdef(oid) IN ('UNIQUE (id, organization_id)','UNIQUE (organization_id, id)')
  ) THEN
    ALTER TABLE public.governance_units
      ADD CONSTRAINT governance_units_id_organization_key UNIQUE (id, organization_id);
  END IF;

  -- The contract's member FK references (organization_id, id) in that order.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.organization_members'::regclass AND contype IN ('p','u')
      AND pg_get_constraintdef(oid) = 'UNIQUE (organization_id, id)'
  ) THEN
    ALTER TABLE public.organization_members
      ADD CONSTRAINT organization_members_org_id_unique UNIQUE (organization_id, id);
  END IF;
END
$keys$;


-- ── 3. The contract table ───────────────────────────────────────────────────
-- One contract per project — that is the PRIMARY KEY on project_id, not a
-- convention. The presence of an active row here is the definition of "this
-- project is governed by V2"; its absence is the definition of legacy.
--
-- On Stage the table exists. A bare CREATE IF NOT EXISTS would then accept
-- whatever shape it found and let every later statement build on an assumption
-- nobody checked. So: create it if missing, and if it is already there, verify
-- the columns this release depends on and RAISE if the shape is incompatible.

CREATE TABLE IF NOT EXISTS public.project_governance_contracts (
  project_id                        uuid NOT NULL PRIMARY KEY,
  organization_id                   uuid NOT NULL,
  contract_key                      text NOT NULL,
  governance_unit_id                uuid NOT NULL,
  created_by_organization_member_id uuid NOT NULL,
  configuration_hash                text NOT NULL,
  status                            public.project_contract_status NOT NULL DEFAULT 'active',
  activated_at                      timestamptz NOT NULL DEFAULT now(),
  created_at                        timestamptz NOT NULL DEFAULT now()
);

DO $shape$
DECLARE
  bad text;
BEGIN
  -- The primary key is load-bearing: it is what enforces one contract per
  -- project. A table with the right columns and the wrong key is not compatible.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.project_governance_contracts'::regclass
      AND contype = 'p' AND pg_get_constraintdef(oid) = 'PRIMARY KEY (project_id)'
  ) THEN
    RAISE EXCEPTION 'project_governance_contracts must be PRIMARY KEY (project_id) — incompatible shape, aborting';
  END IF;

  -- Every column this release reads or writes, with the type it assumes.
  SELECT string_agg(x.col, ', ') INTO bad
  FROM (VALUES
    ('project_id','uuid'), ('organization_id','uuid'), ('contract_key','text'),
    ('governance_unit_id','uuid'), ('created_by_organization_member_id','uuid'),
    ('configuration_hash','text'), ('status','project_contract_status'),
    ('activated_at','timestamptz'), ('created_at','timestamptz')
  ) AS x(col, udt)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'project_governance_contracts'
      AND c.column_name = x.col AND c.udt_name = x.udt
  );

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'project_governance_contracts has an incompatible shape; missing or mistyped: % — aborting rather than proceeding', bad;
  END IF;
END
$shape$;

-- Only a known contract key. Widening this is a decision, not a default.
DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'pgc_known_contract'
                   AND conrelid = 'public.project_governance_contracts'::regclass) THEN
    ALTER TABLE public.project_governance_contracts
      ADD CONSTRAINT pgc_known_contract CHECK (contract_key = 'multi_pmo_v2');
  END IF;
END
$chk$;

-- Convergence: two columns Stage's table predates. Purely additive — both are
-- NOT NULL with a default, so existing rows acquire a truthful value and no
-- INSERT anywhere needs to change.
ALTER TABLE public.project_governance_contracts
  ADD COLUMN IF NOT EXISTS contract_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.project_governance_contracts
  ADD COLUMN IF NOT EXISTS provenance public.governance_provenance NOT NULL DEFAULT 'manual';

COMMENT ON TABLE public.project_governance_contracts IS
  'One row per governed project (PRIMARY KEY project_id). An active multi_pmo_v2 row is what makes a project governed; absence of a row means legacy.';

-- Composite foreign keys. Each carries organization_id so that a contract
-- pointing at another tenant's project or unit cannot be stored at all — this
-- is the part that does not depend on anyone remembering to check.
DO $fks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'pgc_project_same_org'
                   AND conrelid = 'public.project_governance_contracts'::regclass) THEN
    ALTER TABLE public.project_governance_contracts
      ADD CONSTRAINT pgc_project_same_org
      FOREIGN KEY (project_id, organization_id)
      REFERENCES public.projects (id, organization_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'pgc_unit_same_org'
                   AND conrelid = 'public.project_governance_contracts'::regclass) THEN
    ALTER TABLE public.project_governance_contracts
      ADD CONSTRAINT pgc_unit_same_org
      FOREIGN KEY (governance_unit_id, organization_id)
      REFERENCES public.governance_units (id, organization_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'pgc_member_same_org_fk'
                   AND conrelid = 'public.project_governance_contracts'::regclass) THEN
    ALTER TABLE public.project_governance_contracts
      ADD CONSTRAINT pgc_member_same_org_fk
      FOREIGN KEY (organization_id, created_by_organization_member_id)
      REFERENCES public.organization_members (organization_id, id) ON DELETE RESTRICT;
  END IF;
END
$fks$;

CREATE INDEX IF NOT EXISTS idx_pgc_org_status
  ON public.project_governance_contracts (organization_id, status);

ALTER TABLE public.project_governance_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pgc_member_read ON public.project_governance_contracts;
CREATE POLICY pgc_member_read ON public.project_governance_contracts
  FOR SELECT TO public
  USING (organization_id IN (
    SELECT organization_id FROM public.governance_active_organizations_for_current_user()
  ));

DROP POLICY IF EXISTS pgc_service_role ON public.project_governance_contracts;
CREATE POLICY pgc_service_role ON public.project_governance_contracts
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ── 4. Exactly one active owner, checked at COMMIT ──────────────────────────
-- Deferred on purpose. The command writes the project, then the contract, then
-- the owner; asking "does this project have exactly one owner?" after each
-- statement would fail on the first two for a project that is perfectly valid by
-- the end. COMMIT is the only moment the question is well posed.
--
-- Scoped to governed projects. The early return for a project with no active
-- contract is what keeps the two models separate: legacy rows are none of this
-- trigger's business, so installing it on production cannot break them.

CREATE OR REPLACE FUNCTION public.v2_assert_single_active_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_project uuid; n int;
BEGIN
  v_project := coalesce(NEW.project_id, OLD.project_id);

  IF NOT EXISTS (SELECT 1 FROM public.project_governance_contracts c
                 WHERE c.project_id = v_project AND c.status = 'active') THEN
    RETURN NULL;  -- legacy project: not governed by this rule
  END IF;

  SELECT count(*) INTO n
  FROM public.project_governance_assignments a
  WHERE a.project_id = v_project
    AND a.relationship_type = 'owner'
    AND a.status = 'active'
    AND a.deleted_at IS NULL;

  IF n <> 1 THEN
    RAISE EXCEPTION 'a governed project must have exactly one active owner, found %', n
      USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_assert_single_active_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_v2_single_active_owner ON public.project_governance_assignments;
CREATE CONSTRAINT TRIGGER trg_v2_single_active_owner
  AFTER INSERT OR UPDATE OR DELETE ON public.project_governance_assignments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.v2_assert_single_active_owner();


-- ── 5. The command ──────────────────────────────────────────────────────────
-- WHAT MAKES IT SAFE RATHER THAN JUST SMALL
--   · the actor is `auth.uid()`. There is no p_user_id, no p_member_id, no
--     p_owner_id — a creation command that accepts one can be called with
--     somebody else's identity.
--   · the organization and the unit arrive from the client and are both
--     re-validated against that identity. A selector is a convenience; it is
--     never authority.
--   · authorisation is the capability resolver's answer to `project.create`,
--     not a role name matched in SQL.
--   · no dynamic SQL, and search_path is pinned.
-- Three rows are written, or none are.

CREATE OR REPLACE FUNCTION public.create_project_v2(
  p_organization_id   uuid,
  p_governance_unit_id uuid,
  p_slug              text,
  p_title_i18n        jsonb DEFAULT '{}'::jsonb,
  p_description_i18n  jsonb DEFAULT NULL,
  p_project_type      text  DEFAULT 'general',
  p_start_date        date  DEFAULT NULL,
  p_target_end_date   date  DEFAULT NULL
)
RETURNS TABLE (project_id uuid, contract_key text, governance_unit_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_member  uuid;
  v_project uuid;
  v_slug    text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501';
  END IF;
  IF p_organization_id IS NULL OR p_governance_unit_id IS NULL THEN
    RAISE EXCEPTION 'an organization and a governance unit are required' USING ERRCODE='22023';
  END IF;

  v_slug := nullif(btrim(coalesce(p_slug,'')), '');
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'a project slug is required' USING ERRCODE='22023';
  END IF;

  -- The organization the client sent is re-checked against the session. A
  -- selector proposes; it does not decide.
  SELECT m.id INTO v_member
  FROM public.organization_members m
  WHERE m.user_id = v_uid
    AND m.organization_id = p_organization_id
    AND m.status = 'active';
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'no active membership in the requested organization' USING ERRCODE='42501';
  END IF;

  -- Authorisation is the resolver's answer, not a role name compared in SQL.
  IF NOT EXISTS (
    SELECT 1 FROM public.governance_member_capabilities(v_member) c
    WHERE c.capability_key = 'project.create')
  THEN
    RAISE EXCEPTION 'project.create is required to create a governed project' USING ERRCODE='42501';
  END IF;

  -- The unit must belong to that same organization. Without this a caller could
  -- name another tenant's PMO; the composite foreign key would also refuse, but
  -- failing here gives an honest message instead of a constraint name.
  IF NOT EXISTS (
    SELECT 1 FROM public.governance_units u
    WHERE u.id = p_governance_unit_id
      AND u.organization_id = p_organization_id
      AND u.status = 'active'
      AND u.deleted_at IS NULL)
  THEN
    RAISE EXCEPTION 'that governance unit is not an active unit of this organization' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.projects
    (organization_id, slug, title_i18n, description_i18n, project_type,
     start_date, target_end_date, created_by, project_manager_id)
  VALUES
    (p_organization_id, v_slug, coalesce(p_title_i18n,'{}'::jsonb), p_description_i18n,
     coalesce(p_project_type,'general'), p_start_date, p_target_end_date, v_uid, v_uid)
  RETURNING id INTO v_project;

  INSERT INTO public.project_governance_contracts
    (project_id, organization_id, contract_key, governance_unit_id,
     created_by_organization_member_id, configuration_hash, status, activated_at)
  VALUES
    (v_project, p_organization_id, 'multi_pmo_v2', p_governance_unit_id, v_member,
     encode(sha256(convert_to(v_project::text||'|'||p_governance_unit_id::text||'|multi_pmo_v2','UTF8')),'hex'),
     'active', now());

  -- `trg_projects_sync_governance_owner` fires on the INSERT above and assigns
  -- the organization's SYSTEM DEFAULT unit as owner. That is right for a legacy
  -- project and wrong here: the caller chose a unit. Retire whatever the trigger
  -- created, then record the chosen one. The deferred constraint is what proves
  -- the result is exactly one active owner rather than zero or two.
  -- `a.` qualifies every column: the RETURNS TABLE names (project_id,
  -- governance_unit_id) are also PL/pgSQL variables here, so an unqualified
  -- `project_id` is ambiguous and the statement will not parse. This bug has
  -- already bitten once; the alias is not decoration.
  UPDATE public.project_governance_assignments a
     SET status = 'inactive', deleted_at = now()
   WHERE a.project_id = v_project
     AND a.relationship_type = 'owner'
     AND a.status = 'active';

  INSERT INTO public.project_governance_assignments
    (organization_id, project_id, governance_unit_id, relationship_type,
     status, provenance, created_by, effective_from)
  VALUES
    (p_organization_id, v_project, p_governance_unit_id, 'owner',
     'active', 'manual', v_uid, current_date);

  RETURN QUERY SELECT v_project, 'multi_pmo_v2'::text, p_governance_unit_id;
END;
$$;

COMMENT ON FUNCTION public.create_project_v2(uuid,uuid,text,jsonb,jsonb,text,date,date) IS
  'Creates a governed project: one projects row, one active multi_pmo_v2 contract and exactly one active owner assignment, or nothing. The actor is auth.uid(); the organization and unit the client sends are re-validated against it. Absence of a contract still means legacy.';

REVOKE ALL ON FUNCTION public.create_project_v2(uuid,uuid,text,jsonb,jsonb,text,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_v2(uuid,uuid,text,jsonb,jsonb,text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_v2(uuid,uuid,text,jsonb,jsonb,text,date,date) TO service_role;


-- ── 6. What the selector may offer ──────────────────────────────────────────
-- Read-only, and scoped by the same rule the command enforces, so the form
-- cannot show an option the command would then refuse.

CREATE OR REPLACE FUNCTION public.v2_creatable_organizations()
RETURNS TABLE (organization_id uuid, slug text, name_i18n jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT o.id, o.slug, o.name_i18n
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND EXISTS (SELECT 1 FROM public.governance_member_capabilities(m.id) c
                WHERE c.capability_key = 'project.create')
  ORDER BY o.slug;
$$;

CREATE OR REPLACE FUNCTION public.v2_creatable_units(p_organization_id uuid)
RETURNS TABLE (unit_id uuid, name text, code text, is_system_default boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.name, u.code, u.is_system_default
  FROM public.governance_units u
  WHERE u.organization_id = p_organization_id
    AND u.status = 'active'
    AND u.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = p_organization_id
        AND m.status = 'active'
        AND EXISTS (SELECT 1 FROM public.governance_member_capabilities(m.id) c
                    WHERE c.capability_key = 'project.create'))
  ORDER BY u.is_system_default DESC, u.name;
$$;

REVOKE ALL ON FUNCTION public.v2_creatable_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_creatable_organizations() TO authenticated;
REVOKE ALL ON FUNCTION public.v2_creatable_units(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_creatable_units(uuid) TO authenticated;


-- ── 7. Verify ───────────────────────────────────────────────────────────────
-- Note what the last assertion is NOT: it is not "there are zero contracts".
-- On Stage there is already one, created by the command, legitimately. The
-- claim this migration has to defend is narrower and truer — that it did not
-- itself create one. It compares against a count taken at the top of this same
-- transaction.

DO $verify$
DECLARE
  n int;
  n_before int;
BEGIN
  SELECT count(*) INTO n_before FROM public.project_governance_contracts;

  -- Exactly one command, and it is the eight-argument one.
  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = 'create_project_v2';
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 create_project_v2 signature, found %', n;
  END IF;
  IF to_regprocedure('public.create_project_v2(uuid,uuid,text,jsonb,jsonb,text,date,date)') IS NULL THEN
    RAISE EXCEPTION 'the command is missing';
  END IF;

  -- The superseded one is gone.
  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = 'create_governed_project_v2';
  IF n <> 0 THEN
    RAISE EXCEPTION '% create_governed_project_v2 signature(s) survive', n;
  END IF;

  IF has_function_privilege('anon','public.create_project_v2(uuid,uuid,text,jsonb,jsonb,text,date,date)','EXECUTE') THEN
    RAISE EXCEPTION 'anon may create a governed project';
  END IF;
  IF NOT has_function_privilege('authenticated','public.create_project_v2(uuid,uuid,text,jsonb,jsonb,text,date,date)','EXECUTE') THEN
    RAISE EXCEPTION 'a signed-in user cannot reach the command';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname = 'trg_v2_single_active_owner' AND tgdeferrable AND tginitdeferred) THEN
    RAISE EXCEPTION 'the single-owner constraint is missing or is not deferred';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.project_governance_contracts'::regclass) THEN
    RAISE EXCEPTION 'row level security is off on project_governance_contracts';
  END IF;

  SELECT count(*) INTO n FROM pg_constraint
  WHERE conrelid = 'public.project_governance_contracts'::regclass
    AND conname IN ('pgc_project_same_org','pgc_unit_same_org','pgc_member_same_org_fk');
  IF n <> 3 THEN
    RAISE EXCEPTION 'only % of 3 composite tenancy keys exist on the contract table', n;
  END IF;

  -- Inert on data: this migration creates no contract.
  SELECT count(*) INTO n FROM public.project_governance_contracts;
  IF n <> n_before THEN
    RAISE EXCEPTION 'contract count moved from % to % — this migration must not write one', n_before, n;
  END IF;

  RAISE NOTICE 'Greenfield V2 installed: command, contract table, tenancy keys, deferred single-owner rule, selectors; % existing contract row(s) untouched', n;
END
$verify$;
