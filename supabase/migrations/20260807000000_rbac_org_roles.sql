-- ============================================================================
-- ProjectOps360° — RBAC: enforced organization roles + project access helpers
-- Migration: 20260807000000_rbac_org_roles.sql
--
-- Adds the role/permission backbone required for a true PMO → PM → Team
-- hierarchy on top of the existing org-scoped multi-tenant model:
--
--   1. organization_members.org_role — the canonical, ENFORCED role enum
--      (8 values). Backfilled from the existing workspace_role / role columns.
--      The legacy `role` (owner|admin|member|viewer) is KEPT untouched for
--      billing/back-compat; org_role is the new source of truth for access.
--   2. profiles.default_organization_id — supports future multi-org membership
--      without changing the existing single organization_id binding.
--   3. projects.project_manager_id — the PM who owns a project (backfilled from
--      created_by so existing projects keep a responsible owner).
--   4. Helper functions (all SECURITY DEFINER, used by RLS in the next migration
--      AND by the application permission layer):
--        • current_user_org_role(org_id)
--        • is_pmo_level(org_id)        — COMPANY_OWNER | PMO_ADMIN | PORTFOLIO_MANAGER
--        • can_access_project(project_id)
--
-- Design rules honored:
--   - Additive only. Does NOT drop or alter existing columns/constraints.
--   - Safe to run once; idempotent (IF NOT EXISTS / DROP-then-CREATE).
--   - No data is deleted. Backfill never overwrites a non-null org_role.
-- ============================================================================

-- ── 1. organization_members.org_role (canonical enforced role) ──────────────
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS org_role           text,
  ADD COLUMN IF NOT EXISTS reports_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill org_role from the richer workspace_role first, then legacy role.
UPDATE public.organization_members
SET org_role = CASE
    WHEN workspace_role = 'Owner'                THEN 'COMPANY_OWNER'
    WHEN workspace_role = 'Admin'                THEN 'PMO_ADMIN'
    WHEN workspace_role = 'PMO Manager'          THEN 'PMO_ADMIN'
    WHEN workspace_role = 'Project Manager'      THEN 'PROJECT_MANAGER'
    WHEN workspace_role = 'Team Member'          THEN 'TEAM_MEMBER'
    WHEN workspace_role = 'Stakeholder'          THEN 'STAKEHOLDER'
    WHEN workspace_role = 'Viewer'               THEN 'VIEWER'
    WHEN workspace_role = 'External Collaborator' THEN 'CLIENT'
    ELSE CASE role
      WHEN 'owner'  THEN 'COMPANY_OWNER'
      WHEN 'admin'  THEN 'PMO_ADMIN'
      WHEN 'member' THEN 'TEAM_MEMBER'
      WHEN 'viewer' THEN 'VIEWER'
      ELSE 'TEAM_MEMBER'
    END
  END
WHERE org_role IS NULL;

-- Default + enforce non-null going forward.
ALTER TABLE public.organization_members
  ALTER COLUMN org_role SET DEFAULT 'TEAM_MEMBER';
ALTER TABLE public.organization_members
  ALTER COLUMN org_role SET NOT NULL;

ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS org_members_org_role_chk;
ALTER TABLE public.organization_members ADD CONSTRAINT org_members_org_role_chk
  CHECK (org_role IN (
    'COMPANY_OWNER','PMO_ADMIN','PORTFOLIO_MANAGER','PROJECT_MANAGER',
    'TEAM_MEMBER','STAKEHOLDER','CLIENT','VIEWER'
  ));

CREATE INDEX IF NOT EXISTS idx_org_members_org_role
  ON public.organization_members (organization_id, org_role);

COMMENT ON COLUMN public.organization_members.org_role IS
  'Canonical enforced role: COMPANY_OWNER | PMO_ADMIN | PORTFOLIO_MANAGER | PROJECT_MANAGER | TEAM_MEMBER | STAKEHOLDER | CLIENT | VIEWER. Source of truth for access control.';

-- ── 2. profiles.default_organization_id (multi-org readiness) ───────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.profiles
SET default_organization_id = organization_id
WHERE default_organization_id IS NULL;

COMMENT ON COLUMN public.profiles.default_organization_id IS
  'The org selected by default after login. Defaults to organization_id; lets a user belong to multiple orgs later without losing a stable landing org.';

-- ── 3. projects.project_manager_id ──────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: the creator is the responsible PM until reassigned.
UPDATE public.projects
SET project_manager_id = created_by
WHERE project_manager_id IS NULL AND created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_pm
  ON public.projects (project_manager_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.projects.project_manager_id IS
  'The Project Manager who owns this project. PMO-level roles see all projects; a PM sees projects they manage, created, or are a member of.';

-- ── 4. Helper functions ─────────────────────────────────────────────────────

-- Current user's enforced role within a given org (NULL if not a member).
CREATE OR REPLACE FUNCTION public.current_user_org_role(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_role
  FROM public.organization_members
  WHERE organization_id = current_user_org_role.org_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_user_org_role IS
  'Returns the enforced org_role of auth.uid() in the given org, or NULL if not a member. SECURITY DEFINER to avoid RLS recursion.';

-- TRUE when the user holds a portfolio/PMO-level role in the org (sees everything).
CREATE OR REPLACE FUNCTION public.is_pmo_level(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = is_pmo_level.org_id
      AND user_id = auth.uid()
      AND (
        org_role IN ('COMPANY_OWNER','PMO_ADMIN','PORTFOLIO_MANAGER')
        -- Back-compat safety net: legacy owner/admin keep full visibility.
        OR role IN ('owner','admin')
      )
  );
$$;

COMMENT ON FUNCTION public.is_pmo_level IS
  'TRUE if auth.uid() has a PMO/portfolio-level role (COMPANY_OWNER, PMO_ADMIN, PORTFOLIO_MANAGER) in the org. Such users can see all projects in the org.';

-- TRUE when the current user may access a specific project.
--   PMO-level → every project in the org.
--   PM/creator → projects they manage or created.
--   Member → projects where they are an active project_team_members row.
--   Stakeholder → projects where they have active stakeholder_access.
CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_pm     uuid;
  v_creator uuid;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT organization_id, project_manager_id, created_by
    INTO v_org_id, v_pm, v_creator
  FROM public.projects
  WHERE id = p_project_id;

  IF v_org_id IS NULL THEN
    RETURN false;            -- project does not exist
  END IF;

  -- Must be a member of the owning org at all.
  IF NOT public.is_org_member(v_org_id) THEN
    RETURN false;
  END IF;

  -- PMO-level roles see every project in their org.
  IF public.is_pmo_level(v_org_id) THEN
    RETURN true;
  END IF;

  -- The PM or the creator always have access.
  IF v_pm = auth.uid() OR v_creator = auth.uid() THEN
    RETURN true;
  END IF;

  -- Active project team members.
  IF EXISTS (
    SELECT 1 FROM public.project_team_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND status <> 'removed'
  ) THEN
    RETURN true;
  END IF;

  -- Active stakeholder access (read/limited).
  IF EXISTS (
    SELECT 1 FROM public.stakeholder_access
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_access_project IS
  'TRUE if auth.uid() may access the given project: PMO-level (all org projects), the PM/creator, an active project team member, or an active stakeholder. SECURITY DEFINER, used by RLS and the app permission layer.';
