// ============================================================================
// rythmMeetingService — server-side data access for Rythm audio
// ============================================================================
// Audio capture is attached to the Rhythm Center meetings (public.meetings).
// These helpers receive an authenticated Supabase client + the caller's
// organization_id; RLS still applies and we scope explicitly as defence in
// depth. The server actions in the rhythm route wrap these with getOrgContext().
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RythmAudioFile, RythmJobType, RegisterRythmAudioInput } from "./types";

// A loosely-typed client is fine here — we don't have generated DB types wired.
type DB = SupabaseClient;

const AUDIO = "project_rythm_audio_files";
const JOBS = "project_rythm_processing_jobs";

const AUDIO_COLS =
  "id, meeting_id, project_id, storage_bucket, storage_path, file_name, file_type, file_size, duration_seconds, source, status, created_at";

interface AudioRow {
  id: string;
  meeting_id: string;
  project_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  duration_seconds: number | null;
  source: RythmAudioFile["source"];
  status: RythmAudioFile["status"];
  created_at: string;
}

function mapAudio(row: AudioRow): RythmAudioFile {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    projectId: row.project_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    durationSeconds: row.duration_seconds,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ── meetingBelongsToProject ────────────────────────────────────────────────────
// Validates that the Rhythm Center meeting exists in the caller's org + project.

export async function meetingBelongsToProject(
  supabase: DB,
  orgId: string,
  projectId: string,
  meetingId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("organization_id", orgId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// ── listAudioFiles ─────────────────────────────────────────────────────────────

export async function listAudioFiles(
  supabase: DB,
  orgId: string,
  meetingId: string,
): Promise<RythmAudioFile[]> {
  const { data, error } = await supabase
    .from(AUDIO)
    .select(AUDIO_COLS)
    .eq("organization_id", orgId)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as AudioRow[]).map(mapAudio);
}

// ── registerAudioFile ──────────────────────────────────────────────────────────
// Inserts the metadata row for a freshly-uploaded object.

export async function registerAudioFile(
  supabase: DB,
  orgId: string,
  userId: string | null,
  input: RegisterRythmAudioInput,
): Promise<RythmAudioFile> {
  const { data, error } = await supabase
    .from(AUDIO)
    .insert({
      organization_id: orgId,
      meeting_id: input.meetingId,
      project_id: input.projectId,
      storage_bucket: "meeting-audio",
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize ?? null,
      duration_seconds: input.durationSeconds ?? null,
      source: input.source,
      status: "uploaded",
      created_by: userId,
    })
    .select(AUDIO_COLS)
    .single();

  if (error) throw error;
  return mapAudio(data as AudioRow);
}

// ── createProcessingJob ────────────────────────────────────────────────────────
// Enqueues an async pipeline job (status=queued). No worker drains it yet.
// TODO(Rythm): a background worker will pick up queued 'transcription' jobs and
// call AssemblyAI, then enqueue 'summary' (OpenAI) and 'embedding' jobs.

export async function createProcessingJob(
  supabase: DB,
  orgId: string,
  input: {
    meetingId: string;
    audioFileId: string | null;
    projectId: string;
    jobType: RythmJobType;
  },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from(JOBS)
    .insert({
      organization_id: orgId,
      meeting_id: input.meetingId,
      audio_file_id: input.audioFileId,
      project_id: input.projectId,
      job_type: input.jobType,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as { id: string }).id };
}
