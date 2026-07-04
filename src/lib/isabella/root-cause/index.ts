// ============================================================================
// ProjectOps360° — Isabella Root Cause & Constraint Analysis Engine · barrel
// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE (Phase 5 · Task 4)
//
// Explains "why this appears to be happening" ONLY when evidence supports it —
// symptom vs constraint vs likely/possible/confirmed cause vs insufficient
// evidence, with evidence chains. Never prescribes actions (Task 5). Consumes
// the Task 2 context + Task 3 diagnosis; never raw project data.
// ============================================================================

export * from "./types";
export { constraintLabel, isSupportedConstraint } from "./taxonomy";
export { extractRootCauseSymptoms, classifyConstraintSignals } from "./signals";
export { buildEvidenceChains } from "./evidence-chain";
export { scoreRootCauseConfidence, capConfidence, overallConfidence } from "./confidence";
export {
  classifyRootCauseFindings,
  buildInvestigationGaps,
  buildRecommendationHandoffHints,
  assembleRootCauseAnalysis,
  buildIsabellaRootCauseAnalysis,
  type RootCauseRequest,
} from "./engine";
export { formatRootCauseAnalysisForIsabella, classificationLabel } from "./formatter";
