"use client";

// ============================================================================
// PMO Portfolio Living Graph — React Flow canvas (CAP-048)
// ============================================================================
// Presentation only. It receives already-reconciled node and edge arrays and
// forwards events upward; it never derives state, so the shell stays the single
// place that decides what is on screen.
// ============================================================================

import { useEffect, useRef } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useViewport as useAppViewport } from "@/lib/layout/use-viewport";
import { HEALTH_COLOR, type GraphFlowEdge, type GraphFlowNode } from "./graph-flow-types";
import { GraphNodeRenderer } from "./graph-nodes";
import { GraphEdgeRenderer } from "./graph-edge";

// Defined at module scope: a fresh object each render makes React Flow rebuild
// its internal type registry and remount every node.
const NODE_TYPES = { graphNode: GraphNodeRenderer };
const EDGE_TYPES = { graphEdge: GraphEdgeRenderer };

/** Below this relative width change a resize is treated as noise, not a reflow. */
const REFIT_THRESHOLD = 0.15;

/**
 * Re-frames the graph when the canvas genuinely changes size — a device
 * rotation, the sidebar docking at a breakpoint, a rail opening.
 *
 * It calls `fitView` and nothing else: no remount, no re-layout, no new
 * simulation, so node positions, saved layouts, selection and focus all
 * survive. Small fluctuations (a mobile browser's URL bar sliding away) are
 * ignored, because re-framing on those would fight the user's own pan/zoom.
 */
function ViewportRefitOnResize() {
  const { fitView } = useReactFlow();
  const lastWidth = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const pane = document.querySelector<HTMLElement>(".react-flow__renderer")?.parentElement;
    if (!pane) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === 0) return;
      const previous = lastWidth.current;
      lastWidth.current = width;
      if (previous == null) return;
      if (Math.abs(width - previous) / previous < REFIT_THRESHOLD) return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fitView({ padding: 0.2, duration: 200 });
      }, 150);
    });

    observer.observe(pane);
    return () => {
      observer.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fitView]);

  return null;
}

export function PortfolioGraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onNodeClick,
  onNodeDoubleClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeDragStart,
  onNodeDragStop,
  onEdgeClick,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onPaneClick,
}: {
  nodes: GraphFlowNode[];
  edges: GraphFlowEdge[];
  onNodesChange: OnNodesChange<GraphFlowNode>;
  onNodeClick: NodeMouseHandler<GraphFlowNode>;
  onNodeDoubleClick: NodeMouseHandler<GraphFlowNode>;
  onNodeMouseEnter: NodeMouseHandler<GraphFlowNode>;
  onNodeMouseLeave: NodeMouseHandler<GraphFlowNode>;
  onNodeDragStart: OnNodeDrag<GraphFlowNode>;
  onNodeDragStop: OnNodeDrag<GraphFlowNode>;
  onEdgeClick: EdgeMouseHandler<GraphFlowEdge>;
  onEdgeMouseEnter: EdgeMouseHandler<GraphFlowEdge>;
  onEdgeMouseLeave: EdgeMouseHandler<GraphFlowEdge>;
  onPaneClick: () => void;
}) {
  const isPhone = useAppViewport() === "mobile";

  return (
    <div className="absolute inset-0">
      <ReactFlow<GraphFlowNode, GraphFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2.5}
        nodesDraggable
        nodesFocusable
        edgesFocusable
        elementsSelectable
        // Left button drags the canvas. Restricting pan to the middle and right
        // buttons left the obvious gesture — grab the background and move —
        // doing nothing at all.
        panOnDrag={[0, 1, 2]}
        // `panOnScroll` would take the wheel over for panning and silently
        // override `zoomOnScroll`. On a graph the wheel should zoom.
        zoomOnPinch
        zoomOnScroll
        // Double click is the drill-down gesture, so it must not also zoom.
        zoomOnDoubleClick={false}
        // Portfolio graphs run to hundreds of nodes; culling off-screen elements
        // is what keeps panning smooth at that size.
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "graphEdge",
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        }}
        className="h-full w-full bg-slate-50"
      >
        <Background gap={24} size={1} color="#cbd5e1" />
        <ViewportRefitOnResize />
        {/* Zoom in / zoom out / fit-to-screen — the touch-accessible equivalent
            of the scroll wheel, which a phone does not have. */}
        <Controls position="bottom-right" showInteractive={false} />
        {/* The minimap costs a quarter of a phone screen and duplicates what
            pinch-zoom already gives you, so it only appears once there is room. */}
        {!isPhone && (
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeStrokeWidth={2}
            // The minimap mirrors the health channel, so an at-risk cluster is
            // findable without panning the whole portfolio.
            // MiniMap widens the node type to the base `Node`, so the payload is
            // narrowed back here rather than being trusted implicitly.
            nodeColor={(node) =>
              HEALTH_COLOR[(node as GraphFlowNode).data.node.health]
            }
            maskColor="rgba(248,250,252,0.75)"
            className="!border !border-slate-200 !bg-white"
          />
        )}
      </ReactFlow>
    </div>
  );
}
