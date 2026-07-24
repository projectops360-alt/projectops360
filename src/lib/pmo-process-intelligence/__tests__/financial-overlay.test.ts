// ============================================================================
// CAP-047 M5 — finance overlay + anomaly rules (guard: PMO-PI-FINANCE-ALERTS)
// ============================================================================
// Fails if: an alert loses its formula/observed values/status date/source,
// VAC/TCPI diverge from canonical formulas, EV derivation stops being
// declared, actuals/commitments/accruals get pre-summed, or thresholds
// silently change.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildFinanceOverlayModel } from "../financial-overlay";
import type { FinancialCockpitSummary } from "@/lib/financial/read-model.server";

function summary(overrides: Partial<FinancialCockpitSummary> = {}): FinancialCockpitSummary {
  return {
    organizationId: "org-1",
    projectId: "p1",
    currency: "USD",
    originalBudget: 100_000,
    currentBaseline: 120_000,
    authorizedFunding: 120_000,
    releasedFunding: 80_000,
    currentCommitment: 30_000,
    outstandingCommitment: 10_000,
    actualCost: 40_000,
    openAccrual: 5_000,
    settledPayments: 20_000,
    remainingReserve: 8_000,
    approvedChangesNotPosted: 0,
    latestEac: 110_000,
    p50Eac: 108_000,
    p80Eac: 118_000,
    cpi: 1.05,
    spi: 0.97,
    qualityStatus: "available",
    pendingApprovals: 0,
    reconciliationExceptions: 0,
    unverifiedActuals: 0,
    currencyMismatches: 0,
    dataDate: "2026-07-20",
    ...overrides,
  };
}

describe("buildFinanceOverlayModel (CAP-047 M5)", () => {
  it("computes VAC = BAC − EAC and derived TCPI per canonical formulas", () => {
    const m = buildFinanceOverlayModel([summary()]);
    const r = m.rows[0];
    expect(r.vac).toBe(120_000 - 110_000);
    // TCPI = (BAC − EV) / (BAC − AC) with EV = CPI × AC (declared assumption)
    const ev = 1.05 * 40_000;
    expect(r.tcpi).toBeCloseTo((120_000 - ev) / (120_000 - 40_000), 10);
    expect(m.assumptions).toContain("ev_derived_as_cpi_times_ac");
  });

  it("keeps actuals, commitments and accruals as separate columns (never summed)", () => {
    const m = buildFinanceOverlayModel([summary()]);
    const r = m.rows[0];
    expect(r.actualCost).toBe(40_000);
    expect(r.currentCommitment).toBe(30_000);
    expect(r.openAccrual).toBe(5_000);
    expect(JSON.stringify(m)).not.toContain(String(40_000 + 30_000 + 5_000));
    expect(m.assumptions).toContain("actuals_commitments_accruals_are_separate_never_summed");
  });

  it("triggers explainable alerts with formula, observed values, date and source", () => {
    const m = buildFinanceOverlayModel([
      summary({ cpi: 0.75, spi: 0.85, latestEac: 130_000, reconciliationExceptions: 2, currencyMismatches: 1 }),
    ]);
    const rules = m.alerts.map((a) => a.rule);
    expect(rules).toContain("cpi_below_threshold");
    expect(rules).toContain("spi_below_threshold");
    expect(rules).toContain("eac_exceeds_baseline");
    expect(rules).toContain("reconciliation_exceptions");
    expect(rules).toContain("currency_mismatches");
    for (const a of m.alerts) {
      expect(a.formula.length).toBeGreaterThan(0);
      expect(Object.keys(a.observed).length).toBeGreaterThan(0);
      expect(a.statusDate).toBe("2026-07-20");
      expect(a.source).toBe("financial_project_cockpit");
    }
    // CPI 0.75 < 0.8 escalates to critical; SPI 0.85 stays warning.
    expect(m.alerts.find((a) => a.rule === "cpi_below_threshold")?.severity).toBe("critical");
    expect(m.alerts.find((a) => a.rule === "spi_below_threshold")?.severity).toBe("warning");
    // Critical alerts sort first.
    expect(m.alerts[0].severity).toBe("critical");
  });

  it("stays silent when no rule is triggered and reports portfolio CPI honestly", () => {
    const healthy = buildFinanceOverlayModel([summary(), summary({ projectId: "p2", cpi: 1.1, actualCost: 20_000 })]);
    expect(healthy.alerts).toHaveLength(0);
    // Portfolio CPI = ΣEV / ΣAC
    const ev = 1.05 * 40_000 + 1.1 * 20_000;
    expect(healthy.portfolioCpi).toBeCloseTo(ev / 60_000, 10);
    const noCpi = buildFinanceOverlayModel([summary({ cpi: null })]);
    expect(noCpi.portfolioCpi).toBeNull();
    expect(noCpi.rows[0].tcpi).toBeNull(); // EV not derivable → honest null
  });

  it("returns an empty model for projects without financial data", () => {
    const m = buildFinanceOverlayModel([]);
    expect(m.rows).toHaveLength(0);
    expect(m.alerts).toHaveLength(0);
    expect(m.portfolioCpi).toBeNull();
  });
});
