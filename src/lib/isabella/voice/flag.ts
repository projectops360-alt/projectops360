// ============================================================================
// ProjectOps360° — Isabella Voice · feature flag (server-only)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// Default OFF. When disabled, the voice session/bridge endpoints return 404 and
// no voice UI is offered — Isabella's current pipeline (text panel, browser
// SpeechSynthesis) is byte-for-byte unchanged. Rollback = unset the flag — no
// migration. Read only from a server-side env var; never trust the client.
// ============================================================================

import { env } from "@/lib/env";

/** True only when ISABELLA_VOICE_ENABLED is explicitly "true". */
export function isIsabellaVoiceEnabled(): boolean {
  return String(env.ISABELLA_VOICE_ENABLED).toLowerCase() === "true";
}
