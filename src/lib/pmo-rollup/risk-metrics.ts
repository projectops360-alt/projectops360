import type {
  AggregatedMetricValue,
  PmoExchangeRate,
  PmoRiskFact,
  PmoRollupRequest,
} from "./contracts";
import { convertMoney } from "./currency";
import { buildMetricValue, unavailableMetric } from "./metric-value";
import { average, ratio } from "./math";

export interface DeduplicatedRiskFact extends PmoRiskFact {
  contributingFactIds: string[];
}

export interface RiskMetricResult {
  metrics: Record<string, AggregatedMetricValue>;
  risks: DeduplicatedRiskFact[];
  exchangeRateIds: string[];
  currencyCoverage: number;
  warnings: string[];
}

export function buildRiskMetrics(
  facts: readonly PmoRiskFact[],
  scopedProjectIds: readonly string[],
  exchangeRates: readonly PmoExchangeRate[],
  request: PmoRollupRequest,
): RiskMetricResult {
  const allowed = new Set(scopedProjectIds);
  const risks = deduplicateRisks(
    facts.filter((fact) =>
      fact.organizationId === request.organizationId
      && fact.effectiveAt <= request.asOf
      && fact.affectedProjectIds.some((projectId) => allowed.has(projectId))),
  ).map((risk) => ({
    ...risk,
    affectedProjectIds: risk.affectedProjectIds.filter((projectId) => allowed.has(projectId)).sort(),
  }));
  const open = risks.filter((risk) => risk.status === "open" || risk.status === "mitigating");
  const openIds = open.map((risk) => risk.riskId);
  const metrics: Record<string, AggregatedMetricValue> = {};
  const warnings: string[] = [];
  const exchangeRateIds = new Set<string>();
  const reliability = average(open.map((risk) => risk.sourceReliability ?? 1)) ?? 0;

  const count = (
    metricId: string,
    selected: readonly DeduplicatedRiskFact[],
    explanation: string,
  ) => buildMetricValue({
    metricId,
    value: selected.length,
    request,
    populationCount: open.length,
    eligibleEntityIds: selected.map((risk) => risk.riskId),
    explanation,
    quality: { sourceReliability: reliability },
  });

  metrics.total_open_risks = count(
    "total_open_risks",
    open,
    "Count-distinct of open or mitigating risks by canonical risk ID.",
  );
  metrics.unique_risks = count(
    "unique_risks",
    open,
    "Open risks deduplicated by canonical risk ID across all affected projects.",
  );
  for (const severity of ["critical", "high", "medium", "low"] as const) {
    metrics[`${severity}_risks`] = count(
      `${severity}_risks`,
      open.filter((risk) => risk.severity === severity),
      `Count-distinct of open ${severity} risks.`,
    );
  }

  const criticalProjects = [...new Set(
    open
      .filter((risk) => risk.severity === "critical")
      .flatMap((risk) => risk.affectedProjectIds),
  )].sort();
  metrics.projects_with_critical_risks = buildMetricValue({
    metricId: "projects_with_critical_risks",
    value: criticalProjects.length,
    request,
    populationCount: scopedProjectIds.length,
    eligibleEntityIds: criticalProjects,
    explanation: "Count-distinct of authorized projects affected by at least one open critical risk.",
    quality: { sourceReliability: reliability },
  });

  const scheduleEligible = open.filter((risk) =>
    risk.scheduleImpactDays != null && Number.isFinite(risk.scheduleImpactDays));
  const expectedDelayEligible = scheduleEligible.filter((risk) =>
    risk.probability != null && risk.probability >= 0 && risk.probability <= 1);
  const residualDelayEligible = open.filter((risk) =>
    risk.residualProbability != null
    && risk.residualProbability >= 0
    && risk.residualProbability <= 1
    && risk.residualScheduleImpactDays != null
    && Number.isFinite(risk.residualScheduleImpactDays));

  metrics.gross_schedule_risk_days = riskNumberMetric(
    "gross_schedule_risk_days",
    scheduleEligible,
    scheduleEligible.reduce((sum, risk) => sum + Math.max(0, risk.scheduleImpactDays as number), 0),
    "Σ unique risk schedule impact days. Actual project delay is not included.",
  );
  metrics.expected_risk_delay_days = riskNumberMetric(
    "expected_risk_delay_days",
    expectedDelayEligible,
    expectedDelayEligible.reduce(
      (sum, risk) => sum + (risk.probability as number) * Math.max(0, risk.scheduleImpactDays as number),
      0,
    ),
    "Σ(probability × schedule impact days) over unique risks. This is future exposure, not actual delay.",
  );
  metrics.mitigated_expected_delay_days = riskNumberMetric(
    "mitigated_expected_delay_days",
    residualDelayEligible,
    residualDelayEligible.reduce(
      (sum, risk) =>
        sum + (risk.residualProbability as number) * Math.max(0, risk.residualScheduleImpactDays as number),
      0,
    ),
    "Σ(residual probability × residual schedule impact days) over unique risks.",
  );

  const grossCost = convertRiskCosts(open, "gross");
  const residualCost = convertRiskCosts(open, "residual");
  metrics.gross_risk_cost = riskCurrencyMetric(
    "gross_risk_cost",
    grossCost.entries,
    grossCost.entries.reduce((sum, entry) => sum + entry.value, 0),
    "Σ converted gross cost impact over unique risks.",
  );
  metrics.expected_risk_cost = riskCurrencyMetric(
    "expected_risk_cost",
    grossCost.entries.filter((entry) => entry.probability != null),
    grossCost.entries.reduce(
      (sum, entry) => sum + (entry.probability == null ? 0 : entry.value * entry.probability),
      0,
    ),
    "Σ(probability × converted cost impact) over unique risks.",
  );
  metrics.residual_risk_exposure = riskCurrencyMetric(
    "residual_risk_exposure",
    residualCost.entries.filter((entry) => entry.probability != null),
    residualCost.entries.reduce(
      (sum, entry) => sum + (entry.probability == null ? 0 : entry.value * entry.probability),
      0,
    ),
    "Σ(residual probability × converted residual cost impact) over unique risks.",
  );

  const systemic = open.filter((risk) => risk.affectedProjectIds.length > 1);
  metrics.systemic_risks = count(
    "systemic_risks",
    systemic,
    "Count-distinct of open risks affecting more than one authorized project.",
  );
  metrics.cross_project_risks = count(
    "cross_project_risks",
    systemic,
    "Count-distinct of cross-project risks, deduplicated by canonical risk ID.",
  );

  const highCritical = open.filter((risk) => risk.severity === "critical" || risk.severity === "high");
  const exposureByProject = new Map<string, number>();
  for (const risk of highCritical) {
    for (const projectId of risk.affectedProjectIds) {
      exposureByProject.set(projectId, (exposureByProject.get(projectId) ?? 0) + 1);
    }
  }
  const concentrated = exposureByProject.size === 0
    ? 0
    : Math.max(...exposureByProject.values());
  const totalAssignments = [...exposureByProject.values()].reduce((sum, value) => sum + value, 0);
  const concentration = ratio(concentrated, totalAssignments);
  metrics.risk_concentration = buildMetricValue({
    metricId: "risk_concentration",
    value: concentration === null ? 0 : concentration * 100,
    numerator: concentrated,
    denominator: totalAssignments,
    request,
    populationCount: scopedProjectIds.length,
    eligibleEntityIds: [...exposureByProject.keys()].sort(),
    explanation: "Largest project share of open high/critical risk-project assignments.",
    quality: { sourceReliability: reliability },
  });
  metrics.risk_trend = unavailableMetric(
    "risk_trend",
    request,
    open.length,
    openIds,
    "Risk history is not bitemporally modeled; a reliable previous-period trend is unavailable.",
  );

  const currencyRequests = grossCost.requested + residualCost.requested;
  const currencySuccesses = grossCost.succeeded + residualCost.succeeded;
  const currencyCoverage = currencyRequests === 0 ? open.length > 0 ? 1 : 0 : currencySuccesses / currencyRequests;

  return {
    metrics,
    risks,
    exchangeRateIds: [...exchangeRateIds].sort(),
    currencyCoverage,
    warnings: [...new Set(warnings)].sort(),
  };

  function riskNumberMetric(
    metricId: string,
    eligible: readonly DeduplicatedRiskFact[],
    value: number,
    explanation: string,
  ): AggregatedMetricValue {
    const eligibleIds = eligible.map((risk) => risk.riskId);
    return buildMetricValue({
      metricId,
      value: eligible.length > 0 ? value : null,
      request,
      populationCount: open.length,
      eligibleEntityIds: eligibleIds,
      excludedEntityIds: openIds.filter((id) => !eligibleIds.includes(id)),
      explanation,
      quality: { sourceReliability: reliability },
    });
  }

  function riskCurrencyMetric(
    metricId: string,
    entries: Array<{ riskId: string; value: number; probability: number | null }>,
    value: number,
    explanation: string,
  ): AggregatedMetricValue {
    const eligibleIds = entries.map((entry) => entry.riskId);
    return buildMetricValue({
      metricId,
      value: entries.length > 0 ? value : null,
      request,
      populationCount: open.length,
      eligibleEntityIds: eligibleIds,
      excludedEntityIds: openIds.filter((id) => !eligibleIds.includes(id)),
      explanation,
      quality: {
        sourceReliability: reliability,
        currencyConversionCoverage: open.length === 0 ? 0 : eligibleIds.length / open.length,
      },
      reportingCurrency: request.reportingCurrency,
    });
  }

  function convertRiskCosts(
    candidates: readonly DeduplicatedRiskFact[],
    kind: "gross" | "residual",
  ) {
    const entries: Array<{ riskId: string; value: number; probability: number | null }> = [];
    let requested = 0;
    let succeeded = 0;
    for (const risk of candidates) {
      const money = kind === "gross" ? risk.costImpact : risk.residualCostImpact;
      if (!money) continue;
      requested += 1;
      const converted = convertMoney(
        money,
        request.reportingCurrency,
        request.organizationId,
        request.asOf,
        exchangeRates,
      );
      if (converted.value === null) {
        warnings.push(`risk_cost:missing_exchange_rate:${risk.riskId}`);
        continue;
      }
      succeeded += 1;
      if (converted.exchangeRateId) exchangeRateIds.add(converted.exchangeRateId);
      entries.push({
        riskId: risk.riskId,
        value: converted.value,
        probability: kind === "gross" ? risk.probability ?? null : risk.residualProbability ?? null,
      });
    }
    return { entries, requested, succeeded };
  }
}

function deduplicateRisks(facts: readonly PmoRiskFact[]): DeduplicatedRiskFact[] {
  const byRisk = new Map<string, PmoRiskFact[]>();
  for (const fact of facts) {
    const list = byRisk.get(fact.riskId) ?? [];
    list.push(fact);
    byRisk.set(fact.riskId, list);
  }

  return [...byRisk.entries()].map(([riskId, versions]) => {
    const latestDate = versions.reduce(
      (latest, fact) => fact.effectiveAt > latest ? fact.effectiveAt : latest,
      "",
    );
    const latest = versions
      .filter((fact) => fact.effectiveAt === latestDate)
      .sort((left, right) => left.factId.localeCompare(right.factId));
    const representative = latest[0] as PmoRiskFact;
    return {
      ...representative,
      riskId,
      affectedProjectIds: [...new Set(latest.flatMap((fact) => fact.affectedProjectIds))].sort(),
      contributingFactIds: latest.map((fact) => fact.factId).sort(),
    };
  }).sort((left, right) => left.riskId.localeCompare(right.riskId));
}
