// ============================================================================
// rythmProcessingService — controlled status workflow + queue (pre-AssemblyAI)
// ============================================================================
// No external API is called here. Jobs are created with provider 'assemblyai'
// as the PLANNED provider; a worker that actually drains them is a later phase.
// Every function receives an authenticated Supabase client + the caller's
// organization_id; RLS applies and we scope explicitly as defence in depth.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RYTHM_MAX_AUDIO_BYTES,
  RYTHM_TRANSCRIBE_MIME,
  RYTHM_TRANSCRIBE_PROVIDER,
  type RythmAudioFile,
  type RythmAudioStatus,
  type RythmProcessingJob,
  type RythmJobType,
  type RythmMeetingStatus,
} from "./types";

type DB = SupabaseClient;

const AUDIO = "project_rythm_audio_files";
const JOBS = "project_rythm_processing_jobs";

const AUDIO_COLS =
  "id, meeting_id, project_id, storage_bucket, storage_path, file_name, file_type, file_size, duration_seconds, source, status, created_at";
const JOB_COLS =
  "id, meeting_id, audio_file_id, project_id, job_type, provider, status, priority, attempts, max_attempts, error_message, metadata, started_at, completed_at, created_at";

// ── Mappers ────────────────────────────────────────────────────────────────────

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
  status: RythmAudioStatus;
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

interface JobRow {
  id: string;
  meeting_id: string;
  audio_file_id: string | null;
  project_id: string;
  job_type: RythmJobType;
  provider: string | null;
  status: RythmProcessingJob["status"];
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function mapJob(row: JobRow): RythmProcessingJob {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    audioFileId: row.audio_file_id,
    projectId: row.project_id,
    jobType: row.job_type,
    provider: row.provider,
    status: row.status,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    errorMessage: row.error_message,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function getAudioFile(
  supabase: DB,
  orgId: string,
  audioFileId: string,
): Promise<RythmAudioFile | null> {
  const { data, error } = await supabase
    .from(AUDIO)
    .select(AUDIO_COLS)
    .eq("organization_id", orgId)
    .eq("id", audioFileId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAudio(data as AudioRow) : null;
}

async function getJob(supabase: DB, orgId: string, jobId: string): Promise<RythmProcessingJob | null> {
  const { data, error } = await supabase
    .from(JOBS)
    .select(JOB_COLS)
    .eq("organization_id", orgId)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapJob(data as JobRow) : null;
}

async function setAudioStatus(
  supabase: DB,
  orgId: string,
  audioFileId: string,
  status: RythmAudioStatus,
): Promise<void> {
  const { error } = await supabase
    .from(AUDIO)
    .update({ status })
    .eq("organization_id", orgId)
    .eq("id", audioFileId);
  if (error) throw error;
}

export async function setMeetingRythmStatus(
  supabase: DB,
  orgId: string,
  meetingId: string,
  status: RythmMeetingStatus,
): Promise<void> {
  const { error } = await supabase
    .from("meetings")
    .update({ rythm_status: status })
    .eq("organization_id", orgId)
    .eq("id", meetingId);
  if (error) console.error("setMeetingRythmStatus failed:", error.message);
}

// ── Validation ─────────────────────────────────────────────────────────────────

export type ValidationResult = { ok: true } | { ok: false; errorKey: string; unusable: boolean };

/** Validates an audio file is eligible to be queued for transcription. */
export function validateAudioForTranscription(audio: RythmAudioFile): ValidationResult {
  if (!audio.storagePath) return { ok: false, errorKey: "errorMissingStorage", unusable: true };
  if (!audio.fileName) return { ok: false, errorKey: "errorMissingFileName", unusable: true };
  if (!audio.fileType) return { ok: false, errorKey: "errorMissingFileType", unusable: true };
  if (!audio.meetingId || !audio.projectId)
    return { ok: false, errorKey: "errorMissingLinks", unusable: true };
  if (!audio.fileSize || audio.fileSize <= 0)
    return { ok: false, errorKey: "errorEmptyFile", unusable: true };
  if (audio.fileSize > RYTHM_MAX_AUDIO_BYTES)
    return { ok: false, errorKey: "errorTooLarge", unusable: true };
  if (!RYTHM_TRANSCRIBE_MIME.includes(audio.fileType))
    return { ok: false, errorKey: "errorUnsupportedType", unusable: true };
  // Status gate is recoverable (not an unusable file).
  if (audio.status !== "uploaded" && audio.status !== "ready_for_transcription")
    return { ok: false, errorKey: "errorBadStatus", unusable: false };
  return { ok: true };
}

// ── Public service methods ───────────────────────────────────────────────────────

export async function validateAudioForTranscriptionById(
  supabase: DB,
  orgId: string,
  audioFileId: string,
): Promise<{ audio: RythmAudioFile | null; validation: ValidationResult }> {
  const audio = await getAudioFile(supabase, orgId, audioFileId);
  if (!audio) return { audio: null, validation: { ok: false, errorKey: "audio_not_found", unusable: false } };
  return { audio, validation: validateAudioForTranscription(audio) };
}

/** Validates + moves an asset to ready_for_transcription. */
export async function prepareAudioForTranscription(
  supabase: DB,
  orgId: string,
  audioFileId: string,
): Promise<{ ok: boolean; errorKey?: string; markedFailed?: boolean; audio?: RythmAudioFile }> {
  const { audio, validation } = await validateAudioForTranscriptionById(supabase, orgId, audioFileId);
  if (!audio) return { ok: false, errorKey: "audio_not_found" };

  if (!validation.ok) {
    // Only flag the file as failed when it is genuinely unusable.
    if (validation.unusable) {
      await setAudioStatus(supabase, orgId, audioFileId, "failed");
      return { ok: false, errorKey: validation.errorKey, markedFailed: true };
    }
    return { ok: false, errorKey: validation.errorKey };
  }

  await setAudioStatus(supabase, orgId, audioFileId, "ready_for_transcription");
  return { ok: true, audio };
}

/** Validates + enqueues a transcription job (queued), advancing statuses. */
export async function queueTranscriptionJob(
  supabase: DB,
  orgId: string,
  userId: string | null,
  audioFileId: string,
): Promise<{
  ok: boolean;
  jobId?: string;
  errorKey?: string;
  markedFailed?: boolean;
  meetingId?: string;
  projectId?: string;
}> {
  const { audio, validation } = await validateAudioForTranscriptionById(supabase, orgId, audioFileId);
  if (!audio) return { ok: false, errorKey: "audio_not_found" };

  if (!validation.ok) {
    if (validation.unusable) {
      await setAudioStatus(supabase, orgId, audioFileId, "failed");
      return {
        ok: false,
        errorKey: validation.errorKey,
        markedFailed: true,
        meetingId: audio.meetingId,
        projectId: audio.projectId,
      };
    }
    return { ok: false, errorKey: validation.errorKey, meetingId: audio.meetingId, projectId: audio.projectId };
  }

  const { data, error } = await supabase
    .from(JOBS)
    .insert({
      organization_id: orgId,
      meeting_id: audio.meetingId,
      audio_file_id: audio.id,
      project_id: audio.projectId,
      job_type: "transcription",
      provider: RYTHM_TRANSCRIBE_PROVIDER, // planned provider — NOT called yet
      status: "queued",
      priority: 5,
      max_attempts: 3,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, errorKey: "queue_failed" };

  await setAudioStatus(supabase, orgId, audioFileId, "queued");
  await setMeetingRythmStatus(supabase, orgId, audio.meetingId, "transcribing_pending");

  return {
    ok: true,
    jobId: (data as { id: string }).id,
    meetingId: audio.meetingId,
    projectId: audio.projectId,
  };
}

export async function getProcessingJobs(
  supabase: DB,
  orgId: string,
  meetingId: string,
): Promise<RythmProcessingJob[]> {
  const { data, error } = await supabase
    .from(JOBS)
    .select(JOB_COLS)
    .eq("organization_id", orgId)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as JobRow[]).map(mapJob);
}

export async function getLatestProcessingJob(
  supabase: DB,
  orgId: string,
  audioFileId: string,
  jobType: RythmJobType,
): Promise<RythmProcessingJob | null> {
  const { data, error } = await supabase
    .from(JOBS)
    .select(JOB_COLS)
    .eq("organization_id", orgId)
    .eq("audio_file_id", audioFileId)
    .eq("job_type", jobType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapJob(data as JobRow) : null;
}

/** Resets a failed job back to queued (re-attempt). */
export async function retryProcessingJob(
  supabase: DB,
  orgId: string,
  jobId: string,
): Promise<{
  ok: boolean;
  errorKey?: string;
  audioFileId?: string | null;
  projectId?: string;
  meetingId?: string;
}> {
  const job = await getJob(supabase, orgId, jobId);
  if (!job) return { ok: false, errorKey: "job_not_found" };
  if (job.status !== "failed") return { ok: false, errorKey: "job_not_failed" };
  if (job.attempts >= job.maxAttempts) return { ok: false, errorKey: "max_attempts_reached" };

  const { error } = await supabase
    .from(JOBS)
    .update({ status: "queued", error_message: null, started_at: null, completed_at: null })
    .eq("organization_id", orgId)
    .eq("id", jobId);
  if (error) return { ok: false, errorKey: "retry_failed" };

  if (job.audioFileId) await setAudioStatus(supabase, orgId, job.audioFileId, "queued");
  return { ok: true, audioFileId: job.audioFileId, projectId: job.projectId, meetingId: job.meetingId };
}

/** Cancels a queued/running job. */
export async function cancelProcessingJob(
  supabase: DB,
  orgId: string,
  jobId: string,
): Promise<{
  ok: boolean;
  errorKey?: string;
  audioFileId?: string | null;
  projectId?: string;
  meetingId?: string;
}> {
  const job = await getJob(supabase, orgId, jobId);
  if (!job) return { ok: false, errorKey: "job_not_found" };
  if (job.status !== "queued" && job.status !== "running")
    return { ok: false, errorKey: "job_not_cancellable" };

  const { error } = await supabase
    .from(JOBS)
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("id", jobId);
  if (error) return { ok: false, errorKey: "cancel_failed" };

  // Return the asset to a ready state so it can be re-queued.
  if (job.audioFileId) await setAudioStatus(supabase, orgId, job.audioFileId, "ready_for_transcription");
  return { ok: true, audioFileId: job.audioFileId, projectId: job.projectId, meetingId: job.meetingId };
}

/** Deletes the storage object + metadata row (meeting is untouched). */
export async function deleteAudioAsset(
  supabase: DB,
  orgId: string,
  audioFileId: string,
): Promise<{ ok: boolean; errorKey?: string; projectId?: string; meetingId?: string }> {
  const audio = await getAudioFile(supabase, orgId, audioFileId);
  if (!audio) return { ok: false, errorKey: "audio_not_found" };

  const { error: removeError } = await supabase.storage
    .from(audio.storageBucket)
    .remove([audio.storagePath]);
  if (removeError) console.error("delete audio object failed:", removeError.message);

  const { error: deleteError } = await supabase
    .from(AUDIO)
    .delete()
    .eq("organization_id", orgId)
    .eq("id", audioFileId);
  if (deleteError) return { ok: false, errorKey: "delete_failed" };

  return { ok: true, projectId: audio.projectId, meetingId: audio.meetingId };
}
