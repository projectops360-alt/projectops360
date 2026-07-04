// ============================================================================
// ProjectOps360° — Isabella Process Intelligence · confidence/uncertainty model
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT
//
// The rules that keep confidence HONEST: deterministic retrieved data is
// `verified`, and a successful deterministic report can NEVER carry a
// low-confidence label ("AI suggestion · 20%" is forbidden there). Pure.
// ============================================================================

import type { IsabellaConfidence } from "./types";

/** Ordered strongest → weakest, for min-confidence comparisons. */
const CONFIDENCE_RANK: Record<IsabellaConfidence, number> = {
  verified: 5,
  high: 4,
  medium: 3,
  low: 2,
  unknown: 1,
  unavailable: 0,
};

/** True when `actual` is at least as strong as `minimum`. */
export function meetsConfidence(actual: IsabellaConfidence, minimum: IsabellaConfidence): boolean {
  return CONFIDENCE_RANK[actual] >= CONFIDENCE_RANK[minimum];
}

/**
 * A "low-confidence label" is anything the user would read as an unreliable AI
 * guess. `verified`/`high`/`medium` are trustworthy; `low`/`unknown` are not.
 * (`unavailable` is an explicit honest state, not a low-confidence answer.)
 */
export function isLowConfidenceLabel(confidence: IsabellaConfidence): boolean {
  return confidence === "low" || confidence === "unknown";
}

/** Deterministic retrieval is always `verified` — never a guess. */
export function confidenceForDeterministicRetrieval(): IsabellaConfidence {
  return "verified";
}

/**
 * Guard the reported bug class: a SUCCESSFUL deterministic report must be
 * `verified` and must NOT carry a low-confidence label. Returns the list of
 * violations (empty = compliant).
 */
export function validateDeterministicReportConfidence(input: {
  retrievalSucceeded: boolean;
  confidence: IsabellaConfidence;
}): string[] {
  if (!input.retrievalSucceeded) return [];
  const violations: string[] = [];
  if (input.confidence !== "verified") {
    violations.push("A successful deterministic report must be tier 'verified'.");
  }
  if (isLowConfidenceLabel(input.confidence)) {
    violations.push("A successful deterministic report must not carry a low-confidence label.");
  }
  return violations;
}
