// ============================================================================
// ProjectOps360° — Roadmap Progress Calculations
// ============================================================================
// Pure functions that compute progress from task and milestone data.
// No database calls — these operate on already-fetched data.
// ============================================================================

import type { Milestone, MilestoneStatus, MilestoneStatusDisplay, RoadmapTask, TaskStatus } from "@/types/database";
import { TASK_COMPLETE_STATUSES, DEPENDENCY_COMPLETE_STATUSES } from "./status-mappings";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MilestoneProgress {
  milestoneId: string;
  progressPercent: number;  // 0–100, computed from tasks
  totalTasks: number;
  doneTasks: number;
  computedStatus: MilestoneStatusDisplay;  // derived from task completion state
}

export interface RoadmapProgress {
  overallPercent: number;           // done tasks / total tasks * 100
  blockersCount: number;             // tasks + milestones with blocked/at_risk status
  currentMilestoneId: string | null;
  nextMilestoneId: string | null;
  milestones: Record<string, MilestoneProgress>;
  computedMilestoneStatuses: Record<string, MilestoneStatusDisplay>;
}

// ── Computed Milestone Status ──────────────────────────────────────────────────

/**
 * Derive a milestone's status from its tasks.
 *
 * Rules:
 * 1. If status_override_enabled and status_override_value is set, return the override value.
 * 2. If totalTasks === 0, return the stored milestone.status (can't derive from no tasks).
 * 3. If all tasks are "done" (TASK_COMPLETE_STATUSES), return "completed".
 * 4. If all tasks are "blocked", return "blocked".
 * 5. If some tasks are "blocked" (but not all), return "at_risk".
 * 6. If all non-deleted tasks are "deferred", return "deferred".
 * 7. If any task has started (not not_started/prompt_ready), return "in_progress".
 * 8. Otherwise, return "planned".
 */
export function getComputedMilestoneStatus(
  milestone: Milestone,
  tasks: RoadmapTask[],
): MilestoneStatusDisplay {
  // Rule 1: manual override takes precedence
  if (milestone.status_override_enabled && milestone.status_override_value) {
    return milestone.status_override_value;
  }

  const milestoneTasks = tasks.filter(
    (t) => t.milestone_id === milestone.id && !t.deleted_at,
  );
  const total = milestoneTasks.length;

  // Rule 2: no tasks — can't derive, use stored status
  if (total === 0) return milestone.status;

  const doneCount = milestoneTasks.filter((t) =>
    TASK_COMPLETE_STATUSES.includes(t.status),
  ).length;
  const blockedCount = milestoneTasks.filter((t) => t.status === "blocked").length;
  const deferredCount = milestoneTasks.filter((t) => t.status === "deferred").length;

  // Rule 3: all tasks complete → completed
  if (doneCount === total) return "completed";

  // Rule 4: all tasks blocked → blocked
  if (blockedCount === total) return "blocked";

  // Rule 5: some tasks blocked → at_risk
  if (blockedCount > 0) return "at_risk";

  // Rule 6: all tasks deferred → deferred (only if no done/blocked)
  if (deferredCount === total) return "deferred";

  // Rule 7: any task has started (not not_started or prompt_ready) → in_progress
  const activeCount = milestoneTasks.filter(
    (t) => !["not_started", "prompt_ready"].includes(t.status),
  ).length;
  if (activeCount > 0) return "in_progress";

  // Rule 8: no active tasks, none complete → planned
  return "planned";
}

// ── Milestone Progress ─────────────────────────────────────────────────────────

/**
 * Compute a single milestone's progress from its tasks.
 * Rule: done tasks / total tasks * 100.
 * If the milestone has no tasks, fall back to the stored progress_percent.
 */
export function computeMilestoneProgress(
  milestone: Milestone,
  tasks: RoadmapTask[],
): MilestoneProgress {
  const milestoneTasks = tasks.filter(
    (t) => t.milestone_id === milestone.id && !t.deleted_at,
  );
  const totalTasks = milestoneTasks.length;
  const doneTasks = milestoneTasks.filter((t) =>
    TASK_COMPLETE_STATUSES.includes(t.status),
  ).length;

  const progressPercent =
    totalTasks > 0
      ? Math.round((doneTasks / totalTasks) * 100)
      : milestone.progress_percent;

  return {
    milestoneId: milestone.id,
    progressPercent,
    totalTasks,
    doneTasks,
    computedStatus: getComputedMilestoneStatus(milestone, tasks),
  };
}

// ── Overall Progress ────────────────────────────────────────────────────────────

/**
 * Compute overall project progress from all roadmap tasks.
 * Rule: done tasks / total tasks * 100.
 */
export function computeOverallProgress(tasks: RoadmapTask[]): number {
  const total = tasks.length;
  if (total === 0) return 0;
  const done = tasks.filter((t) => TASK_COMPLETE_STATUSES.includes(t.status)).length;
  return Math.round((done / total) * 100);
}

// ── Blockers Count ────────────────────────────────────────────────────────────────

/**
 * Count blockers across milestones and tasks.
 * Includes milestones with computed status "blocked" or "at_risk",
 * plus tasks with status "blocked".
 */
export function countBlockers(
  milestones: Milestone[],
  tasks: RoadmapTask[],
): number {
  const blockedOrAtRiskMilestones = milestones.filter((m) => {
    const status = getComputedMilestoneStatus(m, tasks);
    return status === "blocked" || status === "at_risk";
  }).length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  return blockedOrAtRiskMilestones + blockedTasks;
}

// ── Current & Next Milestone ─────────────────────────────────────────────────────

/**
 * Find the current milestone: first milestone with computed status "in_progress".
 * Falls back to the first "planned" milestone if none are in progress.
 */
export function findCurrentMilestone(
  milestones: Milestone[],
  tasks: RoadmapTask[],
): Milestone | null {
  return (
    milestones.find((m) => getComputedMilestoneStatus(m, tasks) === "in_progress") ??
    milestones.find((m) => getComputedMilestoneStatus(m, tasks) === "planned") ??
    null
  );
}

/**
 * Find the next milestone: first planned milestone after the current one
 * (by order_index). Falls back to the first planned milestone overall.
 */
export function findNextMilestone(
  milestones: Milestone[],
  current: Milestone | null,
  tasks: RoadmapTask[],
): Milestone | null {
  if (!current) {
    return milestones.find((m) => getComputedMilestoneStatus(m, tasks) === "planned") ?? null;
  }

  // First planned milestone that comes after the current one in order
  const afterCurrent = milestones.filter(
    (m) =>
      getComputedMilestoneStatus(m, tasks) === "planned" &&
      m.order_index > current.order_index,
  );

  return afterCurrent[0] ?? milestones.find((m) => getComputedMilestoneStatus(m, tasks) === "planned") ?? null;
}

// ── Full Roadmap Progress ────────────────────────────────────────────────────────

/**
 * Compute all progress metrics for a roadmap in one pass.
 * This is the main entry point — call from the server page and pass
 * the result down to all components.
 */
export function computeRoadmapProgress(
  milestones: Milestone[],
  tasks: RoadmapTask[],
): RoadmapProgress {
  const current = findCurrentMilestone(milestones, tasks);
  const next = findNextMilestone(milestones, current, tasks);

  const milestonesMap: Record<string, MilestoneProgress> = {};
  const computedStatuses: Record<string, MilestoneStatusDisplay> = {};

  for (const m of milestones) {
    const mp = computeMilestoneProgress(m, tasks);
    milestonesMap[m.id] = mp;
    computedStatuses[m.id] = mp.computedStatus;
  }

  return {
    overallPercent: computeOverallProgress(tasks),
    blockersCount: countBlockers(milestones, tasks),
    currentMilestoneId: current?.id ?? null,
    nextMilestoneId: next?.id ?? null,
    milestones: milestonesMap,
    computedMilestoneStatuses: computedStatuses,
  };
}