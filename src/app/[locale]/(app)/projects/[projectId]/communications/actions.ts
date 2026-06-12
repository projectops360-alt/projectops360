"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { emitAndAutoLink } from "@/lib/graph/emit-event";
import type { Locale } from "@/types/database";
import { revalidatePath } from "next/cache";

// ── Zod Schemas ──────────────────────────────────────────────────────────────────

const sourceTypeValues = [
  "email", "meeting", "phone", "teams", "slack",
  "in_person", "document", "manual_note", "other",
] as const;

const createCommunicationSchema = z.object({
  title: z
    .string()
    .min(1, "titleRequired")
    .max(200, "titleTooLong")
    .transform((s) => s.trim()),
  summary: z
    .string()
    .max(2000, "summaryTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  content: z
    .string()
    .max(5000, "contentTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  sourceType: z.enum(sourceTypeValues).optional(),
  itemDate: z.string().optional(),
  sender: z
    .string()
    .max(200, "senderTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  recipients: z
    .string()
    .max(500, "recipientsTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  requiresFollowUp: z.coerce.boolean().default(false),
  status: z.enum(["draft", "logged"]).default("logged"),
  relatedStakeholderIds: z.array(z.string().uuid()).optional().default([]),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

const updateCommunicationSchema = z.object({
  communicationId: z.string().uuid(),
  title: z
    .string()
    .min(1, "titleRequired")
    .max(200, "titleTooLong")
    .transform((s) => s.trim()),
  summary: z
    .string()
    .max(2000, "summaryTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  content: z
    .string()
    .max(5000, "contentTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  sourceType: z.enum(sourceTypeValues).optional(),
  itemDate: z.string().optional(),
  sender: z
    .string()
    .max(200, "senderTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  recipients: z
    .string()
    .max(500, "recipientsTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  requiresFollowUp: z.coerce.boolean().default(false),
  status: z.enum(["draft", "logged"]).default("logged"),
  relatedStakeholderIds: z.array(z.string().uuid()).optional().default([]),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Server Actions ────────────────────────────────────────────────────────────────

export async function createCommunicationAction(input: {
  title: string;
  summary?: string;
  content?: string;
  sourceType?: string;
  itemDate?: string;
  sender?: string;
  recipients?: string;
  requiresFollowUp: boolean;
  status: string;
  relatedStakeholderIds?: string[];
  projectId: string;
  locale: string;
}): Promise<{ error?: string; communicationId?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const parsed = createCommunicationSchema.safeParse({
    title: input.title,
    summary: input.summary,
    content: input.content,
    sourceType: input.sourceType,
    itemDate: input.itemDate,
    sender: input.sender,
    recipients: input.recipients,
    requiresFollowUp: input.requiresFollowUp,
    status: input.status,
    relatedStakeholderIds: input.relatedStakeholderIds,
    projectId: input.projectId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  // ── Build i18n fields ────────────────────────────────────────────────────
  const lang = data.locale as Locale;
  const titleI18n = { [lang]: data.title };
  const summaryI18n = data.summary ? { [lang]: data.summary } : {};
  const contentI18n = data.content ? { [lang]: data.content } : {};

  // ── Insert communication ─────────────────────────────────────────────────
  const supabase = createAdminClient();

  const { data: communication, error: insertError } = await supabase
    .from("communication_items")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      title_i18n: titleI18n,
      summary_i18n: summaryI18n,
      content_i18n: contentI18n,
      source_type: data.sourceType ?? null,
      item_date: data.itemDate || null,
      sender: data.sender || null,
      recipients: data.recipients || null,
      requires_follow_up: data.requiresFollowUp,
      status: data.status,
      related_stakeholder_ids: data.relatedStakeholderIds,
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to create communication:", insertError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "communication_items",
    entityId: communication.id,
    metadata: { title: data.title, source_type: data.sourceType },
  });

  // Fire-and-forget: generate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("communication_items", communication.id, {
      title_i18n: titleI18n,
      summary_i18n: summaryI18n,
      content_i18n: contentI18n,
    }).catch(() => {});
  });

  // Fire-and-forget: emit Living Graph event for communication
  emitAndAutoLink({
    organizationId: org.organizationId,
    projectId: data.projectId,
    nodeType: "communication_flow",
    sourceEntityType: "communication_items",
    sourceEntityId: communication.id,
    title: data.title,
    metadata: {
      source_type: data.sourceType ?? "unknown",
      requires_follow_up: data.requiresFollowUp,
    },
  });

  revalidatePath(`/${data.locale}/projects/${data.projectId}`, "layout");

  return { communicationId: communication.id };
}

export async function updateCommunicationAction(input: {
  communicationId: string;
  title: string;
  summary?: string;
  content?: string;
  sourceType?: string;
  itemDate?: string;
  sender?: string;
  recipients?: string;
  requiresFollowUp: boolean;
  status: string;
  relatedStakeholderIds?: string[];
  projectId: string;
  locale: string;
}): Promise<{ error?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  // ── Validate ─────────────────────────────────────────────────────────────
  const parsed = updateCommunicationSchema.safeParse({
    communicationId: input.communicationId,
    title: input.title,
    summary: input.summary,
    content: input.content,
    sourceType: input.sourceType,
    itemDate: input.itemDate,
    sender: input.sender,
    recipients: input.recipients,
    requiresFollowUp: input.requiresFollowUp,
    status: input.status,
    relatedStakeholderIds: input.relatedStakeholderIds,
    projectId: input.projectId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  // ── Build i18n fields ────────────────────────────────────────────────────
  const lang = data.locale as Locale;
  const titleI18n = { [lang]: data.title };
  const summaryI18n = data.summary ? { [lang]: data.summary } : {};
  const contentI18n = data.content ? { [lang]: data.content } : {};

  // ── Update communication ─────────────────────────────────────────────────
  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("communication_items")
    .update({
      title_i18n: titleI18n,
      summary_i18n: summaryI18n,
      content_i18n: contentI18n,
      source_type: data.sourceType ?? null,
      item_date: data.itemDate || null,
      sender: data.sender || null,
      recipients: data.recipients || null,
      requires_follow_up: data.requiresFollowUp,
      status: data.status,
      related_stakeholder_ids: data.relatedStakeholderIds,
    })
    .eq("id", data.communicationId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update communication:", updateError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "communication_items",
    entityId: data.communicationId,
    metadata: { title: data.title, status: data.status },
  });

  // Fire-and-forget: regenerate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("communication_items", data.communicationId, {
      title_i18n: titleI18n,
      summary_i18n: summaryI18n,
      content_i18n: contentI18n,
    }).catch(() => {});
  });

  revalidatePath(`/${data.locale}/projects/${data.projectId}`, "layout");

  return {};
}

export async function archiveCommunicationAction(
  communicationId: string,
): Promise<{ error?: string }> {
  // ── Authenticate ────────────────────────────────────────────────────────
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  // ── Soft delete ─────────────────────────────────────────────────────────
  const supabase = createAdminClient();

  const { error: deleteError } = await supabase
    .from("communication_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", communicationId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Failed to archive communication:", deleteError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    action: "delete",
    entityType: "communication_items",
    entityId: communicationId,
    metadata: { soft_delete: true },
  });

  return {};
}