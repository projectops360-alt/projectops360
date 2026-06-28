import { describe, it, expect } from "vitest";
import {
  resolveIsabellaLayoutState,
  isCompactHeaderRequired,
  isFullHeroVisible,
  UX_001_ISABELLA_WELCOME_HERO,
  type IsabellaLayoutSignals,
} from "../contracts";

// REG-014 / UX-001 — these tests FAIL if the full Welcome Hero would ever be
// shown automatically while a Project Briefing or conversation exists.

function signals(p: Partial<IsabellaLayoutSignals>): IsabellaLayoutSignals {
  return {
    turnCount: 0,
    briefingActive: false,
    pending: false,
    inputLength: 0,
    avatarManuallyExpanded: false,
    ...p,
  };
}

describe("UX-001 — Isabella Welcome Hero Lifecycle (REG-014)", () => {
  it("1. empty conversation shows the full Welcome Hero", () => {
    const s = signals({});
    expect(resolveIsabellaLayoutState(s)).toBe("EMPTY_WELCOME");
    expect(isFullHeroVisible(s)).toBe(true);
    expect(isCompactHeaderRequired(s)).toBe(false);
  });

  it("2. Project Briefing present → compact header only (no full hero)", () => {
    const s = signals({ briefingActive: true });
    expect(resolveIsabellaLayoutState(s)).toBe("ACTIVE_CONTENT");
    expect(isCompactHeaderRequired(s)).toBe(true);
    expect(isFullHeroVisible(s)).toBe(false);
  });

  it("3. user types the first character → hero collapses", () => {
    expect(isFullHeroVisible(signals({ inputLength: 1 }))).toBe(false);
  });

  it("4. quick action / pending request → hero collapses", () => {
    expect(isFullHeroVisible(signals({ pending: true }))).toBe(false);
  });

  it("5. first message sent → hero collapses, content below compact header", () => {
    const s = signals({ turnCount: 1 });
    expect(isCompactHeaderRequired(s)).toBe(true);
    expect(isFullHeroVisible(s)).toBe(false);
  });

  it("6. switching mode during an active conversation does not reappear the hero", () => {
    // Mode is not a layout signal; active content keeps the compact header.
    const s = signals({ turnCount: 2, briefingActive: true });
    expect(isFullHeroVisible(s)).toBe(false);
  });

  it("7. a briefing with zero turns still forces compact (the exact regression)", () => {
    const s = signals({ briefingActive: true, turnCount: 0 });
    expect(isFullHeroVisible(s)).toBe(false);
  });

  it("8. New Conversation / Reset restores the full hero only when everything is empty", () => {
    expect(isFullHeroVisible(signals({}))).toBe(true);
    // …but not if a briefing is still active.
    expect(isFullHeroVisible(signals({ briefingActive: true }))).toBe(false);
  });

  it("9. manual re-expand (UX-004) is the ONLY way the hero returns during active content", () => {
    const s = signals({ turnCount: 3, avatarManuallyExpanded: true });
    expect(isFullHeroVisible(s)).toBe(true); // user-initiated, allowed
    expect(isCompactHeaderRequired(s)).toBe(false);
  });

  it("contract is approved and bound to REG-014", () => {
    expect(UX_001_ISABELLA_WELCOME_HERO.status).toBe("APPROVED");
    expect(UX_001_ISABELLA_WELCOME_HERO.regression).toBe("REG-014");
    expect(UX_001_ISABELLA_WELCOME_HERO.rules.length).toBeGreaterThan(5);
  });
});
