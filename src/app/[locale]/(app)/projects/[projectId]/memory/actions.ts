"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectContributor } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { MemorySourceType } from "@/types/database";

// ── Constants ──────────────────────────────────────────────────────────────────

const SOURCE_TYPES = [
  "manual_note", "email", "chat_message", "meeting_note",
  "decision", "action_item", "risk_signal", "evidence",
  "approval", "change_request", "system_event", "document",
] as const;

const IMPORTANCE = ["low", "medium", "high", "critical"] as const;
const VISIBILITY = ["project", "organization", "private"] as const;

// Entity types a memory item may be linked to (must already exist as tables).
const LINK_TARGET_TYPES = [
  "task", "milestone", "decision", "risk",
  "stakeholder", "document", "communication", "meeting",
] as const;
const LINK_TYPES = ["related_to", "depends_on", "caused_by", "contradicts", "supersedes", "derived_from"] as const;

// ── Schemas ────────────────────────────────────────────────────────────────────

const baseFields = {
  title: z.string().min(1, "titleRequired").max(300, "titleTooLong").transform((s) => s.trim()),
  content: z.string().max(20000, "contentTooLong").transform((s) => s.trim()).optional().default(""),
  summary: z.string().max(2000, "summaryTooLong").transform((s) => s.trim()).optional().default(""),
  sourceType: z.enum(SOURCE_TYPES).default("manual_note"),
  sourceSystem: z.string().max(100).transform((s) => s.trim()).optional().default(""),
  authorName: z.string().max(200).transform((s) => s.trim()).optional().default(""),
  authorEmail: z.string().max(200).transform((s) => s.trim()).optional().default(""),
  participants: z.array(z.string().max(200)).optional().default([]),
  occurredAt: z.string().optional(),
  importanceLevel: z.enum(IMPORTANCE).default("medium"),
  tags: z.array(z.string().max(60)).optional().default([]),
  visibility: z.enum(VISIBILITY).default("project"),
  projectId: z.string().uuid(),
  locale: z.enum(["en", "es"]).default("en"),
};

const createSchema = z.object({
  ...baseFields,
  runAi: z.coerce.boolean().default(true),
});

const updateSchema = z.object({
  ...baseFields,
  memoryItemId: z.string().uuid(),
  runAi: z.coerce.boolean().default(false),
});

export interface MemoryItemInput {
  title: string;
  content?: string;
  summary?: string;
  sourceType?: string;
  sourceSystem?: string;
  authorName?: string;
  authorEmail?: string;
  participants?: string[];
  occurredAt?: string;
  importanceLevel?: string;
  tags?: string[];
  visibility?: string;
  projectId: string;
  locale: string;
  runAi?: boolean;
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createMemoryItemAction(
  input: MemoryItemInput,
): Promise<{ error?: string; memoryItemId?: string }> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "validation_error" };
  }
  const d = parsed.data;

  const supabase = createAdminClient();

  // Verify the project belongs to the org (defense in depth — RLS also applies).
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", d.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) return { error: "project_not_found" };

  const { data: item, error: insertError } = await supabase
    .from("project_memory_items")
    .insert({
      organization_id: org.organizationId,
      project_id: d.projectId,
      title: d.title,
      content: d.content || null,
      summary: d.summary || null,
      source_type: d.sourceType as MemorySourceType,
      source_system: d.sourceSystem || null,
      author_name: d.authorName || null,
      author_email: d.authorEmail || null,
      participants: d.participants,
      occurred_at: d.occurredAt || null,
      importance_level: d.importanceLevel,
      tags: d.tags,
      visibility: d.visibility,
      ai_status: d.runAi ? "pending" : "skipped",
      index_status: "pending",
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (insertError || !item) {
    console.error("Failed to create memory item:", insertError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: d.projectId,
    action: "create",
    entityType: "project_memory_items",
    entityId: item.id,
    metadata: { title: d.title, source_type: d.sourceType },
  });

  // Fire-and-forget: AI classification + vector indexing. The item is already
  // saved; pipeline failures only update ai_status / index_status.
  void import("@/lib/memory/service").then(({ processMemoryItem }) =>
    processMemoryItem(org, item.id, { runClassification: d.runAi, locale: d.locale === "es" ? "es" : "en" }).catch(() => {}),
  );

  revalidatePath(`/${d.locale}/projects/${d.projectId}/memory`, "page");
  return { memoryItemId: item.id };
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateMemoryItemAction(
  input: MemoryItemInput & { memoryItemId: string },
): Promise<{ error?: string }> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "validation_error" };
  }
  const d = parsed.data;

  const supabase = createAdminClient();

  const { error: updateError } = await supabase
    .from("project_memory_items")
    .update({
      title: d.title,
      content: d.content || null,
      summary: d.summary || null,
      source_type: d.sourceType as MemorySourceType,
      source_system: d.sourceSystem || null,
      author_name: d.authorName || null,
      author_email: d.authorEmail || null,
      participants: d.participants,
      occurred_at: d.occurredAt || null,
      importance_level: d.importanceLevel,
      tags: d.tags,
      visibility: d.visibility,
      // Content changed → re-index. Re-classify only if requested.
      index_status: "pending",
      ...(d.runAi ? { ai_status: "pending" } : {}),
    })
    .eq("id", d.memoryItemId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update memory item:", updateError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: d.projectId,
    action: "update",
    entityType: "project_memory_items",
    entityId: d.memoryItemId,
    metadata: { title: d.title },
  });

  // Fire-and-forget: re-index (and re-classify if requested).
  void import("@/lib/memory/service").then(({ processMemoryItem }) =>
    processMemoryItem(org, d.memoryItemId, { runClassification: d.runAi, locale: d.locale === "es" ? "es" : "en" }).catch(() => {}),
  );

  revalidatePath(`/${d.locale}/projects/${d.projectId}/memory`, "page");
  return {};
}

// ── Archive (soft delete) ────────────────────────────────────────────────────

export async function archiveMemoryItemAction(input: {
  memoryItemId: string;
  projectId: string;
  locale: string;
}): Promise<{ error?: string }> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("project_memory_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.memoryItemId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (error) {
    console.error("Failed to archive memory item:", error);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: input.projectId,
    action: "delete",
    entityType: "project_memory_items",
    entityId: input.memoryItemId,
    metadata: { soft_delete: true },
  });

  // Remove from the vector index so it can't surface in search.
  void import("@/lib/memory/service").then(({ deindexMemoryItem }) =>
    deindexMemoryItem(org.organizationId, input.memoryItemId).catch(() => {}),
  );

  revalidatePath(`/${input.locale}/projects/${input.projectId}/memory`, "page");
  return {};
}

// ── Re-run AI classification ──────────────────────────────────────────────────

export async function reclassifyMemoryItemAction(input: {
  memoryItemId: string;
  projectId: string;
  locale: string;
}): Promise<{ error?: string }> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("project_memory_items")
    .update({ ai_status: "pending" })
    .eq("id", input.memoryItemId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (error) return { error: "unexpected" };

  void import("@/lib/memory/service").then(({ processMemoryItem }) =>
    processMemoryItem(org, input.memoryItemId, { runClassification: true, locale: input.locale === "es" ? "es" : "en" }).catch(() => {}),
  );

  revalidatePath(`/${input.locale}/projects/${input.projectId}/memory`, "page");
  return {};
}

// ── Entity linking (reuses traceability_links) ────────────────────────────────

export async function linkMemoryItemAction(input: {
  memoryItemId: string;
  targetType: string;
  targetId: string;
  linkType?: string;
  projectId: string;
  locale: string;
}): Promise<{ error?: string; linkId?: string }> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const schema = z.object({
    memoryItemId: z.string().uuid(),
    targetType: z.enum(LINK_TARGET_TYPES),
    targetId: z.string().uuid(),
    linkType: z.enum(LINK_TYPES).default("related_to"),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const d = parsed.data;

  const supabase = createAdminClient();

  // Dedupe: same memory → same target.
  const { data: existing } = await supabase
    .from("traceability_links")
    .select("id")
    .eq("organization_id", org.organizationId)
    .eq("source_type", "memory")
    .eq("source_id", d.memoryItemId)
    .eq("target_type", d.targetType)
    .eq("target_id", d.targetId)
    .maybeSingle();
  if (existing) return { error: "duplicate" };

  const { data: link, error } = await supabase
    .from("traceability_links")
    .insert({
      organization_id: org.organizationId,
      source_type: "memory",
      source_id: d.memoryItemId,
      target_type: d.targetType,
      target_id: d.targetId,
      link_type: d.linkType,
      created_by: org.userId,
    })
    .select("id")
    .single();

  if (error || !link) {
    console.error("Failed to link memory item:", error);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: input.projectId,
    action: "create",
    entityType: "traceability_links",
    entityId: link.id,
    metadata: { source_type: "memory", target_type: d.targetType, link_type: d.linkType },
  });

  revalidatePath(`/${input.locale}/projects/${input.projectId}/memory`, "page");
  return { linkId: link.id };
}

export async function unlinkMemoryItemAction(input: {
  linkId: string;
  projectId: string;
  locale: string;
}): Promise<{ error?: string }> {
  const __g = await requireProjectContributor(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("traceability_links")
    .delete()
    .eq("id", input.linkId)
    .eq("organization_id", org.organizationId)
    .eq("source_type", "memory");

  if (error) return { error: "unexpected" };

  await logAudit({
    org,
    projectId: input.projectId,
    action: "delete",
    entityType: "traceability_links",
    entityId: input.linkId,
    metadata: { hard_delete: true, source_type: "memory" },
  });

  revalidatePath(`/${input.locale}/projects/${input.projectId}/memory`, "page");
  return {};
}
