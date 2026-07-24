import type {
  AggregatedMetricValue,
  PmoAccessContext,
  PmoExchangeRate,
  PmoFinancialFact,
  PmoMoneyValue,
  PmoProjectFact,
  PmoRollupRequest,
} from "./contracts";
import { convertMoney } from "./currency";
import { selectLatestFacts } from "./facts";
import { buildMetricValue, unavailableMetric } from "./metric-value";
import { average, clamp, ratio } from "./math";
import { canReadPmoFinancials } from "./security";

export interface FinancialMetricResult {
  metrics: Record<string, AggregatedMetricValue>;
  factsByProject: Map<string, PmoFinancialFact>;
  exchangeRateIds: string[];
  currencyCoverage: number;
  evmCoverage: number;
  approvedBudgetByProject: Map<string, number>;
  warnings: string[];
}

const FINANCIAL_METRIC_IDS = [
  "original_baseline",
  "current_baseline",
  "approved_budget",
  "budget_at_completion",
  "committed_cost",
  "actual_cost",
  "accrued_cost",
  "remaining_budget",
  "estimate_to_complete",
  "estimate_at_completion",
  "variance_at_completion",
  "planned_value",
  "earned_value",
  "cost_variance",
  "schedule_variance",
  "portfolio_cpi",
  "portfolio_spi",
  "portfolio_tcpi",
  "contingency_available",
  "contingency_consumed",
  "management_reserve",
  "burn_rate",
  "cash_flow_actual",
  "cash_flow_forecast",
  "forecast_overrun",
  "benefits_realized",
  "benefits_projected",
  "portfolio_roi",
  "budget_consumption",
] as const;

type MoneyField =
  | "originalBaseline"
  | "currentBaseline"
  | "approvedBudget"
  | "bac"
  | "committedCost"
  | "actualCost"
  | "accruedCost"
  | "etc"
  | "eac"
  | "pv"
  | "ev"
  | "contingencyOriginal"
  | "contingencyAvailable"
  | "managementReserve"
  | "burnRate"
  | "cashFlowActual"
  | "cashFlowForecast"
  | "benefitsRealized"
  | "benefitsProjected";

interface ConvertedEntry {
  projectId: string;
  factId: string;
  value: number;
  exchangeRateId: string | null;
}

export function buildFinancialMetrics(
  projects: readonly PmoProjectFact[],
  facts: readonly PmoFinancialFact[],
  exchangeRates: readonly PmoExchangeRate[],
  access: PmoAccessContext,
  request: PmoRollupRequest,
  minimumEvmCoverage = 0.8,
): FinancialMetricResult {
  const metrics: Record<string, AggregatedMetricValue> = {};
  const projectIds = new Set(projects.map((project) => project.projectId));
  const scopedFacts = selectLatestFacts(
    facts.filter((fact) =>
      fact.organizationId === request.organizationId && projectIds.has(fact.projectId)),
    (fact) => fact.projectId,
    (fact) => fact.dataDate,
    (fact) => fact.factId,
    request.asOf,
  );
  const factsByProject = new Map(scopedFacts.map((fact) => [fact.projectId, fact]));
  const allProjectIds = projects.map((project) => project.projectId);
  const exchangeRateIds = new Set<string>();
  const warnings: string[] = [];

  if (!canReadPmoFinancials(access)) {
    for (const metricId of FINANCIAL_METRIC_IDS) {
      metrics[metricId] = unavailableMetric(
        metricId,
        request,
        projects.length,
        allProjectIds,
        "Financial aggregation is unavailable because the caller lacks financial.view.",
      );
    }
    metrics.portfolio_completion = buildFallbackCompletion(projects, request, null);
    return {
      metrics,
      factsByProject: new Map(),
      exchangeRateIds: [],
      currencyCoverage: 0,
      evmCoverage: 0,
      approvedBudgetByProject: new Map(),
      warnings: ["unauthorized_financial_data_excluded"],
    };
  }

  const converted = new Map<MoneyField, ConvertedEntry[]>();
  let requestedConversions = 0;
  let successfulConversions = 0;

  for (const field of moneyFields()) {
    const entries: ConvertedEntry[] = [];
    for (const fact of scopedFacts) {
      const money = fact[field] as PmoMoneyValue | null | undefined;
      if (!money) continue;
      requestedConversions += 1;
      const result = convertMoney(
        money,
        request.reportingCurrency,
        request.organizationId,
        request.asOf,
        exchangeRates,
      );
      if (result.value === null) {
        warnings.push(`${field}:missing_exchange_rate:${fact.projectId}`);
        continue;
      }
      successfulConversions += 1;
      if (result.exchangeRateId) exchangeRateIds.add(result.exchangeRateId);
      entries.push({
        projectId: fact.projectId,
        factId: fact.factId,
        value: result.value,
        exchangeRateId: result.exchangeRateId,
      });
    }
    converted.set(field, entries);
  }

  const currencyCoverage = requestedConversions === 0
    ? scopedFacts.length > 0 ? 1 : 0
    : successfulConversions / requestedConversions;
  const reliability = average(scopedFacts.map((fact) => fact.sourceReliability ?? 1)) ?? 0;

  const direct = (
    metricId: string,
    field: MoneyField,
    explanation: string,
  ): AggregatedMetricValue => {
    const entries = converted.get(field) ?? [];
    const eligibleProjectIds = [...new Set(entries.map((entry) => entry.projectId))];
    return buildMetricValue({
      metricId,
      value: entries.length > 0 ? entries.reduce((sum, entry) => sum + entry.value, 0) : null,
      request,
      populationCount: projects.length,
      eligibleEntityIds: eligibleProjectIds,
      excludedEntityIds: allProjectIds.filter((id) => !eligibleProjectIds.includes(id)),
      explanation,
      quality: { currencyConversionCoverage: currencyCoverage, sourceReliability: reliability },
      reportingCurrency: request.reportingCurrency,
    });
  };

  metrics.original_baseline = direct("original_baseline", "originalBaseline", "Sum of converted original baseline values.");
  metrics.current_baseline = direct("current_baseline", "currentBaseline", "Sum of converted current baseline values.");
  metrics.approved_budget = direct("approved_budget", "approvedBudget", "Sum of converted approved budgets.");
  metrics.budget_at_completion = direct("budget_at_completion", "bac", "Sum of converted BAC values.");
  metrics.committed_cost = direct("committed_cost", "committedCost", "Sum of commitments only; actuals and accruals are not added.");
  metrics.actual_cost = direct("actual_cost", "actualCost", "Sum of actual cost only; commitments and accruals are not added.");
  metrics.accrued_cost = direct("accrued_cost", "accruedCost", "Sum of accrual exposure only; actuals remain separate.");
  metrics.estimate_to_complete = direct("estimate_to_complete", "etc", "Sum of converted project ETC.");
  metrics.estimate_at_completion = direct("estimate_at_completion", "eac", "Sum of converted project EAC.");
  metrics.planned_value = direct("planned_value", "pv", "Sum of converted planned value.");
  metrics.earned_value = direct("earned_value", "ev", "Sum of converted earned value.");
  metrics.contingency_available = direct("contingency_available", "contingencyAvailable", "Sum of available contingency.");
  metrics.management_reserve = direct("management_reserve", "managementReserve", "Sum of management reserve.");
  metrics.burn_rate = direct("burn_rate", "burnRate", "Sum of comparable period burn-rate values.");
  metrics.cash_flow_actual = direct("cash_flow_actual", "cashFlowActual", "Sum of period actual cash flow.");
  metrics.cash_flow_forecast = direct("cash_flow_forecast", "cashFlowForecast", "Sum of period forecast cash flow.");
  metrics.benefits_realized = direct("benefits_realized", "benefitsRealized", "Sum of converted realized benefits.");
  metrics.benefits_projected = direct("benefits_projected", "benefitsProjected", "Sum of converted projected benefits.");

  const derivedDifference = (
    metricId: string,
    leftField: MoneyField,
    rightField: MoneyField,
    explanation: string,
  ): AggregatedMetricValue => {
    const pairs = pairedValues(converted, leftField, rightField);
    return buildMetricValue({
      metricId,
      value: pairs.length > 0
        ? pairs.reduce((sum, pair) => sum + pair.left - pair.right, 0)
        : null,
      request,
      populationCount: projects.length,
      eligibleEntityIds: pairs.map((pair) => pair.projectId),
      excludedEntityIds: allProjectIds.filter((id) => !pairs.some((pair) => pair.projectId === id)),
      explanation,
      quality: { currencyConversionCoverage: currencyCoverage, sourceReliability: reliability },
      reportingCurrency: request.reportingCurrency,
    });
  };

  metrics.remaining_budget = derivedDifference(
    "remaining_budget",
    "approvedBudget",
    "actualCost",
    "Σ approved budget - Σ actual cost. Commitments and accruals are excluded by policy.",
  );
  metrics.variance_at_completion = derivedDifference(
    "variance_at_completion",
    "bac",
    "eac",
    "Σ BAC - Σ EAC.",
  );
  metrics.cost_variance = derivedDifference(
    "cost_variance",
    "ev",
    "actualCost",
    "Σ EV - Σ AC.",
  );
  metrics.schedule_variance = derivedDifference(
    "schedule_variance",
    "ev",
    "pv",
    "Σ EV - Σ PV. This is EVM schedule variance, not calendar delay.",
  );
  metrics.contingency_consumed = derivedDifference(
    "contingency_consumed",
    "contingencyOriginal",
    "contingencyAvailable",
    "Σ original contingency - Σ available contingency.",
  );

  const cpiPairs = pairedValues(converted, "ev", "actualCost");
  const cpiNumerator = cpiPairs.reduce((sum, pair) => sum + pair.left, 0);
  const cpiDenominator = cpiPairs.reduce((sum, pair) => sum + pair.right, 0);
  metrics.portfolio_cpi = ratioMetric(
    "portfolio_cpi",
    cpiPairs,
    cpiNumerator,
    cpiDenominator,
    "Portfolio CPI = Σ EV / Σ AC. Project CPI values are never averaged.",
  );

  const spiPairs = pairedValues(converted, "ev", "pv");
  const spiNumerator = spiPairs.reduce((sum, pair) => sum + pair.left, 0);
  const spiDenominator = spiPairs.reduce((sum, pair) => sum + pair.right, 0);
  metrics.portfolio_spi = ratioMetric(
    "portfolio_spi",
    spiPairs,
    spiNumerator,
    spiDenominator,
    "Portfolio SPI = Σ EV / Σ PV. Project SPI values are never averaged.",
  );

  const tcpiProjects = intersectProjects(converted, ["bac", "ev", "actualCost"]);
  const tcpiBac = sumForProjects(converted, "bac", tcpiProjects);
  const tcpiEv = sumForProjects(converted, "ev", tcpiProjects);
  const tcpiAc = sumForProjects(converted, "actualCost", tcpiProjects);
  const tcpiDenominator = tcpiBac - tcpiAc;
  metrics.portfolio_tcpi = buildMetricValue({
    metricId: "portfolio_tcpi",
    value: tcpiDenominator > 0 ? (tcpiBac - tcpiEv) / tcpiDenominator : null,
    numerator: tcpiBac - tcpiEv,
    denominator: tcpiDenominator,
    request,
    populationCount: projects.length,
    eligibleEntityIds: tcpiProjects,
    excludedEntityIds: allProjectIds.filter((id) => !tcpiProjects.includes(id)),
    explanation: "Portfolio TCPI = (Σ BAC - Σ EV) / (Σ BAC - Σ AC).",
    quality: { currencyConversionCoverage: currencyCoverage, sourceReliability: reliability },
  });

  const budgetPairs = pairedValues(converted, "actualCost", "approvedBudget");
  const budgetNumerator = budgetPairs.reduce((sum, pair) => sum + pair.left, 0);
  const budgetDenominator = budgetPairs.reduce((sum, pair) => sum + pair.right, 0);
  metrics.budget_consumption = ratioMetric(
    "budget_consumption",
    budgetPairs,
    budgetNumerator,
    budgetDenominator,
    "Budget consumption = Σ actual cost / Σ approved budget. Accrual is not silently included.",
    100,
  );

  const overrunPairs = pairedValues(converted, "eac", "bac");
  metrics.forecast_overrun = buildMetricValue({
    metricId: "forecast_overrun",
    value: overrunPairs.length > 0
      ? overrunPairs.reduce((sum, pair) => sum + Math.max(0, pair.left - pair.right), 0)
      : null,
    request,
    populationCount: projects.length,
    eligibleEntityIds: overrunPairs.map((pair) => pair.projectId),
    excludedEntityIds: allProjectIds.filter((id) => !overrunPairs.some((pair) => pair.projectId === id)),
    explanation: "Σ max(0, project EAC - project BAC).",
    quality: { currencyConversionCoverage: currencyCoverage, sourceReliability: reliability },
  });

  const roiProjects = intersectProjects(converted, ["benefitsRealized", "actualCost"]);
  const realized = sumForProjects(converted, "benefitsRealized", roiProjects);
  const roiCost = sumForProjects(converted, "actualCost", roiProjects);
  metrics.portfolio_roi = buildMetricValue({
    metricId: "portfolio_roi",
    value: ratio(realized - roiCost, roiCost),
    numerator: realized - roiCost,
    denominator: roiCost,
    request,
    populationCount: projects.length,
    eligibleEntityIds: roiProjects,
    excludedEntityIds: allProjectIds.filter((id) => !roiProjects.includes(id)),
    explanation: "Portfolio ROI = (Σ realized benefits - Σ actual cost) / Σ actual cost.",
    quality: { currencyConversionCoverage: currencyCoverage, sourceReliability: reliability },
  });

  const evmProjectIds = intersectProjects(converted, ["ev", "bac"]);
  const evmCoverage = projects.length === 0 ? 0 : evmProjectIds.length / projects.length;
  metrics.portfolio_completion = buildCompletionMetric(
    projects,
    converted,
    request,
    minimumEvmCoverage,
    evmCoverage,
  );

  return {
    metrics,
    factsByProject,
    exchangeRateIds: [...exchangeRateIds].sort(),
    currencyCoverage,
    evmCoverage,
    approvedBudgetByProject: new Map(
      (converted.get("approvedBudget") ?? []).map((entry) => [entry.projectId, entry.value]),
    ),
    warnings: [...new Set(warnings)].sort(),
  };

  function ratioMetric(
    metricId: string,
    pairs: Array<{ projectId: string; left: number; right: number }>,
    numerator: number,
    denominator: number,
    explanation: string,
    multiplier = 1,
  ): AggregatedMetricValue {
    const raw = ratio(numerator, denominator);
    return buildMetricValue({
      metricId,
      value: raw === null ? null : raw * multiplier,
      numerator,
      denominator,
      request,
      populationCount: projects.length,
      eligibleEntityIds: pairs.map((pair) => pair.projectId),
      excludedEntityIds: allProjectIds.filter((id) => !pairs.some((pair) => pair.projectId === id)),
      explanation,
      aggregationMethod: "ratio-of-sums",
      quality: { currencyConversionCoverage: currencyCoverage, sourceReliability: reliability },
    });
  }
}

function buildCompletionMetric(
  projects: readonly PmoProjectFact[],
  converted: Map<MoneyField, ConvertedEntry[]>,
  request: PmoRollupRequest,
  minimumEvmCoverage: number,
  evmCoverage: number,
): AggregatedMetricValue {
  const allIds = projects.map((project) => project.projectId);
  const evmProjects = intersectProjects(converted, ["ev", "bac"]);
  if (evmCoverage >= clamp(minimumEvmCoverage) && evmProjects.length > 0) {
    const ev = sumForProjects(converted, "ev", evmProjects);
    const bac = sumForProjects(converted, "bac", evmProjects);
    const completion = ratio(ev, bac);
    return buildMetricValue({
      metricId: "portfolio_completion",
      value: completion === null ? null : completion * 100,
      numerator: ev,
      denominator: bac,
      request,
      populationCount: projects.length,
      eligibleEntityIds: evmProjects,
      excludedEntityIds: allIds.filter((id) => !evmProjects.includes(id)),
      explanation: "Portfolio completion = Σ EV / Σ BAC because EVM coverage met the configured threshold.",
      aggregationMethod: "ratio-of-sums",
      quality: { evmCoverage },
    });
  }

  const bacByProject = new Map((converted.get("bac") ?? []).map((entry) => [entry.projectId, entry.value]));
  const bacWeighted = projects.flatMap((project) => {
    const weight = bacByProject.get(project.projectId);
    return project.completionPercent == null || weight == null || weight <= 0
      ? []
      : [{ projectId: project.projectId, completion: project.completionPercent, weight }];
  });
  if (bacWeighted.length > 0) {
    const denominator = bacWeighted.reduce((sum, entry) => sum + entry.weight, 0);
    return buildMetricValue({
      metricId: "portfolio_completion",
      value: bacWeighted.reduce((sum, entry) => sum + entry.completion * entry.weight, 0) / denominator,
      denominator,
      request,
      populationCount: projects.length,
      eligibleEntityIds: bacWeighted.map((entry) => entry.projectId),
      excludedEntityIds: allIds.filter((id) => !bacWeighted.some((entry) => entry.projectId === id)),
      explanation: "Portfolio completion = Σ(project completion × BAC) / Σ BAC because EVM coverage was insufficient.",
      aggregationMethod: "weighted-average",
      quality: { evmCoverage },
    });
  }

  return buildFallbackCompletion(projects, request, evmCoverage);
}

function buildFallbackCompletion(
  projects: readonly PmoProjectFact[],
  request: PmoRollupRequest,
  evmCoverage: number | null,
): AggregatedMetricValue {
  const weighted = projects.flatMap((project) =>
    project.completionPercent == null || project.strategicWeight == null || project.strategicWeight <= 0
      ? []
      : [{
          projectId: project.projectId,
          completion: project.completionPercent,
          weight: project.strategicWeight,
        }]);
  if (weighted.length > 0) {
    const denominator = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    return buildMetricValue({
      metricId: "portfolio_completion",
      value: weighted.reduce((sum, entry) => sum + entry.completion * entry.weight, 0) / denominator,
      denominator,
      request,
      populationCount: projects.length,
      eligibleEntityIds: weighted.map((entry) => entry.projectId),
      excludedEntityIds: projects.filter((project) => !weighted.some((entry) => entry.projectId === project.projectId)).map((project) => project.projectId),
      explanation: "Portfolio completion uses governed strategic weights because reliable EVM/BAC weights were unavailable.",
      aggregationMethod: "weighted-average",
      quality: { evmCoverage: evmCoverage ?? 0 },
    });
  }

  const simple = projects.filter((project) => project.completionPercent != null);
  return buildMetricValue({
    metricId: "portfolio_completion",
    value: average(simple.map((project) => project.completionPercent as number)),
    request,
    populationCount: projects.length,
    eligibleEntityIds: simple.map((project) => project.projectId),
    excludedEntityIds: projects.filter((project) => project.completionPercent == null).map((project) => project.projectId),
    explanation: "Estimated simple average used only because no reliable EVM, BAC, or strategic weight was available.",
    aggregationMethod: "average",
    estimated: true,
    quality: { evmCoverage: evmCoverage ?? 0, sourceReliability: 0.5 },
  });
}

function pairedValues(
  converted: Map<MoneyField, ConvertedEntry[]>,
  leftField: MoneyField,
  rightField: MoneyField,
): Array<{ projectId: string; left: number; right: number }> {
  const left = new Map((converted.get(leftField) ?? []).map((entry) => [entry.projectId, entry.value]));
  const right = new Map((converted.get(rightField) ?? []).map((entry) => [entry.projectId, entry.value]));
  return [...left.entries()]
    .filter(([projectId]) => right.has(projectId))
    .map(([projectId, value]) => ({ projectId, left: value, right: right.get(projectId) as number }))
    .sort((a, b) => a.projectId.localeCompare(b.projectId));
}

function intersectProjects(
  converted: Map<MoneyField, ConvertedEntry[]>,
  fields: MoneyField[],
): string[] {
  if (fields.length === 0) return [];
  const sets = fields.map((field) => new Set((converted.get(field) ?? []).map((entry) => entry.projectId)));
  return [...sets[0]].filter((projectId) => sets.every((set) => set.has(projectId))).sort();
}

function sumForProjects(
  converted: Map<MoneyField, ConvertedEntry[]>,
  field: MoneyField,
  projectIds: readonly string[],
): number {
  const allowed = new Set(projectIds);
  return (converted.get(field) ?? [])
    .filter((entry) => allowed.has(entry.projectId))
    .reduce((sum, entry) => sum + entry.value, 0);
}

function moneyFields(): MoneyField[] {
  return [
    "originalBaseline",
    "currentBaseline",
    "approvedBudget",
    "bac",
    "committedCost",
    "actualCost",
    "accruedCost",
    "etc",
    "eac",
    "pv",
    "ev",
    "contingencyOriginal",
    "contingencyAvailable",
    "managementReserve",
    "burnRate",
    "cashFlowActual",
    "cashFlowForecast",
    "benefitsRealized",
    "benefitsProjected",
  ];
}
