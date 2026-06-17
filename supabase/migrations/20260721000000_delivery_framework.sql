-- ============================================================================
-- ProjectOps360° — Adaptive Project Delivery Framework (MVP)
-- Migration: 20260721000000_delivery_framework.sql
--
-- Defines HOW each project is executed (Predictive / Agile / Scrum-style /
-- Kanban / Hybrid / XP), with a generic, project-agnostic backlog, execution
-- cycles, board columns, roles, scope-creep alerts, recommendations and events.
-- Reuse: RLS via is_org_member(), update_updated_at(), project_charters,
-- roadmap_tasks, milestones, risks, project_memory_items + vector index.
-- ============================================================================

-- 1. project_delivery_frameworks — the living execution model (one per project)
CREATE TABLE IF NOT EXISTS public.project_delivery_frameworks (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id                    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_type                  text,
  delivery_method               text CHECK (delivery_method IN ('predictive','agile','scrum','kanban','hybrid','xp')),
  governance_level              text,
  uncertainty_level             text,
  execution_cadence             text,
  review_cadence                text,
  stakeholder_feedback_frequency text,
  documentation_level           text,
  change_control_required       text,
  vendor_dependency_level       text,
  regulatory_requirement        boolean NOT NULL DEFAULT false,
  selected_by                   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_recommended                boolean NOT NULL DEFAULT false,
  recommendation_confidence     integer,
  recommendation_reason         text,
  status                        text NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','recommended','configured','active','needs_review','changed','archived')),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  deleted_at                    timestamptz,
  UNIQUE (project_id)
);

-- 2. project_backlog_items — generic backlog (not "product backlog")
CREATE TABLE IF NOT EXISTS public.project_backlog_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  framework_id            uuid REFERENCES public.project_delivery_frameworks(id) ON DELETE SET NULL,
  title                   text NOT NULL,
  description             text,
  item_type               text,
  priority                text,
  business_value          integer,
  effort_estimate         numeric,
  status                  text NOT NULL DEFAULT 'backlog',
  owner_id                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by            text,
  source                  text,
  acceptance_criteria     text,
  definition_of_done      text,
  linked_charter_objective text,
  linked_deliverable      text,
  linked_milestone_id     uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  linked_risk_id          uuid REFERENCES public.risks(id) ON DELETE SET NULL,
  linked_issue_id         uuid,
  linked_change_id        uuid,
  linked_vendor_id        uuid,
  linked_resource_id      uuid,
  position                integer NOT NULL DEFAULT 0,
  tags                    text[],
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

-- 3. project_execution_cycles — generic cycles (not "sprints" unless scrum)
CREATE TABLE IF NOT EXISTS public.project_execution_cycles (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id                  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  framework_id                uuid REFERENCES public.project_delivery_frameworks(id) ON DELETE SET NULL,
  name                        text NOT NULL,
  cycle_type                  text,
  goal                        text,
  start_date                  date,
  end_date                    date,
  status                      text NOT NULL DEFAULT 'planned'
                              CHECK (status IN ('planned','active','review','completed','canceled')),
  capacity_notes              text,
  review_notes                text,
  lessons_learned_notes       text,
  stakeholder_feedback_summary text,
  completed_work_summary      text,
  incomplete_work_summary     text,
  position                    integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

-- 4. project_cycle_items — backlog items committed to a cycle
CREATE TABLE IF NOT EXISTS public.project_cycle_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cycle_id        uuid NOT NULL REFERENCES public.project_execution_cycles(id) ON DELETE CASCADE,
  backlog_item_id uuid NOT NULL REFERENCES public.project_backlog_items(id) ON DELETE CASCADE,
  planned_status  text,
  final_status    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 5. project_board_columns — framework/type-specific board template
CREATE TABLE IF NOT EXISTS public.project_board_columns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  framework_id    uuid REFERENCES public.project_delivery_frameworks(id) ON DELETE CASCADE,
  name            text NOT NULL,
  position        integer NOT NULL DEFAULT 0,
  column_type     text,
  wip_limit       integer,
  is_done_column  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 6. project_framework_roles
CREATE TABLE IF NOT EXISTS public.project_framework_roles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  framework_id          uuid REFERENCES public.project_delivery_frameworks(id) ON DELETE CASCADE,
  role_name             text NOT NULL,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  external_contact_name text,
  responsibility        text,
  decision_rights       text,
  escalation_level      integer,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

-- 7. project_scope_creep_alerts
CREATE TABLE IF NOT EXISTS public.project_scope_creep_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  framework_id    uuid REFERENCES public.project_delivery_frameworks(id) ON DELETE SET NULL,
  work_item_id    uuid,
  source_type     text,
  source_id       uuid,
  detection_reason text,
  severity        text,
  recommendation  text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 8. project_framework_recommendations (history of AI/rule recommendations)
CREATE TABLE IF NOT EXISTS public.project_framework_recommendations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  recommended_method  text,
  confidence_score    integer,
  reason              text,
  inputs_json         jsonb NOT NULL DEFAULT '{}',
  recommendation_json jsonb NOT NULL DEFAULT '{}',
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 9. project_framework_events (audit/timeline of framework changes)
CREATE TABLE IF NOT EXISTS public.project_framework_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  framework_id    uuid REFERENCES public.project_delivery_frameworks(id) ON DELETE SET NULL,
  event_type      text,
  event_summary   text,
  event_payload   jsonb NOT NULL DEFAULT '{}',
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dframeworks_project ON public.project_delivery_frameworks (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_backlog_project ON public.project_backlog_items (project_id, position) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_backlog_status ON public.project_backlog_items (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cycles_project ON public.project_execution_cycles (project_id, position) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cycle_items_cycle ON public.project_cycle_items (cycle_id);
CREATE INDEX IF NOT EXISTS idx_board_cols_framework ON public.project_board_columns (framework_id, position);
CREATE INDEX IF NOT EXISTS idx_fw_roles_framework ON public.project_framework_roles (framework_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scope_alerts_project ON public.project_scope_creep_alerts (project_id, status);
CREATE INDEX IF NOT EXISTS idx_fw_events_project ON public.project_framework_events (project_id, created_at DESC);

-- updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_delivery_frameworks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_backlog_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_execution_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_cycle_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_board_columns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_framework_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_delivery_frameworks','project_backlog_items','project_execution_cycles',
    'project_cycle_items','project_board_columns','project_framework_roles',
    'project_scope_creep_alerts','project_framework_recommendations','project_framework_events'
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
