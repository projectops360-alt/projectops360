// ============================================================================
// GitHub Living Graph — time axis (pure, no d3)
// ============================================================================
// A minimal linear time scale + tick generation + date formatting, equivalent
// to d3.scaleTime for our needs. Framework-free and unit-tested. Powers the
// scrollable time ruler under the graph.
// ============================================================================

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

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
  // Granularity from the ACTUAL domain span (auto-zoom can be < 3 days → hourly).
  const hourly = span < 3 * DAY_MS;
  const weekly = !hourly && span > 16 * DAY_MS;
  const step = hourly ? 6 * HOUR_MS : weekly ? 7 * DAY_MS : DAY_MS;
  const first = hourly ? startOfHour(domainStart) : weekly ? startOfWeek(domainStart) : startOfDay(domainStart);
  const majorEvery = hourly ? 2 : weekly ? 1 : span <= 8 * DAY_MS ? 1 : 2;

  const ticks: AxisTick[] = [];
  let i = 0;
  for (let t = first; t <= domainEnd + step; t += step, i++) {
    if (t < domainStart - step) continue;
    const major = i % majorEvery === 0;
    ticks.push({
      t,
      x: scale(t),
      major,
      label: major ? (hourly ? formatTickTime(t, locale) : formatTickDate(t, locale)) : "",
      showLabel: major,
    });
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
