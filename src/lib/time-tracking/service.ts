import "server-only";

// ============================================================================
// ProjectOps360° — Time Tracking Engine · Data access (server-only)
// ============================================================================
// Every read is org- and project-scoped. Actual hours are produced HERE, by
// summing subtask_time_entries — no caller ever reads a hand-typed number.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import { sumHours, sumHoursBy, roundHours, computeEffort, computeTaskEffort } from "./effort";
import type { EffortSummary, TimeEntry } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

const ENTRY_SELECT =
  "id, organization_id, project_id, task_id, subtask_id, user_id, work_date, start_time, end_time, duration_hours, crew_size, hours_per_person, comment, source, created_by, updated_by, created_at, updated_at, deleted_at";

/** Entries for one subtask, newest work first. */
export async function listSubtaskTimeEntries(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  subtaskId: string,
): Promise<TimeEntry[]> {
  const { data } = await supabase
    .from("subtask_time_entries")
    .select(ENTRY_SELECT)
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .eq("subtask_id", subtaskId)
    .is("deleted_at", null)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as TimeEntry[]).map((e) => ({
    ...e,
    duration_hours: Number(e.duration_hours),
    crew_size: Number(e.crew_size ?? 1),
    hours_per_person: e.hours_per_person == null ? null : Number(e.hours_per_person),
  }));
}

/** Total logged hours for one subtask — the canonical "actual hours". */
export async function getSubtaskActualHours(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  subtaskId: string,
): Promise<number> {
  const { data } = await supabase
    .from("subtask_time_entries")
    .select("duration_hours")
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .eq("subtask_id", subtaskId)
    .is("deleted_at", null);
  return sumHours((data ?? []) as { duration_hours: number }[]);
}

/** Totals per subtask for a whole task, in one round trip. */
export async function getTaskSubtaskHours(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("subtask_time_entries")
    .select("subtask_id, duration_hours")
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .eq("task_id", taskId)
    .is("deleted_at", null);
  return sumHoursBy((data ?? []) as { subtask_id: string | null; duration_hours: number }[], (e) => e.subtask_id);
}

/** Logged hours per task across a project (or the whole org when unscoped). */
export async function getLoggedHoursByTask(
  supabase: Admin,
  organizationId: string,
  projectId?: string | null,
  rowCap = 20000,
): Promise<Map<string, number>> {
  let query = supabase
    .from("subtask_time_entries")
    .select("task_id, duration_hours")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .limit(rowCap);
  if (projectId) query = query.eq("project_id", projectId);
  const { data } = await query;
  return sumHoursBy((data ?? []) as { task_id: string; duration_hours: number }[], (e) => e.task_id);
}

/**
 * Refresh task_subtasks.actual_hours from the entries.
 *
 * The column is a DERIVED CACHE (guard SUBTASK-ACTUAL-HOURS-DERIVED): it exists
 * so the map, the parent-progress engine and the report keep reading one number
 * without a join, but the entries remain the source of truth. Nothing else in
 * the product may write it.
 */
export async function refreshSubtaskActualHours(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  subtaskId: string,
): Promise<number> {
  const total = await getSubtaskActualHours(supabase, org, projectId, subtaskId);
  const { error } = await supabase
    .from("task_subtasks")
    .update({ actual_hours: total })
    .eq("id", subtaskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (error) console.error("[time-tracking] actual_hours cache refresh failed:", error.message);
  return roundHours(total);
}

// ── Task level ───────────────────────────────────────────────────────────────
// A task's actual hours are SUM(duration_hours) over every entry carrying its
// task_id. Because every row — task-level or subtask-level — stores task_id,
// that single sum already includes both, and includes each entry exactly once.
// There is deliberately no "task hours + subtask hours" addition anywhere: that
// is precisely how double counting would get in.

/** Every entry for a task, its own and its subtasks', newest work first. */
export async function listTaskTimeEntries(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
): Promise<TimeEntry[]> {
  const { data } = await supabase
    .from("subtask_time_entries")
    .select(ENTRY_SELECT)
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as TimeEntry[]).map((e) => ({
    ...e,
    duration_hours: Number(e.duration_hours),
    crew_size: Number(e.crew_size ?? 1),
    hours_per_person: e.hours_per_person == null ? null : Number(e.hours_per_person),
  }));
}

/**
 * Total logged hours for a task — the canonical consolidated "actual hours".
 * Includes time logged directly on the task and time logged on any of its
 * subtasks, each entry counted once.
 */
export async function getTaskActualHours(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
): Promise<number> {
  const { data } = await supabase
    .from("subtask_time_entries")
    .select("duration_hours")
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .eq("task_id", taskId)
    .is("deleted_at", null);
  return sumHours((data ?? []) as { duration_hours: number }[]);
}

/**
 * Refresh roadmap_tasks.actual_hours from the entries.
 *
 * The task-level twin of refreshSubtaskActualHours, and the reason logged time
 * used to vanish above the subtask: the engine kept the subtask cache current
 * but never rolled up, so every task-level reader (task detail, execution map
 * parent node, PMO Living Graph, the old dashboard card) read a column nothing
 * ever wrote and showed 0h. Same rule as the subtask cache — DERIVED, written
 * only here, always rebuildable from the entries.
 */
export async function refreshTaskActualHours(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
): Promise<number> {
  const total = await getTaskActualHours(supabase, org, projectId, taskId);
  const { error } = await supabase
    .from("roadmap_tasks")
    .update({ actual_hours: total })
    .eq("id", taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (error) console.error("[time-tracking] task actual_hours cache refresh failed:", error.message);
  return roundHours(total);
}

/**
 * Effort standing for ONE task — the single source every task-level surface
 * reads (modal, detail, report, Isabella and the future EVM engine), so none of
 * them can drift into its own arithmetic.
 */
export async function getTaskEffortSummary(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
  thresholds?: Parameters<typeof computeEffort>[2],
): Promise<EffortSummary> {
  const [{ data: task }, { data: subtasks }, { data: entries }] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select("estimated_labor_hours, estimate_hours")
      .eq("id", taskId)
      .eq("organization_id", org.organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("task_subtasks")
      .select("estimated_hours, status")
      .eq("task_id", taskId)
      .eq("organization_id", org.organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null),
    supabase
      .from("subtask_time_entries")
      .select("duration_hours")
      .eq("organization_id", org.organizationId)
      .eq("project_id", projectId)
      .eq("task_id", taskId)
      .is("deleted_at", null),
  ]);

  const t = task as { estimated_labor_hours: number | null; estimate_hours: number | null } | null;
  // The arithmetic itself lives in computeTaskEffort (pure, exhaustively tested);
  // this function's only job is to fetch the rows it needs.
  return computeTaskEffort(
    {
      taskEstimatedHours: t?.estimated_labor_hours ?? t?.estimate_hours ?? null,
      subtasks: ((subtasks ?? []) as { estimated_hours: number | null; status: string }[]).map((s) => ({
        estimatedHours: s.estimated_hours,
        status: s.status,
      })),
      entries: (entries ?? []) as { duration_hours: number }[],
    },
    thresholds,
  );
}

/** Display names for the people behind a set of entries. */
export async function resolveUserNames(
  supabase: Admin,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  // Resolved by id, never re-filtered by organization_id — a profile's home org
  // is not every org it works in, and that mistake blanks multi-org people
  // (REG-038).
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  return new Map(((data ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name || ""]));
}
