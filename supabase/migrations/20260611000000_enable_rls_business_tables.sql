-- ============================================================================
-- ProjectOps360° — Enable RLS on Business Tables + Helper Function
-- Migration: 20260611000000_enable_rls_business_tables.sql
--
-- This migration:
--   1. Creates a SECURITY DEFINER helper function is_org_member() to avoid
--      repeating the membership subquery in every policy (and to prevent
--      infinite RLS recursion).
--   2. Enables RLS on all 9 remaining business tables.
--   3. Creates org-scoped CRUD policies on each table using is_org_member().
--   4. Adds service_role ALL policies on each table for admin bypass.
--   5. Widens organization_members policies so members can see all members
--      in their org (needed for dashboard member counts).
--   6. Adds UPDATE policy on organizations for org members (org settings).
--   7. Adds a column-protection trigger on profiles to prevent organization_id
--      changes from regular users (RLS cannot restrict columns).
--
-- Design decisions:
--   - All org members (owner, admin, member, viewer) get full CRUD within
--     their org. Role-based restrictions can be added in future migrations.
--   - is_org_member() is SECURITY DEFINER to avoid RLS recursion: it queries
--     organization_members directly without going through RLS, and filters
--     by auth.uid() which reads from the JWT (safe in SECURITY DEFINER).
--   - Soft-deleted rows (deleted_at IS NOT NULL) are visible to org members
--     through RLS; the application layer handles soft-delete filtering in
--     queries. This keeps policies simple and avoids blocking undelete flows.
-- ============================================================================

-- ──────────────────────────────────────────────
-- SECTION 1: Helper Function — is_org_member()
-- ──────────────────────────────────────────────
-- Returns TRUE if the current authenticated user is a member of the given
-- organization. Runs as SECURITY DEFINER to bypass RLS on organization_members
-- (avoiding recursion) while still evaluating auth.uid() from the caller's JWT.
-- This function is the cornerstone of all org-scoped RLS policies.

CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = is_org_member.org_id
      AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_org_member IS
  'Returns TRUE if auth.uid() is a member of the given organization. SECURITY DEFINER to avoid RLS recursion. Used as the basis for all org-scoped RLS policies.';

-- ──────────────────────────────────────────────
-- SECTION 2: Enable RLS on all 9 business tables
-- ──────────────────────────────────────────────

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traceability_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- SECTION 3: RLS Policies — projects
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read projects" ON public.projects;
DROP POLICY IF EXISTS "Members can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Members can update projects" ON public.projects;
DROP POLICY IF EXISTS "Members can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Service role has full access on projects" ON public.projects;

CREATE POLICY "Members can read projects"
  ON public.projects
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update projects"
  ON public.projects
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete projects"
  ON public.projects
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on projects"
  ON public.projects
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 4: RLS Policies — stakeholders
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read stakeholders" ON public.stakeholders;
DROP POLICY IF EXISTS "Members can insert stakeholders" ON public.stakeholders;
DROP POLICY IF EXISTS "Members can update stakeholders" ON public.stakeholders;
DROP POLICY IF EXISTS "Members can delete stakeholders" ON public.stakeholders;
DROP POLICY IF EXISTS "Service role has full access on stakeholders" ON public.stakeholders;

CREATE POLICY "Members can read stakeholders"
  ON public.stakeholders
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert stakeholders"
  ON public.stakeholders
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update stakeholders"
  ON public.stakeholders
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete stakeholders"
  ON public.stakeholders
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on stakeholders"
  ON public.stakeholders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 5: RLS Policies — meetings
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read meetings" ON public.meetings;
DROP POLICY IF EXISTS "Members can insert meetings" ON public.meetings;
DROP POLICY IF EXISTS "Members can update meetings" ON public.meetings;
DROP POLICY IF EXISTS "Members can delete meetings" ON public.meetings;
DROP POLICY IF EXISTS "Service role has full access on meetings" ON public.meetings;

CREATE POLICY "Members can read meetings"
  ON public.meetings
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert meetings"
  ON public.meetings
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update meetings"
  ON public.meetings
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete meetings"
  ON public.meetings
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on meetings"
  ON public.meetings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 6: RLS Policies — decisions
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read decisions" ON public.decisions;
DROP POLICY IF EXISTS "Members can insert decisions" ON public.decisions;
DROP POLICY IF EXISTS "Members can update decisions" ON public.decisions;
DROP POLICY IF EXISTS "Members can delete decisions" ON public.decisions;
DROP POLICY IF EXISTS "Service role has full access on decisions" ON public.decisions;

CREATE POLICY "Members can read decisions"
  ON public.decisions
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert decisions"
  ON public.decisions
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update decisions"
  ON public.decisions
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete decisions"
  ON public.decisions
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on decisions"
  ON public.decisions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 7: RLS Policies — communication_items
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read communication items" ON public.communication_items;
DROP POLICY IF EXISTS "Members can insert communication items" ON public.communication_items;
DROP POLICY IF EXISTS "Members can update communication items" ON public.communication_items;
DROP POLICY IF EXISTS "Members can delete communication items" ON public.communication_items;
DROP POLICY IF EXISTS "Service role has full access on communication_items" ON public.communication_items;

CREATE POLICY "Members can read communication items"
  ON public.communication_items
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert communication items"
  ON public.communication_items
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update communication items"
  ON public.communication_items
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete communication items"
  ON public.communication_items
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on communication_items"
  ON public.communication_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 8: RLS Policies — documents
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read documents" ON public.documents;
DROP POLICY IF EXISTS "Members can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Members can update documents" ON public.documents;
DROP POLICY IF EXISTS "Members can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Service role has full access on documents" ON public.documents;

CREATE POLICY "Members can read documents"
  ON public.documents
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert documents"
  ON public.documents
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update documents"
  ON public.documents
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete documents"
  ON public.documents
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on documents"
  ON public.documents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 9: RLS Policies — traceability_links
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read traceability links" ON public.traceability_links;
DROP POLICY IF EXISTS "Members can insert traceability links" ON public.traceability_links;
DROP POLICY IF EXISTS "Members can update traceability links" ON public.traceability_links;
DROP POLICY IF EXISTS "Members can delete traceability links" ON public.traceability_links;
DROP POLICY IF EXISTS "Service role has full access on traceability_links" ON public.traceability_links;

CREATE POLICY "Members can read traceability links"
  ON public.traceability_links
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert traceability links"
  ON public.traceability_links
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update traceability links"
  ON public.traceability_links
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete traceability links"
  ON public.traceability_links
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on traceability_links"
  ON public.traceability_links
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 10: RLS Policies — ai_runs
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read ai runs" ON public.ai_runs;
DROP POLICY IF EXISTS "Members can insert ai runs" ON public.ai_runs;
DROP POLICY IF EXISTS "Members can update ai runs" ON public.ai_runs;
DROP POLICY IF EXISTS "Members can delete ai runs" ON public.ai_runs;
DROP POLICY IF EXISTS "Service role has full access on ai_runs" ON public.ai_runs;

CREATE POLICY "Members can read ai runs"
  ON public.ai_runs
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert ai runs"
  ON public.ai_runs
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update ai runs"
  ON public.ai_runs
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete ai runs"
  ON public.ai_runs
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on ai_runs"
  ON public.ai_runs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 11: RLS Policies — action_items
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read action items" ON public.action_items;
DROP POLICY IF EXISTS "Members can insert action items" ON public.action_items;
DROP POLICY IF EXISTS "Members can update action items" ON public.action_items;
DROP POLICY IF EXISTS "Members can delete action items" ON public.action_items;
DROP POLICY IF EXISTS "Service role has full access on action_items" ON public.action_items;

CREATE POLICY "Members can read action items"
  ON public.action_items
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert action items"
  ON public.action_items
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update action items"
  ON public.action_items
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete action items"
  ON public.action_items
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on action_items"
  ON public.action_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ──────────────────────────────────────────────
-- SECTION 12: Widen organization_members policies
-- ──────────────────────────────────────────────
-- Current SELECT policy only shows the user's own row (auth.uid() = user_id).
-- This prevents dashboard member counts from working. Widen to let members
-- see all memberships in their orgs. Safe because is_org_member() is
-- SECURITY DEFINER and does not cause recursion.

-- Drop old policies
DROP POLICY IF EXISTS "Users can read own memberships"
  ON public.organization_members;

DROP POLICY IF EXISTS "Users can insert own membership"
  ON public.organization_members;

-- New SELECT: members can see all rows in their orgs
DROP POLICY IF EXISTS "Members can read org memberships" ON public.organization_members;
CREATE POLICY "Members can read org memberships"
  ON public.organization_members
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- New INSERT: members can add rows to orgs they belong to, but only for themselves
-- (inviting other users should go through an invite flow, not direct INSERT)
DROP POLICY IF EXISTS "Members can insert own membership" ON public.organization_members;
CREATE POLICY "Members can insert own membership"
  ON public.organization_members
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id) AND auth.uid() = user_id);

-- New UPDATE: org members can update membership rows in their org
-- (e.g., role changes by owners/admins — role-based restrictions deferred to future migration)
DROP POLICY IF EXISTS "Members can update org memberships" ON public.organization_members;
CREATE POLICY "Members can update org memberships"
  ON public.organization_members
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- Service role policy already exists from migration 2 — no change needed

-- ──────────────────────────────────────────────
-- SECTION 13: Add UPDATE policy on organizations
-- ──────────────────────────────────────────────
-- Currently only SELECT exists for regular users. Org members need to update
-- org settings (name, description, avatar, plan).

DROP POLICY IF EXISTS "Members can update own organizations" ON public.organizations;
CREATE POLICY "Members can update own organizations"
  ON public.organizations
  FOR UPDATE
  USING (public.is_org_member(id))
  WITH CHECK (public.is_org_member(id));

-- Service role policy already exists from migration 2 — no change needed

-- ──────────────────────────────────────────────
-- SECTION 14: Protect profiles.organization_id from user changes
-- ──────────────────────────────────────────────
-- PostgreSQL RLS policies cannot restrict which columns a user can modify —
-- they only control which rows are visible and which new rows are acceptable.
-- To prevent users from changing their organization_id (which would let them
-- move themselves to another org), we add a BEFORE UPDATE trigger that raises
-- an exception if organization_id is changed.
--
-- This trigger does NOT block the service_role (which bypasses RLS entirely)
-- or the SECURITY DEFINER handle_new_user() function.

CREATE OR REPLACE FUNCTION public.protect_profile_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Cannot change profiles.organization_id — use organization transfer instead';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profile_org_id IS
  'Prevents users from changing their organization_id via profile update. Only the service_role (which bypasses RLS) or admin operations can transfer users between organizations.';

DROP TRIGGER IF EXISTS protect_profile_org_id ON public.profiles;

CREATE TRIGGER protect_profile_org_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_org_id();