// ============================================================================
// PMO Simulation — Stage: Schedule (CAP-049 · intervention B)
// ============================================================================
// Propagation is delegated ENTIRELY to `calculateCriticalPath`, the same pure
// CPM the product already uses. This stage's only job is to edit dates on a
// COPY of the tasks and hand that copy to the engine.
//
// Why not walk the dependency graph here: a second implementation of "what
// moves when this moves" would drift from the first, and the two would disagree
// on exactly the projects a PMO cares about. Reusing the engine also means the
// simulator inherits its cycle detection for free — `cycleTaskIds` is reported,
// not worked around.
//
// `recalculateCriticalPath` is deliberately NOT used: it writes to the
// database. A simulation that persists is not a simulation.
// ============================================================================

import {
  calculateCriticalPath,
  getDownstreamTaskIds,
  type CriticalPathResult,
} from "@/lib/execution/critical-path";
import type { SimBaseline, SimTaskRow, SimWorkingCopy } from "../baseline";
import type { SimCausalStep, SimMetric, SimScheduleIntervention } from "../contracts";

export interface ScheduleStageOutcome {
  interventionId: string;
  computable: boolean;
  notComputableReason: string | null;
  affectedNodeIds: string[];
  metrics: SimMetric[];
  causalSteps: SimCausalStep[];
  assumptions: string[];
}

const MS_PER_DAY = 86_400_000;

function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Tasks an intervention targets: a task directly, or every task under a scope. */
export function tasksForTarget(
  target: SimScheduleIntervention["target"],
  tasks: readonly SimTaskRow[],
): SimTaskRow[] {
  switch (target.kind) {
    case "task":
      return tasks.filter((task) => task.id === target.id);
    case "milestone":
      return tasks.filter((task) => task.milestone_id === target.id);
    case "project":
      return tasks.filter((task) => task.project_id === target.id);
    default:
      return [];
  }
}

/**
 * Edit the working copy for one schedule intervention.
 *
 * Returns the directly-edited task ids. Downstream movement is NOT computed
 * here — it emerges from the CPM re-run once every intervention has been
 * applied, which is what stops two interventions on the same chain from
 * double-counting their propagation.
 */
export function applyScheduleIntervention(
  intervention: SimScheduleIntervention,
  working: SimWorkingCopy,
): { editedTaskIds: string[]; notComputableReason: string | null; assumptions: string[] } {
  const assumptions: string[] = [];
  const targets = tasksForTarget(intervention.target, working.tasks);

  if (targets.length === 0) {
    return { editedTaskIds: [], notComputableReason: "no_tasks_for_target", assumptions };
  }

  const undated = targets.filter((task) => task.start_date == null && task.end_date == null);
  if (undated.length === targets.length && intervention.newDurationDays == null) {
    // Shifting a task with no dates by N days is meaningless. Rather than
    // fabricate an anchor, the intervention is kept and declared uncomputable.
    return { editedTaskIds: [], notComputableReason: "target_tasks_have_no_dates", assumptions };
  }

  const edited: string[] = [];
  for (const task of targets) {
    let touched = false;

    if (intervention.newStartDate != null) {
      task.start_date = intervention.newStartDate;
      touched = true;
    }
    if (intervention.newEndDate != null) {
      task.end_date = intervention.newEndDate;
      touched = true;
    }
    if (intervention.newDurationDays != null) {
      task.duration_days = Math.max(1, intervention.newDurationDays);
      // end_date would contradict the new duration; the CPM derives it.
      if (task.start_date != null) task.end_date = null;
      touched = true;
    }
    if (intervention.delayDays != null && intervention.delayDays !== 0) {
      if (task.start_date != null) {
        task.start_date = shiftIso(task.start_date, intervention.delayDays);
        touched = true;
      }
      if (task.end_date != null) {
        task.end_date = shiftIso(task.end_date, intervention.delayDays);
        touched = true;
      }
    }

    if (touched) edited.push(task.id);
  }

  if (edited.length === 0) {
    return { editedTaskIds: [], notComputableReason: "target_tasks_have_no_dates", assumptions };
  }
  if (undated.length > 0) {
    assumptions.push("schedule_undated_tasks_in_scope_left_unchanged");
  }

  return { editedTaskIds: edited, notComputableReason: null, assumptions };
}

/** Run the shared CPM over a task set. Pure; the input is never mutated. */
export function runCpm(
  tasks: readonly SimTaskRow[],
  dependencies: SimBaseline["dependencies"],
  anchorDate?: string,
): CriticalPathResult {
  return calculateCriticalPath(
    tasks.map((task) => ({
      id: task.id,
      start_date: task.start_date,
      end_date: task.end_date,
      duration_days: task.duration_days,
      estimate_hours: task.estimate_hours,
      status: task.status,
    })),
    dependencies.map((dep) => ({
      predecessor_id: dep.predecessor_id,
      successor_id: dep.successor_id,
      dependency_type: dep.dependency_type,
      // The CPM treats a missing lag as zero; normalising here keeps that
      // decision in one place instead of relying on the engine's default.
      lag_days: dep.lag_days ?? 0,
    })),
    [],
    anchorDate,
  );
}

/** Total float per task, used by the DERIVED_PROXY day rule. */
export function floatByTask(result: CriticalPathResult): Map<string, number> {
  const map = new Map<string, number>();
  for (const [id, task] of result.tasks) map.set(id, task.totalFloat);
  return map;
}

/**
 * Compare two CPM runs and describe what moved.
 *
 * Both runs are anchored to the SAME date. Letting each pick its own anchor
 * would silently re-base the comparison — every task would look unmoved because
 * the origin moved with them.
 */
export function scheduleMetrics(
  baselineCpm: CriticalPathResult,
  simulatedCpm: CriticalPathResult,
): SimMetric[] {
  const finishDelta =
    simulatedCpm.projectDurationDays - baselineCpm.projectDurationDays;

  let movedTasks = 0;
  for (const [id, simulated] of simulatedCpm.tasks) {
    const base = baselineCpm.tasks.get(id);
    if (base && base.earliestStart !== simulated.earliestStart) movedTasks += 1;
  }

  return [
    {
      key: "portfolio_finish_days",
      unit: "days",
      baseline: baselineCpm.projectDurationDays,
      simulated: simulatedCpm.projectDurationDays,
      delta: finishDelta,
      engine: "cpm",
      provenance: "OBSERVED",
      unavailableReason: null,
    },
    {
      key: "critical_tasks",
      unit: "count",
      baseline: baselineCpm.criticalTaskIds.length,
      simulated: simulatedCpm.criticalTaskIds.length,
      delta: simulatedCpm.criticalTaskIds.length - baselineCpm.criticalTaskIds.length,
      engine: "cpm",
      provenance: "OBSERVED",
      unavailableReason: null,
    },
    {
      key: "tasks_moved",
      unit: "count",
      baseline: 0,
      simulated: movedTasks,
      delta: movedTasks,
      engine: "cpm",
      provenance: "OBSERVED",
      unavailableReason: null,
    },
  ];
}

/**
 * Build the causal chain for one schedule intervention:
 * intervention → task → dependency → milestone → project → metric.
 *
 * Every step cites the canonical row that justifies it. `getDownstreamTaskIds`
 * is the same helper the execution module uses, so "what does this affect"
 * has one answer across the product.
 */
export function scheduleCausalChain(
  intervention: SimScheduleIntervention,
  editedTaskIds: readonly string[],
  baseline: SimBaseline,
  baselineCpm: CriticalPathResult,
  simulatedCpm: CriticalPathResult,
): { steps: SimCausalStep[]; affectedNodeIds: string[] } {
  const steps: SimCausalStep[] = [
    { kind: "intervention", id: intervention.id, label: intervention.label, evidence: null },
  ];

  const affected = new Set<string>();
  const taskById = new Map(baseline.tasks.map((task) => [task.id, task]));
  const milestoneIds = new Set<string>();
  const projectIds = new Set<string>();

  for (const taskId of editedTaskIds) {
    const task = taskById.get(taskId);
    if (!task) continue;
    affected.add(`task:${taskId}`);
    steps.push({
      kind: "node",
      id: `task:${taskId}`,
      label: task.title,
      evidence: { sourceTable: "roadmap_tasks", sourceId: taskId },
    });
    if (task.milestone_id) milestoneIds.add(task.milestone_id);
    projectIds.add(task.project_id);
  }

  // Downstream tasks that genuinely moved — a real dependency edge AND an
  // observed change in earliest start. Listing every successor regardless of
  // whether it shifted would overstate the blast radius.
  const downstream = new Set<string>();
  const edgeList = baseline.dependencies.map((dep) => ({
    predecessor_id: dep.predecessor_id,
    successor_id: dep.successor_id,
  }));
  for (const taskId of editedTaskIds) {
    for (const id of getDownstreamTaskIds(taskId, edgeList)) downstream.add(id);
  }
  for (const id of downstream) {
    const base = baselineCpm.tasks.get(id);
    const simulated = simulatedCpm.tasks.get(id);
    if (!base || !simulated || base.earliestStart === simulated.earliestStart) continue;
    const task = taskById.get(id);
    affected.add(`task:${id}`);
    steps.push({
      kind: "dependency",
      id: `task:${id}`,
      label: task?.title ?? id,
      evidence: { sourceTable: "task_dependencies", sourceId: id },
    });
    if (task?.milestone_id) milestoneIds.add(task.milestone_id);
    if (task) projectIds.add(task.project_id);
  }

  for (const milestoneId of milestoneIds) {
    const milestone = baseline.milestones.find((row) => row.id === milestoneId);
    affected.add(`milestone:${milestoneId}`);
    steps.push({
      kind: "milestone",
      id: `milestone:${milestoneId}`,
      label: milestone?.title ?? milestoneId,
      evidence: { sourceTable: "milestones", sourceId: milestoneId },
    });
  }

  for (const projectId of projectIds) {
    const project = baseline.projects.find((row) => row.id === projectId);
    affected.add(`project:${projectId}`);
    steps.push({
      kind: "project",
      id: `project:${projectId}`,
      label: project?.title ?? projectId,
      evidence: { sourceTable: "projects", sourceId: projectId },
    });
  }

  steps.push({
    kind: "metric",
    id: "portfolio_finish_days",
    label: "portfolio_finish_days",
    evidence: null,
  });

  return { steps, affectedNodeIds: [...affected] };
}
