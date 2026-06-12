"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Locale } from "@/types/database";
import { revalidatePath } from "next/cache";

// ── Zod Schemas ──────────────────────────────────────────────────────────────────

const documentTypeValues = ["evidence", "contract", "specification", "report", "presentation", "other"] as const;
const storageTypeValues = ["upload", "external_url"] as const;
const statusValues = ["draft", "review", "approved", "archived"] as const;

const createDocumentSchema = z.object({
  title: z
    .string()
    .min(1, "titleRequired")
    .max(200, "titleTooLong")
    .transform((s) => s.trim()),
  description: z
    .string()
    .max(2000, "descriptionTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  documentType: z.enum(documentTypeValues).default("evidence"),
  storageType: z.enum(storageTypeValues).default("external_url"),
  externalUrl: z
    .string()
    .max(500, "externalUrlTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  fileUrl: z.string().max(500).optional(),
  fileType: z.string().max(100).optional(),
  owner: z
    .string()
    .max(200, "ownerTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  status: z.enum(statusValues).default("draft"),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

const updateDocumentSchema = z.object({
  documentId: z.string().uuid(),
  title: z
    .string()
    .min(1, "titleRequired")
    .max(200, "titleTooLong")
    .transform((s) => s.trim()),
  description: z
    .string()
    .max(2000, "descriptionTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  documentType: z.enum(documentTypeValues).optional(),
  storageType: z.enum(storageTypeValues).optional(),
  externalUrl: z
    .string()
    .max(500, "externalUrlTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  fileUrl: z.string().max(500).optional(),
  fileType: z.string().max(100).optional(),
  owner: z
    .string()
    .max(200, "ownerTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  status: z.enum(statusValues).default("draft"),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Server Actions ────────────────────────────────────────────────────────────────

export async function createDocumentAction(input: {
  title: string;
  description?: string;
  documentType?: string;
  storageType?: string;
  externalUrl?: string;
  fileUrl?: string;
  fileType?: string;
  owner?: string;
  status: string;
  projectId: string;
  locale: string;
}): Promise<{ error?: string; documentId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = createDocumentSchema.safeParse({
    title: input.title,
    description: input.description,
    documentType: input.documentType,
    storageType: input.storageType,
    externalUrl: input.externalUrl,
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    owner: input.owner,
    status: input.status,
    projectId: input.projectId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  // Validate storage type consistency
  if (data.storageType === "upload" && !data.fileUrl) {
    return { error: "fileRequired" };
  }
  if (data.storageType === "external_url" && !data.externalUrl) {
    return { error: "externalUrlInvalid" };
  }

  const lang = data.locale as Locale;
  const titleI18n = { [lang]: data.title };
  const descriptionI18n = data.description ? { [lang]: data.description } : {};

  const supabase = createAdminClient();

  const insertData: Record<string, unknown> = {
    organization_id: org.organizationId,
    project_id: data.projectId,
    title_i18n: titleI18n,
    description_i18n: descriptionI18n,
    document_type: data.documentType,
    storage_type: data.storageType,
    external_url: data.storageType === "external_url" ? data.externalUrl : null,
    owner: data.owner || null,
    status: data.status,
    created_by: org.userId,
  };

  // Only set file-related fields for uploads
  if (data.storageType === "upload") {
    insertData.file_url = data.fileUrl || null;
    insertData.file_type = data.fileType || null;
  }

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert(insertData)
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to create document:", insertError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "documents",
    entityId: document.id,
    metadata: { title: data.title, document_type: data.documentType },
  });

  // Fire-and-forget: generate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("documents", document.id, {
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
    }).catch(() => {});
  });

  revalidatePath(`/${data.locale}/projects/${data.projectId}`, "layout");

  return { documentId: document.id };
}

export async function updateDocumentAction(input: {
  documentId: string;
  title: string;
  description?: string;
  documentType?: string;
  storageType?: string;
  externalUrl?: string;
  fileUrl?: string;
  fileType?: string;
  owner?: string;
  status: string;
  projectId: string;
  locale: string;
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = updateDocumentSchema.safeParse({
    documentId: input.documentId,
    title: input.title,
    description: input.description,
    documentType: input.documentType,
    storageType: input.storageType,
    externalUrl: input.externalUrl,
    fileUrl: input.fileUrl,
    fileType: input.fileType,
    owner: input.owner,
    status: input.status,
    projectId: input.projectId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  // Validate storage type consistency
  if (data.storageType === "upload" && !data.fileUrl) {
    return { error: "fileRequired" };
  }
  if (data.storageType === "external_url" && !data.externalUrl) {
    return { error: "externalUrlInvalid" };
  }

  const lang = data.locale as Locale;
  const titleI18n = { [lang]: data.title };
  const descriptionI18n = data.description ? { [lang]: data.description } : {};

  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    title_i18n: titleI18n,
    description_i18n: descriptionI18n,
    document_type: data.documentType,
    storage_type: data.storageType,
    external_url: data.storageType === "external_url" ? data.externalUrl : null,
    owner: data.owner || null,
    status: data.status,
  };

  // Only update file-related fields for uploads
  if (data.storageType === "upload") {
    updateData.file_url = data.fileUrl || null;
    updateData.file_type = data.fileType || null;
  } else {
    updateData.file_url = null;
    updateData.file_type = null;
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", data.documentId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update document:", updateError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "documents",
    entityId: data.documentId,
    metadata: { title: data.title, status: data.status },
  });

  // Fire-and-forget: regenerate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("documents", data.documentId, {
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
    }).catch(() => {});
  });

  revalidatePath(`/${data.locale}/projects/${data.projectId}`, "layout");

  return {};
}

export async function archiveDocumentAction(
  documentId: string,
): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();

  const { error: deleteError } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Failed to archive document:", deleteError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    action: "delete",
    entityType: "documents",
    entityId: documentId,
    metadata: { soft_delete: true },
  });

  return {};
}