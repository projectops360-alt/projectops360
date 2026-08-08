-- ============================================================================
-- ProjectOps360° — Why a task sits under the milestone it does
-- Migration: 20260907000000_task_milestone_reassignments.sql
--
-- Moving a task between milestones silently rewrites the plan: counts, per-
-- milestone progress, SPI and every pinned KPI shift, and nothing anywhere says
-- the work was moved rather than replanned. `roadmap_tasks.milestone_id` holds
-- only the current answer.
--
-- This records the change: what moved, from where, to where, why, and who did
-- it. Two things fall out of that — a reassignment can be explained months
-- later, and it can be undone exactly, because the previous milestone is still
-- written down.
--
-- ADDITIVE ONLY. Nothing reads it to render a task; it is provenance, and a
-- project with no rows here behaves exactly as before.
-- Guarded by TASK-MILESTONE-REASSIGNMENT.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_milestone_reassignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.roadmap_tasks(id) ON DELETE CASCADE,
  -- Nullable: a task can legitimately have had no milestone before.
  from_milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  to_milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  -- Titles as they read AT THE TIME. Renaming a milestone later must not
  -- rewrite the history of why something moved.
  from_milestone_title text,
  to_milestone_title text,
  task_title text,
  reason text NOT NULL,
  moved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_reassignments_project
  ON public.task_milestone_reassignments (project_id, moved_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_reassignments_task
  ON public.task_milestone_reassignments (task_id);

ALTER TABLE public.task_milestone_reassignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read task reassignments" ON public.task_milestone_reassignments;
CREATE POLICY "Members read task reassignments"
  ON public.task_milestone_reassignments FOR SELECT
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Service role full access on task reassignments" ON public.task_milestone_reassignments;
CREATE POLICY "Service role full access on task reassignments"
  ON public.task_milestone_reassignments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.task_milestone_reassignments IS
  'Audit + rollback for tasks moved between milestones. Records the previous milestone, so a reassignment can be explained and undone exactly.';
