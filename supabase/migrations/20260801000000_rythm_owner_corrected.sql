-- ============================================================================
-- ProjectOps360° — Rythm: owner_corrected activity action
-- Migration: 20260801000000_rythm_owner_corrected.sql
--
-- Evidence fields (source_speaker / source_timestamp / source_excerpt) are stored
-- per item inside the project_rythm_intelligence jsonb arrays, so no column change
-- is needed. This only widens the activity-log action set for manual owner review.
-- ============================================================================

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
    'milestone_promoted', 'dependency_promoted', 'intelligence_applied',
    'owner_corrected'
  ));
