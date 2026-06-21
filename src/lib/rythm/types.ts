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
  | "validation_failed"
  | "speaker_mapping_saved"
  | "speaker_mapping_reset";

/** A saved mapping of a generic speaker label to a real participant. */
export interface RythmSpeakerMapping {
  id: string;
  meetingId: string;
  transcriptId: string | null;
  originalSpeakerLabel: string;
  mappedParticipantName: string;
  mappedParticipantEmail: string | null;
  confidence: string;
  createdAt: string;
}

/** A suggested participant for the speaker dropdown. */
export interface RythmSpeakerOption {
  name: string;
  email: string | null;
  source: "attendee" | "stakeholder";
}

/** Client → server payload for one speaker mapping. */
export interface SpeakerMappingInput {
  originalSpeakerLabel: string;
  mappedParticipantName: string;
  mappedParticipantEmail?: string | null;
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

/** Accepted upload extensions (AssemblyAI handles all of these). */
export const RYTHM_ACCEPTED_EXTENSIONS = [
  "mp3", "wav", "m4a", "mp4", "webm",
  "ogg", "oga", "opus", "aac", "flac", "mov", "mkv", "3gp", "amr",
] as const;

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
  "audio/ogg",
  "audio/opus",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
  "audio/3gpp",
  "audio/amr",
  "video/mp4", // some .mp4 audio recordings report a video container
  "video/webm", // screen + system-audio recordings
  "video/quicktime", // .mov
  "video/x-matroska", // .mkv
];

/** Mime types accepted for transcription queueing (same superset). */
export const RYTHM_TRANSCRIBE_MIME = RYTHM_ACCEPTED_MIME;

/** Maps a file extension to a sensible audio/video mime type. */
export const RYTHM_EXTENSION_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  aac: "audio/aac",
  flac: "audio/flac",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  "3gp": "audio/3gpp",
  amr: "audio/amr",
};

/** Planned transcription provider — wired in a later phase (no API call yet). */
export const RYTHM_TRANSCRIBE_PROVIDER = "assemblyai";
