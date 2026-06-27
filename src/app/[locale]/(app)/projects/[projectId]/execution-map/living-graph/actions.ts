"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { removeOrphanGraphNodes } from "@/lib/roadmap/living-graph-sync";

/**
 * Recalculate the Living Graph for a project:
 *   1. Remove process_nodes whose source milestone/task no longer exists (orphans
 *      left behind by deletions made before cascade cleanup existed).
 *   2. Re-run backfill_living_graph to (re)create any missing nodes/edges.
 * Edges cascade on node delete (process_edges FK ON DELETE CASCADE).
 */
export async function refreshLivingGraphAction(input: {
  projectId: string;
}): Promise<{ ok?: boolean; removed?: number; error?: string }> {
  const parsed = z.object({ projectId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };
  const { projectId } = parsed.data;

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();
  try {
    // Verify the project belongs to the caller's organization.
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .single();
    if (!project) return { error: "not_found" };

    const removed = await removeOrphanGraphNodes(supabase, org.organizationId, projectId);

    // Recreate any missing nodes/edges from current data (idempotent RPC).
    await supabase.rpc("backfill_living_graph", { p_filter_project_id: projectId }).then(
      () => null,
      (err) => console.error("backfill_living_graph failed:", err),
    );

    revalidatePath(`/projects/${projectId}/execution-map/living-graph`);
    return { ok: true, removed };
  } catch (err) {
    console.error("refreshLivingGraphAction failed:", err);
    return { error: "refresh_failed" };
  }
}
