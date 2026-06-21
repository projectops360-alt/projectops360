// ============================================================================
// Rythm audio capture + processing — shared types
// ============================================================================
// Audio/transcripts/jobs attach to the Rhythm Center meetings (public.meetings).
// Mirrors columns in:
//   supabase/migrations/20260725000000_rythm_meeting_intelligence.sql
//   supabase/migrations/20260726000000_rythm_audio_into_rhythm.sql
//   supabase/migrations/20260727000000_rythm_processing_readiness.sql
// ============================================================================

export type RythmAudioSource = "browser_recording" | "screen_recording" | "manual_upload";

export type RythmAudioStatus =
  | "uploaded"
  | "ready_for_transcription"
  | "queued"
  | "processing"
  | "transcribing"
  | "transcribed"
  | "failed";

export type RythmTranscriptStatus = "pending" | "processing" | "completed" | "failed";

export interface RythmTranscriptUtterance {
  speaker: string;
  text: string;
  start: number; // ms
  end: number; // ms
  confidence: number;
}

/** Camel-cased view of a project_rythm_transcripts row. */
export interface RythmTranscript {
  id: string;
  meetingId: string;
  audioFileId: string | null;
  provider: string | null;
  providerTranscriptId: string | null;
  languageCode: string | null;
  transcriptText: string | null;
  utterances: RythmTranscriptUtterance[];
  confidence: number | null;
  durationSeconds: number | null;
  status: RythmTranscriptStatus;
  errorMessage: string | null;
  speakerCount: number;
  createdAt: string;
  updatedAt: string;
}

export type RythmJobType = "transcription" | "summary" | "embedding";
export type RythmJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

/** Rythm processing lifecycle on the meeting (meetings.rythm_status). */
export type RythmMeetingStatus =
  | "draft"
  | "recording"
  | "audio_uploaded"
  | "ready_for_transcription"
  | "transcribing_pending"
  | "transcribing"
  | "transcribed"
  | "summary_pending"
  | "summary_ready"
  | "failed";

export type RythmActivityAction =
  | "meeting_created"
  | "recording_started"
  | "recording_stopped"
  | "audio_uploaded"
  | "audio_prepared"
  | "transcription_queued"
  | "transcription_started"
  | "transcription_completed"
  | "transcription_failed"
  | "transcription_retried"
  | "job_retried"
  | "job_cancelled"
  | "audio_deleted"
  | "validation_failed";

/** Camel-cased view of a project_rythm_audio_files row. */
export interface RythmAudioFile {
  id: string;
  meetingId: string;
  projectId: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  durationSeconds: number | null;
  source: RythmAudioSource;
  status: RythmAudioStatus;
  createdAt: string;
}

/** Camel-cased view of a project_rythm_processing_jobs row. */
export interface RythmProcessingJob {
  id: string;
  meetingId: string;
  audioFileId: string | null;
  projectId: string;
  jobType: RythmJobType;
  provider: string | null;
  status: RythmJobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Metadata the client gathers after a successful storage upload, before the
 *  server inserts the audio-file row. */
export interface RegisterRythmAudioInput {
  projectId: string;
  meetingId: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  durationSeconds?: number | null;
  source: RythmAudioSource;
}

// ── Storage constants ────────────────────────────────────────────────────────

export const RYTHM_AUDIO_BUCKET = "meeting-audio";

/** Hard ceiling for a single audio asset (matches UI copy + validation). */
export const RYTHM_MAX_AUDIO_BYTES = 500 * 1024 * 1024; // 500 MB

/** Accepted upload extensions / mime hints. */
export const RYTHM_ACCEPTED_EXTENSIONS = ["mp3", "wav", "m4a", "mp4", "webm"] as const;
export const RYTHM_ACCEPTED_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/webm",
  "video/mp4", // some .mp4 audio recordings report a video container
  "video/webm", // screen + system-audio recordings
];

/** Mime types accepted for transcription queueing (validation gate). */
export const RYTHM_TRANSCRIBE_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/webm",
  "video/mp4",
  "video/webm", // screen recordings (extension over the base spec list)
];

/** Planned transcription provider — wired in a later phase (no API call yet). */
export const RYTHM_TRANSCRIBE_PROVIDER = "assemblyai";
