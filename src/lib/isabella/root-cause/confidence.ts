// ============================================================================
// ProjectOps360° — Isabella Root Cause · confidence scoring (pure)
// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE
//
// Conservative: causal conclusions are `high` only with strong direct evidence,
// usually `medium`, weak single signals `low`; missing evidence unknown/
// unavailable. Partial context CAPS confidence. Pure.
// ============================================================================

import type { IsabellaConfidence } from "@/lib/isabella/process-intelligence/types";
import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import type { RootCauseFinding } from "./types";

const RANK: Record<IsabellaConfidence, number> = { verified: 5, high: 4, medium: 3, low: 2, unknown: 1, unavailable: 0 };
const BY_RANK: IsabellaConfidence[] = ["unavailable", "unknown", "low", "medium", "high", "verified"];

/** Cap a confidence to a ceiling. */
export function capConfidence(actual: IsabellaConfidence, ceiling: IsabellaConfidence): IsabellaConfidence {
  return RANK[actual] <= RANK[ceiling] ? actual : ceiling;
}

/**
 * Cap a finding's confidence by context completeness: partial context can never
 * yield more than `medium`; denied/unavailable context caps at `unavailable`.
 */
export function scoreRootCauseConfidence(finding: RootCauseFinding, context: IsabellaProcessContext): IsabellaConfidence {
  let ceiling: IsabellaConfidence = "verified";
  if (context.status === "partial") ceiling = "medium";
  else if (context.status !== "ready") ceiling = "unavailable";
  // An `insufficient_evidence` finding never claims more than `low`.
  if (finding.classification === "insufficient_evidence") ceiling = capConfidence(ceiling, "low");
  if (finding.classification === "possible_cause") ceiling = capConfidence(ceiling, "medium");
  return capConfidence(finding.confidence, ceiling);
}

/** Overall analysis confidence = the strongest finding, capped by context. */
export function overallConfidence(findings: RootCauseFinding[], context: IsabellaProcessContext): IsabellaConfidence {
  if (context.status === "missing_context" || context.status === "unauthorized" || context.status === "unavailable") return "unavailable";
  if (findings.length === 0) return context.status === "empty" ? "unavailable" : "high";
  let best: IsabellaConfidence = "unavailable";
  for (const f of findings) if (RANK[f.confidence] > RANK[best]) best = f.confidence;
  return context.status === "partial" ? capConfidence(best, "medium") : best;
}

export { BY_RANK };
