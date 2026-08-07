-- ============================================================================
-- ProjectOps360° — Schedule baseline (plan inicial vs plan actual)
-- Migration: 20260906000000_schedule_baseline.sql
--
-- A Gantt could only ever show TODAY's plan. "Has this slipped?" had no answer
-- in the product, and neither did SPI — earned value needs a planned value, and
-- planned value needs a plan that does not move when you drag a bar.
--
-- These columns hold the dates the work was COMMITTED to. They are written once
-- when a baseline is captured and never touched by ordinary rescheduling, which
-- is the entire point: the baseline is the thing the current plan is measured
-- against.
--
-- PROVENANCE IS MANDATORY. The Product Brain rule for the Variance overlay
-- (pi-variance-baseline) is that the product never fabricates a baseline — with
-- no approved baseline it shows an honest empty state. The same rule applies
-- here, so the project records WHERE its baseline came from and WHEN, and a
-- project with baseline_captured_at NULL has no baseline rather than a
-- pretended one.
--
-- ADDITIVE ONLY: every column is nullable and nothing reads them until a
-- baseline exists.
-- Guarded by SCHEDULE-BASELINE.
-- ============================================================================

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS baseline_start_date date,
  ADD COLUMN IF NOT EXISTS baseline_end_date date,
  ADD COLUMN IF NOT EXISTS baseline_estimate_hours numeric(10,2);

ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS baseline_start_date date,
  ADD COLUMN IF NOT EXISTS baseline_target_date date;

-- Where the baseline came from, so a number on a client slide can be traced.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS baseline_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS baseline_captured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS baseline_source text
    CHECK (baseline_source IS NULL OR baseline_source IN ('import', 'current_plan', 'manual'));

COMMENT ON COLUMN public.roadmap_tasks.baseline_start_date IS
  'The start the work was committed to. Written when a baseline is captured; never moved by rescheduling — that is what makes slippage measurable.';
COMMENT ON COLUMN public.projects.baseline_source IS
  'import = the plan as delivered in the source file; current_plan = a snapshot of today''s dates; manual = entered by hand. NULL means no baseline exists — never treat that as zero variance.';

-- Only tasks that HAVE a baseline; the partial index stays small on projects
-- that never captured one.
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_baseline
  ON public.roadmap_tasks (project_id)
  WHERE baseline_start_date IS NOT NULL;
