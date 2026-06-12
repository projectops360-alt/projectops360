-- ══════════════════════════════════════════════════════════════════════════════
-- ProjectOps360° MVP-0 — Expand TaskStatus for AI-assisted workflow
-- Migration: 20260620000000
-- Task: 4.1 — Add AI-assisted task execution statuses
--
-- Lifecycle: not_started → prompt_ready → sent_to_ai → in_progress
--            → implemented → tested → done
--            blocked or deferred can be set at any stage.
--
-- SAFETY: All 5 original values remain valid. No data migration needed.
-- ROLLBACK: Before narrowing the CHECK constraint back, UPDATE any rows
--           with new statuses to 'in_progress', then re-add the old constraint.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Drop existing CHECK constraint ────────────────────────────────────────────

ALTER TABLE public.roadmap_tasks
  DROP CONSTRAINT roadmap_tasks_status_check;

-- ── Re-add with 9 values (5 original + 4 new) ────────────────────────────────

ALTER TABLE public.roadmap_tasks
  ADD CONSTRAINT roadmap_tasks_status_check
  CHECK (status IN (
    'not_started',
    'prompt_ready',
    'sent_to_ai',
    'in_progress',
    'implemented',
    'tested',
    'done',
    'blocked',
    'deferred'
  ));

-- ── Documentation ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.roadmap_tasks.status IS
  'Task lifecycle: not_started → prompt_ready → sent_to_ai → in_progress → implemented → tested → done. blocked and deferred can be set at any stage.';

-- ── Index for prompt_ready tasks (likely query: "show me tasks ready for AI") ─

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_prompt_ready
  ON public.roadmap_tasks(project_id, status)
  WHERE status = 'prompt_ready' AND deleted_at IS NULL;

-- ── Index for sent_to_ai tasks (likely query: "show me tasks being processed by AI") ─

CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_sent_to_ai
  ON public.roadmap_tasks(project_id, status)
  WHERE status = 'sent_to_ai' AND deleted_at IS NULL;