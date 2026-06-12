-- ══════════════════════════════════════════════════════════════════════════════
-- ProjectOps360° MVP-0 — Add tracking fields to roadmap_tasks + milestone title unique
-- Migration: 20260619000000
-- Sprint 10 sync — external_key, execution_notes, completed_at
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Add external_key for idempotent task identification ────────────────────────

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS external_key text;

-- Partial unique index: only one active task per project per external_key
-- Allows NULLs and soft-deleted rows to coexist
CREATE UNIQUE INDEX IF NOT EXISTS idx_roadmap_tasks_project_external
  ON public.roadmap_tasks(project_id, external_key)
  WHERE external_key IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.roadmap_tasks.external_key IS
  'External identifier for idempotent sync (e.g. "3.1"). Unique per project among non-deleted tasks.';

-- ── Add execution_notes for sprint tracking ────────────────────────────────────

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS execution_notes text;

COMMENT ON COLUMN public.roadmap_tasks.execution_notes IS
  'Free-form notes capturing what was done, decisions, and observations during execution.';

-- ── Add completed_at for completion tracking ───────────────────────────────────

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.roadmap_tasks.completed_at IS
  'Timestamp when the task was marked as done. Set automatically or manually.';

-- ── Add unique index on milestones for idempotent upsert by title ──────────────

-- Allows ON CONFLICT for milestone upsert: only one active milestone per (org, project, title)
CREATE UNIQUE INDEX IF NOT EXISTS idx_milestones_org_project_title
  ON public.milestones(organization_id, project_id, title)
  WHERE deleted_at IS NULL;