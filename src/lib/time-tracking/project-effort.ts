import "server-only";

// ============================================================================
// ProjectOps360° — Time Tracking · Project-level effort rollup (server-only)
// ============================================================================
// One pass over the subtasks and their time log gives the four numbers the
// dashboard shows. Estimated comes from whatever was planned (subtask estimates
// when they exist, task estimates otherwise); actual is always the time log.
// This is the same shape the EVM engine will consume as AC.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { computeEffort, roundHours, PORTFOLIO_THRESHOLDS } from "./effort";
import type { EffortSummary } from "./types";

export interface ProjectEffortSummary extends EffortSummary {
  /** How many work items have any time logged — 0 means the engine is unused. */
  itemsWithTime: number;
}

/**
 * Effort standing for a whole project.
 *
 * Estimated hours deliberately prefer SUBTASK estimates when a task has
 * subtasks: counting both would double-count the same work.
 */
export async function getProjectEffortSummary(
  organizationId: string,
  projectId: string,
): Promise<ProjectEffortSummary> {
  const supabase = createAdminClient();

  const [{ data: tasks }, { data: subtasks }, { data: entries }] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select("id, estimated_labor_hours, estimate_hours")
      .eq("organization_id", organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null),
    supabase
      .from("task_subtasks")
      .select("id, task_id, estimated_hours, status")
      .eq("organization_id", organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null),
    supabase
      .from("subtask_time_entries")
      .select("subtask_id, duration_hours")
      .eq("organization_id", organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);

  const tasksWithSubtasks = new Set(
    ((subtasks ?? []) as { task_id: string; status: string }[])
      .filter((s) => s.status !== "cancelled")
      .map((s) => s.task_id),
  );

  let estimated = 0;
  for (const s of (subtasks ?? []) as { estimated_hours: number | null; status: string }[]) {
    if (s.status === "cancelled") continue;
    estimated += Number(s.estimated_hours ?? 0);
  }
  for (const t of (tasks ?? []) as { id: string; estimated_labor_hours: number | null; estimate_hours: number | null }[]) {
    // Skip tasks whose effort is already expressed by their subtasks.
    if (tasksWithSubtasks.has(t.id)) continue;
    estimated += Number(t.estimated_labor_hours ?? t.estimate_hours ?? 0);
  }

  const rows = (entries ?? []) as { subtask_id: string | null; duration_hours: number }[];
  const actual = rows.reduce((sum, e) => sum + (Number(e.duration_hours) || 0), 0);
  const itemsWithTime = new Set(rows.map((e) => e.subtask_id).filter(Boolean)).size;

  return {
    ...computeEffort(estimated > 0 ? roundHours(estimated) : null, roundHours(actual), PORTFOLIO_THRESHOLDS),
    itemsWithTime,
  };
}
