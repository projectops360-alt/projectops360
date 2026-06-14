// ============================================================================
// ProjectOps360° — Project Memory Processing Service (server-only)
// ============================================================================
// Orchestrates the post-save pipeline for a memory item:
//   1. AI classification  (runAi → memory_classification prompt → ai_runs audit)
//   2. Vector indexing    (generateAndStoreEmbedding → pgvector)
//
// Both steps are best-effort and NEVER throw: the memory item is always saved
// first by the caller. This service only updates ai_status / index_status /
// ai_classification / sentiment / summary so the UI can show pending/failed
// state (Phase 9). Safe to call fire-and-forget.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { MemoryClassification, MemorySentiment, MemoryUrgency } from "@/types/database";
import { runAi } from "@/lib/ai/service";
import { generateAndStoreEmbedding } from "@/lib/embeddings/generate";

const SENTIMENTS = new Set<MemorySentiment>(["positive", "neutral", "negative", "concerned", "mixed"]);
const URGENCIES = new Set<MemoryUrgency>(["low", "medium", "high"]);

// ── Parse the raw model JSON into a typed, sanitized classification ──────────

function parseClassification(raw: Record<string, unknown> | null): {
  classification: MemoryClassification;
  summary: string | null;
  sentiment: MemorySentiment | null;
} {
  if (!raw) return { classification: {}, summary: null, sentiment: null };

  const bool = (v: unknown): boolean | undefined =>
    typeof v === "boolean" ? v : undefined;

  const sentiment =
    typeof raw.sentiment === "string" && SENTIMENTS.has(raw.sentiment as MemorySentiment)
      ? (raw.sentiment as MemorySentiment)
      : null;

  const urgency =
    typeof raw.urgency === "string" && URGENCIES.has(raw.urgency as MemoryUrgency)
      ? (raw.urgency as MemoryUrgency)
      : undefined;

  const suggested_tags = Array.isArray(raw.suggested_tags)
    ? (raw.suggested_tags.filter((t) => typeof t === "string" && t.trim()) as string[]).slice(0, 12)
    : undefined;

  const suggested_links = Array.isArray(raw.suggested_links)
    ? (raw.suggested_links
        .filter((l): l is { entity_type: string; hint: string } =>
          !!l && typeof l === "object" &&
          typeof (l as Record<string, unknown>).entity_type === "string")
        .map((l) => ({ entity_type: String(l.entity_type), hint: String(l.hint ?? "") }))
        .slice(0, 12))
    : undefined;

  const confidence =
    typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1
      ? raw.confidence
      : undefined;

  const classification: MemoryClassification = {
    contains_decision: bool(raw.contains_decision),
    contains_risk: bool(raw.contains_risk),
    contains_action_item: bool(raw.contains_action_item),
    contains_scope_change: bool(raw.contains_scope_change),
    contains_schedule_impact: bool(raw.contains_schedule_impact),
    contains_cost_impact: bool(raw.contains_cost_impact),
    contains_stakeholder_concern: bool(raw.contains_stakeholder_concern),
    sentiment: sentiment ?? undefined,
    urgency,
    suggested_tags,
    suggested_links,
    confidence,
  };

  const summary = typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : null;

  return { classification, summary, sentiment };
}

// ── Public: run the full pipeline for one memory item ───────────────────────

/**
 * Classify + index a memory item. Fire-and-forget; never throws.
 *
 * @param org      The acting user's org context (for ai_runs attribution).
 * @param itemId   The project_memory_items row id.
 * @param options  runAi=false skips classification (e.g. user toggled AI off).
 */
export async function processMemoryItem(
  org: OrgContext,
  itemId: string,
  options: { runClassification?: boolean } = {},
): Promise<void> {
  const runClassification = options.runClassification !== false;
  const supabase = createAdminClient();

  // Fetch the item (service role — org scoping enforced explicitly).
  const { data: item } = await supabase
    .from("project_memory_items")
    .select("id, organization_id, project_id, title, content, summary, source_type, author_name, participants, tags")
    .eq("id", itemId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!item) return;

  let aiSummary: string | null = null;

  // ── Step 1: AI classification ─────────────────────────────────────────────
  if (runClassification) {
    await supabase
      .from("project_memory_items")
      .update({ ai_status: "processing" })
      .eq("id", itemId);

    try {
      const result = await runAi(org, {
        promptType: "memory_classification",
        templateVars: {
          sourceType: item.source_type ?? "manual_note",
          title: item.title ?? "",
          author: item.author_name ?? "",
          participants: Array.isArray(item.participants) ? item.participants.join(", ") : "",
          content: [item.summary, item.content].filter(Boolean).join("\n\n") || item.title || "",
        },
        sourceType: "memory",
        sourceId: itemId,
      });

      if (result.status === "completed") {
        const { classification, summary, sentiment } = parseClassification(result.parsedJson);
        aiSummary = summary;
        await supabase
          .from("project_memory_items")
          .update({
            ai_classification: classification,
            // Only fill summary/sentiment when the user didn't provide them.
            ...(item.summary ? {} : summary ? { summary } : {}),
            ...(sentiment ? { sentiment } : {}),
            ai_status: "completed",
          })
          .eq("id", itemId);
      } else {
        await supabase
          .from("project_memory_items")
          .update({ ai_status: "failed" })
          .eq("id", itemId);
      }
    } catch (err) {
      console.error(`Memory classification failed for ${itemId}:`, err);
      await supabase
        .from("project_memory_items")
        .update({ ai_status: "failed" })
        .eq("id", itemId);
    }
  } else {
    await supabase
      .from("project_memory_items")
      .update({ ai_status: "skipped" })
      .eq("id", itemId);
  }

  // ── Step 2: Vector indexing ───────────────────────────────────────────────
  await supabase
    .from("project_memory_items")
    .update({ index_status: "processing" })
    .eq("id", itemId);

  const { success } = await generateAndStoreEmbedding("project_memory_items", itemId, {
    source_type: item.source_type,
    title: item.title,
    author_name: item.author_name,
    participants: item.participants,
    tags: item.tags,
    summary: item.summary ?? aiSummary,
    content: item.content,
  });

  await supabase
    .from("project_memory_items")
    .update({ index_status: success ? "completed" : "failed" })
    .eq("id", itemId);
}

/**
 * Remove a memory item from the vector index (on archive/delete).
 * Fire-and-forget; never throws.
 */
export async function deindexMemoryItem(organizationId: string, itemId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("project_memory_items")
      .update({ embedding: null, index_status: "skipped" })
      .eq("id", itemId)
      .eq("organization_id", organizationId);
  } catch (err) {
    console.error(`Failed to deindex memory item ${itemId}:`, err);
  }
}
