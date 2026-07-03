// ============================================================================
// ProjectOps360° — MPF Engine · Transition Health Classifier (Phase 3, Task 7)
// ============================================================================
// Classifies evidence-backed transition health from Task 3 segments + Task 4
// metrics + Task 5 delay findings + Task 6 advanced findings. Pure, deterministic,
// CONSERVATIVE: weak/incomplete/conflicting evidence lowers confidence or yields
// `unknown`. A fallback dependency bottleneck (from Task 6's conservative default)
// is NEVER presented as confirmed causal truth — it becomes an ambiguous-cause
// uncertainty. No Date.now(), no LLM, no canonical mutation. Health is derived
// intelligence; it maps to the Task 1 MilestoneTransitionHealth contract.
// ============================================================================

import { MPF_ENGINE_VERSION, MPF_CONFIG_VERSION } from "./constants";
import {
  MpfMissingProjectScopeError,
  MpfMissingOrganizationScopeError,
  MpfUnknownFailureError,
} from "./errors";
import { aggregateConfidence } from "./evidence";
import type {
  MilestoneTransitionHealth,
  MilestoneTransitionHealthStatus,
  MilestoneTransitionHealthReason,
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEngineWarning,
} from "./types";
import type { MilestoneFlowDetectionFinding } from "./delay-detector-types";
import type { MilestoneFlowReworkFinding } from "./advanced-detection-types";
import {
  type MilestoneHealthReasonCode,
  type MilestoneRecommendedActionCategory,
  type MilestoneHealthUncertaintyNote,
  type MilestoneTransitionHealthClassificationInput,
  type MilestoneFlowHealthClassificationInput,
  type MilestoneFlowHealthClassificationResult,
  type MilestoneTransitionHealthSummaryResult,
} from "./transition-health-types";

const CONFIDENCE_RANK: Record<MilestoneFlowEvidenceConfidence, number> = { unknown: 0, low: 1, medium: 2, high: 3 };
const weaker = (a: MilestoneFlowEvidenceConfidence, b: MilestoneFlowEvidenceConfidence) =>
  CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;

function hWarn(code: string, message: string, transitionId?: string): MilestoneFlowEngineWarning {
  return { code, message, transitionId: transitionId ?? null };
}

// ── Signal gathering (read-only over the derived inputs) ──────────────────────

interface HealthSignals {
  hasMetrics: boolean;
  hasSegments: boolean;
  openBlocker: boolean;
  resolvedBlocker: boolean;
  decisionDelay: boolean;
  approvalDelay: boolean;
  waiting: boolean;
  highSeverityDelay: boolean;
  rework: boolean;
  milestoneRegression: boolean;
  bottleneck: boolean;
  structuralBottleneck: boolean;
  ambiguousBlockerCause: boolean;
  propagation: boolean;
  possiblePropagation: boolean;
  poorEfficiency: boolean;
  highUnknownTime: boolean;
  completed: boolean;
  missingEvidence: boolean;
  unknownDuration: boolean;
  backfilledOnly: boolean;
  materialFriction: boolean;
}

function gatherSignals(input: MilestoneTransitionHealthClassificationInput): HealthSignals {
  const { transition, metrics } = input;
  const delays = input.delayFindings ?? [];
  const rework = input.reworkFindings ?? [];
  const bottlenecks = input.bottleneckFindings ?? [];
  const propagation = input.propagationFindings ?? [];

  const blocker = delays.filter((f) => f.findingType === "blocker");
  const openBlocker = blocker.some((f) => f.isOpen);
  const resolvedBlocker = blocker.some((f) => f.status === "resolved");
  const decisionDelay = delays.some((f) => f.findingType === "decision_delay");
  const approvalDelay = delays.some((f) => f.findingType === "approval_delay");
  const waiting = delays.some((f) => f.findingType === "waiting_time");
  const highSeverityDelay = delays.some((f) => f.severity === "high" || f.severity === "critical");
  const reworkPresent = rework.some((r) => r.status !== "possible") || rework.length > 0;
  const milestoneRegression = rework.some((r) => r.reworkType === "milestone_regression") || transition.state.status === "regressed";
  const bottleneck = bottlenecks.length > 0;
  const structuralBottleneck = bottlenecks.some((b) => b.isStructuralCandidate);
  // A "dependency" bottleneck derived from a generic blocker is a conservative
  // DEFAULT, not a confirmed cause — treat it as ambiguous.
  const ambiguousBlockerCause = bottlenecks.some((b) => b.bottleneckType === "dependency" && b.confidence !== "high");
  const propagationPresent = propagation.length > 0;
  const possiblePropagation = propagation.some((p) => p.status === "possible");

  const eff = metrics?.efficiency?.flowEfficiencyRatio ?? null;
  const poorEfficiency = eff != null && eff < 0.5;
  const totalKnown = metrics?.totalKnownSegmentTimeMs ?? 0;
  const highUnknownTime = !!metrics && totalKnown > 0 && (metrics.timeBuckets?.unknownTimeMs ?? 0) / totalKnown >= 0.4;

  const allFindings = [...delays, ...rework, ...bottlenecks];
  const missingEvidence =
    metrics?.confidence === "unknown" ||
    allFindings.some((f) => f.evidenceRefs.length === 0) ||
    (allFindings.length === 0 && !metrics);
  const unknownDuration = allFindings.some((f) => f.durationMs == null);
  const allEvidence = allFindings.flatMap((f) => f.evidenceRefs);
  const backfilledOnly = allEvidence.length > 0 && allEvidence.every((e) => CONFIDENCE_RANK[e.confidence] <= 1);

  // Material friction = significant friction only. Bare low-severity/resolved
  // decision/approval/waiting delays are MINOR friction (→ watch), not material.
  const materialFriction = reworkPresent || bottleneck || poorEfficiency || highUnknownTime || highSeverityDelay;

  return {
    hasMetrics: !!metrics,
    hasSegments: transition.segments.length > 0,
    openBlocker, resolvedBlocker, decisionDelay, approvalDelay, waiting, highSeverityDelay,
    rework: reworkPresent, milestoneRegression, bottleneck, structuralBottleneck, ambiguousBlockerCause,
    propagation: propagationPresent, possiblePropagation, poorEfficiency, highUnknownTime,
    completed: transition.completedAt != null, missingEvidence, unknownDuration, backfilledOnly, materialFriction,
  };
}

// ── Reason codes ──────────────────────────────────────────────────────────────

/** Machine-readable reason codes for the transition's health. */
export function determineMilestoneTransitionHealthReasonCodes(
  input: MilestoneTransitionHealthClassificationInput,
): MilestoneHealthReasonCode[] {
  const s = gatherSignals(input);
  const codes: MilestoneHealthReasonCode[] = [];

  if (!s.hasMetrics && !s.hasSegments) return ["insufficient_evidence"];

  if (s.milestoneRegression) codes.push("regressed");
  if (s.openBlocker) codes.push("blocker_open");
  if (s.resolvedBlocker) codes.push("blocker_resolved");
  if (s.decisionDelay) codes.push("decision_delay");
  if (s.approvalDelay) codes.push("approval_delay");
  if (s.waiting) codes.push("waiting");
  if (s.rework) codes.push("rework");
  if (s.bottleneck) codes.push("bottleneck_candidate");
  if (s.propagation) codes.push("propagation");
  if (s.poorEfficiency) codes.push("poor_flow_efficiency");
  if (s.highUnknownTime) codes.push("high_unknown_time");
  if (s.missingEvidence) codes.push("missing_evidence");
  if (s.resolvedBlocker && !s.openBlocker && s.completed && !s.poorEfficiency) codes.push("recovered");
  // Conflicting: a completed transition that still carries an open blocker.
  if (s.completed && s.openBlocker) codes.push("conflicting_evidence");
  if (s.completed && !s.openBlocker && !s.rework && !s.highSeverityDelay && !s.poorEfficiency && !s.bottleneck && !s.materialFriction) {
    codes.push("no_material_friction");
  }
  if ((s.resolvedBlocker || s.decisionDelay || s.approvalDelay || s.waiting) && !s.openBlocker && !s.rework && !s.bottleneck && !s.poorEfficiency && !s.materialFriction) {
    codes.push("minor_friction");
  }

  if (codes.length === 0) codes.push("unknown");
  return codes;
}

// ── Status ────────────────────────────────────────────────────────────────────

/** Conservative status ladder from signals. Worse operational states win. */
export function determineMilestoneTransitionHealthStatus(
  input: MilestoneTransitionHealthClassificationInput,
): MilestoneTransitionHealthStatus {
  const s = gatherSignals(input);
  if (!s.hasMetrics && !s.hasSegments) return "unknown";
  if (s.openBlocker) return "blocked";
  if (s.milestoneRegression) return "regressed";
  if (s.structuralBottleneck || s.highSeverityDelay || (s.poorEfficiency && s.materialFriction) || (s.possiblePropagation && s.materialFriction)) return "at_risk";
  if (s.materialFriction) return "degraded";
  if (s.resolvedBlocker && s.completed) return "recovering";
  if (s.resolvedBlocker || s.decisionDelay || s.approvalDelay || s.waiting) return "watch";
  if (s.completed) return "healthy";
  return "unknown";
}

// ── Confidence ────────────────────────────────────────────────────────────────

/** Confidence — never above the weakest evidence; capped low by weak signals. */
export function determineMilestoneTransitionHealthConfidence(
  input: MilestoneTransitionHealthClassificationInput,
): MilestoneFlowEvidenceConfidence {
  const s = gatherSignals(input);
  if (!s.hasMetrics && !s.hasSegments) return "unknown";
  const evidence = collectEvidence(input);
  let conf: MilestoneFlowEvidenceConfidence = input.metrics?.confidence ?? "unknown";
  if (evidence.length > 0) conf = weaker(conf === "unknown" ? "high" : conf, aggregateConfidence(evidence));
  else conf = "unknown";
  if (s.missingEvidence || s.highUnknownTime || s.ambiguousBlockerCause || s.possiblePropagation || s.backfilledOnly || (s.completed && s.openBlocker)) {
    conf = weaker(conf, "low");
  }
  return conf;
}

// ── Recommended action category (categories only) ─────────────────────────────

export function determineMilestoneRecommendedActionCategory(
  status: MilestoneTransitionHealthStatus,
): MilestoneRecommendedActionCategory {
  switch (status) {
    case "blocked": return "resolve_blocker";
    case "regressed": return "review_regression";
    case "at_risk": return "escalate_risk";
    case "degraded": return "investigate_friction";
    case "recovering": return "monitor_recovery";
    case "watch": return "monitor";
    case "healthy": return "none";
    default: return "gather_evidence";
  }
}

// ── Evidence ──────────────────────────────────────────────────────────────────

function collectEvidence(input: MilestoneTransitionHealthClassificationInput): MilestoneFlowEvidenceRef[] {
  return [
    ...(input.delayFindings ?? []).flatMap((f) => f.evidenceRefs),
    ...(input.reworkFindings ?? []).flatMap((f) => f.evidenceRefs),
    ...(input.bottleneckFindings ?? []).flatMap((f) => f.evidenceRefs),
    ...(input.propagationFindings ?? []).flatMap((f) => f.evidenceRefs),
  ];
}

/** Merge + deduplicate health evidence refs. */
export function mergeMilestoneHealthEvidence(
  ...groups: (readonly MilestoneFlowEvidenceRef[])[]
): MilestoneFlowEvidenceRef[] {
  const seen = new Set<string>();
  const out: MilestoneFlowEvidenceRef[] = [];
  for (const g of groups) for (const ref of g) {
    const key = `${ref.kind}|${ref.eventId ?? ""}|${ref.metricRef ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function uncertaintyNotes(input: MilestoneTransitionHealthClassificationInput): MilestoneHealthUncertaintyNote[] {
  const s = gatherSignals(input);
  const notes: MilestoneHealthUncertaintyNote[] = [];
  if (!s.hasMetrics) notes.push("missing_metrics");
  if (s.missingEvidence) notes.push("missing_evidence");
  if (s.ambiguousBlockerCause) notes.push("ambiguous_blocker_cause");
  if (s.possiblePropagation) notes.push("possible_propagation");
  if (s.unknownDuration) notes.push("unknown_duration");
  if (s.backfilledOnly) notes.push("backfilled_only_evidence");
  if (s.completed && s.openBlocker) notes.push("conflicting_signals");
  if (!s.hasMetrics && !s.hasSegments) notes.push("insufficient_transition_evidence");
  return notes;
}

// ── Reasons (code + detail + evidence) ────────────────────────────────────────

const REASON_DETAIL: Record<MilestoneHealthReasonCode, string> = {
  insufficient_evidence: "Not enough segments or metrics to assess this transition.",
  no_material_friction: "Transition completed with no material friction.",
  minor_friction: "Minor, resolved friction with no material impact.",
  waiting: "Waiting time present in the transition.",
  blocker_open: "An unresolved blocker is impeding this transition.",
  blocker_resolved: "A blocker was raised and later resolved.",
  decision_delay: "A decision delay is present.",
  approval_delay: "An approval delay is present.",
  rework: "Rework occurred in this transition.",
  bottleneck_candidate: "A bottleneck candidate was detected (not confirmed causal).",
  propagation: "A constraint appears to propagate to/from this transition.",
  poor_flow_efficiency: "Active work is a low share of known flow time.",
  high_unknown_time: "A high share of known time is of unknown type.",
  missing_evidence: "Some findings lack supporting evidence.",
  recovered: "A previously blocked transition has recovered.",
  regressed: "The transition moved backward (regression).",
  conflicting_evidence: "Signals conflict (e.g. completed with an open blocker).",
  unknown: "Health could not be determined from the available evidence.",
};

function buildReasons(codes: MilestoneHealthReasonCode[], evidence: MilestoneFlowEvidenceRef[]): MilestoneTransitionHealthReason[] {
  return codes.map((code) => ({ code, detail: REASON_DETAIL[code], evidence }));
}

// ── Summary + single-transition classification ────────────────────────────────

/** Build the rich health summary for one transition. */
export function buildMilestoneTransitionHealthSummary(
  input: MilestoneTransitionHealthClassificationInput,
): MilestoneTransitionHealthSummaryResult {
  const warnings: MilestoneFlowEngineWarning[] = [];
  const codes = determineMilestoneTransitionHealthReasonCodes(input);
  const healthStatus = determineMilestoneTransitionHealthStatus(input);
  const confidence = determineMilestoneTransitionHealthConfidence(input);
  const evidenceRefs = mergeMilestoneHealthEvidence(collectEvidence(input));
  if (evidenceRefs.length === 0 && healthStatus !== "unknown") {
    warnings.push(hWarn("MISSING_HEALTH_EVIDENCE", `health for ${input.transition.transitionId} has no evidence`, input.transition.transitionId));
  }
  if (confidence === "unknown") {
    warnings.push(hWarn("UNKNOWN_HEALTH_CONFIDENCE", `health for ${input.transition.transitionId} has unknown confidence`, input.transition.transitionId));
  }

  const delays = input.delayFindings ?? [];
  const rework = input.reworkFindings ?? [];
  const bottlenecks = input.bottleneckFindings ?? [];
  const supportingFindingIds = [
    ...delays.map((f) => f.findingId),
    ...rework.map((f) => f.findingId),
    ...bottlenecks.map((f) => f.findingId),
    ...(input.propagationFindings ?? []).map((f) => f.findingId),
  ];

  return {
    transitionId: input.transition.transitionId,
    projectId: input.scope.projectId,
    organizationId: input.scope.organizationId,
    healthStatus,
    confidence,
    reasonCodes: codes,
    reasons: buildReasons(codes, evidenceRefs),
    evidenceRefs,
    supportingFindingIds,
    supportingSegmentIds: input.transition.segments.map((s) => s.segmentId),
    metricRefs: input.metrics ? ["metrics.efficiency.flowEfficiencyRatio", "metrics.totalKnownSegmentTimeMs"] : [],
    recommendedActionCategory: determineMilestoneRecommendedActionCategory(healthStatus),
    uncertaintyNotes: uncertaintyNotes(input),
    warnings,
    engineVersion: MPF_ENGINE_VERSION,
    configVersion: MPF_CONFIG_VERSION,
  };
}

/** Classify one transition's health (rich summary). */
export function classifySingleMilestoneTransitionHealth(
  input: MilestoneTransitionHealthClassificationInput,
): MilestoneTransitionHealthSummaryResult {
  return buildMilestoneTransitionHealthSummary(input);
}

/** Map the rich summary to the Task 1 MilestoneTransitionHealth contract. */
export function toBaseTransitionHealth(summary: MilestoneTransitionHealthSummaryResult): MilestoneTransitionHealth {
  return {
    transitionId: summary.transitionId,
    status: summary.healthStatus,
    score: null, // numeric scoring is intentionally not enabled in Task 7
    confidence: summary.confidence,
    reasons: summary.reasons,
  };
}

// ── Validation + all-transitions ──────────────────────────────────────────────

export function validateMilestoneFlowHealthInput(input: MilestoneFlowHealthClassificationInput): void {
  if (!input.scope || !input.scope.organizationId) throw new MpfMissingOrganizationScopeError();
  if (!input.scope.projectId) throw new MpfMissingProjectScopeError();
  if (!Array.isArray(input.transitions)) throw new MpfUnknownFailureError("transitions must be an array");
  if (input.metricsByTransition == null || typeof input.metricsByTransition !== "object") throw new MpfUnknownFailureError("metricsByTransition must be an object");
  if (input.findingsByTransition == null || typeof input.findingsByTransition !== "object") throw new MpfUnknownFailureError("findingsByTransition must be an object");
}

/** Classify health for all transitions. */
export function classifyMilestoneTransitionHealth(
  input: MilestoneFlowHealthClassificationInput,
): MilestoneFlowHealthClassificationResult {
  validateMilestoneFlowHealthInput(input);
  const healthSummariesByTransition: Record<string, MilestoneTransitionHealthSummaryResult> = {};
  const warnings: MilestoneFlowEngineWarning[] = [];

  for (const transition of input.transitions) {
    const propagation = (input.constraintPropagationFindings ?? []).filter(
      (p) => p.originTransitionId === transition.transitionId || p.affectedTransitionId === transition.transitionId,
    );
    const summary = classifySingleMilestoneTransitionHealth({
      scope: input.scope,
      transition,
      metrics: input.metricsByTransition[transition.transitionId],
      delayFindings: input.findingsByTransition[transition.transitionId] ?? [],
      reworkFindings: input.reworkFindingsByTransition?.[transition.transitionId] ?? [],
      bottleneckFindings: input.bottleneckFindingsByTransition?.[transition.transitionId] ?? [],
      propagationFindings: propagation,
    });
    healthSummariesByTransition[transition.transitionId] = summary;
    warnings.push(...summary.warnings);
  }

  return {
    healthSummariesByTransition,
    warnings,
    stats: summarizeHealth(Object.values(healthSummariesByTransition)),
  };
}

function summarizeHealth(summaries: readonly MilestoneTransitionHealthSummaryResult[]) {
  const has = (st: MilestoneTransitionHealthStatus) => summaries.filter((s) => s.healthStatus === st).length;
  return {
    healthAssessmentCount: summaries.length,
    healthyTransitionCount: has("healthy"),
    watchTransitionCount: has("watch"),
    degradedTransitionCount: has("degraded"),
    blockedTransitionCount: has("blocked"),
    atRiskTransitionCount: has("at_risk"),
    recoveringTransitionCount: has("recovering"),
    regressedTransitionCount: has("regressed"),
    unknownHealthCount: has("unknown"),
  };
}

// Re-export so the engine's single-transition contract method can build health
// from just a transition (+ optional metrics), with no findings (conservative).
export type { MilestoneFlowReworkFinding, MilestoneFlowDetectionFinding };
