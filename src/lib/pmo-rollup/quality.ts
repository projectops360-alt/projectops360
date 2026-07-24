import type {
  PmoDataQualitySummary,
  PmoMetricStatus,
} from "./contracts";
import { clamp } from "./math";

export interface PmoQualitySignals {
  completeness: number;
  freshness: number;
  baselineAvailability: number;
  eventContinuity: number;
  sampleSufficiency: number;
  currencyConversionCoverage: number;
  evmCoverage: number;
  dateValidity: number;
  mappingCoverage: number;
  sourceReliability: number;
}

const QUALITY_WEIGHTS: Record<keyof PmoQualitySignals, number> = {
  completeness: 0.2,
  freshness: 0.1,
  baselineAvailability: 0.1,
  eventContinuity: 0.08,
  sampleSufficiency: 0.08,
  currencyConversionCoverage: 0.12,
  evmCoverage: 0.1,
  dateValidity: 0.07,
  mappingCoverage: 0.08,
  sourceReliability: 0.07,
};

export function confidenceFromSignals(signals: Partial<PmoQualitySignals>): number {
  let weighted = 0;
  let weight = 0;
  for (const [key, factor] of Object.entries(QUALITY_WEIGHTS) as Array<[keyof PmoQualitySignals, number]>) {
    const value = signals[key];
    if (value === undefined) continue;
    weighted += clamp(value) * factor;
    weight += factor;
  }
  return weight === 0 ? 0 : clamp(weighted / weight);
}

export function statusFromCoverage(
  value: number | null,
  coverage: number,
  estimated = false,
): PmoMetricStatus {
  if (value === null) return "not-calculable";
  if (estimated) return "estimated";
  if (coverage >= 0.999_999) return "complete";
  return "partial";
}

export function buildDataQualitySummary(
  signals: PmoQualitySignals,
  warnings: string[],
): PmoDataQualitySummary {
  const overallScore = confidenceFromSignals(signals);
  const status: PmoMetricStatus =
    overallScore >= 0.9 ? "complete"
    : overallScore >= 0.5 ? "partial"
    : overallScore > 0 ? "estimated"
    : "not-calculable";
  return { ...signals, overallScore, status, warnings: [...new Set(warnings)].sort() };
}
