// ============================================================================
// CAP-049 — earned value has a source, and the engine names it
// Guard: PMO-SIM-EVM-SOURCE
// ============================================================================
// The simulator was written believing EV had no source in this schema, so it
// hard-coded `ev: null` and every forecast reported "unavailable". The
// financial module had meanwhile shipped `financial_measurement_snapshots`,
// which stores BAC, PV, EV and AC per project per data date — the read model
// simply never asked for it.
//
// Two rules are pinned here because both are easy to break by accident:
//
//   1. BAC keeps coming from the budget lines, never from the snapshot. BAC is
//      what a budget intervention MOVES; read from a snapshot it would be
//      frozen at the reporting date and the simulated column would always equal
//      the baseline one — a simulator that silently reports no effect.
//
//   2. EV and AC travel together. An EV measured at a data date paired with an
//      AC summed from today's budget lines gives a CPI that describes neither.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { financeMetrics } from "../stages/finance";
import { EMPTY_BASELINE, type SimBaseline, type SimWorkingCopy } from "../baseline";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const budgetLine = (id: string, estimated: number, actual: number) => ({
  id,
  project_id: "p1",
  milestone_id: null,
  name: id,
  category: "labor",
  estimated_cost: estimated,
  committed_cost: 0,
  actual_cost: actual,
  forecast_cost: null,
});

function baselineWith(evm: SimBaseline["evm"]): SimBaseline {
  return {
    ...EMPTY_BASELINE,
    organizationId: "org1",
    budgetItems: [budgetLine("b1", 100_000, 30_000)],
    evm,
  };
}

/** Budget stage output: the same line with a raised estimate. */
function workingWith(estimated: number): SimWorkingCopy {
  return {
    tasks: [],
    budgetItems: [budgetLine("b1", estimated, 30_000)],
    allocations: [],
    neutralizedRiskIds: new Set(),
    materializedRiskIds: new Set(),
    riskWeight: new Map(),
  };
}

describe("EVM source (PMO-SIM-EVM-SOURCE)", () => {
  it("a project with a measurement produces a real EAC", () => {
    const baseline = baselineWith([
      { project_id: "p1", bac: 100_000, ev: 40_000, ac: 30_000, pv: 45_000, source: "measurement_snapshot" },
    ]);
    const { metrics, assumptions } = financeMetrics(baseline, workingWith(120_000));

    const eac = metrics.find((metric) => metric.key === "portfolio_eac");
    if (!eac) throw new Error("portfolio_eac missing");
    expect(eac.provenance).toBe("OBSERVED");
    expect(eac.simulated).not.toBeNull();
    expect(eac.formulaId).toBe("eac_cpi");
    expect(assumptions).toContain("evm_inputs_read_from_financial_measurement_snapshot");
  });

  it("without a measurement the forecast stays unavailable, never zero", () => {
    // This is the pre-existing behaviour and it must survive: a project with no
    // earned value has no forecast, and a zero would be a lie with two decimals.
    const baseline = baselineWith([
      { project_id: "p1", bac: 100_000, ev: null, ac: 30_000, pv: null, source: "budget_items" },
    ]);
    const { metrics, assumptions } = financeMetrics(baseline, workingWith(120_000));

    const eac = metrics.find((metric) => metric.key === "portfolio_eac");
    if (!eac) throw new Error("portfolio_eac missing");
    expect(eac.provenance).toBe("UNAVAILABLE");
    expect(eac.baseline).toBeNull();
    expect(eac.simulated).toBeNull();
    expect(eac.formulaId).toBeUndefined();
    expect(assumptions).not.toContain("evm_inputs_read_from_financial_measurement_snapshot");
  });

  it("BAC still moves with the intervention", () => {
    // The rule the snapshot could quietly break.
    const baseline = baselineWith([
      { project_id: "p1", bac: 100_000, ev: 40_000, ac: 30_000, pv: 45_000, source: "measurement_snapshot" },
    ]);
    const { metrics } = financeMetrics(baseline, workingWith(120_000));

    const bac = metrics.find((metric) => metric.key === "portfolio_bac");
    if (!bac) throw new Error("portfolio_bac missing");
    expect(bac.baseline).toBe(100_000);
    expect(bac.simulated).toBe(120_000);
    expect(bac.delta).toBe(20_000);
  });

  it("the read model asks for the measurement table and does not hard-code a null EV", () => {
    const readModel = source("src/lib/pmo-simulation/read-model.server.ts");
    expect(readModel).toContain("financial_measurement_snapshots");
    // The line that used to sit in the returned evm rows.
    expect(readModel).not.toMatch(/^\s*ev: null,\s*$/m);
  });

  it("an unusable measurement is not trusted just because it has a number", () => {
    // `quality_status` exists precisely so a bad reading can be rejected.
    const readModel = source("src/lib/pmo-simulation/read-model.server.ts");
    expect(readModel).toContain("quality_status");
    expect(readModel).toContain("provisional");
  });

  it("the table is reported in data coverage", () => {
    expect(source("src/lib/pmo-simulation/engine.ts")).toContain(
      '"financial_measurement_snapshots"',
    );
  });
});
