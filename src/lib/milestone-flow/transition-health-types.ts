// ============================================================================
// ProjectOps360° — MPF Engine · Transition Health Types (Phase 3, Task 7)
// ============================================================================
// The output shapes of the Transition Health Classifier. Health is DERIVED
// intelligence, never canonical truth. It is classified CONSERVATIVELY from Task 3
// segments + Task 4 metrics + Task 5 delay findings + Task 6 advanced findings —
// weak/incomplete evidence lowers confidence or yields `unknown`. Reason codes are
// machine-readable. The rich result maps to the Task 1 `MilestoneTransitionHealth`
// contract (see the classifier's toBaseTransitionHealth). No Date.now(), no LLM.
// ============================================================================

import type {
  MilestoneTransition,
  MilestoneTransitionHealthStatus,
  MilestoneTransitionHealthReason,
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEngineWarning,
  MilestoneFlowProjectScope,
  MilestoneProcessFlowEngineVersion,
  MilestoneProcessFlowConfigVersion,
} from "./types";
import type { BuiltMilestoneTransition } from "./transition-builder-types";
import type { MilestoneFlowTransitionMetrics } from "./metrics-calculator-types";
import type { MilestoneFlowDetectionFinding } from "./delay-detector-types";
import type {
  MilestoneFlowReworkFinding,
  MilestoneFlowBottleneckFinding,
  MilestoneConstraintPropagationFinding,
} from "./advanced-detection-types";

// ── Machine-readable reason codes ─────────────────────────────────────────────

export const MPF_HEALTH_REASON_CODES = [
  "insufficient_evidence",
  "no_material_friction",
  "minor_friction",
  "waiting",
  "blocker_open",
  "blocker_resolved",
  "decision_delay",
  "approval_delay",
  "rework",
  "bottleneck_candidate",
  "propagation",
  "poor_flow_efficiency",
  "high_unknown_time",
  "missing_evidence",
  "recovered",
  "regressed",
  "conflicting_evidence",
  "unknown",
] as const;
export type MilestoneHealthReasonCode = (typeof MPF_HEALTH_REASON_CODES)[number];

// ── Recommended action categories (categories only — never prose) ─────────────

export const MPF_RECOMMENDED_ACTION_CATEGORIES = [
  "resolve_blocker",
  "escalate_risk",
  "investigate_friction",
  "review_regression",
  "monitor_recovery",
  "monitor",
  "gather_evidence",
  "none",
] as const;
export type MilestoneRecommendedActionCategory = (typeof MPF_RECOMMENDED_ACTION_CATEGORIES)[number];

// ── Uncertainty note keys ─────────────────────────────────────────────────────

export const MPF_HEALTH_UNCERTAINTY_NOTES = [
  "missing_metrics",
  "missing_evidence",
  "ambiguous_blocker_cause",
  "possible_propagation",
  "unknown_duration",
  "backfilled_only_evidence",
  "conflicting_signals",
  "insufficient_transition_evidence",
] as const;
export type MilestoneHealthUncertaintyNote = (typeof MPF_HEALTH_UNCERTAINTY_NOTES)[number];

// ── Per-transition classifier input ───────────────────────────────────────────

/**
 * The minimal metrics view the health classifier reads. Both the Task 4 rich
 * `MilestoneFlowTransitionMetrics` and the Task 1 base `MilestoneFlowMetrics`
 * satisfy it, so the engine's single-transition contract method (base metrics)
 * and the projection path (rich metrics) both work.
 */
export interface MilestoneFlowHealthMetricsView {
  efficiency?: { flowEfficiencyRatio: number | null };
  totalKnownSegmentTimeMs?: number;
  timeBuckets?: { unknownTimeMs: number };
  confidence?: MilestoneFlowEvidenceConfidence;
}

export interface MilestoneTransitionHealthClassificationInput {
  scope: MilestoneFlowProjectScope;
  /** Base transition suffices (built transitions are assignable). */
  transition: MilestoneTransition;
  metrics?: MilestoneFlowHealthMetricsView;
  delayFindings?: MilestoneFlowDetectionFinding[];
  reworkFindings?: MilestoneFlowReworkFinding[];
  bottleneckFindings?: MilestoneFlowBottleneckFinding[];
  /** Propagation findings where this transition is origin or affected. */
  propagationFindings?: MilestoneConstraintPropagationFinding[];
}

// ── All-transitions input ─────────────────────────────────────────────────────

export interface MilestoneFlowHealthClassificationInput {
  scope: MilestoneFlowProjectScope;
  transitions: BuiltMilestoneTransition[];
  metricsByTransition: Record<string, MilestoneFlowTransitionMetrics>;
  findingsByTransition: Record<string, MilestoneFlowDetectionFinding[]>;
  reworkFindingsByTransition?: Record<string, MilestoneFlowReworkFinding[]>;
  bottleneckFindingsByTransition?: Record<string, MilestoneFlowBottleneckFinding[]>;
  constraintPropagationFindings?: MilestoneConstraintPropagationFinding[];
}

// ── The rich health summary ───────────────────────────────────────────────────

export interface MilestoneTransitionHealthSummaryResult {
  transitionId: string;
  projectId: string;
  organizationId: string;
  healthStatus: MilestoneTransitionHealthStatus;
  confidence: MilestoneFlowEvidenceConfidence;
  reasonCodes: MilestoneHealthReasonCode[];
  reasons: MilestoneTransitionHealthReason[];
  evidenceRefs: MilestoneFlowEvidenceRef[];
  supportingFindingIds: string[];
  supportingSegmentIds: string[];
  metricRefs: string[];
  recommendedActionCategory: MilestoneRecommendedActionCategory;
  uncertaintyNotes: MilestoneHealthUncertaintyNote[];
  warnings: MilestoneFlowEngineWarning[];
  engineVersion: MilestoneProcessFlowEngineVersion;
  configVersion: MilestoneProcessFlowConfigVersion;
}

export interface MilestoneFlowHealthClassificationStats {
  healthAssessmentCount: number;
  healthyTransitionCount: number;
  watchTransitionCount: number;
  degradedTransitionCount: number;
  blockedTransitionCount: number;
  atRiskTransitionCount: number;
  recoveringTransitionCount: number;
  regressedTransitionCount: number;
  unknownHealthCount: number;
}

export interface MilestoneFlowHealthClassificationResult {
  healthSummariesByTransition: Record<string, MilestoneTransitionHealthSummaryResult>;
  warnings: MilestoneFlowEngineWarning[];
  stats: MilestoneFlowHealthClassificationStats;
}
