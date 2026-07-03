"use client";

// ============================================================================
// ProjectOps360° — Task Execution Map · React Flow canvas
// ============================================================================
// Renders the pure view model (map-model.ts) with React Flow: zoom, pan,
// fit-to-screen, center-selected, node clicks, and MANUAL node dragging.
// Auto positions come from the deterministic layout; a user drag overrides
// them (presentation-only) and is reported to the client for saving.
// ============================================================================

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ExecutionMapModel } from "@/lib/subtasks/map-model";
import type { SavedSubtaskNodePosition } from "@/lib/subtasks/subtask-map-layout";
import {
  ParentTaskNode,
  SubtaskMapNode,
  BlockerMapNode,
  DependencyMapNode,
  GroupMapNode,
} from "./map-nodes";

const NODE_TYPES: NodeTypes = {
  parentTask: ParentTaskNode,
  subtask: SubtaskMapNode,
  blocker: BlockerMapNode,
  dependency: DependencyMapNode,
  group: GroupMapNode,
};

export interface ExecutionMapCanvasProps {
  model: ExecutionMapModel;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string, kind: string) => void;
  /** Re-fit whenever this changes (layout switches, filters…). */
  fitKey: string;
  /** User-dragged node positions (override the auto-layout). */
  manualPositions: Map<string, SavedSubtaskNodePosition>;
  /** Report a finished drag so the client can persist the arrangement. */
  onNodeDragStop: (nodeId: string, position: SavedSubtaskNodePosition) => void;
  /** Delete a subtask directly from its node (RBAC-gated in the client). */
  onDeleteSubtask?: (subtaskId: string) => void;
  /** Viewport to restore from a saved layout, if any. */
  savedViewport?: { x: number; y: number; zoom: number } | null;
  /** Report viewport changes so the client can persist them with the layout. */
  onViewportChange?: (viewport: Viewport) => void;
}

function toFlowNodes(
  model: ExecutionMapModel,
  selectedNodeId: string | null,
  manualPositions: Map<string, SavedSubtaskNodePosition>,
  onDeleteSubtask?: (subtaskId: string) => void,
): Node[] {
  return model.nodes.map((n) => ({
    id: n.id,
    type:
      n.kind === "parent"
        ? "parentTask"
        : n.kind === "subtask"
          ? "subtask"
          : n.kind === "blocker"
            ? "blocker"
            : n.kind === "dependency"
              ? "dependency"
              : "group",
    // A user drag (manual position) wins over the deterministic auto-layout.
    position: manualPositions.get(n.id) ?? { x: n.x, y: n.y },
    data:
      n.kind === "subtask"
        ? { ...n.data, onDeleteSubtask }
        : n.data,
    selected: n.id === selectedNodeId,
    draggable: true,
  }));
}

function toFlowEdges(model: ExecutionMapModel): Edge[] {
  return model.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.alert,
    style: {
      stroke: e.alert ? "#ef4444" : e.emphasized ? "#f59e0b" : "var(--border, #94a3b8)",
      strokeWidth: e.emphasized ? 2.5 : 1.5,
      strokeDasharray: e.dashed ? "6 4" : undefined,
    },
  }));
}

function CanvasInner({
  model,
  selectedNodeId,
  onNodeClick,
  fitKey,
  manualPositions,
  onNodeDragStop,
  onDeleteSubtask,
  savedViewport,
  onViewportChange,
}: ExecutionMapCanvasProps) {
  const { fitView, setCenter, getNode } = useReactFlow();
  const nodes = useMemo(
    () => toFlowNodes(model, selectedNodeId, manualPositions, onDeleteSubtask),
    [model, selectedNodeId, manualPositions, onDeleteSubtask],
  );
  const edges = useMemo(() => toFlowEdges(model), [model]);

  useEffect(() => {
    // Re-fit when the layout/filter context changes — unless a saved viewport
    // should be restored instead (respect the user's saved framing).
    if (savedViewport) return;
    const id = window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    return () => window.clearTimeout(id);
  }, [fitKey, fitView, savedViewport]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const node = getNode(selectedNodeId);
    if (node) {
      setCenter(node.position.x + 130, node.position.y + 60, { zoom: 1, duration: 300 });
    }
  }, [selectedNodeId, getNode, setCenter]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => onNodeClick(node.id, (node.type as string) ?? "subtask"),
    [onNodeClick],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_evt, node) => onNodeDragStop(node.id, { x: node.position.x, y: node.position.y }),
    [onNodeDragStop],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodeClick={handleNodeClick}
      onNodeDragStop={handleNodeDragStop}
      onMoveEnd={onViewportChange ? (_e, vp) => onViewportChange(vp) : undefined}
      defaultViewport={savedViewport ?? undefined}
      fitView={!savedViewport}
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      edgesFocusable={false}
      deleteKeyCode={null}
    >
      <Background gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function ExecutionMapCanvas(props: ExecutionMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
