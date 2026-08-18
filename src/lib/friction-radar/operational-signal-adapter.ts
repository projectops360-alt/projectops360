// ============================================================================
// ProjectOps360° — Friction Radar operational signal layer (READ-ONLY)
// ============================================================================
// Deterministic signals over already-loaded, RLS-scoped source rows. Structural
// facts (fan-out, critical-path membership, assignment share) are not friction by
// themselves: a second operational fact is required before a signal is emitted.
// ============================================================================

import type { Milestone } from "@/types/database";
import type {
  BudgetItem,
  CostActual,
  CriticalPathSnapshot,
  ResourceAssignment,
  Risk,
} from "@/types/execution";
import { severityFromScore } from "./scoring";
import type { TaskFrictionEvidenceRow } from "./task-dataset";
import type {
  FinancialMeasurementSourceRow,
  FinancialProjectCockpitSourceRow,
  ResourceWorkloadSourceRow,
} from "./load-task-production";
import type {
  FrictionConfidence,
  FrictionEvidenceRef,
  FrictionSignal,
  FrictionSignalGap,
} from "./types";
import type { Decision } from "@/types/database";
import { isTerminalStatus } from "@/lib/execution/task-activity";

const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_MILESTONE_STATUSES = new Set(["completed", "cancelled", "deferred"]);

function instant(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function endOfDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnly) return instant(value);
  return Date.UTC(
    Number(dateOnly[1]),
    Number(dateOnly[2]) - 1,
    Number(dateOnly[3]) + 1,
  ) - 1;
}

function daysBetween(later: number, earlier: number): number {
  return Math.max(0, Math.ceil((later - earlier) / DAY_MS));
}

/** Diminishing duration scale: preserves ranking without making every old item 100. */
function durationScore(days: number, floor: number, horizonDays: number): number {
  if (days <= 0) return floor;
  const range = 100 - floor;
  return floor + range * Math.min(
    1,
    Math.log1p(days) / Math.log1p(horizonDays),
  );
}

function uniqueRefs(refs: readonly FrictionEvidenceRef[]): FrictionEvidenceRef[] {
  return [...new Map(refs.map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()];
}

function createSignal(input: {
  organizationId: string;
  projectId: string;
  signalId: string;
  signalType: string;
  category: FrictionSignal["category"];
  score: number;
  confidence: FrictionConfidence;
  entityType: string;
  entityId: string;
  taskId?: string | null;
  milestoneId?: string | null;
  observedValue: string | number | boolean | null;
  expectedOrBaseline: string | number | boolean | null;
  evidenceStatus?: "confirmed" | "candidate";
  evidenceTimestampStart?: string | null;
  evidenceTimestampEnd?: string | null;
  evidenceDescription: string;
  evidenceRefs: FrictionEvidenceRef[];
  relatedEntityIds?: string[];
  metadata?: Record<string, string | number | boolean | null>;
}): FrictionSignal {
  const score = Math.max(0, Math.min(100, Math.round(input.score)));
  return {
    signalId: input.signalId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    source: input.category === "risk"
      ? "risk_intelligence"
      : input.category === "resource"
        ? "resource_intelligence"
        : "execution_intelligence",
    signalType: input.signalType,
    category: input.category,
    entityType: input.entityType,
    entityId: input.entityId,
    taskId: input.taskId ?? null,
    milestoneId: input.milestoneId ?? null,
    severity: severityFromScore(score),
    confidence: input.confidence,
    score,
    magnitude: score / 100,
    observedValue: input.observedValue,
    expectedOrBaseline: input.expectedOrBaseline,
    evidenceStatus: input.evidenceStatus ?? "candidate",
    occurredAt: input.evidenceTimestampEnd ?? input.evidenceTimestampStart ?? null,
    evidenceTimestampStart: input.evidenceTimestampStart ?? null,
    evidenceTimestampEnd: input.evidenceTimestampEnd ?? null,
    evidenceDescription: input.evidenceDescription,
    evidenceRefs: uniqueRefs(input.evidenceRefs),
    relatedEntityIds: [...new Set(input.relatedEntityIds ?? [])],
    metadata: { signalScore: score, ...(input.metadata ?? {}) },
  };
}

function gap(
  signalType: string,
  category: FrictionSignal["category"],
  reason: string,
  sourceTables: string[],
): FrictionSignalGap {
  return {
    signalType,
    category,
    status: "insufficient_evidence",
    reason,
    sourceTables,
  };
}

function riskConfidence(value: number | null): FrictionConfidence {
  if (value == null || !Number.isFinite(Number(value))) return "medium";
  const normalized = Number(value) > 1 ? Number(value) / 100 : Number(value);
  if (normalized >= 0.8) return "high";
  if (normalized >= 0.5) return "medium";
  return "low";
}

export interface OperationalSignalInput {
  organizationId: string;
  projectId: string;
  tasks: readonly TaskFrictionEvidenceRow[];
  milestones: readonly Milestone[];
  resourceAssignments: readonly ResourceAssignment[];
  resourceWorkloadSnapshots: readonly ResourceWorkloadSourceRow[];
  risks: readonly Risk[];
  decisions: readonly Decision[];
  budgetItems: readonly BudgetItem[];
  costActuals: readonly CostActual[];
  financialMeasurements: readonly FinancialMeasurementSourceRow[];
  financialCockpit: readonly FinancialProjectCockpitSourceRow[];
  criticalPathSnapshots: readonly CriticalPathSnapshot[];
  analysisTimestamp: string;
}

export interface OperationalSignalResult {
  signals: FrictionSignal[];
  gaps: FrictionSignalGap[];
}

/** FR-09 through FR-14: evidence-first operational detectors. */
export function frictionSignalsFromOperationalEvidence(
  input: OperationalSignalInput,
): OperationalSignalResult {
  const signals: FrictionSignal[] = [];
  const gaps: FrictionSignalGap[] = [];
  const analysisAt = instant(input.analysisTimestamp);
  const taskById = new Map(input.tasks.map((task) => [task.taskId, task]));
  const latestCritical = [...input.criticalPathSnapshots].sort((a, b) =>
    b.computed_at.localeCompare(a.computed_at),
  )[0];
  const criticalTaskIds = new Set(latestCritical?.critical_task_ids ?? []);

  // FR-09 — dependency friction. Incomplete predecessors alone mean waiting,
  // not friction; an explicit active blocker is required.
  for (const task of input.tasks) {
    const dependencyRefs = task.dependencyIds.map((id) => ({
      kind: "task_dependencies",
      id,
    }));
    const incompletePredecessors = task.predecessorIds.filter((id) => {
      const predecessor = taskById.get(id);
      return predecessor != null && !isTerminalStatus(predecessor.status);
    });
    const hasActiveBlocker =
      (task.isBlocked || task.status === "blocked") && !isTerminalStatus(task.status);
    if (hasActiveBlocker && incompletePredecessors.length > 0) {
      signals.push(createSignal({
        organizationId: input.organizationId,
        projectId: input.projectId,
        signalId: `task:${task.taskId}:blocked-by-predecessor`,
        signalType: "blocked_by_predecessor",
        category: "dependency",
        score: 55 + Math.min(30, incompletePredecessors.length * 10),
        confidence: "medium",
        entityType: "task",
        entityId: task.taskId,
        taskId: task.taskId,
        milestoneId: task.milestoneId,
        observedValue: incompletePredecessors.length,
        expectedOrBaseline: 0,
        evidenceTimestampEnd: input.analysisTimestamp,
        evidenceDescription:
          "The current task is explicitly blocked and has recorded incomplete predecessors; the dependency is a supported candidate cause, not asserted causality.",
        evidenceRefs: [
          { kind: "roadmap_tasks", id: task.taskId, label: "is_blocked" },
          ...dependencyRefs,
          ...incompletePredecessors.map((id) => ({ kind: "roadmap_tasks", id })),
        ],
        relatedEntityIds: incompletePredecessors,
        metadata: { fanIn: task.fanIn, incompletePredecessors: incompletePredecessors.length },
      }));
    }
    if (hasActiveBlocker && task.successorIds.length > 0) {
      signals.push(createSignal({
        organizationId: input.organizationId,
        projectId: input.projectId,
        signalId: `task:${task.taskId}:dependency-propagation`,
        signalType: "dependency_propagation_risk",
        category: "dependency",
        score: 35 + Math.min(45, task.successorIds.length * 10) + (task.isCritical ? 15 : 0),
        confidence: "high",
        entityType: "task",
        entityId: task.taskId,
        taskId: task.taskId,
        milestoneId: task.milestoneId,
        observedValue: task.successorIds.length,
        expectedOrBaseline: 0,
        evidenceTimestampEnd: input.analysisTimestamp,
        evidenceDescription:
          "An explicitly blocked task has recorded downstream dependencies, creating traceable propagation exposure.",
        evidenceRefs: [
          { kind: "roadmap_tasks", id: task.taskId, label: "is_blocked" },
          ...dependencyRefs,
        ],
        relatedEntityIds: task.successorIds,
        metadata: { fanOut: task.fanOut, critical: task.isCritical },
      }));
    }
  }
  gaps.push(gap(
    "dependency_wait",
    "dependency",
    "No duration is emitted until predecessor completion, dependency lag and successor observed start share qualified temporal evidence.",
    ["task_dependencies", "project_event_log", "subtask_time_entries"],
  ));

  // FR-10 — schedule friction. Baseline dates are date-only, so lateness begins
  // after the complete planned calendar day.
  if (analysisAt != null) {
    for (const task of input.tasks) {
      const hasActiveBlocker =
        (task.isBlocked || task.status === "blocked") && !isTerminalStatus(task.status);
      const plannedFinish = endOfDate(task.plannedFinish);
      const currentFinish = endOfDate(task.currentFinish);
      if (
        task.plannedFinish && task.currentFinish &&
        plannedFinish != null && currentFinish != null && currentFinish > plannedFinish
      ) {
        const lateDays = daysBetween(currentFinish, plannedFinish);
        signals.push(createSignal({
          organizationId: input.organizationId,
          projectId: input.projectId,
          signalId: `task:${task.taskId}:planned-finish-variance`,
          signalType: "planned_finish_variance",
          category: "schedule",
          score: durationScore(lateDays, 25, 90),
          confidence: "high",
          entityType: "task",
          entityId: task.taskId,
          taskId: task.taskId,
          milestoneId: task.milestoneId,
          observedValue: lateDays,
          expectedOrBaseline: task.plannedFinish,
          evidenceTimestampStart: task.plannedFinish,
          evidenceTimestampEnd: task.currentFinish,
          evidenceDescription:
            "The current task finish date is later than its recorded baseline finish date.",
          evidenceRefs: [{ kind: "roadmap_tasks", id: task.taskId, label: "baseline_end_date,end_date" }],
        }));
      }
      if (
        plannedFinish != null && analysisAt > plannedFinish &&
        !isTerminalStatus(task.status)
      ) {
        const overdueDays = daysBetween(analysisAt, plannedFinish);
        signals.push(createSignal({
          organizationId: input.organizationId,
          projectId: input.projectId,
          signalId: `task:${task.taskId}:overdue`,
          signalType: "overdue_task",
          category: "schedule",
          score: durationScore(overdueDays, 35, 180) + (task.isCritical ? 10 : 0),
          confidence: "high",
          entityType: "task",
          entityId: task.taskId,
          taskId: task.taskId,
          milestoneId: task.milestoneId,
          observedValue: overdueDays,
          expectedOrBaseline: task.plannedFinish,
          evidenceStatus: "confirmed",
          evidenceTimestampStart: task.plannedFinish,
          evidenceTimestampEnd: input.analysisTimestamp,
          evidenceDescription:
            "The task remains in a non-terminal current state after the end of its planned finish day.",
          evidenceRefs: [{ kind: "roadmap_tasks", id: task.taskId, label: "status,baseline_end_date" }],
          metadata: { critical: task.isCritical },
        }));
      }
      const onCriticalPath = task.isCritical || criticalTaskIds.has(task.taskId);
      if (
        onCriticalPath &&
        (hasActiveBlocker || (plannedFinish != null && analysisAt > plannedFinish && !isTerminalStatus(task.status)))
      ) {
        signals.push(createSignal({
          organizationId: input.organizationId,
          projectId: input.projectId,
          signalId: `task:${task.taskId}:critical-path-exposure`,
          signalType: "critical_path_exposure",
          category: "schedule",
          score: hasActiveBlocker ? 85 : 70,
          confidence: latestCritical ? "high" : "medium",
          entityType: "task",
          entityId: task.taskId,
          taskId: task.taskId,
          milestoneId: task.milestoneId,
          observedValue: hasActiveBlocker ? "blocked" : "overdue",
          expectedOrBaseline: "critical_task_unimpeded",
          evidenceTimestampStart: latestCritical?.computed_at ?? null,
          evidenceTimestampEnd: input.analysisTimestamp,
          evidenceDescription:
            "A task identified as critical also has an explicit blocker or confirmed overdue state.",
          evidenceRefs: [
            { kind: "roadmap_tasks", id: task.taskId, label: "critical_and_state" },
            ...(latestCritical ? [{ kind: "critical_path_snapshots", id: latestCritical.id }] : []),
          ],
        }));
      }
    }
    for (const milestone of input.milestones) {
      const baselineTarget = milestone.baseline_target_date ?? milestone.target_date;
      const targetEnd = endOfDate(baselineTarget);
      if (
        targetEnd != null && analysisAt > targetEnd &&
        !TERMINAL_MILESTONE_STATUSES.has(milestone.status)
      ) {
        const lateDays = daysBetween(analysisAt, targetEnd);
        signals.push(createSignal({
          organizationId: input.organizationId,
          projectId: input.projectId,
          signalId: `milestone:${milestone.id}:late`,
          signalType: "milestone_lateness",
          category: "schedule",
          score: durationScore(lateDays, 40, 180),
          confidence: "high",
          entityType: "milestone",
          entityId: milestone.id,
          milestoneId: milestone.id,
          observedValue: lateDays,
          expectedOrBaseline: baselineTarget,
          evidenceStatus: "confirmed",
          evidenceTimestampStart: baselineTarget,
          evidenceTimestampEnd: input.analysisTimestamp,
          evidenceDescription:
            "The milestone remains non-terminal after the end of its recorded target date.",
          evidenceRefs: [{ kind: "milestones", id: milestone.id, label: "status,baseline_target_date" }],
        }));
      }
    }
  }

  // FR-11 — effort and cost. A missing time/cost row is unknown, never zero.
  for (const task of input.tasks) {
    if (
      task.timeEntryCount > 0 && task.plannedHours != null && task.plannedHours > 0 &&
      task.loggedHours > task.plannedHours * 1.1
    ) {
      const overrunPct = ((task.loggedHours - task.plannedHours) / task.plannedHours) * 100;
      signals.push(createSignal({
        organizationId: input.organizationId,
        projectId: input.projectId,
        signalId: `task:${task.taskId}:effort-overrun`,
        signalType: "effort_overrun",
        category: "cost",
        score: 35 + overrunPct,
        confidence: "high",
        entityType: "task",
        entityId: task.taskId,
        taskId: task.taskId,
        milestoneId: task.milestoneId,
        observedValue: Math.round(task.loggedHours * 100) / 100,
        expectedOrBaseline: task.plannedHours,
        evidenceStatus: "confirmed",
        evidenceTimestampEnd: input.analysisTimestamp,
        evidenceDescription:
          "Current non-deleted time entries exceed the task's recorded planned-hour baseline by more than 10%.",
        evidenceRefs: [
          { kind: "roadmap_tasks", id: task.taskId, label: "baseline_estimate_hours" },
          ...task.timeEntryIds.map((id) => ({ kind: "subtask_time_entries", id })),
        ],
        metadata: { overrunPercent: Math.round(overrunPct) },
      }));
    }
  }
  for (const item of input.budgetItems) {
    const estimate = Number(item.estimated_cost);
    const actual = Number(item.actual_cost);
    const forecast = item.forecast_cost == null ? null : Number(item.forecast_cost);
    const observed = actual > 0 ? actual : forecast;
    if (
      estimate > 0 && observed != null && observed > estimate &&
      (actual > 0 || ["at_risk", "overrun"].includes(item.status))
    ) {
      const overrunPct = ((observed - estimate) / estimate) * 100;
      signals.push(createSignal({
        organizationId: input.organizationId,
        projectId: input.projectId,
        signalId: `budget:${item.id}:overrun`,
        signalType: actual > 0 ? "actual_cost_overrun" : "forecast_cost_overrun",
        category: "cost",
        score: 45 + overrunPct,
        confidence: actual > 0 ? "high" : "medium",
        entityType: "budget_item",
        entityId: item.id,
        milestoneId: item.milestone_id,
        observedValue: observed,
        expectedOrBaseline: estimate,
        evidenceStatus: actual > 0 ? "confirmed" : "candidate",
        evidenceTimestampStart: item.created_at,
        evidenceTimestampEnd: item.updated_at,
        evidenceDescription:
          "Recorded actual or explicitly at-risk forecast cost exceeds the budget item estimate.",
        evidenceRefs: [{ kind: "budget_items", id: item.id }],
        metadata: { currency: item.currency, overrunPercent: Math.round(overrunPct) },
      }));
    }
  }
  const latestMeasurement = [...input.financialMeasurements].sort((a, b) =>
    b.data_date.localeCompare(a.data_date),
  )[0];
  if (
    latestMeasurement && ["available", "provisional"].includes(latestMeasurement.quality_status)
  ) {
    const cpi = latestMeasurement.cpi == null ? null : Number(latestMeasurement.cpi);
    const spi = latestMeasurement.spi == null ? null : Number(latestMeasurement.spi);
    if (cpi != null && Number.isFinite(cpi) && cpi < 1) {
      signals.push(createSignal({
        organizationId: input.organizationId,
        projectId: input.projectId,
        signalId: `financial:${latestMeasurement.id}:cpi`,
        signalType: "cpi_underperformance",
        category: "cost",
        score: 35 + (1 - cpi) * 100,
        confidence: latestMeasurement.quality_status === "available" ? "high" : "medium",
        entityType: "project",
        entityId: input.projectId,
        observedValue: cpi,
        expectedOrBaseline: 1,
        evidenceTimestampStart: latestMeasurement.data_date,
        evidenceTimestampEnd: latestMeasurement.data_date,
        evidenceDescription: "A qualified financial measurement reports CPI below 1.0.",
        evidenceRefs: [{ kind: "financial_measurement_snapshots", id: latestMeasurement.id }],
      }));
    }
    if (spi != null && Number.isFinite(spi) && spi < 1) {
      signals.push(createSignal({
        organizationId: input.organizationId,
        projectId: input.projectId,
        signalId: `financial:${latestMeasurement.id}:spi`,
        signalType: "spi_underperformance",
        category: "schedule",
        score: 35 + (1 - spi) * 100,
        confidence: latestMeasurement.quality_status === "available" ? "high" : "medium",
        entityType: "project",
        entityId: input.projectId,
        observedValue: spi,
        expectedOrBaseline: 1,
        evidenceTimestampStart: latestMeasurement.data_date,
        evidenceTimestampEnd: latestMeasurement.data_date,
        evidenceDescription: "A qualified financial measurement reports SPI below 1.0.",
        evidenceRefs: [{ kind: "financial_measurement_snapshots", id: latestMeasurement.id }],
      }));
    }
  } else {
    gaps.push(gap(
      "cpi_spi_eac_vac",
      "cost",
      "No available/provisional financial measurement exists; zero or null financial values are not performance evidence.",
      ["financial_measurement_snapshots", "financial_project_cockpit"],
    ));
  }
  for (const cockpit of input.financialCockpit) {
    if (!["available", "provisional"].includes(cockpit.quality_status)) continue;
    const baseline = cockpit.current_baseline == null
      ? null
      : Number(cockpit.current_baseline);
    const eac = cockpit.latest_eac == null ? null : Number(cockpit.latest_eac);
    if (
      baseline == null || eac == null || !Number.isFinite(baseline) ||
      !Number.isFinite(eac) || baseline <= 0 || eac <= baseline
    ) continue;
    const overrunPct = ((eac - baseline) / baseline) * 100;
    signals.push(createSignal({
      organizationId: input.organizationId,
      projectId: input.projectId,
      signalId: `financial:${input.projectId}:forecast-overrun`,
      signalType: "forecast_cost_overrun",
      category: "cost",
      score: 45 + overrunPct,
      confidence: cockpit.quality_status === "available" ? "high" : "medium",
      entityType: "project",
      entityId: input.projectId,
      observedValue: eac,
      expectedOrBaseline: baseline,
      evidenceTimestampStart: cockpit.data_date,
      evidenceTimestampEnd: input.analysisTimestamp,
      evidenceDescription:
        "A qualified financial cockpit reports EAC above the current approved baseline.",
      evidenceRefs: [{ kind: "financial_project_cockpit", id: input.projectId }],
      metadata: {
        currency: cockpit.currency,
        overrunPercent: Math.round(overrunPct),
        vac: baseline - eac,
      },
    }));
  }

  // FR-12 — resource concentration and overload.
  const assignmentsByOwner = new Map<
    string,
    { entityId: string; taskIds: Set<string>; refs: FrictionEvidenceRef[] }
  >();
  const activeAssignedTaskIds = new Set<string>();
  for (const task of input.tasks) {
    if (isTerminalStatus(task.status)) continue;
    const directAssignments = input.resourceAssignments.filter(
      (assignment) => assignment.task_id === task.taskId,
    );
    const owners = directAssignments.length > 0
      ? directAssignments.map((assignment) => ({
          key: `resource:${assignment.resource_id}`,
          entityId: assignment.resource_id,
          ref: { kind: "resource_assignments", id: assignment.id } as FrictionEvidenceRef,
        }))
      : task.assignedResourceId
        ? [{
            key: `resource:${task.assignedResourceId}`,
            entityId: task.assignedResourceId,
            ref: { kind: "roadmap_tasks", id: task.taskId, label: "assigned_resource_id" },
          }]
        : task.assignedTo
          ? [{
              key: `user:${task.assignedTo}`,
              entityId: task.assignedTo,
              ref: { kind: "roadmap_tasks", id: task.taskId, label: "assigned_to" },
            }]
          : [];
    if (owners.length > 0) activeAssignedTaskIds.add(task.taskId);
    for (const owner of owners) {
      const current = assignmentsByOwner.get(owner.key) ?? {
        entityId: owner.entityId,
        taskIds: new Set<string>(),
        refs: [],
      };
      current.taskIds.add(task.taskId);
      current.refs.push(owner.ref);
      assignmentsByOwner.set(owner.key, current);
    }
  }
  if (activeAssignedTaskIds.size === 0) {
    gaps.push(gap(
      "assignee_concentration",
      "resource",
      "No active task assignment evidence exists.",
      ["roadmap_tasks", "resource_assignments"],
    ));
  } else {
    for (const [ownerKey, assignment] of assignmentsByOwner) {
      const share = assignment.taskIds.size / activeAssignedTaskIds.size;
      if (share < 0.4 || assignment.taskIds.size < 3) continue;
      const affected = [...assignment.taskIds];
      const criticalCount = affected.filter((id) => {
        const task = taskById.get(id);
        return task?.isCritical || criticalTaskIds.has(id);
      }).length;
      signals.push(createSignal({
        organizationId: input.organizationId,
        projectId: input.projectId,
        signalId: `${ownerKey}:assignee-concentration`,
        signalType: criticalCount > 0 ? "key_person_dependency" : "assignee_concentration",
        category: "resource",
        score: 30 + share * 60 + Math.min(15, criticalCount * 5),
        confidence: "high",
        entityType: ownerKey.startsWith("user:") ? "user" : "resource",
        entityId: assignment.entityId,
        observedValue: Math.round(share * 100),
        expectedOrBaseline: 40,
        evidenceTimestampEnd: input.analysisTimestamp,
        evidenceDescription:
          "One recorded assignee owns at least 40% of currently assigned active tasks.",
        evidenceRefs: assignment.refs,
        relatedEntityIds: affected,
        metadata: { taskCount: affected.length, criticalTaskCount: criticalCount },
      }));
    }
  }
  const effortByUser = new Map<string, { hours: number; entryIds: string[]; taskIds: Set<string> }>();
  let totalObservedHours = 0;
  for (const task of input.tasks) {
    for (const effort of task.effortByUser) {
      const current = effortByUser.get(effort.userId) ?? {
        hours: 0,
        entryIds: [],
        taskIds: new Set<string>(),
      };
      current.hours += effort.hours;
      current.entryIds.push(...effort.entryIds);
      current.taskIds.add(task.taskId);
      effortByUser.set(effort.userId, current);
      totalObservedHours += effort.hours;
    }
  }
  if (totalObservedHours > 0) {
    for (const [userId, effort] of effortByUser) {
      const share = effort.hours / totalObservedHours;
      if (
        share >= 0.5 &&
        (effort.taskIds.size >= 3 || (effort.taskIds.size >= 2 && effort.hours >= 40))
      ) {
        const affected = [...effort.taskIds];
        const criticalCount = affected.filter((id) => {
          const task = taskById.get(id);
          return task?.isCritical || criticalTaskIds.has(id);
        }).length;
        signals.push(createSignal({
          organizationId: input.organizationId,
          projectId: input.projectId,
          signalId: `resource:${userId}:effort-concentration`,
          signalType: criticalCount > 0 ? "key_person_dependency" : "effort_concentration",
          category: "resource",
          score: 30 + share * 70 + Math.min(15, criticalCount * 5),
          confidence: "high",
          entityType: "user",
          entityId: userId,
          observedValue: Math.round(share * 100),
          expectedOrBaseline: 50,
          evidenceTimestampEnd: input.analysisTimestamp,
          evidenceDescription:
            "One person owns at least half of all currently recorded project effort across multiple tasks.",
          evidenceRefs: effort.entryIds.map((id) => ({ kind: "subtask_time_entries", id })),
          relatedEntityIds: affected,
          metadata: { taskCount: affected.length, criticalTaskCount: criticalCount },
        }));
      }
    }
  } else {
    gaps.push(gap(
      "effort_concentration",
      "resource",
      "No current time-entry effort exists for resource concentration analysis.",
      ["subtask_time_entries"],
    ));
  }
  if (input.resourceWorkloadSnapshots.length === 0) {
    gaps.push(gap(
      "resource_overload",
      "resource",
      "No resource workload snapshot or capacity denominator exists.",
      ["resource_workload_snapshots", "resource_profiles", "project_resource_allocations"],
    ));
  } else {
    for (const workload of input.resourceWorkloadSnapshots) {
      const overallocated = Number(workload.overallocated_hours);
      const utilization = Number(workload.utilization_percent);
      if (!(overallocated > 0 || utilization > 100)) continue;
      signals.push(createSignal({
        organizationId: input.organizationId,
        projectId: input.projectId,
        signalId: `workload:${workload.id}:overload`,
        signalType: "resource_overload",
        category: "resource",
        score: 50 + Math.max(overallocated * 2, utilization - 100),
        confidence: "high",
        entityType: "resource",
        entityId: workload.resource_profile_id ?? workload.resource_key,
        observedValue: utilization,
        expectedOrBaseline: 100,
        evidenceStatus: "confirmed",
        evidenceTimestampStart: workload.period_start,
        evidenceTimestampEnd: workload.period_end,
        evidenceDescription:
          "A recorded workload snapshot exceeds its effective capacity.",
        evidenceRefs: [{ kind: "resource_workload_snapshots", id: workload.id }],
        metadata: { overallocatedHours: overallocated },
      }));
    }
  }

  // FR-13 — risk friction. Open risk rows are explicit evidence; linkage is
  // preserved, but a blocked linked task is not labelled materialization.
  for (const risk of input.risks) {
    if (!["open", "mitigating"].includes(risk.status)) continue;
    const createdAt = instant(risk.created_at);
    const ageDays = analysisAt != null && createdAt != null
      ? daysBetween(analysisAt, createdAt)
      : null;
    const severityBase = { low: 25, medium: 45, high: 70, critical: 90 }[risk.severity] ?? 45;
    const ageIncrement = ageDays == null ? 0 : Math.min(20, Math.floor(ageDays / 30) * 5);
    signals.push(createSignal({
      organizationId: input.organizationId,
      projectId: input.projectId,
      signalId: `risk:${risk.id}:open-exposure`,
      signalType: "open_risk_exposure",
      category: "risk",
      score: severityBase + ageIncrement,
      confidence: riskConfidence(risk.confidence_score),
      entityType: risk.linked_task_id ? "task" : risk.linked_milestone_id ? "milestone" : "project",
      entityId: risk.linked_task_id ?? risk.linked_milestone_id ?? input.projectId,
      taskId: risk.linked_task_id,
      milestoneId: risk.linked_milestone_id,
      observedValue: ageDays,
      expectedOrBaseline: 0,
      evidenceStatus: "confirmed",
      evidenceTimestampStart: risk.created_at,
      evidenceTimestampEnd: input.analysisTimestamp,
      evidenceDescription:
        "An explicit risk register row remains open or under mitigation; age is reported without asserting materialization.",
      evidenceRefs: [{ kind: "risks", id: risk.id }],
      relatedEntityIds: [risk.linked_task_id, risk.linked_milestone_id].filter(
        (value): value is string => value != null,
      ),
      metadata: { riskSeverity: risk.severity, riskStatus: risk.status },
    }));
  }
  if (input.risks.length === 0) {
    gaps.push(gap("open_risk_exposure", "risk", "No risk register rows are available.", ["risks"]));
  }
  gaps.push(gap(
    "risk_materialization",
    "risk",
    "Task linkage and temporal adjacency do not prove that a risk materialized; explicit materialization evidence is required.",
    ["risks", "project_event_log"],
  ));

  // FR-14 — decision friction. Only explicit proposed/deferred records or an
  // authoritative pending-approval count can produce a signal.
  for (const decision of input.decisions) {
    if (!["proposed", "deferred"].includes(decision.status)) continue;
    const createdAt = instant(decision.created_at);
    const waitingDays = analysisAt != null && createdAt != null
      ? daysBetween(analysisAt, createdAt)
      : null;
    if (decision.status !== "deferred" && (waitingDays == null || waitingDays < 7)) continue;
    signals.push(createSignal({
      organizationId: input.organizationId,
      projectId: input.projectId,
      signalId: `decision:${decision.id}:waiting`,
      signalType: "decision_wait",
      category: "decision",
      score: decision.status === "deferred"
        ? durationScore(waitingDays ?? 0, 60, 90)
        : durationScore(waitingDays ?? 0, 35, 90),
      confidence: "high",
      entityType: "decision",
      entityId: decision.id,
      observedValue: waitingDays,
      expectedOrBaseline: 7,
      evidenceStatus: "confirmed",
      evidenceTimestampStart: decision.created_at,
      evidenceTimestampEnd: input.analysisTimestamp,
      evidenceDescription:
        "An explicit decision record remains proposed beyond seven days or is explicitly deferred.",
      evidenceRefs: [{ kind: "decisions", id: decision.id, label: "status,created_at" }],
      metadata: { decisionStatus: decision.status },
    }));
  }
  for (const cockpit of input.financialCockpit) {
    if (cockpit.quality_status === "insufficient_inputs" || cockpit.pending_approvals <= 0) continue;
    signals.push(createSignal({
      organizationId: input.organizationId,
      projectId: input.projectId,
      signalId: `financial:${input.projectId}:pending-approvals`,
      signalType: "financial_approval_wait",
      category: "decision",
      score: 40 + cockpit.pending_approvals * 10,
      confidence: "medium",
      entityType: "project",
      entityId: input.projectId,
      observedValue: cockpit.pending_approvals,
      expectedOrBaseline: 0,
      evidenceTimestampStart: cockpit.data_date,
      evidenceTimestampEnd: input.analysisTimestamp,
      evidenceDescription:
        "The qualified financial cockpit explicitly reports pending approvals.",
      evidenceRefs: [{ kind: "financial_project_cockpit", id: input.projectId }],
    }));
  }
  if (input.decisions.length === 0) {
    gaps.push(gap(
      "decision_wait",
      "decision",
      "No decision records exist; approvals and decision waiting are not inferred from missing events.",
      ["decisions", "project_event_log"],
    ));
  }

  // Stable ordering makes snapshot validation and UI ranking deterministic.
  return {
    signals: signals.sort((a, b) => a.signalId.localeCompare(b.signalId)),
    gaps: [...new Map(gaps.map((item) => [item.signalType, item])).values()]
      .sort((a, b) => a.signalType.localeCompare(b.signalType)),
  };
}
