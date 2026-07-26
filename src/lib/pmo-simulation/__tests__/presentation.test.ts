// ============================================================================
// PMO Simulation — presentation guards (PMO-SIM-UNITS-*, PMO-SIM-COMPARE-*)
// ============================================================================
// The unit rules are only real if they hold at the point a human reads them.
// These tests pin the rendered strings, not just the internal numbers.
// ============================================================================

import { describe, expect, it } from "vitest";
import {
  buildResultRows,
  classifyNodesForCompare,
  deltaTone,
  edgeDashArray,
  formatValue,
  metricLabelKey,
  nodesForSelection,
} from "../presentation";
import type { SimMetric, SimResult } from "../contracts";

const metric = (over: Partial<SimMetric> = {}): SimMetric => ({
  key: "portfolio_bac",
  unit: "currency",
  baseline: 100,
  simulated: 150,
  delta: 50,
  engine: "evm",
  provenance: "OBSERVED",
  unavailableReason: null,
  ...over,
});

// ── PMO-SIM-UNITS ───────────────────────────────────────────────────────────

describe("PMO-SIM-UNITS: values render in their own unit", () => {
  it("formats currency with a currency marker", () => {
    expect(formatValue(50_000, "currency", "en")).toBe("$50,000");
  });

  it("formats days as a plain number, never as money", () => {
    const rendered = formatValue(12, "days", "en");
    expect(rendered).toBe("12");
    expect(rendered).not.toContain("$");
  });

  it("formats a signed delta the way the brief specifies", () => {
    expect(formatValue(-12, "days", "en", { signed: true })).toBe("-12");
    expect(formatValue(50_000, "currency", "en", { signed: true })).toBe("+$50,000");
    expect(formatValue(-2, "count", "en", { signed: true })).toBe("-2");
  });

  it("formats percent with a percent marker and no currency", () => {
    const rendered = formatValue(87.5, "percent", "en");
    expect(rendered).toBe("87.5%");
    expect(rendered).not.toContain("$");
  });

  it("returns null for an unavailable value instead of zero", () => {
    expect(formatValue(null, "currency", "en")).toBeNull();
    expect(formatValue(Number.NaN, "days", "en")).toBeNull();
  });

  it("never renders a days value through the currency formatter", () => {
    const rows = buildResultRows(
      [
        metric({ key: "risk_exposure_cost", unit: "currency", baseline: 0, simulated: 80_000, delta: 80_000 }),
        metric({ key: "risk_exposure_days", unit: "days", baseline: 0, simulated: 12, delta: 12 }),
      ],
      "en",
    );
    const cost = rows.find((r) => r.key === "risk_exposure_cost");
    const days = rows.find((r) => r.key === "risk_exposure_days");

    expect(cost?.simulated).toBe("$80,000");
    expect(days?.simulated).toBe("12");
    expect(days?.simulated).not.toContain("$");
    // The combined figure must not appear in any rendered cell.
    const cells = rows.flatMap((r) => [r.baseline, r.simulated, r.delta]);
    expect(cells).not.toContain("$80,012");
    expect(cells).not.toContain("80012");
  });
});

// ── PMO-SIM-TONE ────────────────────────────────────────────────────────────

describe("PMO-SIM-TONE: deltas are coloured by meaning, not by sign", () => {
  it("treats a longer schedule as worse", () => {
    expect(deltaTone(metric({ key: "portfolio_finish_days", unit: "days", delta: 12 }))).toBe("worsened");
    expect(deltaTone(metric({ key: "portfolio_finish_days", unit: "days", delta: -12 }))).toBe("improved");
  });

  it("treats a higher EAC as worse and a higher VAC as better", () => {
    expect(deltaTone(metric({ key: "portfolio_eac", delta: 5_000 }))).toBe("worsened");
    expect(deltaTone(metric({ key: "portfolio_vac", delta: 5_000 }))).toBe("improved");
  });

  it("stays neutral on budget, which is the user's own decision", () => {
    expect(deltaTone(metric({ key: "portfolio_bac", delta: 50_000 }))).toBe("neutral");
  });

  it("reports unknown when a value is unavailable", () => {
    expect(deltaTone(metric({ simulated: null, delta: null }))).toBe("unknown");
  });

  it("does not guess a direction for an unrecognised metric", () => {
    expect(deltaTone(metric({ key: "something_new", delta: 10 }))).toBe("neutral");
  });
});

// ── PMO-SIM-LABELS ──────────────────────────────────────────────────────────

describe("PMO-SIM-LABELS", () => {
  it("maps engine keys to i18n keys, never raw snake_case", () => {
    expect(metricLabelKey("portfolio_finish_days")).toBe("metricPortfolioFinishDays");
    expect(metricLabelKey("risk_exposure_cost")).toBe("metricRiskExposureCost");
  });

  it("flags assumed and proxy values as needing a caveat", () => {
    const rows = buildResultRows(
      [
        metric({ provenance: "ASSUMED" }),
        metric({ key: "risk_exposure_days", unit: "days", provenance: "DERIVED_PROXY" }),
        metric({ key: "portfolio_bac", provenance: "OBSERVED" }),
      ],
      "en",
    );
    expect(rows[0].needsCaveat).toBe(true);
    expect(rows[1].needsCaveat).toBe(true);
    expect(rows[2].needsCaveat).toBe(false);
  });
});

// ── PMO-SIM-COMPARE ─────────────────────────────────────────────────────────

const result = (over: Partial<SimResult> = {}): SimResult => ({
  scenarioId: "s1",
  baselineAt: "2026-07-26T09:00:00.000Z",
  ranAt: "2026-07-26T10:00:00.000Z",
  metrics: [],
  outcomes: [],
  issues: [],
  assumptions: [],
  causalChains: [],
  coverage: { availableSources: [], unavailableSources: [], unresolvedTargets: [] },
  affectedNodeIds: [],
  ...over,
});

describe("PMO-SIM-COMPARE", () => {
  it("colours a delayed task as worsened", () => {
    const states = classifyNodesForCompare(
      result({
        affectedNodeIds: ["task:t1"],
        outcomes: [
          {
            interventionId: "i1",
            kind: "schedule",
            computable: true,
            notComputableReason: null,
            affectedNodeIds: ["task:t1"],
            metrics: [metric({ key: "portfolio_finish_days", unit: "days", delta: 5 })],
          },
        ],
      }),
    );
    expect(states.get("task:t1")).toBe("worsened");
  });

  it("colours a materialized risk as a new risk", () => {
    const states = classifyNodesForCompare(
      result({
        affectedNodeIds: ["risk:r1"],
        outcomes: [
          {
            interventionId: "i1",
            kind: "risk",
            computable: true,
            notComputableReason: null,
            affectedNodeIds: ["risk:r1"],
            metrics: [metric({ key: "open_risks", unit: "count", baseline: 0, simulated: 1, delta: 1 })],
          },
        ],
      }),
    );
    expect(states.get("risk:r1")).toBe("new_risk");
  });

  it("colours a mitigated risk as improved", () => {
    const states = classifyNodesForCompare(
      result({
        affectedNodeIds: ["risk:r1"],
        outcomes: [
          {
            interventionId: "i1",
            kind: "risk",
            computable: true,
            notComputableReason: null,
            affectedNodeIds: ["risk:r1"],
            metrics: [metric({ key: "open_risks", unit: "count", baseline: 1, simulated: 0, delta: -1 })],
          },
        ],
      }),
    );
    expect(states.get("risk:r1")).toBe("improved");
  });

  it("colours a resource change blue", () => {
    const states = classifyNodesForCompare(
      result({
        affectedNodeIds: ["resource:res1"],
        outcomes: [
          {
            interventionId: "i1",
            kind: "resource",
            computable: true,
            notComputableReason: null,
            affectedNodeIds: ["resource:res1"],
            metrics: [metric({ key: "resource_effective_hours", unit: "hours", delta: -20 })],
          },
        ],
      }),
    );
    expect(states.get("resource:res1")).toBe("resource_change");
  });

  it("leaves untouched nodes grey", () => {
    const states = classifyNodesForCompare(result({ affectedNodeIds: ["task:t9"] }));
    expect(states.get("task:t9")).toBe("unchanged");
    expect(states.has("task:never-mentioned")).toBe(false);
  });

  it("ignores non-computable outcomes when colouring", () => {
    const states = classifyNodesForCompare(
      result({
        outcomes: [
          {
            interventionId: "i1",
            kind: "schedule",
            computable: false,
            notComputableReason: "target_not_found",
            affectedNodeIds: ["task:t1"],
            metrics: [],
          },
        ],
      }),
    );
    expect(states.has("task:t1")).toBe(false);
  });

  it("uses a dashed line only for the simulated view", () => {
    expect(edgeDashArray("baseline")).toBeUndefined();
    expect(edgeDashArray("compare")).toBeUndefined();
    expect(edgeDashArray("simulated")).toBe("6 3");
  });
});

// ── PMO-SIM-FOCUS ───────────────────────────────────────────────────────────

describe("PMO-SIM-FOCUS: selecting a metric or intervention centres real nodes", () => {
  const model = result({
    affectedNodeIds: ["task:t1", "risk:r1"],
    outcomes: [
      {
        interventionId: "i-schedule",
        kind: "schedule",
        computable: true,
        notComputableReason: null,
        affectedNodeIds: ["task:t1"],
        metrics: [metric({ key: "portfolio_finish_days", unit: "days", delta: 5 })],
      },
      {
        interventionId: "i-risk",
        kind: "risk",
        computable: true,
        notComputableReason: null,
        affectedNodeIds: ["risk:r1"],
        metrics: [metric({ key: "risk_exposure_cost", delta: 1_000 })],
      },
    ],
  });

  it("returns the nodes of the selected intervention", () => {
    expect(nodesForSelection(model, { kind: "intervention", id: "i-schedule" })).toEqual(["task:t1"]);
  });

  it("maps a metric back to every intervention that produced it", () => {
    expect(nodesForSelection(model, { kind: "metric", id: "risk_exposure_cost" })).toEqual(["risk:r1"]);
  });

  it("returns everything affected when nothing is selected", () => {
    expect(nodesForSelection(model, null)).toEqual(["task:t1", "risk:r1"]);
  });

  it("returns an empty list for a selection that touched nothing", () => {
    expect(nodesForSelection(model, { kind: "intervention", id: "unknown" })).toEqual([]);
  });
});
