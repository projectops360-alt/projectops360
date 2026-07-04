// ============================================================================
// ProjectOps360° — Isabella Generic Project-Data Query Engine · barrel
// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE
//
// NL → validated query plan → RBAC-safe adapter → deterministic filter/sort/
// group → verified report. The "tasks without milestone" case is ONE instance of
// a generic filter engine, not a hardcoded phrase. Generalizes and supersedes
// the live task-report short-circuit (ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA).
// ============================================================================

export * from "./query-plan";
export * from "./catalog";
export * from "./parser";
export * from "./filter-engine";
export * from "./refine";
export * from "./formatter";
// task-adapter is server-only (imports the retrieval); export it explicitly.
export { runTaskQuery, answerTaskQuery, type TaskQueryOutcome, type RunTaskQueryParams } from "./task-adapter";
