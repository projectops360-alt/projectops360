// ============================================================================
// ProjectOps360° — Task & Subtask Attachments · Types + policy constants
// ============================================================================
// Single source of truth for the attachment allowlist, size/batch limits, the
// bucket name, and the shared DTO/row shapes. Both the browser storage service
// and the server actions import from here so the client and server enforce the
// EXACT same policy. Guarded by TASK-SUBTASK-FILE-ATTACHMENTS.
// ============================================================================

/** Private Supabase Storage bucket. Never public. */
export const ATTACHMENTS_BUCKET = "project-attachments" as const;

/** Conservative per-file size limit (10 MB). */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Max files accepted in a single upload batch. */
export const ATTACHMENT_MAX_BATCH = 5;

/** Signed-URL lifetime for open/download (10 minutes). */
export const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 10;

/**
 * Allowed MIME types. Documents + safe images only. Executables, scripts and
 * markup (svg/html) are intentionally excluded — see the Product Brain doc.
 */
export const ATTACHMENT_ALLOWED_MIME = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AttachmentMime = (typeof ATTACHMENT_ALLOWED_MIME)[number];

/**
 * Allowed file extensions (defence in depth: client MIME can be spoofed, so the
 * extension is validated too). Kept in sync with ATTACHMENT_ALLOWED_MIME.
 */
export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
] as const;

export type AttachmentExtension = (typeof ATTACHMENT_ALLOWED_EXTENSIONS)[number];

/** Explicitly-blocked extensions — never accepted even if MIME looks benign. */
export const ATTACHMENT_BLOCKED_EXTENSIONS = [
  "exe",
  "bat",
  "cmd",
  "sh",
  "ps1",
  "js",
  "ts",
  "tsx",
  "jsx",
  "html",
  "htm",
  "svg",
  "php",
  "jar",
  "msi",
  "zip",
  "rar",
  "7z",
  "dll",
  "app",
  "com",
  "scr",
  "vbs",
] as const;

export type AttachmentParentType = "task" | "subtask";

/** Persisted row (mirrors project_task_attachments). */
export interface AttachmentRow {
  id: string;
  organization_id: string;
  project_id: string;
  task_id: string | null;
  subtask_id: string | null;
  uploaded_by: string | null;
  file_name: string;
  file_ext: string | null;
  mime_type: string;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  checksum: string | null;
  status: "active" | "deleted" | "orphaned";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

/** Safe, client-facing projection. Never exposes the storage path/bucket. */
export interface AttachmentDTO {
  id: string;
  fileName: string;
  fileExt: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  parentType: AttachmentParentType;
  /** True when the current caller may remove this attachment (server-decided). */
  canRemove: boolean;
}
