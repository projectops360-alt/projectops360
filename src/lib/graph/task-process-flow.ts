import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { TaskProcessAggregate } from "@/lib/graph/task-process-analysis";
import type {
  ProcessActivityFlowNode,
  ProcessTransitionFlowEdge,
} from "@/components/graph/living-graph-flow-types";

const NODE_WIDTH = 218;
const NODE_HEIGHT = 92;

export interface TaskProcessFlow {
  nodes: Node[];
  edges: Edge[];
}

/** Stable left-to-right layout over observed direct-follow relationships. */
export function buildTaskProcessFlow(
  aggregate: TaskProcessAggregate,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  locale: string,
): TaskProcessFlow {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 52, ranksep: 92, marginx: 36, marginy: 36 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const activity of aggregate.activities) {
    graph.setNode(activity.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const transition of aggregate.transitions) {
    graph.setEdge(transition.sourceActivityId, transition.targetActivityId);
  }
  dagre.layout(graph);

  const nodes: ProcessActivityFlowNode[] = aggregate.activities.map((activity) => {
    const point = graph.node(activity.id) as { x: number; y: number } | undefined;
    return {
      id: activity.id,
      type: "processActivity",
      position: {
        x: (point?.x ?? 0) - NODE_WIDTH / 2,
        y: (point?.y ?? 0) - NODE_HEIGHT / 2,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      selected: selectedNodeId === activity.id,
      data: { activity, selected: selectedNodeId === activity.id, locale },
    };
  });
  const edges: ProcessTransitionFlowEdge[] = aggregate.transitions.map((transition) => ({
    id: transition.id,
    type: "processTransition",
    source: transition.sourceActivityId,
    target: transition.targetActivityId,
    selected: selectedEdgeId === transition.id,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
    data: { transition, selected: selectedEdgeId === transition.id, locale },
  }));
  return { nodes, edges };
}
