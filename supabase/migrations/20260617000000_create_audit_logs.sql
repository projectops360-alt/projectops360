-- ──────────────────────────────────────────────
-- Migration: Create audit_logs table
-- Task: 1.12 — Add audit log for critical records
-- ──────────────────────────────────────────────

-- ── Table ──────────────────────────────────────

CREATE TABLE public.audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
                  REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid
                  REFERENCES public.projects(id) ON DELETE SET NULL,
  actor_user_id   uuid NOT NULL
                  REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action          text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS
  'Application-level audit trail for critical record changes (decisions, documents, traceability_links, communication_items).';
COMMENT ON COLUMN public.audit_logs.action IS
  'Action performed: create | update | delete.';
COMMENT ON COLUMN public.audit_logs.entity_type IS
  'Table name of the affected record: decisions, documents, traceability_links, communication_items, action_items.';
COMMENT ON COLUMN public.audit_logs.metadata IS
  'Optional JSON context: title, changed_fields, link_type, soft_delete, etc.';

-- ── CHECK constraint ────────────────────────────

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('create', 'update', 'delete'));

-- ── Indexes ─────────────────────────────────────

CREATE INDEX idx_audit_logs_org
  ON public.audit_logs (organization_id);

CREATE INDEX idx_audit_logs_project
  ON public.audit_logs (project_id) WHERE project_id IS NOT NULL;

CREATE INDEX idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);

CREATE INDEX idx_audit_logs_actor
  ON public.audit_logs (actor_user_id);

CREATE INDEX idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

-- ── RLS ─────────────────────────────────────────

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Members can read audit logs in their org
CREATE POLICY "Members can read audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- Service role has full access (used by server-side logAudit)
CREATE POLICY "Service role has full access on audit_logs"
  ON public.audit_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- No INSERT/UPDATE/DELETE for regular members — audit logs are append-only
-- Only the service role (admin client) can insert