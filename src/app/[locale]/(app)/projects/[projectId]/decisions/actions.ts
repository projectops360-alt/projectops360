"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, requireProjectContributor } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { emitAndAutoLink } from "@/lib/graph/emit-event";
import type { Locale } from "@/types/database";
import { revalidatePath } from "next/cache";

// ── Zod Schemas ──────────────────────────────────────────────────────────────────

const statusValues = ["proposed", "accepted", "rejected", "deferred", "revoked"] as const;
const sourceTypeValues = ["meeting", "communication", "document", "manual", "other"] as const;
const impactAreaValues = ["scope", "schedule", "budget", "risk", "quality", "communication", "document", "other"] as const;

const createDecisionSchema = z.object({
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
  rationale: z
    .string()
    .max(5000, "rationaleTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  decisionMaker: z
    .string()
    .max(200, "decisionMakerTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  decisionDate: z.string().optional(),
  sourceType: z.enum(sourceTypeValues).optional(),
  sourceRecordId: z.string().uuid().optional(),
  impactArea: z.enum(impactAreaValues).optional(),
  evidenceUrl: z
    .string()
    .max(500, "evidenceUrlTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  status: z.enum(statusValues).default("proposed"),
  linkedStakeholderIds: z.array(z.string().uuid()).optional().default([]),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

const updateDecisionSchema = z.object({
  decisionId: z.string().uuid(),
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
  rationale: z
    .string()
    .max(5000, "rationaleTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  decisionMaker: z
    .string()
    .max(200, "decisionMakerTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  decisionDate: z.string().optional(),
  sourceType: z.enum(sourceTypeValues).optional(),
  sourceRecordId: z.string().uuid().optional(),
  impactArea: z.enum(impactAreaValues).optional(),
  evidenceUrl: z
    .string()
    .max(500, "evidenceUrlTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  status: z.enum(statusValues).default("proposed"),
  linkedStakeholderIds: z.array(z.string().uuid()).optional().default([]),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Server Actions ────────────────────────────────────────────────────────────────

export async function createDecisionAction(input: {
  title: string;
  description?: string;
  rationale?: string;
  decisionMaker?: string;
  decisionDate?: string;
  sourceType?: string;
  sourceRecordId?: string;
  impactArea?: string;
  evidenceUrl?: string;
  status: string;
  linkedStakeholderIds?: string[];
  projectId: string;
  locale: string;
}): Promise<{ error?: string; decisionId?: string }> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const parsed = createDecisionSchema.safeParse({
    title: input.title,
    description: input.description,
    rationale: input.rationale,
    decisionMaker: input.decisionMaker,
    decisionDate: input.decisionDate,
    sourceType: input.sourceType,
    sourceRecordId: input.sourceRecordId,
    impactArea: input.impactArea,
    evidenceUrl: input.evidenceUrl,
    status: input.status,
    linkedStakeholderIds: input.linkedStakeholderIds,
    projectId: input.projectId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const lang = data.locale as Locale;

  const titleI18n = { [lang]: data.title };
  const descriptionI18n = data.description ? { [lang]: data.description } : {};
  const rationaleI18n = data.rationale ? { [lang]: data.rationale } : {};

  const supabase = createAdminClient();

  const { data: decision, error: insertError } = await supabase
    .from("decisions")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
      rationale_i18n: rationaleI18n,
      decision_date: data.decisionDate || null,
      decision_maker: data.decisionMaker || null,
      source_type: data.sourceType ?? null,
      source_record_id: data.sourceRecordId || null,
      impact_area: data.impactArea ?? null,
      evidence_url: data.evidenceUrl || null,
      status: data.status,
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to create decision:", insertError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "decisions",
    entityId: decision.id,
    metadata: { title: data.title, status: data.status },
  });

  // Fire-and-forget: generate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("decisions", decision.id, {
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
      rationale_i18n: rationaleI18n,
    }).catch(() => {});
  });

  // Fire-and-forget: emit Living Graph event for decision
  emitAndAutoLink({
    organizationId: org.organizationId,
    projectId: data.projectId,
    nodeType: "decision_cascade",
    sourceEntityType: "decisions",
    sourceEntityId: decision.id,
    title: data.title,
    metadata: {
      entity_type: "decision",
      status: data.status,
      impact_area: data.impactArea ?? null,
    },
  });

  revalidatePath(`/${data.locale}/projects/${data.projectId}`, "layout");

  return { decisionId: decision.id };
}

export async function updateDecisionAction(input: {
  decisionId: string;
  title: string;
  description?: string;
  rationale?: string;
  decisionMaker?: string;
  decisionDate?: string;
  sourceType?: string;
  sourceRecordId?: string;
  impactArea?: string;
  evidenceUrl?: string;
  status: string;
  linkedStakeholderIds?: string[];
  projectId: string;
  locale: string;
}): Promise<{ error?: string }> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const parsed = updateDecisionSchema.safeParse({
    decisionId: input.decisionId,
    title: input.title,
    description: input.description,
    rationale: input.rationale,
    decisionMaker: input.decisionMaker,
    decisionDate: input.decisionDate,
    sourceType: input.sourceType,
    sourceRecordId: input.sourceRecordId,
    impactArea: input.impactArea,
    evidenceUrl: input.evidenceUrl,
    status: input.status,
    linkedStakeholderIds: input.linkedStakeholderIds,
    projectId: input.projectId,
    locale: input.locale,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const lang = data.locale as Locale;

  const titleI18n = { [lang]: data.title };
  const descriptionI18n = data.description ? { [lang]: data.description } : {};
  const rationaleI18n = data.rationale ? { [lang]: data.rationale } : {};

  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("decisions")
    .update({
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
      rationale_i18n: rationaleI18n,
      decision_date: data.decisionDate || null,
      decision_maker: data.decisionMaker || null,
      source_type: data.sourceType ?? null,
      source_record_id: data.sourceRecordId || null,
      impact_area: data.impactArea ?? null,
      evidence_url: data.evidenceUrl || null,
      status: data.status,
    })
    .eq("id", data.decisionId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update decision:", updateError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "decisions",
    entityId: data.decisionId,
    metadata: { title: data.title, status: data.status },
  });

  // Fire-and-forget: regenerate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("decisions", data.decisionId, {
      title_i18n: titleI18n,
      description_i18n: descriptionI18n,
      rationale_i18n: rationaleI18n,
    }).catch(() => {});
  });

  revalidatePath(`/${data.locale}/projects/${data.projectId}`, "layout");

  return {};
}

export async function archiveDecisionAction(
  decisionId: string,
): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();

  const { data: __row } = await supabase
    .from("decisions").select("project_id")
    .eq("id", decisionId).eq("organization_id", org.organizationId).maybeSingle();
  if (!__row?.project_id) return { error: "not_found" };
  const __g = await requireProjectContributor(__row.project_id as string);
  if (!__g.ok) return { error: __g.error };

  const { error: deleteError } = await supabase
    .from("decisions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", decisionId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Failed to archive decision:", deleteError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    action: "delete",
    entityType: "decisions",
    entityId: decisionId,
    metadata: { soft_delete: true },
  });

  return {};
}