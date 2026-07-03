// ============================================================================
// ProjectOps360° — MPF Engine · Constraint Propagation Detector (Phase 3, Task 6)
// ============================================================================
// Detects, CONSERVATIVELY, how a constraint in one transition appears to affect a
// downstream transition. Two evidence-backed signals only:
//   1. Shared evidence — the SAME eventId links an upstream and a downstream
//      transition (higher confidence).
//   2. Sequential unresolved — an OPEN upstream constraint + a downstream
//      blocked/waiting segment (POSSIBLE, low confidence, warned).
// Never fabricated: without linkage there is NO finding. Ordering follows the
// transition array (milestone order from Task 3). No Date.now(); read-only.
// ============================================================================

import {
  determineAdvancedFindingConfidence,
  mergeAdvancedFindingEvidence,
  advWarn,
} from "./advanced-detection-shared";
import type { MilestoneFlowEvidenceRef, MilestoneFlowEngineWarning, MilestoneFlowProjectScope } from "./types";
import type { BuiltMilestoneTransition } from "./transition-builder-types";
import type { MilestoneFlowTransitionMetrics } from "./metrics-calculator-types";
import type { MilestoneFlowDetectionFinding, MilestoneFlowFindingType } from "./delay-detector-types";
import {
  type MilestoneConstraintPropagationFinding,
  type MilestoneFlowPropagationFindingType,
  type MilestoneFlowAdvancedFindingStatus,
} from "./advanced-detection-types";

const PROPAGATION_TYPE_FOR_FINDING: Record<MilestoneFlowFindingType, MilestoneFlowPropagationFindingType> = {
  blocker: "blocker",
  decision_delay: "decision",
  approval_delay: "approval",
  waiting_time: "unknown",
};

/** (10) Determine propagation type from the linking origin finding (or default). */
export function determineMilestonePropagationType(
  originFinding: MilestoneFlowDetectionFinding | undefined,
): MilestoneFlowPropagationFindingType {
  if (!originFinding) return "direct_dependency"; // a shared entity link with no delay finding
  return PROPAGATION_TYPE_FOR_FINDING[originFinding.findingType] ?? "unknown";
}

interface TransitionIndex {
  transition: BuiltMilestoneTransition;
  order: number;
  findings: MilestoneFlowDetectionFinding[];
  /** eventId → the refs/segments/findings that carry it, within this transition. */
  eventIds: Set<string>;
}

function indexTransition(
  transition: BuiltMilestoneTransition,
  order: number,
  findings: MilestoneFlowDetectionFinding[],
): TransitionIndex {
  const eventIds = new Set<string>();
  for (const s of transition.segments) {
    if ((s as { sourceEventId?: string }).sourceEventId) eventIds.add((s as { sourceEventId?: string }).sourceEventId!);
    for (const e of s.evidence) if (e.eventId) eventIds.add(e.eventId);
  }
  for (const f of findings) for (const id of f.sourceEventIds) eventIds.add(id);
  return { transition, order, findings, eventIds };
}

export interface BuildPropagationFindingParams {
  scope: MilestoneFlowProjectScope;
  origin: TransitionIndex;
  affected: TransitionIndex;
  propagationType: MilestoneFlowPropagationFindingType;
  status: MilestoneFlowAdvancedFindingStatus;
  isPossible: boolean;
  sharedEventIds: string[];
  originFinding?: MilestoneFlowDetectionFinding;
  affectedFindingIds: string[];
  affectedSegmentIds: string[];
  evidenceRefs: MilestoneFlowEvidenceRef[];
  reason: string;
}

/** (7) Build a normalized constraint-propagation finding. */
export function buildMilestoneConstraintPropagationFinding(params: BuildPropagationFindingParams): MilestoneConstraintPropagationFinding {
  const { scope, origin, affected, propagationType, status, isPossible, sharedEventIds, evidenceRefs, reason } = params;
  const warnings: MilestoneFlowEngineWarning[] = [];
  if (evidenceRefs.length === 0) warnings.push(advWarn("MISSING_PROPAGATION_EVIDENCE", "propagation without evidence", origin.transition.transitionId));
  if (isPossible) warnings.push(advWarn("POSSIBLE_PROPAGATION_LOW_CONFIDENCE", `possible propagation ${origin.transition.transitionId}→${affected.transition.transitionId}`, origin.transition.transitionId));

  const confidence = determineAdvancedFindingConfidence({
    evidence: evidenceRefs,
    sourceConfidences: params.originFinding ? [params.originFinding.confidence] : [],
    durationMs: params.originFinding?.durationMs ?? null,
    hasEntityLinkage: sharedEventIds.length > 0,
  });
  const delayImpactMs = params.originFinding?.durationMs ?? null;

  return {
    findingId: `prop_${origin.transition.transitionId}__to__${affected.transition.transitionId}_${propagationType}`,
    originTransitionId: origin.transition.transitionId,
    affectedTransitionId: affected.transition.transitionId,
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    propagationType,
    status,
    severity: confidence === "unknown" ? "unknown" : isPossible ? "low" : delayImpactMs != null && delayImpactMs >= 7 * 24 * 60 * 60 * 1000 ? "high" : "medium",
    confidence,
    originEventIds: sharedEventIds.length ? sharedEventIds : (params.originFinding?.sourceEventIds ?? []),
    affectedEventIds: sharedEventIds,
    originSegmentIds: params.originFinding?.sourceSegmentIds ?? [],
    affectedSegmentIds: params.affectedSegmentIds,
    originFindingIds: params.originFinding ? [params.originFinding.findingId] : [],
    affectedFindingIds: params.affectedFindingIds,
    evidenceRefs,
    metricRefs: [],
    propagationPath: [origin.transition.transitionId, affected.transition.transitionId],
    propagationReason: reason,
    delayImpactMs,
    riskImpact: null,
    calculationNotes: [
      `${isPossible ? "possible " : ""}propagation type=${propagationType} via ${sharedEventIds.length ? "shared evidence" : "sequential unresolved constraint"}`,
      `confidence=${confidence}; severity is detection severity, not health`,
    ],
    warnings,
  };
}

const OPEN_CONSTRAINT_TYPES: ReadonlySet<MilestoneFlowFindingType> = new Set(["blocker", "decision_delay", "approval_delay"]);

/** (4) Detect constraint propagation across transitions (conservative). */
export function detectMilestoneConstraintPropagationFindings(
  transitions: readonly BuiltMilestoneTransition[],
  _metricsByTransition: Record<string, MilestoneFlowTransitionMetrics>,
  findingsByTransition: Record<string, MilestoneFlowDetectionFinding[]>,
  scope: MilestoneFlowProjectScope,
): { findings: MilestoneConstraintPropagationFinding[]; warnings: MilestoneFlowEngineWarning[] } {
  const warnings: MilestoneFlowEngineWarning[] = [];
  const findings: MilestoneConstraintPropagationFinding[] = [];
  const seenPairs = new Set<string>();

  const indexed = transitions.map((t, i) => indexTransition(t, i, findingsByTransition[t.transitionId] ?? []));

  // ── Signal 1: shared evidence across two distinct transitions. ──────────────
  const eventToTransitions = new Map<string, TransitionIndex[]>();
  for (const ix of indexed) {
    for (const eventId of ix.eventIds) {
      (eventToTransitions.get(eventId) ?? eventToTransitions.set(eventId, []).get(eventId)!).push(ix);
    }
  }
  for (const [eventId, list] of eventToTransitions) {
    const distinct = [...new Map(list.map((x) => [x.transition.transitionId, x])).values()].sort((a, b) => a.order - b.order);
    if (distinct.length < 2) continue;
    const origin = distinct[0];
    const affected = distinct[distinct.length - 1];
    const pairKey = `${origin.transition.transitionId}|${affected.transition.transitionId}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const originFinding = origin.findings.find((f) => f.sourceEventIds.includes(eventId));
    const evidence = mergeAdvancedFindingEvidence(
      origin.findings.flatMap((f) => f.evidenceRefs),
      affected.findings.flatMap((f) => f.evidenceRefs),
    ).filter((r) => r.eventId === eventId);
    findings.push(
      buildMilestoneConstraintPropagationFinding({
        scope,
        origin,
        affected,
        propagationType: determineMilestonePropagationType(originFinding),
        status: affected.transition.completedAt ? "resolved" : "open",
        isPossible: false,
        sharedEventIds: [eventId],
        originFinding,
        affectedFindingIds: affected.findings.map((f) => f.findingId),
        affectedSegmentIds: affected.transition.segments.map((s) => s.segmentId),
        evidenceRefs: evidence.length ? evidence : mergeAdvancedFindingEvidence(origin.findings.flatMap((f) => f.evidenceRefs)),
        reason: `shared event ${eventId} links ${origin.transition.transitionId} → ${affected.transition.transitionId}`,
      }),
    );
  }

  // ── Signal 2: sequential unresolved constraint (POSSIBLE, low confidence). ──
  for (let i = 0; i < indexed.length - 1; i++) {
    const origin = indexed[i];
    const affected = indexed[i + 1];
    const pairKey = `${origin.transition.transitionId}|${affected.transition.transitionId}`;
    if (seenPairs.has(pairKey)) continue;

    const openConstraint = origin.findings.find((f) => f.isOpen && OPEN_CONSTRAINT_TYPES.has(f.findingType));
    const downstreamImpacted = affected.transition.segments.some((s) => s.type === "blocked" || s.type === "waiting");
    if (!openConstraint || !downstreamImpacted) continue;
    seenPairs.add(pairKey);

    const impactedSegments = affected.transition.segments.filter((s) => s.type === "blocked" || s.type === "waiting");
    findings.push(
      buildMilestoneConstraintPropagationFinding({
        scope,
        origin,
        affected,
        propagationType: determineMilestonePropagationType(openConstraint),
        status: "possible",
        isPossible: true,
        sharedEventIds: [],
        originFinding: openConstraint,
        affectedFindingIds: affected.findings.map((f) => f.findingId),
        affectedSegmentIds: impactedSegments.map((s) => s.segmentId),
        evidenceRefs: mergeAdvancedFindingEvidence(openConstraint.evidenceRefs),
        reason: `open ${openConstraint.findingType} upstream while downstream ${affected.transition.transitionId} has ${impactedSegments[0].type} work`,
      }),
    );
  }

  if (findings.length === 0 && indexed.length >= 2) {
    // No linkage found — do NOT fabricate propagation.
    warnings.push(advWarn("MISSING_PROPAGATION_EVIDENCE", "no evidence-backed propagation between transitions", undefined));
  }

  return { findings, warnings };
}
