// ============================================================================
// ProjectOps360° — MPF Engine · Isabella Evidence Packet Builder (Phase 3, Task 7)
// ============================================================================
// Builds structured Isabella evidence packets from the Task 7 health summaries.
// Pure + deterministic. NO natural language, NO LLM/AI call. Facts require
// evidence; inferences derive from reason codes; predictions are optional and
// never facts; recommendations are action categories only; uncertainties are
// explicit; allowed/disallowed claims are guardrails that block unsupported
// causal or predictive claims (e.g. a fallback dependency bottleneck is never a
// confirmed cause). No Date.now(), no canonical mutation.
// ============================================================================

import { MPF_ENGINE_VERSION, MPF_CONFIG_VERSION } from "./constants";
import { mergeMilestoneHealthEvidence } from "./transition-health-classifier";
import type {
  MilestoneFlowEvidenceRef,
  IsabellaMilestoneFlowExplanationFrame,
} from "./types";
import type { MilestoneTransitionHealthSummaryResult, MilestoneFlowHealthClassificationResult } from "./transition-health-types";
import type { MilestoneFlowIsabellaEvidencePacket, MilestoneFlowIsabellaEvidencePacketResult } from "./isabella-evidence-packet-types";

// ── Facts (require evidence refs) ─────────────────────────────────────────────

/** Facts = evidence-backed refs only (each carries an eventId or metricRef). */
export function buildIsabellaMilestoneFlowFacts(summary: MilestoneTransitionHealthSummaryResult): MilestoneFlowEvidenceRef[] {
  return summary.evidenceRefs
    .filter((r) => (r.kind === "fact" || r.kind === "inference") && (r.eventId != null || r.metricRef != null))
    .map((r) => ({ ...r, kind: "fact" as const }));
}

// ── Inferences (derived from reason codes; never facts) ───────────────────────

export function buildIsabellaMilestoneFlowInferences(summary: MilestoneTransitionHealthSummaryResult): MilestoneFlowEvidenceRef[] {
  const backing = summary.evidenceRefs[0]?.eventId ?? null;
  return summary.reasonCodes
    .filter((c) => c !== "unknown" && c !== "insufficient_evidence" && c !== "missing_evidence")
    .map((code) => ({
      kind: "inference" as const,
      eventId: backing,
      metricRef: null,
      note: `health_reason:${code}`,
      confidence: summary.confidence,
    }));
}

// ── Predictions (optional; never facts) ───────────────────────────────────────

export function buildIsabellaMilestoneFlowPredictions(summary: MilestoneTransitionHealthSummaryResult): MilestoneFlowEvidenceRef[] {
  // Only for genuinely at-risk / blocked transitions, and always as prediction.
  if (summary.healthStatus !== "blocked" && summary.healthStatus !== "at_risk") return [];
  return [{
    kind: "prediction",
    eventId: null,
    metricRef: null,
    note: "possible_milestone_slip_if_unresolved",
    confidence: summary.confidence === "unknown" ? "unknown" : "low",
  }];
}

// ── Recommendations (action categories only) ──────────────────────────────────

export function buildIsabellaMilestoneFlowRecommendations(summary: MilestoneTransitionHealthSummaryResult): MilestoneFlowEvidenceRef[] {
  if (summary.recommendedActionCategory === "none") return [];
  return [{
    kind: "recommendation",
    eventId: null,
    metricRef: null,
    note: `recommended_action:${summary.recommendedActionCategory}`,
    confidence: summary.confidence,
  }];
}

// ── Uncertainties (explicit) ──────────────────────────────────────────────────

export function buildIsabellaMilestoneFlowUncertainties(summary: MilestoneTransitionHealthSummaryResult): MilestoneFlowEvidenceRef[] {
  return summary.uncertaintyNotes.map((note) => ({
    kind: "uncertainty" as const,
    eventId: null,
    metricRef: null,
    note: `uncertainty:${note}`,
    confidence: "unknown" as const,
  }));
}

// ── Allowed / disallowed claims (guardrails) ──────────────────────────────────

/** Compute the machine claim keys Isabella may / must-not assert. */
export function buildAllowedAndDisallowedIsabellaClaims(
  summary: MilestoneTransitionHealthSummaryResult,
): { allowedClaims: string[]; disallowedClaims: string[] } {
  const codes = new Set(summary.reasonCodes);
  const notes = new Set(summary.uncertaintyNotes);
  const hasEvidence = summary.evidenceRefs.length > 0;

  const allowedClaims: string[] = [`health_status:${summary.healthStatus}`];
  if (hasEvidence) {
    if (codes.has("blocker_open")) allowedClaims.push("transition_has_open_blocker");
    if (codes.has("blocker_resolved")) allowedClaims.push("transition_blocker_was_resolved");
    if (codes.has("rework")) allowedClaims.push("transition_has_rework");
    if (codes.has("decision_delay")) allowedClaims.push("transition_has_decision_delay");
    if (codes.has("approval_delay")) allowedClaims.push("transition_has_approval_delay");
    if (codes.has("bottleneck_candidate") && !notes.has("ambiguous_blocker_cause")) allowedClaims.push("transition_has_bottleneck_candidate");
    if (codes.has("recovered")) allowedClaims.push("transition_is_recovering");
  }

  // Never confirm root cause; never assert guaranteed slippage.
  const disallowedClaims: string[] = ["confirmed_root_cause", "guaranteed_milestone_slip"];
  if (notes.has("ambiguous_blocker_cause")) disallowedClaims.push("blocker_cause_is_dependency_confirmed");
  if (notes.has("possible_propagation")) disallowedClaims.push("constraint_propagation_confirmed");
  if (codes.has("missing_evidence") || codes.has("insufficient_evidence") || !hasEvidence) disallowedClaims.push("any_causal_claim_without_evidence");
  if (summary.healthStatus === "unknown") disallowedClaims.push("any_health_conclusion");

  return { allowedClaims, disallowedClaims };
}

// ── Packet ────────────────────────────────────────────────────────────────────

/** Build one Isabella evidence packet from a health summary. */
export function buildIsabellaMilestoneFlowEvidencePacket(
  summary: MilestoneTransitionHealthSummaryResult,
): MilestoneFlowIsabellaEvidencePacket {
  const facts = buildIsabellaMilestoneFlowFacts(summary);
  const inferences = buildIsabellaMilestoneFlowInferences(summary);
  const predictions = buildIsabellaMilestoneFlowPredictions(summary);
  const recommendations = buildIsabellaMilestoneFlowRecommendations(summary);
  const uncertainties = buildIsabellaMilestoneFlowUncertainties(summary);
  const { allowedClaims, disallowedClaims } = buildAllowedAndDisallowedIsabellaClaims(summary);

  const explanationFrame: IsabellaMilestoneFlowExplanationFrame = {
    fact: facts,
    inference: inferences,
    prediction: predictions,
    recommendation: recommendations,
    uncertainty: uncertainties,
  };

  return {
    scope: { organizationId: summary.organizationId, projectId: summary.projectId },
    transitionId: summary.transitionId,
    projectId: summary.projectId,
    organizationId: summary.organizationId,
    healthStatus: summary.healthStatus,
    confidence: summary.confidence,
    facts,
    inferences,
    predictions,
    recommendations,
    uncertainties,
    evidenceRefs: mergeMilestoneHealthEvidence(summary.evidenceRefs),
    allowedClaims,
    disallowedClaims,
    explanationFrame,
    recommendedActionCategory: summary.recommendedActionCategory,
    engineVersion: MPF_ENGINE_VERSION,
    configVersion: MPF_CONFIG_VERSION,
  };
}

/** Build Isabella evidence packets for all transitions in a health result. */
export function buildIsabellaMilestoneFlowEvidencePackets(
  health: MilestoneFlowHealthClassificationResult,
): MilestoneFlowIsabellaEvidencePacketResult {
  const packetsByTransition: Record<string, MilestoneFlowIsabellaEvidencePacket> = {};
  for (const [transitionId, summary] of Object.entries(health.healthSummariesByTransition)) {
    packetsByTransition[transitionId] = buildIsabellaMilestoneFlowEvidencePacket(summary);
  }
  return { packetsByTransition };
}
