-- ──────────────────────────────────────────────
-- Migration: Create task_dependencies table + CPM fields on roadmap_tasks
-- Phase 4: Structured dependencies + Critical Path Method support
-- ──────────────────────────────────────────────

-- ── task_dependencies table ──────────────────────

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  predecessor_id  uuid NOT NULL REFERENCES public.roadmap_tasks(id) ON DELETE CASCADE,
  successor_id    uuid NOT NULL REFERENCES public.roadmap_tasks(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'finish_to_start'
    CHECK (dependency_type IN ('finish_to_start','start_to_start','start_to_finish','finish_to_finish')),
  lag_days        integer NOT NULL DEFAULT 0 CHECK (lag_days >= -365 AND lag_days <= 365),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- A task cannot depend on itself
  CHECK (predecessor_id != successor_id),

  -- Prevent duplicate dependency edges of the same type
  UNIQUE (predecessor_id, successor_id, dependency_type)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_task_deps_project
  ON public.task_dependencies(project_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_task_deps_predecessor
  ON public.task_dependencies(predecessor_id);

CREATE INDEX IF NOT EXISTS idx_task_deps_successor
  ON public.task_dependencies(successor_id);

-- RLS policies (same pattern as other business tables)
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read task_dependencies"
  ON public.task_dependencies FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert task_dependencies"
  ON public.task_dependencies FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update task_dependencies"
  ON public.task_dependencies FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete task_dependencies"
  ON public.task_dependencies FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on task_dependencies"
  ON public.task_dependencies FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── CPM fields on roadmap_tasks ─────────────────

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT false;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS slack_days numeric(6,2);

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS earliest_start date;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS earliest_finish date;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS latest_start date;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS latest_finish date;

-- Index for critical path queries
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_critical
  ON public.roadmap_tasks(project_id, is_critical)
  WHERE deleted_at IS NULL;

-- ── Verification ──────────────────────────────

SELECT 'task_dependencies table created' AS entity,
  table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'task_dependencies'
ORDER BY ordinal_position;

SELECT 'roadmap_tasks CPM columns' AS entity,
  column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roadmap_tasks'
  AND column_name IN ('is_critical', 'slack_days', 'earliest_start', 'earliest_finish', 'latest_start', 'latest_finish')
ORDER BY ordinal_position;