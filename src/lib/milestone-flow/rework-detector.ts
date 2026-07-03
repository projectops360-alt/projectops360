// ============================================================================
// ProjectOps360° — MPF Engine · Rework Detector (Phase 3, Task 6)
// ============================================================================
// Detects rework findings from Task 3 segments. A `rework` segment is DEFINITE
// rework; a non-rework segment carrying scope-change / quality friction is a
// POSSIBLE rework (never asserted as certain). Rework TYPE is derived from the
// segment's semantic categories / friction (attached by Task 2/3) — it does not
// re-interpret events. Durations are READ from Task 4 metrics (no Date.now()).
// Pure, deterministic, read-only. Not health.
// ============================================================================

import {
  determineAdvancedFindingStatus,
  determineAdvancedFindingSeverity,
  determineAdvancedFindingConfidence,
  mergeAdvancedFindingEvidence,
  resolveBottleneckThresholds,
  advWarn,
} from "./advanced-detection-shared";
import {
  MpfMissingProjectScopeError,
  MpfMissingOrganizationScopeError,
  MpfUnknownFailureError,
} from "./errors";
import type { MilestoneFlowEvidenceRef, MilestoneFlowEngineWarning, MilestoneFlowProjectScope } from "./types";
import type { MilestoneFlowSemanticCategory } from "./event-semantics-types";
import type { BuiltMilestoneTransition } from "./transition-builder-types";
import type { MilestoneFlowTransitionMetrics, MilestoneSegmentDurationResult } from "./metrics-calculator-types";
import type { SegmentForDetection } from "./delay-detector";
import {
  type MilestoneFlowReworkFinding,
  type MilestoneFlowReworkType,
  type MilestoneFlowReworkTriggerType,
  type MilestoneFlowAdvancedDetectionOptions,
} from "./advanced-detection-types";

const TRIGGER_FOR_TYPE: Record<MilestoneFlowReworkType, MilestoneFlowReworkTriggerType> = {
  task_reopened: "reopened_work",
  approval_rejection: "rejected_approval",
  decision_reversal: "reversed_decision",
  scope_change: "changed_scope",
  requirement_change: "unknown",
  defect_or_quality_failure: "raised_defect",
  deliverable_revision: "revised_document",
  milestone_regression: "reopened_milestone",
  unknown: "unknown",
};

/** (8) Determine the rework type from the segment's categories/friction (Task 2/3). */
export function determineMilestoneReworkType(segment: SegmentForDetection): MilestoneFlowReworkType {
  const cats = new Set(segment.semanticCategories ?? []);
  if (segment.type === "rework") {
    if (cats.has("approval")) return "approval_rejection";
    if (cats.has("decision")) return "decision_reversal";
    if (cats.has("document") || cats.has("deliverable")) return "deliverable_revision";
    if (cats.has("milestone") || cats.has("project") || cats.has("phase")) return "milestone_regression";
    if (cats.has("work")) return "task_reopened";
    return "task_reopened"; // a rework segment with no clearer category is a reopen
  }
  // Possible rework signalled by friction on a non-rework segment.
  if (segment.frictionType === "scope_change") return "scope_change";
  if (segment.frictionType === "quality") return "defect_or_quality_failure";
  return "unknown";
}

export interface BuildReworkFindingParams {
  scope: MilestoneFlowProjectScope;
  transitionId: string;
  segment: SegmentForDetection;
  durationResult: MilestoneSegmentDurationResult | undefined;
  metricConfidence?: MilestoneFlowTransitionMetrics["confidence"];
  isPossible: boolean;
  thresholds: ReturnType<typeof resolveBottleneckThresholds>;
}

/** (5) Build a normalized rework finding. */
export function buildMilestoneFlowReworkFinding(params: BuildReworkFindingParams): MilestoneFlowReworkFinding {
  const { scope, transitionId, segment, durationResult, isPossible, thresholds } = params;
  const warnings: MilestoneFlowEngineWarning[] = [];

  const reworkType = determineMilestoneReworkType(segment);
  if (reworkType === "unknown") warnings.push(advWarn("UNKNOWN_REWORK_SOURCE", `rework type unknown for ${segment.segmentId}`, transitionId));
  const triggerType = TRIGGER_FOR_TYPE[reworkType];

  const evidenceRefs = mergeAdvancedFindingEvidence(segment.evidence, durationResult?.evidenceRefs ?? []);
  if (evidenceRefs.length === 0) warnings.push(advWarn("MISSING_REWORK_EVIDENCE", `no evidence for rework ${segment.segmentId}`, transitionId));

  const durationMs = durationResult?.segmentDurationMs ?? null;
  const isOpen = segment.isOpenEnded ?? segment.endedAt == null;

  const confidence = determineAdvancedFindingConfidence({
    evidence: evidenceRefs,
    sourceConfidences: segment.confidence ? [segment.confidence] : [],
    durationMs,
  });
  if (confidence === "unknown") warnings.push(advWarn("UNKNOWN_ADVANCED_FINDING_CONFIDENCE", `rework ${segment.segmentId} unknown confidence`, transitionId));

  const status = determineAdvancedFindingStatus({
    hasEvidence: evidenceRefs.length > 0,
    isPossible,
    isOpen,
    hasResolution: !isOpen && segment.closingEventId != null,
    durationKnown: durationMs != null,
  });
  if (status === "partial" || status === "possible") {
    warnings.push(advWarn("ADVANCED_DETECTION_WITH_PARTIAL_EVIDENCE", `rework ${segment.segmentId} is ${status}`, transitionId));
  }

  const severity = determineAdvancedFindingSeverity({ durationMs, isOpen, confidence }, thresholds);

  const sourceEventIds = collectEventIds(segment, evidenceRefs);
  const semanticCategories: MilestoneFlowSemanticCategory[] = segment.semanticCategories ?? [];

  return {
    findingId: `${transitionId}__rework_${reworkType}_${segment.segmentId}`,
    transitionId,
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    status,
    severity,
    confidence,
    startedAt: segment.startedAt,
    endedAt: segment.endedAt,
    durationMs,
    isOpen,
    reworkType,
    triggerType,
    sourceSegmentIds: [segment.segmentId],
    sourceEventIds,
    evidenceRefs,
    metricRefs: ["metrics.reworkTimeMs", `metrics.segmentDurations.${segment.segmentId}`],
    semanticCategories,
    // Entity linkage is not exposed at the segment level yet — reserved for a
    // future task that threads canonical entity refs through the builder.
    affectedEntityRefs: [],
    calculationNotes: [
      `${isPossible ? "possible " : ""}rework=${reworkType} trigger=${triggerType} from ${segment.type} segment`,
      `duration read from Task 4 metrics (${durationMs == null ? "unknown" : durationMs + "ms"}); status=${status}; severity=${severity} (not health)`,
    ],
    warnings,
  };
}

function collectEventIds(segment: SegmentForDetection, evidence: readonly MilestoneFlowEvidenceRef[]): string[] {
  const ids = new Set<string>();
  if (segment.sourceEventId) ids.add(segment.sourceEventId);
  if (segment.closingEventId) ids.add(segment.closingEventId);
  for (const e of evidence) if (e.eventId) ids.add(e.eventId);
  return [...ids];
}

/** (2) Detect rework findings for one transition. */
export function detectMilestoneTransitionReworkFindings(
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  options: MilestoneFlowAdvancedDetectionOptions = {},
): MilestoneFlowReworkFinding[] {
  const thresholds = resolveBottleneckThresholds(options.bottleneckThresholds);
  const durations = new Map<string, MilestoneSegmentDurationResult>();
  for (const d of metrics?.segmentDurations ?? []) durations.set(d.segmentId, d);

  const out: MilestoneFlowReworkFinding[] = [];
  for (const segment of transition.segments) {
    const isReworkSegment = segment.type === "rework";
    const isPossibleRework = !isReworkSegment && (segment.frictionType === "scope_change" || segment.frictionType === "quality");
    if (!isReworkSegment && !isPossibleRework) continue;
    out.push(
      buildMilestoneFlowReworkFinding({
        scope: transition.scope,
        transitionId: transition.transitionId,
        segment,
        durationResult: durations.get(segment.segmentId),
        metricConfidence: metrics?.confidence,
        isPossible: isPossibleRework,
        thresholds,
      }),
    );
  }
  return out;
}

/** (5) Determine the rework trigger type from the segment (mirrors the rework type). */
export function determineMilestoneReworkTriggerType(segment: SegmentForDetection): MilestoneFlowReworkTriggerType {
  return TRIGGER_FOR_TYPE[determineMilestoneReworkType(segment)];
}

// ── Standalone rework detection entry point (Task 6A) ─────────────────────────
// Rework detection also flows through the advanced-detection orchestrator (Task 6);
// this is the focused, rework-only public API. It consumes Task 3 transitions +
// Task 4 metrics read-only, never rebuilds them, and never touches bottleneck or
// constraint-propagation detection.

export interface MilestoneFlowReworkDetectionInput {
  scope: MilestoneFlowProjectScope;
  transitions: BuiltMilestoneTransition[];
  metricsByTransition: Record<string, MilestoneFlowTransitionMetrics>;
  options?: MilestoneFlowAdvancedDetectionOptions;
}

export interface MilestoneFlowReworkDetectionResult {
  reworkFindingsByTransition: Record<string, MilestoneFlowReworkFinding[]>;
  findings: MilestoneFlowReworkFinding[];
  warnings: MilestoneFlowEngineWarning[];
}

/** (10) Validate rework-detection input (hard-fails only on structural issues). */
export function validateMilestoneReworkDetectionInput(input: MilestoneFlowReworkDetectionInput): void {
  if (!input.scope || !input.scope.organizationId) throw new MpfMissingOrganizationScopeError();
  if (!input.scope.projectId) throw new MpfMissingProjectScopeError();
  if (!Array.isArray(input.transitions)) throw new MpfUnknownFailureError("transitions must be an array");
  if (input.metricsByTransition == null || typeof input.metricsByTransition !== "object") {
    throw new MpfUnknownFailureError("metricsByTransition must be an object");
  }
}

/** (1) Detect rework findings across all transitions. */
export function detectMilestoneFlowReworkFindings(
  input: MilestoneFlowReworkDetectionInput,
): MilestoneFlowReworkDetectionResult {
  validateMilestoneReworkDetectionInput(input);
  const reworkFindingsByTransition: Record<string, MilestoneFlowReworkFinding[]> = {};
  const findings: MilestoneFlowReworkFinding[] = [];
  const warnings: MilestoneFlowEngineWarning[] = [];
  for (const transition of input.transitions) {
    const metrics = input.metricsByTransition[transition.transitionId];
    const rework = detectMilestoneTransitionReworkFindings(transition, metrics, input.options);
    reworkFindingsByTransition[transition.transitionId] = rework;
    findings.push(...rework);
    warnings.push(...rework.flatMap((r) => r.warnings));
  }
  return { reworkFindingsByTransition, findings, warnings };
}
