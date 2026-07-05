import { describe, it, expect } from "vitest";
import {
  DAY_MS, pxPerDay, createTimeScale, generateTicks, applyLabelCollision, startOfWeek,
} from "../time-axis";

const BASE = new Date("2026-05-01T00:00:00Z").getTime();

describe("pxPerDay", () => {
  it("is wider for short windows", () => {
    expect(pxPerDay(7)).toBe(120);
    expect(pxPerDay(14)).toBe(80);
    expect(pxPerDay(30)).toBe(46);
  });
});

describe("createTimeScale — proportionality (adjustment 3)", () => {
  it("two commits N days apart are at exactly N × pxPerDay", () => {
    for (const windowDays of [7, 14, 30]) {
      const ppd = pxPerDay(windowDays);
      const domainStart = BASE;
      const domainEnd = BASE + windowDays * DAY_MS;
      // range width chosen so 1 day == pxPerDay px
      const scale = createTimeScale(domainStart, domainEnd, 0, windowDays * ppd);
      for (const N of [1, 3, 10]) {
        if (N > windowDays) continue;
        const a = BASE + 2 * DAY_MS;
        const b = a + N * DAY_MS;
        expect(scale(b) - scale(a)).toBeCloseTo(N * ppd, 6);
      }
    }
  });

  it("maps domain edges to range edges", () => {
    const scale = createTimeScale(BASE, BASE + 30 * DAY_MS, 100, 1480);
    expect(scale(BASE)).toBeCloseTo(100, 6);
    expect(scale(BASE + 30 * DAY_MS)).toBeCloseTo(1480, 6);
  });
});

describe("generateTicks", () => {
  it("daily ticks for a 7-day window", () => {
    const domainEnd = BASE + 7 * DAY_MS;
    const scale = createTimeScale(BASE, domainEnd, 0, 7 * pxPerDay(7));
    const ticks = generateTicks(BASE, domainEnd, 7, scale, "en");
    expect(ticks.length).toBeGreaterThanOrEqual(7);
    expect(ticks.every((t) => t.major)).toBe(true); // label every day at 7d
  });

  it("weekly ticks for a 30-day window", () => {
    const domainEnd = BASE + 30 * DAY_MS;
    const scale = createTimeScale(BASE, domainEnd, 0, 30 * pxPerDay(30));
    const ticks = generateTicks(BASE, domainEnd, 30, scale, "en");
    // ~5 weekly ticks over 30 days, aligned to week starts
    expect(ticks.length).toBeLessThanOrEqual(7);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(startOfWeek(ticks[0].t)).toBe(ticks[0].t);
  });

  it("labels every 2nd day for a 14-day window", () => {
    const domainEnd = BASE + 14 * DAY_MS;
    const scale = createTimeScale(BASE, domainEnd, 0, 14 * pxPerDay(14));
    const ticks = generateTicks(BASE, domainEnd, 14, scale, "en");
    const majors = ticks.filter((t) => t.major).length;
    const minors = ticks.filter((t) => !t.major).length;
    expect(majors).toBeGreaterThan(0);
    expect(minors).toBeGreaterThan(0); // some unlabeled minor ticks exist
  });
});

describe("applyLabelCollision (adjustment 2)", () => {
  it("drops labels closer than minSpacing so they never overlap", () => {
    // 8 daily major ticks only 10px apart, require 60px spacing
    const scale = createTimeScale(BASE, BASE + 7 * DAY_MS, 0, 70);
    const ticks = generateTicks(BASE, BASE + 7 * DAY_MS, 7, scale, "en");
    const spaced = applyLabelCollision(ticks, 60);
    const kept = spaced.filter((t) => t.showLabel);
    // consecutive kept labels are ≥ 60px apart
    for (let i = 1; i < kept.length; i++) {
      expect(kept[i].x - kept[i - 1].x).toBeGreaterThanOrEqual(60);
    }
    // fewer labels kept than total majors (collisions happened)
    expect(kept.length).toBeLessThan(ticks.filter((t) => t.major).length);
  });

  it("keeps all labels when there is enough room", () => {
    const scale = createTimeScale(BASE, BASE + 7 * DAY_MS, 0, 7 * 120);
    const ticks = generateTicks(BASE, BASE + 7 * DAY_MS, 7, scale, "en");
    const spaced = applyLabelCollision(ticks, 40);
    expect(spaced.filter((t) => t.showLabel).length).toBe(ticks.filter((t) => t.major).length);
  });
});
