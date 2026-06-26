"use client";

// ============================================================================
// ProjectOps360° — Living Graph custom edge renderer
// ============================================================================
// Celonis-style flow edge: stroke width scales with edge weight (frequency),
// and a small metric pill on the connection shows the weight and lag — the
// way process explorers annotate transitions.
// ============================================================================

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import {
  EDGE_TYPE_STYLES,
  GRAPH_SEMANTIC_COLORS,
  hexToRgba,
} from "@/lib/graph/living-graph-styles";
import type { LivingFlowEdge } from "./living-graph-flow-types";

/** Roadmap-style connector between milestone cards with an info callout. */
function MilestoneChainEdge({
  path,
  labelX,
  labelY,
  markerEnd,
  tasks,
  durationDays,
  dimmed,
}: {
  path: string;
  labelX: number;
  labelY: number;
  markerEnd?: string;
  tasks: number;
  durationDays: number | null;
  dimmed: boolean;
}) {
  const t = useTranslations("livingGraph");
  const accent = "#34d399";
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: accent,
          strokeWidth: 2.2,
          strokeDasharray: "1 7",
          strokeLinecap: "round",
          opacity: dimmed ? 0.15 : 0.9,
        }}
      />
      {!dimmed && tasks > 0 && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-center shadow-lg"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              boxShadow: `0 4px 16px ${hexToRgba(accent, 0.12)}`,
            }}
          >
            <p className="text-[10px] font-bold leading-none" style={{ color: accent }}>
              {tasks} {t("milestoneCard.tasks")}
            </p>
            {durationDays != null && (
              <p className="mt-0.5 text-[9px] leading-none text-muted-foreground">
                {durationDays}d
              </p>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function LivingGraphEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<LivingFlowEdge>) {
  const edge = data?.edge;
  const style = edge ? EDGE_TYPE_STYLES[edge.edgeType] : null;

  // Vertical process flow uses smooth bezier curves (Celonis-style);
  // horizontal layouts keep stepped routing for readability.
  const isVerticalFlow = sourcePosition === Position.Bottom;
  const [path, labelX, labelY] =
    style?.curved || isVerticalFlow
      ? getBezierPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          curvature: style?.curved ? 0.55 : 0.35,
        })
      : getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: 14,
        });

  if (!edge || !style || data?.playbackHidden) {
    return (
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{ opacity: data?.playbackHidden ? 0 : 1 }}
      />
    );
  }

  // Selection link drawn between two picked/connected milestones
  if (edge.metadata.pick_link === true) {
    return (
      <BaseEdge
        path={path}
        style={{
          stroke: "#6366f1",
          strokeWidth: 2.5,
          strokeDasharray: "6 4",
          opacity: 0.95,
        }}
      />
    );
  }

  // Milestone flowchart connector: single roadmap line + info callout
  if (edge.metadata.milestone_chain === true) {
    return (
      <MilestoneChainEdge
        path={path}
        labelX={labelX}
        labelY={labelY}
        markerEnd={markerEnd}
        tasks={typeof edge.metadata.tasks === "number" ? edge.metadata.tasks : 0}
        durationDays={
          typeof edge.metadata.duration_days === "number"
            ? edge.metadata.duration_days
            : null
        }
        dimmed={data.emphasis === "dimmed"}
      />
    );
  }

  const isDimmed = data.emphasis === "dimmed";
  // Workforce assignment edges carry their own status color (red/yellow/green).
  const workforceColor =
    typeof edge.metadata.workforceColor === "string" ? edge.metadata.workforceColor : null;
  const stroke = workforceColor
    ? workforceColor
    : data.isPathMember
      ? GRAPH_SEMANTIC_COLORS.active
      : data.isCritical
        ? GRAPH_SEMANTIC_COLORS.critical
        : style.stroke;
  // Frequency-scaled width: weight 1 → base; heavier transitions get thicker
  const weightBoost = Math.min(3, Math.log2(Math.max(1, edge.weight) + 1));
  const strokeWidth =
    style.strokeWidth +
    weightBoost +
    (data.isCritical || data.isPathMember ? 1 : 0) +
    (selected ? 1 : 0);

  // Metric pill: show when the transition carries information worth reading
  const showLabel =
    !isDimmed &&
    (edge.weight !== 1 ||
      edge.lagDays != null ||
      edge.edgeType === "blocked" ||
      edge.edgeType === "delayed" ||
      selected);
  const labelParts: string[] = [];
  if (edge.weight !== 1) labelParts.push(`×${Math.round(edge.weight * 10) / 10}`);
  if (edge.lagDays != null) labelParts.push(`${edge.lagDays}d`);
  if (labelParts.length === 0 && showLabel) labelParts.push(`×${edge.weight}`);

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: style.dashArray,
          opacity: isDimmed ? 0.1 : 0.9,
          transition: "opacity 150ms ease",
        }}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <span
            className="pointer-events-none absolute z-10 rounded-full border bg-card px-1.5 py-px font-mono text-[9px] font-semibold tabular-nums shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: `${stroke}66`,
              color: stroke,
            }}
          >
            {labelParts.join(" · ")}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LivingGraphEdge = memo(LivingGraphEdgeComponent);
LivingGraphEdge.displayName = "LivingGraphEdge";
