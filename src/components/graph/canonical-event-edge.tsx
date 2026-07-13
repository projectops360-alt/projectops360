"use client";

// ============================================================================
// ProjectOps360° — Living Graph canonical-event edge renderer (CAP-045)
// ============================================================================
// Styles a projected event relationship by its class so the user can tell order
// apart from cause at a glance:
//   temporal         → dashed  (order only — never causality)
//   causal           → solid   (explicitly recorded cause, with arrow)
//   compensation     → dotted  (explicitly recorded compensation, with arrow)
//   object_reference → thin dotted (secondary, no arrow)
// Read-only: never modifies graph data.
// ============================================================================

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import type { CanonicalEventFlowEdge } from "./living-graph-flow-types";

const DASH_BY_CLASS: Record<string, string | undefined> = {
  temporal: "6 5",
  compensation: "1 5",
  object_reference: "1 4",
  // causal → solid (no dasharray)
};

const WIDTH_BY_CLASS: Record<string, number> = {
  causal: 2.4,
  compensation: 2.2,
  temporal: 1.8,
  object_reference: 1.2,
};

function CanonicalEventEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<CanonicalEventFlowEdge>) {
  const cls = data?.relationshipClass ?? "temporal";
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });
  const color =
    cls === "causal"
      ? "#dc2626"
      : cls === "compensation"
        ? "#7c3aed"
        : cls === "object_reference"
          ? "#94a3b8"
          : "#0891b2"; // temporal
  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      style={{
        stroke: color,
        strokeWidth: WIDTH_BY_CLASS[cls] ?? 1.6,
        strokeDasharray: DASH_BY_CLASS[cls],
        strokeLinecap: "round",
        opacity: cls === "object_reference" ? 0.55 : 0.9,
      }}
    />
  );
}

export const CanonicalEventEdge = memo(CanonicalEventEdgeComponent);