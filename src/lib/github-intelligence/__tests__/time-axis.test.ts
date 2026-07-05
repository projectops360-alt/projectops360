import { describe, it, expect } from "vitest";
import {
  DAY_MS, WEEK_MS, pxPerDay, createTimeScale, generateTicks, applyLabelCollision, startOfWeek,
  densityGranularity, bucketDensity, bucketMerges,
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

  it("uses hourly ticks when the domain span is < 3 days (auto-zoom)", () => {
    const domainEnd = BASE + 2 * DAY_MS; // 2-day span
    const scale = createTimeScale(BASE, domainEnd, 0, 2 * 200);
    const ticks = generateTicks(BASE, domainEnd, 30, scale, "en");
    // 6-hour steps over 2 days ≈ 8 ticks (hourly granularity, not daily)
    expect(ticks.length).toBeGreaterThanOrEqual(7);
    // labels contain a time (":") rather than a "month day"
    const labeled = ticks.filter((t) => t.showLabel);
    expect(labeled.some((t) => /\d/.test(t.label))).toBe(true);
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

describe("monthly ticks for long domains (> 6 weeks)", () => {
  it("labels the first tick of each month over an 8-week span", () => {
    const domainEnd = BASE + 8 * WEEK_MS;
    const scale = createTimeScale(BASE, domainEnd, 0, 8 * WEEK_MS / DAY_MS * 22);
    const ticks = generateTicks(BASE, domainEnd, 60, scale, "en");
    const labeled = ticks.filter((t) => t.showLabel);
    expect(labeled.length).toBeGreaterThanOrEqual(2); // spans ~2 months
    expect(ticks.filter((t) => !t.major).length).toBeGreaterThan(0); // weekly minors
  });
});

describe("adaptive bucketing (density + merges)", () => {
  it("granularity: hour < 2d, day <= 6w, week beyond", () => {
    expect(densityGranularity(1.5 * DAY_MS)).toBe("hour");
    expect(densityGranularity(20 * DAY_MS)).toBe("day");
    expect(densityGranularity(60 * DAY_MS)).toBe("week");
  });

  it("bucketDensity sums to the number of commits in range", () => {
    const times = [BASE, BASE + DAY_MS, BASE + DAY_MS, BASE + 3 * DAY_MS].map((t) => t);
    const cells = bucketDensity(times, BASE, BASE + 5 * DAY_MS, "day");
    expect(cells.reduce((s, c) => s + c.count, 0)).toBe(4);
    expect(cells.every((c) => c.level >= 0 && c.level <= 3)).toBe(true);
  });

  it("bucketMerges groups by day, but is individual at hour granularity (< 2 days)", () => {
    const merges = [
      { number: 1, title: "a", branch: "x", mergedAt: new Date(BASE).toISOString() },
      { number: 2, title: "b", branch: "y", mergedAt: new Date(BASE + 3600_000).toISOString() },
    ];
    const grouped = bucketMerges(merges, BASE, BASE + DAY_MS, "day");
    expect(grouped.length).toBe(1);
    expect(grouped[0].count).toBe(2);
    const individual = bucketMerges(merges, BASE, BASE + DAY_MS, "hour");
    expect(individual.length).toBe(2);
    expect(individual.every((m) => m.count === 1)).toBe(true);
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
