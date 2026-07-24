import type {
  AggregatedMetricValue,
  PmoDataQualitySummary,
  PmoHealthScoreConfiguration,
  PmoHealthScoreResult,
  PmoRollupRequest,
} from "./contracts";
import { buildMetricValue } from "./metric-value";
import { clamp } from "./math";

export const DEFAULT_PMO_HEALTH_CONFIGURATION: PmoHealthScoreConfiguration = {
  version: "1.0.0",
  weights: {
    schedule: 0.25,
    financial: 0.25,
    risk: 0.2,
    delivery: 0.15,
    resource: 0.1,
    dataQuality: 0.05,
  },
  thresholds: {
    cpiCritical: 0.8,
    cpiWarning: 0.9,
    criticalRiskPenalty: 20,
    highRiskPenalty: 10,
  },
};

export function buildHealthScore(
  metrics: Record<string, AggregatedMetricValue>,
  dataQuality: PmoDataQualitySummary,
  request: PmoRollupRequest,
  configuration: PmoHealthScoreConfiguration = DEFAULT_PMO_HEALTH_CONFIGURATION,
): { result: PmoHealthScoreResult; metric: AggregatedMetricValue } {
  const subscores: PmoHealthScoreResult["subscores"] = {
    schedule: value(metrics.on_time_delivery_rate),
    financial: financialScore(metrics),
    risk: riskScore(metrics, configuration),
    delivery: deliveryScore(metrics),
    resource: resourceScore(metrics),
    dataQuality: dataQuality.overallScore * 100,
  };

  let weightedScore = 0;
  let appliedWeight = 0;
  for (const key of Object.keys(configuration.weights) as Array<keyof typeof configuration.weights>) {
    const subscore = subscores[key];
    if (subscore == null) continue;
    const weight = configuration.weights[key];
    weightedScore += clamp(subscore, 0, 100) * weight;
    appliedWeight += weight;
  }
  const score = appliedWeight > 0 ? weightedScore / appliedWeight : null;
  const drivers = (Object.entries(subscores) as Array<[keyof typeof subscores, number | null]>)
    .filter((entry): entry is [keyof typeof subscores, number] => entry[1] != null)
    .sort((left, right) => left[1] - right[1])
    .slice(0, 3)
    .map(([key]) => key);

  const result: PmoHealthScoreResult = {
    score,
    subscores,
    weights: configuration.weights,
    formula: "Σ(available atomic subscore × configured weight) / Σ(applied weights)",
    configVersion: configuration.version,
    primaryDrivers: drivers,
    previousPeriodChange: null,
    confidenceScore: dataQuality.overallScore,
  };

  const sourceIds = [...new Set(
    Object.values(metrics).flatMap((metricValue) => metricValue.sourceEntityIds),
  )].sort();
  const metric = buildMetricValue({
    metricId: "health_score",
    value: score,
    request,
    populationCount: sourceIds.length,
    eligibleEntityIds: sourceIds,
    explanation: `${result.formula}; configuration ${configuration.version}. Project health scores are not averaged.`,
    quality: {
      completeness: dataQuality.completeness,
      freshness: dataQuality.freshness,
      sourceReliability: dataQuality.sourceReliability,
    },
  });

  return { result, metric };
}

function value(metric: AggregatedMetricValue | undefined): number | null {
  return metric?.value ?? null;
}

function financialScore(metrics: Record<string, AggregatedMetricValue>): number | null {
  const cpi = value(metrics.portfolio_cpi);
  if (cpi != null) return clamp(cpi, 0, 1) * 100;
  const vac = value(metrics.variance_at_completion);
  const bac = value(metrics.budget_at_completion);
  if (vac == null || bac == null || bac <= 0) return null;
  return clamp(1 + vac / bac, 0, 1) * 100;
}

function riskScore(
  metrics: Record<string, AggregatedMetricValue>,
  configuration: PmoHealthScoreConfiguration,
): number | null {
  const critical = value(metrics.critical_risks);
  const high = value(metrics.high_risks);
  if (critical == null && high == null) return null;
  const penalty =
    (critical ?? 0) * (configuration.thresholds.criticalRiskPenalty ?? 20)
    + (high ?? 0) * (configuration.thresholds.highRiskPenalty ?? 10);
  return clamp(100 - penalty, 0, 100);
}

function deliveryScore(metrics: Record<string, AggregatedMetricValue>): number | null {
  const completion = value(metrics.portfolio_completion);
  const rework = value(metrics.rework_rate);
  if (completion == null && rework == null) return null;
  return clamp((completion ?? 50) - (rework ?? 0) * 0.25, 0, 100);
}

function resourceScore(metrics: Record<string, AggregatedMetricValue>): number | null {
  const capacity = value(metrics.total_resource_capacity);
  const overallocated = value(metrics.overallocated_hours);
  if (capacity == null || capacity <= 0 || overallocated == null) return null;
  return clamp(100 - overallocated / capacity * 100, 0, 100);
}
