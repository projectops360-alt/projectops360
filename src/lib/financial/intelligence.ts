import type { FinancialCockpitSummary } from "./read-model.server";
import { calculateFinancialSetupLine, type FinancialSetupLineInput } from "./setup-model";

export interface FinancialSetupLineFact {
  name: string;
  costType: string;
  resourceName: string | null;
  quantity: number;
  quantityUnit: string;
  rate: number;
  rateUnit: string;
  periodBasis: string;
  periodCount: number;
  amount: number;
  amountPerPeriod: number;
  plannedHours: number | null;
  controlAccountRef: string | null;
  cbsCode: string | null;
  wbsRef: string | null;
}

export interface FinancialSetupIntelligence {
  status: "not_configured" | "draft" | "submitted" | "active";
  estimateId: string | null;
  title: string | null;
  purpose: string | null;
  currency: string;
  estimateClass: string | null;
  totalAmount: number | null;
  totalPlannedHours: number | null;
  lineCount: number;
  boeStatus: string | null;
  baselineStatuses: Record<string, string>;
  lines: FinancialSetupLineFact[];
}

export interface FinancialSetupSource {
  estimate: {
    id: string;
    status: string;
    title: string;
    purpose: string;
    currency: string;
    classificationValue: string | null;
  };
  boe: { status: string } | null;
  baselineStatuses: Record<string, string>;
  lines: FinancialSetupLineInput[];
}

export function buildFinancialSetupIntelligence(source: FinancialSetupSource | null): FinancialSetupIntelligence {
  if (!source) {
    return {
      status: "not_configured",
      estimateId: null,
      title: null,
      purpose: null,
      currency: "USD",
      estimateClass: null,
      totalAmount: null,
      totalPlannedHours: null,
      lineCount: 0,
      boeStatus: null,
      baselineStatuses: {},
      lines: [],
    };
  }

  const calculatedLines = source.lines.map(calculateFinancialSetupLine);
  const totalAmount = calculatedLines.reduce((total, line) => total + line.amount, 0);
  const plannedHours = calculatedLines
    .map((line) => line.plannedHours)
    .filter((hours): hours is number => hours != null)
    .reduce((total, hours) => total + hours, 0);
  const hasActiveBaseline = Object.values(source.baselineStatuses).some((status) => status === "active");
  const status: FinancialSetupIntelligence["status"] = source.estimate.status === "active" || hasActiveBaseline
    ? "active"
    : source.estimate.status === "submitted" || source.boe?.status === "submitted"
      ? "submitted"
      : "draft";

  return {
    status,
    estimateId: source.estimate.id,
    title: source.estimate.title,
    purpose: source.estimate.purpose,
    currency: source.estimate.currency,
    estimateClass: source.estimate.classificationValue,
    totalAmount,
    totalPlannedHours: calculatedLines.some((line) => line.plannedHours != null) ? plannedHours : null,
    lineCount: calculatedLines.length,
    boeStatus: source.boe?.status ?? null,
    baselineStatuses: source.baselineStatuses,
    lines: calculatedLines.map((line) => ({
      name: line.name,
      costType: line.costType,
      resourceName: line.resourceName,
      quantity: line.quantity,
      quantityUnit: line.quantityUnit,
      rate: line.rate,
      rateUnit: line.rateUnit,
      periodBasis: line.periodBasis,
      periodCount: line.periodCount,
      amount: line.amount,
      amountPerPeriod: line.amountPerPeriod,
      plannedHours: line.plannedHours,
      controlAccountRef: line.controlAccountRef,
      cbsCode: line.cbsCode,
      wbsRef: line.wbsRef,
    })),
  };
}

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
  setup?: FinancialSetupIntelligence;
  limitations: string[];
  allowedOperations: readonly ["explain", "compare", "trace"];
  prohibitedOperations: readonly ["approve", "post", "release", "reopen", "execute"];
}

export function buildFinancialIntelligenceContext(
  summary: FinancialCockpitSummary,
  setup?: FinancialSetupIntelligence,
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
    setup,
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
