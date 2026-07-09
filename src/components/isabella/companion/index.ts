// ============================================================================
// Isabella Companion — holograma flotante (port del prototipo validado)
// ============================================================================
export { IsabellaCompanion } from "./IsabellaCompanion";
export type {
  IsabellaCompanionProps,
  IsabellaCompanionHandle,
} from "./IsabellaCompanion";
export {
  createIsabellaBrain,
  createDemoRiskEvent,
} from "./isabellaBrain";
export type {
  IsabellaBrainFn,
  IsabellaBrainReply,
  IsabellaLang,
  IsabellaNotifyEvent,
  IsabellaState,
} from "./isabellaBrain";
export { useIsabellaVoice, scoreVoice } from "./useIsabellaVoice";
export type { IsabellaVoiceApi, SpeakStatus } from "./useIsabellaVoice";
