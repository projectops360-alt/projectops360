// ============================================================================
// ProjectOps360° — KPI Calculation Engine · statistical functions (CAP-046 F3)
// ============================================================================
// Pure, deterministic implementations of the KPI function set required by
// PD-019: SUM, AVG, COUNT, MEDIAN, PERCENTILE, CORRELATION, TREND,
// MOVING_AVERAGE, FORECAST. All functions are NaN-tolerant: non-finite values
// are ignored (pairwise for CORRELATION) so sparse canonical data never
// poisons a KPI into NaN silently.
// ============================================================================

function finite(values: readonly number[]): number[] {
  return values.filter((value) => Number.isFinite(value));
}

export function kpiSum(values: readonly number[]): number {
  return finite(values).reduce((sum, value) => sum + value, 0);
}

export function kpiCount(values: readonly number[]): number {
  return finite(values).length;
}

export function kpiAvg(values: readonly number[]): number {
  const usable = finite(values);
  if (usable.length === 0) return NaN;
  return kpiSum(usable) / usable.length;
}

export function kpiMedian(values: readonly number[]): number {
  return kpiPercentile(values, 50);
}

/** Linear-interpolated percentile (0–100), matching percentile_cont semantics. */
export function kpiPercentile(values: readonly number[], p: number): number {
  const usable = finite(values).sort((a, b) => a - b);
  if (usable.length === 0 || !Number.isFinite(p)) return NaN;
  const clamped = Math.min(100, Math.max(0, p));
  const rank = (clamped / 100) * (usable.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return usable[low];
  return usable[low] + (usable[high] - usable[low]) * (rank - low);
}

/** Pearson correlation over pairwise-finite (x, y) pairs; NaN under 2 pairs. */
export function kpiCorrelation(x: readonly number[], y: readonly number[]): number {
  const pairs: Array<[number, number]> = [];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) pairs.push([x[i], y[i]]);
  }
  if (pairs.length < 2) return NaN;
  const meanX = pairs.reduce((s, [a]) => s + a, 0) / pairs.length;
  const meanY = pairs.reduce((s, [, b]) => s + b, 0) / pairs.length;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const [a, b] of pairs) {
    cov += (a - meanX) * (b - meanY);
    varX += (a - meanX) ** 2;
    varY += (b - meanY) ** 2;
  }
  const denom = Math.sqrt(varX * varY);
  return denom === 0 ? NaN : cov / denom;
}

/** Least-squares slope of the series against its index (change per step). */
export function kpiTrend(values: readonly number[]): number {
  const points: Array<[number, number]> = [];
  values.forEach((value, index) => {
    if (Number.isFinite(value)) points.push([index, value]);
  });
  if (points.length < 2) return NaN;
  const meanX = points.reduce((s, [i]) => s + i, 0) / points.length;
  const meanY = points.reduce((s, [, v]) => s + v, 0) / points.length;
  let num = 0;
  let den = 0;
  for (const [i, v] of points) {
    num += (i - meanX) * (v - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? NaN : num / den;
}

/** Trailing moving average of the LAST `window` finite values. */
export function kpiMovingAverage(values: readonly number[], window: number): number {
  const usable = finite(values);
  if (usable.length === 0 || !Number.isFinite(window) || window < 1) return NaN;
  const slice = usable.slice(-Math.floor(window));
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

/** Linear forecast `steps` ahead of the series end (least-squares projection). */
export function kpiForecast(values: readonly number[], steps: number): number {
  const points: Array<[number, number]> = [];
  values.forEach((value, index) => {
    if (Number.isFinite(value)) points.push([index, value]);
  });
  if (points.length < 2 || !Number.isFinite(steps)) return NaN;
  const slope = kpiTrend(values);
  if (!Number.isFinite(slope)) return NaN;
  const meanX = points.reduce((s, [i]) => s + i, 0) / points.length;
  const meanY = points.reduce((s, [, v]) => s + v, 0) / points.length;
  const intercept = meanY - slope * meanX;
  const lastIndex = points[points.length - 1][0];
  return intercept + slope * (lastIndex + Math.max(1, Math.floor(steps)));
}
