// ============================================================================
// ProjectOps360° — Task & Subtask Attachments · Browser upload service
// ============================================================================
// Uploads run with the USER's session (browser Supabase client), so the storage
// RLS policy (can_access_project) is enforced. The service-role key is NEVER
// used here. Flow: validate → generate attachmentId (UUID) → build the scoped
// path → upload the blob to the private bucket → register metadata via the
// server action. If registration fails we remove the orphaned object.
// Guarded by TASK-SUBTASK-FILE-ATTACHMENTS.
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import { registerAttachmentAction } from "./actions";
import { ATTACHMENTS_BUCKET, type AttachmentDTO } from "./types";
import { buildAttachmentPath, validateAttachmentFile } from "./validation";

export type UploadResult =
  | { ok: true; attachment: AttachmentDTO }
  | { ok: false; errorKey: string };

interface UploadParams {
  projectId: string;
  taskId?: string | null;
  subtaskId?: string | null;
  file: File;
}

/** Upload one file to a task OR a subtask (exactly one parent). */
export async function uploadAttachment(params: UploadParams): Promise<UploadResult> {
  const { projectId, taskId, subtaskId, file } = params;

  if (!!taskId === !!subtaskId) {
    return { ok: false, errorKey: taskId ? "errorBothParents" : "errorNoParent" };
  }

  const validation = validateAttachmentFile({
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
  });
  if (!validation.ok) return { ok: false, errorKey: validation.errorKey };

  const attachmentId = crypto.randomUUID();
  const storagePath = buildAttachmentPath({
    projectId,
    taskId,
    subtaskId,
    attachmentId,
    fileName: file.name,
  });

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) return { ok: false, errorKey: "errorUploadFailed" };

  const registered = await registerAttachmentAction({
    projectId,
    attachmentId,
    taskId: taskId ?? null,
    subtaskId: subtaskId ?? null,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storagePath,
  });

  if (registered.error || !registered.attachment) {
    // Best-effort cleanup so a failed registration never orphans the object.
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
    return { ok: false, errorKey: registered.error ?? "errorUploadFailed" };
  }

  return { ok: true, attachment: registered.attachment };
}
