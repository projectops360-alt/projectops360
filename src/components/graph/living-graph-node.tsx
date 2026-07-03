"use client";

// ============================================================================
// ProjectOps360° — Living Graph custom node renderer
// ============================================================================
// Celonis-style activity node: compact rounded card with a colored accent
// bar, the activity label, a frequency badge (process events behind this
// activity) and a slim metric line. Handle positions follow the layout
// direction (top→bottom for hierarchical, left→right otherwise).
// ============================================================================

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { Lock, Link2, ShieldAlert, FileQuestion, CheckCircle2, HardHat, ChevronRight, ChevronDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_TYPE_STYLES,
  GRAPH_SEMANTIC_COLORS,
  RISK_COLORS,
  SHORTAGE_RISK_COLORS,
} from "@/lib/graph/living-graph-styles";
import type { ShortageRiskLevel } from "@/types/database";
import type { LivingFlowNode } from "./living-graph-flow-types";

const COMPLETED = new Set(["done", "completed", "tested"]);

function LivingGraphNodeComponent({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<LivingFlowNode>) {
  const t = useTranslations("livingGraph");
  const { node, metrics, emphasis, playback } = data;
  const style = NODE_TYPE_STYLES[node.nodeType];
  const Icon = style.icon;

  // ── Subtask visibility affordance (NotebookLM-style progressive expansion) ──
  const subtaskTotal =
    typeof node.metadata.subtask_total === "number" ? node.metadata.subtask_total : 0;
  const subtaskCompleted =
    typeof node.metadata.subtask_completed === "number" ? node.metadata.subtask_completed : 0;
  const subtaskBlocked =
    typeof node.metadata.subtask_blocked === "number" ? node.metadata.subtask_blocked : 0;
  const subtaskExpanded = node.metadata.subtask_expanded === true;
  const hasSubtasks = subtaskTotal > 0 && typeof data.onToggleSubtasks === "function";

  const isDimmed =
    (emphasis === "dimmed" && playback === "none") || playback === "future";
  const isHighlighted = emphasis === "highlight";
  const isActive = playback === "active";
  const isCompleted =
    playback === "past" ||
    (node.status != null && COMPLETED.has(node.status.toLowerCase()));
  const showTraceGap =
    metrics != null &&
    metrics.traceabilityGapScore >= 0.6 &&
    node.nodeType !== "document_link";

  const ringColor = data.isSearchHit
    ? GRAPH_SEMANTIC_COLORS.searchHit
    : data.isSimulationOrigin || data.isSimulationImpact
      ? GRAPH_SEMANTIC_COLORS.simulationImpact
      : data.isPathMember
        ? GRAPH_SEMANTIC_COLORS.active
        : data.isDownstreamHighlight
          ? GRAPH_SEMANTIC_COLORS.bottleneck
          : isHighlighted
            ? style.accent
            : undefined;

  const durationLabel = (() => {
    if (node.durationDays != null && node.durationDays > 0) return `${node.durationDays}d`;
    if (node.startDate && node.endDate) {
      const days =
        (new Date(node.endDate).getTime() - new Date(node.startDate).getTime()) /
        86_400_000;
      if (days > 0) return `${Math.round(days * 10) / 10}d`;
    }
    return null;
  })();

  const handleClass = "!h-1.5 !w-1.5 !border-0 !bg-slate-500";

  return (
    <div
      role="group"
      aria-label={`${t(`nodeTypes.${node.nodeType}`)}: ${node.label}`}
      className={cn(
        "relative flex w-[230px] overflow-hidden rounded-lg border bg-card shadow-md transition-opacity",
        selected ? "border-brand-500 ring-2 ring-brand-500/40" : "border-border/80",
        isDimmed && "opacity-20",
        playback === "future" && "opacity-10",
      )}
      style={
        ringColor && !selected
          ? { boxShadow: `0 0 0 2px ${ringColor}, 0 0 14px ${ringColor}55` }
          : undefined
      }
    >
      <Handle type="target" position={targetPosition ?? Position.Top} className={handleClass} />
      <Handle type="source" position={sourcePosition ?? Position.Bottom} className={handleClass} />

      {/* Accent bar (activity type color) */}
      <span
        aria-hidden
        className={cn("w-1 shrink-0", isActive && "animate-pulse")}
        style={{ backgroundColor: isCompleted ? GRAPH_SEMANTIC_COLORS.completed : style.accent }}
      />

      <div className="min-w-0 flex-1 px-2.5 py-1.5">
        {/* Row 1: icon + label + frequency badge */}
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 shrink-0" style={{ color: style.accent }} aria-hidden />
          <p
            className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight text-foreground"
            title={node.label}
          >
            {node.label}
          </p>
          {/* Frequency badge — number of process events behind this activity */}
          <span
            className="shrink-0 rounded-full px-1.5 py-px font-mono text-[10px] font-bold tabular-nums"
            style={{ backgroundColor: style.soft, color: style.accent }}
            title={t(`nodeTypes.${node.nodeType}`)}
            aria-label={`${data.clusterSize} ${t("detailPanel.neighbors")}`}
          >
            {data.clusterSize}
          </span>
        </div>

        {/* Subtask indicator — visible affordance for tasks WITH subtasks.
            Clicking toggles progressive expansion (root-first; nothing is
            dumped by default). Presentation-only; never mutates task data. */}
        {hasSubtasks && (
          <button
            type="button"
            className="mt-1 flex w-full items-center gap-1 rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-300"
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleSubtasks?.(node.sourceEntityId);
            }}
            aria-expanded={subtaskExpanded}
            aria-label={t("subtasks.toggle", { count: subtaskTotal })}
            title={t("subtasks.toggle", { count: subtaskTotal })}
            data-testid="graph-subtask-indicator"
          >
            {subtaskExpanded ? (
              <ChevronDown className="h-2.5 w-2.5 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-2.5 w-2.5 shrink-0" aria-hidden />
            )}
            <ListTree className="h-2.5 w-2.5 shrink-0" aria-hidden />
            <span className="tabular-nums">
              {subtaskCompleted}/{subtaskTotal}
            </span>
            {subtaskBlocked > 0 && (
              <span className="ml-auto tabular-nums text-red-600 dark:text-red-400" title={t("subtasks.blocked")}>
                ⛔ {subtaskBlocked}
              </span>
            )}
          </button>
        )}

        {/* Row 2: status / duration / indicators */}
        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-muted-foreground">
          {isCompleted && (
            <CheckCircle2
              className="h-3 w-3 shrink-0"
              style={{ color: GRAPH_SEMANTIC_COLORS.completed }}
              aria-label={t("detailPanel.completed")}
            />
          )}
          {node.status && (
            <span className="truncate uppercase tracking-wide">
              {node.status.replaceAll("_", " ")}
            </span>
          )}
          {durationLabel && (
            <span className="shrink-0 font-mono tabular-nums">{durationLabel}</span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {/* Execution status indicator (ADR-006): Blocked requires an explicit
                impediment; waiting on a predecessor is a distinct, non-blocked state. */}
            {metrics?.executionStatus === "blocked" && (
              <Lock
                className="h-3 w-3"
                style={{ color: GRAPH_SEMANTIC_COLORS.blocked }}
                aria-label={t("detailPanel.blocked")}
              />
            )}
            {metrics?.executionStatus === "waiting_on_dependency" && (
              <Link2
                className="h-3 w-3"
                style={{ color: GRAPH_SEMANTIC_COLORS.rework }}
                aria-label={t("detailPanel.waitingOnDependency")}
              />
            )}
            {node.riskLevel && node.riskLevel !== "low" && (
              <ShieldAlert
                className="h-3 w-3"
                style={{ color: RISK_COLORS[node.riskLevel] }}
                aria-label={t(`detailPanel.risk.${node.riskLevel}`)}
              />
            )}
            {showTraceGap && (
              <FileQuestion
                className="h-3 w-3"
                style={{ color: GRAPH_SEMANTIC_COLORS.traceabilityGap }}
                aria-label={t("detailPanel.evidenceGap")}
              />
            )}
            {metrics?.onCriticalPath && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: GRAPH_SEMANTIC_COLORS.critical }}
                aria-label={t("detailPanel.criticalPath")}
                title={t("detailPanel.criticalPath")}
              />
            )}
            {Boolean(node.metadata?.laborRisk) &&
              ((node.metadata as { laborRisk?: { shortageRisk: ShortageRiskLevel } }).laborRisk?.shortageRisk ?? "none") !== "none" && (
              <HardHat
                className="h-3 w-3"
                style={{
                  color:
                    SHORTAGE_RISK_COLORS[
                      (node.metadata as { laborRisk: { shortageRisk: ShortageRiskLevel } })
                        .laborRisk.shortageRisk
                    ],
                }}
                aria-label={t("detailPanel.laborRisk")}
              />
            )}
          </span>
        </div>

        {/* Progress bar (slim, bottom) */}
        {node.progress != null && (
          <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, node.progress))}%`,
                backgroundColor: isCompleted
                  ? GRAPH_SEMANTIC_COLORS.completed
                  : style.accent,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export const LivingGraphNode = memo(LivingGraphNodeComponent);
LivingGraphNode.displayName = "LivingGraphNode";
