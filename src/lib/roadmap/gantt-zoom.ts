// ============================================================================
// Making the schedule's zoom actually zoom
// ============================================================================
// The Gantt had Day / Week / Month buttons and a ZOOM_CONFIG with pixel widths
// per day — and nothing ever read them. Every bar was positioned as a
// PERCENTAGE of a container whose width never changed, so all three buttons
// drew the identical chart. On a project spanning fourteen months and 274
// tasks, that meant everything squeezed into one screen width, unreadable, with
// no way to open it up.
//
// The fix is to give the timeline a real width in pixels: at Day, a day is 32px
// and the chart is 13,000px wide inside a scroller; at Fit, the whole schedule
// is squeezed to exactly the space available, which is the "show me everything"
// the buttons implied but never delivered.
//
// Percentage positioning is kept — it is what makes the bars follow the width
// for free. Only the canvas width changes.
// ============================================================================

export type GanttZoom = "fit" | "quarter" | "month" | "week" | "day";

/** Widest → narrowest. The order the buttons appear in. */
export const GANTT_ZOOM_LEVELS: GanttZoom[] = ["fit", "quarter", "month", "week", "day"];

/**
 * Pixels per calendar day at each level.
 *
 * "fit" has none by definition: its width is whatever the viewport gives.
 * "quarter" is new — at 1.5px/day a two-year programme is ~1,100px, which is
 * the level at which a portfolio-length plan first fits on a laptop without
 * being crushed.
 */
const DAY_WIDTH: Record<Exclude<GanttZoom, "fit">, number> = {
  quarter: 1.5,
  month: 4,
  week: 12,
  day: 32,
};

/** Below this the chart stops being readable, whatever the zoom says. */
export const MIN_TIMELINE_WIDTH = 480;

export function dayWidthFor(zoom: GanttZoom): number | null {
  return zoom === "fit" ? null : DAY_WIDTH[zoom];
}

export interface TimelineWidthArgs {
  /** Calendar days the schedule spans. */
  totalDays: number;
  zoom: GanttZoom;
  /** Pixels available for the timeline once the label column is subtracted. */
  availableWidth: number;
}

/**
 * How wide the timeline canvas should be, in pixels.
 *
 * At "fit" this is exactly the available space — the whole plan on screen, no
 * horizontal scrolling, which is the point of the level. At every other level
 * it is `days × pixels-per-day`, and the parent scrolls.
 *
 * A computed width NARROWER than the viewport is widened back to it: leaving a
 * short project drawn in the left third of an empty canvas looks like a
 * rendering failure, not a short project.
 */
export function ganttTimelineWidth({ totalDays, zoom, availableWidth }: TimelineWidthArgs): number {
  const floor = Math.max(MIN_TIMELINE_WIDTH, Math.floor(availableWidth) || 0);
  if (!Number.isFinite(totalDays) || totalDays <= 0) return floor;

  const perDay = dayWidthFor(zoom);
  if (perDay == null) return floor; // fit

  return Math.max(floor, Math.round(totalDays * perDay));
}

/**
 * The widest zoom whose chart still needs no scrolling.
 *
 * Used to pick a sensible level the first time a project is opened: a two-week
 * sprint opens at Day, a two-year programme opens at Quarter, and neither user
 * has to hunt for the button that makes their plan legible. "fit" is the
 * fallback for a plan so long that even Quarter overflows.
 */
export function defaultZoomFor(totalDays: number, availableWidth: number): GanttZoom {
  if (!Number.isFinite(totalDays) || totalDays <= 0) return "fit";
  // Narrowest first: prefer the most detailed view that still fits.
  for (const zoom of ["day", "week", "month", "quarter"] as const) {
    if (totalDays * DAY_WIDTH[zoom] <= availableWidth) return zoom;
  }
  return "fit";
}

/**
 * Whether there is room to print a label inside a bar of this width.
 *
 * Was previously decided by `zoom !== "month"`, which is a proxy for the real
 * question and gets it wrong both ways: a 90-day task at Month has plenty of
 * room, and a 1-day task at Day has none.
 */
export function fitsLabel(barWidthPx: number, minimum = 44): boolean {
  return barWidthPx >= minimum;
}

/** Month gridlines get crowded on a long plan; thin them out instead. */
export function monthLabelStep(totalDays: number, timelineWidth: number): number {
  const months = Math.max(1, totalDays / 30.44);
  const pxPerMonth = timelineWidth / months;
  if (pxPerMonth >= 64) return 1; // every month
  if (pxPerMonth >= 32) return 3; // quarterly
  if (pxPerMonth >= 16) return 6; // half-yearly
  return 12; // yearly
}
