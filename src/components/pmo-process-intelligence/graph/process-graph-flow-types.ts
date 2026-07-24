import type { Edge, Node } from "@xyflow/react";
import type {
  ProcessGraphConnection,
  ProcessGraphEntity,
  ProcessGraphSemanticZoom,
} from "@/lib/pmo-process-intelligence/process-graph.types";
import type { PmoPiFilters } from "@/lib/pmo-process-intelligence/contracts";

export interface ProcessGraphNodeData extends Record<string, unknown> {
  entity: ProcessGraphEntity;
  semanticZoom: ProcessGraphSemanticZoom;
  layer: Exclude<PmoPiFilters["overlay"], "whatif">;
  expanded: boolean;
  hovered: boolean;
  dimmed: boolean;
  locale: "en" | "es";
  onToggleExpanded: (nodeId: string) => void;
}

export interface ProcessGraphEdgeData extends Record<string, unknown> {
  connection: ProcessGraphConnection;
  hovered: boolean;
  dimmed: boolean;
  locale: "en" | "es";
}

export type ProcessGraphFlowNode = Node<
  ProcessGraphNodeData,
  ProcessGraphEntity["kind"]
>;

export type ProcessGraphFlowEdge = Edge<
  ProcessGraphEdgeData,
  "processGraph"
>;
