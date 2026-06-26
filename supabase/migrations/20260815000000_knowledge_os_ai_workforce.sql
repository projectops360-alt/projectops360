-- ============================================================================
-- ProjectOps360° — Knowledge OS / AI Workforce foundation (Phase 1.1)
-- Migration: 20260815000000_knowledge_os_ai_workforce.sql
--
-- Structural-only, ADDITIVE migration. Introduces the AI Workforce dimension:
-- every Living Guide answer/event now records which expert (persona) produced
-- it. Experts (Isabella, and future Atlas/Sentinel/...) share ONE Knowledge OS
-- corpus — they differ only by persona/tone/specialty/presentation. There is
-- NO corpus migration, NO new vector store, NO knowledge duplication.
--
-- Prompt provenance is now two-part:
--   prompt_version   = base Knowledge OS prompt  (e.g. knowledge-os-base@1.0.0)
--   persona_version  = persona overlay           (e.g. isabella@1.0.0)
-- ============================================================================

ALTER TABLE public.knowledge_answers
  ADD COLUMN IF NOT EXISTS expert_key text NOT NULL DEFAULT 'isabella';
ALTER TABLE public.knowledge_answers
  ADD COLUMN IF NOT EXISTS persona_version text;
ALTER TABLE public.guide_events
  ADD COLUMN IF NOT EXISTS expert_key text NOT NULL DEFAULT 'isabella';

COMMENT ON COLUMN public.knowledge_answers.expert_key IS
  'AI Workforce expert/persona that produced this answer (default isabella). Experts share ONE Knowledge OS corpus; they differ only by persona/tone/specialty/presentation.';
COMMENT ON COLUMN public.knowledge_answers.persona_version IS
  'Persona overlay prompt version, e.g. isabella@1.0.0. The base Knowledge OS prompt version is stored in prompt_version (knowledge-os-base@1.0.0).';
COMMENT ON COLUMN public.guide_events.expert_key IS
  'AI Workforce expert/persona associated with this telemetry event.';
