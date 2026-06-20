-- ============================================================================
-- Rythm — sample/test data
-- ============================================================================
-- Idempotent-ish seed: inserts a few sample meetings (+ one queued transcription
-- job) for the FIRST non-deleted project, using its organization and an existing
-- member as created_by. Run AFTER 20260725000000_rythm_meeting_intelligence.sql.
--
--   psql "$DATABASE_URL" -f supabase/seed_rythm_sample.sql
--
-- Safe to re-run: it skips projects that already have Rythm meetings.
-- ============================================================================

DO $$
DECLARE
  v_project_id uuid;
  v_org_id     uuid;
  v_user_id    uuid;
  v_meeting_1  uuid;
  v_meeting_2  uuid;
  v_meeting_3  uuid;
BEGIN
  SELECT p.id, p.organization_id
    INTO v_project_id, v_org_id
  FROM public.projects p
  WHERE p.deleted_at IS NULL
  ORDER BY p.created_at
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE NOTICE 'Rythm seed skipped: no projects found.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.project_rythm_meetings WHERE project_id = v_project_id) THEN
    RAISE NOTICE 'Rythm seed skipped: project % already has meetings.', v_project_id;
    RETURN;
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.organization_members
  WHERE organization_id = v_org_id
  LIMIT 1;

  -- 1) In-person meeting (draft)
  INSERT INTO public.project_rythm_meetings
    (organization_id, project_id, title, meeting_type, meeting_date, status, participants, created_by)
  VALUES
    (v_org_id, v_project_id, 'Weekly Coordination Meeting', 'in_person',
     now() - interval '2 days', 'draft',
     '[{"name":"Project Manager"},{"name":"Site Lead"},{"name":"Client Rep"}]'::jsonb,
     v_user_id)
  RETURNING id INTO v_meeting_1;

  -- 2) Video call (draft)
  INSERT INTO public.project_rythm_meetings
    (organization_id, project_id, title, meeting_type, meeting_platform, meeting_url, meeting_date, status, participants, created_by)
  VALUES
    (v_org_id, v_project_id, 'Stakeholder Review — Phase 2', 'video_call',
     'Zoom', 'https://example.zoom.us/j/000000000',
     now() - interval '5 days', 'draft',
     '[{"name":"Sponsor"},{"name":"Architect"}]'::jsonb,
     v_user_id)
  RETURNING id INTO v_meeting_2;

  -- 3) Uploaded audio meeting (ready_for_transcription) + audio row + queued job
  INSERT INTO public.project_rythm_meetings
    (organization_id, project_id, title, meeting_type, meeting_date, status, participants, created_by)
  VALUES
    (v_org_id, v_project_id, 'Subcontractor Kickoff (recorded)', 'uploaded_audio',
     now() - interval '1 day', 'ready_for_transcription',
     '[{"name":"PM"},{"name":"Electrical Sub"}]'::jsonb,
     v_user_id)
  RETURNING id INTO v_meeting_3;

  INSERT INTO public.project_rythm_audio_files
    (organization_id, meeting_id, project_id, storage_path, file_name, file_type, file_size, duration_seconds, source, status, created_by)
  VALUES
    (v_org_id, v_meeting_3, v_project_id,
     format('projects/%s/rythm/%s/sample.mp3', v_project_id, v_meeting_3),
     'subcontractor-kickoff.mp3', 'audio/mpeg', 4823000, 612,
     'manual_upload', 'ready_for_transcription', v_user_id);

  INSERT INTO public.project_rythm_processing_jobs
    (organization_id, meeting_id, audio_file_id, project_id, job_type, status)
  SELECT v_org_id, v_meeting_3, af.id, v_project_id, 'transcription', 'queued'
  FROM public.project_rythm_audio_files af
  WHERE af.meeting_id = v_meeting_3
  LIMIT 1;

  RAISE NOTICE 'Rythm seed inserted 3 meetings for project %.', v_project_id;
END $$;
