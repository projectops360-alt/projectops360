// ============================================================================
// rythmStorageService — browser-side audio upload to the private bucket
// ============================================================================
// Uploads run with the *user's* session (browser Supabase client), so the
// storage RLS policy (can_access_project) is enforced. The service-role key is
// NEVER used here. After a successful upload we register the metadata row via a
// server action.
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import { registerRythmAudioAction } from "@/app/[locale]/(app)/projects/[projectId]/rhythm/audio-actions";
import {
  RYTHM_AUDIO_BUCKET,
  RYTHM_MAX_AUDIO_BYTES,
  RYTHM_ACCEPTED_EXTENSIONS,
  RYTHM_ACCEPTED_MIME,
  RYTHM_EXTENSION_MIME,
  type RythmAudioSource,
} from "./types";

// ── Path + filename helpers ───────────────────────────────────────────────────

/** Sanitises a filename for use inside a storage object key. */
export function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return cleaned || "audio";
}

/** projects/{projectId}/rythm/{meetingId}/assets/{timestamp}-{safeFileName} */
export function buildRythmAudioPath(
  projectId: string,
  meetingId: string,
  fileName: string,
): string {
  return `projects/${projectId}/rythm/${meetingId}/assets/${Date.now()}-${safeFileName(fileName)}`;
}

export function extensionFromFileName(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

/** Maps a MediaRecorder/File mime type to a sensible file extension. */
export function extensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a")) return "mp4";
  if (m.includes("wav") || m.includes("wave")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
}

// ── Validation ────────────────────────────────────────────────────────────────

export type ValidationResult = { ok: true } | { ok: false; errorKey: string };

export function validateAudioFile(file: File): ValidationResult {
  if (file.size <= 0) return { ok: false, errorKey: "errorEmptyFile" };
  if (file.size > RYTHM_MAX_AUDIO_BYTES) return { ok: false, errorKey: "errorTooLarge" };

  // Accept by extension OR by MIME type — files often have one but not the other.
  const ext = extensionFromFileName(file.name);
  const extOk =
    !!ext && RYTHM_ACCEPTED_EXTENSIONS.includes(ext as (typeof RYTHM_ACCEPTED_EXTENSIONS)[number]);
  const mimeOk = !!file.type && RYTHM_ACCEPTED_MIME.includes(file.type.toLowerCase());
  if (!extOk && !mimeOk) return { ok: false, errorKey: "errorUnsupportedType" };
  return { ok: true };
}

/** Resolves a meaningful content-type, falling back to the file extension. */
function resolveContentType(file: File): string {
  const type = file.type?.toLowerCase() ?? "";
  if (type && type !== "application/octet-stream" && RYTHM_ACCEPTED_MIME.includes(type)) {
    return type;
  }
  const ext = extensionFromFileName(file.name);
  return RYTHM_EXTENSION_MIME[ext] ?? type ?? "application/octet-stream";
}

// ── Upload result ─────────────────────────────────────────────────────────────

export type UploadResult =
  | { ok: true; audioFileId: string; storagePath: string }
  | { ok: false; errorKey: string };

// ── Core upload (raw blob → bucket → register metadata) ────────────────────────

async function uploadBlob(params: {
  projectId: string;
  meetingId: string;
  blob: Blob;
  fileName: string;
  contentType: string;
  source: RythmAudioSource;
  durationSeconds?: number | null;
}): Promise<UploadResult> {
  const { projectId, meetingId, blob, fileName, contentType, source, durationSeconds } = params;

  const supabase = createClient();
  const storagePath = buildRythmAudioPath(projectId, meetingId, fileName);

  const { error: uploadError } = await supabase.storage
    .from(RYTHM_AUDIO_BUCKET)
    .upload(storagePath, blob, { contentType, upsert: false });

  if (uploadError) {
    return { ok: false, errorKey: "errorUploadFailed" };
  }

  // Register the metadata row + advance statuses + enqueue transcription job.
  const registered = await registerRythmAudioAction({
    projectId,
    meetingId,
    storagePath,
    fileName,
    fileType: contentType,
    fileSize: blob.size,
    durationSeconds: durationSeconds ?? null,
    source,
  });

  if (registered.error || !registered.audioFileId) {
    // Best-effort cleanup so we don't orphan the object when the row failed.
    await supabase.storage.from(RYTHM_AUDIO_BUCKET).remove([storagePath]);
    return { ok: false, errorKey: registered.error ?? "errorRegisterFailed" };
  }

  return { ok: true, audioFileId: registered.audioFileId, storagePath };
}

/** Upload a user-selected audio file (RythmAudioUploader). */
export async function uploadRythmAudio(
  projectId: string,
  meetingId: string,
  file: File,
): Promise<UploadResult> {
  const validation = validateAudioFile(file);
  if (!validation.ok) return validation;

  return uploadBlob({
    projectId,
    meetingId,
    blob: file,
    fileName: file.name,
    contentType: resolveContentType(file),
    source: "manual_upload",
  });
}

/** Persist a MediaRecorder recording — microphone or screen + system audio. */
export async function saveBrowserRecording(
  projectId: string,
  meetingId: string,
  blob: Blob,
  opts?: {
    durationSeconds?: number | null;
    mimeType?: string;
    source?: Extract<RythmAudioSource, "browser_recording" | "screen_recording">;
  },
): Promise<UploadResult> {
  const mime = opts?.mimeType || blob.type || "audio/webm";
  const extension = extensionFromMime(mime);
  const source = opts?.source ?? "browser_recording";
  const prefix = source === "screen_recording" ? "screen-recording" : "recording";
  const fileName = `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;

  return uploadBlob({
    projectId,
    meetingId,
    blob,
    fileName,
    contentType: mime,
    source,
    durationSeconds: opts?.durationSeconds ?? null,
  });
}
