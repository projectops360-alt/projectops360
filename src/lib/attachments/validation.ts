// ============================================================================
// ProjectOps360° — Task & Subtask Attachments · Pure validation + path helpers
// ============================================================================
// No I/O, no Supabase — pure functions the client AND server both call so the
// allowlist / size / batch / filename / single-parent / storage-path rules are
// identical on both sides. Tested by validation.test.ts. Error strings are i18n
// KEYS (attachments.errors.*), never user-facing text.
// ============================================================================

import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  ATTACHMENT_ALLOWED_MIME,
  ATTACHMENT_BLOCKED_EXTENSIONS,
  ATTACHMENT_MAX_BATCH,
  ATTACHMENT_MAX_BYTES,
  type AttachmentExtension,
  type AttachmentMime,
} from "./types";

export type ValidationResult = { ok: true } | { ok: false; errorKey: string };

/** Lowercased extension without the dot, or "" when none. */
export function extensionFromFileName(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

/**
 * Sanitize a user-supplied display name into a safe path segment. Strips the
 * directory portion, collapses unsafe characters, prevents traversal/hidden
 * files, and caps the length. Never used as a full path on its own — always
 * combined with a UUID in buildAttachmentPath().
 */
export function sanitizeFileName(fileName: string): string {
  // Drop any path components a malicious client may inject (../, / or \).
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_") // only a safe charset survives
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "") // no leading dots (hidden files) / underscores
    .replace(/[._]+$/, "")
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

/** Validate the client-declared MIME against the allowlist. */
export function isAllowedMime(mime: string): mime is AttachmentMime {
  return (ATTACHMENT_ALLOWED_MIME as readonly string[]).includes(mime.toLowerCase());
}

/** Validate the extension against the allow/block lists. */
export function isAllowedExtension(ext: string): ext is AttachmentExtension {
  const e = ext.toLowerCase();
  if ((ATTACHMENT_BLOCKED_EXTENSIONS as readonly string[]).includes(e)) return false;
  return (ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(e);
}

/**
 * Validate a single candidate file. Both the extension AND the MIME must be on
 * the allowlist — client MIME is never trusted on its own (spoofable), and the
 * extension is the harder gate against executable/script uploads.
 */
export function validateAttachmentFile(input: {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}): ValidationResult {
  if (input.sizeBytes <= 0) return { ok: false, errorKey: "errorEmptyFile" };
  if (input.sizeBytes > ATTACHMENT_MAX_BYTES) return { ok: false, errorKey: "errorTooLarge" };

  const ext = extensionFromFileName(input.fileName);
  if (!ext || !isAllowedExtension(ext)) return { ok: false, errorKey: "errorTypeNotAllowed" };
  if (!isAllowedMime(input.mimeType)) return { ok: false, errorKey: "errorTypeNotAllowed" };

  return { ok: true };
}

/** Enforce the per-batch file count. */
export function validateBatchSize(count: number): ValidationResult {
  if (count <= 0) return { ok: false, errorKey: "errorEmptyFile" };
  if (count > ATTACHMENT_MAX_BATCH) return { ok: false, errorKey: "errorTooManyFiles" };
  return { ok: true };
}

/**
 * Exactly-one-parent oracle. Mirrors the DB CHECK constraint so the rule is
 * enforced (and tested) in application code too, not only in Postgres.
 */
export function validateSingleParent(input: {
  taskId?: string | null;
  subtaskId?: string | null;
}): ValidationResult {
  const hasTask = !!input.taskId;
  const hasSubtask = !!input.subtaskId;
  if (hasTask && hasSubtask) return { ok: false, errorKey: "errorBothParents" };
  if (!hasTask && !hasSubtask) return { ok: false, errorKey: "errorNoParent" };
  return { ok: true };
}

/**
 * Deterministic, scoped, collision-free storage object path. The attachment id
 * (UUID) guarantees uniqueness; the sanitized name is only cosmetic. folder[1]
 * is always 'projects' and folder[2] the projectId so the bucket's
 * can_access_project() RLS applies.
 *
 *   projects/{projectId}/task/{taskId}/{attachmentId}-{safeName}
 *   projects/{projectId}/subtask/{subtaskId}/{attachmentId}-{safeName}
 */
export function buildAttachmentPath(input: {
  projectId: string;
  taskId?: string | null;
  subtaskId?: string | null;
  attachmentId: string;
  fileName: string;
}): string {
  const safe = sanitizeFileName(input.fileName);
  const parentSegment = input.taskId
    ? `task/${input.taskId}`
    : `subtask/${input.subtaskId}`;
  return `projects/${input.projectId}/${parentSegment}/${input.attachmentId}-${safe}`;
}
