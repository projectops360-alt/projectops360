// ============================================================================
// PMO Intelligence Center — panel visibility preferences (CAP-048 Phase 2)
// ============================================================================
// Which side panels are open, remembered per user and per organization.
//
// This exists because of one piece of dogfooding feedback: the canvas is the
// product, and it was being squeezed between a permanent 320px Isabella column
// on the right and a permanent 260px rail on the left. The graph got whatever
// was left. The fix is not a narrower panel — it is making the panels
// answerable to the user, and remembering the answer.
//
// Two defaults, and each is a deliberate choice rather than a coin toss:
//
//   ISABELLA IS CLOSED. There must be ONE Isabella on screen. The global
//   floating widget (`LivingGuideWidget`) is that one. A second permanently
//   mounted panel titled "Isabella Intelligence" makes the user ask which of
//   the two is the real one. The insights are still one click away, from a
//   labelled toolbar control that carries the finding count.
//
//   OVERVIEW IS OPEN. Health and today's focus are the reason a PMO opens this
//   screen at all; hiding them by default would trade one complaint for
//   another. It is collapsible, not hidden — and the distinction is the whole
//   point of the feedback that produced this file. The user asked for the RIGHT
//   panel (Isabella's findings) to be collapsible and read the left rail's
//   disappearance as the feature having been applied to the wrong side. So the
//   left rail is open on every first load, is never collapsed by anything other
//   than a direct click on its own toolbar toggle, and no code path may
//   auto-close it.
//
// Pure, storage-agnostic and separately testable: the component only decides
// where the buttons sit, never what "open" means or how it survives a reload.
// ============================================================================

/** The panels a user can collapse. The canvas itself is never collapsible. */
export type PmoPanelKey = "isabella" | "overview";

export interface PmoPanelPreferences {
  /** Isabella's insight panel. Closed by default — see the header. */
  isabella: boolean;
  /** The left rail: portfolio health + today's PMO focus. */
  overview: boolean;
}

export const DEFAULT_PANEL_PREFERENCES: PmoPanelPreferences = {
  isabella: false,
  overview: true,
};

// v2, and the bump is the fix rather than bookkeeping.
//
// An earlier build shipped the left rail defaulting to CLOSED. Users who loaded
// that build have `{"overview":false}` sitting in localStorage, and because a
// stored preference legitimately outranks a default, simply changing the default
// would not reach them: the rail would stay missing for exactly the people who
// reported it missing, and it would look like the fix had not shipped. Bumping
// the namespace retires those payloads. The cost is that a deliberate collapse
// made under the old build is forgotten once — the right trade against a panel
// that will not come back.
const PREFIX = "p360.pmo-panels.v2.";

/** Mirrors `layoutStorageKey`: colons and dots in ids would split the key. */
function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Key scoped to organization AND user.
 *
 * Same reasoning as the saved graph layout: switching org must not inherit
 * another portfolio's arrangement, and a shared browser must not leak one
 * user's preference to the next.
 */
export function panelPreferencesKey(organizationId: string, userId: string): string {
  return `${PREFIX}${safeSegment(userId)}.${safeSegment(organizationId)}`;
}

function storage(): Storage | null {
  try {
    // Private-mode browsers throw on access rather than returning null.
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Normalise an unknown payload into preferences.
 *
 * Unknown or missing keys fall back to the default rather than to `false`: a
 * truncated payload must not silently hide a panel the user never closed.
 */
export function parsePanelPreferences(raw: unknown): PmoPanelPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PANEL_PREFERENCES };
  const value = raw as Record<string, unknown>;
  return {
    isabella:
      typeof value.isabella === "boolean"
        ? value.isabella
        : DEFAULT_PANEL_PREFERENCES.isabella,
    overview:
      typeof value.overview === "boolean"
        ? value.overview
        : DEFAULT_PANEL_PREFERENCES.overview,
  };
}

/**
 * Read the stored preferences.
 *
 * SSR-safe (returns the defaults without a window) so it can be used as a lazy
 * `useState` initialiser — which is what keeps the panels from flashing open on
 * the first paint and then snapping shut.
 */
export function loadPanelPreferences(
  organizationId: string,
  userId: string,
): PmoPanelPreferences {
  const store = storage();
  if (!store) return { ...DEFAULT_PANEL_PREFERENCES };
  try {
    const raw = store.getItem(panelPreferencesKey(organizationId, userId));
    if (!raw) return { ...DEFAULT_PANEL_PREFERENCES };
    return parsePanelPreferences(JSON.parse(raw));
  } catch {
    // Corrupt payload. A bad preference must never break the screen.
    return { ...DEFAULT_PANEL_PREFERENCES };
  }
}

export function savePanelPreferences(
  organizationId: string,
  userId: string,
  preferences: PmoPanelPreferences,
): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      panelPreferencesKey(organizationId, userId),
      JSON.stringify(preferences),
    );
  } catch {
    // Quota exhausted or storage disabled. Losing a panel preference is not
    // worth interrupting the user over.
  }
}

/** Toggle one panel, leaving the others untouched. */
export function togglePanel(
  preferences: PmoPanelPreferences,
  key: PmoPanelKey,
): PmoPanelPreferences {
  return { ...preferences, [key]: !preferences[key] };
}
