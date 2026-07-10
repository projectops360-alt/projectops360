// ============================================================================
// ProjectOps360° — Isabella Voice · public surface
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE — voice is a LAYER on top of Isabella.
// ============================================================================

export { isIsabellaVoiceEnabled } from "./flag";
export { runVoiceBridge, type VoiceBridgeDeps } from "./bridge";
export {
  ASK_ISABELLA_TOOL,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_VOICE,
  buildRealtimeSessionConfig,
} from "./tool-contract";
export { buildVoiceInstructions } from "./persona";
export { toSpeechText, stripMarkdownForSpeech, SPEECH_ANSWER_MAX_CHARS } from "./speech-text";
export { persistVoiceAudit, VOICE_AUDIT_MODEL } from "./audit";
export {
  voiceBridgeRequestSchema,
  voiceSessionRequestSchema,
  voiceClientContextSchema,
} from "./schemas";
export type * from "./types";
