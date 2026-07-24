"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, Layers3 } from "lucide-react";
import { ProcessNodeTooltip } from "./process-node-tooltip";
import type { ProcessGraphFlowNode } from "./process-graph-flow-types";

function compactMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

function StageNode({ data, selected }: NodeProps<ProcessGraphFlowNode>) {
  const { entity, semanticZoom, locale, expanded, hovered, dimmed } = data;
  const metrics = entity.metrics;
  const es = locale === "es";
  const critical =
    entity.status === "critical" || entity.status === "attention";
  return (
    <div
      aria-label={`${entity.label}: ${entity.definition}`}
      className={`relative w-[270px] rounded-2xl border-2 bg-white p-4 shadow-lg transition-[opacity,box-shadow,border-color] duration-200 motion-reduce:transition-none ${
        selected
          ? "border-emerald-600 ring-4 ring-emerald-100"
          : critical
            ? "border-amber-400"
            : "border-slate-300"
      } ${hovered ? "shadow-2xl" : ""} ${dimmed ? "opacity-25" : "opacity-100"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-white !bg-emerald-600" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-white !bg-emerald-600" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            {es ? "Etapa de proceso" : "Process stage"}
          </p>
          <h3 className="mt-1 text-lg font-extrabold text-slate-950">
            {entity.label}
          </h3>
        </div>
        <button
          type="button"
          className="nodrag nopan inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleExpanded(entity.id);
          }}
          aria-label={
            expanded
              ? es
                ? `Colapsar ${entity.label}`
                : `Collapse ${entity.label}`
              : es
                ? `Expandir ${entity.label}`
                : `Expand ${entity.label}`
          }
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label={es ? "Proyectos" : "Projects"} value={metrics.projectCount ?? 0} />
        <Metric label={es ? "Activos" : "Active"} value={metrics.activeProjectCount ?? 0} />
        {semanticZoom !== "far" ? (
          <>
            <Metric
              label="Cycle"
              value={
                metrics.cycleTimeMs == null
                  ? "—"
                  : `${(metrics.cycleTimeMs / 86_400_000).toFixed(1)}d`
              }
            />
            <Metric label={es ? "Retrabajo" : "Rework"} value={metrics.reworkOccurrences ?? 0} />
          </>
        ) : null}
        {semanticZoom === "close" || semanticZoom === "deep" ? (
          <>
            <Metric label="Budget" value={compactMoney(metrics.approvedBudget)} />
            <Metric label="EAC" value={compactMoney(metrics.eac)} />
            <Metric label={es ? "Riesgos" : "Risks"} value={metrics.criticalRisks ?? 0} />
            <Metric label={es ? "Sobrecarga" : "Overload"} value={metrics.overallocatedResources ?? 0} />
          </>
        ) : null}
      </div>
      {semanticZoom === "deep" ? (
        <p className="mt-3 line-clamp-2 text-[11px] leading-4 text-slate-600">
          {entity.definition}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
          <Layers3 className="h-3 w-3" />
          {entity.status.replaceAll("_", " ")}
        </span>
        <span className="text-slate-500">
          {Math.round((metrics.dataQualityScore ?? 0) * 100)}% data
        </span>
      </div>
      <ProcessNodeTooltip entity={entity} locale={locale} active={hovered} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

export const ProcessStageSuperNode = memo(StageNode);
