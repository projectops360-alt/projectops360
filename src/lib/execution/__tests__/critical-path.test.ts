import { describe, it, expect } from "vitest";
import { calculateCriticalPath, getDownstreamTaskIds } from "../critical-path";

type Task = Parameters<typeof calculateCriticalPath>[0][number];
type Dep = Parameters<typeof calculateCriticalPath>[1][number];

function task(id: string, durationDays: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    start_date: null,
    end_date: null,
    duration_days: durationDays,
    estimate_hours: null,
    status: "not_started",
    ...overrides,
  };
}

function fs(pred: string, succ: string, lag = 0): Dep {
  return { predecessor_id: pred, successor_id: succ, dependency_type: "finish_to_start", lag_days: lag };
}

describe("calculateCriticalPath", () => {
  it("computes a simple chain as fully critical", () => {
    const result = calculateCriticalPath(
      [task("a", 3), task("b", 2), task("c", 5)],
      [fs("a", "b"), fs("b", "c")],
      [],
      "2026-01-05",
    );

    expect(result.criticalTaskIds).toEqual(["a", "b", "c"]);
    expect(result.projectDurationDays).toBe(10);
    expect(result.tasks.get("a")!.earliestStart).toBe(0);
    expect(result.tasks.get("b")!.earliestStart).toBe(3);
    expect(result.tasks.get("c")!.earliestStart).toBe(5);
    expect(result.projectEarliestFinishDate).toBe("2026-01-15");
  });

  it("gives float to the shorter parallel branch", () => {
    // a → b(10) → d ; a → c(4) → d : branch c has 6 days float
    const result = calculateCriticalPath(
      [task("a", 1), task("b", 10), task("c", 4), task("d", 2)],
      [fs("a", "b"), fs("a", "c"), fs("b", "d"), fs("c", "d")],
      [],
      "2026-01-05",
    );

    expect(result.criticalTaskIds).toContain("b");
    expect(result.criticalTaskIds).not.toContain("c");
    expect(result.tasks.get("c")!.totalFloat).toBe(6);
    expect(result.tasks.get("b")!.totalFloat).toBe(0);
  });

  it("applies positive lag on finish_to_start", () => {
    const result = calculateCriticalPath(
      [task("a", 2), task("b", 2)],
      [fs("a", "b", 3)],
      [],
      "2026-01-05",
    );
    expect(result.tasks.get("b")!.earliestStart).toBe(5); // 2 + 3 lag
    expect(result.projectDurationDays).toBe(7);
  });

  it("handles start_to_start dependencies", () => {
    const result = calculateCriticalPath(
      [task("a", 10), task("b", 2)],
      [{ predecessor_id: "a", successor_id: "b", dependency_type: "start_to_start", lag_days: 2 }],
      [],
      "2026-01-05",
    );
    expect(result.tasks.get("b")!.earliestStart).toBe(2);
    // b finishes day 4, project finish driven by a (day 10); b floats
    expect(result.tasks.get("b")!.totalFloat).toBeGreaterThan(0);
  });

  it("handles finish_to_finish dependencies", () => {
    const result = calculateCriticalPath(
      [task("a", 8), task("b", 3)],
      [{ predecessor_id: "a", successor_id: "b", dependency_type: "finish_to_finish", lag_days: 0 }],
      [],
      "2026-01-05",
    );
    // b must finish no earlier than a's finish (day 8) → ES = 5
    expect(result.tasks.get("b")!.earliestStart).toBe(5);
    expect(result.tasks.get("b")!.earliestFinish).toBe(8);
  });

  it("pushes a task with an external material constraint", () => {
    const result = calculateCriticalPath(
      [task("a", 2), task("b", 3)],
      [fs("a", "b")],
      [{ taskId: "b", notBeforeDate: "2026-01-20", reason: "material", sourceEntityId: "mat-1" }],
      "2026-01-05",
    );
    // b would start day 2 (Jan 7) but the HVAC unit arrives Jan 20 → day 15
    expect(result.tasks.get("b")!.earliestStart).toBe(15);
    expect(result.tasks.get("b")!.activeConstraints).toHaveLength(1);
    expect(result.tasks.get("b")!.activeConstraints[0].reason).toBe("material");
    expect(result.projectEarliestFinishDate).toBe("2026-01-23");
  });

  it("respects explicit planned start dates as start-no-earlier-than", () => {
    const result = calculateCriticalPath(
      [task("a", 2), task("b", 2, { start_date: "2026-01-12" })],
      [fs("a", "b")],
      [],
      "2026-01-05",
    );
    expect(result.tasks.get("b")!.earliestStart).toBe(7);
  });

  it("isolates dependency cycles without crashing", () => {
    const result = calculateCriticalPath(
      [task("a", 2), task("b", 2), task("c", 2)],
      [fs("a", "b"), fs("b", "a")],
      [],
      "2026-01-05",
    );
    expect(result.cycleTaskIds.sort()).toEqual(["a", "b"]);
    expect(result.tasks.has("c")).toBe(true);
    expect(result.tasks.has("a")).toBe(false);
  });

  it("derives duration from dates, then hours, then defaults to 1", () => {
    const result = calculateCriticalPath(
      [
        task("dated", 0, { duration_days: null, start_date: "2026-01-05", end_date: "2026-01-09" }),
        task("hours", 0, { duration_days: null, estimate_hours: 20 }),
        task("bare", 0, { duration_days: null }),
      ],
      [],
      [],
      "2026-01-05",
    );
    expect(result.tasks.get("dated")!.durationDays).toBe(5);
    expect(result.tasks.get("hours")!.durationDays).toBe(3); // ceil(20/8)
    expect(result.tasks.get("bare")!.durationDays).toBe(1);
  });

  it("flags near-critical tasks", () => {
    const result = calculateCriticalPath(
      [task("a", 1), task("b", 10), task("c", 8), task("d", 1)],
      [fs("a", "b"), fs("a", "c"), fs("b", "d"), fs("c", "d")],
      [],
      "2026-01-05",
    );
    expect(result.tasks.get("c")!.totalFloat).toBe(2);
    expect(result.tasks.get("c")!.isNearCritical).toBe(true);
    expect(result.tasks.get("c")!.isCritical).toBe(false);
  });
});

describe("getDownstreamTaskIds", () => {
  it("returns all transitive successors", () => {
    const deps = [fs("a", "b"), fs("b", "c"), fs("b", "d"), fs("x", "y")];
    const downstream = getDownstreamTaskIds("a", deps);
    expect([...downstream].sort()).toEqual(["b", "c", "d"]);
  });

  it("returns empty for a leaf task", () => {
    expect(getDownstreamTaskIds("c", [fs("a", "b"), fs("b", "c")]).size).toBe(0);
  });
});
