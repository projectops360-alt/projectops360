-- ============================================================================
-- ProjectOps360° — Rythm (Meeting Intelligence) — Foundational Infrastructure
-- Migration: 20260725000000_rythm_meeting_intelligence.sql
--
-- Rythm captures project meetings (in-person, video calls, uploaded audio),
-- stores the audio in a private bucket, and (in a later phase) transcribes and
-- summarizes them into searchable project memory.
--
-- THIS MIGRATION IS FOUNDATION ONLY:
--   • 4 tables: meetings, audio_files, transcripts, processing_jobs
--   • private storage bucket 'meeting-audio' + path-based RLS
--   • RLS aligned with the existing org-membership model (is_org_member)
--   • NO AssemblyAI / NO OpenAI wiring (transcript/job rows are scaffolding)
--
-- Design note on tenancy: the task spec lists project_id on every table. To
-- stay consistent with EVERY other table in this codebase (and to reuse the
-- is_org_member() RLS cornerstone without per-row subqueries) we additionally
-- carry organization_id. It is derived from the project at insert time.
-- ============================================================================

-- ──────────────────────────────────────────────
-- SECTION 0: Helper — can_access_project()
-- ──────────────────────────────────────────────
-- Resolves a project to its organization and checks membership. SECURITY
-- DEFINER so it can be used by storage.objects policies (whose path convention
-- carries only the project_id, not the organization_id).

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND public.is_org_member(p.organization_id)
  );
$$;

COMMENT ON FUNCTION public.can_access_project IS
  'Returns TRUE if auth.uid() can access the given project (member of its org). SECURITY DEFINER; used by Rythm table + storage RLS where only project_id is available.';

-- ──────────────────────────────────────────────
-- SECTION 1: project_rythm_meetings
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_rythm_meetings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title            text NOT NULL,
  meeting_type     text NOT NULL
                   CHECK (meeting_type IN ('in_person', 'video_call', 'uploaded_audio')),
  meeting_platform text,
  meeting_url      text,
  meeting_date     timestamptz,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN (
                     'draft', 'recording', 'audio_uploaded', 'ready_for_transcription',
                     'transcribing', 'transcribed', 'summary_ready', 'failed'
                   )),
  participants     jsonb NOT NULL DEFAULT '[]',
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rythm_meetings_project
  ON public.project_rythm_meetings (project_id, meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_rythm_meetings_org
  ON public.project_rythm_meetings (organization_id);
CREATE INDEX IF NOT EXISTS idx_rythm_meetings_status
  ON public.project_rythm_meetings (organization_id, status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_rythm_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.project_rythm_meetings IS
  'Rythm meeting record: one captured project meeting (in_person | video_call | uploaded_audio) and its lifecycle status.';

-- ──────────────────────────────────────────────
-- SECTION 2: project_rythm_audio_files
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_rythm_audio_files (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meeting_id       uuid NOT NULL REFERENCES public.project_rythm_meetings(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_bucket   text NOT NULL DEFAULT 'meeting-audio',
  storage_path     text NOT NULL,
  file_name        text NOT NULL,
  file_type        text NOT NULL,
  file_size        bigint,
  duration_seconds integer,
  source           text NOT NULL
                   CHECK (source IN ('browser_recording', 'manual_upload')),
  status           text NOT NULL DEFAULT 'uploaded'
                   CHECK (status IN (
                     'uploaded', 'ready_for_transcription', 'transcribing',
                     'transcribed', 'failed'
                   )),
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rythm_audio_meeting
  ON public.project_rythm_audio_files (meeting_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rythm_audio_org
  ON public.project_rythm_audio_files (organization_id);

COMMENT ON TABLE public.project_rythm_audio_files IS
  'Rythm audio asset: one stored recording/upload for a meeting. storage_path follows projects/{projectId}/rythm/{meetingId}/{timestamp}.{ext} in the meeting-audio bucket.';

-- ──────────────────────────────────────────────
-- SECTION 3: project_rythm_transcripts  (scaffolding — no provider yet)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_rythm_transcripts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meeting_id            uuid NOT NULL REFERENCES public.project_rythm_meetings(id) ON DELETE CASCADE,
  audio_file_id         uuid REFERENCES public.project_rythm_audio_files(id) ON DELETE SET NULL,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider              text,            -- TODO(Rythm): 'assemblyai' once wired
  provider_transcript_id text,
  language_code         text,
  full_text             text,
  utterances            jsonb NOT NULL DEFAULT '[]',
  raw_response          jsonb,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rythm_transcripts_meeting
  ON public.project_rythm_transcripts (meeting_id);
CREATE INDEX IF NOT EXISTS idx_rythm_transcripts_org
  ON public.project_rythm_transcripts (organization_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_rythm_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.project_rythm_transcripts IS
  'Rythm transcript scaffolding. Populated later by the transcription provider (AssemblyAI). One transcript per audio file / meeting.';

-- ──────────────────────────────────────────────
-- SECTION 4: project_rythm_processing_jobs  (scaffolding — no worker yet)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_rythm_processing_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meeting_id       uuid NOT NULL REFERENCES public.project_rythm_meetings(id) ON DELETE CASCADE,
  audio_file_id    uuid REFERENCES public.project_rythm_audio_files(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_type         text NOT NULL
                   CHECK (job_type IN ('transcription', 'summary', 'embedding')),
  provider         text,
  status           text NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  attempts         integer NOT NULL DEFAULT 0,
  error_message    text,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rythm_jobs_meeting
  ON public.project_rythm_processing_jobs (meeting_id);
CREATE INDEX IF NOT EXISTS idx_rythm_jobs_status
  ON public.project_rythm_processing_jobs (status, job_type);
CREATE INDEX IF NOT EXISTS idx_rythm_jobs_org
  ON public.project_rythm_processing_jobs (organization_id);

COMMENT ON TABLE public.project_rythm_processing_jobs IS
  'Rythm async pipeline queue. A transcription job is enqueued (status=queued) when audio becomes ready_for_transcription. The worker that drains this queue is added in a later phase.';

-- ──────────────────────────────────────────────
-- SECTION 5: Row Level Security (org-membership model)
-- ──────────────────────────────────────────────

ALTER TABLE public.project_rythm_meetings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rythm_audio_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rythm_transcripts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rythm_processing_jobs  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_rythm_meetings',
    'project_rythm_audio_files',
    'project_rythm_transcripts',
    'project_rythm_processing_jobs'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members insert %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members delete %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role %1$s" ON public.%1$s', t);

    EXECUTE format('CREATE POLICY "Members read %1$s"   ON public.%1$s FOR SELECT USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members insert %1$s" ON public.%1$s FOR INSERT WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members update %1$s" ON public.%1$s FOR UPDATE USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members delete %1$s" ON public.%1$s FOR DELETE USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Service role %1$s"   ON public.%1$s FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t);
  END LOOP;
END $$;

-- ──────────────────────────────────────────────
-- SECTION 6: Private storage bucket — meeting-audio
-- ──────────────────────────────────────────────
-- Path convention: projects/{projectId}/rythm/{meetingId}/{timestamp}.{ext}
-- foldername(name) = ['projects', projectId, 'rythm', meetingId]
-- Access is granted when the caller can access the project at index [2].

INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio', 'meeting-audio', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members upload meeting audio" ON storage.objects;
DROP POLICY IF EXISTS "Members read meeting audio"   ON storage.objects;
DROP POLICY IF EXISTS "Members delete meeting audio" ON storage.objects;

CREATE POLICY "Members upload meeting audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meeting-audio'
  AND (storage.foldername(name))[1] = 'projects'
  AND public.can_access_project(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Members read meeting audio"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'meeting-audio'
  AND (storage.foldername(name))[1] = 'projects'
  AND public.can_access_project(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Members delete meeting audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meeting-audio'
  AND (storage.foldername(name))[1] = 'projects'
  AND public.can_access_project(((storage.foldername(name))[2])::uuid)
);
