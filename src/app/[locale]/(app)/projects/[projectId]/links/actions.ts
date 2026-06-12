"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Locale, TraceableEntityType, LinkType } from "@/types/database";

// ── Zod Schemas ──────────────────────────────────────────────────────────────────

const TRACEABLE_ENTITY_TYPES: TraceableEntityType[] = [
  "decision", "meeting", "communication", "document",
  "action_item", "stakeholder", "project",
];

const LINK_TYPES: LinkType[] = [
  "related_to", "caused_by", "depends_on",
  "supersedes", "derived_from", "contradicts",
];

const createLinkSchema = z.object({
  sourceType: z.enum(TRACEABLE_ENTITY_TYPES),
  sourceId: z.string().uuid(),
  targetType: z.enum(TRACEABLE_ENTITY_TYPES),
  targetId: z.string().uuid(),
  linkType: z.enum(LINK_TYPES),
  context: z
    .string()
    .max(2000, "contextTooLong")
    .transform((s) => s.trim())
    .optional()
    .default(""),
  locale: z.enum(["en", "es"]).default("en"),
});

// ── Server Actions ────────────────────────────────────────────────────────────────

export async function createLinkAction(input: {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  context?: string;
  locale?: string;
}): Promise<{ error?: string; linkId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = createLinkSchema.safeParse({
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    targetType: input.targetType,
    targetId: input.targetId,
    linkType: input.linkType,
    context: input.context,
    locale: input.locale ?? "en",
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  // Prevent self-linking
  if (data.sourceType === data.targetType && data.sourceId === data.targetId) {
    return { error: "duplicate" };
  }

  const lang = data.locale as Locale;
  const contextI18n = data.context ? { [lang]: data.context } : {};

  const supabase = createAdminClient();

  // Check for duplicate link (same source → target)
  const { data: existing } = await supabase
    .from("traceability_links")
    .select("id")
    .eq("organization_id", org.organizationId)
    .eq("source_type", data.sourceType)
    .eq("source_id", data.sourceId)
    .eq("target_type", data.targetType)
    .eq("target_id", data.targetId)
    .maybeSingle();

  if (existing) {
    return { error: "duplicate" };
  }

  const { data: link, error: insertError } = await supabase
    .from("traceability_links")
    .insert({
      organization_id: org.organizationId,
      source_type: data.sourceType,
      source_id: data.sourceId,
      target_type: data.targetType,
      target_id: data.targetId,
      link_type: data.linkType,
      context_i18n: contextI18n,
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to create traceability link:", insertError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    action: "create",
    entityType: "traceability_links",
    entityId: link.id,
    metadata: { link_type: input.linkType, source_type: input.sourceType, target_type: input.targetType },
  });

  return { linkId: link.id };
}

export async function deleteLinkAction(
  linkId: string,
): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();

  // Hard delete — traceability_links has no deleted_at column
  const { error: deleteError } = await supabase
    .from("traceability_links")
    .delete()
    .eq("id", linkId)
    .eq("organization_id", org.organizationId);

  if (deleteError) {
    console.error("Failed to delete traceability link:", deleteError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    action: "delete",
    entityType: "traceability_links",
    entityId: linkId,
    metadata: { hard_delete: true },
  });

  return {};
}