// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine · Observability (Phase 3, Task 1)
// ============================================================================
// Makes every engine run traceable and auditable. Pure + deterministic helpers
// to open a run context and close it into an immutable run summary (Constitution
// §21/§22). No DB — persistence of summaries is a future task; this defines the
// canonical shape all future runs must emit.
// ============================================================================

import { MPF_ENGINE_VERSION, MPF_CONFIG_VERSION } from "./constants";
import type {
  MilestoneFlowScope,
  MilestoneFlowProjectScope,
  MilestoneFlowEngineRunContext,
  MilestoneFlowEngineRunSummary,
  MilestoneFlowEngineWarning,
  MilestoneFlowEngineError,
  MilestoneProcessFlowRunId,
} from "./types";

/** Deterministic-enough run id. Callers may inject their own for replay. */
export function newRunId(seed?: string): MilestoneProcessFlowRunId {
  if (seed) return `mpf_${seed}`;
  const rand = Math.random().toString(36).slice(2, 10);
  return `mpf_${Date.now().toString(36)}_${rand}`;
}

function projectIdOf(scope: MilestoneFlowScope): string | null {
  return (scope as MilestoneFlowProjectScope).projectId ?? null;
}

/** Open a run context, stamping engine + config version and start time. */
export function openRunContext(params: {
  scope: MilestoneFlowScope;
  runId?: MilestoneProcessFlowRunId;
  triggeredBy?: string | null;
  triggerReason?: string | null;
  now?: () => Date;
}): MilestoneFlowEngineRunContext {
  const now = params.now ?? (() => new Date());
  return {
    runId: params.runId ?? newRunId(),
    scope: params.scope,
    engineVersion: MPF_ENGINE_VERSION,
    configVersion: MPF_CONFIG_VERSION,
    startedAt: now().toISOString(),
    triggeredBy: params.triggeredBy ?? null,
    triggerReason: params.triggerReason ?? null,
  };
}

export interface RunTallies {
  inputEventCount: number;
  includedEventCount: number;
  excludedEventCount: number;
  exclusionReasons?: string[];
  transitionCount: number;
  segmentCount: number;
  bottleneckCount: number;
  healthAssessmentCount: number;
  /** Builder-stage counts (Task 3) — optional; default 0. */
  unassignedEventCount?: number;
  unknownSegmentCount?: number;
  openTransitionCount?: number;
  completedTransitionCount?: number;
  /** Metrics-stage counts (Task 4) — optional; default 0. */
  metricsCalculatedCount?: number;
  metricsUnknownCount?: number;
  openSegmentDurationCount?: number;
  invalidDurationCount?: number;
  totalKnownSegmentTimeMs?: number;
  /** Detection-stage counts (Task 5) — optional; default 0. */
  delayFindingCount?: number;
  blockerFindingCount?: number;
  waitingFindingCount?: number;
  decisionDelayFindingCount?: number;
  approvalDelayFindingCount?: number;
  openFindingCount?: number;
  resolvedFindingCount?: number;
  unknownFindingCount?: number;
  highSeverityFindingCount?: number;
  warnings?: MilestoneFlowEngineWarning[];
  errors?: MilestoneFlowEngineError[];
}

/** Close a run context into an immutable, complete run summary. */
export function closeRunSummary(
  ctx: MilestoneFlowEngineRunContext,
  tallies: RunTallies,
  now: () => Date = () => new Date(),
): MilestoneFlowEngineRunSummary {
  const completedAt = now();
  const startedMs = Date.parse(ctx.startedAt);
  const durationMs = Number.isFinite(startedMs)
    ? Math.max(0, completedAt.getTime() - startedMs)
    : 0;
  const warnings = tallies.warnings ?? [];
  const errors = tallies.errors ?? [];

  return {
    runId: ctx.runId,
    engineVersion: ctx.engineVersion,
    configVersion: ctx.configVersion,
    organizationId: ctx.scope.organizationId,
    projectId: projectIdOf(ctx.scope),
    inputEventCount: tallies.inputEventCount,
    includedEventCount: tallies.includedEventCount,
    excludedEventCount: tallies.excludedEventCount,
    exclusionReasons: tallies.exclusionReasons ?? [],
    transitionCount: tallies.transitionCount,
    segmentCount: tallies.segmentCount,
    bottleneckCount: tallies.bottleneckCount,
    healthAssessmentCount: tallies.healthAssessmentCount,
    unassignedEventCount: tallies.unassignedEventCount ?? 0,
    unknownSegmentCount: tallies.unknownSegmentCount ?? 0,
    openTransitionCount: tallies.openTransitionCount ?? 0,
    completedTransitionCount: tallies.completedTransitionCount ?? 0,
    metricsCalculatedCount: tallies.metricsCalculatedCount ?? 0,
    metricsUnknownCount: tallies.metricsUnknownCount ?? 0,
    openSegmentDurationCount: tallies.openSegmentDurationCount ?? 0,
    invalidDurationCount: tallies.invalidDurationCount ?? 0,
    totalKnownSegmentTimeMs: tallies.totalKnownSegmentTimeMs ?? 0,
    delayFindingCount: tallies.delayFindingCount ?? 0,
    blockerFindingCount: tallies.blockerFindingCount ?? 0,
    waitingFindingCount: tallies.waitingFindingCount ?? 0,
    decisionDelayFindingCount: tallies.decisionDelayFindingCount ?? 0,
    approvalDelayFindingCount: tallies.approvalDelayFindingCount ?? 0,
    openFindingCount: tallies.openFindingCount ?? 0,
    resolvedFindingCount: tallies.resolvedFindingCount ?? 0,
    unknownFindingCount: tallies.unknownFindingCount ?? 0,
    highSeverityFindingCount: tallies.highSeverityFindingCount ?? 0,
    warningCount: warnings.length,
    errorCount: errors.length,
    startedAt: ctx.startedAt,
    completedAt: completedAt.toISOString(),
    durationMs,
    warnings,
    errors,
  };
}
