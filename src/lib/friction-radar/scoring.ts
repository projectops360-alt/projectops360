import {
  FRICTION_CATEGORIES,
  type FrictionCategoryScore,
  type FrictionConfidence,
  type FrictionSeverity,
  type FrictionSignal,
} from "./types";

const SEVERITY_WEIGHT: Record<FrictionSeverity, number> = {
  low: 20,
  medium: 45,
  high: 72,
  critical: 100,
};

const CONFIDENCE_FACTOR: Record<FrictionConfidence, number> = {
  unknown: 0.55,
  low: 0.7,
  medium: 0.85,
  high: 1,
};

const CONFIDENCE_RANK: Record<FrictionConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreFrictionSignal(signal: FrictionSignal): number {
  const base = signal.magnitude == null
    ? SEVERITY_WEIGHT[signal.severity]
    : Math.max(0, Math.min(1, signal.magnitude)) * 100;
  return clampScore(base * CONFIDENCE_FACTOR[signal.confidence]);
}

export function aggregateConfidence(signals: readonly FrictionSignal[]): FrictionConfidence {
  if (signals.length === 0) return "unknown";
  const average = signals.reduce((sum, s) => sum + CONFIDENCE_RANK[s.confidence], 0) / signals.length;
  if (average >= 2.5) return "high";
  if (average >= 1.5) return "medium";
  if (average >= 0.5) return "low";
  return "unknown";
}

export function scoreCategories(signals: readonly FrictionSignal[]): FrictionCategoryScore[] {
  return FRICTION_CATEGORIES.map((category) => {
    const categorySignals = signals.filter((s) => s.category === category);
    const ranked = [...categorySignals].sort((a, b) => scoreFrictionSignal(b) - scoreFrictionSignal(a));
    return {
      category,
      // V1 intentionally does not aggregate heterogeneous signal scores. The
      // signal-level scores remain available for transparent ranking.
      score: null,
      signalCount: categorySignals.length,
      confidence: aggregateConfidence(categorySignals),
      topSignalIds: ranked.slice(0, 5).map((s) => s.signalId),
    };
  });
}

export function severityFromScore(score: number): FrictionSeverity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}
