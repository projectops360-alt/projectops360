// ============================================================================
// ProjectOps360° — Knowledge OS hybrid retrieval (server-only)
// ============================================================================
// Vector (match_knowledge) + lexical (match_knowledge_lexical) fused with
// Reciprocal Rank Fusion. Scoped to global corpus + caller org.
//
// MULTILINGUAL: retrieval searches the WHOLE corpus (filter_language = NULL),
// not just the UI locale's chunks. This is the fix for the bilingual bug where
// a query in one language was matched only against the other language's chunks
// (cross-language cosine fell below threshold → empty → "AI Suggestion"). The
// best match wins regardless of language; the answer is still produced in the
// user's language (handled in the prompt). The lexical half also receives PM
// synonym expansion (Language Intelligence Layer). Degrades gracefully.
//
// QUERY DILUTION (REG-021 / KNOWLEDGE-OS-RETRIEVAL-QUERY-DILUTION): the caller
// may blend screen context (module/screen/pageTitle) into the main query — that
// helps vague asks ("how do I use this?") but DROWNS a specific ask about a
// DIFFERENT screen ("explícame el bottleneck view" asked from the Projects
// list). The LEXICAL half therefore ranks by the user's RAW question
// (`lexicalQuery`) when provided; the blended query stays on the vector half
// where the embedding absorbs context gracefully. The vector threshold is also
// calibrated for cross-language asks (a correct ES↔EN match measured ≈0.53;
// the old 0.6 filtered it out) — RRF ranking + the grounding gate handle
// precision, so the threshold only needs to cut noise, not near-matches.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { ConfidenceTier, RetrievedChunk } from "./types";
import { GUIDE_EMBEDDING_DIMS, GUIDE_EMBEDDING_MODEL } from "./config";
import { expandQueryForLexical } from "./language";

interface RawMatch {
  chunk_id: string;
  package_id: string;
  version_id: string;
  slug: string;
  language: string;
  title: string;
  body: string;
  confidence_tier: ConfidenceTier;
  similarity?: number;
  rank?: number;
}

/** RRF constant — dampens the influence of low ranks. Standard value. */
const RRF_K = 60;

/**
 * Reciprocal Rank Fusion of two ranked lists keyed by chunkId. Pure & testable.
 * Each list contributes 1/(k + rank) to a chunk's fused score; we keep the
 * richest record per chunk and attach the fused score.
 */
export function fuseRrf(
  vector: RetrievedChunk[],
  lexical: RetrievedChunk[],
  k: number = RRF_K,
): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();
  const score = new Map<string, number>();

  const absorb = (list: RetrievedChunk[]) => {
    list.forEach((chunk, idx) => {
      const contribution = 1 / (k + idx + 1);
      score.set(chunk.chunkId, (score.get(chunk.chunkId) ?? 0) + contribution);
      const existing = byId.get(chunk.chunkId);
      if (!existing) {
        byId.set(chunk.chunkId, { ...chunk });
      } else {
        // Merge signals so the surviving record carries both similarity & lexRank.
        if (chunk.similarity != null) existing.similarity = chunk.similarity;
        if (chunk.lexRank != null) existing.lexRank = chunk.lexRank;
      }
    });
  };

  absorb(vector);
  absorb(lexical);

  return Array.from(byId.values())
    .map((c) => ({ ...c, fused: score.get(c.chunkId) ?? 0 }))
    .sort((a, b) => b.fused - a.fused);
}

async function embedQuery(query: string): Promise<number[] | null> {
  if (!env.OPENAI_API_KEY) return null;
  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const res = await openai.embeddings.create({
      model: GUIDE_EMBEDDING_MODEL,
      input: query,
      dimensions: GUIDE_EMBEDDING_DIMS,
    });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("Living Guide query embedding failed:", err);
    return null;
  }
}

export interface RetrieveOptions {
  organizationId: string;
  /**
   * The user's locale. Reserved for context/telemetry — retrieval is now
   * multilingual and does NOT filter the corpus by language. The answer is
   * produced in this language at generation time.
   */
  language: string;
  matchCount?: number;
  vectorThreshold?: number;
  /**
   * The user's RAW question, WITHOUT blended screen context. When provided,
   * the lexical half ranks by this (context words like the current screen's
   * module/pageTitle must never outrank the actual topic — REG-021). Falls
   * back to the main query when empty (vague/intent-only asks).
   */
  lexicalQuery?: string;
}

/**
 * Hybrid retrieval over the curated corpus. Returns fused, ranked chunks with
 * full provenance. Never throws — returns [] on total failure.
 */
export async function retrieveKnowledge(
  query: string,
  opts: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = createAdminClient();
  const matchCount = opts.matchCount ?? 8;
  // 0.45 keeps legitimate cross-language matches (measured ≈0.53 for a correct
  // ES question ↔ EN chunk) while still cutting noise; RRF + the grounding
  // gate downstream handle precision. 0.6 silently emptied the vector half.
  const threshold = opts.vectorThreshold ?? 0.45;
  const lexicalQuery = (opts.lexicalQuery ?? "").trim() || q;

  // Run both halves concurrently.
  const [vectorList, lexicalList] = await Promise.all([
    (async (): Promise<RetrievedChunk[]> => {
      const embedding = await embedQuery(q);
      if (!embedding) return [];
      const { data, error } = await supabase.rpc("match_knowledge", {
        query_embedding: embedding,
        filter_organization_id: opts.organizationId,
        // Multilingual: search the whole corpus, not just the UI locale.
        filter_language: null,
        match_threshold: threshold,
        match_count: matchCount,
      });
      if (error) {
        console.error("match_knowledge failed:", error.message);
        return [];
      }
      return ((data ?? []) as RawMatch[]).map((m) => ({
        chunkId: m.chunk_id,
        packageId: m.package_id,
        versionId: m.version_id,
        slug: m.slug,
        language: m.language,
        title: m.title,
        body: m.body,
        confidenceTier: m.confidence_tier,
        similarity: m.similarity,
        fused: 0,
      }));
    })(),
    (async (): Promise<RetrievedChunk[]> => {
      const { data, error } = await supabase.rpc("match_knowledge_lexical", {
        // Language Intelligence: expand PM synonyms/acronyms for recall.
        // RAW question only — blended screen context must not dilute ranking.
        query_text: expandQueryForLexical(lexicalQuery),
        filter_organization_id: opts.organizationId,
        // Multilingual: the RPC parses the query in both languages; search all.
        filter_language: null,
        match_count: matchCount,
      });
      if (error) {
        console.error("match_knowledge_lexical failed:", error.message);
        return [];
      }
      return ((data ?? []) as RawMatch[]).map((m) => ({
        chunkId: m.chunk_id,
        packageId: m.package_id,
        versionId: m.version_id,
        slug: m.slug,
        language: m.language,
        title: m.title,
        body: m.body,
        confidenceTier: m.confidence_tier,
        lexRank: m.rank,
        fused: 0,
      }));
    })(),
  ]);

  // Multilingual search can return the same package in both languages; keep the
  // single best-ranked chunk per package (the user-language one usually wins on
  // similarity) so passages stay clean and provenance is unambiguous.
  return dedupeByPackage(fuseRrf(vectorList, lexicalList)).slice(0, matchCount);
}

/** Keep only the highest-ranked chunk per package (input is already RRF-sorted). */
export function dedupeByPackage(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const c of chunks) {
    if (seen.has(c.packageId)) continue;
    seen.add(c.packageId);
    out.push(c);
  }
  return out;
}
