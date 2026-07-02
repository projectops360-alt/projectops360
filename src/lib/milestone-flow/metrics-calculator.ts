// ============================================================================
// ProjectOps360° — MPF Engine · Milestone Flow Metrics Calculator (Phase 3, Task 4)
// ============================================================================
// Turns Task 3 transitions + flow segments into measurable execution-flow metrics
// (durations, time buckets, composition %, flow efficiency, counters). Pure +
// deterministic + replay-stable: OPEN durations are computed ONLY against an
// explicit `analysisAsOf` — there is NO Date.now() anywhere here. It CONSUMES
// Task 3 output (never rebuilds transitions/segments) and does not re-interpret
// event semantics. It computes measurement only — never health, never bottlenecks.
//
// Read-only over canonical truth: no mutation of transitions/segments/events/
// milestones, no project_event_log writes, no process_nodes / process_edges.
// ============================================================================

import {
  MpfMissingProjectScopeError,
  MpfMissingOrganizationScopeError,
  MpfUnknownFailureError,
} from "./errors";
import { aggregateConfidence } from "./evidence";
import type {
  MilestoneFlowProjectScope,
  MilestoneFlowMilestoneRef,
  MilestoneFlowSegment,
  MilestoneFlowSegmentType,
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEngineWarning,
  MilestoneTransition,
} from "./types";
import type { BuiltMilestoneTransition } from "./transition-builder-types";
import type {
  MilestoneFlowMetricsOptions,
  MilestoneSegmentDurationResult,
  MilestoneFlowTimeBuckets,
  MilestoneFlowPercentages,
  MilestoneFlowSegmentCounters,
  MilestoneTransitionDurationDetail,
  MilestoneFlowTransitionMetrics,
  MilestoneFlowMetricsResult,
  MilestoneMetricCompleteness,
} from "./metrics-calculator-types";

// A segment as consumed here: the base contract shape plus the optional built
// fields (isOpenEnded/confidence). Works for both base and BuiltMilestoneFlowSegment.
type SegmentForMetrics = MilestoneFlowSegment & {
  isOpenEnded?: boolean;
  confidence?: MilestoneFlowEvidenceConfidence;
};

// ── Pure time helpers ─────────────────────────────────────────────────────────

function parseIso(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

const CONFIDENCE_RANK: Record<MilestoneFlowEvidenceConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function capConfidence(
  a: MilestoneFlowEvidenceConfidence,
  ceiling: MilestoneFlowEvidenceConfidence,
): MilestoneFlowEvidenceConfidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[ceiling] ? a : ceiling;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

function warn(code: string, message: string, transitionId?: string): MilestoneFlowEngineWarning {
  return { code, message, transitionId: transitionId ?? null };
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface MilestoneFlowMetricsInput {
  scope: MilestoneFlowProjectScope;
  milestones: MilestoneFlowMilestoneRef[];
  transitions: BuiltMilestoneTransition[];
  options?: MilestoneFlowMetricsOptions;
}

interface TransitionMetricsOptions extends MilestoneFlowMetricsOptions {
  milestones?: Map<string, MilestoneFlowMilestoneRef>;
}

// ── (10) Input validation ─────────────────────────────────────────────────────

/** (10) Validate metrics input; hard-fails only on structurally invalid input. */
export function validateMilestoneFlowMetricsInput(input: MilestoneFlowMetricsInput): void {
  if (!input.scope || !input.scope.organizationId) throw new MpfMissingOrganizationScopeError();
  if (!input.scope.projectId) throw new MpfMissingProjectScopeError();
  if (!Array.isArray(input.transitions)) {
    throw new MpfUnknownFailureError("transitions must be an array");
  }
  if (input.options != null && typeof input.options !== "object") {
    throw new MpfUnknownFailureError("options must be an object");
  }
}

// ── (3) Segment duration ──────────────────────────────────────────────────────

/** (3) Duration of one segment; open segments require an explicit analysisAsOf. */
export function calculateMilestoneSegmentDuration(
  segment: SegmentForMetrics,
  options: MilestoneFlowMetricsOptions = {},
): MilestoneSegmentDurationResult {
  const warnings: MilestoneFlowEngineWarning[] = [];
  const startMs = parseIso(segment.startedAt);
  const endMs = parseIso(segment.endedAt);
  const asOfMs = parseIso(options.analysisAsOf);
  const isOpenEnded = segment.isOpenEnded ?? segment.endedAt == null;
  const confidence = segment.confidence ?? aggregateConfidence(segment.evidence);

  let segmentDurationMs: number | null = null;
  let completeness: MilestoneMetricCompleteness = "unknown";

  if (startMs == null) {
    warnings.push(warn("MISSING_SEGMENT_START", `segment ${segment.segmentId} has no valid start`, segment.transitionId));
    completeness = "unknown";
  } else if (endMs != null && !isOpenEnded) {
    // Closed segment.
    const d = endMs - startMs;
    if (d < 0) {
      warnings.push(warn("INVALID_SEGMENT_DURATION", `segment ${segment.segmentId} has negative duration`, segment.transitionId));
      completeness = "unknown";
    } else {
      segmentDurationMs = d;
      completeness = "complete";
    }
  } else {
    // Open segment — only measurable against an explicit analysisAsOf.
    if (asOfMs == null) {
      warnings.push(warn("MISSING_ANALYSIS_AS_OF_FOR_OPEN_SEGMENT", `segment ${segment.segmentId} is open and has no analysisAsOf`, segment.transitionId));
      warnings.push(warn("UNKNOWN_DURATION", `segment ${segment.segmentId} duration unknown`, segment.transitionId));
      if (endMs == null) warnings.push(warn("MISSING_SEGMENT_END", `segment ${segment.segmentId} has no end`, segment.transitionId));
      completeness = "unknown";
    } else {
      const d = asOfMs - startMs;
      if (d < 0) {
        warnings.push(warn("INVALID_SEGMENT_DURATION", `segment ${segment.segmentId} analysisAsOf precedes start`, segment.transitionId));
        completeness = "unknown";
      } else {
        segmentDurationMs = d;
        completeness = "partial"; // open, measured as-of a point in time
      }
    }
  }

  return {
    segmentId: segment.segmentId,
    transitionId: segment.transitionId,
    segmentType: segment.type,
    startedAt: segment.startedAt,
    endedAt: segment.endedAt,
    isOpenEnded,
    segmentDurationMs,
    durationCompleteness: completeness,
    evidenceRefs: segment.evidence,
    confidence,
    warnings,
  };
}

/** (4) Duration metrics for a set of segments. */
export function calculateMilestoneSegmentDurationMetrics(
  segments: readonly SegmentForMetrics[],
  options: MilestoneFlowMetricsOptions = {},
): MilestoneSegmentDurationResult[] {
  return segments.map((s) => calculateMilestoneSegmentDuration(s, options));
}

// ── (5) Time buckets ──────────────────────────────────────────────────────────

const ZERO_BUCKETS = (): MilestoneFlowTimeBuckets => ({
  activeWorkTimeMs: 0,
  waitingTimeMs: 0,
  blockedTimeMs: 0,
  decisionDelayTimeMs: 0,
  approvalDelayTimeMs: 0,
  reworkTimeMs: 0,
  handoffTimeMs: 0,
  reviewTimeMs: 0,
  externalConstraintTimeMs: 0,
  unknownTimeMs: 0,
  totalKnownSegmentTimeMs: 0,
});

const BUCKET_KEY: Record<MilestoneFlowSegmentType, keyof MilestoneFlowTimeBuckets> = {
  active_work: "activeWorkTimeMs",
  waiting: "waitingTimeMs",
  blocked: "blockedTimeMs",
  decision_delay: "decisionDelayTimeMs",
  approval_delay: "approvalDelayTimeMs",
  rework: "reworkTimeMs",
  handoff: "handoffTimeMs",
  review: "reviewTimeMs",
  external_constraint: "externalConstraintTimeMs",
  unknown: "unknownTimeMs",
};

/** (5) Aggregate KNOWN segment durations into flow-time buckets. */
export function aggregateMilestoneFlowTimeBuckets(
  segmentMetrics: readonly MilestoneSegmentDurationResult[],
): MilestoneFlowTimeBuckets {
  const buckets = ZERO_BUCKETS();
  for (const s of segmentMetrics) {
    if (s.segmentDurationMs == null) continue; // unknown durations never counted
    buckets[BUCKET_KEY[s.segmentType]] += s.segmentDurationMs;
    buckets.totalKnownSegmentTimeMs += s.segmentDurationMs;
  }
  return buckets;
}

// ── (6) Percentages (composition; denominator = totalKnownSegmentTimeMs) ──────

/** (6) Segment composition percentages. Null when the denominator is unusable. */
export function calculateMilestoneFlowPercentages(
  timeBuckets: MilestoneFlowTimeBuckets,
): MilestoneFlowPercentages {
  const total = timeBuckets.totalKnownSegmentTimeMs;
  const pct = (v: number): number | null => (total > 0 ? round2((v / total) * 100) : null);
  return {
    activeWorkPercent: pct(timeBuckets.activeWorkTimeMs),
    waitingPercent: pct(timeBuckets.waitingTimeMs),
    blockedPercent: pct(timeBuckets.blockedTimeMs),
    decisionDelayPercent: pct(timeBuckets.decisionDelayTimeMs),
    approvalDelayPercent: pct(timeBuckets.approvalDelayTimeMs),
    reworkPercent: pct(timeBuckets.reworkTimeMs),
    unknownPercent: pct(timeBuckets.unknownTimeMs),
    denominator: "totalKnownSegmentTimeMs",
  };
}

// ── (7) Flow efficiency ───────────────────────────────────────────────────────

/** (7) activeWork / totalKnownSegmentTime. Null when the denominator is unusable. */
export function calculateMilestoneFlowEfficiency(timeBuckets: MilestoneFlowTimeBuckets): number | null {
  const total = timeBuckets.totalKnownSegmentTimeMs;
  if (total <= 0) return null;
  return round4(timeBuckets.activeWorkTimeMs / total);
}

// ── Segment counters ──────────────────────────────────────────────────────────

function countSegments(segments: readonly SegmentForMetrics[]): MilestoneFlowSegmentCounters {
  const c: MilestoneFlowSegmentCounters = {
    segmentCount: segments.length,
    activeSegmentCount: 0,
    waitingSegmentCount: 0,
    blockedSegmentCount: 0,
    decisionDelaySegmentCount: 0,
    approvalDelaySegmentCount: 0,
    reworkSegmentCount: 0,
    openSegmentCount: 0,
    unknownSegmentCount: 0,
  };
  for (const s of segments) {
    if (s.type === "active_work") c.activeSegmentCount++;
    else if (s.type === "waiting") c.waitingSegmentCount++;
    else if (s.type === "blocked") c.blockedSegmentCount++;
    else if (s.type === "decision_delay") c.decisionDelaySegmentCount++;
    else if (s.type === "approval_delay") c.approvalDelaySegmentCount++;
    else if (s.type === "rework") c.reworkSegmentCount++;
    else if (s.type === "unknown") c.unknownSegmentCount++;
    if (s.isOpenEnded ?? s.endedAt == null) c.openSegmentCount++;
  }
  return c;
}

// ── (8) Transition duration metrics ───────────────────────────────────────────

/** (8) Planned / actual / forecast / elapsed / remaining transition durations. */
export function calculateMilestoneTransitionDurationMetrics(
  transition: Pick<MilestoneTransition, "sourceMilestoneId" | "targetMilestoneId" | "startedAt" | "completedAt">,
  options: TransitionMetricsOptions = {},
): { detail: MilestoneTransitionDurationDetail; warnings: MilestoneFlowEngineWarning[] } {
  const warnings: MilestoneFlowEngineWarning[] = [];
  const msMap = options.milestones;
  const source = transition.sourceMilestoneId ? msMap?.get(transition.sourceMilestoneId) : undefined;
  const target = msMap?.get(transition.targetMilestoneId);

  const nonNeg = (d: number | null, code: string, label: string): number | null => {
    if (d == null) return null;
    if (d < 0) { warnings.push(warn(code, `${label} is negative`)); return null; }
    return d;
  };

  // Planned (source planned → target planned).
  const sp = parseIso(source?.plannedDate ?? null);
  const tp = parseIso(target?.plannedDate ?? null);
  let plannedDurationMs: number | null = null;
  if (sp != null && tp != null) plannedDurationMs = nonNeg(tp - sp, "INVALID_TRANSITION_DURATION", "planned duration");
  else warnings.push(warn("MISSING_PLANNED_DATES", "planned dates missing for planned duration"));

  // Forecast (source forecast → target forecast) — no warning when simply absent.
  const sf = parseIso(source?.forecastDate ?? null);
  const tf = parseIso(target?.forecastDate ?? null);
  const forecastDurationMs =
    sf != null && tf != null ? nonNeg(tf - sf, "INVALID_TRANSITION_DURATION", "forecast duration") : null;

  // Actual (transition started → completed).
  const startMs = parseIso(transition.startedAt);
  const endMs = parseIso(transition.completedAt);
  const isCompleted = endMs != null;
  const isOpenEnded = !isCompleted;
  let actualDurationMs: number | null = null;
  if (startMs != null && endMs != null) {
    actualDurationMs = nonNeg(endMs - startMs, "INVALID_TRANSITION_DURATION", "actual duration");
  } else if (!isCompleted) {
    warnings.push(warn("MISSING_ACTUAL_DATES", "transition not completed; actual duration unknown"));
  }

  // Elapsed / remaining — open transitions only against an explicit analysisAsOf.
  const asOfMs = parseIso(options.analysisAsOf);
  let elapsedDurationMs: number | null = null;
  let remainingDurationMs: number | null = null;
  if (isCompleted) {
    elapsedDurationMs = actualDurationMs;
    remainingDurationMs = 0;
  } else if (asOfMs != null && startMs != null) {
    elapsedDurationMs = nonNeg(asOfMs - startMs, "INVALID_TRANSITION_DURATION", "elapsed duration");
    const targetEndMs = tf ?? tp;
    if (targetEndMs != null) remainingDurationMs = targetEndMs - asOfMs;
  }

  let durationCompleteness: MilestoneMetricCompleteness;
  if (actualDurationMs != null) durationCompleteness = "complete";
  else if (elapsedDurationMs != null || plannedDurationMs != null) durationCompleteness = "partial";
  else durationCompleteness = "unknown";

  return {
    detail: {
      plannedDurationMs,
      actualDurationMs,
      forecastDurationMs,
      elapsedDurationMs,
      remainingDurationMs,
      isCompleted,
      isOpenEnded,
      durationCompleteness,
    },
    warnings,
  };
}

// ── (9) Confidence ────────────────────────────────────────────────────────────

/** (9) Metric confidence — never above the weakest supporting evidence, and
 *  capped low by unknown segments / invalid or open-unknown durations. */
export function determineMilestoneMetricConfidence(params: {
  evidence: readonly MilestoneFlowEvidenceRef[];
  hasUnknownSegments: boolean;
  hasInvalidDurations: boolean;
  hasOpenWithoutAsOf: boolean;
}): MilestoneFlowEvidenceConfidence {
  if (params.evidence.length === 0) return "unknown";
  let conf = aggregateConfidence(params.evidence);
  if (params.hasUnknownSegments || params.hasInvalidDurations || params.hasOpenWithoutAsOf) {
    conf = capConfidence(conf, "low");
  }
  return conf;
}

// ── (12) Evidence merge (dedup) ───────────────────────────────────────────────

/** (12) Collect segment evidence refs without duplication. */
export function mergeMilestoneFlowMetricEvidence(
  _transition: Pick<MilestoneTransition, "evidenceEventIds">,
  segments: readonly SegmentForMetrics[],
): MilestoneFlowEvidenceRef[] {
  const seen = new Set<string>();
  const out: MilestoneFlowEvidenceRef[] = [];
  for (const s of segments) {
    for (const ref of s.evidence) {
      const key = `${ref.kind}|${ref.eventId ?? ""}|${ref.metricRef ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
  }
  return out;
}

// ── (2) Per-transition metrics ────────────────────────────────────────────────

/** (2) Full metrics for one transition (consumes Task 3 segments, never rebuilds). */
export function calculateMilestoneTransitionMetrics(
  transition: MilestoneTransition,
  options: TransitionMetricsOptions = {},
): MilestoneFlowTransitionMetrics {
  const segments = transition.segments as SegmentForMetrics[];
  const segmentDurations = calculateMilestoneSegmentDurationMetrics(segments, options);
  const timeBuckets = aggregateMilestoneFlowTimeBuckets(segmentDurations);
  const percentages = calculateMilestoneFlowPercentages(timeBuckets);
  const flowEfficiencyRatio = calculateMilestoneFlowEfficiency(timeBuckets);
  const counters = countSegments(segments);
  const { detail: durationDetail, warnings: durationWarnings } =
    calculateMilestoneTransitionDurationMetrics(transition, options);

  const segmentWarnings = segmentDurations.flatMap((s) => s.warnings);
  const warnings = [...segmentWarnings, ...durationWarnings];
  const hasInvalidDurations = warnings.some(
    (w) => w.code === "INVALID_SEGMENT_DURATION" || w.code === "INVALID_TRANSITION_DURATION",
  );
  const hasOpenWithoutAsOf = warnings.some((w) => w.code === "MISSING_ANALYSIS_AS_OF_FOR_OPEN_SEGMENT");

  const evidenceRefs = mergeMilestoneFlowMetricEvidence(transition, segments);
  const confidence = determineMilestoneMetricConfidence({
    evidence: evidenceRefs,
    hasUnknownSegments: counters.unknownSegmentCount > 0,
    hasInvalidDurations,
    hasOpenWithoutAsOf,
  });

  const calculationNotes = [
    `segment composition % denominator = totalKnownSegmentTimeMs (${timeBuckets.totalKnownSegmentTimeMs}ms)`,
    `open durations ${options.analysisAsOf ? `measured as-of ${options.analysisAsOf}` : "unknown (no analysisAsOf)"}`,
  ];

  return {
    transitionId: transition.transitionId,
    // Base MilestoneFlowMetrics fields:
    duration: {
      plannedDurationMs: durationDetail.plannedDurationMs,
      actualDurationMs: durationDetail.actualDurationMs,
      forecastDurationMs: durationDetail.forecastDurationMs,
    },
    activeWorkTimeMs: timeBuckets.activeWorkTimeMs,
    waitingTimeMs: timeBuckets.waitingTimeMs,
    blockedTimeMs: timeBuckets.blockedTimeMs,
    decisionDelayTimeMs: timeBuckets.decisionDelayTimeMs,
    approvalDelayTimeMs: timeBuckets.approvalDelayTimeMs,
    reworkTimeMs: timeBuckets.reworkTimeMs,
    reworkLoops: counters.reworkSegmentCount,
    escalationCount: null, // blocker/escalation detection is a later task
    unresolvedConstraintCount: null, // constraint propagation is a later task
    efficiency: {
      flowEfficiencyRatio,
      waitingTimePct: percentages.waitingPercent,
      blockedTimePct: percentages.blockedPercent,
    },
    // Extended builder-level detail:
    durationDetail,
    timeBuckets,
    percentages,
    counters,
    totalKnownSegmentTimeMs: timeBuckets.totalKnownSegmentTimeMs,
    confidence,
    evidenceRefs,
    segmentEvidenceRefs: evidenceRefs,
    segmentDurations,
    warnings,
    calculationNotes,
  };
}

// ── (1) All transitions ───────────────────────────────────────────────────────

/** (1) Calculate metrics for every transition. */
export function calculateMilestoneFlowMetrics(
  input: MilestoneFlowMetricsInput,
): MilestoneFlowMetricsResult {
  validateMilestoneFlowMetricsInput(input);

  const milestoneMap = new Map(input.milestones.map((m) => [m.milestoneId, m]));
  const options: TransitionMetricsOptions = { milestones: milestoneMap, analysisAsOf: input.options?.analysisAsOf ?? null };

  const metricsByTransition: Record<string, MilestoneFlowTransitionMetrics> = {};
  const warnings: MilestoneFlowEngineWarning[] = [];
  let metricsUnknownCount = 0;
  let openSegmentDurationCount = 0;
  let invalidDurationCount = 0;
  let totalKnownSegmentTimeMs = 0;

  for (const transition of input.transitions) {
    const m = calculateMilestoneTransitionMetrics(transition, options);
    metricsByTransition[transition.transitionId] = m;
    warnings.push(...m.warnings);
    if (m.durationDetail.durationCompleteness === "unknown" || m.confidence === "unknown") metricsUnknownCount += 1;
    openSegmentDurationCount += m.segmentDurations.filter((s) => s.durationCompleteness === "partial").length;
    invalidDurationCount += m.warnings.filter(
      (w) => w.code === "INVALID_SEGMENT_DURATION" || w.code === "INVALID_TRANSITION_DURATION",
    ).length;
    totalKnownSegmentTimeMs += m.totalKnownSegmentTimeMs;
  }

  return {
    metricsByTransition,
    warnings,
    stats: {
      metricsCalculatedCount: input.transitions.length,
      metricsUnknownCount,
      openSegmentDurationCount,
      invalidDurationCount,
      totalKnownSegmentTimeMs,
    },
  };
}
