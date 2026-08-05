// ============================================================================
// Import progress — telling "working" from "hung"
// ============================================================================
// Guard: IMPORT-PROGRESS-VISIBILITY
//
// A healthy 262-second import that wrote all 274 tasks, 155 dependencies and
// its complete 291-node graph was cancelled by the user, because a spinner
// looks exactly the same whether the import is working or dead.
//
// Two properties matter. Progress must be written OFTEN ENOUGH to look alive
// but RARELY ENOUGH not to add a database write per row — that per-row cost is
// what makes a large import slow in the first place. And a stalled import must
// be recognisable, since a function killed by a timeout never gets to record
// its own failure.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  shouldWriteProgress,
  formatPhaseProgress,
  isProgressStalled,
  IMPORT_PHASES,
  PROGRESS_WRITE_INTERVAL_MS,
  PROGRESS_STALL_MS,
  type ImportProgress,
} from "../progress";

describe("shouldWriteProgress", () => {
  it("always reports the first row, so a phase never sits at 0", () => {
    expect(shouldWriteProgress(1, 274, 10_000, 10_000)).toBe(true);
  });

  it("always reports the last row, so a phase never stops short of its total", () => {
    expect(shouldWriteProgress(274, 274, 10_000, 10_000)).toBe(true);
  });

  it("throttles the rows in between", () => {
    const lastWrite = 10_000;
    // One write per row is the very cost that makes a large import slow.
    expect(shouldWriteProgress(150, 274, lastWrite, lastWrite + 100)).toBe(false);
    expect(shouldWriteProgress(150, 274, lastWrite, lastWrite + PROGRESS_WRITE_INTERVAL_MS)).toBe(true);
  });

  it("still moves for a phase with no known total", () => {
    expect(shouldWriteProgress(5, 0, 0, PROGRESS_WRITE_INTERVAL_MS)).toBe(true);
    expect(shouldWriteProgress(5, 0, 10_000, 10_100)).toBe(false);
  });

  it("writes a bounded number of times across a large phase", () => {
    // 274 rows at ~0.5s each ≈ 137s: tens of writes, not hundreds.
    let lastWrite = 0;
    let writes = 0;
    for (let done = 1; done <= 274; done++) {
      const now = done * 500;
      if (shouldWriteProgress(done, 274, lastWrite, now)) {
        writes++;
        lastWrite = now;
      }
    }
    expect(writes).toBeLessThan(120);
    expect(writes).toBeGreaterThan(5);
  });
});

describe("formatPhaseProgress", () => {
  it("shows done/total when the total is known", () => {
    expect(formatPhaseProgress(150, 274)).toBe("150/274");
  });

  it("shows just the count when it is not", () => {
    expect(formatPhaseProgress(7, 0)).toBe("7");
  });
});

describe("isProgressStalled", () => {
  const NOW = Date.parse("2026-08-05T17:00:00Z");
  const progressAt = (msAgo: number): ImportProgress => ({
    phase: "tasks",
    done: 150,
    total: 274,
    completed: [],
    updatedAt: new Date(NOW - msAgo).toISOString(),
  });

  it("does not cry wolf on an import that is still moving", () => {
    expect(isProgressStalled(progressAt(2_000), NOW)).toBe(false);
    expect(isProgressStalled(progressAt(PROGRESS_STALL_MS - 1), NOW)).toBe(false);
  });

  it("flags one that has stopped reporting", () => {
    // A timeout kills the process, so nothing else will ever mark it failed.
    expect(isProgressStalled(progressAt(PROGRESS_STALL_MS + 1), NOW)).toBe(true);
  });

  it("says nothing before the first report", () => {
    expect(isProgressStalled(null, NOW)).toBe(false);
  });

  it("does not flag on an unreadable timestamp", () => {
    expect(isProgressStalled({ ...progressAt(0), updatedAt: "nonsense" }, NOW)).toBe(false);
  });
});

describe("IMPORT_PHASES", () => {
  it("lists the write order, data before derived projections", () => {
    const order = [...IMPORT_PHASES];
    expect(order.indexOf("tasks")).toBeLessThan(order.indexOf("graph"));
    expect(order.indexOf("dependencies")).toBeLessThan(order.indexOf("critical_path"));
    expect(order[0]).toBe("project");
    expect(new Set(order).size).toBe(order.length);
  });
});
