// ============================================================================
// ProjectOps360° — Isabella Process Context & Evidence Retrieval · barrel
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL (Phase 5 · Task 2)
//
// The boundary between ProjectOps360° data and Isabella intelligence. Future
// engines consume this ONLY:
//   • Task 3 — Daily Process Diagnosis: consumes IsabellaProcessContext packets.
//   • Task 4 — Root Cause: consumes packets + process signals (needs ≥2 signals).
//   • Task 5 — Recommendation: consumes diagnosis/root-cause evidence.
// Retrieval-only: no reasoning, no UI, no canonical mutation. Server modules
// (access/context/task/milestone/query executor) import the DB client; the pure
// builders (evidence/citation/context aggregation) do not.
// ============================================================================

export * from "./types";
export * from "./evidence-builder";
export {
  buildTaskContext,
  buildTaskEvidence,
  mapTaskRowsToSummaries,
  getIsabellaTaskEvidence,
  type TaskEvidenceOutcome,
  type TaskEvidenceOptions,
  type SubtaskLite,
} from "./task-evidence";
export {
  buildMilestoneContext,
  buildMilestoneEvidence,
  getIsabellaMilestoneEvidence,
  type MilestoneEvidenceOutcome,
  type MilestoneLite,
} from "./milestone-evidence";
export { buildProcessSignals, mergeProcessMiningSignals } from "./process-signals";
export {
  buildProcessMiningEvidence,
  getIsabellaProcessMiningEvidence,
  type ProcessMiningEvidenceOutcome,
} from "./process-mining-evidence";
export { resolveIsabellaProjectAccess, type ResolveAccessInput } from "./access";
export { executeDeterministicProjectDataRequest, type ProjectQueryExecution } from "./query-executor";
export { buildIsabellaProcessContext } from "./context-builder";
export {
  getIsabellaFinancialEvidence,
  type IsabellaFinancialEvidenceOutcome,
} from "./financial-evidence";
