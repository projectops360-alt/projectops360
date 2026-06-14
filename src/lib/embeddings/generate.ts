// ============================================================================
// ProjectOps360° — Embedding Generation Utility
// ============================================================================
// Generates OpenAI text-embedding-3-small vectors and stores them in Supabase.
// Called fire-and-forget after entity create/update to keep embeddings in sync.
// ============================================================================

import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// ── OpenAI client singleton ──────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAiClient(): OpenAI {
  if (!_openai) {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _openai;
}

// ── Types ─────────────────────────────────────────────────────────────────────────

export type EmbeddableEntityType =
  | "roadmap_tasks"
  | "communication_items"
  | "meetings"
  | "decisions"
  | "documents"
  | "project_memory_items";

// ── Text builder per entity type ─────────────────────────────────────────────────

function buildEmbeddingText(
  entityType: EmbeddableEntityType,
  record: Record<string, unknown>,
): string {
  // Helper to extract text from plain or i18n JSONB fields
  const get = (key: string): string => {
    const val = record[key];
    if (val === null || val === undefined) return "";
    if (Array.isArray(val)) {
      // String arrays (e.g. participants, tags): join into a flat phrase.
      return val.filter((v) => typeof v === "string" && v.trim()).join(", ");
    }
    if (typeof val === "object" && val !== null) {
      // i18n JSONB: concatenate en + es for richer embedding
      const i18n = val as Record<string, string>;
      return [i18n["en"], i18n["es"]].filter(Boolean).join(" | ");
    }
    return String(val);
  };

  switch (entityType) {
    case "roadmap_tasks":
      return [
        get("title"),
        get("description"),
        get("dependency_notes"),
        get("acceptance_criteria"),
        get("prompt_body"),
        get("prompt_context"),
        get("implementation_notes"),
        get("test_notes"),
        get("execution_notes"),
        get("blocker_reason"),
      ].filter(Boolean).join("\n");

    case "communication_items":
      return [
        get("title_i18n"),
        get("summary_i18n"),
        get("content_i18n"),
      ].filter(Boolean).join("\n");

    case "meetings":
      return [
        get("title_i18n"),
        get("summary_i18n"),
        get("agenda_i18n"),
        get("notes_i18n"),
      ].filter(Boolean).join("\n");

    case "decisions":
      return [
        get("title_i18n"),
        get("description_i18n"),
        get("rationale_i18n"),
      ].filter(Boolean).join("\n");

    case "documents":
      return [
        get("title_i18n"),
        get("description_i18n"),
      ].filter(Boolean).join("\n");

    case "project_memory_items":
      // Include all meaningful project context in the searchable text:
      // source type, author, participants, tags, summary, and full content.
      return [
        get("source_type"),
        get("title"),
        get("author_name"),
        get("participants"),
        get("tags"),
        get("summary"),
        get("content"),
      ].filter(Boolean).join("\n");

    default:
      return "";
  }
}

// ── Generate and store embedding ─────────────────────────────────────────────────

/**
 * Generates an OpenAI embedding for the given entity and stores it in Supabase.
 * Safe to call fire-and-forget: errors are logged but don't propagate.
 */
export async function generateAndStoreEmbedding(
  entityType: EmbeddableEntityType,
  entityId: string,
  record: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const text = buildEmbeddingText(entityType, record);

  if (!text.trim()) {
    // No text to embed — skip silently
    return { success: true };
  }

  try {
    const openai = getOpenAiClient();

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      return { success: false, error: "No embedding returned from OpenAI" };
    }

    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from(entityType)
      .update({ embedding })
      .eq("id", entityId);

    if (updateError) {
      console.error(`Failed to store embedding for ${entityType}/${entityId}:`, updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to generate embedding for ${entityType}/${entityId}:`, message);
    return { success: false, error: message };
  }
}