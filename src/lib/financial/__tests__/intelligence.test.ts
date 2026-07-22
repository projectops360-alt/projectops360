import { describe, expect, it } from "vitest";
import { buildFinancialIntelligenceContext } from "../intelligence";
import type { FinancialCockpitSummary } from "../read-model.server";

const summary: FinancialCockpitSummary = {
  organizationId: "org-1",
  projectId: "project-1",
  currency: "USD",
  originalBudget: 1000,
  currentBaseline: 1100,
  authorizedFunding: 1000,
  releasedFunding: 800,
  currentCommitment: 600,
  outstandingCommitment: 300,
  actualCost: 400,
  openAccrual: 50,
  settledPayments: 300,
  remainingReserve: 80,
  approvedChangesNotPosted: 25,
  latestEac: 1150,
  p50Eac: null,
  p80Eac: null,
  cpi: 0.92,
  spi: 0.97,
  qualityStatus: "provisional",
  pendingApprovals: 2,
  reconciliationExceptions: 1,
  unverifiedActuals: 3,
  currencyMismatches: 1,
  dataDate: "2026-07-22",
};

describe("Isabella financial context", () => {
  it("is grounded in canonical projections and remains read-only", () => {
    const context = buildFinancialIntelligenceContext(summary);
    expect(context.allowedOperations).toEqual(["explain", "compare", "trace"]);
    expect(context.prohibitedOperations).toEqual([
      "approve", "post", "release", "reopen", "execute",
    ]);
    expect(context.facts.find((fact) => fact.key === "actual_cost")).toMatchObject({
      source: "cost_actuals",
      quality: "provisional",
    });
  });

  it("exposes incomplete history instead of inventing a forecast", () => {
    expect(buildFinancialIntelligenceContext(summary).limitations).toEqual(
      expect.arrayContaining([
        "legacy_actuals_unverified",
        "multi_currency_rows_excluded",
        "probabilistic_forecast_unavailable",
      ]),
    );
  });
});
