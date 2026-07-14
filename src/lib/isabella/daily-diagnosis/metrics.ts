// ============================================================================
// ProjectOps360° — Isabella Daily Diagnosis · deterministic metrics (pure)
// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE
//
// Extracts deterministic counts/signals from the Task 2 IsabellaProcessContext.
// The engine reasons over THESE — never over raw DB rows. Pure.
// ============================================================================

import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import type { DiagnosisMetrics } from "./types";

const DONE_STATUSES = new Set(["done", "tested", "completed"]);
const IN_PROGRESS_STATUSES = new Set(["in_progress", "implemented", "sent_to_ai", "prompt_ready"]);
const NOT_STARTED_STATUSES = new Set(["not_started", "deferred", "planned"]);

function sumBy(byStatus: Record<string, number> | undefined, keys: Set<string>): number {
  if (!byStatus) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(byStatus)) if (keys.has(k)) n += v;
  return n;
}

export interface DiagnosisSignals extends Required<DiagnosisMetrics> {
  /** How many distinct attention signals fired (overdue / blocked / no-owner / no-milestone). */
  attentionSignalCount: number;
  /** True when the context has enough task data to reason about. */
  hasTaskData: boolean;
  /** Advanced findings (delay/rework/bottleneck) present? (from process signals) */
  advancedFindingsAvailable: boolean;
  processEventCount: number;
  processTransitionCount: number;
  delayFindingCount: number;
  reworkFindingCount: number;
  bottleneckFindingCount: number;
}

/** Deterministic metrics + signals from an authorized process context. */
export function computeDiagnosisSignals(context: IsabellaProcessContext): DiagnosisSignals {
  const tc = context.taskContext;
  const mc = context.milestoneContext;
  const totalTasks = tc?.totalVisibleTasks ?? 0;
  const doneTasks = sumBy(tc?.byStatus, DONE_STATUSES);
  const inProgressTasks = sumBy(tc?.byStatus, IN_PROGRESS_STATUSES);
  const notStartedTasks = sumBy(tc?.byStatus, NOT_STARTED_STATUSES);
  const blockedTasks = tc?.blockedCount ?? 0;
  const overdueTasks = tc?.overdueCount ?? 0;
  const withoutMilestoneTasks = tc?.withoutMilestoneCount ?? 0;
  const withoutOwnerTasks = tc?.withoutOwnerCount ?? 0;
  const processEventCount = context.processMiningContext?.eventCount ?? 0;
  const processTransitionCount = context.processSignals?.transitionCount ?? 0;
  const delayFindingCount = context.processSignals?.delayFindingCount ?? 0;
  const reworkFindingCount = context.processSignals?.reworkFindingCount ?? 0;
  const bottleneckFindingCount = context.processSignals?.bottleneckFindingCount ?? 0;

  const attentionSignalCount = [
    overdueTasks > 0,
    blockedTasks > 0,
    withoutOwnerTasks > 0,
    withoutMilestoneTasks > 0,
    delayFindingCount > 0,
    reworkFindingCount > 0,
    bottleneckFindingCount > 0,
  ].filter(Boolean).length;

  return {
    totalTasks,
    doneTasks,
    inProgressTasks,
    notStartedTasks,
    blockedTasks,
    overdueTasks,
    withoutMilestoneTasks,
    withoutOwnerTasks,
    milestonesTotal: mc?.totalVisibleMilestones ?? 0,
    attentionSignalCount,
    hasTaskData: !!tc && totalTasks > 0,
    advancedFindingsAvailable: context.processSignals?.advancedFindingsAvailable ?? false,
    processEventCount,
    processTransitionCount,
    delayFindingCount,
    reworkFindingCount,
    bottleneckFindingCount,
  };
}
