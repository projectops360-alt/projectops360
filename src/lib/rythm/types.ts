// ============================================================================
// Rythm (Meeting Intelligence) — shared types
// ============================================================================
// These mirror the columns created in
// supabase/migrations/20260725000000_rythm_meeting_intelligence.sql
// ============================================================================

export type RythmMeetingType = "in_person" | "video_call" | "uploaded_audio";

export type RythmMeetingStatus =
  | "draft"
  | "recording"
  | "audio_uploaded"
  | "ready_for_transcription"
  | "transcribing"
  | "transcribed"
  | "summary_ready"
  | "failed";

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

/** A meeting participant. Free-form for now (no FK); name is required. */
export interface RythmParticipant {
  name: string;
  email?: string;
  role?: string;
}

/** Camel-cased view of a project_rythm_meetings row. */
export interface RythmMeeting {
  id: string;
  projectId: string;
  title: string;
  meetingType: RythmMeetingType;
  meetingPlatform: string | null;
  meetingUrl: string | null;
  meetingDate: string | null;
  status: RythmMeetingStatus;
  participants: RythmParticipant[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export interface CreateRythmMeetingInput {
  projectId: string;
  title: string;
  meetingType: RythmMeetingType;
  meetingPlatform?: string | null;
  meetingUrl?: string | null;
  meetingDate?: string | null;
  participants?: RythmParticipant[];
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
