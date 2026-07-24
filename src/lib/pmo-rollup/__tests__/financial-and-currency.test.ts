import { describe, expect, it } from "vitest";
import { getPmoAggregateSnapshot } from "../engine";
import {
  BASE_REQUEST,
  cpiFixture,
  financialSeparationFixture,
  multiCurrencyFixture,
} from "../__fixtures__/canonical-fixtures";

describe("PMO financial aggregation", () => {
  it("uses ratio-of-sums for CPI even when an average happens to match", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, cpiFixture(true));
    expect(snapshot.metrics.portfolio_cpi.value).toBe(1.25);
    expect(snapshot.metrics.portfolio_cpi.aggregationMethod).toBe("ratio-of-sums");
  });

  it("proves CPI is not an average of project indices", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, cpiFixture(false));
    const averageProjectCpi = (10 / 20 + 90 / 50) / 2;
    expect(snapshot.metrics.portfolio_cpi.value).toBeCloseTo(100 / 70, 10);
    expect(snapshot.metrics.portfolio_cpi.value).not.toBeCloseTo(averageProjectCpi, 10);
    expect(snapshot.metrics.portfolio_cpi.numerator).toBe(100);
    expect(snapshot.metrics.portfolio_cpi.denominator).toBe(70);
  });

  it("keeps actuals, commitments, and accruals separate and reconciles EAC/VAC", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, financialSeparationFixture());
    expect(snapshot.metrics.actual_cost.value).toBe(100);
    expect(snapshot.metrics.committed_cost.value).toBe(200);
    expect(snapshot.metrics.accrued_cost.value).toBe(50);
    expect(snapshot.metrics.remaining_budget.value).toBe(900);
    expect(snapshot.metrics.estimate_to_complete.value).toBe(600);
    expect(snapshot.metrics.estimate_at_completion.value).toBe(700);
    expect(snapshot.metrics.variance_at_completion.value).toBe(300);
  });

  it("converts currencies using an auditable dated rate", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, multiCurrencyFixture(true));
    expect(snapshot.metrics.approved_budget.value).toBe(220);
    expect(snapshot.metrics.approved_budget.reportingCurrency).toBe("USD");
    expect(snapshot.lineage.exchangeRateIds).toEqual(["fx-eur-usd-2026-03-01"]);
  });

  it("never sums mixed currencies without a conversion rate", () => {
    const snapshot = getPmoAggregateSnapshot(BASE_REQUEST, multiCurrencyFixture(false));
    expect(snapshot.metrics.approved_budget.value).toBe(100);
    expect(snapshot.metrics.approved_budget.coveragePercent).toBe(50);
    expect(snapshot.metrics.approved_budget.status).toBe("partial");
    expect(snapshot.dataQuality.warnings.some((warning) => warning.includes("missing_exchange_rate")))
      .toBe(true);
  });
});
