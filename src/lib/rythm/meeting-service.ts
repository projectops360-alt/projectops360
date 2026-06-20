// ============================================================================
// rythmMeetingService — server-side data access for Rythm
// ============================================================================
// Pure-ish data layer: every function receives an authenticated Supabase client
// + the caller's organization_id. RLS still applies (these run with the user's
// session), and we scope explicitly by organization_id / project_id as defence
// in depth. The server actions in the route wrap these with getOrgContext().
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RythmMeeting,
  RythmAudioFile,
  RythmParticipant,
  CreateRythmMeetingInput,
  RythmMeetingStatus,
  RythmJobType,
  RegisterRythmAudioInput,
} from "./types";

// A loosely-typed client is fine here — we don't have generated DB types wired.
type DB = SupabaseClient;

const MEETINGS = "project_rythm_meetings";
const AUDIO = "project_rythm_audio_files";
const JOBS = "project_rythm_processing_jobs";

// ── Row → view mappers ─────────────────────────────────────────────────────────

interface MeetingRow {
  id: string;
  project_id: string;
  title: string;
  meeting_type: RythmMeeting["meetingType"];
  meeting_platform: string | null;
  meeting_url: string | null;
  meeting_date: string | null;
  status: RythmMeetingStatus;
  participants: RythmParticipant[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapMeeting(row: MeetingRow): RythmMeeting {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    meetingType: row.meeting_type,
    meetingPlatform: row.meeting_platform,
    meetingUrl: row.meeting_url,
    meetingDate: row.meeting_date,
    status: row.status,
    participants: Array.isArray(row.participants) ? row.participants : [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

const MEETING_COLS =
  "id, project_id, title, meeting_type, meeting_platform, meeting_url, meeting_date, status, participants, created_by, created_at, updated_at";
const AUDIO_COLS =
  "id, meeting_id, project_id, storage_bucket, storage_path, file_name, file_type, file_size, duration_seconds, source, status, created_at";

// ── createRythmMeeting ─────────────────────────────────────────────────────────

export async function createRythmMeeting(
  supabase: DB,
  orgId: string,
  userId: string | null,
  input: CreateRythmMeetingInput,
): Promise<RythmMeeting> {
  const { data, error } = await supabase
    .from(MEETINGS)
    .insert({
      organization_id: orgId,
      project_id: input.projectId,
      title: input.title,
      meeting_type: input.meetingType,
      meeting_platform: input.meetingPlatform ?? null,
      meeting_url: input.meetingUrl ?? null,
      meeting_date: input.meetingDate ?? null,
      participants: input.participants ?? [],
      status: "draft",
      created_by: userId,
    })
    .select(MEETING_COLS)
    .single();

  if (error) throw error;
  return mapMeeting(data as MeetingRow);
}

// ── listRythmMeetings ──────────────────────────────────────────────────────────

export async function listRythmMeetings(
  supabase: DB,
  orgId: string,
  projectId: string,
): Promise<RythmMeeting[]> {
  const { data, error } = await supabase
    .from(MEETINGS)
    .select(MEETING_COLS)
    .eq("organization_id", orgId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data as MeetingRow[]).map(mapMeeting);
}

// ── getRythmMeeting ────────────────────────────────────────────────────────────

export async function getRythmMeeting(
  supabase: DB,
  orgId: string,
  meetingId: string,
): Promise<RythmMeeting | null> {
  const { data, error } = await supabase
    .from(MEETINGS)
    .select(MEETING_COLS)
    .eq("organization_id", orgId)
    .eq("id", meetingId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapMeeting(data as MeetingRow) : null;
}

// ── updateMeetingStatus ────────────────────────────────────────────────────────

export async function updateMeetingStatus(
  supabase: DB,
  orgId: string,
  meetingId: string,
  status: RythmMeetingStatus,
): Promise<void> {
  const { error } = await supabase
    .from(MEETINGS)
    .update({ status })
    .eq("organization_id", orgId)
    .eq("id", meetingId);
  if (error) throw error;
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
      status: "ready_for_transcription",
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
