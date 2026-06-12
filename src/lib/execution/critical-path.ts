// ============================================================================
// ProjectOps360° — Critical Path Engine (CPM)
// ============================================================================
// Pure-function Critical Path Method over roadmap_tasks + task_dependencies.
// Forward pass (earliest start/finish), backward pass (latest start/finish),
// total float, critical flag. Supports all four dependency types with
// lag/lead days, explicit date constraints (SNET), and external blockers
// (material deliveries, RFIs, submittals) expressed as not-before constraints.
//
// Dates are calendar days. Working-day calendars plug in later via the
// availability_calendars concept without changing this engine's interface.
// ============================================================================

import type { RoadmapTask, TaskDependency, DependencyType } from "@/types/database";

// ── Types ───────────────────────────────────────────────────────────────────

/** External not-before constraint on a task (material delivery, RFI answer
 *  due date, submittal approval, permit, etc.). */
export interface ScheduleConstraint {
  taskId: string;
  /** ISO date the task cannot start before. */
  notBeforeDate: string;
  /** Why: 'material' | 'rfi' | 'submittal' | 'inspection' | 'permit' | 'resource' | 'other' */
  reason: string;
  /** Optional id of the entity imposing the constraint. */
  sourceEntityId?: string;
}

export interface TaskScheduleResult {
  taskId: string;
  durationDays: number;
  /** Day offsets from project anchor (0-based). */
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number;
  isCritical: boolean;
  /** True when float is in (0, nearCriticalThreshold]. */
  isNearCritical: boolean;
  /** ISO dates resolved against the project anchor date. */
  earliestStartDate: string;
  earliestFinishDate: string;
  latestStartDate: string;
  latestFinishDate: string;
  /** Constraints that pushed this task's earliest start. */
  activeConstraints: ScheduleConstraint[];
}

export interface CriticalPathResult {
  anchorDate: string;
  tasks: Map<string, TaskScheduleResult>;
  criticalTaskIds: string[];
  /** Tasks in dependency cycles — excluded from scheduling. */
  cycleTaskIds: string[];
  projectDurationDays: number;
  projectEarliestFinishDate: string;
}

interface CpmEdge {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

// ── Date helpers ────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function parseDay(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY);
}

function dayToIso(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

// ── Engine ──────────────────────────────────────────────────────────────────

const NEAR_CRITICAL_THRESHOLD_DAYS = 3;

/**
 * Calculate the critical path for a set of tasks.
 *
 * @param tasks        Active tasks (completed/cancelled tasks may be included;
 *                     they participate as zero-float history if dated).
 * @param dependencies Structured task_dependencies rows.
 * @param constraints  External not-before constraints (materials, RFIs, …).
 * @param anchorDate   Project start anchor; defaults to the earliest task
 *                     start_date, or today when no task is dated.
 */
export function calculateCriticalPath(
  tasks: Pick<
    RoadmapTask,
    "id" | "start_date" | "end_date" | "duration_days" | "estimate_hours" | "status"
  >[],
  dependencies: Pick<
    TaskDependency,
    "predecessor_id" | "successor_id" | "dependency_type" | "lag_days"
  >[],
  constraints: ScheduleConstraint[] = [],
  anchorDate?: string,
): CriticalPathResult {
  const taskIds = new Set(tasks.map((t) => t.id));

  const edges: CpmEdge[] = dependencies
    .filter((d) => taskIds.has(d.predecessor_id) && taskIds.has(d.successor_id))
    .map((d) => ({
      predecessorId: d.predecessor_id,
      successorId: d.successor_id,
      type: d.dependency_type,
      lagDays: d.lag_days ?? 0,
    }));

  // ── Anchor ────────────────────────────────────────────────────────────────
  const datedStarts = tasks
    .map((t) => t.start_date)
    .filter((d): d is string => !!d)
    .map(parseDay);
  const anchorDay = anchorDate
    ? parseDay(anchorDate)
    : datedStarts.length > 0
      ? Math.min(...datedStarts)
      : Math.floor(Date.now() / MS_PER_DAY);

  // ── Durations ─────────────────────────────────────────────────────────────
  const duration = new Map<string, number>();
  for (const t of tasks) {
    let d = t.duration_days ?? null;
    if (d == null && t.start_date && t.end_date) {
      d = Math.max(1, parseDay(t.end_date) - parseDay(t.start_date) + 1);
    }
    if (d == null && t.estimate_hours != null) {
      d = Math.max(1, Math.ceil(t.estimate_hours / 8));
    }
    duration.set(t.id, Math.max(1, d ?? 1));
  }

  // ── Topological order (Kahn) + cycle detection ────────────────────────────
  const successorsOf = new Map<string, CpmEdge[]>();
  const predecessorsOf = new Map<string, CpmEdge[]>();
  const inDegree = new Map<string, number>();
  for (const id of taskIds) inDegree.set(id, 0);
  for (const e of edges) {
    if (!successorsOf.has(e.predecessorId)) successorsOf.set(e.predecessorId, []);
    successorsOf.get(e.predecessorId)!.push(e);
    if (!predecessorsOf.has(e.successorId)) predecessorsOf.set(e.successorId, []);
    predecessorsOf.get(e.successorId)!.push(e);
    inDegree.set(e.successorId, (inDegree.get(e.successorId) ?? 0) + 1);
  }

  const order: string[] = [];
  const queue = [...taskIds].filter((id) => (inDegree.get(id) ?? 0) === 0);
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of successorsOf.get(id) ?? []) {
      const deg = (inDegree.get(e.successorId) ?? 0) - 1;
      inDegree.set(e.successorId, deg);
      if (deg === 0) queue.push(e.successorId);
    }
  }
  const scheduled = new Set(order);
  const cycleTaskIds = [...taskIds].filter((id) => !scheduled.has(id));

  // ── Constraint lookup ─────────────────────────────────────────────────────
  const constraintsByTask = new Map<string, ScheduleConstraint[]>();
  for (const c of constraints) {
    if (!scheduled.has(c.taskId)) continue;
    const list = constraintsByTask.get(c.taskId) ?? [];
    list.push(c);
    constraintsByTask.set(c.taskId, list);
  }

  // ── Forward pass ──────────────────────────────────────────────────────────
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const activeConstraints = new Map<string, ScheduleConstraint[]>();
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  for (const id of order) {
    const dur = duration.get(id)!;
    let start = 0;

    // Dependency-derived earliest start
    for (const e of predecessorsOf.get(id) ?? []) {
      if (!scheduled.has(e.predecessorId)) continue;
      const pEs = es.get(e.predecessorId)!;
      const pEf = ef.get(e.predecessorId)!;
      switch (e.type) {
        case "finish_to_start":
          start = Math.max(start, pEf + e.lagDays);
          break;
        case "start_to_start":
          start = Math.max(start, pEs + e.lagDays);
          break;
        case "finish_to_finish":
          start = Math.max(start, pEf + e.lagDays - dur);
          break;
        case "start_to_finish":
          start = Math.max(start, pEs + e.lagDays - dur);
          break;
      }
    }

    // Explicit planned start acts as start-no-earlier-than
    const planned = taskById.get(id)?.start_date;
    if (planned) {
      start = Math.max(start, parseDay(planned) - anchorDay);
    }

    // External constraints (materials, RFIs, submittals, …)
    const applied: ScheduleConstraint[] = [];
    for (const c of constraintsByTask.get(id) ?? []) {
      const cDay = parseDay(c.notBeforeDate) - anchorDay;
      if (cDay >= start) applied.push(c);
      start = Math.max(start, cDay);
    }
    activeConstraints.set(id, applied);

    es.set(id, start);
    ef.set(id, start + dur);
  }

  const projectFinish = order.length > 0 ? Math.max(...order.map((id) => ef.get(id)!)) : 0;

  // ── Backward pass ─────────────────────────────────────────────────────────
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();

  for (const id of [...order].reverse()) {
    const dur = duration.get(id)!;
    let finish = projectFinish;

    for (const e of successorsOf.get(id) ?? []) {
      if (!scheduled.has(e.successorId)) continue;
      const sLs = ls.get(e.successorId)!;
      const sLf = lf.get(e.successorId)!;
      switch (e.type) {
        case "finish_to_start":
          finish = Math.min(finish, sLs - e.lagDays);
          break;
        case "start_to_start":
          finish = Math.min(finish, sLs - e.lagDays + dur);
          break;
        case "finish_to_finish":
          finish = Math.min(finish, sLf - e.lagDays);
          break;
        case "start_to_finish":
          finish = Math.min(finish, sLf - e.lagDays + dur);
          break;
      }
    }

    lf.set(id, finish);
    ls.set(id, finish - dur);
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const results = new Map<string, TaskScheduleResult>();
  const criticalTaskIds: string[] = [];

  for (const id of order) {
    const totalFloat = ls.get(id)! - es.get(id)!;
    const isCritical = totalFloat <= 0;
    if (isCritical) criticalTaskIds.push(id);
    results.set(id, {
      taskId: id,
      durationDays: duration.get(id)!,
      earliestStart: es.get(id)!,
      earliestFinish: ef.get(id)!,
      latestStart: ls.get(id)!,
      latestFinish: lf.get(id)!,
      totalFloat,
      isCritical,
      isNearCritical: totalFloat > 0 && totalFloat <= NEAR_CRITICAL_THRESHOLD_DAYS,
      earliestStartDate: dayToIso(anchorDay + es.get(id)!),
      earliestFinishDate: dayToIso(anchorDay + ef.get(id)!),
      latestStartDate: dayToIso(anchorDay + ls.get(id)!),
      latestFinishDate: dayToIso(anchorDay + lf.get(id)!),
      activeConstraints: activeConstraints.get(id) ?? [],
    });
  }

  return {
    anchorDate: dayToIso(anchorDay),
    tasks: results,
    criticalTaskIds,
    cycleTaskIds,
    projectDurationDays: projectFinish,
    projectEarliestFinishDate: dayToIso(anchorDay + projectFinish),
  };
}

// ── Downstream impact ───────────────────────────────────────────────────────

/** All transitive successors of a task — "what does delaying this affect?" */
export function getDownstreamTaskIds(
  taskId: string,
  dependencies: Pick<TaskDependency, "predecessor_id" | "successor_id">[],
): Set<string> {
  const successors = new Map<string, string[]>();
  for (const d of dependencies) {
    const list = successors.get(d.predecessor_id) ?? [];
    list.push(d.successor_id);
    successors.set(d.predecessor_id, list);
  }
  const visited = new Set<string>();
  const stack = [...(successors.get(taskId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    stack.push(...(successors.get(id) ?? []));
  }
  return visited;
}
