// ============================================================================
// CAP-046 / PD-019 — Feature 3: KPI Calculation Engine tests.
// Guard id: KPI-ENGINE-SANDBOX — statistical functions, sandboxed parser
// (allow-list, no eval, no member access), honest not-computable results.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  kpiAvg,
  kpiCorrelation,
  kpiCount,
  kpiForecast,
  kpiMedian,
  kpiMovingAverage,
  kpiPercentile,
  kpiSum,
  kpiTrend,
} from "../functions";
import { validateKpiExpression, evaluateKpiExpression } from "../parser";
import { evaluateKpi, type KpiDataset } from "../evaluate";
import { KPI_CATALOG, KPI_DATASET_VARIABLES } from "../catalog";
import { weeklyCompletedSeries } from "../load-dataset";

describe("KPI-ENGINE-SANDBOX — statistical functions", () => {
  it("SUM/AVG/COUNT/MEDIAN/PERCENTILE are NaN-tolerant", () => {
    const values = [1, 2, NaN, 3, 4];
    expect(kpiSum(values)).toBe(10);
    expect(kpiCount(values)).toBe(4);
    expect(kpiAvg(values)).toBeCloseTo(2.5, 6);
    expect(kpiMedian(values)).toBeCloseTo(2.5, 6);
    expect(kpiPercentile(values, 100)).toBe(4);
    expect(kpiPercentile([1, 2, 3, 4], 50)).toBeCloseTo(2.5, 6);
    expect(kpiAvg([])).toBeNaN();
  });

  it("CORRELATION uses pairwise-finite pairs; perfect correlation = 1", () => {
    expect(kpiCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
    expect(kpiCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 6);
    expect(kpiCorrelation([1, NaN, 3], [2, 5, 6])).toBeCloseTo(1, 6); // pair 2 dropped
    expect(kpiCorrelation([1], [2])).toBeNaN();
  });

  it("TREND/MOVING_AVERAGE/FORECAST are linear and deterministic", () => {
    expect(kpiTrend([1, 2, 3, 4])).toBeCloseTo(1, 6);
    expect(kpiTrend([5, 5, 5])).toBeCloseTo(0, 6);
    expect(kpiMovingAverage([1, 2, 3, 4, 5, 6], 3)).toBeCloseTo(5, 6);
    expect(kpiForecast([1, 2, 3, 4], 1)).toBeCloseTo(5, 6);
    expect(kpiForecast([2], 1)).toBeNaN();
  });
});

describe("KPI-ENGINE-SANDBOX — parser security", () => {
  const vars = ["estimate_hours", "actual_hours"];

  it("accepts allow-listed functions and variables only", () => {
    const ok = validateKpiExpression("100 * SUM(actual_hours) / SUM(estimate_hours)", vars);
    expect(ok).toEqual({ valid: true, variables: ["actual_hours", "estimate_hours"] });
  });

  it("rejects unknown symbols with a precise error", () => {
    const bad = validateKpiExpression("SUM(salary)", vars);
    expect(bad.valid).toBe(false);
    if (!bad.valid) expect(bad.error).toContain('"salary"');
  });

  it("rejects member access, assignment and injection attempts (never eval)", () => {
    expect(validateKpiExpression("constructor.constructor('return 1')()", vars).valid).toBe(false);
    expect(validateKpiExpression("a = 5", vars).valid).toBe(false);
    expect(validateKpiExpression("SUM(estimate_hours).constructor", vars).valid).toBe(false);
    expect(validateKpiExpression("random()", vars).valid).toBe(false); // built-ins stripped
    expect(validateKpiExpression("", vars).valid).toBe(false);
    expect(validateKpiExpression("x".repeat(501), vars).valid).toBe(false);
  });

  it("evaluates validated expressions in the sandbox scope", () => {
    const value = evaluateKpiExpression("100 * SUM(actual_hours) / SUM(estimate_hours)", {
      estimate_hours: [10, 10],
      actual_hours: [15, 10],
    });
    expect(value).toBeCloseTo(125, 6);
  });
});

function emptyDataset(): KpiDataset {
  return Object.fromEntries(
    KPI_DATASET_VARIABLES.map((variable) => [variable, [] as number[]]),
  ) as unknown as KpiDataset;
}

describe("KPI-ENGINE-SANDBOX — evaluation core", () => {
  it("evaluates every built-in catalog KPI without throwing (single definition, reused everywhere)", () => {
    const dataset = emptyDataset();
    dataset.completed_flag = [1, 0, 1, 0];
    dataset.blocked_flag = [0, 1, 0, 0];
    dataset.open_overdue_flag = [0, 0, 1, 0];
    dataset.unassigned_flag = [0, 0, 0, 1];
    dataset.progress = [100, 40, 100, 0];
    dataset.duration_days = [2, 4, 6, 8];
    dataset.estimate_hours = [10, 20, 10, 5];
    dataset.actual_hours = [12, 25, 9, NaN];
    dataset.milestone_completed_flag = [1, 0];
    dataset.milestone_delay_days = [3, NaN];
    dataset.weekly_completed = [0, 1, 2, 3];

    for (const definition of KPI_CATALOG) {
      const result = evaluateKpi({ kpiSlug: definition.slug }, dataset);
      expect(result.status, definition.slug).not.toBe("invalid");
    }
    const progress = evaluateKpi({ kpiSlug: "overall_progress" }, dataset);
    expect(progress.status).toBe("ok");
    if (progress.status === "ok") expect(progress.value).toBeCloseTo(50, 6);
  });

  it("returns not_computable (never a fake 0) on empty data", () => {
    const result = evaluateKpi({ kpiSlug: "avg_task_progress" }, emptyDataset());
    expect(result.status).toBe("not_computable");
  });

  it("evaluates ad-hoc expressions and rejects invalid slugs", () => {
    const dataset = emptyDataset();
    dataset.progress = [50, 100];
    const adhoc = evaluateKpi({ expression: "MAX(progress[0], AVG(progress))" }, dataset);
    // Array indexing uses member access — must be rejected by the sandbox.
    expect(adhoc.status).toBe("invalid");

    const avg = evaluateKpi({ expression: "AVG(progress)" }, dataset);
    expect(avg.status).toBe("ok");
    if (avg.status === "ok") expect(avg.value).toBeCloseTo(75, 6);

    expect(evaluateKpi({ kpiSlug: "nope" }, dataset).status).toBe("invalid");
    expect(evaluateKpi({}, dataset).status).toBe("invalid");
  });
});

describe("weeklyCompletedSeries", () => {
  it("buckets completions into trailing UTC weeks, oldest → newest", () => {
    const now = "2026-07-11T12:00:00.000Z"; // Saturday; week starts Mon 2026-07-06
    const series = weeklyCompletedSeries(
      [
        "2026-07-10T00:00:00.000Z", // current week
        "2026-07-07T00:00:00.000Z", // current week
        "2026-06-30T00:00:00.000Z", // previous week
        "2020-01-01T00:00:00.000Z", // far past → dropped
        null,
      ],
      now,
      4,
    );
    expect(series).toHaveLength(4);
    expect(series[3]).toBe(2);
    expect(series[2]).toBe(1);
    expect(series[0] + series[1]).toBe(0);
  });
});
