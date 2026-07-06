"use server";

// ============================================================================
// ProjectOps360° — Task & Subtask Attachments · Server actions
// ============================================================================
// Every call: trusted session (getOrgContext) → zod validation → parent exists
// and belongs to the caller's org+project → RBAC (authorizeAttachmentAction,
// deny-by-default) → org/project-scoped write via the admin client → audit log.
// The binary file is uploaded BROWSER-SIDE under the user's session (storage
// RLS = can_access_project); this server never exposes the service-role key to
// the client. Signed URLs are issued ONLY after the access check. We store
// metadata + storage path only — never file contents, never signed URLs.
// Guarded by TASK-SUBTASK-FILE-ATTACHMENTS.
// ============================================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, type OrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { authorizeAttachmentAction } from "./permissions";
import { buildAttachmentPath, validateAttachmentFile, validateSingleParent } from "./validation";
import {
  ATTACHMENTS_BUCKET,
  ATTACHMENT_SIGNED_URL_TTL_SECONDS,
  type AttachmentDTO,
  type AttachmentParentType,
  type AttachmentRow,
} from "./types";

type Admin = ReturnType<typeof createAdminClient>;

// ── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    projectId: z.string().uuid(),
    attachmentId: z.string().uuid(),
    taskId: z.string().uuid().optional().nullable(),
    subtaskId: z.string().uuid().optional().nullable(),
    fileName: z.string().min(1).max(300),
    mimeType: z.string().min(1).max(200),
    sizeBytes: z.number().int().nonnegative(),
    storagePath: z.string().min(1).max(1000),
    checksum: z.string().max(200).optional().nullable(),
  })
  .refine((v) => !!v.taskId !== !!v.subtaskId, { message: "errorOneParent" });

const listSchema = z
  .object({
    projectId: z.string().uuid(),
    taskId: z.string().uuid().optional().nullable(),
    subtaskId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => !!v.taskId !== !!v.subtaskId, { message: "errorOneParent" });

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Confirm the parent task/subtask exists inside the caller's org + project. */
async function parentExists(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  parent: { taskId?: string | null; subtaskId?: string | null },
): Promise<boolean> {
  if (parent.taskId) {
    const { data } = await supabase
      .from("roadmap_tasks")
      .select("id")
      .eq("id", parent.taskId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    return !!data;
  }
  if (parent.subtaskId) {
    const { data } = await supabase
      .from("task_subtasks")
      .select("id")
      .eq("id", parent.subtaskId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    return !!data;
  }
  return false;
}

async function resolveUploaderNames(
  supabase: Admin,
  org: OrgContext,
  ids: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", unique);
  const names: Record<string, string> = {};
  for (const row of (data as { id: string; display_name: string | null }[] | null) ?? []) {
    if (row.display_name) names[row.id] = row.display_name;
  }
  return names;
}

function toDTO(
  row: AttachmentRow,
  org: OrgContext,
  uploaderNames: Record<string, string>,
): AttachmentDTO {
  const parentType: AttachmentParentType = row.task_id ? "task" : "subtask";
  const canRemove = authorizeAttachmentAction({
    role: org.role,
    userId: org.userId,
    action: "remove",
    uploadedById: row.uploaded_by,
  }).allowed;
  return {
    id: row.id,
    fileName: row.file_name,
    fileExt: row.file_ext,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedById: row.uploaded_by,
    uploadedByName: row.uploaded_by ? (uploaderNames[row.uploaded_by] ?? null) : null,
    uploadedAt: row.created_at,
    parentType,
    canRemove,
  };
}

function revalidate(): void {
  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");
}

// ── Register (called by the browser AFTER the object lands in the bucket) ─────

export async function registerAttachmentAction(
  input: unknown,
): Promise<{ error?: string; attachment?: AttachmentDTO }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  // Exactly-one-parent (defence in depth beyond the zod refine + DB CHECK).
  const parentCheck = validateSingleParent({ taskId: data.taskId, subtaskId: data.subtaskId });
  if (!parentCheck.ok) return { error: parentCheck.errorKey };

  // Re-validate the file server-side — client validation is never trusted.
  const fileCheck = validateAttachmentFile({
    fileName: data.fileName,
    sizeBytes: data.sizeBytes,
    mimeType: data.mimeType,
  });
  if (!fileCheck.ok) return { error: fileCheck.errorKey };

  // Prevent arbitrary paths: the stored path MUST equal the deterministic path
  // we would have built ourselves. Anything else is rejected.
  const expectedPath = buildAttachmentPath({
    projectId: data.projectId,
    taskId: data.taskId,
    subtaskId: data.subtaskId,
    attachmentId: data.attachmentId,
    fileName: data.fileName,
  });
  if (data.storagePath !== expectedPath) return { error: "invalid_path" };

  const supabase = createAdminClient();

  // Parent must belong to the caller's org + project (blocks cross-org/project).
  if (!(await parentExists(supabase, org, data.projectId, data))) {
    return { error: "parent_not_found" };
  }

  const denied = authorizeAttachmentAction({ role: org.role, userId: org.userId, action: "upload" });
  if (!denied.allowed) return { error: "forbidden" };

  const fileExt = (data.fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase() || null;

  const { data: inserted, error } = await supabase
    .from("project_task_attachments")
    .insert({
      id: data.attachmentId,
      organization_id: org.organizationId,
      project_id: data.projectId,
      task_id: data.taskId ?? null,
      subtask_id: data.subtaskId ?? null,
      uploaded_by: org.userId,
      file_name: data.fileName,
      file_ext: fileExt,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      storage_bucket: ATTACHMENTS_BUCKET,
      storage_path: expectedPath,
      checksum: data.checksum ?? null,
      status: "active",
    })
    .select("*")
    .single();

  if (error || !inserted) {
    console.error("[attachments] register failed:", error?.message);
    return { error: "unexpected" };
  }

  const row = inserted as AttachmentRow;
  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "project_task_attachments",
    entityId: row.id,
    metadata: {
      parent_type: row.task_id ? "task" : "subtask",
      task_id: row.task_id,
      subtask_id: row.subtask_id,
      file_name: row.file_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
    },
  });

  revalidate();
  const names = await resolveUploaderNames(supabase, org, [org.userId]);
  return { attachment: toDTO(row, org, names) };
}

// ── List (task or subtask) ───────────────────────────────────────────────────

async function listAttachments(
  input: unknown,
): Promise<{ error?: string; attachments?: AttachmentDTO[] }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  const denied = authorizeAttachmentAction({ role: org.role, userId: org.userId, action: "list" });
  if (!denied.allowed) return { error: "forbidden" };

  const supabase = createAdminClient();
  let query = supabase
    .from("project_task_attachments")
    .select("*")
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  query = data.taskId ? query.eq("task_id", data.taskId) : query.eq("subtask_id", data.subtaskId!);

  const { data: rows, error } = await query;
  if (error) {
    console.error("[attachments] list failed:", error.message);
    return { error: "unexpected" };
  }

  const list = (rows as AttachmentRow[] | null) ?? [];
  const names = await resolveUploaderNames(
    supabase,
    org,
    list.map((r) => r.uploaded_by).filter((x): x is string => !!x),
  );
  return { attachments: list.map((r) => toDTO(r, org, names)) };
}

export async function listTaskAttachmentsAction(input: {
  projectId: string;
  taskId: string;
}): Promise<{ error?: string; attachments?: AttachmentDTO[] }> {
  return listAttachments({ projectId: input.projectId, taskId: input.taskId });
}

export async function listSubtaskAttachmentsAction(input: {
  projectId: string;
  subtaskId: string;
}): Promise<{ error?: string; attachments?: AttachmentDTO[] }> {
  return listAttachments({ projectId: input.projectId, subtaskId: input.subtaskId });
}

// ── Signed URL (open/download) — issued ONLY after the access check ──────────

export async function getAttachmentSignedUrlAction(input: {
  attachmentId: string;
}): Promise<{ error?: string; url?: string; fileName?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z.object({ attachmentId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = createAdminClient();
  // Scope the lookup to the caller's org — cross-org rows are invisible here.
  const { data: row, error } = await supabase
    .from("project_task_attachments")
    .select("storage_bucket, storage_path, file_name, status")
    .eq("id", parsed.data.attachmentId)
    .eq("organization_id", org.organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !row) return { error: "not_found" };

  const view = authorizeAttachmentAction({ role: org.role, userId: org.userId, action: "view" });
  if (!view.allowed) return { error: "forbidden" };

  const { data: signed, error: signError } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, ATTACHMENT_SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) return { error: "sign_failed" };
  return { url: signed.signedUrl, fileName: row.file_name };
}

// ── Remove (soft-delete metadata + best-effort object removal) ───────────────

export async function removeAttachmentAction(input: {
  attachmentId: string;
}): Promise<{ error?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z.object({ attachmentId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("project_task_attachments")
    .select("*")
    .eq("id", parsed.data.attachmentId)
    .eq("organization_id", org.organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (!row) return { error: "not_found" };
  const attachment = row as AttachmentRow;

  const decision = authorizeAttachmentAction({
    role: org.role,
    userId: org.userId,
    action: "remove",
    uploadedById: attachment.uploaded_by,
  });
  if (!decision.allowed) return { error: "forbidden" };

  // Soft-delete metadata first (source of truth for what the user sees).
  const { error: updateError } = await supabase
    .from("project_task_attachments")
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString(),
      deleted_by: org.userId,
    })
    .eq("id", attachment.id)
    .eq("organization_id", org.organizationId)
    .eq("status", "active");

  if (updateError) {
    console.error("[attachments] remove failed:", updateError.message);
    return { error: "unexpected" };
  }

  // Best-effort object removal. If it fails, the metadata is already deleted
  // (hidden from users); mark it 'orphaned' for a later cleanup sweep.
  const { error: storageError } = await supabase.storage
    .from(attachment.storage_bucket)
    .remove([attachment.storage_path]);
  if (storageError) {
    console.error("[attachments] object removal failed (marked orphaned):", storageError.message);
    await supabase
      .from("project_task_attachments")
      .update({ status: "orphaned" })
      .eq("id", attachment.id)
      .eq("organization_id", org.organizationId);
  }

  await logAudit({
    org,
    projectId: attachment.project_id,
    action: "delete",
    entityType: "project_task_attachments",
    entityId: attachment.id,
    metadata: {
      parent_type: attachment.task_id ? "task" : "subtask",
      task_id: attachment.task_id,
      subtask_id: attachment.subtask_id,
      file_name: attachment.file_name,
    },
  });

  revalidate();
  return {};
}
