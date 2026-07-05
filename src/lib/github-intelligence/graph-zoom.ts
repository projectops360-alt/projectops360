// ============================================================================
// GitHub Living Graph — pure zoom/brush math (no d3)
// ============================================================================
// Framework-free helpers for the ruler brush + wheel/dblclick zoom. Unit-tested.
// ============================================================================

import { HOUR_MS } from "./time-axis";

export interface Domain { start: number; end: number }

/** Minimum brush/zoom selection (below this a selection is ignored). */
export const MIN_SELECTION_MS = 6 * HOUR_MS;

/** Invert a pixel x back to a time in the current domain. */
export function pointerXToTime(px: number, plotLeft: number, plotRight: number, domainStart: number, domainEnd: number): number {
  const w = plotRight - plotLeft || 1;
  const frac = Math.max(0, Math.min(1, (px - plotLeft) / w));
  return domainStart + frac * (domainEnd - domainStart);
}

/** Clamp a domain to [boundsStart, boundsEnd] and enforce a minimum span. */
export function clampDomain(d: Domain, boundsStart: number, boundsEnd: number, minSpanMs = MIN_SELECTION_MS): Domain {
  let start = Math.max(boundsStart, Math.min(d.start, boundsEnd - minSpanMs));
  let end = Math.min(boundsEnd, Math.max(d.end, start + minSpanMs));
  if (end - start < minSpanMs) {
    end = Math.min(boundsEnd, start + minSpanMs);
    start = Math.max(boundsStart, end - minSpanMs);
  }
  return { start, end };
}

/**
 * Zoom a domain around a center time by `factor` (<1 zoom in, >1 zoom out),
 * keeping the center's relative position. Clamped to bounds + min span.
 */
export function zoomAround(d: Domain, centerT: number, factor: number, boundsStart: number, boundsEnd: number, minSpanMs = MIN_SELECTION_MS): Domain {
  const span = d.end - d.start;
  const c = Math.max(d.start, Math.min(d.end, centerT));
  const leftFrac = span > 0 ? (c - d.start) / span : 0.5;
  const newSpan = Math.max(minSpanMs, Math.min(boundsEnd - boundsStart, span * factor));
  const start = c - leftFrac * newSpan;
  return clampDomain({ start, end: start + newSpan }, boundsStart, boundsEnd, minSpanMs);
}

/** Normalize a brush [a,b] (either drag direction) into an ordered selection. */
export function brushToDomain(aT: number, bT: number): Domain {
  return aT <= bT ? { start: aT, end: bT } : { start: bT, end: aT };
}

/** A brush selection is valid only if it spans at least the minimum. */
export function isValidSelection(d: Domain, minSpanMs = MIN_SELECTION_MS): boolean {
  return d.end - d.start >= minSpanMs;
}
