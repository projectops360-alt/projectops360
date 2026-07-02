// ============================================================================
// ProjectOps360° — Canonical milestone task census (REG-018 / CAP-001)
// ============================================================================
// THE single source of truth for "which tasks belong to a milestone, and how
// many are done / started / blocked". Every projection that shows a milestone's
// task set or counts (Workboard, Living Graph milestone cards + UX-008 edge
// tooltip, dashboards) must derive it from THIS resolver over the canonical
// owner (`roadmap_tasks`) — never from a derived substrate such as
// `process_nodes` (which only materializes tasks that transitioned, so it
// silently drops `not_started` tasks). See CAP-001.
//
// Status semantics reuse the canonical task-activity rules (REG-008/010):
// terminal tasks are never active blockers; a stale is_blocked on a done task
// is ignored. Pure + deterministic. Same inputs → same outputs.
// ============================================================================

import type { RoadmapTask } from "@/types/database";
import { hasActiveBlocker, isCompletedStatus, isTerminalStatus } from "@/lib/execution/task-activity";

/** One task as surfaced in a milestone census (matches the UX-008 tooltip shape). */
export interface MilestoneTaskCensusEntry {
  id: string;
  title: string;
  status: string | null;
  /** Active impediment only — a terminal task is never blocked (REG-008/010). */
  isBlocked: boolean;
}

/** Deterministic per-milestone task rollup derived from the canonical owner. */
export interface MilestoneTaskCensus {
  tasksTotal: number;
  tasksDone: number;
  /** Non-terminal work that has left `not_started` (in progress, blocked, …). */
  tasksStarted: number;
  /** True when any non-terminal task carries an active impediment. */
  anyBlocked: boolean;
  taskList: MilestoneTaskCensusEntry[];
}

/**
 * Group the project's tasks by milestone into a canonical census. Tasks without
 * a milestone are omitted (they belong to no milestone card). This is the ONLY
 * function that produces milestone task counts/lists for projections — so every
 * view stays consistent by construction ("different views, same truth").
 */
export function computeMilestoneTaskCensus(
  tasks: readonly RoadmapTask[],
): Map<string, MilestoneTaskCensus> {
  const byMilestone = new Map<string, MilestoneTaskCensus>();

  for (const task of tasks) {
    const milestoneId = task.milestone_id;
    if (!milestoneId) continue;

    let census = byMilestone.get(milestoneId);
    if (!census) {
      census = { tasksTotal: 0, tasksDone: 0, tasksStarted: 0, anyBlocked: false, taskList: [] };
      byMilestone.set(milestoneId, census);
    }

    const blocked = hasActiveBlocker(task);
    census.tasksTotal += 1;
    if (isCompletedStatus(task.status)) census.tasksDone += 1;
    else if (!isTerminalStatus(task.status) && task.status !== "not_started") census.tasksStarted += 1;
    if (blocked) census.anyBlocked = true;
    census.taskList.push({
      id: task.id,
      title: task.title,
      status: task.status,
      isBlocked: blocked,
    });
  }

  return byMilestone;
}
