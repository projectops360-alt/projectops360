// ============================================================================
// Living Graph sync helpers (server-only data maintenance)
// ============================================================================
// Keeps process_nodes consistent with the source milestones/tasks. Used both by
// the manual "Recalculate" action and the automatic cleanup on page load.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Removes Living Graph nodes whose source milestone/task no longer exists
 * (orphans left by deletions). Process edges cascade on node delete.
 * Cheap: 3 selects + a delete only when orphans are present. Returns the count.
 * Pass a service-role (admin) client so RLS does not block the maintenance.
 */
export async function removeOrphanGraphNodes(
  supabase: SupabaseClient,
  organizationId: string,
  projectId: string,
): Promise<number> {
  const [milestonesRes, tasksRes, nodesRes] = await Promise.all([
    supabase
      .from("milestones")
      .select("id")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("roadmap_tasks")
      .select("id")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("process_nodes")
      .select("id, source_entity_type, source_entity_id")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId)
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

  if (orphanIds.length === 0) return 0;

  for (let i = 0; i < orphanIds.length; i += 100) {
    await supabase.from("process_nodes").delete().in("id", orphanIds.slice(i, i + 100));
  }
  return orphanIds.length;
}
