"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { env } from "@/lib/env";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface MemorySearchResult {
  id: string;
  title: string;
  snippet: string;
  sourceType: string;
  occurredAt: string | null;
  matchType: "semantic" | "keyword";
  similarity?: number | null;
  /** memory | task | work_item | decision | risk | meeting | communication | document */
  entityType: string;
  /** For non-memory results, where to open them (memory results open the panel). */
  href?: string | null;
  /** For memory notes: how many artifacts (tasks/decisions/risks) it generated. */
  generatedCount?: number;
}

interface MemorySearchInput {
  projectId: string;
  query: string;
}

// Locale-less paths — the UI renders them via the i18n Link which localizes.
const projectHrefBase = (projectId: string) => `/projects/${projectId}`;
function hrefForEntity(base: string, type: string, id: string): string {
  switch (type) {
    case "work_item": return `${base}/delivery`;
    case "task": return `${base}/workboard?task=${id}`;
    case "decision": return `${base}/decisions/${id}`;
    case "meeting": return `${base}/meetings/${id}`;
    case "communication": return `${base}/communications`;
    case "document": return `${base}/documents/${id}`;
    default: return base; // risk and others open the project home
  }
}

// ── Server Action ────────────────────────────────────────────────────────────────

/**
 * Semantic + keyword search over a single project's memory items.
 * ALWAYS scoped to the caller's organization AND the given project — memory
 * from another project or org can never surface here.
 */
export async function searchMemoryAction(
  input: MemorySearchInput,
): Promise<MemorySearchResult[]> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return [];
  }

  const query = input.query.trim();
  if (!query) return [];

  const supabase = createAdminClient();
  const { projectId } = input;
  const queryLower = query.toLowerCase();

  const snippet = (...texts: (string | null | undefined)[]): string => {
    const all = texts.filter(Boolean).join(" ");
    const idx = all.toLowerCase().indexOf(queryLower);
    if (idx === -1) return all.slice(0, 160);
    const start = Math.max(0, idx - 60);
    const end = Math.min(all.length, idx + query.length + 100);
    let s = all.slice(start, end);
    if (start > 0) s = "…" + s;
    if (end < all.length) s += "…";
    return s;
  };

  const semanticIds = new Set<string>();
  const semantic: MemorySearchResult[] = [];

  // ── Semantic (pgvector via match_documents, filtered to memory) ───────────
  if (env.OPENAI_API_KEY) {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const embed = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        dimensions: 1536,
      });
      const queryEmbedding = embed.data[0]?.embedding;

      if (queryEmbedding) {
        const { data: matches } = await supabase.rpc("match_documents", {
          query_embedding: queryEmbedding,
          match_threshold: 0.6,
          match_count: 20,
          filter_organization_id: org.organizationId,
          filter_project_id: projectId,
        });

        const base = projectHrefBase(projectId);
        for (const m of (matches ?? []) as Array<{
          id: string; entity_type: string; title: string; content: string; similarity: number;
        }>) {
          const isMemory = m.entity_type === "memory";
          if (isMemory) semanticIds.add(m.id);
          semantic.push({
            id: m.id,
            title: m.title || "Untitled",
            snippet: m.content?.slice(0, 160) || "",
            // Memory rows get their source_type filled below; others show their kind.
            sourceType: isMemory ? "" : m.entity_type,
            occurredAt: null,
            matchType: "semantic",
            similarity: m.similarity,
            entityType: m.entity_type,
            href: isMemory ? null : hrefForEntity(base, m.entity_type, m.id),
          });
        }
      }
    } catch (err) {
      // Non-fatal — fall back to keyword only.
      console.error("Memory semantic search failed:", err);
    }
  }

  // ── Keyword fallback / supplement ─────────────────────────────────────────
  const { data: items } = await supabase
    .from("project_memory_items")
    .select("id, title, summary, content, source_type, occurred_at, tags")
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const keyword: MemorySearchResult[] = [];
  for (const it of items ?? []) {
    const tags = Array.isArray(it.tags) ? (it.tags as string[]).join(" ") : "";
    const hay = [it.title, it.summary, it.content, tags].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(queryLower)) continue;

    // Enrich semantic hits with source/date; skip pure dupes.
    const sem = semantic.find((s) => s.id === it.id);
    if (sem) {
      sem.sourceType = it.source_type ?? "manual_note";
      sem.occurredAt = it.occurred_at;
      if (!sem.snippet) sem.snippet = snippet(it.summary, it.content, it.title);
      continue;
    }
    keyword.push({
      id: it.id,
      title: it.title || "Untitled",
      snippet: snippet(it.summary, it.content, it.title),
      sourceType: it.source_type ?? "manual_note",
      occurredAt: it.occurred_at,
      matchType: "keyword",
      entityType: "memory",
    });
  }

  // Fill source/date for semantic hits that had no keyword match (best effort).
  const missing = semantic.filter((s) => !s.sourceType && !semanticIds.has(`${s.id}-filled`));
  if (missing.length > 0) {
    const { data: rows } = await supabase
      .from("project_memory_items")
      .select("id, source_type, occurred_at")
      .in("id", missing.map((s) => s.id))
      .eq("organization_id", org.organizationId);
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    for (const s of missing) {
      const r = byId.get(s.id);
      if (r) {
        s.sourceType = r.source_type ?? "manual_note";
        s.occurredAt = r.occurred_at;
      }
    }
  }

  // ── Enrich memory notes with their generated-artifact count ───────────────
  const all = [...semantic, ...keyword];
  const memoryIds = all.filter((r) => r.entityType === "memory").map((r) => r.id);
  if (memoryIds.length > 0) {
    const { data: scribeRows } = await supabase
      .from("project_scribe_items")
      .select("memory_item_id, created_entity_id")
      .in("memory_item_id", memoryIds)
      .eq("organization_id", org.organizationId);
    const counts = new Map<string, number>();
    for (const r of scribeRows ?? []) {
      const mid = String((r as Record<string, unknown>).memory_item_id);
      if ((r as Record<string, unknown>).created_entity_id) counts.set(mid, (counts.get(mid) ?? 0) + 1);
    }
    for (const r of all) if (r.entityType === "memory") r.generatedCount = counts.get(r.id) ?? 0;
  }

  const semanticSorted = semantic.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  return [...semanticSorted, ...keyword];
}
