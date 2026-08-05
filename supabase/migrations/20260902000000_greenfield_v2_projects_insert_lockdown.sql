-- ============================================================================
-- A project is created by the command, not by INSERT
-- ============================================================================
-- `po_insert` on `projects` used to check only `is_org_member(organization_id)`.
-- So any active member could write straight into the table and get an UNGOVERNED
-- project — no contract, no owner, invisible to V2. The deferred single-owner
-- trigger stays silent for such a row by design, because it early-returns for
-- projects with no active contract. Proved rather than assumed: a `pmo_analyst`
-- who provably lacks `project.create` was refused by the command with 42501, and
-- his direct INSERT succeeded.
--
-- An intermediate version required `project.create` inside the policy via
-- `governance_member_capabilities`. It closed the hole, but not for the reason it
-- appeared to: that function grants EXECUTE only to postgres and service_role,
-- and a policy predicate is evaluated as the CALLING role, so the INSERT aborted
-- with "permission denied for function" before the capability was ever consulted
-- — identically for someone who HELD the capability. Safe, and dishonest: the
-- next reader would believe a check was happening, and their first instinct
-- would be to grant that EXECUTE to "fix" it.
--
-- WHY NOT GRANT THAT EXECUTE
-- `governance_member_capabilities(p_organization_member_id uuid)` accepts ANY
-- member id. Granting it to `authenticated` would let any signed-in user
-- enumerate another member's capabilities. It is service_role-only on purpose,
-- and widening it to make a policy predicate reachable would buy a tidy policy
-- at the price of an information disclosure.
--
-- So the policy states the real rule, and the enforcement lives in one place.
--
-- STILL WORKS: the command; service_role via `po_service_role` (imports, seeds,
-- internal jobs); reading, updating and archiving via po_select and po_update.
--
-- DELIBERATELY NO LONGER WORKS: `supabase.from("projects").insert(...)` from a
-- session client. No such call remains — the form and the import pipeline both
-- route through the command. A new one will fail loudly here, which is the point.
--
-- This file touches ONLY po_insert. po_select, po_update and po_service_role are
-- not dropped, not recreated, not reordered; the verification below proves they
-- survived. On Stage this is already the deployed state, so re-running is a
-- no-op that still checks every claim.
-- ============================================================================

DROP POLICY IF EXISTS po_insert ON public.projects;

CREATE POLICY po_insert ON public.projects
  FOR INSERT TO public
  WITH CHECK (false);

COMMENT ON POLICY po_insert ON public.projects IS
  'No direct INSERT. A project is created by create_project_v2, which is SECURITY DEFINER and therefore bypasses RLS, checks the project.create capability once, and writes the project, its multi_pmo_v2 contract and its single owner in one transaction. service_role is exempt via po_service_role.';

DO $verify$
DECLARE v text; n int;
BEGIN
  SELECT with_check INTO v FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'po_insert';
  IF v IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'po_insert with_check is %, expected false', v;
  END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects';
  IF n <> 4 THEN RAISE EXCEPTION 'projects has % policies, expected 4', n; END IF;

  FOR v IN SELECT unnest(ARRAY['po_select','po_update','po_service_role']) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = v) THEN
      RAISE EXCEPTION '% disappeared', v;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated','public.projects','SELECT')
     OR NOT has_table_privilege('authenticated','public.projects','UPDATE') THEN
    RAISE EXCEPTION 'authenticated lost a read or update privilege it needs';
  END IF;

  -- The capability function stays service_role-only. If a later change grants it
  -- to an API role, that is an information disclosure and this catches it.
  IF has_function_privilege('authenticated','public.governance_member_capabilities(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.governance_member_capabilities(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'governance_member_capabilities became reachable by an API role';
  END IF;

  RAISE NOTICE 'po_insert now says what it does: creation goes through the command';
END
$verify$;
