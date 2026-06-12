-- ══════════════════════════════════════════════════════════════════════════════
-- ProjectOps360° MVP-0 — Add prompt storage fields to roadmap_tasks
-- Migration: 20260621000000
-- Task: 4.2 — Add prompt storage fields for AI-assisted task execution
--
-- Fields added:
--   prompt_body         text         The prompt text to copy/send to AI
--   prompt_context      text         Context metadata (what the prompt is about)
--   prompt_version      integer      Version counter for prompt iterations (default 1)
--   last_prompt_sent_at timestamptz  When the prompt was last sent to an AI tool
--   ai_tool_target      text         Which AI tool the prompt targets (claude, codex, etc.)
--   implementation_notes text        Notes about what was implemented
--   test_notes          text         Notes about testing/verification results
--
-- SAFETY: All fields are nullable or have defaults. Existing rows are unaffected.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS prompt_body text;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS prompt_context text;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS prompt_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS last_prompt_sent_at timestamptz;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS ai_tool_target text;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS implementation_notes text;

ALTER TABLE public.roadmap_tasks
  ADD COLUMN IF NOT EXISTS test_notes text;

-- ── Indexes for common query patterns ──────────────────────────────────────────

-- Find tasks with prompts ready to send
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_prompt_ready
  ON public.roadmap_tasks(project_id, status)
  WHERE prompt_body IS NOT NULL AND status = 'prompt_ready' AND deleted_at IS NULL;

-- Find tasks recently sent to AI
CREATE INDEX IF NOT EXISTS idx_roadmap_tasks_last_prompt_sent
  ON public.roadmap_tasks(project_id, last_prompt_sent_at DESC)
  WHERE last_prompt_sent_at IS NOT NULL AND deleted_at IS NULL;

-- ── Comments ─────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.roadmap_tasks.prompt_body IS
  'The prompt text ready to copy/send to an AI tool. Nullable — not all tasks need prompts.';
COMMENT ON COLUMN public.roadmap_tasks.prompt_context IS
  'Context metadata describing what the prompt addresses (e.g. "Implement auth middleware for Sprint 3").';
COMMENT ON COLUMN public.roadmap_tasks.prompt_version IS
  'Version counter for prompt iterations. Starts at 1, increments when the prompt is refined.';
COMMENT ON COLUMN public.roadmap_tasks.last_prompt_sent_at IS
  'Timestamp when the prompt was last dispatched to an AI tool. Nullable — null if never sent.';
COMMENT ON COLUMN public.roadmap_tasks.ai_tool_target IS
  'Target AI tool for this prompt (e.g. "claude", "codex", "cursor"). Nullable — task may not target a specific tool.';
COMMENT ON COLUMN public.roadmap_tasks.implementation_notes IS
  'Notes about what was implemented. Filled in during the "implemented" status phase.';
COMMENT ON COLUMN public.roadmap_tasks.test_notes IS
  'Notes about testing and verification results. Filled in during the "tested" status phase.';