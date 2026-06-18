-- ============================================================================
-- ProjectOps360° — Team Architecture (Phases 2-3)
-- Migration: 20260723000000_team_architecture.sql
--
--   • organization_teams / organization_team_members — reusable company groups
--   • external_contacts — people without a full login (vendors/clients/etc.)
--   • project_team_members — the Project Team & Roles Center (operational, NOT
--     a billing entity); internal users, external contacts, stakeholders.
--   • project_raci_assignments — R/A/C/I on any project entity
--   • stakeholder_access — light/free project access for viewers/externals
--
-- Reuses RLS via is_org_member() + update_updated_at(). Every table is
-- organization-scoped for tenant isolation.
-- ============================================================================

-- ── 1. organization_teams (reusable company groups) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  team_type       text,   -- development | data | qa | finance | erp | field | vendor | steering | change_board | risk_committee | other
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE TABLE IF NOT EXISTS public.organization_team_members (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  organization_team_id     uuid NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  user_id                  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  external_contact_id      uuid,    -- FK added after external_contacts is created
  role_in_team             text,
  default_project_role     text,
  default_delivery_role    text,
  default_governance_role  text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── 2. external_contacts (people without a full login) ──────────────────────
CREATE TABLE IF NOT EXISTS public.external_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,
  company_name    text,
  contact_type    text,   -- client | vendor | contractor | inspector | consultant | sponsor | approver | regulator | other
  phone           text,
  notes           text,
  can_login       boolean NOT NULL DEFAULT false,
  access_status   text NOT NULL DEFAULT 'active' CHECK (access_status IN ('active','revoked','pending')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Wire the org_team_members → external_contacts FK now that the table exists.
ALTER TABLE public.organization_team_members
  DROP CONSTRAINT IF EXISTS org_team_members_external_contact_fk;
ALTER TABLE public.organization_team_members
  ADD CONSTRAINT org_team_members_external_contact_fk
  FOREIGN KEY (external_contact_id) REFERENCES public.external_contacts(id) ON DELETE CASCADE;

-- ── 3. project_team_members (Project Team & Roles Center) ───────────────────
CREATE TABLE IF NOT EXISTS public.project_team_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  external_contact_id   uuid REFERENCES public.external_contacts(id) ON DELETE CASCADE,
  organization_team_id  uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  member_type           text NOT NULL DEFAULT 'internal_user'
                        CHECK (member_type IN ('internal_user','external_contact','stakeholder','vendor','group_imported')),
  -- display name cache (for external contacts / quick render)
  display_name          text,
  project_role          text,
  delivery_role         text,
  governance_role       text,
  responsibility        text,
  authority_level       text,
  allocation_percentage integer,
  start_date            date,
  end_date              date,
  permission_level      text NOT NULL DEFAULT 'contributor'
                        CHECK (permission_level IN
                          ('project_owner','project_manager','contributor','approver',
                           'stakeholder_viewer','external_contributor','external_viewer','read_only')),
  can_approve_changes   boolean NOT NULL DEFAULT false,
  can_manage_tasks      boolean NOT NULL DEFAULT false,
  can_view_budget       boolean NOT NULL DEFAULT false,
  can_view_reports      boolean NOT NULL DEFAULT true,
  can_access_memory     boolean NOT NULL DEFAULT false,
  can_invite_others     boolean NOT NULL DEFAULT false,
  can_edit_charter      boolean NOT NULL DEFAULT false,
  can_manage_risks      boolean NOT NULL DEFAULT false,
  can_manage_changes    boolean NOT NULL DEFAULT false,
  can_manage_team       boolean NOT NULL DEFAULT false,
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','removed')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 4. project_raci_assignments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_raci_assignments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type             text NOT NULL,   -- deliverable | milestone | backlog_item | risk | issue | change_request | approval | action_item
  entity_id               uuid,
  entity_label            text,            -- denormalized label for display
  project_team_member_id  uuid NOT NULL REFERENCES public.project_team_members(id) ON DELETE CASCADE,
  raci_role               text NOT NULL CHECK (raci_role IN ('responsible','accountable','consulted','informed')),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ── 5. stakeholder_access (light / free project access) ─────────────────────
CREATE TABLE IF NOT EXISTS public.stakeholder_access (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE CASCADE,
  display_name        text,
  access_level        text NOT NULL DEFAULT 'viewer'
                      CHECK (access_level IN ('viewer','commenter','approver','external')),
  can_view_summary    boolean NOT NULL DEFAULT true,
  can_comment         boolean NOT NULL DEFAULT false,
  can_approve         boolean NOT NULL DEFAULT false,
  can_view_reports    boolean NOT NULL DEFAULT true,
  can_view_risks      boolean NOT NULL DEFAULT false,
  can_view_changes    boolean NOT NULL DEFAULT false,
  expires_at          timestamptz,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_teams_org ON public.organization_teams (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_team_members_team ON public.organization_team_members (organization_team_id);
CREATE INDEX IF NOT EXISTS idx_external_contacts_org ON public.external_contacts (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_team_members_project ON public.project_team_members (project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_team_members_user ON public.project_team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_raci_project ON public.project_raci_assignments (project_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_stakeholder_access_project ON public.stakeholder_access (project_id, status);

-- ── updated_at triggers ─────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_teams','organization_team_members','external_contacts',
    'project_team_members','project_raci_assignments','stakeholder_access'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%s', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t);
  END LOOP;
END $$;

-- ── RLS (org-scoped) ────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_teams','organization_team_members','external_contacts',
    'project_team_members','project_raci_assignments','stakeholder_access'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members insert %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members delete %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Members read %1$s" ON public.%1$s FOR SELECT USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members insert %1$s" ON public.%1$s FOR INSERT WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members update %1$s" ON public.%1$s FOR UPDATE USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members delete %1$s" ON public.%1$s FOR DELETE USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Service role %1$s" ON public.%1$s FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t);
  END LOOP;
END $$;
