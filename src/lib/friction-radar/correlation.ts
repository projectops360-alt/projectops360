import { aggregateConfidence, scoreSignalSet } from "./scoring";
import type { FrictionCluster, FrictionSignal } from "./types";

// v1 correlation is deliberately deterministic and conservative. Signals cluster only
// when they share an explicit affected entity (entityId / relatedEntityIds). No temporal
// adjacency is promoted to causality.
export function correlateFrictionSignals(signals: readonly FrictionSignal[]): FrictionCluster[] {
  const byEntity = new Map<string, FrictionSignal[]>();

  for (const signal of signals) {
    const ids = new Set<string>();
    if (signal.entityId) ids.add(signal.entityId);
    for (const id of signal.relatedEntityIds ?? []) ids.add(id);
    for (const id of ids) {
      const list = byEntity.get(id) ?? [];
      list.push(signal);
      byEntity.set(id, list);
    }
  }

  const clusters: FrictionCluster[] = [];
  for (const [entityId, entitySignals] of byEntity) {
    const unique = [...new Map(entitySignals.map((s) => [s.signalId, s])).values()];
    if (unique.length < 2) continue;
    const categories = [...new Set(unique.map((s) => s.category))].sort();
    if (categories.length < 2) continue; // v1 clusters cross-category friction only
    const projectId = unique[0].projectId;
    clusters.push({
      clusterId: `friction-cluster:${projectId}:${entityId}`,
      projectId,
      categories,
      signalIds: unique.map((s) => s.signalId).sort(),
      entityIds: [entityId],
      score: scoreSignalSet(unique),
      confidence: aggregateConfidence(unique),
    });
  }

  return clusters.sort((a, b) => b.score - a.score || a.clusterId.localeCompare(b.clusterId));
}
