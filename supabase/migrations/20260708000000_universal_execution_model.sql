-- ═══════════════════════════════════════════════════════════════════════════════
-- Universal Project Execution Model — Standardization Pass
--
-- Additive only. Creates the universal execution entities shared by ALL project
-- types (software, data center, residential, commercial, infrastructure):
--
--   1.  projects.project_type + projects.enabled_modules
--   2.  suppliers
--   3.  resources (universal: people, crews, materials, equipment, licenses,
--       cloud services, vendors, …) + backfill from labor_resources
--   4.  budget_items, cost_actuals
--   5.  material_requirements
--   6.  procurement_items
--   7.  risks, rfis, submittals, inspections, permits
--       (drawing_insights.linked_risk_id / linked_rfi_id / linked_submittal_id
--        finally have target tables)
--   8.  resource_assignments (task ↔ resource)
--   9.  roadmap_tasks: assignment + cost + location + provenance columns
--   10. critical_path_snapshots
--   11. Living Graph CHECK extensions for the new entity types
--
-- House conventions: uuid PKs, organization_id on every table, soft delete,
-- set_updated_at triggers, member RLS + service-role policies, partial indexes.
-- No columns are dropped or altered destructively.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. projects: project_type + enabled_modules ──────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT 'general';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_project_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_project_type_check
  CHECK (project_type IN (
    'software_development', 'data_center_construction',
    'residential_construction', 'commercial_construction',
    'infrastructure', 'industrial', 'general'
  ));

-- Per-project module visibility. NULL/empty = derive defaults from project_type
-- in the application layer (src/lib/execution/modules.ts).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS enabled_modules jsonb;

CREATE INDEX IF NOT EXISTS idx_projects_type
  ON public.projects (organization_id, project_type)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.projects.project_type IS
  'Universal project type. Configures the experience (templates, terminology, default modules) without splitting the core execution model.';
COMMENT ON COLUMN public.projects.enabled_modules IS
  'Optional explicit module list (e.g. ["materials","rfis"]). NULL = use project_type defaults.';

-- ── 2. suppliers ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suppliers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name             text NOT NULL,
  supplier_type    text NOT NULL DEFAULT 'vendor'
                   CHECK (supplier_type IN ('vendor','subcontractor','manufacturer','distributor','service_provider')),
  contact_name     text,
  contact_email    text,
  contact_phone    text,
  default_lead_time_days integer,
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','inactive','blacklisted')),
  metadata         jsonb NOT NULL DEFAULT '{}',
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_project ON public.suppliers (project_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.suppliers IS
  'Universal supplier/vendor registry: material suppliers, subcontractors, SaaS providers, equipment rental, etc.';

-- ── 3. resources (universal) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resources (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id                uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_type             text NOT NULL
                            CHECK (resource_type IN (
                              'person','crew','team','role','skill',
                              'material','equipment','tool',
                              'software_license','cloud_service',
                              'vendor','supplier','subcontractor',
                              'facility','budget_pool','ai_agent'
                            )),
  name                      text NOT NULL,
  description               text,
  label_i18n                jsonb NOT NULL DEFAULT '{}',
  status                    text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','inactive','unavailable','retired')),
  unit_of_measure           text,
  cost_rate                 numeric(12,2),
  cost_unit                 text
                            CHECK (cost_unit IS NULL OR cost_unit IN ('hour','day','week','month','unit','fixed')),
  capacity_per_day          numeric(8,2),
  availability              jsonb NOT NULL DEFAULT '[]',
  skills                    jsonb NOT NULL DEFAULT '[]',
  trade_key                 text,
  discipline                text,
  supplier_id               uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  linked_user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legacy_labor_resource_id  uuid REFERENCES public.labor_resources(id) ON DELETE SET NULL,
  metadata                  jsonb NOT NULL DEFAULT '{}',
  order_index               integer NOT NULL DEFAULT 0,
  deleted_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_org ON public.resources (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resources_project ON public.resources (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources (project_id, resource_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resources_trade ON public.resources (project_id, trade_key) WHERE deleted_at IS NULL AND trade_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_skills ON public.resources USING gin (skills) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resources_availability ON public.resources USING gin (availability) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.resources IS
  'Universal resource model: a Senior Developer, an Electrician Crew, concrete, a CAT6 spool, an AWS account, an Autodesk license, an excavator — same table, typed by resource_type.';
COMMENT ON COLUMN public.resources.availability IS
  'Weekly availability windows, same shape as labor_resources.availability: [{"week":"2026-W29","available_hours":40,"status":"available|partial|unavailable"}].';
COMMENT ON COLUMN public.resources.legacy_labor_resource_id IS
  'Backfill provenance: the labor_resources row this universal resource was created from. NULL for natively-created resources.';

-- Backfill: project every existing labor resource into the universal table.
-- Idempotent: skips rows already backfilled.
INSERT INTO public.resources (
  organization_id, project_id, resource_type, name, label_i18n, status,
  cost_unit, capacity_per_day, availability, trade_key,
  legacy_labor_resource_id, metadata, order_index
)
SELECT
  lr.organization_id,
  lr.project_id,
  CASE lr.resource_type
    WHEN 'crew'       THEN 'crew'
    WHEN 'specialist' THEN 'person'
    WHEN 'inspector'  THEN 'person'
    WHEN 'vendor'     THEN 'vendor'
    WHEN 'witness'    THEN 'person'
    ELSE 'person'
  END,
  lr.name,
  lr.label_i18n,
  'active',
  'hour',
  ROUND(lr.capacity_hours_per_week / 5.0, 2),
  lr.availability,
  lr.trade_key,
  lr.id,
  jsonb_build_object(
    'source', 'labor_resources_backfill',
    'resource_key', lr.resource_key,
    'skill_level', lr.skill_level,
    'headcount', lr.headcount,
    'constraints', lr.constraints
  ),
  lr.order_index
FROM public.labor_resources lr
WHERE lr.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.legacy_labor_resource_id = lr.id
  );

-- ── 4. budget_items + cost_actuals ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.budget_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cost_code        text,
  name             text NOT NULL,
  description      text,
  category         text NOT NULL DEFAULT 'other'
                   CHECK (category IN (
                     'labor','material','equipment','subcontractor',
                     'software','cloud','permit','contingency','other'
                   )),
  estimated_cost   numeric(14,2) NOT NULL DEFAULT 0,
  committed_cost   numeric(14,2) NOT NULL DEFAULT 0,
  actual_cost      numeric(14,2) NOT NULL DEFAULT 0,
  forecast_cost    numeric(14,2),
  currency         text NOT NULL DEFAULT 'USD',
  status           text NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned','approved','at_risk','overrun','closed')),
  milestone_id     uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  metadata         jsonb NOT NULL DEFAULT '{}',
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_project ON public.budget_items (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budget_items_code ON public.budget_items (project_id, cost_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budget_items_category ON public.budget_items (project_id, category) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.budget_items IS
  'Universal budget lines connected to scope (milestones), tasks, materials, labor, equipment, and cloud/software costs.';

CREATE TABLE IF NOT EXISTS public.cost_actuals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  budget_item_id   uuid REFERENCES public.budget_items(id) ON DELETE SET NULL,
  task_id          uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  resource_id      uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  amount           numeric(14,2) NOT NULL,
  currency         text NOT NULL DEFAULT 'USD',
  cost_date        date NOT NULL DEFAULT CURRENT_DATE,
  cost_type        text NOT NULL DEFAULT 'other'
                   CHECK (cost_type IN ('labor','material','equipment','subcontractor','software','cloud','permit','other')),
  description      text,
  source           text NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('manual','timesheet','invoice','procurement','ai_estimate')),
  metadata         jsonb NOT NULL DEFAULT '{}',
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_actuals_project ON public.cost_actuals (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cost_actuals_budget ON public.cost_actuals (budget_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cost_actuals_task ON public.cost_actuals (task_id) WHERE deleted_at IS NULL;

-- ── 5. material_requirements ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.material_requirements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  description           text,
  spec_reference        text,
  discipline            text,
  trade_key             text,
  quantity              numeric(14,4),
  unit_of_measure       text,
  estimated_unit_cost   numeric(12,2),
  estimated_total_cost  numeric(14,2),
  supplier_id           uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  lead_time_days        integer,
  status                text NOT NULL DEFAULT 'planned'
                        CHECK (status IN (
                          'planned','required','requested','quoted','ordered',
                          'partially_delivered','delivered','installed',
                          'unavailable','delayed','cancelled'
                        )),
  required_by_task_id   uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  required_by_date      date,
  budget_item_id        uuid REFERENCES public.budget_items(id) ON DELETE SET NULL,
  resource_id           uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  source_drawing_id     uuid REFERENCES public.drawing_files(id) ON DELETE SET NULL,
  source_extraction_id  uuid REFERENCES public.drawing_extractions(id) ON DELETE SET NULL,
  source_insight_id     uuid REFERENCES public.drawing_insights(id) ON DELETE SET NULL,
  confidence_score      numeric(5,4),
  evidence_json         jsonb NOT NULL DEFAULT '{}',
  needs_review          boolean NOT NULL DEFAULT false,
  origin                text NOT NULL DEFAULT 'manual'
                        CHECK (origin IN ('manual','drawing_extraction','ai_suggested','template','import')),
  metadata              jsonb NOT NULL DEFAULT '{}',
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matreq_project ON public.material_requirements (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_matreq_status ON public.material_requirements (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_matreq_task ON public.material_requirements (required_by_task_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_matreq_drawing ON public.material_requirements (source_drawing_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_matreq_review ON public.material_requirements (project_id, needs_review) WHERE deleted_at IS NULL AND needs_review = true;

COMMENT ON TABLE public.material_requirements IS
  'Universal material/consumable requirements: concrete, CAT6A, UPS units, API subscriptions. Evidence-first when derived from drawings (source_drawing_id + confidence + needs_review).';

-- ── 6. procurement_items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.procurement_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id               uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_requirement_id  uuid REFERENCES public.material_requirements(id) ON DELETE SET NULL,
  supplier_id              uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  budget_item_id           uuid REFERENCES public.budget_items(id) ON DELETE SET NULL,
  name                     text NOT NULL,
  status                   text NOT NULL DEFAULT 'planned'
                           CHECK (status IN (
                             'planned','requested','quoted','ordered','shipped',
                             'partially_delivered','delivered','cancelled'
                           )),
  quantity                 numeric(14,4),
  unit_of_measure          text,
  unit_cost                numeric(12,2),
  total_cost               numeric(14,2),
  currency                 text NOT NULL DEFAULT 'USD',
  order_date               date,
  expected_delivery_date   date,
  actual_delivery_date     date,
  notes                    text,
  metadata                 jsonb NOT NULL DEFAULT '{}',
  deleted_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_project ON public.procurement_items (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_procurement_status ON public.procurement_items (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_procurement_matreq ON public.procurement_items (material_requirement_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_procurement_delivery ON public.procurement_items (project_id, expected_delivery_date) WHERE deleted_at IS NULL;

-- ── 7. risks / rfis / submittals / inspections / permits ─────────────────────

CREATE TABLE IF NOT EXISTS public.risks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  category          text NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                      'schedule','budget','scope','labor','material','equipment',
                      'technical','quality','safety','permit','external','other'
                    )),
  probability       text NOT NULL DEFAULT 'medium' CHECK (probability IN ('low','medium','high')),
  impact            text NOT NULL DEFAULT 'medium' CHECK (impact IN ('low','medium','high','critical')),
  severity          text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','mitigating','accepted','resolved','closed')),
  mitigation_plan   text,
  owner_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_task_id    uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  linked_milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  source_insight_id uuid REFERENCES public.drawing_insights(id) ON DELETE SET NULL,
  origin            text NOT NULL DEFAULT 'manual'
                    CHECK (origin IN ('manual','drawing_intelligence','ai_suggested','health_engine','import')),
  confidence_score  numeric(5,4),
  evidence_json     jsonb NOT NULL DEFAULT '{}',
  needs_review      boolean NOT NULL DEFAULT false,
  metadata          jsonb NOT NULL DEFAULT '{}',
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risks_project ON public.risks (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risks_status ON public.risks (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risks_task ON public.risks (linked_task_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.rfis (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rfi_number        text,
  subject           text NOT NULL,
  question          text,
  answer            text,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','open','answered','closed','void')),
  priority          text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  due_date          date,
  answered_at       timestamptz,
  blocks_task_id    uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  source_drawing_id uuid REFERENCES public.drawing_files(id) ON DELETE SET NULL,
  source_insight_id uuid REFERENCES public.drawing_insights(id) ON DELETE SET NULL,
  origin            text NOT NULL DEFAULT 'manual'
                    CHECK (origin IN ('manual','drawing_intelligence','ai_suggested','import')),
  evidence_json     jsonb NOT NULL DEFAULT '{}',
  needs_review      boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata          jsonb NOT NULL DEFAULT '{}',
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfis_project ON public.rfis (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rfis_status ON public.rfis (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rfis_blocks ON public.rfis (blocks_task_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.submittals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submittal_number      text,
  title                 text NOT NULL,
  spec_section          text,
  description           text,
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                          'draft','submitted','under_review','approved',
                          'approved_as_noted','revise_resubmit','rejected','closed'
                        )),
  due_date              date,
  approved_at           timestamptz,
  required_before_task_id uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  supplier_id           uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  source_drawing_id     uuid REFERENCES public.drawing_files(id) ON DELETE SET NULL,
  source_insight_id     uuid REFERENCES public.drawing_insights(id) ON DELETE SET NULL,
  origin                text NOT NULL DEFAULT 'manual'
                        CHECK (origin IN ('manual','drawing_intelligence','ai_suggested','import')),
  evidence_json         jsonb NOT NULL DEFAULT '{}',
  needs_review          boolean NOT NULL DEFAULT false,
  metadata              jsonb NOT NULL DEFAULT '{}',
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submittals_project ON public.submittals (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submittals_status ON public.submittals (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submittals_task ON public.submittals (required_before_task_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inspections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title             text NOT NULL,
  inspection_type   text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','scheduled','passed','failed','waived','cancelled')),
  scheduled_date    date,
  completed_date    date,
  inspector_name    text,
  linked_task_id    uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  location_zone     text,
  notes             text,
  metadata          jsonb NOT NULL DEFAULT '{}',
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspections_project ON public.inspections (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inspections_task ON public.inspections (linked_task_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.permits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name              text NOT NULL,
  authority         text,
  permit_number     text,
  status            text NOT NULL DEFAULT 'required'
                    CHECK (status IN ('required','applied','approved','rejected','expired','not_required')),
  applied_date      date,
  approved_date     date,
  expiry_date       date,
  linked_task_id    uuid REFERENCES public.roadmap_tasks(id) ON DELETE SET NULL,
  notes             text,
  metadata          jsonb NOT NULL DEFAULT '{}',
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permits_project ON public.permits (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_permits_task ON public.permits (linked_task_id) WHERE deleted_at IS NULL;

-- ── 8. resource_assignments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resource_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id          uuid NOT NULL REFERENCES public.roadmap_tasks(id) ON DELETE CASCADE,
  resource_id      uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  assignment_type  text NOT NULL DEFAULT 'contributor'
                   CHECK (assignment_type IN (
                     'owner','contributor','crew','reviewer',
                     'equipment','material','vendor','ai_agent'
                   )),
  allocation_pct   numeric(5,2) CHECK (allocation_pct IS NULL OR (allocation_pct > 0 AND allocation_pct <= 100)),
  planned_hours    numeric(8,2),
  actual_hours     numeric(8,2),
  start_date       date,
  end_date         date,
  metadata         jsonb NOT NULL DEFAULT '{}',
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (task_id, resource_id, assignment_type)
);

CREATE INDEX IF NOT EXISTS idx_resassign_project ON public.resource_assignments (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resassign_task ON public.resource_assignments (task_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resassign_resource ON public.resource_assignments (resource_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.resource_assignments IS
  'Many-to-many task ↔ resource assignment: people, crews, equipment, materials, vendors, AI agents. Single-owner shortcut lives on roadmap_tasks.assigned_to.';

-- ── 9. roadmap_tasks: universal assignment / cost / location columns ─────────

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS assigned_resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS assignment_type text
    CHECK (assignment_type IS NULL OR assignment_type IN (
      'person','team','role','crew','vendor','resource_group','ai_agent'
    ));
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS required_skills jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS required_crew_size integer;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS estimated_labor_hours numeric(8,2);
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS location_zone text;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS discipline text;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS trade_key text;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS cost_code text;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS budget_item_id uuid REFERENCES public.budget_items(id) ON DELETE SET NULL;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS source_drawing_id uuid REFERENCES public.drawing_files(id) ON DELETE SET NULL;
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS source_insight_id uuid REFERENCES public.drawing_insights(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_assigned
  ON public.roadmap_tasks (assigned_to) WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_assigned_resource
  ON public.roadmap_tasks (assigned_resource_id) WHERE deleted_at IS NULL AND assigned_resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_budget
  ON public.roadmap_tasks (budget_item_id) WHERE deleted_at IS NULL AND budget_item_id IS NOT NULL;

-- ── 10. critical_path_snapshots ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.critical_path_snapshots (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  computed_at             timestamptz NOT NULL DEFAULT now(),
  trigger_reason          text NOT NULL DEFAULT 'manual'
                          CHECK (trigger_reason IN (
                            'manual','dependency_change','duration_change',
                            'material_delay','labor_unavailable','rfi_blocker',
                            'submittal_pending','drawing_revision','scheduled'
                          )),
  task_count              integer NOT NULL DEFAULT 0,
  critical_task_ids       jsonb NOT NULL DEFAULT '[]',
  project_duration_days   integer,
  project_earliest_finish date,
  summary                 jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cps_project
  ON public.critical_path_snapshots (project_id, computed_at DESC);

COMMENT ON TABLE public.critical_path_snapshots IS
  'Point-in-time critical path results so users can see how the schedule evolved. Written by the CriticalPathService after each recalculation.';

-- ── 11. Living Graph CHECK extensions ─────────────────────────────────────────

ALTER TABLE public.process_nodes
  DROP CONSTRAINT IF EXISTS process_nodes_node_type_check;

ALTER TABLE public.process_nodes
  ADD CONSTRAINT process_nodes_node_type_check
  CHECK (node_type IN (
    'task_transition', 'decision_cascade', 'communication_flow',
    'document_link', 'milestone_gate', 'blocker_event',
    'labor_risk', 'drawing_event', 'drawing_insight',
    -- universal execution model
    'resource_event', 'material_event', 'procurement_event',
    'budget_event', 'risk_event', 'rfi_event', 'submittal_event',
    'inspection_event', 'permit_event', 'critical_path_event'
  ));

ALTER TABLE public.process_nodes
  DROP CONSTRAINT IF EXISTS process_nodes_source_entity_type_check;

ALTER TABLE public.process_nodes
  ADD CONSTRAINT process_nodes_source_entity_type_check
  CHECK (source_entity_type IN (
    'roadmap_tasks', 'decisions', 'communication_items',
    'meetings', 'documents', 'milestones',
    'construction_activities', 'drawing_files', 'drawing_insights',
    -- universal execution model
    'resources', 'material_requirements', 'procurement_items',
    'budget_items', 'risks', 'rfis', 'submittals',
    'inspections', 'permits', 'critical_path_snapshots'
  ));

ALTER TABLE public.process_edges
  DROP CONSTRAINT IF EXISTS process_edges_edge_type_check;

ALTER TABLE public.process_edges
  ADD CONSTRAINT process_edges_edge_type_check
  CHECK (edge_type IN (
    'caused', 'enabled', 'blocked', 'delayed', 'accelerated', 'informed',
    'labor_constrained', 'generated_insight', 'affects',
    -- universal execution model
    'requires_material', 'requires_resource', 'requires_approval',
    'assigned_to', 'impacts_cost', 'impacts_procurement',
    'creates_risk', 'mitigates_risk', 'supplied_by'
  ));

-- ── 12. Triggers + RLS for all new tables ─────────────────────────────────────

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'suppliers','resources','budget_items','cost_actuals',
    'material_requirements','procurement_items',
    'risks','rfis','submittals','inspections','permits',
    'resource_assignments','critical_path_snapshots'
  ]
  LOOP
    -- updated_at trigger (critical_path_snapshots is append-only, no updated_at column)
    IF tbl != 'critical_path_snapshots' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', tbl);
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
        tbl);
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "Members can read %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can insert %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can update %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Members can delete %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Service role has full access on %s" ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY "Members can read %s" ON public.%I FOR SELECT USING (public.is_org_member(organization_id))',
      tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Members can insert %s" ON public.%I FOR INSERT WITH CHECK (public.is_org_member(organization_id))',
      tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Members can update %s" ON public.%I FOR UPDATE USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))',
      tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Members can delete %s" ON public.%I FOR DELETE USING (public.is_org_member(organization_id))',
      tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Service role has full access on %s" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      tbl, tbl);
  END LOOP;
END;
$$;
