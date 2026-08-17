import { correlateFrictionSignals } from "./correlation";
import { aggregateConfidence, scoreCategories, scoreFrictionSignal, severityFromScore } from "./scoring";
import type { FrictionRadarReadModel, FrictionSignal, FrictionTrend } from "./types";

export interface BuildFrictionRadarOptions {
  previousScore?: number | null;
  trendThreshold?: number;
}

function determineTrend(score: number, previousScore: number | null | undefined, threshold: number): FrictionTrend {
  if (previousScore == null) return "unknown";
  const delta = score - previousScore;
  if (delta >= threshold) return "worsening";
  if (delta <= -threshold) return "improving";
  return "stable";
}

export function buildFrictionRadarReadModel(
  organizationId: string,
  projectId: string,
  signals: readonly FrictionSignal[],
  options: BuildFrictionRadarOptions = {},
): FrictionRadarReadModel {
  const scoped = signals.filter((s) => s.organizationId === organizationId && s.projectId === projectId);
  const categories = scoreCategories(scoped);
  const activeCategories = categories.filter((c) => c.signalCount > 0).sort((a, b) => b.score - a.score);

  // Overall v1 score: strongest category dominates, while secondary categories add
  // breadth. This keeps the score interpretable and bounded.
  const score = activeCategories.length === 0
    ? 0
    : Math.round(
        activeCategories.slice(0, 4).reduce((sum, c, i) => sum + c.score * [0.5, 0.25, 0.15, 0.1][i], 0) /
          [0.5, 0.25, 0.15, 0.1].slice(0, Math.min(4, activeCategories.length)).reduce((a, b) => a + b, 0),
      );

  const rankedSignals = [...scoped].sort((a, b) => scoreFrictionSignal(b) - scoreFrictionSignal(a));
  const threshold = options.trendThreshold ?? 5;

  return {
    organizationId,
    projectId,
    score,
    severity: severityFromScore(score),
    trend: determineTrend(score, options.previousScore, threshold),
    confidence: aggregateConfidence(scoped),
    categories,
    clusters: correlateFrictionSignals(scoped),
    topSignalIds: rankedSignals.slice(0, 10).map((s) => s.signalId),
    generatedFromSignalCount: scoped.length,
    version: "friction-radar-v1",
  };
}
