// ============================================================================
// GitHub Living Graph — time axis (pure, no d3)
// ============================================================================
// A minimal linear time scale + tick generation + date formatting, equivalent
// to d3.scaleTime for our needs. Framework-free and unit-tested. Powers the
// scrollable time ruler under the graph.
// ============================================================================

import type { DensityCell, DailyMerge, MergeItem } from "./types";

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const WEEK_MS = 7 * DAY_MS;

export type Granularity = "hour" | "day" | "week" | "month";

/** Horizontal pixels per day for each selected window. Wider for short ranges. */
export function pxPerDay(windowDays: number): number {
  if (windowDays <= 7) return 120;
  if (windowDays <= 14) return 80;
  return 46;
}

export interface TimeScale {
  (dateMs: number): number;
  readonly domainStart: number;
  readonly domainEnd: number;
  readonly rangeStart: number;
  readonly rangeEnd: number;
}

/** Linear time→pixel scale. [domainStart,domainEnd] ms → [rangeStart,rangeEnd] px. */
export function createTimeScale(
  domainStart: number,
  domainEnd: number,
  rangeStart: number,
  rangeEnd: number,
): TimeScale {
  const dSpan = domainEnd - domainStart || 1;
  const rSpan = rangeEnd - rangeStart;
  const fn = ((ms: number) => rangeStart + ((ms - domainStart) / dSpan) * rSpan) as {
    (ms: number): number;
    domainStart: number; domainEnd: number; rangeStart: number; rangeEnd: number;
  };
  fn.domainStart = domainStart;
  fn.domainEnd = domainEnd;
  fn.rangeStart = rangeStart;
  fn.rangeEnd = rangeEnd;
  return fn as TimeScale;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfHour(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

export function formatTickTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es" : "en", { hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

export function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
export function formatMonth(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es" : "en", { month: "short" }).format(new Date(ms));
}

// ── Adaptive bucketing (density + merges rebucket by the current zoom) ─────────

/** Density bucket granularity for a domain span. */
export function densityGranularity(spanMs: number): Granularity {
  if (spanMs < 2 * DAY_MS) return "hour";
  if (spanMs <= 6 * WEEK_MS) return "day";
  return "week";
}
export function bucketStart(ms: number, g: Granularity): number {
  return g === "hour" ? startOfHour(ms) : g === "week" ? startOfWeek(ms) : g === "month" ? startOfMonth(ms) : startOfDay(ms);
}
function bucketNext(ms: number, g: Granularity): number {
  if (g === "hour") return ms + HOUR_MS;
  if (g === "week") return ms + WEEK_MS;
  if (g === "month") { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); }
  return ms + DAY_MS;
}

/** Bucket raw commit times into density cells over [domainStart, domainEnd]. */
export function bucketDensity(times: number[], domainStart: number, domainEnd: number, g: Granularity): DensityCell[] {
  const counts = new Map<number, number>();
  for (const t of times) {
    if (t < domainStart || t > domainEnd) continue;
    const k = bucketStart(t, g);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let max = 0;
  for (const c of counts.values()) max = Math.max(max, c);
  const cells: DensityCell[] = [];
  for (let s = bucketStart(domainStart, g); s <= domainEnd; s = bucketNext(s, g)) {
    const count = counts.get(s) ?? 0;
    const level: DensityCell["level"] = count === 0 ? 0 : max <= 0 ? 1 : count <= max / 3 ? 1 : count <= (2 * max) / 3 ? 2 : 3;
    cells.push({ start: new Date(s).toISOString(), end: new Date(bucketNext(s, g)).toISOString(), count, level });
  }
  return cells;
}

/** Group merges by bucket; at hour granularity each PR is its own marker. */
export function bucketMerges(merges: MergeItem[], domainStart: number, domainEnd: number, g: Granularity): DailyMerge[] {
  const inRange = merges.filter((m) => {
    const t = new Date(m.mergedAt).getTime();
    return t >= domainStart && t <= domainEnd;
  });
  if (g === "hour") {
    // individual — no grouping
    return inRange.map((m) => ({ start: m.mergedAt, count: 1, prs: [m] }));
  }
  const groups = new Map<number, DailyMerge>();
  for (const m of inRange) {
    const k = bucketStart(new Date(m.mergedAt).getTime(), g);
    if (!groups.has(k)) groups.set(k, { start: new Date(k).toISOString(), count: 0, prs: [] });
    const grp = groups.get(k)!;
    grp.count += 1;
    grp.prs.push(m);
  }
  return [...groups.values()].map((grp) => ({ ...grp, prs: grp.prs.sort((a, b) => b.mergedAt.localeCompare(a.mergedAt)) }));
}

/** Monday-based start of week. */
export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function formatTickDate(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es" : "en", {
    day: "numeric",
    month: "short",
  }).format(new Date(ms));
}

export interface AxisTick {
  t: number;
  x: number;
  major: boolean;
  label: string;
  showLabel: boolean;
}

/**
 * Generate axis ticks over the domain. Daily minor ticks for ≤14-day windows
 * (labels every 1–2 days), weekly ticks for longer windows.
 */
export function generateTicks(
  domainStart: number,
  domainEnd: number,
  windowDays: number, // retained for API compatibility; granularity uses the span
  scale: TimeScale,
  locale: string,
): AxisTick[] {
  const span = domainEnd - domainStart;
  // Granularity from the ACTUAL domain span (auto-zoom/brush can be very short).
  const monthly = span > 6 * WEEK_MS;
  const hourly = span < 3 * DAY_MS;
  const weekly = !monthly && !hourly && span > 16 * DAY_MS;
  const step = hourly ? 6 * HOUR_MS : weekly || monthly ? WEEK_MS : DAY_MS;
  const first = hourly ? startOfHour(domainStart) : weekly || monthly ? startOfWeek(domainStart) : startOfDay(domainStart);
  const majorEvery = hourly ? 2 : weekly ? 1 : span <= 8 * DAY_MS ? 1 : 2;

  const ticks: AxisTick[] = [];
  let i = 0;
  let lastLabeledMonth = -1;
  for (let t = first; t <= domainEnd + step; t += step, i++) {
    if (t < domainStart - step) continue;
    let major: boolean;
    let label: string;
    if (monthly) {
      // weekly minor ticks; label the first tick of each month (monthly majors)
      const mth = new Date(t).getMonth();
      major = mth !== lastLabeledMonth;
      if (major) lastLabeledMonth = mth;
      label = major ? formatMonth(t, locale) : "";
    } else {
      major = i % majorEvery === 0;
      label = major ? (hourly ? formatTickTime(t, locale) : formatTickDate(t, locale)) : "";
    }
    ticks.push({ t, x: scale(t), major, label, showLabel: major });
  }
  return ticks;
}

/**
 * Adjustment (2): drop overlapping labels at small widths. Keeps a labeled tick
 * only when it is at least `minSpacingPx` to the right of the last kept label,
 * so date labels never collide. Minor (unlabeled) ticks are untouched.
 */
export function applyLabelCollision(ticks: AxisTick[], minSpacingPx: number): AxisTick[] {
  let lastKeptX = -Infinity;
  return ticks.map((tk) => {
    if (!tk.major) return tk;
    if (tk.x - lastKeptX >= minSpacingPx) {
      lastKeptX = tk.x;
      return { ...tk, showLabel: true };
    }
    return { ...tk, showLabel: false };
  });
}
