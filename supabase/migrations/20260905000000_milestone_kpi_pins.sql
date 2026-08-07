-- ============================================================================
-- ProjectOps360° — KPIs pinned to a milestone
-- Migration: 20260905000000_milestone_kpi_pins.sql
--
-- "How do I link a KPI to a milestone?" had no answer: the KPI engine was
-- project-wide, so a KPI belonged to a project or to nothing. This table is
-- that link — which KPIs a given phase is measured by.
--
-- It stores the ASSIGNMENT only, never a value. The number is computed live
-- from the canonical tables by the same expression engine used everywhere else
-- (one source of metrics, REG-010); caching it here would create a second
-- source that drifts the moment anyone logs an hour.
--
-- The pin is PROJECT DATA, not a view preference: when a PM decides Preparación
-- is measured by budget consumption, everyone on that project should see it.
-- (Contrast the Living Graph card KPIs, which are a per-browser view pref.)
--
-- ADDITIVE ONLY: milestones with no pins behave exactly as before.
-- Guarded by MILESTONE-KPI-PINS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.milestone_kpi_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  -- A built-in catalog slug or the slug of a custom KPI in this project. Text,
  -- not an FK: built-ins live in code and have no row to point at. Resolution
  -- (catalog first, then the project's custom definitions) happens server-side,
  -- and a pin whose KPI no longer exists is reported, never silently dropped.
  kpi_slug text NOT NULL CHECK (length(trim(kpi_slug)) > 0),
  order_index integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One pin per KPI per milestone: pinning twice is idempotent, not a duplicate
  -- row that would render the same number twice on the same card.
  CONSTRAINT milestone_kpi_pins_unique UNIQUE (milestone_id, kpi_slug)
);

CREATE INDEX IF NOT EXISTS idx_milestone_kpi_pins_project
  ON public.milestone_kpi_pins (project_id);
CREATE INDEX IF NOT EXISTS idx_milestone_kpi_pins_milestone
  ON public.milestone_kpi_pins (milestone_id, order_index);

-- ── RLS: org members read; writes go through server actions ──────────────────
ALTER TABLE public.milestone_kpi_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read milestone kpi pins" ON public.milestone_kpi_pins;
CREATE POLICY "Members read milestone kpi pins"
  ON public.milestone_kpi_pins FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members write milestone kpi pins" ON public.milestone_kpi_pins;
CREATE POLICY "Members write milestone kpi pins"
  ON public.milestone_kpi_pins FOR ALL
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Service role full access on milestone kpi pins" ON public.milestone_kpi_pins;
CREATE POLICY "Service role full access on milestone kpi pins"
  ON public.milestone_kpi_pins FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.milestone_kpi_pins IS
  'Which KPIs a milestone is measured by. Assignment only — values are always computed live by the KPI engine, never cached here (REG-010: one source of metrics).';
