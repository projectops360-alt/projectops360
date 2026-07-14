"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import type { ProcessTransitionFlowEdge } from "./living-graph-flow-types";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function ProcessTransitionEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<ProcessTransitionFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
  });
  const transition = data?.transition;
  const es = data?.locale === "es";
  const width = transition ? Math.min(5, 1.4 + Math.log2(transition.caseCount + 1)) : 1.5;
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "#047857" : "#10b981",
          strokeWidth: width,
          strokeDasharray: "7 5",
          opacity: selected ? 1 : 0.72,
        }}
      />
      {transition && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute rounded-md border border-emerald-500/30 bg-card/95 px-1.5 py-0.5 text-[9px] font-medium text-foreground shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            role="note"
            aria-label={`${transition.caseCount} ${es ? "casos" : "cases"}, ${es ? "mediana" : "median"} ${formatDuration(transition.medianDurationMs)}`}
          >
            {transition.caseCount} {es ? "casos" : "cases"} · {formatDuration(transition.medianDurationMs)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const ProcessTransitionEdge = memo(ProcessTransitionEdgeComponent);
