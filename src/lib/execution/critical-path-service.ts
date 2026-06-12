// ============================================================================
// ProjectOps360° — Critical Path Service (persistence layer)
// ============================================================================
// Loads a project's tasks, dependencies, and external blockers (materials,
// RFIs, submittals), runs the pure CPM engine, writes the results back to
// roadmap_tasks (is_critical, slack_days, earliest/latest dates) and records
// a critical_path_snapshot so schedule history is queryable over time.
// Server-side only.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateCriticalPath,
  type CriticalPathResult,
  type ScheduleConstraint,
} from "./critical-path";
import type { CriticalPathTrigger } from "@/types/execution";
import { RFI_BLOCKING_STATUSES, MATERIAL_AVAILABLE_STATUSES } from "./constants";

export interface RecalculateResult {
  result: CriticalPathResult;
  tasksUpdated: number;
  snapshotId: string | null;
}

/**
 * Recalculate and persist the critical path for a project.
 * Call after dependency/duration changes, material delays, RFI blockers,
 * drawing revisions, or on demand.
 */
export async function recalculateCriticalPath(
  organizationId: string,
  projectId: string,
  trigger: CriticalPathTrigger = "manual",
): Promise<RecalculateResult> {
  const supabase = createAdminClient();

  const [tasksRes, depsRes, materialsRes, rfisRes, submittalsRes, projectRes] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select("id, start_date, end_date, duration_days, estimate_hours, status")
      .eq("project_id", projectId)
      .is("deleted_at", null),
    supabase
      .from("task_dependencies")
      .select("predecessor_id, successor_id, dependency_type, lag_days")
      .eq("project_id", projectId),
    supabase
      .from("material_requirements")
      .select("id, required_by_task_id, status")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .not("required_by_task_id", "is", null),
    supabase
      .from("rfis")
      .select("id, blocks_task_id, status, due_date")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .not("blocks_task_id", "is", null),
    supabase
      .from("submittals")
      .select("id, required_before_task_id, status, due_date")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .not("required_before_task_id", "is", null),
    supabase
      .from("projects")
      .select("start_date")
      .eq("id", projectId)
      .single(),
  ]);

  const tasks = tasksRes.data ?? [];
  const deps = depsRes.data ?? [];

  // ── External blockers → not-before constraints ────────────────────────────
  // Procurement deliveries: a task can't start before its material's
  // expected delivery (procurement join kept simple: use RFI/submittal due
  // dates and material delivery expectations where present).
  const constraints: ScheduleConstraint[] = [];

  const materialIds = (materialsRes.data ?? [])
    .filter((m) => !MATERIAL_AVAILABLE_STATUSES.includes(m.status))
    .map((m) => m.id);

  if (materialIds.length > 0) {
    const { data: procurements } = await supabase
      .from("procurement_items")
      .select("material_requirement_id, expected_delivery_date")
      .in("material_requirement_id", materialIds)
      .is("deleted_at", null)
      .not("expected_delivery_date", "is", null);

    const deliveryByMaterial = new Map<string, string>(
      (procurements ?? []).map((p) => [p.material_requirement_id as string, p.expected_delivery_date as string]),
    );
    for (const m of materialsRes.data ?? []) {
      const delivery = deliveryByMaterial.get(m.id);
      if (delivery && m.required_by_task_id) {
        constraints.push({
          taskId: m.required_by_task_id,
          notBeforeDate: delivery,
          reason: "material",
          sourceEntityId: m.id,
        });
      }
    }
  }

  for (const rfi of rfisRes.data ?? []) {
    if (RFI_BLOCKING_STATUSES.includes(rfi.status) && rfi.blocks_task_id && rfi.due_date) {
      constraints.push({
        taskId: rfi.blocks_task_id,
        notBeforeDate: rfi.due_date,
        reason: "rfi",
        sourceEntityId: rfi.id,
      });
    }
  }

  for (const sub of submittalsRes.data ?? []) {
    const pending = !["approved", "approved_as_noted", "closed"].includes(sub.status);
    if (pending && sub.required_before_task_id && sub.due_date) {
      constraints.push({
        taskId: sub.required_before_task_id,
        notBeforeDate: sub.due_date,
        reason: "submittal",
        sourceEntityId: sub.id,
      });
    }
  }

  // ── Run engine ────────────────────────────────────────────────────────────
  const result = calculateCriticalPath(
    tasks,
    deps,
    constraints,
    projectRes.data?.start_date ?? undefined,
  );

  // ── Persist task fields ───────────────────────────────────────────────────
  let tasksUpdated = 0;
  for (const [taskId, r] of result.tasks) {
    const { error } = await supabase
      .from("roadmap_tasks")
      .update({
        is_critical: r.isCritical,
        slack_days: r.totalFloat,
        earliest_start: r.earliestStartDate,
        earliest_finish: r.earliestFinishDate,
        latest_start: r.latestStartDate,
        latest_finish: r.latestFinishDate,
      })
      .eq("id", taskId)
      .eq("organization_id", organizationId);
    if (!error) tasksUpdated++;
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────
  const { data: snapshot } = await supabase
    .from("critical_path_snapshots")
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      trigger_reason: trigger,
      task_count: result.tasks.size,
      critical_task_ids: result.criticalTaskIds,
      project_duration_days: result.projectDurationDays,
      project_earliest_finish: result.projectEarliestFinishDate,
      summary: {
        anchor_date: result.anchorDate,
        cycle_task_ids: result.cycleTaskIds,
        constraint_count: constraints.length,
        constraints_applied: constraints.map((c) => ({
          task_id: c.taskId,
          reason: c.reason,
          not_before: c.notBeforeDate,
        })),
      },
    })
    .select("id")
    .single();

  return { result, tasksUpdated, snapshotId: snapshot?.id ?? null };
}
