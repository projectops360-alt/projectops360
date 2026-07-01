import { describe, it, expect } from "vitest";
import {
  isValidDensity,
  nextDensity,
  defaultColumnWidth,
  resolveColumnWidth,
  COMFORTABLE_COLUMN_WIDTH,
  COMPACT_COLUMN_WIDTH,
} from "../density";

// ============================================================================
// UX-013 — Workboard compact density must fit more columns without browser zoom.
// ============================================================================

describe("UX-013 — workboard density", () => {
  it("compact columns are narrower than comfortable (so more fit on screen)", () => {
    expect(COMPACT_COLUMN_WIDTH).toBeLessThan(COMFORTABLE_COLUMN_WIDTH);
    expect(defaultColumnWidth("compact")).toBe(COMPACT_COLUMN_WIDTH);
    expect(defaultColumnWidth("comfortable")).toBe(COMFORTABLE_COLUMN_WIDTH);
  });

  it("compact fits meaningfully more columns in a laptop viewport (~1366px)", () => {
    const viewport = 1366;
    const comfy = Math.floor(viewport / (COMFORTABLE_COLUMN_WIDTH + 16));
    const compact = Math.floor(viewport / (COMPACT_COLUMN_WIDTH + 8));
    expect(compact).toBeGreaterThan(comfy);
  });

  it("toggles between the two densities", () => {
    expect(nextDensity("comfortable")).toBe("compact");
    expect(nextDensity("compact")).toBe("comfortable");
  });

  it("a user-set custom width always wins over the density default", () => {
    expect(resolveColumnWidth("compact", 340)).toBe(340);
    expect(resolveColumnWidth("comfortable", 250)).toBe(250);
  });

  it("falls back to the density default when no custom width is set", () => {
    expect(resolveColumnWidth("compact", null)).toBe(COMPACT_COLUMN_WIDTH);
    expect(resolveColumnWidth("comfortable")).toBe(COMFORTABLE_COLUMN_WIDTH);
  });

  it("validates persisted density values (back-compat guard)", () => {
    expect(isValidDensity("comfortable")).toBe(true);
    expect(isValidDensity("compact")).toBe(true);
    expect(isValidDensity(undefined)).toBe(false);
    expect(isValidDensity("cozy")).toBe(false);
    expect(isValidDensity(null)).toBe(false);
  });
});
