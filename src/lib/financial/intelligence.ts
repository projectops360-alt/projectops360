import type { FinancialCockpitSummary } from "./read-model.server";

export interface FinancialIntelligenceFact {
  key: string;
  value: number | string | null;
  source: string;
  quality: string;
}

export interface FinancialIntelligenceContext {
  projectId: string;
  asOfDate: string | null;
  facts: FinancialIntelligenceFact[];
  limitations: string[];
  allowedOperations: readonly ["explain", "compare", "trace"];
  prohibitedOperations: readonly ["approve", "post", "release", "reopen", "execute"];
}

export function buildFinancialIntelligenceContext(
  summary: FinancialCockpitSummary,
): FinancialIntelligenceContext {
  const quality = summary.qualityStatus;
  const limitations: string[] = ["financial_context_is_read_only"];
  if (summary.currentBaseline == null) limitations.push("active_baseline_missing");
  if (summary.unverifiedActuals > 0) limitations.push("legacy_actuals_unverified");
  if (summary.currencyMismatches > 0) limitations.push("multi_currency_rows_excluded");
  if (summary.p50Eac == null || summary.p80Eac == null) {
    limitations.push("probabilistic_forecast_unavailable");
  }
  return {
    projectId: summary.projectId,
    asOfDate: summary.dataDate,
    facts: [
      { key: "current_baseline", value: summary.currentBaseline, source: "financial_baseline_versions", quality },
      { key: "authorized_funding", value: summary.authorizedFunding, source: "financial_funding_positions", quality },
      { key: "current_commitment", value: summary.currentCommitment, source: "financial_commitment_positions", quality },
      { key: "actual_cost", value: summary.actualCost, source: "cost_actuals", quality },
      { key: "open_accrual", value: summary.openAccrual, source: "financial_accrual_positions", quality },
      { key: "settled_payments", value: summary.settledPayments, source: "financial_payment_positions", quality },
      { key: "remaining_reserve", value: summary.remainingReserve, source: "financial_reserve_positions", quality },
      { key: "cpi", value: summary.cpi, source: "financial_measurement_snapshots", quality },
      { key: "spi", value: summary.spi, source: "financial_measurement_snapshots", quality },
      { key: "p50_eac", value: summary.p50Eac, source: "financial_forecast_scenarios", quality },
      { key: "p80_eac", value: summary.p80Eac, source: "financial_forecast_scenarios", quality },
    ],
    limitations,
    allowedOperations: ["explain", "compare", "trace"],
    prohibitedOperations: ["approve", "post", "release", "reopen", "execute"],
  };
}
