-- ============================================================================
-- ProjectOps360° — Rythm processing readiness (pre-AssemblyAI)
-- Migration: 20260727000000_rythm_processing_readiness.sql
--
-- Prepares the controlled status workflow + queue + audit trail BEFORE any
-- AssemblyAI/OpenAI call. No external API is invoked anywhere.
--
--   1. Extend project_rythm_processing_jobs (priority, max_attempts, metadata,
--      created_by, updated_at; status adds 'cancelled').
--   2. Extend project_rythm_audio_files: status adds 'queued','processing';
--      source adds 'screen_recording'.
--   3. meetings.rythm_status — a Rythm-specific processing lifecycle column,
--      kept SEPARATE from the Rhythm Center's own meeting_status to avoid
--      mixing two state machines on one column.
--   4. New project_rythm_activity_log (audit trail) + RLS.
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. project_rythm_processing_jobs — extend
-- ──────────────────────────────────────────────

ALTER TABLE public.project_rythm_processing_jobs
  ADD COLUMN IF NOT EXISTS priority     integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS metadata     jsonb   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.project_rythm_processing_jobs
  DROP CONSTRAINT IF EXISTS project_rythm_processing_jobs_status_check;
ALTER TABLE public.project_rythm_processing_jobs
  ADD CONSTRAINT project_rythm_processing_jobs_status_check
  CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'));

DROP TRIGGER IF EXISTS set_updated_at ON public.project_rythm_processing_jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_rythm_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 2. project_rythm_audio_files — extend status + source
-- ──────────────────────────────────────────────

ALTER TABLE public.project_rythm_audio_files
  DROP CONSTRAINT IF EXISTS project_rythm_audio_files_status_check;
ALTER TABLE public.project_rythm_audio_files
  ADD CONSTRAINT project_rythm_audio_files_status_check
  CHECK (status IN (
    'uploaded', 'ready_for_transcription', 'queued',
    'processing', 'transcribing', 'transcribed', 'failed'
  ));

ALTER TABLE public.project_rythm_audio_files
  DROP CONSTRAINT IF EXISTS project_rythm_audio_files_source_check;
ALTER TABLE public.project_rythm_audio_files
  ADD CONSTRAINT project_rythm_audio_files_source_check
  CHECK (source IN ('browser_recording', 'screen_recording', 'manual_upload'));

-- ──────────────────────────────────────────────
-- 3. meetings.rythm_status — Rythm processing lifecycle (separate column)
-- ──────────────────────────────────────────────

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS rythm_status text;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_rythm_status_check;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_rythm_status_check
  CHECK (rythm_status IS NULL OR rythm_status IN (
    'draft', 'recording', 'audio_uploaded', 'ready_for_transcription',
    'transcribing_pending', 'transcribing', 'transcribed',
    'summary_pending', 'summary_ready', 'failed'
  ));

COMMENT ON COLUMN public.meetings.rythm_status IS
  'Rythm (Meeting Intelligence) processing lifecycle. NULL until audio processing starts. Kept separate from meeting_status (the Rhythm Center calendar lifecycle).';

-- ──────────────────────────────────────────────
-- 4. project_rythm_activity_log — audit trail
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_rythm_activity_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  meeting_id       uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  audio_file_id    uuid REFERENCES public.project_rythm_audio_files(id) ON DELETE SET NULL,
  job_id           uuid REFERENCES public.project_rythm_processing_jobs(id) ON DELETE SET NULL,
  action           text NOT NULL
                   CHECK (action IN (
                     'meeting_created', 'recording_started', 'recording_stopped',
                     'audio_uploaded', 'audio_prepared', 'transcription_queued',
                     'job_retried', 'job_cancelled', 'audio_deleted', 'validation_failed'
                   )),
  details          jsonb NOT NULL DEFAULT '{}',
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rythm_activity_meeting
  ON public.project_rythm_activity_log (meeting_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rythm_activity_org
  ON public.project_rythm_activity_log (organization_id);

COMMENT ON TABLE public.project_rythm_activity_log IS
  'Rythm audit trail: one row per meaningful action (recording, upload, prepare, queue, retry, cancel, delete, validation failure).';

-- ──────────────────────────────────────────────
-- 5. RLS for the activity log
-- ──────────────────────────────────────────────

ALTER TABLE public.project_rythm_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read project_rythm_activity_log"   ON public.project_rythm_activity_log;
DROP POLICY IF EXISTS "Members insert project_rythm_activity_log" ON public.project_rythm_activity_log;
DROP POLICY IF EXISTS "Service role project_rythm_activity_log"   ON public.project_rythm_activity_log;

CREATE POLICY "Members read project_rythm_activity_log"
  ON public.project_rythm_activity_log FOR SELECT
  USING (public.is_org_member(organization_id));
CREATE POLICY "Members insert project_rythm_activity_log"
  ON public.project_rythm_activity_log FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Service role project_rythm_activity_log"
  ON public.project_rythm_activity_log FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
