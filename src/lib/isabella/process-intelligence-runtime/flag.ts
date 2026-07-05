// ============================================================================
// ProjectOps360° — Isabella Process Intelligence Runtime · feature flags
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION (Phase 5 · Task 6)
//
// Default OFF. When OFF, Isabella's current pipeline (deterministic query engine
// + RAG + provenance/execution enrichment) is byte-for-byte unchanged and the
// diagnosis/root-cause/recommendation engines are never routed. Rollback = unset
// the flag(s) — no migration. Read only from server-side env; never the client.
// ============================================================================

import { env } from "@/lib/env";

/** True only when ISABELLA_PROCESS_INTELLIGENCE_ENABLED is explicitly "true". */
export function isIsabellaProcessIntelligenceEnabled(): boolean {
  return String(env.ISABELLA_PROCESS_INTELLIGENCE_ENABLED).toLowerCase() === "true";
}

/** True only when ISABELLA_PROCESS_INTELLIGENCE_UI_ENABLED is explicitly "true". */
export function isIsabellaProcessIntelligenceUiEnabled(): boolean {
  return String(env.ISABELLA_PROCESS_INTELLIGENCE_UI_ENABLED).toLowerCase() === "true";
}
