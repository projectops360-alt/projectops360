import { correlateFrictionSignals } from "./correlation";
import { aggregateConfidence, scoreCategories, scoreFrictionSignal } from "./scoring";
import type { FrictionRadarReadModel, FrictionSignal } from "./types";

export interface BuildFrictionRadarOptions {
  previousScore?: number | null;
  trendThreshold?: number;
}

export function buildFrictionRadarReadModel(
  organizationId: string,
  projectId: string,
  signals: readonly FrictionSignal[],
  options: BuildFrictionRadarOptions = {},
): FrictionRadarReadModel {
  const scoped = signals.filter((s) => s.organizationId === organizationId && s.projectId === projectId);
  const categories = scoreCategories(scoped);

  const rankedSignals = [...scoped].sort((a, b) => scoreFrictionSignal(b) - scoreFrictionSignal(a));
  void options;

  return {
    organizationId,
    projectId,
    score: null,
    severity: null,
    trend: "unknown",
    confidence: aggregateConfidence(scoped),
    categories,
    clusters: correlateFrictionSignals(scoped),
    topSignalIds: rankedSignals.slice(0, 10).map((s) => s.signalId),
    generatedFromSignalCount: scoped.length,
    version: "friction-radar-v1",
  };
}
