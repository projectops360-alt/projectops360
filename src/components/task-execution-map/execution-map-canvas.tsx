"use client";

// ============================================================================
// ProjectOps360° — Task Execution Map · React Flow canvas
// ============================================================================
// Renders the pure view model (map-model.ts) with React Flow: zoom, pan,
// fit-to-screen, center-selected, and node clicks. Node positions come from
// the deterministic layout functions; the canvas adds interaction only.
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ExecutionMapModel } from "@/lib/subtasks/map-model";
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
}

function toFlowNodes(model: ExecutionMapModel, selectedNodeId: string | null): Node[] {
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
    position: { x: n.x, y: n.y },
    data: n.data,
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

function CanvasInner({ model, selectedNodeId, onNodeClick, fitKey }: ExecutionMapCanvasProps) {
  const { fitView, setCenter, getNode } = useReactFlow();
  const nodes = useMemo(() => toFlowNodes(model, selectedNodeId), [model, selectedNodeId]);
  const edges = useMemo(() => toFlowEdges(model), [model]);

  useEffect(() => {
    // Re-fit when layout/filter context changes.
    const id = window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    return () => window.clearTimeout(id);
  }, [fitKey, fitView]);

  useEffect(() => {
    // Center the selected node (keyboard/list driven selection too).
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodeClick={handleNodeClick}
      fitView
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
