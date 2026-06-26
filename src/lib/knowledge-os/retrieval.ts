// ============================================================================
// ProjectOps360° — Living Guide™ hybrid retrieval (server-only)
// ============================================================================
// Vector (match_knowledge) + lexical (match_knowledge_lexical) fused with
// Reciprocal Rank Fusion. Always scoped to global corpus + caller org, and to
// the requested language. Degrades gracefully: if OpenAI is unavailable the
// lexical half still returns results.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { ConfidenceTier, RetrievedChunk } from "./types";
import { GUIDE_EMBEDDING_DIMS, GUIDE_EMBEDDING_MODEL } from "./config";

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
  language: string;
  matchCount?: number;
  vectorThreshold?: number;
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
  const threshold = opts.vectorThreshold ?? 0.6;

  // Run both halves concurrently.
  const [vectorList, lexicalList] = await Promise.all([
    (async (): Promise<RetrievedChunk[]> => {
      const embedding = await embedQuery(q);
      if (!embedding) return [];
      const { data, error } = await supabase.rpc("match_knowledge", {
        query_embedding: embedding,
        filter_organization_id: opts.organizationId,
        filter_language: opts.language,
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
        query_text: q,
        filter_organization_id: opts.organizationId,
        filter_language: opts.language,
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

  return fuseRrf(vectorList, lexicalList).slice(0, matchCount);
}
