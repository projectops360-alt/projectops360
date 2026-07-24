// ============================================================================
// CAP-047 M8 — realtime helpers (guard: PMO-PI-REALTIME)
// ============================================================================
// Fails if: refresh fires without a real signature change (render storms),
// error backoff stops being deterministic/capped, or the signature stops
// reflecting both event count and max sequence.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  composeSignature,
  nextPollDelay,
  shouldRefresh,
  PMO_PI_POLL_BASE_MS,
  PMO_PI_POLL_MAX_MS,
} from "../realtime";

describe("shouldRefresh", () => {
  it("refreshes only on a REAL signature change", () => {
    expect(shouldRefresh("10:5", "11:6")).toBe(true);
    expect(shouldRefresh("10:5", "10:5")).toBe(false);
  });

  it("never refreshes on first sight or on errors (null signatures)", () => {
    expect(shouldRefresh(null, "10:5")).toBe(false);
    expect(shouldRefresh("10:5", null)).toBe(false);
    expect(shouldRefresh(null, null)).toBe(false);
  });
});

describe("nextPollDelay", () => {
  it("backs off deterministically and caps at the maximum", () => {
    expect(nextPollDelay(0)).toBe(PMO_PI_POLL_BASE_MS);
    expect(nextPollDelay(1)).toBe(PMO_PI_POLL_BASE_MS * 2);
    expect(nextPollDelay(2)).toBe(PMO_PI_POLL_BASE_MS * 4);
    expect(nextPollDelay(10)).toBe(PMO_PI_POLL_MAX_MS);
    expect(nextPollDelay(-3)).toBe(PMO_PI_POLL_BASE_MS);
  });
});

describe("composeSignature", () => {
  it("captures both count and max sequence — either change is visible", () => {
    expect(composeSignature(10, 55)).toBe("10:55");
    expect(composeSignature(10, 56)).not.toBe(composeSignature(10, 55));
    expect(composeSignature(11, 55)).not.toBe(composeSignature(10, 55));
    expect(composeSignature(0, null)).toBe("0:0");
  });
});
