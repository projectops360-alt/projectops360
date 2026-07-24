"use client";

import { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import type {
  ProcessGraphConnection,
  ProcessGraphEntity,
} from "@/lib/pmo-process-intelligence/process-graph.types";
import type { ProcessGraphSavedPosition } from "@/lib/pmo-process-intelligence/process-graph-layout-storage";

const SIZE = {
  stage: { width: 270, height: 245 },
  project: { width: 250, height: 170 },
  milestone: { width: 230, height: 125 },
  activity: { width: 220, height: 105 },
} as const;

export function computeProcessGraphLayout(
  entities: readonly ProcessGraphEntity[],
  connections: readonly ProcessGraphConnection[],
): Map<string, ProcessGraphSavedPosition> {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    ranksep: 110,
    nodesep: 70,
    edgesep: 30,
    marginx: 48,
    marginy: 64,
  });
  for (const entity of entities) {
    graph.setNode(entity.id, { ...SIZE[entity.kind] });
  }
  for (const connection of connections) {
    if (graph.hasNode(connection.source) && graph.hasNode(connection.target)) {
      graph.setEdge(connection.source, connection.target);
    }
  }
  dagre.layout(graph);
  const positions = new Map<string, ProcessGraphSavedPosition>();
  for (const entity of entities) {
    const point = graph.node(entity.id) as
      | { x: number; y: number; width: number; height: number }
      | undefined;
    if (!point) continue;
    positions.set(entity.id, {
      x: point.x - point.width / 2,
      y: point.y - point.height / 2,
    });
  }
  return positions;
}

export function useProcessGraphLayout({
  entities,
  connections,
  manualPositions,
}: {
  entities: readonly ProcessGraphEntity[];
  connections: readonly ProcessGraphConnection[];
  manualPositions: ReadonlyMap<string, ProcessGraphSavedPosition>;
}) {
  return useMemo(() => {
    const automatic = computeProcessGraphLayout(entities, connections);
    for (const [id, position] of manualPositions) {
      if (automatic.has(id)) automatic.set(id, position);
    }
    return automatic;
  }, [connections, entities, manualPositions]);
}
