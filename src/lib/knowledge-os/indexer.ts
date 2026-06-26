// ============================================================================
// ProjectOps360° — Living Guide™ embedding indexer (server-only)
// ============================================================================
// Embeddings are DERIVED artifacts. The migration seeds chunks WITHOUT
// embeddings (lexical search works immediately); this indexer fills them in.
// Idempotent: only chunks with index_status 'pending'/'failed' and no embedding
// are processed. Safe to re-run. Never throws.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { GUIDE_EMBEDDING_DIMS, GUIDE_EMBEDDING_MODEL } from "./config";

export interface IndexResult {
  processed: number;
  embedded: number;
  failed: number;
  skipped: boolean;
  error?: string;
}

/**
 * Embed all curated knowledge chunks that are not yet indexed.
 * Returns a summary. If OPENAI_API_KEY is missing, skips cleanly (lexical search
 * keeps the feature usable).
 */
export async function indexPendingKnowledge(limit = 500): Promise<IndexResult> {
  if (!env.OPENAI_API_KEY) {
    return { processed: 0, embedded: 0, failed: 0, skipped: true, error: "OPENAI_API_KEY not configured" };
  }

  const supabase = createAdminClient();

  const { data: chunks, error } = await supabase
    .from("knowledge_chunks")
    .select("id, body")
    .is("embedding", null)
    .is("deleted_at", null)
    .in("index_status", ["pending", "failed"])
    .limit(limit);

  if (error) {
    return { processed: 0, embedded: 0, failed: 0, skipped: false, error: error.message };
  }
  if (!chunks || chunks.length === 0) {
    return { processed: 0, embedded: 0, failed: 0, skipped: false };
  }

  let embedded = 0;
  let failed = 0;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  for (const chunk of chunks) {
    const body = (chunk.body as string)?.trim();
    if (!body) {
      await supabase.from("knowledge_chunks").update({ index_status: "skipped" }).eq("id", chunk.id);
      continue;
    }
    try {
      const res = await openai.embeddings.create({
        model: GUIDE_EMBEDDING_MODEL,
        input: body,
        dimensions: GUIDE_EMBEDDING_DIMS,
      });
      const embedding = res.data[0]?.embedding;
      if (!embedding) throw new Error("no embedding returned");

      const { error: upErr } = await supabase
        .from("knowledge_chunks")
        .update({
          embedding,
          embedding_model: GUIDE_EMBEDDING_MODEL,
          embedding_dims: GUIDE_EMBEDDING_DIMS,
          index_status: "completed",
        })
        .eq("id", chunk.id);
      if (upErr) throw new Error(upErr.message);
      embedded++;
    } catch (err) {
      failed++;
      await supabase.from("knowledge_chunks").update({ index_status: "failed" }).eq("id", chunk.id);
      console.error(`Living Guide embed failed for chunk ${chunk.id}:`, err);
    }
  }

  return { processed: chunks.length, embedded, failed, skipped: false };
}
