"use client";

// ============================================================================
// ProjectOps360° — Living Graph canonical-event node renderer (CAP-045)
// ============================================================================
// Renders ONE canonical event (project_event_log row) as a compact card in the
// "events" view. The event_type is the primary title; subject/source is
// secondary context. The accent bar encodes importance + lifecycle class so the
// user can scan the log at a glance. Read-only: never writes, never invents.
// ============================================================================

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CanonicalEventFlowNode } from "./living-graph-flow-types";
import type { CanonicalEventImportance, CanonicalEventLifecycleClass } from "@/types/living-graph";

/** Accent color by importance (left bar + ring). */
const IMPORTANCE_ACCENT: Record<CanonicalEventImportance, string> = {
  CRITICAL: "#b91c1c",
  HIGH: "#dc2626",
  MEDIUM: "#d97706",
  LOW: "#0891b2",
};

/** Subtle tint by lifecycle class (header chip). */
const LIFECYCLE_TINT: Partial<Record<CanonicalEventLifecycleClass, string>> = {
  BUSINESS_EVENT: "#0ea5e9",
  SYSTEM_EVENT: "#64748b",
  AI_EVENT: "#7c3aed",
  DERIVED_EVENT: "#059669",
  EXTERNAL_EVENT: "#ca8a04",
  SYNTHETIC_BACKFILL_EVENT: "#9333ea",
};

function CanonicalEventNodeComponent({ data, selected }: NodeProps<CanonicalEventFlowNode>) {
  const t = useTranslations("livingGraph.canonicalEvents");
  const { event } = data;
  const accent = IMPORTANCE_ACCENT[event.eventImportance ?? "LOW"] ?? IMPORTANCE_ACCENT.LOW;
  const lifecycleTint = event.lifecycleClass ? LIFECYCLE_TINT[event.lifecycleClass] : undefined;

  const subject =
    event.subjectType && event.subjectId
      ? `${event.subjectType} · ${event.subjectId.slice(0, 8)}`
      : t("noSubject");
  const source = event.sourceEntityType
    ? `${event.sourceEntityType}${event.sourceEntityId ? ` · ${event.sourceEntityId.slice(0, 8)}` : ""}`
    : t("noSource");

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col rounded-lg border bg-card shadow-sm transition-shadow",
        selected ? "border-foreground ring-2 ring-foreground/40" : "border-border",
      )}
      role="button"
      aria-label={event.eventType}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-muted-foreground/40" />
      {/* Accent bar */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-lg" style={{ background: accent }} aria-hidden />
      <div className="flex items-center justify-between gap-1 px-2.5 pt-1.5 pl-3">
        <span
          className="truncate text-[11px] font-semibold text-foreground"
          title={event.eventType}
        >
          {event.eventType}
        </span>
        <span
          className="shrink-0 rounded-sm px-1 py-0.5 text-[9px] font-bold text-white"
          style={{ background: accent }}
          title={t("sequence")}
        >
          #{event.sequenceNumber}
        </span>
      </div>
      <div className="flex items-center gap-1 px-2.5 pl-3 pt-0.5">
        {lifecycleTint && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: lifecycleTint }}
            aria-hidden
          />
        )}
        <span className="truncate text-[10px] text-muted-foreground" title={subject}>
          {subject}
        </span>
      </div>
      <div className="truncate px-2.5 pb-1.5 pl-3 text-[10px] text-muted-foreground/80" title={source}>
        {source}
      </div>
      {event.isCompensatingEvent && (
        <div className="px-2.5 pb-1.5 pl-3 text-[9px] font-medium text-purple-600 dark:text-purple-400">
          ↩ {t("compensates")}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-muted-foreground/40" />
    </div>
  );
}

export const CanonicalEventNode = memo(CanonicalEventNodeComponent);