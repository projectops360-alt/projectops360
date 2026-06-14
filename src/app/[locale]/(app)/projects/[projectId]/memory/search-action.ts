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
}

interface MemorySearchInput {
  projectId: string;
  query: string;
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

        for (const m of (matches ?? []) as Array<{
          id: string; entity_type: string; title: string; content: string; similarity: number;
        }>) {
          if (m.entity_type !== "memory") continue; // memory-only surface
          semanticIds.add(m.id);
          semantic.push({
            id: m.id,
            title: m.title || "Untitled",
            snippet: m.content?.slice(0, 160) || "",
            sourceType: "",
            occurredAt: null,
            matchType: "semantic",
            similarity: m.similarity,
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

  const semanticSorted = semantic.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  return [...semanticSorted, ...keyword];
}
