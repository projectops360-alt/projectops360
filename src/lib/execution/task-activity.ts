// ============================================================================
// ProjectOps360° — Canonical task activity & blocker semantics (REG-010)
// ============================================================================
// THE single source of truth for "is this task active / completed / terminal?"
// and "does it have an ACTIVE blocker?". Every rollup engine (health, capacity,
// living-graph status, project rollups) must use these helpers so blocker,
// waiting, capacity-risk, and milestone counts agree across the whole product.
//
// Hard rules (ADR-006):
//   • A completed/terminal task is NEVER an active blocker — a stale is_blocked
//     flag on a Done/Implemented/Deferred/Cancelled task is ignored (REG-008/010).
//   • Blocked requires explicit evidence: status === "blocked" OR a non-terminal
//     task carrying is_blocked = true (a PM-recorded impediment).
//   • No-owner / missing-estimate are capacity/forecast issues, NOT blockers.
// ============================================================================

import type { RoadmapTask, TaskStatus } from "@/types/database";

/** Statuses that mean the work is finished. */
export const COMPLETED_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  "done",
  "tested",
  "implemented",
]);

/** Terminal = no longer active work (completed, paused, or cancelled). */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set<string>([
  "done",
  "tested",
  "implemented",
  "deferred",
  "cancelled",
  "canceled",
  "archived",
]);

export function isCompletedStatus(status: string | null | undefined): boolean {
  return status != null && COMPLETED_STATUSES.has(status as TaskStatus);
}

export function isTerminalStatus(status: string | null | undefined): boolean {
  return status != null && TERMINAL_STATUSES.has(status);
}

/** Active = not terminal (still real, in-flight work). */
export function isActiveStatus(status: string | null | undefined): boolean {
  return !isTerminalStatus(status);
}

type TaskLike = Pick<RoadmapTask, "status" | "is_blocked">;

/**
 * Whether a task has an ACTIVE blocker (the only thing that may count as blocked).
 * A terminal task is never blocked, regardless of a stale is_blocked flag.
 */
export function hasActiveBlocker(task: TaskLike): boolean {
  if (isTerminalStatus(task.status)) return false;
  return task.status === "blocked" || task.is_blocked === true;
}

/** The blocker flag a task should EXPOSE (stale flags on terminal tasks → false). */
export function effectiveIsBlocked(task: TaskLike): boolean {
  return hasActiveBlocker(task);
}

/** A task without a person or group resource assigned (a capacity warning, not a blocker). */
export function isUnassigned(task: Pick<RoadmapTask, "assigned_to" | "assigned_resource_id">): boolean {
  return !task.assigned_to && !task.assigned_resource_id;
}
