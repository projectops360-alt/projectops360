// ============================================================================
// ProjectOps360° — Subtasks · Types (Task Execution Map)
// ============================================================================
// Structured subtasks inside a roadmap task, with calculated parent progress.
// The subtask layer is ADDITIVE: tasks without subtasks keep the existing
// manual progress behavior untouched (guarded by SUBTASK-PROGRESS).
// ============================================================================

export const SUBTASK_STATUSES = [
  "not_started",
  "in_progress",
  "blocked",
  "in_review",
  "completed",
  "cancelled",
] as const;

export type SubtaskStatus = (typeof SUBTASK_STATUSES)[number];

export const SUBTASK_PRIORITIES = ["p1", "p2", "p3"] as const;
export type SubtaskPriority = (typeof SUBTASK_PRIORITIES)[number];

/** Parent progress calculation modes. `auto` = hours → weighted → count. */
export const SUBTASK_PROGRESS_MODES = ["auto", "count", "weighted", "hours"] as const;
export type SubtaskProgressMode = (typeof SUBTASK_PROGRESS_MODES)[number];

/** Mirrors public.task_subtasks (migration 20260834000000). */
export interface Subtask {
  id: string;
  task_id: string;
  project_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: SubtaskStatus;
  priority: SubtaskPriority;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  weight: number | null;
  /** 0-100. Completed is always treated as 100; not_started as 0. */
  progress: number;
  is_critical: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Statuses that participate in parent progress ("active" set). */
export const ACTIVE_SUBTASK_STATUSES: readonly SubtaskStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "in_review",
  "completed",
];

export function isActiveSubtask(subtask: Pick<Subtask, "status">): boolean {
  return subtask.status !== "cancelled";
}

/** Effective progress used in every calculation mode (rules are absolute). */
export function effectiveSubtaskProgress(
  subtask: Pick<Subtask, "status" | "progress">,
): number {
  if (subtask.status === "completed") return 100;
  if (subtask.status === "not_started") return 0;
  return Math.min(100, Math.max(0, subtask.progress ?? 0));
}

/** Overdue = has a due date in the past and is not completed/cancelled. */
export function isSubtaskOverdue(
  subtask: Pick<Subtask, "status" | "due_date">,
  asOf: Date,
): boolean {
  if (!subtask.due_date) return false;
  if (subtask.status === "completed" || subtask.status === "cancelled") return false;
  const due = new Date(`${subtask.due_date.slice(0, 10)}T23:59:59.999Z`);
  return due.getTime() < asOf.getTime();
}
