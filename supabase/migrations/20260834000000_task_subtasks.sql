-- ============================================================================
-- ProjectOps360° — Task Execution Map: structured subtasks
-- Migration: 20260834000000_task_subtasks.sql
--
-- Adds task_subtasks (structured subtasks inside a roadmap task) plus three
-- additive columns on roadmap_tasks for calculated-parent-progress governance.
-- ADDITIVE ONLY: tasks without subtasks keep the existing manual progress
-- behavior; nothing existing changes. workspace scoping = organization_id
-- (the platform's tenant key).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.roadmap_tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','blocked','in_review','completed','cancelled')),
  priority text NOT NULL DEFAULT 'p2' CHECK (priority IN ('p1','p2','p3')),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  completed_at timestamptz,
  estimated_hours numeric(8,2) CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  actual_hours numeric(8,2) CHECK (actual_hours IS NULL OR actual_hours >= 0),
  weight numeric(8,2) CHECK (weight IS NULL OR weight >= 0),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  is_critical boolean NOT NULL DEFAULT false,
  blocked_reason text,
  blocked_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task
  ON public.task_subtasks (task_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_subtasks_project
  ON public.task_subtasks (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_subtasks_owner
  ON public.task_subtasks (owner_id) WHERE owner_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_subtasks_blocked
  ON public.task_subtasks (project_id, status) WHERE status = 'blocked' AND deleted_at IS NULL;

-- updated_at maintenance (same convention as other tables)
CREATE OR REPLACE FUNCTION public.task_subtasks_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_subtasks_updated_at ON public.task_subtasks;
CREATE TRIGGER trg_task_subtasks_updated_at
  BEFORE UPDATE ON public.task_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.task_subtasks_touch_updated_at();

-- ── RLS: org members read; writes go through server actions (service role) ──
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read task_subtasks"
  ON public.task_subtasks FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role full access on task_subtasks"
  ON public.task_subtasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Parent progress governance (additive columns on roadmap_tasks) ──────────
-- subtask_progress_mode: how the parent % is calculated from subtasks
--   ('auto' = hours → weighted → count).
-- progress_overridden + reason: an authorized manual override pauses the
--   auto-recalculation and is always audited (ParentTaskProgressOverride).
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS subtask_progress_mode text NOT NULL DEFAULT 'auto'
    CHECK (subtask_progress_mode IN ('auto','count','weighted','hours')),
  ADD COLUMN IF NOT EXISTS progress_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress_override_reason text;

COMMENT ON TABLE public.task_subtasks IS
  'Task Execution Map: structured subtasks inside a roadmap task. Parent progress is calculated from active subtasks (cancelled excluded); tasks without subtasks keep manual progress.';
