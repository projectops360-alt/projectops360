// ============================================================================
// SPI and CPI — and the refusals that make them trustworthy
// ============================================================================
// Guard: EARNED-VALUE-SPI-CPI
//
// These two ratios get quoted to steering committees, so the failure mode is
// not "slightly wrong" — it is "confidently wrong in the reassuring
// direction". Every case below where the honest answer is "no answer" would,
// if computed naïvely, produce exactly 1.00 or +∞:
//
//   PV = 0  →  EV/PV would be ∞, or 1.00 if someone "helpfully" defaults it,
//              for a project that has not started
//   AC = 0  →  EV/AC would be ∞: infinite cost efficiency, having spent nothing
//   no baseline → there is nothing to be behind, but "1.00 on schedule" is
//              what a naïve implementation prints
//
// The other property under test: EV is valued at the BASELINE budget. Letting a
// task's re-estimate enlarge its own budget is how a project reports being on
// plan while the plan quietly moves.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  taskBac,
  plannedFraction,
  earnedFraction,
  taskEarnedValue,
  sumEarnedValue,
  scheduleIndex,
  costIndex,
  scheduleVarianceHours,
  costVariance,
  estimateAtCompletion,
  varianceAtCompletion,
  indexTone,
  type EvmTaskInput,
} from "../earned-value";

const RATES = new Map([["r1", 100]]);
const MID = new Date("2026-06-15T00:00:00Z");

function task(over: Partial<EvmTaskInput> = {}): EvmTaskInput {
  return {
    baseline_start_date: "2026-06-01",
    baseline_end_date: "2026-06-30",
    baseline_estimate_hours: 100,
    estimate_hours: 100,
    actual_hours: null,
    progress: null,
    status: "not_started",
    assigned_resource_id: "r1",
    ...over,
  };
}

describe("the budget a task is judged against", () => {
  it("uses the BASELINE estimate, not today's", () => {
    // Re-estimating upward mid-flight must not enlarge the budget being
    // measured against, or a slipping project reports itself on plan.
    expect(taskBac(task({ baseline_estimate_hours: 100, estimate_hours: 400 }))).toBe(100);
  });

  it("falls back to the current estimate when no baseline was captured", () => {
    expect(taskBac(task({ baseline_estimate_hours: null, estimate_hours: 40 }))).toBe(40);
  });

  it("is zero when there is no estimate at all", () => {
    expect(taskBac(task({ baseline_estimate_hours: null, estimate_hours: null }))).toBe(0);
  });
});

describe("what the plan said should be done by now", () => {
  it("is nothing before the baseline start", () => {
    expect(plannedFraction(task(), new Date("2026-05-01"))).toBe(0);
  });

  it("is everything after the baseline end", () => {
    expect(plannedFraction(task(), new Date("2026-08-01"))).toBe(1);
  });

  it("runs straight-line through the window", () => {
    // 1–30 June, asked on the 15th: 14 of 29 days.
    const f = plannedFraction(task(), MID)!;
    expect(f).toBeGreaterThan(0.45);
    expect(f).toBeLessThan(0.52);
  });

  it("has NO value when the task was never baselined", () => {
    // Not 0 — zero would mean "nothing was due", which reads as being ahead.
    expect(plannedFraction(task({ baseline_start_date: null }), MID)).toBeNull();
    expect(plannedFraction(task({ baseline_end_date: null }), MID)).toBeNull();
  });
});

describe("what is actually done", () => {
  it("counts a finished task in full, whatever its progress field says", () => {
    // A task marked done with progress left at 0 is a data-entry gap, not work
    // that never happened.
    expect(earnedFraction(task({ status: "done", progress: 0 }))).toBe(1);
    expect(earnedFraction(task({ status: "tested", progress: null }))).toBe(1);
  });

  it("reads partial progress", () => {
    expect(earnedFraction(task({ progress: 40 }))).toBe(0.4);
  });

  it("never exceeds 100%", () => {
    expect(earnedFraction(task({ progress: 150 }))).toBe(1);
  });

  it("is zero for work not begun", () => {
    expect(earnedFraction(task())).toBe(0);
  });
});

describe("SPI — are we on schedule", () => {
  it("reports 1.00 when exactly as much is done as was planned", () => {
    const t = task({ progress: 50 });
    const totals = sumEarnedValue([t], new Date("2026-06-16T00:00:00Z"), RATES);
    const spi = scheduleIndex(totals);
    expect(spi.status).toBe("ok");
    if (spi.status === "ok") expect(spi.value).toBeCloseTo(1, 1);
  });

  it("drops below 1 when the work is behind", () => {
    const totals = sumEarnedValue([task({ progress: 10 })], MID, RATES);
    const spi = scheduleIndex(totals);
    expect(spi.status === "ok" && spi.value).toBeLessThan(0.5);
  });

  it("rises above 1 when the work is ahead", () => {
    const totals = sumEarnedValue([task({ status: "done" })], MID, RATES);
    expect(scheduleIndex(totals).status === "ok").toBe(true);
    const spi = scheduleIndex(totals);
    if (spi.status === "ok") expect(spi.value).toBeGreaterThan(1.9);
  });

  it("needs NO cost rate — hours are enough", () => {
    // The whole reason the schedule side is in hours: a project that never
    // entered a rate still gets a real schedule index.
    const totals = sumEarnedValue([task({ progress: 50 })], MID, new Map());
    expect(scheduleIndex(totals).status).toBe("ok");
  });

  it("refuses when nothing was ever baselined", () => {
    const totals = sumEarnedValue([task({ baseline_start_date: null, baseline_end_date: null })], MID, RATES);
    expect(scheduleIndex(totals)).toEqual({ status: "unavailable", reason: "no_baseline" });
  });

  it("refuses BEFORE the plan starts, rather than reporting a perfect 1.00", () => {
    // A project that has not begun is not "on schedule" — it is unjudgeable.
    const totals = sumEarnedValue([task()], new Date("2026-01-01"), RATES);
    expect(scheduleIndex(totals)).toEqual({ status: "unavailable", reason: "not_started" });
  });

  it("counts only baselined tasks in the denominator", () => {
    const totals = sumEarnedValue(
      [task({ progress: 50 }), task({ baseline_start_date: null, baseline_end_date: null })],
      MID,
      RATES,
    );
    expect(totals.baselinedTasks).toBe(1);
    expect(totals.totalTasks).toBe(2);
  });
});

describe("CPI — are we on budget", () => {
  it("reports 1.00 when a unit of value costs a unit of budget", () => {
    // 100h budget, done, 100h logged at the same rate.
    const totals = sumEarnedValue([task({ status: "done", actual_hours: 100 })], MID, RATES);
    const cpi = costIndex(totals);
    expect(cpi.status === "ok" && cpi.value).toBe(1);
  });

  it("drops below 1 when the work cost more than it earned", () => {
    const totals = sumEarnedValue([task({ status: "done", actual_hours: 200 })], MID, RATES);
    const cpi = costIndex(totals);
    expect(cpi.status === "ok" && cpi.value).toBe(0.5);
  });

  it("refuses when nothing has been spent, rather than reporting infinity", () => {
    const totals = sumEarnedValue([task({ progress: 50, actual_hours: 0 })], MID, RATES);
    expect(costIndex(totals)).toEqual({ status: "unavailable", reason: "nothing_spent" });
  });

  it("refuses when no resource has a rate", () => {
    // Aurora's state until rates were entered: hours everywhere, money nowhere.
    const totals = sumEarnedValue([task({ actual_hours: 50, progress: 50 })], MID, new Map());
    expect(costIndex(totals)).toEqual({ status: "unavailable", reason: "no_rates" });
  });

  it("never counts unspent money as cost", () => {
    // AC is what was SPENT. A task with an estimate and no logged hours has
    // cost nothing, however large its estimate.
    const v = taskEarnedValue(task({ estimate_hours: 999, actual_hours: null }), MID, RATES);
    expect(v.actualCost).toBe(0);
  });
});

describe("variances", () => {
  it("reports a negative schedule variance when behind", () => {
    const totals = sumEarnedValue([task({ progress: 10 })], MID, RATES);
    expect(scheduleVarianceHours(totals)!).toBeLessThan(0);
  });

  it("reports a negative cost variance when overspent", () => {
    const totals = sumEarnedValue([task({ status: "done", actual_hours: 200 })], MID, RATES);
    expect(costVariance(totals)).toBe(-10000); // 100h earned − 200h spent, at 100
  });

  it("has no variance to report without a baseline or without rates", () => {
    const noBase = sumEarnedValue([task({ baseline_start_date: null, baseline_end_date: null })], MID, RATES);
    expect(scheduleVarianceHours(noBase)).toBeNull();
    const noRate = sumEarnedValue([task()], MID, new Map());
    expect(costVariance(noRate)).toBeNull();
  });
});

describe("forecast", () => {
  it("projects the final cost from the efficiency shown so far", () => {
    // Half done, but it took the whole budget to get there: CPI 0.5, so the
    // full job is forecast at twice its budget.
    const totals = sumEarnedValue([task({ progress: 50, actual_hours: 100 })], MID, RATES);
    expect(estimateAtCompletion(totals)).toBe(20000); // BAC 10,000 / CPI 0.5
    expect(varianceAtCompletion(totals)).toBe(-10000);
  });

  it("forecasts nothing when CPI is unavailable", () => {
    const totals = sumEarnedValue([task()], MID, new Map());
    expect(estimateAtCompletion(totals)).toBeNull();
    expect(varianceAtCompletion(totals)).toBeNull();
  });
});

describe("how an index reads", () => {
  it("is good at or above plan, and bad well below it", () => {
    expect(indexTone(1.05)).toBe("good");
    expect(indexTone(1)).toBe("good");
    expect(indexTone(0.95)).toBe("warn");
    expect(indexTone(0.7)).toBe("danger");
  });
});

describe("a half-baselined project", () => {
  it("sums the half it knows instead of counting the rest as zero", () => {
    // Counting an unbaselined task's PV as 0 would inflate SPI: the project
    // would look ahead of a plan it never had.
    const totals = sumEarnedValue(
      [task({ progress: 50 }), task({ baseline_start_date: null, baseline_end_date: null, progress: 0 })],
      MID,
      RATES,
    );
    const spi = scheduleIndex(totals);
    // EV counts both (0.5×100 + 0), PV counts only the baselined one.
    expect(spi.status).toBe("ok");
    if (spi.status === "ok") expect(spi.value).toBeCloseTo(1, 1);
  });
});
