// ============================================================================
// Where the schedule's hover panel goes
// ============================================================================
// Two failed positions taught this:
//
//   anchored below the row  the panel dropped over the twelve rows underneath,
//                           so reading a detail meant covering the chart it
//                           described
//   pinned to the corner    it never covered anything and was never near
//                           anything either — the eye had to travel the width
//                           of the screen from the bar it was pointing at
//
// So: beside the pointer, ABOVE it. Close enough to belong to the row under the
// cursor, and above so the rows it would otherwise hide stay readable — those
// are the rows the user is comparing against.
//
// Above is a preference, not a rule. Near the top of the window there is no
// room above, and a panel clipped by the window edge is worse than one below
// the pointer, so it flips.
// ============================================================================

export interface HoverPanelPlacement {
  left: number;
  top: number;
  /** True when the panel hangs upward from `top` (CSS translateY(-100%)). */
  above: boolean;
}

export interface PlaceHoverPanelArgs {
  pointerX: number;
  pointerY: number;
  panelWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Distance from the pointer, so the panel never sits under the cursor. */
  gap?: number;
  /** Keep-out from the window edges. */
  margin?: number;
}

/**
 * Enough room for a panel to be worth placing above.
 *
 * The panel's real height is not known until it renders, and measuring it
 * would cost a frame of flicker. This is the shortest the panel ever gets — a
 * task with a title, a milestone, dates and hours — so the flip decision is
 * made on the pessimistic case and never clips.
 */
export const MIN_PANEL_HEIGHT = 150;

export function placeHoverPanel({
  pointerX,
  pointerY,
  panelWidth,
  viewportWidth,
  viewportHeight,
  gap = 14,
  margin = 8,
}: PlaceHoverPanelArgs): HoverPanelPlacement {
  // Centred on the pointer, then pulled back inside the window. Clamping the
  // LEFT edge last means a panel near the right edge slides left rather than
  // hanging off it.
  const half = panelWidth / 2;
  const maxLeft = Math.max(margin, viewportWidth - panelWidth - margin);
  const left = Math.min(Math.max(margin, pointerX - half), maxLeft);

  const roomAbove = pointerY - gap - margin;
  const above = roomAbove >= MIN_PANEL_HEIGHT;

  // When it hangs upward, `top` is the panel's BOTTOM edge; when it flips, it
  // is the top edge. Either way it is kept off the window edge.
  const top = above
    ? Math.max(margin + MIN_PANEL_HEIGHT, pointerY - gap)
    : Math.min(pointerY + gap, Math.max(margin, viewportHeight - MIN_PANEL_HEIGHT - margin));

  return { left, top, above };
}
