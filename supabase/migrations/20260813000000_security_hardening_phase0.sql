-- ════════════════════════════════════════════════════════════════════════════
-- Security Hardening — Phase 0 (P0): close direct-API privilege-escalation and
-- audit-log tampering holes found in the 2026-06 authorization audit.
--
-- Threat model: the publishable (anon) key is public; a user's JWT (role
-- `authenticated`) can hit PostgREST directly, where ONLY RLS + triggers apply.
-- The app itself uses the service-role admin client (bypasses RLS) and enforces
-- authorization in the server actions — so every trigger here EXEMPTS
-- service_role to avoid breaking legitimate app flows. These guards target the
-- direct-API surface (authenticated role) exclusively.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Helper: project manager tier (PMO / PM / creator / can_manage_team) ──────
CREATE OR REPLACE FUNCTION public.is_project_manager_tier(p_project_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_org uuid; v_pm uuid; v_creator uuid;
BEGIN
  IF p_project_id IS NULL THEN RETURN false; END IF;
  SELECT organization_id, project_manager_id, created_by
    INTO v_org, v_pm, v_creator
  FROM public.projects WHERE id = p_project_id;
  IF v_org IS NULL THEN RETURN false; END IF;
  IF public.is_pmo_level(v_org) THEN RETURN true; END IF;
  IF v_pm = auth.uid() OR v_creator = auth.uid() THEN RETURN true; END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_team_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
      AND status <> 'removed' AND can_manage_team = true
  ) THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- ── R3: audit_logs are append-only (drop member UPDATE/DELETE) ────────────────
DROP POLICY IF EXISTS po_update ON public.audit_logs;
DROP POLICY IF EXISTS po_delete ON public.audit_logs;
-- (po_insert / po_select / po_service_role remain. Only service_role may now
--  mutate existing rows, and logAudit inserts via service_role.)

-- ── R2: project_team_members — only manager tier may write ───────────────────
DROP POLICY IF EXISTS po_insert ON public.project_team_members;
DROP POLICY IF EXISTS po_update ON public.project_team_members;
DROP POLICY IF EXISTS po_delete ON public.project_team_members;

CREATE POLICY po_insert ON public.project_team_members FOR INSERT
  WITH CHECK (is_org_member(organization_id)
              AND ((project_id IS NULL) OR is_project_manager_tier(project_id)));
CREATE POLICY po_update ON public.project_team_members FOR UPDATE
  USING (is_org_member(organization_id)
         AND ((project_id IS NULL) OR is_project_manager_tier(project_id)))
  WITH CHECK (is_org_member(organization_id)
              AND ((project_id IS NULL) OR is_project_manager_tier(project_id)));
CREATE POLICY po_delete ON public.project_team_members FOR DELETE
  USING (is_org_member(organization_id)
         AND ((project_id IS NULL) OR is_project_manager_tier(project_id)));

-- ── R1: organization_members — only PMO tier may update; no role tampering ────
DROP POLICY IF EXISTS "Members can update org memberships" ON public.organization_members;
CREATE POLICY "PMO can update org memberships" ON public.organization_members FOR UPDATE
  USING (is_pmo_level(organization_id))
  WITH CHECK (is_pmo_level(organization_id));

-- Block self-escalation: role/org_role can only change via service_role (the app
-- path, which itself verifies PMO authority). Also stops inserting a second,
-- privileged self-membership via direct API.
CREATE OR REPLACE FUNCTION public.prevent_membership_role_tamper()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF (NEW.org_role IS NOT NULL AND NEW.org_role NOT IN ('TEAM_MEMBER','STAKEHOLDER','CLIENT','VIEWER'))
       OR (NEW.role IN ('owner','admin')) THEN
      RAISE EXCEPTION 'Privileged membership roles cannot be self-assigned via direct API';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.org_role IS DISTINCT FROM OLD.org_role OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Membership role changes are not permitted via direct API';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_membership_role_tamper ON public.organization_members;
CREATE TRIGGER trg_prevent_membership_role_tamper
  BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_membership_role_tamper();

-- ── R4: organizations — only PMO tier may update ─────────────────────────────
DROP POLICY IF EXISTS "Members can update own organizations" ON public.organizations;
CREATE POLICY "PMO can update own organizations" ON public.organizations FOR UPDATE
  USING (is_pmo_level(id))
  WITH CHECK (is_pmo_level(id));

-- ── R6: projects — update restricted to manager tier; identity immutable ──────
DROP POLICY IF EXISTS po_update ON public.projects;
CREATE POLICY po_update ON public.projects FOR UPDATE
  USING (is_project_manager_tier(id))
  WITH CHECK (is_org_member(organization_id));

CREATE OR REPLACE FUNCTION public.prevent_project_identity_tamper()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_project_identity_tamper ON public.projects;
CREATE TRIGGER trg_prevent_project_identity_tamper
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_project_identity_tamper();
