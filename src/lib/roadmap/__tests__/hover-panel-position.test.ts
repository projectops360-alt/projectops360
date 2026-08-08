// ============================================================================
// The hover panel: near the row, above it, inside the window
// ============================================================================
// Guard: GANTT-HOVER-PANEL-PLACEMENT
//
// Two positions were tried and both failed in opposite directions:
//
//   below the row     it covered the twelve rows underneath — reading a detail
//                     meant hiding the chart the detail was about
//   in the corner     it covered nothing and was near nothing; the eye had to
//                     cross the screen from the bar under the cursor
//
// So the properties here are "close to the pointer", "above it", and "never
// clipped by the window" — with above as a preference that yields at the top of
// the screen, where a clipped panel would be worse than a low one.
// ============================================================================

import { describe, it, expect } from "vitest";
import { placeHoverPanel, MIN_PANEL_HEIGHT } from "../hover-panel-position";

const VIEWPORT = { viewportWidth: 1440, viewportHeight: 900 };
const PANEL = 280;

function place(pointerX: number, pointerY: number, over = {}) {
  return placeHoverPanel({ pointerX, pointerY, panelWidth: PANEL, ...VIEWPORT, ...over });
}

describe("near the thing being pointed at", () => {
  it("centres on the pointer", () => {
    expect(place(700, 500).left).toBe(700 - PANEL / 2);
  });

  it("stays with the pointer as it moves across the chart", () => {
    // The corner-pinned version failed exactly here: the panel never moved.
    expect(place(300, 500).left).not.toBe(place(1100, 500).left);
  });
});

describe("above, so the rows below stay readable", () => {
  it("hangs upward from just above the pointer", () => {
    const p = place(700, 500);
    expect(p.above).toBe(true);
    expect(p.top).toBeLessThan(500); // above the cursor
  });

  it("leaves a gap so the panel never sits under the cursor", () => {
    expect(place(700, 500, { gap: 20 }).top).toBe(480);
  });
});

describe("it flips rather than being clipped", () => {
  it("drops below the pointer near the top of the window", () => {
    // A row in the first few pixels has no room above it.
    const p = place(700, 40);
    expect(p.above).toBe(false);
    expect(p.top).toBeGreaterThan(40);
  });

  it("still prefers above the moment there IS room", () => {
    expect(place(700, MIN_PANEL_HEIGHT + 40).above).toBe(true);
  });

  it("keeps a flipped panel off the bottom edge", () => {
    const p = place(700, 890);
    // 890 is close to the 900px floor, but there is room above, so it goes up.
    expect(p.above).toBe(true);
  });

  it("does not push a flipped panel through the bottom of a short window", () => {
    const p = place(700, 40, { viewportHeight: 300 });
    expect(p.above).toBe(false);
    expect(p.top + MIN_PANEL_HEIGHT).toBeLessThanOrEqual(300);
  });
});

describe("inside the window, always", () => {
  it("slides left instead of hanging off the right edge", () => {
    const p = place(1430, 500);
    expect(p.left + PANEL).toBeLessThanOrEqual(VIEWPORT.viewportWidth);
  });

  it("slides right instead of hanging off the left edge", () => {
    expect(place(5, 500).left).toBeGreaterThanOrEqual(0);
  });

  it("survives a window narrower than the panel", () => {
    const p = place(100, 500, { viewportWidth: 200 });
    expect(p.left).toBeGreaterThanOrEqual(0);
  });

  it("never returns a position off-screen, wherever the pointer is", () => {
    for (const x of [0, 1, 700, 1439, 1440]) {
      for (const y of [0, 1, 100, 450, 899, 900]) {
        const p = place(x, y);
        expect(p.left, `x=${x}`).toBeGreaterThanOrEqual(0);
        expect(p.left + PANEL, `x=${x}`).toBeLessThanOrEqual(VIEWPORT.viewportWidth);
        expect(p.top, `y=${y}`).toBeGreaterThanOrEqual(0);
        expect(p.top, `y=${y}`).toBeLessThanOrEqual(VIEWPORT.viewportHeight);
      }
    }
  });
});
