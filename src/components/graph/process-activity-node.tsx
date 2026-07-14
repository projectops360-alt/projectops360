"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Activity, Flag, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProcessActivityFlowNode } from "./living-graph-flow-types";

function humanize(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
}

function ProcessActivityNodeComponent({ data, selected }: NodeProps<ProcessActivityFlowNode>) {
  const { activity, locale } = data;
  const es = locale === "es";
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-between rounded-xl border bg-card px-3 py-2 shadow-sm",
        selected ? "border-brand-500 ring-2 ring-brand-500/30" : "border-border",
      )}
      aria-label={`${humanize(activity.eventType)}, ${activity.caseCount} ${es ? "casos" : "cases"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-brand-500" />
      <div className="flex min-w-0 items-start gap-2">
        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        <div className="min-w-0">
          <p className="line-clamp-2 text-xs font-semibold leading-4 text-foreground" title={activity.eventType}>
            {humanize(activity.eventType)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {activity.caseCount} {es ? "casos" : "cases"} · {activity.eventCount} {es ? "eventos" : "events"}
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
          {activity.caseCoveragePct}%
        </span>
      </div>
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
        {activity.startCaseCount > 0 && (
          <span className="inline-flex items-center gap-1"><Flag className="h-2.5 w-2.5" />{activity.startCaseCount} {es ? "inicio" : "start"}</span>
        )}
        {activity.endCaseCount > 0 && (
          <span className="inline-flex items-center gap-1"><LogOut className="h-2.5 w-2.5" />{activity.endCaseCount} {es ? "fin" : "end"}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-brand-500" />
    </div>
  );
}

export const ProcessActivityNode = memo(ProcessActivityNodeComponent);
