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
import { computeEffort, roundHours, consolidatedEstimatedHours, PORTFOLIO_THRESHOLDS } from "./effort";
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
      .select("task_id, subtask_id, duration_hours")
      .eq("organization_id", organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);

  // Estimates per task, then summed — the SAME consolidation the task modal and
  // the report use (consolidatedEstimatedHours), so a task's hours read the same
  // everywhere instead of each surface rolling its own arithmetic.
  const subtaskEstimatesByTask = new Map<string, (number | null)[]>();
  for (const s of (subtasks ?? []) as { task_id: string; estimated_hours: number | null; status: string }[]) {
    if (s.status === "cancelled") continue;
    const list = subtaskEstimatesByTask.get(s.task_id) ?? [];
    list.push(s.estimated_hours);
    subtaskEstimatesByTask.set(s.task_id, list);
  }

  let estimated = 0;
  for (const t of (tasks ?? []) as { id: string; estimated_labor_hours: number | null; estimate_hours: number | null }[]) {
    estimated += consolidatedEstimatedHours(
      t.estimated_labor_hours ?? t.estimate_hours ?? null,
      subtaskEstimatesByTask.get(t.id) ?? [],
    ) ?? 0;
  }

  const rows = (entries ?? []) as { task_id: string; subtask_id: string | null; duration_hours: number }[];
  const actual = rows.reduce((sum, e) => sum + (Number(e.duration_hours) || 0), 0);
  // Counted by WORK ITEM, so a task logged directly (subtask_id NULL) counts too
  // — keying this on subtask_id alone reported "engine unused" for a project
  // whose time was all logged at task level.
  const itemsWithTime = new Set(rows.map((e) => e.subtask_id ?? `task:${e.task_id}`)).size;

  return {
    ...computeEffort(estimated > 0 ? roundHours(estimated) : null, roundHours(actual), PORTFOLIO_THRESHOLDS),
    itemsWithTime,
  };
}
