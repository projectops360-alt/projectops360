"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z.object({ projectId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };
  const { projectId } = parsed.data;

  const supabase = createAdminClient();
  try {
    const [milestonesRes, tasksRes, nodesRes] = await Promise.all([
      supabase
        .from("milestones")
        .select("id")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null),
      supabase
        .from("roadmap_tasks")
        .select("id")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null),
      supabase
        .from("process_nodes")
        .select("id, source_entity_type, source_entity_id")
        .eq("project_id", projectId)
        .eq("organization_id", org.organizationId)
        .is("deleted_at", null),
    ]);

    const milestoneIds = new Set((milestonesRes.data ?? []).map((m) => m.id as string));
    const taskIds = new Set((tasksRes.data ?? []).map((t) => t.id as string));

    const orphanIds = (nodesRes.data ?? [])
      .filter((n) => {
        const type = n.source_entity_type as string;
        const sid = n.source_entity_id as string | null;
        if (type === "milestones") return !sid || !milestoneIds.has(sid);
        if (type === "roadmap_tasks") return !sid || !taskIds.has(sid);
        return false;
      })
      .map((n) => n.id as string);

    if (orphanIds.length > 0) {
      // Delete in chunks to stay well within statement limits.
      for (let i = 0; i < orphanIds.length; i += 100) {
        await supabase.from("process_nodes").delete().in("id", orphanIds.slice(i, i + 100));
      }
    }

    // Recreate any missing nodes/edges from current data (idempotent RPC).
    await supabase.rpc("backfill_living_graph", { p_filter_project_id: projectId }).then(
      () => null,
      (err) => console.error("backfill_living_graph failed:", err),
    );

    revalidatePath(`/projects/${projectId}/execution-map/living-graph`);
    return { ok: true, removed: orphanIds.length };
  } catch (err) {
    console.error("refreshLivingGraphAction failed:", err);
    return { error: "refresh_failed" };
  }
}
