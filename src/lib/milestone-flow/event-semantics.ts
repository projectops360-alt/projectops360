// ============================================================================
// ProjectOps360° — MPF Engine · Event Semantics (Phase 3, Task 2)
// ============================================================================
// Pure, deterministic functions that interpret Project Event Graph events as
// milestone-flow signals. This is the semantic layer future builders (Transition,
// Segment, Metrics, Delay, Rework, Bottleneck, Constraint, Health, Isabella,
// Living Graph) consume. It reads the Canonical Event Taxonomy; it never mutates
// events, project_event_log, process_nodes, or process_edges, and never writes DB.
//
// It produces only facts/inferences + directional signals. Final health,
// durations, and bottleneck decisions are NOT computed here.
// ============================================================================

import {
  EVENT_REGISTRY,
  EPHEMERAL_EXCLUDED_EVENTS,
  isRegisteredEvent,
} from "@/lib/events/registry";
import { MILESTONE_FLOW_EVENT_SEMANTICS } from "./event-semantics-map";
import { confidenceFromEvent } from "./evidence";
import type { MilestoneFlowEventRef, MilestoneFlowEvidenceConfidence, MilestoneFlowEvidenceRef } from "./types";
import type {
  MilestoneFlowEventSemantics,
  MilestoneFlowProvenanceClassification,
  MilestoneFlowEventClassification,
  MilestoneFlowSemanticsMapValidation,
  MilestoneFlowConfidenceImpact,
} from "./event-semantics-types";

// Anything with an eventType is enough for a lookup; concrete instances add
// provenance metadata (lifecycleClass, confidence, isCompensatingEvent).
type EventLike = string | Pick<MilestoneFlowEventRef, "eventType"> | MilestoneFlowEventRef;

function eventTypeOf(event: EventLike): string {
  return typeof event === "string" ? event : event.eventType;
}

/** The safe fallback semantics for an event type with no explicit mapping. */
export function buildUnknownEventSemantics(eventType: string): MilestoneFlowEventSemantics {
  return {
    canonicalEventType: eventType,
    semanticCategory: "unknown",
    flowSegmentType: "unknown",
    transitionSignal: "unknown",
    healthSignal: "unknown",
    frictionType: null,
    bottleneckCandidateType: null,
    constraintPropagationSignal: "unknown",
    reworkSignal: "unknown",
    evidenceKind: "uncertainty",
    confidenceImpact: "unknown",
    provenanceHandling: "respect_event_provenance",
    replayBehavior: "deterministic",
    notes:
      "Event type is not present in the milestone-flow semantic map; handled as unknown (safe, deterministic default).",
  };
}

/** (3) Lookup semantics by canonical event type. Never throws. */
export function getMilestoneFlowSemanticsForEventType(eventType: string): MilestoneFlowEventSemantics {
  return MILESTONE_FLOW_EVENT_SEMANTICS[eventType] ?? buildUnknownEventSemantics(eventType);
}

/** (1) Deterministic type-level semantics for an event ref or event type. */
export function getMilestoneFlowEventSemantics(event: EventLike): MilestoneFlowEventSemantics {
  return getMilestoneFlowSemanticsForEventType(eventTypeOf(event));
}

// ── Confidence combination ────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<MilestoneFlowEvidenceConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function confidenceImpactCeiling(ci: MilestoneFlowConfidenceImpact): MilestoneFlowEvidenceConfidence {
  switch (ci) {
    case "eligible_high":
      return "high";
    case "cap_medium":
      return "medium";
    case "cap_low":
      return "low";
    default:
      return "unknown";
  }
}

function weakest(...levels: MilestoneFlowEvidenceConfidence[]): MilestoneFlowEvidenceConfidence {
  return levels.reduce((min, l) => (CONFIDENCE_RANK[l] < CONFIDENCE_RANK[min] ? l : min), "high");
}

// ── Provenance ────────────────────────────────────────────────────────────────

/** (10) Classify an event's provenance and the confidence ceiling it imposes. */
export function normalizeMilestoneFlowEventProvenance(
  event: MilestoneFlowEventRef,
): MilestoneFlowProvenanceClassification {
  const backfilled = event.lifecycleClass === "SYNTHETIC_BACKFILL_EVENT";
  const compensating = event.isCompensatingEvent === true;

  if (compensating) {
    // Corrections are real events but reinterpret prior facts — never erase them.
    return {
      provenanceClass: "compensating",
      maxConfidence: backfilled ? "medium" : "high",
      compensationAware: true,
      preservesOriginalEvidence: true,
      replaySensitive: true,
    };
  }

  if (backfilled) {
    // Reconstructed history: strong reconstruction → backfilled/medium; weak or
    // missing confidence → inferred/low. Never high (see confidenceFromEvent).
    const strong = event.confidence != null && event.confidence >= 0.7;
    return {
      provenanceClass: strong ? "backfilled" : "inferred",
      maxConfidence: strong ? "medium" : "low",
      compensationAware: false,
      preservesOriginalEvidence: false,
      replaySensitive: true,
    };
  }

  if (!event.lifecycleClass) {
    return {
      provenanceClass: "unknown",
      maxConfidence: "unknown",
      compensationAware: false,
      preservesOriginalEvidence: false,
      replaySensitive: false,
    };
  }

  return {
    provenanceClass: "native",
    maxConfidence: "high",
    compensationAware: false,
    preservesOriginalEvidence: false,
    replaySensitive: false,
  };
}

/** Resolve the final confidence for a conclusion drawn from this event. */
export function resolveMilestoneFlowEventConfidence(
  event: MilestoneFlowEventRef,
  semantics: MilestoneFlowEventSemantics,
  provenance: MilestoneFlowProvenanceClassification,
): MilestoneFlowEvidenceConfidence {
  return weakest(
    confidenceFromEvent(event), // numeric value + backfill cap
    confidenceImpactCeiling(semantics.confidenceImpact), // semantic cap
    provenance.maxConfidence, // provenance cap
  );
}

// ── Evidence ──────────────────────────────────────────────────────────────────

/** (9) True when the event can support MPF evidence (registered, non-unknown). */
export function isMilestoneFlowEvidenceBearingEvent(event: EventLike): boolean {
  const type = eventTypeOf(event);
  if (!isRegisteredEvent(type)) return false;
  const semantics = getMilestoneFlowSemanticsForEventType(type);
  return semantics.evidenceKind === "fact" || semantics.evidenceKind === "inference";
}

/** (11) Build an evidence ref from an event WITHOUT mutating the event. */
export function buildMilestoneFlowEvidenceRefFromEvent(
  event: MilestoneFlowEventRef,
): MilestoneFlowEvidenceRef | null {
  if (!isMilestoneFlowEvidenceBearingEvent(event)) return null;
  const semantics = getMilestoneFlowSemanticsForEventType(event.eventType);
  const provenance = normalizeMilestoneFlowEventProvenance(event);
  const confidence = resolveMilestoneFlowEventConfidence(event, semantics, provenance);
  const kind = semantics.evidenceKind === "inference" ? "inference" : "fact";
  return {
    kind,
    eventId: event.eventId,
    confidence,
    note: provenance.compensationAware
      ? "Compensating event — interpret as a correction; original evidence is preserved."
      : null,
  };
}

// ── Full classification ───────────────────────────────────────────────────────

/** (2) Classify a concrete event: semantics + provenance + confidence + evidence. */
export function classifyMilestoneFlowEvent(event: MilestoneFlowEventRef): MilestoneFlowEventClassification {
  const semantics = getMilestoneFlowSemanticsForEventType(event.eventType);
  const provenance = normalizeMilestoneFlowEventProvenance(event);
  const confidence = isMilestoneFlowEvidenceBearingEvent(event)
    ? resolveMilestoneFlowEventConfidence(event, semantics, provenance)
    : "unknown";
  return {
    canonicalEventType: event.eventType,
    semanticCategory: semantics.semanticCategory,
    transitionSignal: semantics.transitionSignal,
    flowSegmentType: semantics.flowSegmentType,
    healthSignal: semantics.healthSignal,
    frictionType: semantics.frictionType,
    bottleneckCandidateType: semantics.bottleneckCandidateType,
    constraintPropagationSignal: semantics.constraintPropagationSignal,
    reworkSignal: semantics.reworkSignal,
    evidenceKind: semantics.evidenceKind,
    provenance,
    confidence,
    evidenceRef: buildMilestoneFlowEvidenceRefFromEvent(event),
  };
}

// ── Signal predicates ─────────────────────────────────────────────────────────

/** (4) Opens a milestone transition corridor. */
export function isMilestoneTransitionOpeningEvent(event: EventLike): boolean {
  return getMilestoneFlowEventSemantics(event).transitionSignal === "opens_transition";
}

/** (5) Closes a milestone transition corridor. */
export function isMilestoneTransitionClosingEvent(event: EventLike): boolean {
  return getMilestoneFlowEventSemantics(event).transitionSignal === "closes_transition";
}

/** (6) Blocks flow (hard block or decision/approval delay). */
export function isMilestoneFlowBlockingEvent(event: EventLike): boolean {
  const s = getMilestoneFlowEventSemantics(event);
  return (
    s.transitionSignal === "blocks_transition" ||
    s.flowSegmentType === "blocked" ||
    s.flowSegmentType === "decision_delay" ||
    s.flowSegmentType === "approval_delay"
  );
}

/** (7) Resolves a blocker/dependency/approval/decision/risk that impeded flow. */
export function isMilestoneFlowUnblockingEvent(event: EventLike): boolean {
  const s = getMilestoneFlowEventSemantics(event);
  return (
    s.transitionSignal === "unblocks_transition" ||
    s.constraintPropagationSignal === "resolves_constraint" ||
    s.constraintPropagationSignal === "reduces_constraint"
  );
}

/** (8) Reopen / reject / reverse / change-after-completion patterns. */
export function isMilestoneFlowReworkEvent(event: EventLike): boolean {
  const s = getMilestoneFlowEventSemantics(event);
  return (
    s.reworkSignal === "starts_rework" ||
    s.reworkSignal === "continues_rework" ||
    s.reworkSignal === "indicates_possible_rework"
  );
}

// ── Coverage validation ───────────────────────────────────────────────────────

/**
 * (12) Verify every registered canonical event has explicit semantics, no phantom
 * entries exist, and no EPHEMERAL_EXCLUDED type leaked in. Pure — used by tests to
 * fail if the taxonomy grows without an accompanying semantic mapping.
 */
export function validateMilestoneFlowEventSemanticsMap(): MilestoneFlowSemanticsMapValidation {
  const registered = Object.keys(EVENT_REGISTRY);
  const mappedKeys = new Set(Object.keys(MILESTONE_FLOW_EVENT_SEMANTICS));

  const missing = registered.filter((t) => !mappedKeys.has(t));
  const unexpected = [...mappedKeys].filter((t) => !isRegisteredEvent(t));
  const ephemeralLeaks = [...mappedKeys].filter((t) => EPHEMERAL_EXCLUDED_EVENTS.has(t));

  return {
    ok: missing.length === 0 && unexpected.length === 0 && ephemeralLeaks.length === 0,
    total: registered.length,
    mapped: mappedKeys.size,
    missing,
    unexpected,
    ephemeralLeaks,
  };
}
