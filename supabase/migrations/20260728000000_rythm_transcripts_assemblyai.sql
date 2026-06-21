-- ============================================================================
-- ProjectOps360° — Rythm transcripts: AssemblyAI fields
-- Migration: 20260728000000_rythm_transcripts_assemblyai.sql
--
-- Extends project_rythm_transcripts with the fields produced by AssemblyAI and
-- widens the activity-log action set with the transcription lifecycle events.
-- ============================================================================

ALTER TABLE public.project_rythm_transcripts
  ADD COLUMN IF NOT EXISTS transcript_text  text,
  ADD COLUMN IF NOT EXISTS confidence       numeric,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.project_rythm_transcripts
  ALTER COLUMN provider SET DEFAULT 'assemblyai';

COMMENT ON COLUMN public.project_rythm_transcripts.transcript_text IS
  'Full plain-text transcript (AssemblyAI `text`).';
COMMENT ON COLUMN public.project_rythm_transcripts.utterances IS
  'AssemblyAI utterances: [{ speaker, text, start, end, confidence }].';
COMMENT ON COLUMN public.project_rythm_transcripts.confidence IS
  'Overall transcript confidence (0..1) from AssemblyAI.';

-- Widen activity-log actions with the transcription lifecycle.
ALTER TABLE public.project_rythm_activity_log
  DROP CONSTRAINT IF EXISTS project_rythm_activity_log_action_check;
ALTER TABLE public.project_rythm_activity_log
  ADD CONSTRAINT project_rythm_activity_log_action_check
  CHECK (action IN (
    'meeting_created', 'recording_started', 'recording_stopped',
    'audio_uploaded', 'audio_prepared', 'transcription_queued',
    'transcription_started', 'transcription_completed', 'transcription_failed',
    'transcription_retried', 'job_retried', 'job_cancelled',
    'audio_deleted', 'validation_failed'
  ));
