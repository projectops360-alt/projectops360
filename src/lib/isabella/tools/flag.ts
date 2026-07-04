// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · feature flag (server-only)
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY (Phase 5 · Task 2B)
//
// Default OFF. When disabled, Isabella's current pipeline (deterministic query
// engine + RAG) is byte-for-byte unchanged. Rollback = unset the flag — no
// migration. Read only from a server-side env var; never trust the client.
// ============================================================================

import { env } from "@/lib/env";

/** True only when ISABELLA_TOOL_USE_ENABLED is explicitly "true". */
export function isIsabellaToolUseEnabled(): boolean {
  return String(env.ISABELLA_TOOL_USE_ENABLED).toLowerCase() === "true";
}
