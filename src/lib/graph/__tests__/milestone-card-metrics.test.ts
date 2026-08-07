// ============================================================================
// The user chooses what a milestone card shows — and a gap must look like one
// ============================================================================
// Guard: MILESTONE-CARD-METRICS
//
// Two properties are load-bearing here:
//
//   1. The selection belongs to the user. Nothing appears by default, unknown
//      ids from an older release are discarded instead of crashing the card,
//      and the cap cannot be exceeded — not even by writing storage by hand.
//   2. A number the data cannot support renders as "—", never as 0. On a card
//      headed "Preparación", a confident "$0" says the phase was free.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  MILESTONE_CARD_METRICS,
  MAX_MILESTONE_CARD_METRICS,
  DEFAULT_MILESTONE_CARD_METRIC_IDS,
  sanitizeMetricSelection,
  toggleMetricSelection,
  resolveMilestoneCardMetrics,
  formatMetricValue,
  getMilestoneCardMetric,
} from "../milestone-card-metrics";
import type { MilestoneCostRollup } from "@/lib/roadmap/milestone-cost-rollup";

function rollup(over: Partial<MilestoneCostRollup> = {}): MilestoneCostRollup {
  return {
    milestoneId: "m1",
    taskCount: 53,
    tasksDone: 53,
    estimatedHours: 1296,
    actualHours: 332,
    varianceHours: -964,
    plannedDurationDays: 54,
    budget: 210300,
    materialCost: null,
    labourCost: null,
    tasksWithoutRate: 53,
    totalCost: 210300,
    ...over,
  };
}

const ES = { locale: "es", currency: "USD", isEs: true };

describe("the catalogue", () => {
  it("has unique ids and both languages for every metric", () => {
    const ids = MILESTONE_CARD_METRICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MILESTONE_CARD_METRICS) {
      expect(m.es.trim().length, m.id).toBeGreaterThan(0);
      expect(m.en.trim().length, m.id).toBeGreaterThan(0);
      expect(m.esShort.trim().length, m.id).toBeGreaterThan(0);
      expect(m.enShort.trim().length, m.id).toBeGreaterThan(0);
    }
  });

  it("shows nothing until the user asks", () => {
    // Turning these on for everyone would silently change every existing card.
    expect(DEFAULT_MILESTONE_CARD_METRIC_IDS).toEqual([]);
  });
});

describe("the selection is the user's", () => {
  it("drops ids that no longer exist instead of breaking the card", () => {
    // A preference saved before a metric was renamed must not crash on load.
    expect(sanitizeMetricSelection(["budget", "metricFromLastYear"])).toEqual(["budget"]);
  });

  it("survives storage that is not even a list", () => {
    expect(sanitizeMetricSelection(null)).toEqual([]);
    expect(sanitizeMetricSelection("budget")).toEqual([]);
    expect(sanitizeMetricSelection([1, {}, undefined])).toEqual([]);
  });

  it("collapses duplicates", () => {
    expect(sanitizeMetricSelection(["budget", "budget"])).toEqual(["budget"]);
  });

  it("enforces the cap even on storage written by hand", () => {
    const tooMany = MILESTONE_CARD_METRICS.map((m) => m.id);
    expect(tooMany.length).toBeGreaterThan(MAX_MILESTONE_CARD_METRICS);
    expect(sanitizeMetricSelection(tooMany)).toHaveLength(MAX_MILESTONE_CARD_METRICS);
  });

  it("adds and removes", () => {
    expect(toggleMetricSelection([], "budget")).toEqual(["budget"]);
    expect(toggleMetricSelection(["budget"], "budget")).toEqual([]);
  });

  it("at the cap, makes room rather than ignoring the click", () => {
    // A picker that swallows a click reads as broken; the newest choice wins.
    const full = ["budget", "actualHours", "estimatedHours", "taskCount"];
    const next = toggleMetricSelection(full, "plannedDurationDays");
    expect(next).toHaveLength(MAX_MILESTONE_CARD_METRICS);
    expect(next).toContain("plannedDurationDays");
    expect(next).not.toContain("budget"); // the oldest gave way
  });

  it("ignores an unknown id rather than storing it", () => {
    expect(toggleMetricSelection(["budget"], "nonsense")).toEqual(["budget"]);
  });
});

describe("a gap reads as a gap", () => {
  it("renders an unknowable figure as a dash, never as zero", () => {
    const gate = rollup({ taskCount: 0, tasksDone: 0, budget: null, totalCost: null });
    const [budget] = resolveMilestoneCardMetrics(["budget"], gate, ES);
    expect(budget.text).toBe("—");
    expect(budget.hasValue).toBe(false);
  });

  it("renders a dash when there is no rollup at all", () => {
    const [m] = resolveMilestoneCardMetrics(["budget"], undefined, ES);
    expect(m.text).toBe("—");
    expect(m.hasValue).toBe(false);
  });

  it("does not show hours for a milestone that has no tasks", () => {
    // A gate is passed, not worked through. "0 h" would look like idle work.
    const gate = rollup({ taskCount: 0, estimatedHours: 0, actualHours: 0 });
    expect(resolveMilestoneCardMetrics(["estimatedHours"], gate, ES)[0].text).toBe("—");
  });

  it("withholds a variance until there is something to compare", () => {
    const notStarted = rollup({ actualHours: 0, varianceHours: -1296 });
    expect(resolveMilestoneCardMetrics(["varianceHours"], notStarted, ES)[0].text).toBe("—");
  });
});

describe("judgement", () => {
  it("marks an overrun as danger and an underrun as good", () => {
    const over = rollup({ estimatedHours: 100, actualHours: 150, varianceHours: 50 });
    const under = rollup({ estimatedHours: 100, actualHours: 60, varianceHours: -40 });
    expect(resolveMilestoneCardMetrics(["varianceHours"], over, ES)[0].tone).toBe("danger");
    expect(resolveMilestoneCardMetrics(["varianceHours"], under, ES)[0].tone).toBe("good");
  });

  it("warns before the budget is gone, not after", () => {
    const near = rollup({ budget: 1000, labourCost: 950 });
    const gone = rollup({ budget: 1000, labourCost: 1200 });
    expect(resolveMilestoneCardMetrics(["budgetUsedPct"], near, ES)[0].tone).toBe("warn");
    expect(resolveMilestoneCardMetrics(["budgetUsedPct"], gone, ES)[0].tone).toBe("danger");
  });

  it("flags a negative remainder", () => {
    const over = rollup({ budget: 1000, labourCost: 1400 });
    const [left] = resolveMilestoneCardMetrics(["budgetRemaining"], over, ES);
    expect(left.tone).toBe("danger");
    expect(left.hasValue).toBe(true);
  });

  it("stays neutral where there is nothing to judge", () => {
    expect(resolveMilestoneCardMetrics(["taskCount"], rollup(), ES)[0].tone).toBe("neutral");
  });
});

describe("money", () => {
  it("adds labour and materials into spend to date", () => {
    const r = rollup({ labourCost: 1000, materialCost: 250 });
    expect(resolveMilestoneCardMetrics(["spendToDate"], r, ES)[0].hasValue).toBe(true);
    expect(getMilestoneCardMetric("spendToDate")!.value(r)).toBe(1250);
  });

  it("does not invent a spend of zero when neither is known", () => {
    expect(getMilestoneCardMetric("spendToDate")!.value(rollup())).toBeNull();
  });

  it("compacts a large figure so it fits on a card", () => {
    const metric = getMilestoneCardMetric("budget")!;
    const text = formatMetricValue(metric, 210300, { locale: "en", currency: "USD" });
    expect(text).not.toContain("210,300"); // eight characters would overflow
    expect(text).toMatch(/210/);
  });

  it("respects the project currency", () => {
    const metric = getMilestoneCardMetric("budget")!;
    expect(formatMetricValue(metric, 5000, { locale: "en", currency: "EUR" })).toMatch(/€/);
  });
});

describe("formatting", () => {
  it("signs an overrun so the direction is unmistakable", () => {
    const metric = getMilestoneCardMetric("varianceHours")!;
    expect(formatMetricValue(metric, 120, { locale: "en" })).toBe("+120 h");
    expect(formatMetricValue(metric, -120, { locale: "en" })).toBe("-120 h");
  });

  it("labels units", () => {
    expect(formatMetricValue(getMilestoneCardMetric("plannedDurationDays")!, 54, { locale: "en" })).toBe("54 d");
    expect(formatMetricValue(getMilestoneCardMetric("actualHours")!, 332, { locale: "en" })).toBe("332 h");
    expect(formatMetricValue(getMilestoneCardMetric("effortUsedPct")!, 26, { locale: "en" })).toBe("26%");
  });

  it("uses the short label of the chosen language", () => {
    const es = resolveMilestoneCardMetrics(["actualHours"], rollup(), ES)[0];
    const en = resolveMilestoneCardMetrics(["actualHours"], rollup(), {
      locale: "en",
      currency: "USD",
      isEs: false,
    })[0];
    expect(es.label).toBe("real");
    expect(en.label).toBe("actual");
  });
});

describe("against the real project", () => {
  it("reads Preparación the way the data actually is", () => {
    // 53 tasks, 1296h planned, 332h logged, 210,300 USD budgeted, no rates.
    const prep = rollup();
    const shown = resolveMilestoneCardMetrics(
      ["estimatedHours", "actualHours", "budget", "labourCost"],
      prep,
      ES,
    );
    expect(shown.map((m) => m.hasValue)).toEqual([true, true, true, false]);
    // Labour has no rate anywhere in this project, so it must say so.
    expect(shown[3].text).toBe("—");
  });
});
