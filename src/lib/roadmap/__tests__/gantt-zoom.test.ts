// ============================================================================
// The zoom buttons must change the chart
// ============================================================================
// Guard: GANTT-ZOOM-REAL
//
// The Gantt shipped with Day / Week / Month buttons and a ZOOM_CONFIG holding
// pixels-per-day that NOTHING read. Bars were positioned as percentages of a
// fixed-width container, so all three buttons drew the identical picture. The
// visible symptom on a 14-month, 274-task plan: everything crushed into one
// screen with no way to open it up.
//
// So the property under test is the one that was missing: a wider zoom must
// produce a wider canvas, and "fit" must produce exactly the space available.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  ganttTimelineWidth,
  defaultZoomFor,
  dayWidthFor,
  fitsLabel,
  monthLabelStep,
  MIN_TIMELINE_WIDTH,
  GANTT_ZOOM_LEVELS,
} from "../gantt-zoom";

// Aurora: 12 Jan 2026 → early 2027, about 420 days.
const AURORA_DAYS = 420;
const LAPTOP = 1100;

describe("zoom actually changes the width", () => {
  it("draws a wider canvas at every step from quarter to day", () => {
    const widths = (["quarter", "month", "week", "day"] as const).map((zoom) =>
      ganttTimelineWidth({ totalDays: AURORA_DAYS, zoom, availableWidth: LAPTOP }),
    );
    // Strictly increasing — the regression was all four being equal.
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i], `${widths[i]} should exceed ${widths[i - 1]}`).toBeGreaterThan(widths[i - 1]);
    }
  });

  it("gives a day 32px at Day zoom", () => {
    expect(ganttTimelineWidth({ totalDays: 100, zoom: "day", availableWidth: LAPTOP })).toBe(3200);
  });

  it("opens Aurora up to a scrollable 13,440px at Day", () => {
    expect(ganttTimelineWidth({ totalDays: AURORA_DAYS, zoom: "day", availableWidth: LAPTOP })).toBe(13440);
  });
});

describe("fit means the whole plan on screen", () => {
  it("uses exactly the space available, so nothing scrolls", () => {
    expect(ganttTimelineWidth({ totalDays: AURORA_DAYS, zoom: "fit", availableWidth: LAPTOP })).toBe(LAPTOP);
  });

  it("fits a ten-year plan the same as a ten-day one", () => {
    expect(ganttTimelineWidth({ totalDays: 3650, zoom: "fit", availableWidth: 900 })).toBe(900);
    expect(ganttTimelineWidth({ totalDays: 10, zoom: "fit", availableWidth: 900 })).toBe(900);
  });
});

describe("never narrower than the viewport", () => {
  it("widens a short plan to fill the canvas", () => {
    // A 5-day plan at Quarter is 8px of bar. Drawn at 8px it looks broken;
    // it is stretched back to the available width instead.
    const width = ganttTimelineWidth({ totalDays: 5, zoom: "quarter", availableWidth: LAPTOP });
    expect(width).toBe(LAPTOP);
  });

  it("holds a floor when the container has not been measured yet", () => {
    // First paint, before the ref has a width: 0 must not collapse the chart.
    expect(ganttTimelineWidth({ totalDays: 100, zoom: "fit", availableWidth: 0 })).toBe(MIN_TIMELINE_WIDTH);
  });

  it("survives a plan with no span at all", () => {
    expect(ganttTimelineWidth({ totalDays: 0, zoom: "day", availableWidth: LAPTOP })).toBe(LAPTOP);
    expect(ganttTimelineWidth({ totalDays: NaN, zoom: "day", availableWidth: LAPTOP })).toBe(LAPTOP);
  });
});

describe("the level a project opens at", () => {
  it("opens a two-week sprint at Day — the most detail that still fits", () => {
    expect(defaultZoomFor(14, LAPTOP)).toBe("day");
  });

  it("opens Aurora at a level that does not need scrolling", () => {
    const zoom = defaultZoomFor(AURORA_DAYS, LAPTOP);
    expect(zoom).toBe("quarter");
    expect(AURORA_DAYS * (dayWidthFor(zoom) ?? 0)).toBeLessThanOrEqual(LAPTOP);
  });

  it("falls back to fit when even the widest level overflows", () => {
    expect(defaultZoomFor(5000, 400)).toBe("fit");
  });

  it("never returns a level whose chart would overflow", () => {
    for (const days of [7, 30, 90, 200, 420, 900]) {
      const zoom = defaultZoomFor(days, LAPTOP);
      const perDay = dayWidthFor(zoom);
      if (perDay != null) expect(days * perDay, `${days}d → ${zoom}`).toBeLessThanOrEqual(LAPTOP);
    }
  });
});

describe("labels follow the bar, not the zoom level", () => {
  it("prints a label when the bar has room, whatever the zoom", () => {
    // The old rule was `zoom !== "month"`, which hid the label on a 90-day bar
    // at Month zoom (360px — acres of room) and printed it on a 1-day bar at
    // Day zoom (32px — none).
    expect(fitsLabel(360)).toBe(true);
    expect(fitsLabel(32)).toBe(false);
  });
});

describe("month gridlines", () => {
  it("labels every month when they are far apart", () => {
    expect(monthLabelStep(90, 900)).toBe(1);
  });

  it("thins to quarters, then half-years, as the plan gets long", () => {
    expect(monthLabelStep(420, 600)).toBe(3); // ~43px/month
    expect(monthLabelStep(1800, 1200)).toBe(6); // ~20px/month
    expect(monthLabelStep(3650, 700)).toBe(12); // ~6px/month
  });

  it("never returns zero, which would divide by nothing downstream", () => {
    for (const [days, width] of [[0, 0], [1, 10], [10000, 100]] as const) {
      expect(monthLabelStep(days, width)).toBeGreaterThan(0);
    }
  });
});

describe("the level list", () => {
  it("runs widest to narrowest", () => {
    expect(GANTT_ZOOM_LEVELS).toEqual(["fit", "quarter", "month", "week", "day"]);
  });

  it("gives every level but fit a pixel width", () => {
    for (const zoom of GANTT_ZOOM_LEVELS) {
      if (zoom === "fit") expect(dayWidthFor(zoom)).toBeNull();
      else expect(dayWidthFor(zoom)).toBeGreaterThan(0);
    }
  });
});
