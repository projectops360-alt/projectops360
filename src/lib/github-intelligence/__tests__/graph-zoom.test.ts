import { describe, it, expect } from "vitest";
import { pointerXToTime, clampDomain, zoomAround, brushToDomain, isValidSelection, MIN_SELECTION_MS } from "../graph-zoom";

const T0 = Date.parse("2026-06-01T00:00:00Z");
const T10 = T0 + 10 * 86_400_000;

describe("pointerXToTime", () => {
  it("inverts x → time linearly", () => {
    expect(pointerXToTime(0, 0, 100, T0, T10)).toBe(T0);
    expect(pointerXToTime(100, 0, 100, T0, T10)).toBe(T10);
    expect(pointerXToTime(50, 0, 100, T0, T10)).toBe(T0 + 5 * 86_400_000);
  });
});

describe("zoomAround", () => {
  it("zooms IN (factor<1) keeping the center's relative position", () => {
    const d = { start: T0, end: T10 };
    const center = T0 + 5 * 86_400_000;
    const z = zoomAround(d, center, 0.5, T0, T10);
    expect(z.end - z.start).toBeCloseTo(5 * 86_400_000, -3); // half span
    // center stays roughly centered
    expect((z.start + z.end) / 2).toBeCloseTo(center, -5);
  });

  it("zooms OUT (factor>1) but clamps to bounds", () => {
    const d = { start: T0 + 3 * 86_400_000, end: T0 + 5 * 86_400_000 };
    const z = zoomAround(d, T0 + 4 * 86_400_000, 100, T0, T10); // huge → clamps to full
    expect(z.start).toBeGreaterThanOrEqual(T0);
    expect(z.end).toBeLessThanOrEqual(T10);
  });

  it("never goes below the minimum span", () => {
    const d = { start: T0, end: T10 };
    const z = zoomAround(d, T0, 0.0000001, T0, T10);
    expect(z.end - z.start).toBeGreaterThanOrEqual(MIN_SELECTION_MS);
  });
});

describe("clampDomain", () => {
  it("clamps to bounds and enforces min span", () => {
    const c = clampDomain({ start: T0 - 999, end: T10 + 999 }, T0, T10);
    expect(c.start).toBe(T0);
    expect(c.end).toBe(T10);
    const tiny = clampDomain({ start: T0, end: T0 + 1000 }, T0, T10);
    expect(tiny.end - tiny.start).toBeGreaterThanOrEqual(MIN_SELECTION_MS);
  });
});

describe("brush helpers", () => {
  it("orders a brush regardless of drag direction", () => {
    expect(brushToDomain(T10, T0)).toEqual({ start: T0, end: T10 });
  });
  it("rejects selections under the minimum", () => {
    expect(isValidSelection({ start: T0, end: T0 + 60_000 })).toBe(false);
    expect(isValidSelection({ start: T0, end: T0 + MIN_SELECTION_MS })).toBe(true);
  });
});
