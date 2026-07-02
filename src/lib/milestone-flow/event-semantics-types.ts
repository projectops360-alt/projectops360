// ============================================================================
// ProjectOps360° — MPF Engine · Event Semantics Types (Phase 3, Task 2)
// ============================================================================
// The vocabularies of the semantic interpretation layer that teaches the MPF
// Engine what a Project Event Graph event MEANS for milestone flow. These are
// DERIVED signals, not canonical facts — they never replace the Canonical Event
// Taxonomy (src/lib/events/registry.ts); they annotate it.
//
// Flow-segment, friction, bottleneck, evidence-kind, and confidence types are
// REUSED from Task 1 (./types) so this layer cannot drift from the engine model.
// Pure types only — no DB, no AI, no UI.
// ============================================================================

import type {
  MilestoneFlowSegmentType,
  MilestoneFlowFrictionType,
  MilestoneFlowBottleneckType,
  MilestoneFlowEvidenceKind,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEvidenceRef,
} from "./types";

// ── Semantic category ─────────────────────────────────────────────────────────

/** The milestone-flow domain a canonical event belongs to. Superset of the
 *  minimum set — includes the real taxonomy families present in the repo. */
export const MPF_SEMANTIC_CATEGORIES = [
  "milestone",
  "phase",
  "work",
  "decision",
  "approval",
  "dependency",
  "risk",
  "issue",
  "blocker",
  "requirement",
  "scope",
  "deliverable",
  "document",
  "meeting",
  "communication",
  "note",
  "scribe",
  "cost",
  "resource",
  "quality",
  "closeout",
  "lessons",
  "ai",
  "isabella",
  "system",
  "portfolio",
  "project",
  "backfill",
  "compensating",
  "unknown",
] as const;
export type MilestoneFlowSemanticCategory = (typeof MPF_SEMANTIC_CATEGORIES)[number];

// ── Transition signal ─────────────────────────────────────────────────────────

export const MPF_TRANSITION_SIGNALS = [
  "opens_transition",
  "progresses_transition",
  "closes_transition",
  "reopens_transition",
  "pauses_transition",
  "resumes_transition",
  "blocks_transition",
  "unblocks_transition",
  "regresses_transition",
  "no_transition_signal",
  "unknown",
] as const;
export type MilestoneFlowTransitionSignal = (typeof MPF_TRANSITION_SIGNALS)[number];

// ── Health signal (NOT a final health status — only a directional effect) ──────

export const MPF_HEALTH_SIGNALS = [
  "improves_health",
  "degrades_health",
  "blocks_health",
  "increases_risk",
  "indicates_recovery",
  "indicates_regression",
  "neutral",
  "unknown",
] as const;
export type MilestoneFlowHealthSignal = (typeof MPF_HEALTH_SIGNALS)[number];

// ── Rework signal ─────────────────────────────────────────────────────────────

export const MPF_REWORK_SIGNALS = [
  "starts_rework",
  "continues_rework",
  "ends_rework",
  "indicates_possible_rework",
  "no_rework_signal",
  "unknown",
] as const;
export type MilestoneFlowReworkSignal = (typeof MPF_REWORK_SIGNALS)[number];

// ── Constraint propagation signal ─────────────────────────────────────────────

export const MPF_CONSTRAINT_SIGNALS = [
  "creates_constraint",
  "propagates_constraint",
  "resolves_constraint",
  "intensifies_constraint",
  "reduces_constraint",
  "no_constraint_signal",
  "unknown",
] as const;
export type MilestoneFlowConstraintPropagationSignal = (typeof MPF_CONSTRAINT_SIGNALS)[number];

// ── Confidence impact (baseline cap the event type imposes) ────────────────────

export const MPF_CONFIDENCE_IMPACTS = ["eligible_high", "cap_medium", "cap_low", "unknown"] as const;
export type MilestoneFlowConfidenceImpact = (typeof MPF_CONFIDENCE_IMPACTS)[number];

// ── Provenance handling + class + replay ──────────────────────────────────────

export const MPF_PROVENANCE_HANDLING = [
  "respect_event_provenance",
  "treat_as_derived_inference",
] as const;
export type MilestoneFlowProvenanceHandling = (typeof MPF_PROVENANCE_HANDLING)[number];

/** How an event instance's provenance was classified (native vs reconstructed). */
export const MPF_PROVENANCE_CLASSES = [
  "native",
  "backfilled",
  "inferred",
  "compensating",
  "unknown",
] as const;
export type MilestoneFlowProvenanceClass = (typeof MPF_PROVENANCE_CLASSES)[number];

export const MPF_REPLAY_BEHAVIORS = ["deterministic", "provenance_sensitive"] as const;
export type MilestoneFlowReplayBehavior = (typeof MPF_REPLAY_BEHAVIORS)[number];

// ── The per-event-type semantics record (deterministic, provenance-agnostic) ──

export interface MilestoneFlowEventSemantics {
  canonicalEventType: string;
  semanticCategory: MilestoneFlowSemanticCategory;
  /** The flow segment this event implies while it is the active condition. */
  flowSegmentType: MilestoneFlowSegmentType;
  transitionSignal: MilestoneFlowTransitionSignal;
  healthSignal: MilestoneFlowHealthSignal;
  frictionType: MilestoneFlowFrictionType | null;
  bottleneckCandidateType: MilestoneFlowBottleneckType | null;
  constraintPropagationSignal: MilestoneFlowConstraintPropagationSignal;
  reworkSignal: MilestoneFlowReworkSignal;
  /** Normally "fact" or "inference"; prediction/recommendation are reserved for
   *  future health/intelligence layers, never produced by static mapping. */
  evidenceKind: MilestoneFlowEvidenceKind;
  confidenceImpact: MilestoneFlowConfidenceImpact;
  provenanceHandling: MilestoneFlowProvenanceHandling;
  replayBehavior: MilestoneFlowReplayBehavior;
  notes: string;
}

// ── Per-instance provenance classification (depends on the event's metadata) ──

export interface MilestoneFlowProvenanceClassification {
  provenanceClass: MilestoneFlowProvenanceClass;
  /** Discrete ceiling this provenance places on any conclusion from the event. */
  maxConfidence: MilestoneFlowEvidenceConfidence;
  /** True for compensating events — interpret as a correction. */
  compensationAware: boolean;
  /** Compensating events never erase the original event's evidence. */
  preservesOriginalEvidence: boolean;
  /** Backfilled/compensating events are replay-provenance-sensitive. */
  replaySensitive: boolean;
}

// ── The full classification of a concrete event instance ──────────────────────

export interface MilestoneFlowEventClassification {
  canonicalEventType: string;
  semanticCategory: MilestoneFlowSemanticCategory;
  transitionSignal: MilestoneFlowTransitionSignal;
  flowSegmentType: MilestoneFlowSegmentType;
  healthSignal: MilestoneFlowHealthSignal;
  frictionType: MilestoneFlowFrictionType | null;
  bottleneckCandidateType: MilestoneFlowBottleneckType | null;
  constraintPropagationSignal: MilestoneFlowConstraintPropagationSignal;
  reworkSignal: MilestoneFlowReworkSignal;
  evidenceKind: MilestoneFlowEvidenceKind;
  provenance: MilestoneFlowProvenanceClassification;
  /** Confidence after combining event value, semantic cap, and provenance cap. */
  confidence: MilestoneFlowEvidenceConfidence;
  /** Traceable evidence ref built from the event (null when not evidence-bearing). */
  evidenceRef: MilestoneFlowEvidenceRef | null;
}

// ── Coverage validation result ────────────────────────────────────────────────

export interface MilestoneFlowSemanticsMapValidation {
  ok: boolean;
  total: number;
  mapped: number;
  /** Registered canonical events with no explicit semantics (a gap). */
  missing: string[];
  /** Map entries that are not registered canonical events (phantom entries). */
  unexpected: string[];
  /** EPHEMERAL_EXCLUDED types that leaked into the map (must be empty). */
  ephemeralLeaks: string[];
}
