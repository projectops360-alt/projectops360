"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { ProcessGraphFlowEdge } from "./process-graph-flow-types";

const EDGE_STYLE = {
  "execution-flow": { stroke: "#059669", dash: undefined },
  "secondary-flow": { stroke: "#64748b", dash: "7 5" },
  rework: { stroke: "#dc2626", dash: "6 4" },
  dependency: { stroke: "#7c3aed", dash: "3 4" },
  "resource-flow": { stroke: "#0284c7", dash: undefined },
  "budget-flow": { stroke: "#ca8a04", dash: undefined },
  "risk-propagation": { stroke: "#e11d48", dash: "7 4" },
  "deliverable-flow": { stroke: "#0f766e", dash: undefined },
} as const;

function ProcessGraphEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<ProcessGraphFlowEdge>) {
  const connection = data?.connection;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.35,
  });
  if (!connection) return <BaseEdge path={path} markerEnd={markerEnd} />;
  const style = EDGE_STYLE[connection.kind];
  const active = selected || data.hovered;
  const width =
    connection.kind === "execution-flow" ||
    connection.kind === "budget-flow" ||
    connection.kind === "resource-flow"
      ? Math.min(10, 1.75 + Math.log2(connection.frequency + 1))
      : 2.25;
  const opacity = data.dimmed ? 0.12 : active ? 1 : 0.75;
  const es = data.locale === "es";
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: active ? width + 1.5 : width,
          strokeDasharray: style.dash,
          opacity,
          transition: "opacity 180ms ease, stroke-width 180ms ease",
        }}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: "stroke", cursor: "pointer" }}
      />
      {active ? (
        <EdgeLabelRenderer>
          <div
            role="tooltip"
            className="pointer-events-none absolute z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xl"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <p className="text-xs font-bold text-slate-950">
              {connection.sourceLabel} → {connection.targetLabel}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {connection.label}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <Metric label={es ? "Proyectos" : "Projects"} value={connection.projectIds.length} />
              <Metric label={es ? "Casos" : "Cases"} value={connection.caseCount} />
              <Metric label={es ? "Transiciones" : "Transitions"} value={connection.transitionCount} />
              <Metric label={es ? "Frecuencia" : "Frequency"} value={connection.frequency} />
              <Metric
                label={es ? "Espera promedio" : "Average wait"}
                value={
                  connection.averageWaitMs == null
                    ? "—"
                    : `${(connection.averageWaitMs / 3_600_000).toFixed(1)}h`
                }
              />
              <Metric label={es ? "Retrabajo" : "Rework"} value={connection.reworkCount} />
              <Metric
                label={es ? "Calidad" : "Data quality"}
                value={`${Math.round(connection.dataQualityScore * 100)}%`}
              />
              <Metric
                label={es ? "Último evento" : "Last observed"}
                value={connection.lastObservedAt?.slice(0, 10) ?? "—"}
              />
            </dl>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900">{value}</dd>
    </>
  );
}

export const ProcessGraphEdge = memo(ProcessGraphEdgeComponent);
