// ============================================================================
// Rythm audio capture — shared types
// ============================================================================
// Audio/transcripts/jobs attach to the Rhythm Center meetings (public.meetings).
// Mirrors columns in:
//   supabase/migrations/20260725000000_rythm_meeting_intelligence.sql
//   supabase/migrations/20260726000000_rythm_audio_into_rhythm.sql
// ============================================================================

export type RythmAudioSource = "browser_recording" | "manual_upload";

export type RythmAudioStatus =
  | "uploaded"
  | "ready_for_transcription"
  | "transcribing"
  | "transcribed"
  | "failed";

export type RythmTranscriptStatus = "pending" | "processing" | "completed" | "failed";

export type RythmJobType = "transcription" | "summary" | "embedding";
export type RythmJobStatus = "queued" | "running" | "completed" | "failed";

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

/** Hard ceiling for a single audio asset (matches UI copy). */
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
];
