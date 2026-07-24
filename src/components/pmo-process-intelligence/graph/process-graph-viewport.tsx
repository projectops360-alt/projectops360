"use client";

import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnMove,
  type OnNodeDrag,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  ProcessGraphFlowEdge,
  ProcessGraphFlowNode,
} from "./process-graph-flow-types";
import { ProcessStageSuperNode } from "./process-stage-super-node";
import { ProcessProjectNode } from "./process-project-node";
import { ProcessMilestoneNode } from "./process-milestone-node";
import { ProcessActivityNode } from "./process-activity-node";
import { ProcessGraphEdge } from "./process-graph-edge";

const NODE_TYPES = {
  stage: ProcessStageSuperNode,
  project: ProcessProjectNode,
  milestone: ProcessMilestoneNode,
  activity: ProcessActivityNode,
};

const EDGE_TYPES = {
  processGraph: ProcessGraphEdge,
};

export function ProcessGraphViewport({
  nodes,
  edges,
  onNodesChange,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onEdgeClick,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onPaneClick,
  onMove,
  onMoveEnd,
}: {
  nodes: ProcessGraphFlowNode[];
  edges: ProcessGraphFlowEdge[];
  onNodesChange: OnNodesChange<ProcessGraphFlowNode>;
  onNodeClick: NodeMouseHandler<ProcessGraphFlowNode>;
  onNodeDoubleClick: NodeMouseHandler<ProcessGraphFlowNode>;
  onNodeContextMenu: NodeMouseHandler<ProcessGraphFlowNode>;
  onNodeMouseEnter: NodeMouseHandler<ProcessGraphFlowNode>;
  onNodeMouseLeave: NodeMouseHandler<ProcessGraphFlowNode>;
  onNodeDragStart: OnNodeDrag<ProcessGraphFlowNode>;
  onNodeDrag: OnNodeDrag<ProcessGraphFlowNode>;
  onNodeDragStop: OnNodeDrag<ProcessGraphFlowNode>;
  onEdgeClick: EdgeMouseHandler<ProcessGraphFlowEdge>;
  onEdgeMouseEnter: EdgeMouseHandler<ProcessGraphFlowEdge>;
  onEdgeMouseLeave: EdgeMouseHandler<ProcessGraphFlowEdge>;
  onPaneClick: () => void;
  onMove: OnMove;
  onMoveEnd: OnMove;
}) {
  return (
    <div className="absolute inset-0">
      <ReactFlow<ProcessGraphFlowNode, ProcessGraphFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPaneClick={onPaneClick}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.25}
        maxZoom={2.25}
        nodesDraggable
        nodesFocusable
        edgesFocusable
        elementsSelectable
        selectionOnDrag
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnPinch
        zoomOnScroll
        zoomOnDoubleClick={false}
        multiSelectionKeyCode={["Control", "Meta", "Shift"]}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "processGraph",
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        }}
        className="h-full w-full bg-slate-50"
      >
        <Background gap={24} size={1} color="#cbd5e1" />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(node) =>
            node.type === "stage"
              ? "#059669"
              : node.type === "project"
                ? "#0284c7"
                : node.type === "milestone"
                  ? "#7c3aed"
                  : "#64748b"
          }
          maskColor="rgba(248,250,252,0.75)"
          className="!border !border-slate-200 !bg-white"
        />
      </ReactFlow>
    </div>
  );
}
