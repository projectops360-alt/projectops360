-- ============================================================================
-- ProjectOps360° — Project Charter & Governance Center (MVP)
-- Migration: 20260720000000_project_charter.sql
--
-- The Charter is the living source of truth for a project: purpose, scope,
-- deliverables, governance, approvals, roles and sign-off. Created empty when a
-- project is created; edited through its lifecycle; snapshotted on approval and
-- pushed into Project Memory.
--
-- Maximum reuse: RLS via is_org_member(), update_updated_at() trigger,
-- project_memory_items + vector index, decisions/risks/stakeholders modules.
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. project_charters — the living charter document (one current per project)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_charters (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id                      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title                           text,
  version                         integer NOT NULL DEFAULT 1,
  status                          text NOT NULL DEFAULT 'draft'
                                  CHECK (status IN (
                                    'draft','under_review','pending_approval','approved',
                                    'active','revision_required','superseded','archived'
                                  )),
  -- Overview
  background                      text,
  business_case                   text,
  project_goal                    text,
  objectives                      text,
  business_drivers                text,
  executive_summary               text,
  -- Scope
  in_scope                        text,
  out_of_scope                    text,
  assumptions                     text,
  constraints                     text,
  limitations                     text,
  dependencies                    text,
  -- Deliverables & success
  major_deliverables              text,
  acceptance_criteria             text,
  success_criteria                text,
  knowledge_transfer_expectations text,
  -- Governance
  governance_model                text,
  decision_making_process         text,
  escalation_process              text,
  reporting_cadence               text,
  issue_management_process        text,
  change_management_process       text,
  risk_management_process         text,
  quality_management_process      text,
  communication_management_process text,
  -- Approval
  sponsor_id                      uuid REFERENCES public.stakeholders(id) ON DELETE SET NULL,
  project_manager_id              uuid REFERENCES public.stakeholders(id) ON DELETE SET NULL,
  approved_by                     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at                     timestamptz,
  approval_notes                  text,
  -- Metadata
  created_by                      uuid REFERENCES auth.users(id),
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  deleted_at                      timestamptz,
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_charters_project ON public.project_charters (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_charters_org ON public.project_charters (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_charters_status ON public.project_charters (organization_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_charters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.project_charters IS
  'Living project charter: official source of truth (purpose, scope, deliverables, governance, approval). One current charter per project; approved versions snapshotted into project_charter_versions and project_memory_items.';

-- ──────────────────────────────────────────────
-- 2. project_charter_roles — sponsor / PM / steering / teams / vendors
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_charter_roles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id             uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  charter_id             uuid NOT NULL REFERENCES public.project_charters(id) ON DELETE CASCADE,
  role_name              text NOT NULL,
  person_name            text,
  user_id                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stakeholder_id         uuid REFERENCES public.stakeholders(id) ON DELETE SET NULL,
  external_contact_name  text,
  responsibility         text,
  authority_level        text,
  decision_rights        text,
  escalation_level       integer,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_charter_roles_charter ON public.project_charter_roles (charter_id) WHERE deleted_at IS NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_charter_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 3. project_governance_rules — rules that can later drive system behavior
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_governance_rules (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id             uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  charter_id             uuid NOT NULL REFERENCES public.project_charters(id) ON DELETE CASCADE,
  rule_type              text NOT NULL,
  rule_name              text NOT NULL,
  description            text,
  trigger_condition      text,
  required_approval_role text,
  escalation_role        text,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_governance_rules_charter ON public.project_governance_rules (charter_id) WHERE deleted_at IS NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_governance_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 4. project_approval_matrix — who approves what, thresholds, escalation
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_approval_matrix (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id             uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  charter_id             uuid NOT NULL REFERENCES public.project_charters(id) ON DELETE CASCADE,
  approval_area          text NOT NULL,
  approval_required_from text,
  threshold_type         text,
  threshold_value        text,
  escalation_path        text,
  required_response_time text,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_approval_matrix_charter ON public.project_approval_matrix (charter_id) WHERE deleted_at IS NULL;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_approval_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 5. project_charter_versions — approval snapshots / revision history
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_charter_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  charter_id      uuid NOT NULL REFERENCES public.project_charters(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  snapshot_json   jsonb NOT NULL DEFAULT '{}',
  change_reason   text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charter_versions_charter ON public.project_charter_versions (charter_id, version DESC);

-- ──────────────────────────────────────────────
-- 6. project_signoffs — sponsor / PM / steering sign-off
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_signoffs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  charter_id      uuid NOT NULL REFERENCES public.project_charters(id) ON DELETE CASCADE,
  signer_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signer_role     text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  comments        text,
  signed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signoffs_charter ON public.project_signoffs (charter_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 7. RLS — org members on all tables
-- ──────────────────────────────────────────────

ALTER TABLE public.project_charters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_charter_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_governance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_approval_matrix  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_charter_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_signoffs         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_charters','project_charter_roles','project_governance_rules',
    'project_approval_matrix','project_charter_versions','project_signoffs'
  ] LOOP
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
