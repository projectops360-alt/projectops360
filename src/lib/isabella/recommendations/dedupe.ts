// ============================================================================
// ProjectOps360° — Isabella Recommendation · dedupe + grouping (pure)
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE
//
// Collapses candidates that describe the same underlying action (same
// `dedupeKey`) into one grouped recommendation — top examples + a count, never
// one noisy recommendation per task. Merging PRESERVES evidenceRefs and source
// traceability. `groupRecommendations` buckets the final list by priority. Pure.
// ============================================================================

import type { AffectedEntity } from "@/lib/isabella/root-cause/types";
import type {
  IsabellaRecommendation,
  RecommendationCandidate,
  RecommendationGroup,
  RecommendationLanguage,
  RecommendationPriority,
} from "./types";

type CandidateWithSeverity = RecommendationCandidate & { severity?: string };

const PRIORITY_RANK: Record<RecommendationPriority, number> = { critical: 3, high: 2, medium: 1, low: 0 };
const URGENCY_RANK: Record<string, number> = { now: 4, today: 3, this_week: 2, later: 1, unknown: 0 };
const CONF_RANK: Record<string, number> = { verified: 5, high: 4, medium: 3, low: 2, unknown: 1, unavailable: 0 };

function uniq(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))];
}
function mergeEntities(a: AffectedEntity[], b: AffectedEntity[]): AffectedEntity[] {
  const seen = new Set<string>();
  const out: AffectedEntity[] = [];
  for (const e of [...a, ...b]) {
    const k = e.safeRef ?? e.title;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/** Merge candidates sharing a `dedupeKey`; preserve evidence + source ids. */
export function dedupeRecommendations(candidates: CandidateWithSeverity[]): CandidateWithSeverity[] {
  const byKey = new Map<string, CandidateWithSeverity>();
  for (const c of candidates) {
    const existing = byKey.get(c.dedupeKey);
    if (!existing) {
      byKey.set(c.dedupeKey, { ...c, affectedEntities: [...c.affectedEntities] });
      continue;
    }
    existing.affectedEntities = mergeEntities(existing.affectedEntities, c.affectedEntities);
    existing.evidenceRefs = uniq([...existing.evidenceRefs, ...c.evidenceRefs]);
    existing.sourceFindingIds = uniq([...existing.sourceFindingIds, ...c.sourceFindingIds]);
    existing.sourceConstraintIds = uniq([...existing.sourceConstraintIds, ...c.sourceConstraintIds]);
    existing.sourceEvidenceChainIds = uniq([...existing.sourceEvidenceChainIds, ...c.sourceEvidenceChainIds]);
    existing.preconditions = uniq([...(existing.preconditions ?? []), ...(c.preconditions ?? [])]);
    existing.missingEvidence = uniq([...(existing.missingEvidence ?? []), ...(c.missingEvidence ?? [])]);
    // Keep the strongest signal across the merged group.
    if (PRIORITY_RANK[c.priority] > PRIORITY_RANK[existing.priority]) existing.priority = c.priority;
    if (URGENCY_RANK[c.urgency] > URGENCY_RANK[existing.urgency]) existing.urgency = c.urgency;
    if (CONF_RANK[c.confidence] > CONF_RANK[existing.confidence]) existing.confidence = c.confidence;
  }
  return [...byKey.values()];
}

/** Finalize a ranked candidate into an advisory recommendation (id + safety flags). */
export function toRecommendation(candidate: CandidateWithSeverity, index: number): IsabellaRecommendation {
  const missing = candidate.missingEvidence && candidate.missingEvidence.length > 0 ? candidate.missingEvidence : undefined;
  return {
    id: `rec-${index + 1}-${candidate.category}`,
    title: candidate.title,
    category: candidate.category,
    priority: candidate.priority,
    urgency: candidate.urgency,
    effort: candidate.effort,
    expectedImpact: candidate.expectedImpact,
    confidence: candidate.confidence,
    rationale: candidate.rationale,
    expectedOutcome: candidate.expectedOutcome,
    affectedEntities: candidate.affectedEntities,
    groupedCount: Math.max(candidate.affectedEntities.length, candidate.sourceFindingIds.length, 1),
    sourceFindingIds: candidate.sourceFindingIds,
    sourceConstraintIds: candidate.sourceConstraintIds,
    sourceEvidenceChainIds: candidate.sourceEvidenceChainIds,
    evidenceRefs: candidate.evidenceRefs,
    preconditions: candidate.preconditions,
    missingEvidence: missing,
    humanApprovalRequired: true,
    executableNow: false,
  };
}

/** Bucket recommendations by priority into ordered groups (critical → low). */
export function groupRecommendations(recommendations: IsabellaRecommendation[], language: RecommendationLanguage): RecommendationGroup[] {
  const es = language === "es";
  const order: RecommendationPriority[] = ["critical", "high", "medium", "low"];
  const label: Record<RecommendationPriority, { en: string; es: string }> = {
    critical: { en: "Critical", es: "Crítica" },
    high: { en: "High priority", es: "Prioridad alta" },
    medium: { en: "Medium priority", es: "Prioridad media" },
    low: { en: "Low priority", es: "Prioridad baja" },
  };
  const reason: Record<RecommendationPriority, { en: string; es: string }> = {
    critical: { en: "Blocked/severe execution evidence — act first.", es: "Evidencia de ejecución bloqueada/severa — atender primero." },
    high: { en: "Strong evidence or a direct blocker.", es: "Evidencia fuerte o un bloqueo directo." },
    medium: { en: "Likely/possible constraints to address next.", es: "Restricciones probables/posibles a atender después." },
    low: { en: "Cleanup, clarity and evidence gaps.", es: "Limpieza, claridad y gaps de evidencia." },
  };
  const groups: RecommendationGroup[] = [];
  for (const p of order) {
    const ids = recommendations.filter((r) => r.priority === p).map((r) => r.id);
    if (ids.length === 0) continue;
    groups.push({ label: label[p][es ? "es" : "en"], priority: p, recommendations: ids, reason: reason[p][es ? "es" : "en"] });
  }
  return groups;
}
