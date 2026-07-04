// ============================================================================
// ProjectOps360° — Isabella Recommendation · deterministic scoring (pure)
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE
//
// Priority derivation + a deterministic numeric score for ranking. Same input →
// same order, always. `critical` requires blocked/severe evidence; `high`
// requires strong evidence or a direct blocker; low-confidence possible causes
// can never become critical. Partial context caps recommendation confidence.
// Pure.
// ============================================================================

import type { IsabellaConfidence } from "@/lib/isabella/process-intelligence/types";
import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import type { RootCauseFinding } from "@/lib/isabella/root-cause/types";
import { capConfidence } from "@/lib/isabella/root-cause";
import type {
  RecommendationCandidate,
  RecommendationCategory,
  RecommendationEffort,
  RecommendationImpact,
  RecommendationPriority,
  RecommendationUrgency,
} from "./types";

const PRIORITY_W: Record<RecommendationPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEVERITY_W: Record<string, number> = { blocked: 3, at_risk: 2, watch: 1, info: 0 };
const IMPACT_W: Record<RecommendationImpact, number> = {
  unblock_execution: 5,
  reduce_risk: 4,
  improve_accountability: 3,
  restore_sequence: 3,
  increase_clarity: 2,
  reduce_uncertainty: 1,
  unknown: 0,
};
const URGENCY_W: Record<RecommendationUrgency, number> = { now: 4, today: 3, this_week: 2, later: 1, unknown: 0 };
const CONFIDENCE_W: Record<IsabellaConfidence, number> = { verified: 5, high: 4, medium: 3, low: 2, unknown: 1, unavailable: 0 };
const EFFORT_W: Record<RecommendationEffort, number> = { low: 1, medium: 2, high: 3, unknown: 2 };

/** Stable category ordering used as a tie-breaker (blocker-first). */
export const CATEGORY_ORDER: RecommendationCategory[] = [
  "resolve_explicit_blocker",
  "recover_overdue_work",
  "validate_dependency",
  "stabilize_milestone",
  "assign_owner",
  "assign_milestone",
  "clarify_scope",
  "reduce_execution_uncertainty",
  "investigate_evidence_gap",
];

/**
 * Derive a recommendation priority from a finding's severity + classification +
 * confidence. Conservative: a low-confidence possible cause with no severity
 * evidence can never reach critical.
 */
export function derivePriority(finding: RootCauseFinding): RecommendationPriority {
  const blocked = finding.severity === "blocked";
  const atRisk = finding.severity === "at_risk";
  const strong = finding.confidence === "verified" || finding.confidence === "high";
  if (blocked && (strong || finding.classification === "confirmed_cause")) return "critical";
  if (blocked || finding.classification === "confirmed_cause" || (atRisk && strong)) return "high";
  if (atRisk || finding.classification === "likely_cause" || finding.classification === "possible_cause") return "medium";
  return "low";
}

/**
 * Cap a recommendation's confidence by context completeness (partial context can
 * never exceed `medium`; denied/unavailable context caps at `unavailable`).
 */
export function capRecommendationConfidence(confidence: IsabellaConfidence, context: IsabellaProcessContext): IsabellaConfidence {
  if (context.status === "partial") return capConfidence(confidence, "medium");
  if (context.status !== "ready") return capConfidence(confidence, "unavailable");
  return confidence;
}

/** Deterministic numeric score; higher ranks first. */
export function scoreRecommendationCandidate(candidate: RecommendationCandidate, severity: string): number {
  return (
    PRIORITY_W[candidate.priority] * 1000 +
    (SEVERITY_W[severity] ?? 0) * 100 +
    IMPACT_W[candidate.expectedImpact] * 20 +
    URGENCY_W[candidate.urgency] * 10 +
    CONFIDENCE_W[candidate.confidence] * 5 -
    EFFORT_W[candidate.effort] * 3
  );
}

/** Stable, deterministic ranking: score desc, then category order, title, id. */
export function rankRecommendations<T extends RecommendationCandidate & { severity?: string }>(candidates: T[]): T[] {
  const orderIndex = (c: RecommendationCategory) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...candidates].sort((a, b) => {
    const sa = scoreRecommendationCandidate(a, a.severity ?? "info");
    const sb = scoreRecommendationCandidate(b, b.severity ?? "info");
    if (sb !== sa) return sb - sa;
    const oa = orderIndex(a.category);
    const ob = orderIndex(b.category);
    if (oa !== ob) return oa - ob;
    const ta = a.affectedEntities[0]?.title ?? "";
    const tb = b.affectedEntities[0]?.title ?? "";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.dedupeKey.localeCompare(b.dedupeKey);
  });
}
