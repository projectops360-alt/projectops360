"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { generateAndStoreEmbedding, type EmbeddableEntityType } from "@/lib/embeddings/generate";

// ── Types ─────────────────────────────────────────────────────────────────────────

interface BackfillResult {
  entityType: EmbeddableEntityType;
  total: number;
  succeeded: number;
  failed: number;
}

// ── Backfill Action ───────────────────────────────────────────────────────────────

/**
 * Generate embeddings for all entities that don't have one yet.
 * Processes in batches of 50 to respect OpenAI rate limits.
 * Can be called multiple times — idempotent (only processes embedding IS NULL).
 */
export async function backfillEmbeddingsAction(input: {
  projectId: string;
  entityType?: EmbeddableEntityType;
  batchSize?: number;
}): Promise<{ error?: string; results?: BackfillResult[] }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();
  const batchSize = input.batchSize ?? 50;
  const entityTypes: EmbeddableEntityType[] = input.entityType
    ? [input.entityType]
    : ["roadmap_tasks", "communication_items", "meetings", "decisions", "documents"];

  const results: BackfillResult[] = [];

  for (const entityType of entityTypes) {
    // Fetch entities without embeddings
    const { data: entities } = await supabase
      .from(entityType)
      .select("*")
      .eq("project_id", input.projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .is("embedding", null)
      .limit(batchSize);

    let succeeded = 0;
    let failed = 0;

    for (const record of entities ?? []) {
      const res = await generateAndStoreEmbedding(entityType, record.id, record);
      if (res.success) succeeded++;
      else failed++;
    }

    results.push({
      entityType,
      total: entities?.length ?? 0,
      succeeded,
      failed,
    });
  }

  return { results };
}