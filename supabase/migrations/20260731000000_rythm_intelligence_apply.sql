-- ============================================================================
-- ProjectOps360° — Rythm intelligence: "Apply to Project" support
-- Migration: 20260731000000_rythm_intelligence_apply.sql
-- ============================================================================

ALTER TABLE public.project_rythm_intelligence
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

COMMENT ON COLUMN public.project_rythm_intelligence.applied_at IS
  'When the intelligence was bulk-applied to the project (tasks/risks/decisions/milestones/dependencies created). NULL = not yet applied.';

-- New activity-log actions for bulk apply + milestone/dependency promotion.
ALTER TABLE public.project_rythm_activity_log
  DROP CONSTRAINT IF EXISTS project_rythm_activity_log_action_check;
ALTER TABLE public.project_rythm_activity_log
  ADD CONSTRAINT project_rythm_activity_log_action_check
  CHECK (action IN (
    'meeting_created', 'recording_started', 'recording_stopped',
    'audio_uploaded', 'audio_prepared', 'transcription_queued',
    'transcription_started', 'transcription_completed', 'transcription_failed',
    'transcription_retried', 'job_retried', 'job_cancelled',
    'audio_deleted', 'validation_failed',
    'speaker_mapping_saved', 'speaker_mapping_reset',
    'meeting_intelligence_generated', 'meeting_intelligence_regenerated',
    'action_item_promoted', 'risk_promoted', 'decision_promoted',
    'milestone_promoted', 'dependency_promoted', 'intelligence_applied'
  ));
