-- ============================================================================
-- ProjectOps360° — Add communication_history_summary prompt type
-- Migration: 20260616000000_add_comm_history_summary_prompt.sql
--
-- Adds 'communication_history_summary' to the ai_runs.prompt_type CHECK
-- constraint so the new AI summarization flow can log its runs.
-- ============================================================================

-- Drop and recreate the CHECK constraint with the new value
ALTER TABLE public.ai_runs
  DROP CONSTRAINT ai_runs_prompt_type_check;

ALTER TABLE public.ai_runs
  ADD CONSTRAINT ai_runs_prompt_type_check
  CHECK (prompt_type IN (
    'summary', 'decision_analysis', 'stakeholder_mapping',
    'risk_assessment', 'action_extraction',
    'communication_history_summary',
    'custom'
  ));