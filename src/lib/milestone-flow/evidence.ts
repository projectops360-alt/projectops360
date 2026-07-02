// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine · Evidence (Phase 3, Task 1)
// ============================================================================
// Helpers that enforce the engine's core epistemic contract: every derived
// conclusion is traceable to evidence, and confidence never exceeds what the
// evidence supports. Pure + deterministic. Absence of evidence resolves to
// "unknown" confidence — the engine never fabricates support (Constitution §15).
// ============================================================================

import { MPF_DEFAULT_CONFIDENCE } from "./constants";
import type {
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceKind,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEventRef,
} from "./types";

const CONFIDENCE_RANK: Record<MilestoneFlowEvidenceConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/** Build an evidence ref anchored to a project_event_log event id. */
export function eventEvidence(
  event: Pick<MilestoneFlowEventRef, "eventId" | "confidence" | "lifecycleClass">,
  kind: MilestoneFlowEvidenceKind = "fact",
): MilestoneFlowEvidenceRef {
  return {
    kind,
    eventId: event.eventId,
    confidence: confidenceFromEvent(event),
  };
}

/** Build an evidence ref anchored to a derived metric path. */
export function metricEvidence(
  metricRef: string,
  kind: MilestoneFlowEvidenceKind,
  confidence: MilestoneFlowEvidenceConfidence,
): MilestoneFlowEvidenceRef {
  return { kind, metricRef, confidence };
}

/** Build an uncertainty note as a first-class evidence ref. */
export function uncertaintyEvidence(note: string): MilestoneFlowEvidenceRef {
  return { kind: "uncertainty", note, confidence: MPF_DEFAULT_CONFIDENCE };
}

/**
 * Map an event's numeric confidence + provenance to a discrete level.
 * Backfilled/synthetic events are capped lower — they are never "high".
 */
export function confidenceFromEvent(
  event: Pick<MilestoneFlowEventRef, "confidence" | "lifecycleClass">,
): MilestoneFlowEvidenceConfidence {
  const backfilled = event.lifecycleClass === "SYNTHETIC_BACKFILL_EVENT";
  const c = event.confidence;
  if (c == null) return backfilled ? "low" : "unknown";
  let level: MilestoneFlowEvidenceConfidence;
  if (c >= 0.85) level = "high";
  else if (c >= 0.6) level = "medium";
  else if (c > 0) level = "low";
  else level = "unknown";
  // Synthetic history can never be asserted at "high".
  if (backfilled && level === "high") level = "medium";
  return level;
}

/**
 * The confidence of a set of refs is that of its WEAKEST fact/inference ref
 * (a conclusion is only as strong as its softest supporting evidence). An empty
 * set — no evidence — is always "unknown". Constitution §15.3.
 */
export function aggregateConfidence(
  refs: readonly MilestoneFlowEvidenceRef[],
): MilestoneFlowEvidenceConfidence {
  const supporting = refs.filter((r) => r.kind === "fact" || r.kind === "inference");
  if (supporting.length === 0) return MPF_DEFAULT_CONFIDENCE;
  let min: MilestoneFlowEvidenceConfidence = "high";
  for (const ref of supporting) {
    if (CONFIDENCE_RANK[ref.confidence] < CONFIDENCE_RANK[min]) min = ref.confidence;
  }
  return min;
}

/**
 * True when the refs contain at least one grounding fact. Used by callers that
 * must refuse to publish a conclusion (or downgrade it to "unknown") when there
 * is nothing to stand on. Constitution §10 (#17): no unexplained conclusions.
 */
export function hasGroundingFact(refs: readonly MilestoneFlowEvidenceRef[]): boolean {
  return refs.some((r) => r.kind === "fact" && (r.eventId != null || r.metricRef != null));
}
