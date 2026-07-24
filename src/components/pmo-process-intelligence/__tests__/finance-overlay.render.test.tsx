// ============================================================================
// CAP-047 M5 — Finance overlay render guards (guard: PMO-PI-FINANCE-UI)
// ============================================================================
// Pins the Budget Command Center contract: separate committed/actual/accrued
// columns, EAC + P50/P80 + baseline + status date visible, alerts with
// formula + observed values + severity IN TEXT (never color alone), honest
// empty state, full EN/ES (UX-012).
// ============================================================================

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinanceOverlay } from "../finance-overlay";
import { buildFinanceOverlayModel } from "@/lib/pmo-process-intelligence/financial-overlay";
import type { FinancialCockpitSummary } from "@/lib/financial/read-model.server";

const summary: FinancialCockpitSummary = {
  organizationId: "org-1", projectId: "p1", currency: "USD",
  originalBudget: 100_000, currentBaseline: 120_000,
  authorizedFunding: 120_000, releasedFunding: 80_000,
  currentCommitment: 30_000, outstandingCommitment: 10_000,
  actualCost: 40_000, openAccrual: 5_000, settledPayments: 20_000,
  remainingReserve: 8_000, approvedChangesNotPosted: 0,
  latestEac: 130_000, p50Eac: 108_000, p80Eac: 118_000,
  cpi: 0.75, spi: 0.97, qualityStatus: "available",
  pendingApprovals: 0, reconciliationExceptions: 0, unverifiedActuals: 0,
  currencyMismatches: 0, dataDate: "2026-07-20",
};

const model = buildFinanceOverlayModel([summary]);
const names = { p1: "Torre Norte" };

describe("FinanceOverlay (CAP-047 M5)", () => {
  const en = renderToStaticMarkup(<FinanceOverlay model={model} projectNames={names} locale="en" />);

  it("renders separate Committed / Actual / Accrued columns with baseline, EAC, P50/P80 and status date", () => {
    for (const col of ["Committed", "Actual", "Accrued", "Baseline", "EAC", "P50 / P80", "Status date"]) {
      expect(en).toContain(col);
    }
    expect(en).toContain("2026-07-20");
    expect(en).toContain("Torre Norte");
  });

  it("marks a negative VAC as overrun in text, not only styling", () => {
    expect(en).toContain("overrun");
  });

  it("renders alerts with severity label, formula, observed values, date and source", () => {
    expect(en).toContain("[Critical]");
    expect(en).toContain("CPI = EV / AC");
    expect(en).toContain("cpi=0.75");
    expect(en).toContain("financial_project_cockpit");
  });

  it("declares the separation + derivation assumptions on screen", () => {
    expect(en).toContain("never summed");
    expect(en).toContain("CPI × AC");
  });

  it("renders honestly empty when no project has financial data", () => {
    const empty = renderToStaticMarkup(
      <FinanceOverlay model={buildFinanceOverlayModel([])} projectNames={{}} locale="en" />,
    );
    expect(empty).toContain("No project in scope has financial control data yet");
    expect(empty).not.toContain("<table");
  });

  it("renders fully in Spanish (UX-012)", () => {
    const es = renderToStaticMarkup(<FinanceOverlay model={model} projectNames={names} locale="es" />);
    expect(es).toContain("Comprometido");
    expect(es).toContain("Devengado");
    expect(es).toContain("Fecha de corte");
    expect(es).toContain("[Crítico]");
    expect(es).toContain("sobrecosto");
  });
});
