// ============================================================================
// ProjectOps360° — Isabella Daily Process Diagnosis Engine · barrel
// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE (Phase 5 · Task 3)
//
// Evidence-backed "what needs attention today". Consumes the Task 2
// IsabellaProcessContext ONLY — symptoms + attention signals, never root causes
// or recommendations. Next: Task 4 (Root Cause), Task 5 (Recommendation).
// ============================================================================

export * from "./types";
export { computeDiagnosisSignals, type DiagnosisSignals } from "./metrics";
export { evaluateDailyHealth } from "./health";
export {
  buildProgressSection,
  buildBlockersSection,
  buildRisksOrAttentionSection,
  buildMilestoneFocusSection,
  buildExecutionGapsSection,
  buildTodayFocusSection,
} from "./sections";
export { collectDiagnosisEvidence, buildNextEngineHints } from "./evidence";
export { formatDailyDiagnosisForIsabella, healthLabel } from "./formatter";
export { assembleDailyDiagnosis, buildIsabellaDailyProcessDiagnosis, type DailyDiagnosisRequest } from "./engine";
