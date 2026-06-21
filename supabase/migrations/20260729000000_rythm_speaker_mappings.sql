-- ============================================================================
-- ProjectOps360° — Rythm Speaker Attribution
-- Migration: 20260729000000_rythm_speaker_mappings.sql
--
-- Maps generic AssemblyAI speaker labels ("A", "B") to real participants.
-- meeting_id references public.meetings (the Rhythm Center meeting); the
-- original spec's project_rythm_meetings table was consolidated into meetings.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_rythm_speaker_mappings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id               uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  meeting_id               uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  transcript_id            uuid REFERENCES public.project_rythm_transcripts(id) ON DELETE CASCADE,
  original_speaker_label   text NOT NULL,
  mapped_participant_name  text NOT NULL,
  mapped_participant_email text,
  confidence               text NOT NULL DEFAULT 'manual',
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rythm_speaker_map UNIQUE (meeting_id, transcript_id, original_speaker_label)
);

CREATE INDEX IF NOT EXISTS idx_rythm_speaker_map_meeting
  ON public.project_rythm_speaker_mappings (meeting_id, transcript_id);
CREATE INDEX IF NOT EXISTS idx_rythm_speaker_map_org
  ON public.project_rythm_speaker_mappings (organization_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_rythm_speaker_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.project_rythm_speaker_mappings IS
  'Maps a transcript''s generic speaker labels (A/B/C) to real participant names/emails.';

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.project_rythm_speaker_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read project_rythm_speaker_mappings"   ON public.project_rythm_speaker_mappings;
DROP POLICY IF EXISTS "Members insert project_rythm_speaker_mappings" ON public.project_rythm_speaker_mappings;
DROP POLICY IF EXISTS "Members update project_rythm_speaker_mappings" ON public.project_rythm_speaker_mappings;
DROP POLICY IF EXISTS "Members delete project_rythm_speaker_mappings" ON public.project_rythm_speaker_mappings;
DROP POLICY IF EXISTS "Service role project_rythm_speaker_mappings"   ON public.project_rythm_speaker_mappings;

CREATE POLICY "Members read project_rythm_speaker_mappings"
  ON public.project_rythm_speaker_mappings FOR SELECT
  USING (public.is_org_member(organization_id));
CREATE POLICY "Members insert project_rythm_speaker_mappings"
  ON public.project_rythm_speaker_mappings FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members update project_rythm_speaker_mappings"
  ON public.project_rythm_speaker_mappings FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members delete project_rythm_speaker_mappings"
  ON public.project_rythm_speaker_mappings FOR DELETE
  USING (public.is_org_member(organization_id));
CREATE POLICY "Service role project_rythm_speaker_mappings"
  ON public.project_rythm_speaker_mappings FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── Activity log: new actions ──────────────────────────────────────────────
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
    'speaker_mapping_saved', 'speaker_mapping_reset'
  ));
