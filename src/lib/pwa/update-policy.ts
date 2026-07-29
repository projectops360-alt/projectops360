// ============================================================================
// PWA update policy — when a stale install may reload itself
// ============================================================================
// Kept as pure functions so the rule that decides whether to interrupt someone
// is testable without a browser. The component only wires events to it.
//
// The balance being struck: an installed app that never updates eventually
// serves a build nobody is debugging any more, but a reload fired while
// someone is mid-form destroys their work. So the app reloads at the one
// moment it knows nobody is typing — when it comes back to the foreground —
// and otherwise asks.
// ============================================================================

export type UpdateAction =
  /** Same build; nothing to do. */
  | "none"
  /** Safe to reload without asking — the app was not in use. */
  | "reload"
  /** Someone is using it; offer the update instead of taking it. */
  | "prompt";

export interface UpdateDecisionInput {
  /** Build id compiled into the running bundle. */
  currentBuildId: string;
  /** Build id reported by the server right now. */
  latestBuildId: string | null;
  /**
   * Was the app in the background since the last check? A tab returning to
   * the foreground is the safe moment: no field has focus mid-keystroke.
   */
  wasBackgrounded: boolean;
  /** Does the page hold unsaved edits (a dirty form, an open editor)? */
  hasUnsavedWork?: boolean;
}

/**
 * `development` is the local fallback build id. Treating it as comparable
 * would make `npm run dev` reload itself on every HMR pass.
 */
export function isComparableBuildId(buildId: string | null | undefined): boolean {
  return Boolean(buildId) && buildId !== "development" && buildId !== "";
}

export function decideUpdateAction({
  currentBuildId,
  latestBuildId,
  wasBackgrounded,
  hasUnsavedWork = false,
}: UpdateDecisionInput): UpdateAction {
  // A failed or meaningless check must never be read as "you are up to date"
  // *or* as a reason to reload. Both are handled by doing nothing.
  if (!isComparableBuildId(currentBuildId) || !isComparableBuildId(latestBuildId)) {
    return "none";
  }
  if (currentBuildId === latestBuildId) return "none";

  // Unsaved work outranks freshness, even on the "safe" path.
  if (hasUnsavedWork) return "prompt";

  return wasBackgrounded ? "reload" : "prompt";
}

/** How often to re-check while the app is open and in the foreground. */
export const FOREGROUND_POLL_MS = 15 * 60 * 1000;

/**
 * How long the app must have been hidden before returning counts as
 * "backgrounded". Switching windows for two seconds should not trigger a
 * reload; coming back to it the next morning should.
 */
export const BACKGROUND_THRESHOLD_MS = 60 * 1000;
