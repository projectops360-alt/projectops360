// ============================================================================
// ProjectOps360° — MPF Engine · Metrics Calculator Types (Phase 3, Task 4)
// ============================================================================
// The output shapes of the Milestone Flow Metrics Calculator. The rich
// per-transition result EXTENDS the Task 1 `MilestoneFlowMetrics` contract type
// additively, so the engine projection keeps working while callers get full
// detail (buckets, percentages, completeness, confidence, evidence, warnings).
//
// Metrics are derived measurement only — never health, never bottlenecks. Open
// durations are replay-stable: they are computed ONLY against an explicit
// `analysisAsOf`; there is no Date.now() anywhere in the calculation.
// ============================================================================

import type {
  MilestoneFlowMetrics,
  MilestoneTransitionDurationMetrics,
  MilestoneFlowSegmentType,
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEngineWarning,
} from "./types";

// ── Completeness ──────────────────────────────────────────────────────────────

export const MPF_METRIC_COMPLETENESS = ["complete", "partial", "unknown", "unavailable"] as const;
export type MilestoneMetricCompleteness = (typeof MPF_METRIC_COMPLETENESS)[number];

// ── Metrics warning codes ─────────────────────────────────────────────────────

export const MPF_METRICS_WARNING_CODES = [
  "MISSING_ANALYSIS_AS_OF_FOR_OPEN_SEGMENT",
  "MISSING_SEGMENT_START",
  "MISSING_SEGMENT_END",
  "INVALID_SEGMENT_DURATION",
  "INVALID_TRANSITION_DURATION",
  "MISSING_PLANNED_DATES",
  "MISSING_ACTUAL_DATES",
  "UNKNOWN_DURATION",
  "UNKNOWN_METRIC_CONFIDENCE",
] as const;
export type MilestoneFlowMetricsWarningCode = (typeof MPF_METRICS_WARNING_CODES)[number];

// ── Options ───────────────────────────────────────────────────────────────────

export interface MilestoneFlowMetricsOptions {
  /**
   * The explicit "as of" clock for OPEN durations (ISO). Required to compute any
   * elapsed/open duration — the calculator never reads the wall clock, so output
   * is replay-stable. When absent, open durations are null (unknown) + a warning.
   */
  analysisAsOf?: string | null;
}

// ── Segment duration result ───────────────────────────────────────────────────

export interface MilestoneSegmentDurationResult {
  segmentId: string;
  transitionId: string;
  segmentType: MilestoneFlowSegmentType;
  startedAt: string | null;
  endedAt: string | null;
  isOpenEnded: boolean;
  segmentDurationMs: number | null;
  durationCompleteness: MilestoneMetricCompleteness;
  evidenceRefs: MilestoneFlowEvidenceRef[];
  confidence: MilestoneFlowEvidenceConfidence;
  warnings: MilestoneFlowEngineWarning[];
}

// ── Time buckets ──────────────────────────────────────────────────────────────

export interface MilestoneFlowTimeBuckets {
  activeWorkTimeMs: number;
  waitingTimeMs: number;
  blockedTimeMs: number;
  decisionDelayTimeMs: number;
  approvalDelayTimeMs: number;
  reworkTimeMs: number;
  handoffTimeMs: number;
  reviewTimeMs: number;
  externalConstraintTimeMs: number;
  unknownTimeMs: number;
  /** Sum of all KNOWN segment durations — the denominator for composition %. */
  totalKnownSegmentTimeMs: number;
}

// ── Percentages (segment composition) ─────────────────────────────────────────

export interface MilestoneFlowPercentages {
  activeWorkPercent: number | null;
  waitingPercent: number | null;
  blockedPercent: number | null;
  decisionDelayPercent: number | null;
  approvalDelayPercent: number | null;
  reworkPercent: number | null;
  unknownPercent: number | null;
  /** The documented denominator used for these percentages. */
  denominator: "totalKnownSegmentTimeMs";
}

// ── Segment counters ──────────────────────────────────────────────────────────

export interface MilestoneFlowSegmentCounters {
  segmentCount: number;
  activeSegmentCount: number;
  waitingSegmentCount: number;
  blockedSegmentCount: number;
  decisionDelaySegmentCount: number;
  approvalDelaySegmentCount: number;
  reworkSegmentCount: number;
  openSegmentCount: number;
  unknownSegmentCount: number;
}

// ── Transition duration detail (extends the Task 1 duration metrics) ──────────

export interface MilestoneTransitionDurationDetail extends MilestoneTransitionDurationMetrics {
  elapsedDurationMs: number | null;
  remainingDurationMs: number | null;
  isCompleted: boolean;
  isOpenEnded: boolean;
  durationCompleteness: MilestoneMetricCompleteness;
}

// ── The rich per-transition metrics (extends the Task 1 contract type) ────────

export interface MilestoneFlowTransitionMetrics extends MilestoneFlowMetrics {
  transitionId: string;
  durationDetail: MilestoneTransitionDurationDetail;
  timeBuckets: MilestoneFlowTimeBuckets;
  percentages: MilestoneFlowPercentages;
  counters: MilestoneFlowSegmentCounters;
  totalKnownSegmentTimeMs: number;
  confidence: MilestoneFlowEvidenceConfidence;
  evidenceRefs: MilestoneFlowEvidenceRef[];
  segmentEvidenceRefs: MilestoneFlowEvidenceRef[];
  segmentDurations: MilestoneSegmentDurationResult[];
  warnings: MilestoneFlowEngineWarning[];
  calculationNotes: string[];
}

// ── Calculator result ─────────────────────────────────────────────────────────

export interface MilestoneFlowMetricsStats {
  metricsCalculatedCount: number;
  metricsUnknownCount: number;
  openSegmentDurationCount: number;
  invalidDurationCount: number;
  totalKnownSegmentTimeMs: number;
}

export interface MilestoneFlowMetricsResult {
  metricsByTransition: Record<string, MilestoneFlowTransitionMetrics>;
  warnings: MilestoneFlowEngineWarning[];
  stats: MilestoneFlowMetricsStats;
}
