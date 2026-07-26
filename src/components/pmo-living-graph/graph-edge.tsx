"use client";

// ============================================================================
// PMO Portfolio Living Graph — edge renderer (CAP-048)
// ============================================================================
// Colour encodes the relationship type; a dashed stroke encodes INFERRED
// provenance. That second channel is not decoration: a computed link and an
// observed one must never look identical, or the graph stops being auditable.
// ============================================================================

import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { edgeColor, edgeDashArray, type GraphFlowEdge } from "./graph-flow-types";

function PortfolioGraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps<GraphFlowEdge>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const edge = data?.edge;
  const color = edge ? edgeColor(edge.type) : "#94a3b8";
  const onPath = data?.onPath ?? false;
  const hovered = data?.hovered ?? false;
  const dimmed = data?.dimmed ?? false;
  const lensHighlighted = data?.lensEmphasis === "highlighted";

  // Weight carries relative strength; clamped so one heavy edge cannot draw a
  // stripe across the canvas.
  const baseWidth = Math.min(3.5, 1 + (edge?.weight ?? 1) * 0.4);

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={{
        // Find Path outranks the lens: it answers a question the user asked
        // explicitly, whereas the lens is ambient context.
        stroke: onPath ? "#0284c7" : lensHighlighted ? "#7c3aed" : color,
        strokeWidth:
          onPath || lensHighlighted
            ? baseWidth + 1.5
            : selected || hovered
              ? baseWidth + 1
              : baseWidth,
        strokeDasharray: edge ? edgeDashArray(edge.provenance) : undefined,
        opacity: dimmed ? 0.12 : 1,
        transition: "opacity 200ms, stroke-width 200ms",
      }}
    />
  );
}

export const GraphEdgeRenderer = memo(PortfolioGraphEdge);
