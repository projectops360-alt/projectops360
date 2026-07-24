import type {
  AggregatedMetricValue,
  PmoAggregationMethod,
  PmoMetricStatus,
  PmoRollupRequest,
} from "./contracts";
import { getPmoMetricDefinition } from "./metric-registry";
import { clamp } from "./math";
import { confidenceFromSignals, statusFromCoverage, type PmoQualitySignals } from "./quality";

export interface MetricValueInput {
  metricId: string;
  value: number | null;
  request: PmoRollupRequest;
  populationCount: number;
  eligibleEntityIds: string[];
  excludedEntityIds?: string[];
  explanation: string;
  numerator?: number;
  denominator?: number;
  aggregationMethod?: PmoAggregationMethod;
  status?: PmoMetricStatus;
  estimated?: boolean;
  quality?: Partial<PmoQualitySignals>;
  reportingCurrency?: string;
  calendarType?: "business-days" | "calendar-days";
}

export function buildMetricValue(input: MetricValueInput): AggregatedMetricValue {
  const definition = getPmoMetricDefinition(input.metricId);
  const sourceEntityIds = [...new Set(input.eligibleEntityIds)].sort();
  const excludedEntityIds = [...new Set(input.excludedEntityIds ?? [])].sort();
  const eligibleCount = sourceEntityIds.length;
  const excludedCount = excludedEntityIds.length;
  const coverage = input.populationCount === 0
    ? 0
    : clamp(eligibleCount / input.populationCount);
  const status = input.status
    ?? statusFromCoverage(input.value, coverage, input.estimated);
  const confidenceScore = status === "not-calculable"
    ? 0
    : confidenceFromSignals({
        completeness: coverage,
        sampleSufficiency: clamp(eligibleCount / 5),
        ...input.quality,
      });

  return {
    metricId: input.metricId,
    value: input.value,
    unit: definition.unit,
    numerator: input.numerator,
    denominator: input.denominator,
    populationCount: input.populationCount,
    eligibleCount,
    excludedCount,
    coveragePercent: coverage * 100,
    confidenceScore,
    aggregationMethod: input.aggregationMethod ?? definition.aggregationMethod,
    formulaVersion: definition.formulaVersion,
    asOf: input.request.asOf,
    periodStart: input.request.periodStart,
    periodEnd: input.request.periodEnd,
    reportingCurrency: definition.unit === "currency"
      ? input.reportingCurrency ?? input.request.reportingCurrency
      : undefined,
    calendarType: definition.unit === "days"
      ? input.calendarType ?? input.request.calendarType ?? "business-days"
      : undefined,
    status,
    sourceEntityIds,
    excludedEntityIds: excludedEntityIds.length > 0 ? excludedEntityIds : undefined,
    explanation: input.explanation,
  };
}

export function unavailableMetric(
  metricId: string,
  request: PmoRollupRequest,
  populationCount: number,
  excludedEntityIds: string[],
  explanation: string,
): AggregatedMetricValue {
  return buildMetricValue({
    metricId,
    value: null,
    request,
    populationCount,
    eligibleEntityIds: [],
    excludedEntityIds,
    explanation,
    status: "not-calculable",
  });
}
