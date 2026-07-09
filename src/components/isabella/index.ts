// ============================================================================
// Isabella — AI Workforce presentation layer (public surface)
// ============================================================================
export { IsabellaExperience } from "./isabella-experience";
export { IsabellaPresence, SvgAvatar } from "./avatar";
export type { PresenceProps, PresenceState, PresenceRendererKind } from "./avatar";
// Companion holográfico flotante (port del prototipo validado; aún sin montar
// en ninguna pantalla — montarlo requiere decisión de Product UX Contract).
export { IsabellaCompanion } from "./companion";
export type { IsabellaCompanionProps, IsabellaCompanionHandle } from "./companion";
