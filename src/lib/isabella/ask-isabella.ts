// ============================================================================
// ProjectOps360° — Ask Isabella bridge (client-safe, UX-014)
// ============================================================================
// Isabella's open/close state is local to the floating launcher
// (LivingGuideWidget). To open Isabella with a question + entity context from
// anywhere (a task editor, an evidence panel…), components dispatch a window
// CustomEvent instead of reaching into the widget. The widget listens, opens,
// and seeds the conversation. ONE mechanism — no dead deep-links.
//
// This replaces the user-facing "AI Prompt" task field: user-facing AI help is
// an explicit Isabella action, never a static internal prompt field.
// ============================================================================

export const ISABELLA_ASK_EVENT = "isabella:ask";

export interface IsabellaAskDetail {
  /** The question to ask Isabella on open. Optional — omit to just open. */
  query?: string;
  /** The entity the question is about, so Isabella can pull its context/provenance. */
  entity?: { type: string; id: string; title?: string };
}

/**
 * Open Isabella and (optionally) ask a question about an entity. Safe to call
 * from any client component; no-op during SSR.
 */
export function askIsabella(detail: IsabellaAskDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<IsabellaAskDetail>(ISABELLA_ASK_EVENT, { detail }));
}
