"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, CheckSquare2 } from "lucide-react";
import { ProcessNodeTooltip } from "./process-node-tooltip";
import type { ProcessGraphFlowNode } from "./process-graph-flow-types";

function ActivityNode({ data, selected }: NodeProps<ProcessGraphFlowNode>) {
  const { entity, locale, hovered, dimmed } = data;
  const blocked = entity.status === "blocked";
  return (
    <div
      aria-label={`${entity.label}: ${entity.definition}`}
      className={`relative w-[220px] rounded-lg border-2 bg-white p-3 shadow-sm transition-[opacity,box-shadow,border-color] duration-200 motion-reduce:transition-none ${
        selected
          ? "border-emerald-600 ring-4 ring-emerald-100"
          : blocked
            ? "border-rose-400"
            : "border-slate-300"
      } ${hovered ? "shadow-lg" : ""} ${dimmed ? "opacity-25" : "opacity-100"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-white !bg-slate-600" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-white !bg-slate-600" />
      <p className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide ${blocked ? "text-rose-700" : "text-slate-600"}`}>
        {blocked ? <AlertTriangle className="h-3 w-3" /> : <CheckSquare2 className="h-3 w-3" />}
        {locale === "es" ? "Actividad" : "Activity"}
      </p>
      <h3 className="mt-1 line-clamp-2 text-sm font-bold text-slate-950">
        {entity.label}
      </h3>
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-slate-500">{entity.status.replaceAll("_", " ")}</span>
        <span className="font-bold text-slate-900">
          {Math.round(entity.metrics.progressPercent ?? 0)}%
        </span>
      </div>
      {hovered ? <ProcessNodeTooltip entity={entity} locale={locale} /> : null}
    </div>
  );
}

export const ProcessActivityNode = memo(ActivityNode);
