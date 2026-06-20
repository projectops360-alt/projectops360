-- ============================================================================
-- ProjectOps360° — Fold Rythm audio capture INTO the Rhythm Center
-- Migration: 20260726000000_rythm_audio_into_rhythm.sql
--
-- Original 20260725 created a standalone `project_rythm_meetings` table behind a
-- separate "Rythm" tab. Product decision: audio capture/transcription belongs to
-- the EXISTING Rhythm Center meetings (public.meetings), not a separate module.
--
-- This migration:
--   1. Clears the (test-only) rythm scaffolding rows.
--   2. Drops `project_rythm_meetings` (redundant — public.meetings is the source).
--   3. Repoints meeting_id on audio_files / transcripts / processing_jobs to
--      public.meetings(id). organization_id + project_id + RLS stay unchanged.
-- ============================================================================

-- 1. Clear test data (rows reference the table being dropped).
DELETE FROM public.project_rythm_processing_jobs;
DELETE FROM public.project_rythm_transcripts;
DELETE FROM public.project_rythm_audio_files;

-- 2. Drop the standalone meetings table (CASCADE removes its policies/indexes).
DROP TABLE IF EXISTS public.project_rythm_meetings CASCADE;

-- 3. Repoint meeting_id foreign keys to the Rhythm Center meetings table.
ALTER TABLE public.project_rythm_audio_files
  DROP CONSTRAINT IF EXISTS project_rythm_audio_files_meeting_id_fkey;
ALTER TABLE public.project_rythm_audio_files
  ADD CONSTRAINT project_rythm_audio_files_meeting_id_fkey
  FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;

ALTER TABLE public.project_rythm_transcripts
  DROP CONSTRAINT IF EXISTS project_rythm_transcripts_meeting_id_fkey;
ALTER TABLE public.project_rythm_transcripts
  ADD CONSTRAINT project_rythm_transcripts_meeting_id_fkey
  FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;

ALTER TABLE public.project_rythm_processing_jobs
  DROP CONSTRAINT IF EXISTS project_rythm_processing_jobs_meeting_id_fkey;
ALTER TABLE public.project_rythm_processing_jobs
  ADD CONSTRAINT project_rythm_processing_jobs_meeting_id_fkey
  FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.project_rythm_audio_files.meeting_id IS
  'References public.meetings(id) — the Rhythm Center meeting this audio belongs to.';
COMMENT ON COLUMN public.project_rythm_transcripts.meeting_id IS
  'References public.meetings(id) — the Rhythm Center meeting this transcript belongs to.';
COMMENT ON COLUMN public.project_rythm_processing_jobs.meeting_id IS
  'References public.meetings(id) — the Rhythm Center meeting this job belongs to.';
