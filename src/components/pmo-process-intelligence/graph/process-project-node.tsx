"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, FolderKanban } from "lucide-react";
import { ProcessNodeTooltip } from "./process-node-tooltip";
import type { ProcessGraphFlowNode } from "./process-graph-flow-types";

function groupedInteger(value: number): string {
  const rounded = Math.round(value).toString();
  return rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function ProjectNode({ data, selected }: NodeProps<ProcessGraphFlowNode>) {
  const { entity, semanticZoom, locale, expanded, hovered, dimmed } = data;
  const metrics = entity.metrics;
  const es = locale === "es";
  return (
    <div
      aria-label={`${entity.label}: ${entity.definition}`}
      className={`relative w-[250px] rounded-xl border-2 bg-white p-3 shadow-md transition-[opacity,box-shadow,border-color] duration-200 motion-reduce:transition-none ${
        selected
          ? "border-emerald-600 ring-4 ring-emerald-100"
          : metrics.healthScore != null && metrics.healthScore < 60
            ? "border-rose-400"
            : "border-slate-300"
      } ${hovered ? "shadow-xl" : ""} ${dimmed ? "opacity-25" : "opacity-100"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-white !bg-sky-600" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-white !bg-sky-600" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-sky-700">
            <FolderKanban className="h-3 w-3" />
            {es ? "Proyecto" : "Project"}
          </p>
          <h3 className="mt-1 truncate text-sm font-extrabold text-slate-950">
            {entity.label}
          </h3>
        </div>
        <button
          type="button"
          className="nodrag nopan inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleExpanded(entity.id);
          }}
          aria-label={expanded ? (es ? "Colapsar" : "Collapse") : es ? "Expandir" : "Expand"}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <Metric label="Health" value={metrics.healthScore == null ? "—" : `${metrics.healthScore}`} />
        <Metric label={es ? "Riesgos" : "Risks"} value={metrics.criticalRisks ?? 0} />
        <Metric label={es ? "Recursos" : "Resources"} value={metrics.overallocatedResources ?? 0} />
      </div>
      {semanticZoom === "close" || semanticZoom === "deep" ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <span className="text-slate-500">EAC</span>
          <span className="text-right font-semibold text-slate-900">
            {metrics.eac == null ? "—" : `$${groupedInteger(metrics.eac)}`}
          </span>
          <span className="text-slate-500">{es ? "Retraso" : "Delay"}</span>
          <span className="text-right font-semibold text-slate-900">
            {metrics.delayProbabilityPct == null ? "—" : `${metrics.delayProbabilityPct}%`}
          </span>
        </div>
      ) : null}
      <p className="mt-2 truncate border-t border-slate-100 pt-2 text-[10px] font-medium text-slate-500">
        {entity.status.replaceAll("_", " ")}
      </p>
      <ProcessNodeTooltip entity={entity} locale={locale} active={hovered} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 px-1.5 py-1">
      <p className="text-[8px] uppercase text-slate-500">{label}</p>
      <p className="font-bold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

export const ProcessProjectNode = memo(ProjectNode);
