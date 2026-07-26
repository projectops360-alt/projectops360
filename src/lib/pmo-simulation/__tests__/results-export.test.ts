// ============================================================================
// CAP-049 — an exported result keeps its caveats
// Guard: PMO-SIM-EXPORT-KEEPS-PROVENANCE
// ============================================================================
// Export is where the on-screen honesty rules are easiest to lose, and where
// losing them costs most: a spreadsheet gets pasted into a board pack, and by
// then nobody remembers which figures were assumptions.
//
//   * A missing value exports as words, never as an empty cell. An empty cell
//     in a numeric column is read as zero by whoever sums it next.
//   * Provenance travels with every number, so ASSUMED and OBSERVED do not
//     become indistinguishable the moment they leave the screen.
//   * Interventions that could not be computed are exported too. Dropping them
//     would read as "that change had no effect".
// ============================================================================

import { describe, expect, it } from "vitest";
import type { SimResult } from "../contracts";
import {
  buildAssumptionsSheet,
  buildExportSheets,
  buildInterventionsSheet,
  buildMetricsSheet,
  exportFileName,
  sheetToCsv,
  type ExportLabels,
} from "../results-export";

const labels: ExportLabels = {
  metric: (key) => key,
  provenance: (key) => key,
  engine: (key) => key,
  headers: {
    metric: "Metric", baseline: "Baseline", simulated: "Simulated", delta: "Delta",
    unit: "Unit", engine: "Engine", provenance: "Status", reason: "Reason",
  },
  sheets: {
    metrics: "Metrics", interventions: "Interventions",
    assumptions: "Assumptions", coverage: "Coverage",
  },
  unavailable: "Data unavailable",
  scenario: "Scenario",
  ranAt: "Run at",
  baselineAt: "Baseline at",
  neverModifies: "Simulations never modify real projects.",
};

function result(overrides: Partial<SimResult> = {}): SimResult {
  return {
    scenarioId: "s1",
    baselineAt: "2026-07-26T00:00:00.000Z",
    ranAt: "2026-07-26T12:00:00.000Z",
    metrics: [
      {
        key: "portfolio_bac", unit: "currency", baseline: 1_100_000, simulated: 1_200_000,
        delta: 100_000, engine: "evm", provenance: "OBSERVED", unavailableReason: null,
      },
      {
        key: "portfolio_eac", unit: "currency", baseline: null, simulated: null, delta: null,
        engine: "evm", provenance: "UNAVAILABLE",
        unavailableReason: "no_project_with_changed_budget_has_earned_value",
      },
      {
        key: "risk_exposure_cost", unit: "currency", baseline: 50_000, simulated: 20_000,
        delta: -30_000, engine: "risk_policy", provenance: "ASSUMED", unavailableReason: null,
      },
    ],
    outcomes: [
      {
        interventionId: "i1", kind: "budget", computable: true, notComputableReason: null,
        affectedNodeIds: ["project:p1"], metrics: [],
      },
      {
        interventionId: "i2", kind: "resource", computable: false,
        notComputableReason: "resource_has_no_linked_work", affectedNodeIds: [], metrics: [],
      },
    ],
    issues: [{ code: "target_not_found", severity: "warning", interventionIds: ["i3"], detail: "task:abc" }],
    assumptions: ["evm_forecast_uses_cpi_based_eac"],
    causalChains: [],
    coverage: {
      availableSources: ["budget_items"],
      unavailableSources: ["resource_assignments"],
      unresolvedTargets: [{ kind: "task", id: "abc" }],
    },
    affectedNodeIds: ["project:p1"],
    ...overrides,
  };
}

describe("results export (PMO-SIM-EXPORT-KEEPS-PROVENANCE)", () => {
  it("a missing value exports as words, not as an empty cell", () => {
    const sheet = buildMetricsSheet(result(), "en", labels);
    const eac = sheet.rows.find((row) => row[0].includes("Eac"));
    if (!eac) throw new Error("EAC row missing");
    expect(eac[1]).toBe("Data unavailable");
    expect(eac[2]).toBe("Data unavailable");
    expect(eac[3]).toBe("Data unavailable");
    // And never a zero, which is the failure mode that matters.
    expect(eac.slice(1, 4)).not.toContain("0");
  });

  it("the reason a value is missing travels with the row", () => {
    const sheet = buildMetricsSheet(result(), "en", labels);
    const eac = sheet.rows.find((row) => row[0].includes("Eac"));
    expect(eac?.[7]).toBe("no_project_with_changed_budget_has_earned_value");
  });

  it("an assumed figure is not exported as if it were observed", () => {
    const sheet = buildMetricsSheet(result(), "en", labels);
    const assumed = sheet.rows.find((row) => row[0].includes("RiskExposureCost"));
    const observed = sheet.rows.find((row) => row[0].includes("Bac"));
    expect(assumed?.[6]).toContain("Assumed");
    expect(observed?.[6]).toContain("Observed");
    expect(assumed?.[6]).not.toBe(observed?.[6]);
  });

  it("an intervention that could not be computed is still exported", () => {
    const sheet = buildInterventionsSheet(result(), labels);
    const row = sheet.rows.find((entry) => entry[0] === "i2");
    if (!row) throw new Error("uncomputable intervention was dropped");
    expect(row[2]).toBe("no");
    expect(row[3]).toBe("resource_has_no_linked_work");
  });

  it("assumptions and issues share one sheet and stay distinguishable", () => {
    const rows = buildAssumptionsSheet(result(), labels).rows;
    expect(rows.some((row) => row[0] === "assumption")).toBe(true);
    expect(rows.some((row) => row[0] === "warning" && row[1] === "target_not_found")).toBe(true);
  });

  it("the workbook states that a simulation changes nothing", () => {
    // Someone will open this file without the app around it.
    const sheets = buildExportSheets(result(), "en", labels, "Escenario A");
    const flat = sheets.flatMap((sheet) => sheet.rows.flat()).join(" ");
    expect(flat).toContain("Simulations never modify real projects.");
    expect(flat).toContain("Escenario A");
  });

  it("CSV quotes a cell containing a comma", () => {
    const csv = sheetToCsv({ name: "x", rows: [["a,b", "c"]] });
    expect(csv).toBe('"a,b",c');
  });

  it("CSV escapes an embedded quote rather than breaking the row", () => {
    const csv = sheetToCsv({ name: "x", rows: [['say "hi"', "c"]] });
    expect(csv).toBe('"say ""hi""",c');
  });

  it("the file name is safe and dated", () => {
    expect(exportFileName("Ampliación Subestación / Valle", "2026-07-26T12:00:00Z", "xlsx")).toBe(
      "Ampliacion-Subestacion-Valle-2026-07-26.xlsx",
    );
  });

  it("an unnamed scenario still produces a usable file name", () => {
    expect(exportFileName("   ", "2026-07-26T12:00:00Z", "csv")).toBe("simulation-2026-07-26.csv");
  });
});
