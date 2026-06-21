// ============================================================================
// transcription-service — orchestrates AssemblyAI transcription (SERVER-ONLY)
// ============================================================================
// Submits a job, then is polled (from the client) until AssemblyAI finishes.
// Persists transcripts + drives the audio / meeting / job status workflow.
// Imports assemblyai-service which reads ASSEMBLYAI_API_KEY — server-only.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTranscript, getTranscript } from "./assemblyai-service";
import { setMeetingRythmStatus } from "./processing-service";
import {
  RYTHM_MAX_AUDIO_BYTES,
  RYTHM_TRANSCRIBE_MIME,
  RYTHM_TRANSCRIBE_PROVIDER,
  type RythmTranscript,
  type RythmTranscriptUtterance,
  type RythmTranscriptStatus,
} from "./types";

type DB = SupabaseClient;
const AUDIO = "project_rythm_audio_files";
const JOBS = "project_rythm_processing_jobs";
const TRANS = "project_rythm_transcripts";

interface SubmitResult {
  ok: boolean;
  errorKey?: string;
  markedFailed?: boolean;
  jobId?: string;
  transcriptId?: string;
  meetingId?: string;
  projectId?: string;
}

interface PollResult {
  status: "processing" | "completed" | "failed";
  errorKey?: string;
  error?: string | null;
  meetingId?: string;
  projectId?: string;
}

async function setAudioStatus(supabase: DB, orgId: string, audioFileId: string, status: string) {
  await supabase.from(AUDIO).update({ status }).eq("organization_id", orgId).eq("id", audioFileId);
}

// ── submitTranscription ──────────────────────────────────────────────────────
// Validates, creates the job + transcript rows, kicks off AssemblyAI, and moves
// statuses to processing/transcribing. A new job/transcript is always created
// (retries keep history — previous transcripts are never overwritten).

export async function submitTranscription(
  supabase: DB,
  orgId: string,
  userId: string | null,
  audioFileId: string,
): Promise<SubmitResult> {
  const { data: audio, error: audioErr } = await supabase
    .from(AUDIO)
    .select("id, meeting_id, project_id, storage_bucket, storage_path, file_type, file_size, status")
    .eq("organization_id", orgId)
    .eq("id", audioFileId)
    .maybeSingle();
  if (audioErr || !audio) return { ok: false, errorKey: "audio_not_found" };

  const meetingId = audio.meeting_id as string;
  const projectId = audio.project_id as string;

  const failUnusable = async (errorKey: string): Promise<SubmitResult> => {
    await setAudioStatus(supabase, orgId, audioFileId, "failed");
    return { ok: false, errorKey, markedFailed: true, meetingId, projectId };
  };

  // ── Validation (unusable files are flagged failed) ──
  if (!audio.storage_path) return failUnusable("errorMissingStorage");
  if (!audio.file_size || audio.file_size <= 0) return failUnusable("errorEmptyFile");
  if (audio.file_size > RYTHM_MAX_AUDIO_BYTES) return failUnusable("errorTooLarge");
  if (!audio.file_type || !RYTHM_TRANSCRIBE_MIME.includes(audio.file_type))
    return failUnusable("errorUnsupportedType");
  // Recoverable gate: allow fresh uploads, prepared assets, or retries of failures.
  if (!["uploaded", "ready_for_transcription", "failed"].includes(audio.status))
    return { ok: false, errorKey: "errorBadStatus", meetingId, projectId };

  // ── Create the job (queued) ──
  const { data: jobRow, error: jobErr } = await supabase
    .from(JOBS)
    .insert({
      organization_id: orgId,
      meeting_id: meetingId,
      audio_file_id: audioFileId,
      project_id: projectId,
      job_type: "transcription",
      provider: RYTHM_TRANSCRIBE_PROVIDER,
      status: "queued",
      priority: 5,
      max_attempts: 3,
      attempts: 1,
      created_by: userId,
    })
    .select("id")
    .single();
  if (jobErr || !jobRow) return { ok: false, errorKey: "queue_failed", meetingId, projectId };
  const jobId = jobRow.id as string;

  // Move audio → processing, meeting → transcribing.
  await setAudioStatus(supabase, orgId, audioFileId, "processing");
  await setMeetingRythmStatus(supabase, orgId, meetingId, "transcribing");

  try {
    // Private object → short-lived signed URL AssemblyAI can fetch.
    const { data: signed, error: signErr } = await supabase.storage
      .from(audio.storage_bucket as string)
      .createSignedUrl(audio.storage_path as string, 60 * 60);
    if (signErr || !signed) throw new Error("sign_failed");

    const at = await createTranscript(signed.signedUrl);

    const { data: transRow, error: transErr } = await supabase
      .from(TRANS)
      .insert({
        organization_id: orgId,
        meeting_id: meetingId,
        audio_file_id: audioFileId,
        project_id: projectId,
        provider: RYTHM_TRANSCRIBE_PROVIDER,
        provider_transcript_id: at.id,
        status: "processing",
      })
      .select("id")
      .single();
    if (transErr || !transRow) throw new Error("transcript_row_failed");

    await supabase
      .from(JOBS)
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        metadata: { provider_transcript_id: at.id, transcript_row_id: transRow.id },
      })
      .eq("organization_id", orgId)
      .eq("id", jobId);

    return { ok: true, jobId, transcriptId: transRow.id as string, meetingId, projectId };
  } catch (err) {
    console.error("submitTranscription failed:", err);
    await failJob(supabase, orgId, jobId, audioFileId, meetingId, "submit failed");
    return { ok: false, errorKey: "assemblyai_failed", jobId, meetingId, projectId };
  }
}

// ── pollTranscription ────────────────────────────────────────────────────────

export async function pollTranscription(
  supabase: DB,
  orgId: string,
  jobId: string,
): Promise<PollResult> {
  const { data: job, error } = await supabase
    .from(JOBS)
    .select("id, status, audio_file_id, meeting_id, project_id, metadata")
    .eq("organization_id", orgId)
    .eq("id", jobId)
    .maybeSingle();
  if (error || !job) return { status: "failed", errorKey: "job_not_found" };

  const meetingId = job.meeting_id as string;
  const projectId = job.project_id as string;
  const audioFileId = job.audio_file_id as string | null;

  if (job.status === "completed") return { status: "completed", meetingId, projectId };
  if (job.status === "failed" || job.status === "cancelled")
    return { status: "failed", meetingId, projectId };

  const meta = (job.metadata ?? {}) as { provider_transcript_id?: string; transcript_row_id?: string };
  if (!meta.provider_transcript_id)
    return { status: "failed", errorKey: "missing_transcript_id", meetingId, projectId };

  let at;
  try {
    at = await getTranscript(meta.provider_transcript_id);
  } catch (err) {
    // Transient fetch error — keep processing; the next poll will retry.
    console.error("getTranscript poll error:", err);
    return { status: "processing", meetingId, projectId };
  }

  if (at.status === "queued" || at.status === "processing")
    return { status: "processing", meetingId, projectId };

  if (at.status === "completed") {
    if (meta.transcript_row_id) {
      await supabase
        .from(TRANS)
        .update({
          transcript_text: at.text,
          utterances: at.utterances ?? [],
          confidence: at.confidence,
          duration_seconds: at.audio_duration != null ? Math.round(at.audio_duration) : null,
          language_code: at.language_code,
          raw_response: at.raw,
          status: "completed",
          error_message: null,
        })
        .eq("organization_id", orgId)
        .eq("id", meta.transcript_row_id);
    }
    if (audioFileId) await setAudioStatus(supabase, orgId, audioFileId, "transcribed");
    await setMeetingRythmStatus(supabase, orgId, meetingId, "transcribed");
    await supabase
      .from(JOBS)
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("id", jobId);
    return { status: "completed", meetingId, projectId };
  }

  // status === 'error'
  if (meta.transcript_row_id) {
    await supabase
      .from(TRANS)
      .update({ status: "failed", error_message: at.error, raw_response: at.raw })
      .eq("organization_id", orgId)
      .eq("id", meta.transcript_row_id);
  }
  await failJob(supabase, orgId, jobId, audioFileId, meetingId, at.error ?? "AssemblyAI error");
  return { status: "failed", errorKey: "assemblyai_error", error: at.error, meetingId, projectId };
}

async function failJob(
  supabase: DB,
  orgId: string,
  jobId: string,
  audioFileId: string | null,
  meetingId: string,
  message: string,
) {
  await supabase
    .from(JOBS)
    .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("id", jobId);
  if (audioFileId) await setAudioStatus(supabase, orgId, audioFileId, "failed");
  await setMeetingRythmStatus(supabase, orgId, meetingId, "failed");
}

// ── getMeetingTranscript — latest transcript for the viewer ──────────────────

interface TranscriptRow {
  id: string;
  meeting_id: string;
  audio_file_id: string | null;
  provider: string | null;
  provider_transcript_id: string | null;
  language_code: string | null;
  transcript_text: string | null;
  utterances: RythmTranscriptUtterance[] | null;
  confidence: number | null;
  duration_seconds: number | null;
  status: RythmTranscriptStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMeetingTranscript(
  supabase: DB,
  orgId: string,
  meetingId: string,
): Promise<RythmTranscript | null> {
  const { data, error } = await supabase
    .from(TRANS)
    .select(
      "id, meeting_id, audio_file_id, provider, provider_transcript_id, language_code, transcript_text, utterances, confidence, duration_seconds, status, error_message, created_at, updated_at",
    )
    .eq("organization_id", orgId)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as TranscriptRow;
  const utterances = Array.isArray(row.utterances) ? row.utterances : [];
  const speakers = new Set(utterances.map((u) => u.speaker));
  return {
    id: row.id,
    meetingId: row.meeting_id,
    audioFileId: row.audio_file_id,
    provider: row.provider,
    providerTranscriptId: row.provider_transcript_id,
    languageCode: row.language_code,
    transcriptText: row.transcript_text,
    utterances,
    confidence: row.confidence,
    durationSeconds: row.duration_seconds,
    status: row.status,
    errorMessage: row.error_message,
    speakerCount: speakers.size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
