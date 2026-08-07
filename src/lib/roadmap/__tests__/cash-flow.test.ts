// ============================================================================
// When the money leaves, not just how much
// ============================================================================
// Guard: MONTHLY-CASH-FLOW
//
// A budget total answers "how much" and never "when". A project can be exactly
// on budget and still run out of cash in March.
//
// Two properties carry the weight:
//   1. A month with no spend still APPEARS, with zeros. Dropping empty months
//      compresses the gap and draws a curve implying continuous spending
//      through a pause that really happened.
//   2. A task that cannot be priced or dated is COUNTED as skipped. A cash
//      curve missing a third of the work, presented without saying so, is
//      worse than no curve.
// ============================================================================

import { describe, it, expect } from "vitest";
import { monthlyCashFlow, spreadAcrossMonths, type CashFlowTask } from "../cash-flow";

const RATES = new Map([["r1", 100], ["r2", 200]]);

function task(over: Partial<CashFlowTask> = {}): CashFlowTask {
  return {
    start_date: "2026-01-01",
    end_date: "2026-01-31",
    estimate_hours: 10,
    actual_hours: null,
    assigned_resource_id: "r1",
    status: "not_started",
    ...over,
  };
}

describe("spreading a cost across months", () => {
  it("splits by how many days fall in each month", () => {
    // 20 Jan → 10 Feb: 12 days in January, 10 in February, of 22 total.
    const spread = spreadAcrossMonths(new Date("2026-01-20"), new Date("2026-02-10"), 2200);
    expect(Math.round(spread.get("2026-01")!)).toBe(1200);
    expect(Math.round(spread.get("2026-02")!)).toBe(1000);
  });

  it("always sums back to the whole amount", () => {
    const spread = spreadAcrossMonths(new Date("2026-01-15"), new Date("2026-06-07"), 999);
    const total = [...spread.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(999, 6);
  });

  it("puts a single-day task entirely in its own month", () => {
    const spread = spreadAcrossMonths(new Date("2026-03-10"), new Date("2026-03-10"), 500);
    expect(spread.size).toBe(1);
    expect(spread.get("2026-03")).toBe(500);
  });

  it("tolerates a window given backwards", () => {
    const spread = spreadAcrossMonths(new Date("2026-02-10"), new Date("2026-01-20"), 2200);
    expect(spread.size).toBe(2);
  });

  it("spreads nothing when there is nothing to spread", () => {
    expect(spreadAcrossMonths(new Date("2026-01-01"), new Date("2026-01-31"), 0).size).toBe(0);
  });
});

describe("the monthly curve", () => {
  it("prices hours at the assigned resource's rate", () => {
    const result = monthlyCashFlow([task({ estimate_hours: 10, assigned_resource_id: "r2" })], RATES);
    expect(result.months[0].planned).toBe(2000);
  });

  it("keeps a quiet month in the series, with zeros", () => {
    // Work in January and March, nothing in February. February must appear or
    // the curve implies spending that never stopped.
    const result = monthlyCashFlow(
      [
        task({ start_date: "2026-01-01", end_date: "2026-01-31" }),
        task({ start_date: "2026-03-01", end_date: "2026-03-31" }),
      ],
      RATES,
    );
    expect(result.months.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(result.months[1].planned).toBe(0);
  });

  it("accumulates, because that is how a cash curve is read", () => {
    const result = monthlyCashFlow(
      [
        task({ start_date: "2026-01-01", end_date: "2026-01-31", estimate_hours: 10 }),
        task({ start_date: "2026-02-01", end_date: "2026-02-28", estimate_hours: 20 }),
      ],
      RATES,
    );
    expect(result.months[0].cumulativePlanned).toBe(1000);
    expect(result.months[1].cumulativePlanned).toBe(3000);
  });

  it("names the month the cash squeeze lands in", () => {
    const result = monthlyCashFlow(
      [
        task({ start_date: "2026-01-01", end_date: "2026-01-31", estimate_hours: 10 }),
        task({ start_date: "2026-02-01", end_date: "2026-02-28", estimate_hours: 90 }),
      ],
      RATES,
    );
    expect(result.peakMonth).toBe("2026-02");
    expect(result.peakAmount).toBe(9000);
  });
});

describe("what it admits it left out", () => {
  it("counts a task nobody can price", () => {
    const result = monthlyCashFlow([task({ assigned_resource_id: null })], RATES);
    expect(result.skippedUnpriced).toBe(1);
    expect(result.months).toEqual([]);
  });

  it("counts a task with no dates", () => {
    const result = monthlyCashFlow([task({ start_date: null, end_date: null })], RATES);
    expect(result.skippedUndated).toBe(1);
  });

  it("does not count a task that has no cost to place anywhere", () => {
    const result = monthlyCashFlow(
      [task({ assigned_resource_id: null, estimate_hours: 0, actual_hours: 0 })],
      RATES,
    );
    expect(result.skippedUnpriced).toBe(0);
  });
});

describe("baseline vs current — the cash consequence of rescheduling", () => {
  it("draws both curves when a baseline exists", () => {
    // Committed to January, now running in March: same money, three months later.
    const result = monthlyCashFlow(
      [
        task({
          start_date: "2026-03-01", end_date: "2026-03-31",
          baseline_start_date: "2026-01-01", baseline_end_date: "2026-01-31",
        }),
      ],
      RATES,
    );
    expect(result.hasBaseline).toBe(true);
    const jan = result.months.find((m) => m.month === "2026-01")!;
    const mar = result.months.find((m) => m.month === "2026-03")!;
    expect(jan.baseline).toBe(1000);
    expect(jan.planned).toBe(0);
    expect(mar.planned).toBe(1000);
    expect(mar.baseline).toBe(0);
  });

  it("values the baseline curve at the baseline hours, not today's estimate", () => {
    const result = monthlyCashFlow(
      [
        task({
          estimate_hours: 40, baseline_estimate_hours: 10,
          baseline_start_date: "2026-01-01", baseline_end_date: "2026-01-31",
        }),
      ],
      RATES,
    );
    expect(result.months[0].baseline).toBe(1000); // 10h, not 40h
    expect(result.months[0].planned).toBe(4000);
  });

  it("says there is no baseline rather than drawing a flat zero line", () => {
    expect(monthlyCashFlow([task()], RATES).hasBaseline).toBe(false);
  });
});

describe("actual spend", () => {
  it("appears only where hours were logged", () => {
    const result = monthlyCashFlow(
      [task({ actual_hours: 5, status: "done", end_date: "2026-01-31" })],
      RATES,
    );
    expect(result.months[0].actual).toBe(500);
  });

  it("is zero for work with an estimate and no logged hours", () => {
    // Money not yet spent is not a cost.
    expect(monthlyCashFlow([task({ estimate_hours: 99 })], RATES).months[0].actual).toBe(0);
  });
});

describe("nothing at all", () => {
  it("returns an empty series rather than a fabricated month", () => {
    const result = monthlyCashFlow([], RATES);
    expect(result.months).toEqual([]);
    expect(result.peakMonth).toBeNull();
    expect(result.hasBaseline).toBe(false);
  });
});
