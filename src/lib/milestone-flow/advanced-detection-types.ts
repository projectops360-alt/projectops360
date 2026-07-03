// ============================================================================
// ProjectOps360° — MPF Engine · Advanced Detection Types (Phase 3, Task 6)
// ============================================================================
// The output shapes of the second detection layer: rework, bottleneck candidates,
// and constraint propagation. All are DERIVED intelligence — never canonical
// truth, never transition health. `severity` is DETECTION severity, explicitly
// NOT health. Durations are READ from Task 4 metrics (never recomputed), so there
// is no Date.now() in advanced detection. Vocabularies reuse Task 1 where they
// exist (bottleneck types) and extend additively where the task requires more
// (rework types, propagation finding types).
// ============================================================================

import type {
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEngineWarning,
  MilestoneFlowProjectScope,
  MilestoneFlowBottleneckType,
} from "./types";
import type { MilestoneFlowSemanticCategory } from "./event-semantics-types";
import type { BuiltMilestoneTransition } from "./transition-builder-types";
import type { MilestoneFlowTransitionMetrics } from "./metrics-calculator-types";
import type { MilestoneFlowDetectionFinding } from "./delay-detector-types";

// ── Shared status / severity ──────────────────────────────────────────────────

export const MPF_ADVANCED_FINDING_STATUSES = ["open", "resolved", "partial", "possible", "unknown"] as const;
export type MilestoneFlowAdvancedFindingStatus = (typeof MPF_ADVANCED_FINDING_STATUSES)[number];

export const MPF_ADVANCED_FINDING_SEVERITIES = ["critical", "high", "medium", "low", "unknown"] as const;
export type MilestoneFlowAdvancedFindingSeverity = (typeof MPF_ADVANCED_FINDING_SEVERITIES)[number];

export const MPF_ADVANCED_DETECTION_WARNING_CODES = [
  "MISSING_METRICS_FOR_ADVANCED_DETECTION",
  "MISSING_DELAY_FINDINGS_FOR_BOTTLENECK_DETECTION",
  "MISSING_REWORK_EVIDENCE",
  "MISSING_BOTTLENECK_EVIDENCE",
  "MISSING_PROPAGATION_EVIDENCE",
  "AMBIGUOUS_PROPAGATION_PATH",
  "POSSIBLE_PROPAGATION_LOW_CONFIDENCE",
  "UNKNOWN_REWORK_SOURCE",
  "UNKNOWN_BOTTLENECK_SOURCE",
  "UNKNOWN_ADVANCED_FINDING_CONFIDENCE",
  "ADVANCED_DETECTION_WITH_PARTIAL_EVIDENCE",
] as const;
export type MilestoneFlowAdvancedDetectionWarningCode = (typeof MPF_ADVANCED_DETECTION_WARNING_CODES)[number];

// ── Rework ────────────────────────────────────────────────────────────────────

export const MPF_REWORK_TYPES = [
  "task_reopened",
  "approval_rejection",
  "decision_reversal",
  "scope_change",
  "requirement_change",
  "defect_or_quality_failure",
  "deliverable_revision",
  "milestone_regression",
  "unknown",
] as const;
export type MilestoneFlowReworkType = (typeof MPF_REWORK_TYPES)[number];

export const MPF_REWORK_TRIGGER_TYPES = [
  "reopened_work",
  "rejected_approval",
  "reversed_decision",
  "changed_scope",
  "raised_defect",
  "revised_document",
  "reopened_milestone",
  "unknown",
] as const;
export type MilestoneFlowReworkTriggerType = (typeof MPF_REWORK_TRIGGER_TYPES)[number];

export interface MilestoneFlowReworkFinding {
  findingId: string;
  transitionId: string;
  projectId: string;
  organizationId: string;
  status: MilestoneFlowAdvancedFindingStatus;
  severity: MilestoneFlowAdvancedFindingSeverity;
  confidence: MilestoneFlowEvidenceConfidence;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  isOpen: boolean;
  reworkType: MilestoneFlowReworkType;
  triggerType: MilestoneFlowReworkTriggerType;
  sourceSegmentIds: string[];
  sourceEventIds: string[];
  evidenceRefs: MilestoneFlowEvidenceRef[];
  metricRefs: string[];
  semanticCategories: MilestoneFlowSemanticCategory[];
  affectedEntityRefs: string[];
  calculationNotes: string[];
  warnings: MilestoneFlowEngineWarning[];
}

// ── Bottleneck (bottleneckType reuses the Task 1 vocabulary) ──────────────────

export interface MilestoneFlowBottleneckFinding {
  findingId: string;
  transitionId: string;
  projectId: string;
  organizationId: string;
  bottleneckType: MilestoneFlowBottleneckType;
  status: MilestoneFlowAdvancedFindingStatus;
  severity: MilestoneFlowAdvancedFindingSeverity;
  confidence: MilestoneFlowEvidenceConfidence;
  durationMs: number | null;
  occurrenceCount: number;
  affectedSegmentIds: string[];
  affectedFindingIds: string[];
  sourceEventIds: string[];
  evidenceRefs: MilestoneFlowEvidenceRef[];
  metricRefs: string[];
  candidateReason: string;
  isStructuralCandidate: boolean;
  calculationNotes: string[];
  warnings: MilestoneFlowEngineWarning[];
}

export interface MilestoneFlowBottleneckThresholds {
  /** A single delay this long is a candidate. */
  longDurationMs: number;
  /** Same friction type occurring this many times in a transition is structural. */
  repeatedOccurrenceCount: number;
  /** This share (0–100) of known segment time makes a candidate. */
  significantPctOfKnownTime: number;
  /** Duration severity ladder (shared with rework/propagation). */
  criticalMs: number;
  highMs: number;
  mediumMs: number;
}

const DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_MPF_BOTTLENECK_THRESHOLDS: MilestoneFlowBottleneckThresholds = {
  longDurationMs: 7 * DAY,
  repeatedOccurrenceCount: 2,
  significantPctOfKnownTime: 40,
  criticalMs: 14 * DAY,
  highMs: 7 * DAY,
  mediumMs: 3 * DAY,
};

// ── Constraint propagation (finding-type extends Task 1 with blocker/unknown) ──

export const MPF_PROPAGATION_FINDING_TYPES = [
  "direct_dependency",
  "decision",
  "approval",
  "risk",
  "blocker",
  "resource",
  "rework",
  "scope_change",
  "external_constraint",
  "unknown",
] as const;
export type MilestoneFlowPropagationFindingType = (typeof MPF_PROPAGATION_FINDING_TYPES)[number];

export interface MilestoneConstraintPropagationFinding {
  findingId: string;
  originTransitionId: string;
  affectedTransitionId: string;
  projectId: string;
  organizationId: string;
  propagationType: MilestoneFlowPropagationFindingType;
  status: MilestoneFlowAdvancedFindingStatus;
  severity: MilestoneFlowAdvancedFindingSeverity;
  confidence: MilestoneFlowEvidenceConfidence;
  originEventIds: string[];
  affectedEventIds: string[];
  originSegmentIds: string[];
  affectedSegmentIds: string[];
  originFindingIds: string[];
  affectedFindingIds: string[];
  evidenceRefs: MilestoneFlowEvidenceRef[];
  metricRefs: string[];
  propagationPath: string[];
  propagationReason: string;
  delayImpactMs: number | null;
  riskImpact: string | null;
  calculationNotes: string[];
  warnings: MilestoneFlowEngineWarning[];
}

// ── Options / input / result ──────────────────────────────────────────────────

export interface MilestoneFlowAdvancedDetectionOptions {
  bottleneckThresholds?: Partial<MilestoneFlowBottleneckThresholds>;
}

export interface MilestoneFlowAdvancedDetectionInput {
  scope: MilestoneFlowProjectScope;
  transitions: BuiltMilestoneTransition[];
  metricsByTransition: Record<string, MilestoneFlowTransitionMetrics>;
  findingsByTransition: Record<string, MilestoneFlowDetectionFinding[]>;
  options?: MilestoneFlowAdvancedDetectionOptions;
}

export interface MilestoneFlowAdvancedDetectionStats {
  reworkFindingCount: number;
  bottleneckFindingCount: number;
  constraintPropagationFindingCount: number;
  structuralBottleneckCandidateCount: number;
  possiblePropagationCount: number;
  openAdvancedFindingCount: number;
  resolvedAdvancedFindingCount: number;
  unknownAdvancedFindingCount: number;
  highSeverityAdvancedFindingCount: number;
}

export interface MilestoneFlowAdvancedDetectionResult {
  reworkFindingsByTransition: Record<string, MilestoneFlowReworkFinding[]>;
  bottleneckFindingsByTransition: Record<string, MilestoneFlowBottleneckFinding[]>;
  constraintPropagationFindings: MilestoneConstraintPropagationFinding[];
  warnings: MilestoneFlowEngineWarning[];
  stats: MilestoneFlowAdvancedDetectionStats;
}
