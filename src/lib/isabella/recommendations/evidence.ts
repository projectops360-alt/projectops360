// ============================================================================
// ProjectOps360° — Isabella Recommendation · evidence validation (pure)
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE
//
// Guards the #1 rule: NO recommendation without evidence. A candidate is valid
// only when it traces to a finding / evidenceRefs, OR it is an explicit
// "investigate evidence gap" whose whole purpose is confirming a missing source.
// Never cites raw event-log rows / raw payloads / layout coordinates. Pure.
// ============================================================================

import type { RecommendationCandidate } from "./types";

export interface EvidenceValidation {
  valid: boolean;
  reason?: string;
}

/** True when the candidate is traceable to approved evidence (or a declared gap). */
export function validateRecommendationEvidence(candidate: RecommendationCandidate): EvidenceValidation {
  const hasEvidence = candidate.evidenceRefs.length > 0;
  const hasSource = candidate.sourceFindingIds.length > 0;
  const isDeclaredGap =
    candidate.category === "investigate_evidence_gap" &&
    (candidate.missingEvidence?.length ?? 0) > 0;

  if (hasEvidence || hasSource || isDeclaredGap) return { valid: true };
  return { valid: false, reason: "no_evidence" };
}

/** Drop candidates that are not evidence-backed (no generic advice ever). */
export function filterEvidenceBacked<T extends RecommendationCandidate>(candidates: T[]): T[] {
  return candidates.filter((c) => validateRecommendationEvidence(c).valid);
}
