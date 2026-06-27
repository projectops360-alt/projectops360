-- ============================================================================
-- ProjectOps360° — Resource Capacity Intelligence (Phase A foundation)
-- Migration: 20260812000000_resource_capacity.sql
--
-- Generic, project-type-agnostic resource capacity model. Does NOT touch the
-- construction Labor Capacity tables (labor_resources / construction_activities /
-- labor_weekly_capacity) — those keep working unchanged. This adds:
--   • resource_profiles            — org-level person/resource capacity defaults
--   • project_resource_allocations — per-project allocation + capacity inputs
--   • resource_availability_exceptions — PTO / reduced availability windows
--   • resource_workload_snapshots  — computed per-period capacity snapshots
--   • workforce_health_scores      — project-level Workforce Health Index
--
-- RLS: org-scoped via is_org_member(); project-scoped tables also gated by
-- can_access_project() so PMs only see their projects' capacity. Additive only.
-- ============================================================================

-- ── 1. resource_profiles (org-level) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resource_profiles (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id                       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name                  text NOT NULL,
  resource_type                 text NOT NULL DEFAULT 'person',
  default_role                  text,
  department                    text,
  default_weekly_capacity_hours numeric(8,2) NOT NULL DEFAULT 40,
  default_availability_percent  numeric(5,2) NOT NULL DEFAULT 100,
  default_overhead_percent      numeric(5,2) NOT NULL DEFAULT 0,
  timezone                      text,
  is_active                     boolean NOT NULL DEFAULT true,
  metadata                      jsonb NOT NULL DEFAULT '{}',
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resource_profiles_org ON public.resource_profiles (organization_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_resource_profiles_user ON public.resource_profiles (user_id);

-- ── 2. project_resource_allocations (per-project) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.project_resource_allocations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_profile_id     uuid REFERENCES public.resource_profiles(id) ON DELETE SET NULL,
  user_id                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_team_member_id  uuid REFERENCES public.project_team_members(id) ON DELETE SET NULL,
  display_name            text,
  project_role            text,
  allocation_percent      numeric(5,2) NOT NULL DEFAULT 100,
  weekly_capacity_hours   numeric(8,2),
  availability_percent    numeric(5,2),
  overhead_percent        numeric(5,2),
  start_date              date,
  end_date                date,
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','removed')),
  metadata                jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pra_project ON public.project_resource_allocations (project_id, status);
CREATE INDEX IF NOT EXISTS idx_pra_profile ON public.project_resource_allocations (resource_profile_id);
CREATE INDEX IF NOT EXISTS idx_pra_user ON public.project_resource_allocations (user_id);

-- ── 3. resource_availability_exceptions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resource_availability_exceptions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id                  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_profile_id         uuid REFERENCES public.resource_profiles(id) ON DELETE CASCADE,
  exception_type              text NOT NULL DEFAULT 'pto',
  start_date                  date NOT NULL,
  end_date                    date NOT NULL,
  capacity_adjustment_percent numeric(5,2),
  hours_unavailable           numeric(8,2),
  reason                      text,
  metadata                    jsonb NOT NULL DEFAULT '{}',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rae_project ON public.resource_availability_exceptions (project_id);
CREATE INDEX IF NOT EXISTS idx_rae_profile ON public.resource_availability_exceptions (resource_profile_id, start_date);

-- ── 4. resource_workload_snapshots ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resource_workload_snapshots (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id               uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_profile_id      uuid REFERENCES public.resource_profiles(id) ON DELETE SET NULL,
  resource_key             text,
  period_start             date NOT NULL,
  period_end               date NOT NULL,
  nominal_capacity_hours   numeric(10,2) NOT NULL DEFAULT 0,
  effective_capacity_hours numeric(10,2) NOT NULL DEFAULT 0,
  assigned_work_hours      numeric(10,2) NOT NULL DEFAULT 0,
  remaining_capacity_hours numeric(10,2) NOT NULL DEFAULT 0,
  utilization_percent      numeric(6,2),
  overallocated_hours      numeric(10,2) NOT NULL DEFAULT 0,
  overhead_percent         numeric(5,2),
  availability_percent     numeric(5,2),
  status                   text NOT NULL DEFAULT 'needs_review',
  calculation_source       text NOT NULL DEFAULT 'engine',
  metadata                 jsonb NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rws_project ON public.resource_workload_snapshots (project_id, period_start);

-- ── 5. workforce_health_scores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_health_scores (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id                      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period_start                    date NOT NULL,
  period_end                      date NOT NULL,
  score                           integer NOT NULL DEFAULT 100,
  status                          text NOT NULL DEFAULT 'healthy',
  total_nominal_capacity_hours    numeric(12,2) NOT NULL DEFAULT 0,
  total_effective_capacity_hours  numeric(12,2) NOT NULL DEFAULT 0,
  total_assigned_work_hours       numeric(12,2) NOT NULL DEFAULT 0,
  total_remaining_capacity_hours  numeric(12,2) NOT NULL DEFAULT 0,
  total_overallocated_hours       numeric(12,2) NOT NULL DEFAULT 0,
  workforce_availability_percent  numeric(6,2),
  project_overhead_percent        numeric(6,2),
  critical_resource_count         integer NOT NULL DEFAULT 0,
  overallocated_resource_count    integer NOT NULL DEFAULT 0,
  unassigned_task_count           integer NOT NULL DEFAULT 0,
  missing_estimate_count          integer NOT NULL DEFAULT 0,
  at_risk_milestone_count         integer NOT NULL DEFAULT 0,
  score_breakdown_json            jsonb NOT NULL DEFAULT '{}',
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whs_project ON public.workforce_health_scores (project_id, period_start DESC);

-- ── updated_at triggers ─────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'resource_profiles','project_resource_allocations','resource_availability_exceptions',
    'resource_workload_snapshots','workforce_health_scores'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%s', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t);
  END LOOP;
END $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- resource_profiles is org-level (no project_id).
ALTER TABLE public.resource_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_select" ON public.resource_profiles;
DROP POLICY IF EXISTS "po_write"  ON public.resource_profiles;
DROP POLICY IF EXISTS "po_service_role" ON public.resource_profiles;
CREATE POLICY "po_select" ON public.resource_profiles FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "po_write"  ON public.resource_profiles FOR ALL USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "po_service_role" ON public.resource_profiles FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Project-scoped tables: org member AND (project_id IS NULL OR can_access_project()).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_resource_allocations','resource_availability_exceptions',
    'resource_workload_snapshots','workforce_health_scores'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "po_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "po_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "po_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "po_delete" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "po_service_role" ON public.%I', t);
    EXECUTE format($f$CREATE POLICY "po_select" ON public.%I FOR SELECT USING (public.is_org_member(organization_id) AND (project_id IS NULL OR public.can_access_project(project_id)))$f$, t);
    EXECUTE format($f$CREATE POLICY "po_insert" ON public.%I FOR INSERT WITH CHECK (public.is_org_member(organization_id) AND (project_id IS NULL OR public.can_access_project(project_id)))$f$, t);
    EXECUTE format($f$CREATE POLICY "po_update" ON public.%I FOR UPDATE USING (public.is_org_member(organization_id) AND (project_id IS NULL OR public.can_access_project(project_id))) WITH CHECK (public.is_org_member(organization_id) AND (project_id IS NULL OR public.can_access_project(project_id)))$f$, t);
    EXECUTE format($f$CREATE POLICY "po_delete" ON public.%I FOR DELETE USING (public.is_org_member(organization_id) AND (project_id IS NULL OR public.can_access_project(project_id)))$f$, t);
    EXECUTE format($f$CREATE POLICY "po_service_role" ON public.%I FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')$f$, t);
  END LOOP;
END $$;

COMMENT ON TABLE public.resource_profiles IS 'Org-level human resource capacity defaults (generic, all project types). Construction crews remain in labor_resources.';
COMMENT ON TABLE public.project_resource_allocations IS 'Per-project resource capacity inputs (weekly hours, availability, overhead). Feeds Resource Capacity Intelligence.';
