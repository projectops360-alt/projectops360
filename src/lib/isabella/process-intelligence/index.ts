// ============================================================================
// ProjectOps360° — Isabella Process Intelligence · public contract barrel
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT (Phase 5 · Task 1)
//
// The evidence-backed, RBAC-safe foundation future Phase-5 tasks consume:
//   • Task 2 — Context & Evidence Retrieval Layer: implements retrieval that
//     PRODUCES IsabellaEvidencePackets, enforces the security contract, and does
//     deterministic project-data retrieval (per intent-contract).
//   • Task 3 — Daily Process Diagnosis Engine: consumes packets; cites evidence.
//   • Task 4 — Root Cause & Constraint Analysis: consumes packets + graph/flow.
//   • Task 5 — Recommendation Engine: consumes diagnosis/root-cause evidence.
//   • Task 6 — UI / Realtime Integration & Regression.
//
// Contract only — no retrieval, no engine, no UI, no wiring into the live flow.
// ============================================================================

export * from "./types";
export * from "./data-sources";
export * from "./intent-contract";
export * from "./confidence";
export * from "./claim-policy";
export * from "./security-contract";
export * from "./response-policy";
