// ============================================================================
// ProjectOps360° — MPF Engine · Delay Detector Types (Phase 3, Task 5)
// ============================================================================
// The output shapes of the first detection layer: blockers, waiting time,
// decision delays, and approval delays. Findings are DERIVED intelligence
// (never canonical truth, never health). Resolved vs unresolved is expressed by
// `status`, not by separate finding types. `severity` is DETECTION severity —
// explicitly NOT transition health. Durations are READ from Task 4 metrics
// (never recomputed here), so there is no Date.now() in detection.
// ============================================================================

import type {
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEngineWarning,
  MilestoneFlowProjectScope,
} from "./types";
import type { MilestoneFlowSemanticCategory } from "./event-semantics-types";
import type { BuiltMilestoneTransition } from "./transition-builder-types";
import type { MilestoneFlowTransitionMetrics } from "./metrics-calculator-types";

// ── Vocabularies ──────────────────────────────────────────────────────────────

export const MPF_FINDING_TYPES = ["blocker", "waiting_time", "decision_delay", "approval_delay"] as const;
export type MilestoneFlowFindingType = (typeof MPF_FINDING_TYPES)[number];

export const MPF_FINDING_STATUSES = ["open", "resolved", "partial", "unknown"] as const;
export type MilestoneFlowFindingStatus = (typeof MPF_FINDING_STATUSES)[number];

export const MPF_FINDING_SEVERITIES = ["critical", "high", "medium", "low", "unknown"] as const;
export type MilestoneFlowFindingSeverity = (typeof MPF_FINDING_SEVERITIES)[number];

export const MPF_DETECTION_WARNING_CODES = [
  "MISSING_METRICS_FOR_TRANSITION",
  "MISSING_SEGMENT_EVIDENCE",
  "MISSING_FINDING_DURATION",
  "UNKNOWN_FINDING_CONFIDENCE",
  "AMBIGUOUS_FINDING_STATUS",
  "DETECTION_WITH_PARTIAL_EVIDENCE",
  "UNKNOWN_SEGMENT_SKIPPED",
  "UNSUPPORTED_FINDING_SOURCE",
] as const;
export type MilestoneFlowDetectionWarningCode = (typeof MPF_DETECTION_WARNING_CODES)[number];

// ── The finding ───────────────────────────────────────────────────────────────

export interface MilestoneFlowDetectionFinding {
  findingId: string;
  transitionId: string;
  projectId: string;
  organizationId: string;
  findingType: MilestoneFlowFindingType;
  status: MilestoneFlowFindingStatus;
  /** Detection severity — NOT transition health. */
  severity: MilestoneFlowFindingSeverity;
  confidence: MilestoneFlowEvidenceConfidence;
  startedAt: string | null;
  endedAt: string | null;
  /** Read from Task 4 segment metrics — never recomputed. */
  durationMs: number | null;
  isOpen: boolean;
  sourceSegmentIds: string[];
  sourceEventIds: string[];
  evidenceRefs: MilestoneFlowEvidenceRef[];
  metricRefs: string[];
  semanticCategories: MilestoneFlowSemanticCategory[];
  calculationNotes: string[];
  warnings: MilestoneFlowEngineWarning[];
}

// ── Severity thresholds (configurable; conservative defaults) ─────────────────

export interface MilestoneFlowSeverityThresholds {
  /** Progress-blocking findings (blocker / decision_delay / approval_delay). */
  blockingCriticalMs: number;
  blockingHighMs: number;
  blockingMediumMs: number;
  /** Waiting-time findings. */
  waitingHighMs: number;
  waitingMediumMs: number;
}

const DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_MPF_SEVERITY_THRESHOLDS: MilestoneFlowSeverityThresholds = {
  blockingCriticalMs: 14 * DAY,
  blockingHighMs: 7 * DAY,
  blockingMediumMs: 3 * DAY,
  waitingHighMs: 14 * DAY,
  waitingMediumMs: 7 * DAY,
};

// ── Options / input / result ──────────────────────────────────────────────────

export interface MilestoneFlowDelayDetectionOptions {
  thresholds?: Partial<MilestoneFlowSeverityThresholds>;
}

export interface MilestoneFlowDelayDetectionInput {
  scope: MilestoneFlowProjectScope;
  transitions: BuiltMilestoneTransition[];
  metricsByTransition: Record<string, MilestoneFlowTransitionMetrics>;
  options?: MilestoneFlowDelayDetectionOptions;
}

export interface MilestoneFlowDelayDetectionStats {
  delayFindingCount: number;
  blockerFindingCount: number;
  waitingFindingCount: number;
  decisionDelayFindingCount: number;
  approvalDelayFindingCount: number;
  openFindingCount: number;
  resolvedFindingCount: number;
  unknownFindingCount: number;
  highSeverityFindingCount: number;
}

export interface MilestoneFlowDelayDetectionResult {
  findingsByTransition: Record<string, MilestoneFlowDetectionFinding[]>;
  findings: MilestoneFlowDetectionFinding[];
  warnings: MilestoneFlowEngineWarning[];
  stats: MilestoneFlowDelayDetectionStats;
}
