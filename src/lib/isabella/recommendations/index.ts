// ============================================================================
// ProjectOps360° — Isabella Recommendation & Next-Best-Action Engine · barrel
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE (Phase 5 · Task 5)
//
// Produces ranked, evidence-backed next-best-action recommendations from the
// Task 2 context + Task 3 diagnosis + Task 4 root-cause analysis. ADVISORY ONLY:
// every recommendation is human-approved and never auto-executed. Never mutates
// canonical data, the event log, or the process graph; never sends raw project
// data to the LLM. Next: Task 6 (UI + realtime + final regression).
// ============================================================================

export * from "./types";
export { CATEGORY_PROFILE, categoryLabel, isSupportedRecommendationCategory, mapFindingToRecommendationCategory } from "./categories";
export { generateRecommendationCandidates } from "./candidates";
export { derivePriority, capRecommendationConfidence, scoreRecommendationCandidate, rankRecommendations, CATEGORY_ORDER } from "./scoring";
export { validateRecommendationEvidence, filterEvidenceBacked, type EvidenceValidation } from "./evidence";
export { dedupeRecommendations, groupRecommendations, toRecommendation } from "./dedupe";
export {
  assembleRecommendationPlan,
  buildIsabellaRecommendationPlan,
  type RecommendationRequest,
} from "./engine";
export { formatRecommendationPlanForIsabella, priorityLabel } from "./formatter";
