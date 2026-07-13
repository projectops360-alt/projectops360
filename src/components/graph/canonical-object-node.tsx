"use client";

// ============================================================================
// ProjectOps360° — Living Graph canonical-object node renderer (CAP-045)
// ============================================================================
// Secondary node representing an object referenced by canonical events (an
// entry in project_event_objects). Visually muted/smaller than event nodes so
// event↔object relationships read as secondary. Read-only.
// ============================================================================

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CanonicalObjectFlowNode } from "./living-graph-flow-types";

function CanonicalObjectNodeComponent({ data, selected }: NodeProps<CanonicalObjectFlowNode>) {
  const t = useTranslations("livingGraph.canonicalEvents");
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-md border border-dashed bg-muted/30 px-2 text-center",
        selected ? "border-foreground" : "border-muted-foreground/30",
      )}
      role="button"
      aria-label={data.label}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !bg-muted-foreground/30" />
      <div className="min-w-0">
        <div className="truncate text-[10px] font-medium text-muted-foreground" title={data.label}>
          {data.label}
        </div>
        <div className="truncate text-[8px] uppercase tracking-wide text-muted-foreground/60">
          {t("objectNodeLabel")}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !bg-muted-foreground/30" />
    </div>
  );
}

export const CanonicalObjectNode = memo(CanonicalObjectNodeComponent);