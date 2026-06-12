-- ──────────────────────────────────────────────
-- Migration: Add task scheduling fields for Gantt and critical path
-- Fields: start_date, end_date, duration_days, progress, is_blocked, blocker_reason
-- ──────────────────────────────────────────────

-- Add scheduling fields to roadmap_tasks
ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS duration_days integer
    CHECK (duration_days IS NULL OR duration_days > 0);

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100);

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS blocker_reason text;

-- Indexes for Gantt queries
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_dates
  ON public.roadmap_tasks(project_id, start_date, end_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_milestone_dates
  ON public.roadmap_tasks(milestone_id, start_date)
  WHERE deleted_at IS NULL;

-- ── Verification ──────────────────────────────────

SELECT 'roadmap_tasks columns added' AS entity,
  column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roadmap_tasks'
  AND column_name IN ('start_date', 'end_date', 'duration_days', 'progress', 'is_blocked', 'blocker_reason')
ORDER BY ordinal_position;