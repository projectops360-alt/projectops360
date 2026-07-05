// ============================================================================
// ProjectOps360° — Isabella Process Intelligence Runtime · barrel
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION (Phase 5 · Task 6)
//
// Wires the accepted Task 3/4/5 engines into Isabella's live answer behind a
// server flag (default OFF). Deterministic routing + read-only orchestration; no
// mutation, no execution, no raw data to the LLM. Rollback = unset the flag.
// ============================================================================

export * from "./types";
export { isIsabellaProcessIntelligenceEnabled, isIsabellaProcessIntelligenceUiEnabled } from "./flag";
export { routeIsabellaQuestion, resolveNodeScope, isEngineRoute, type IsabellaRouteDecision } from "./router";
export { runIsabellaProcessIntelligence } from "./runtime";
export { getIsabellaQuickActions, type IsabellaQuickAction } from "./quick-actions";
