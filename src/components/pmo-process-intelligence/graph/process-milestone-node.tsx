"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, Milestone } from "lucide-react";
import { ProcessNodeTooltip } from "./process-node-tooltip";
import type { ProcessGraphFlowNode } from "./process-graph-flow-types";

function MilestoneNode({ data, selected }: NodeProps<ProcessGraphFlowNode>) {
  const { entity, locale, expanded, hovered, dimmed } = data;
  const progress = entity.metrics.progressPercent ?? 0;
  const es = locale === "es";
  return (
    <div
      aria-label={`${entity.label}: ${entity.definition}`}
      className={`relative w-[230px] rounded-xl border-2 bg-white p-3 shadow-md transition-[opacity,box-shadow,border-color] duration-200 motion-reduce:transition-none ${
        selected
          ? "border-emerald-600 ring-4 ring-emerald-100"
          : entity.status === "blocked"
            ? "border-rose-400"
            : "border-slate-300"
      } ${hovered ? "shadow-xl" : ""} ${dimmed ? "opacity-25" : "opacity-100"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-white !bg-violet-600" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-white !bg-violet-600" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-violet-700">
            <Milestone className="h-3 w-3" />
            {es ? "Hito" : "Milestone"}
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
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-600"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{entity.status.replaceAll("_", " ")}</span>
        <span className="font-bold text-slate-800">{Math.round(progress)}%</span>
      </div>
      {hovered ? <ProcessNodeTooltip entity={entity} locale={locale} /> : null}
    </div>
  );
}

export const ProcessMilestoneNode = memo(MilestoneNode);
