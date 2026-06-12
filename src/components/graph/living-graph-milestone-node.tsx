"use client";

// ============================================================================
// ProjectOps360° — Living Graph milestone card (flowchart level)
// ============================================================================
// Rich roadmap-style card mirroring the Execution Map "Flow" view: status
// glow, icon chip, date range, SVG progress ring and task counter. Rendered
// when the graph is at the "milestones" detail level.
// ============================================================================

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslations, useLocale } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  Flag,
  Lock,
  CheckCircle2,
  CircleDashed,
  Settings,
  ShieldCheck,
  Users,
  BookOpen,
  Link2,
  Sparkles,
  BarChart3,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GRAPH_SEMANTIC_COLORS, hexToRgba } from "@/lib/graph/living-graph-styles";
import { MILESTONE_HEALTH_HEX } from "@/lib/roadmap/status-mappings";
import type { MilestoneStatusDisplay } from "@/types/database";
import type { LivingFlowNode } from "./living-graph-flow-types";

interface StatusTheme {
  accent: string;
  chip: boolean;
}

// Centralized color mapping — deferred and planned are now distinct
const STATUS_THEMES: Record<string, StatusTheme> = {
  completed: { accent: MILESTONE_HEALTH_HEX.completed.color, chip: false },
  in_progress: { accent: MILESTONE_HEALTH_HEX.in_progress.color, chip: true },
  blocked: { accent: MILESTONE_HEALTH_HEX.blocked.color, chip: false },
  planned: { accent: MILESTONE_HEALTH_HEX.planned.color, chip: false },
  deferred: { accent: MILESTONE_HEALTH_HEX.deferred.color, chip: false },
  at_risk: { accent: MILESTONE_HEALTH_HEX.at_risk.color, chip: false },
};

/** milestones.icon_key → icon, mirroring the roadmap's icon set. */
const MILESTONE_ICONS: Record<string, LucideIcon> = {
  setup: Settings,
  shield_database: ShieldCheck,
  users: Users,
  notebook: BookOpen,
  link: Link2,
  sparkles: Sparkles,
  chart: BarChart3,
  loop: RefreshCw,
  check_circle: CheckCircle2,
  rocket: Rocket,
};

function ProgressRing({ value, accent }: { value: number; accent: string }) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="relative h-11 w-11" role="img" aria-label={`${Math.round(clamped)}%`}>
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke={accent}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function LivingGraphMilestoneNodeComponent({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<LivingFlowNode>) {
  const t = useTranslations("livingGraph");
  const locale = useLocale();
  const { node, emphasis, playback } = data;

  const theme = STATUS_THEMES[node.status ?? ""] ?? STATUS_THEMES.planned;
  const accent = node.isBlocked ? GRAPH_SEMANTIC_COLORS.blocked : theme.accent;
  const isDimmed =
    (emphasis === "dimmed" && playback === "none") || playback === "future";
  const isPicked = data.isPathMember;
  const isDropTarget = data.isDropTarget;
  const isCompleted = node.status === "completed";

  const tasksTotal =
    typeof node.metadata.tasksTotal === "number" ? node.metadata.tasksTotal : 0;
  const tasksDone =
    typeof node.metadata.tasksDone === "number" ? node.metadata.tasksDone : 0;
  const MilestoneIcon =
    (typeof node.metadata.milestone_icon === "string"
      ? MILESTONE_ICONS[node.metadata.milestone_icon]
      : undefined) ?? Flag;

  const dateRange = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
    const start = node.startDate ? fmt.format(new Date(node.startDate)) : null;
    const end = node.endDate ? fmt.format(new Date(node.endDate)) : null;
    if (start && end) return `${start} — ${end}`.toUpperCase();
    return (start ?? end ?? "").toUpperCase();
  }, [locale, node.startDate, node.endDate]);

  const handleClass = "!h-2 !w-2 !border-0 !bg-slate-500/70";
  const toPosition = (side: Position | undefined, fallback: Position) => side ?? fallback;

  return (
    <div
      role="group"
      aria-label={`${t("nodeTypes.milestone_gate")}: ${node.label}`}
      className={cn(
        "relative h-[168px] w-[260px] rounded-2xl border bg-card p-4 transition-all",
        isDropTarget
          ? "scale-105 border-emerald-400 border-dashed"
          : selected || isPicked
            ? "border-brand-500"
            : "border-border/70",
        isDimmed && "opacity-25",
        playback === "future" && "opacity-10",
        playback === "active" && "animate-pulse",
      )}
      style={{
        boxShadow: isDropTarget
          ? `0 0 0 3px ${hexToRgba("#34d399", 0.5)}, 0 12px 40px ${hexToRgba("#34d399", 0.35)}`
          : selected || isPicked
            ? `0 0 0 2px ${hexToRgba("#6366f1", 0.6)}, 0 8px 30px ${hexToRgba("#6366f1", 0.25)}`
            : `0 8px 28px ${hexToRgba(accent, isCompleted || theme.chip ? 0.18 : 0.06)}`,
      }}
    >
      <Handle
        type="target"
        position={toPosition(targetPosition, Position.Left)}
        className={handleClass}
      />
      <Handle
        type="source"
        position={toPosition(sourcePosition, Position.Right)}
        className={handleClass}
      />

      {/* Current phase chip */}
      {theme.chip && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-violet-500 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white shadow-md">
          {t("milestoneCard.currentPhase")}
        </span>
      )}

      {/* Icon + status dot */}
      <div className="flex items-start justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: hexToRgba(accent, 0.15), color: accent }}
        >
          <MilestoneIcon className="h-4 w-4" aria-hidden />
        </span>
        {node.isBlocked ? (
          <Lock
            className="h-3.5 w-3.5"
            style={{ color: GRAPH_SEMANTIC_COLORS.blocked }}
            aria-label={t("detailPanel.blocked")}
          />
        ) : isCompleted ? (
          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: accent }} aria-label={t("detailPanel.completed")} />
        ) : (
          <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>

      {/* Title + dates */}
      <p
        className="mt-2 line-clamp-2 text-[13px] font-bold leading-snug text-foreground"
        title={node.label}
      >
        {node.label}
      </p>
      {dateRange && (
        <p className="mt-0.5 text-[9px] font-medium tracking-widest text-muted-foreground">
          {dateRange}
        </p>
      )}

      {/* Progress ring + task counter */}
      <div className="absolute bottom-3.5 left-4 right-4 flex items-center gap-3">
        <ProgressRing value={node.progress ?? 0} accent={accent} />
        <span
          className="rounded-md px-2 py-1 font-mono text-[10px] font-bold tabular-nums"
          style={{ backgroundColor: hexToRgba(accent, 0.12), color: accent }}
        >
          {tasksDone}/{tasksTotal}
          <span className="ml-1 text-[8px] font-semibold uppercase tracking-wider opacity-80">
            {t("milestoneCard.tasks")}
          </span>
        </span>
      </div>
    </div>
  );
}

export const LivingGraphMilestoneNode = memo(LivingGraphMilestoneNodeComponent);
LivingGraphMilestoneNode.displayName = "LivingGraphMilestoneNode";
