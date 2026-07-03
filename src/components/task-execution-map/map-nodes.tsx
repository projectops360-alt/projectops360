"use client";

// ============================================================================
// ProjectOps360° — Task Execution Map · Custom nodes
// ============================================================================
// Mind-map nodes rendered by React Flow. Accessibility: every status carries
// text + icon (never color alone); indicators have title tooltips. Visual
// semantics come from the record-backed model (map-model.ts) — the map is
// operational, never decorative.
// ============================================================================

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  Flame,
  Layers,
  Link2,
  User,
  XCircle,
} from "lucide-react";
import type { SubtaskStatus } from "@/lib/subtasks/types";

// ── Shared bits ───────────────────────────────────────────────────────────────

export const STATUS_ICONS: Record<SubtaskStatus, React.ComponentType<{ className?: string }>> = {
  not_started: CircleDashed,
  in_progress: Clock,
  blocked: Ban,
  in_review: Eye,
  completed: CheckCircle2,
  cancelled: XCircle,
};

export const STATUS_BADGE_CLASS: Record<SubtaskStatus, string> = {
  not_started: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  blocked: "bg-red-500/10 text-red-600 border-red-500/40",
  in_review: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-muted text-muted-foreground/70 border-border",
};

function StatusBadge({ status }: { status: SubtaskStatus | string }) {
  const t = useTranslations("taskExecutionMap");
  const s = (status in STATUS_BADGE_CLASS ? status : "not_started") as SubtaskStatus;
  const Icon = STATUS_ICONS[s];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASS[s]}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {t(`status.${s}`)}
    </span>
  );
}

function OwnerChip({ name }: { name: string | null }) {
  const t = useTranslations("taskExecutionMap");
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title={name ?? t("unassigned")}>
      {initials ? (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[8px] font-semibold text-primary">
          {initials}
        </span>
      ) : (
        <User className="h-3 w-3" aria-hidden />
      )}
      <span className="max-w-[90px] truncate">{name ?? t("unassigned")}</span>
    </span>
  );
}

function ProgressBar({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all ${muted ? "bg-muted-foreground/40" : value >= 100 ? "bg-emerald-500" : "bg-primary"}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ── Parent task (central) node ────────────────────────────────────────────────

export type ParentNodeType = Node<Record<string, unknown>, "parentTask">;

export function ParentTaskNode({ data }: NodeProps<ParentNodeType>) {
  const t = useTranslations("taskExecutionMap");
  const d = data as {
    title: string;
    status: string;
    progress: number;
    progressSource: "subtasks" | "manual";
    ownerName: string | null;
    isCritical: boolean;
    completedCount: number;
    activeCount: number;
    blockedCount: number;
    overdueCount: number;
    estimatedHours: number | null;
    actualHours: number | null;
    varianceHours: number | null;
    criticalAtRisk: boolean;
  };
  return (
    <div
      data-testid="tem-parent-node"
      className={`w-[300px] rounded-xl border-2 bg-card p-3 shadow-lg ${
        d.criticalAtRisk ? "border-red-500" : d.isCritical ? "border-amber-500" : "border-primary/50"
      }`}
    >
      <Handle type="source" position={Position.Right} className="!bg-primary" />
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-foreground">{d.title}</p>
        {(d.isCritical || d.criticalAtRisk) && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
              d.criticalAtRisk
                ? "border-red-500/40 bg-red-500/10 text-red-600"
                : "border-amber-500/40 bg-amber-500/10 text-amber-600"
            }`}
            title={d.criticalAtRisk ? t("parent.criticalAtRisk") : t("parent.criticalPath")}
          >
            <Flame className="h-3 w-3" aria-hidden />
            {d.criticalAtRisk ? t("parent.criticalAtRisk") : t("parent.criticalPath")}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ProgressBar value={d.progress} />
        <span className="text-xs font-semibold tabular-nums text-foreground">{d.progress}%</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {d.progressSource === "subtasks" ? t("parent.progressFromSubtasks") : t("parent.progressManual")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={d.status === "done" ? "completed" : d.status === "blocked" ? "blocked" : "in_progress"} />
        <OwnerChip name={d.ownerName} />
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
        <div>
          <dt className="inline">{t("parent.done")}: </dt>
          <dd className="inline font-medium tabular-nums text-foreground">
            {d.completedCount}/{d.activeCount}
          </dd>
        </div>
        <div className={d.blockedCount > 0 ? "text-red-600" : undefined}>
          <dt className="inline">{t("parent.blocked")}: </dt>
          <dd className="inline font-medium tabular-nums">{d.blockedCount}</dd>
        </div>
        <div className={d.overdueCount > 0 ? "text-amber-600" : undefined}>
          <dt className="inline">{t("parent.overdue")}: </dt>
          <dd className="inline font-medium tabular-nums">{d.overdueCount}</dd>
        </div>
        <div>
          <dt className="inline">{t("parent.estimated")}: </dt>
          <dd className="inline tabular-nums">{d.estimatedHours ?? "—"}h</dd>
        </div>
        <div>
          <dt className="inline">{t("parent.actual")}: </dt>
          <dd className="inline tabular-nums">{d.actualHours ?? "—"}h</dd>
        </div>
        <div className={d.varianceHours !== null && d.varianceHours > 0 ? "text-amber-600" : undefined}>
          <dt className="inline">{t("parent.variance")}: </dt>
          <dd className="inline tabular-nums">
            {d.varianceHours === null ? "—" : `${d.varianceHours > 0 ? "+" : ""}${Math.round(d.varianceHours * 10) / 10}h`}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ── Subtask node ──────────────────────────────────────────────────────────────

export type SubtaskNodeType = Node<Record<string, unknown>, "subtask">;

export function SubtaskMapNode({ data }: NodeProps<SubtaskNodeType>) {
  const t = useTranslations("taskExecutionMap");
  const d = data as {
    title: string;
    status: SubtaskStatus;
    progress: number;
    ownerName: string | null;
    dueDate: string | null;
    weight: number | null;
    estimatedHours: number | null;
    isCritical: boolean;
    isOverdue: boolean;
    isBlocked: boolean;
    muted: boolean;
  };
  return (
    <div
      data-testid="tem-subtask-node"
      className={`w-[240px] rounded-lg border bg-card p-2.5 shadow-sm transition-opacity ${
        d.muted ? "opacity-50" : ""
      } ${d.isBlocked ? "border-red-500/60" : d.isCritical ? "border-amber-500/60" : "border-border"}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-xs font-medium leading-tight text-foreground">{d.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          {d.isCritical && (
            <Flame className="h-3.5 w-3.5 text-amber-500" aria-label={t("node.critical")} />
          )}
          {d.isOverdue && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-amber-600"
              aria-label={t("node.overdue")}
            />
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <ProgressBar value={d.progress} muted={d.muted} />
        <span className="text-[10px] font-semibold tabular-nums text-foreground">{d.progress}%</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
        <StatusBadge status={d.status} />
        <OwnerChip name={d.ownerName} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span title={t("node.dueDate")}>{d.dueDate ?? "—"}</span>
        <span title={t("node.weightOrHours")} className="tabular-nums">
          {d.weight != null ? `w:${d.weight}` : d.estimatedHours != null ? `${d.estimatedHours}h` : "—"}
        </span>
      </div>
    </div>
  );
}

// ── Blocker node ──────────────────────────────────────────────────────────────

export type BlockerNodeType = Node<Record<string, unknown>, "blocker">;

export function BlockerMapNode({ data }: NodeProps<BlockerNodeType>) {
  const t = useTranslations("taskExecutionMap");
  const d = data as {
    reason: string | null;
    ageDays: number;
    ownerName: string | null;
    impact: "critical" | "normal";
    affectsCriticalPath: boolean;
  };
  return (
    <div
      data-testid="tem-blocker-node"
      className="w-[220px] rounded-lg border-2 border-red-500 bg-red-500/10 p-2.5 shadow-md"
      role="alert"
    >
      <Handle type="source" position={Position.Left} className="!bg-red-500" />
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700 dark:text-red-400">
        <Ban className="h-3.5 w-3.5" aria-hidden />
        {t("blocker.title")}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-foreground">
        {d.reason ?? t("blocker.noReason")}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>{t("blocker.age", { days: d.ageDays })}</span>
        <OwnerChip name={d.ownerName} />
        <span className={d.impact === "critical" ? "font-semibold text-red-600" : undefined}>
          {t(`blocker.impact.${d.impact}`)}
        </span>
      </div>
      {d.affectsCriticalPath && (
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
          <Flame className="h-3 w-3" aria-hidden />
          {t("blocker.affectsCriticalPath")}
        </p>
      )}
    </div>
  );
}

// ── External dependency node (dotted edge) ────────────────────────────────────

export type DependencyNodeType = Node<Record<string, unknown>, "dependency">;

export function DependencyMapNode({ data }: NodeProps<DependencyNodeType>) {
  const t = useTranslations("taskExecutionMap");
  const d = data as { title: string; status: string };
  return (
    <div
      data-testid="tem-dependency-node"
      className="w-[200px] rounded-lg border border-dashed border-muted-foreground/50 bg-muted/40 p-2.5"
    >
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
        <Link2 className="h-3 w-3" aria-hidden />
        {t("dependency.title")}
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-foreground">{d.title}</p>
      <p className="text-[10px] text-muted-foreground">{d.status}</p>
    </div>
  );
}

// ── Group node (auto-clustering for large maps) ───────────────────────────────

export type GroupNodeType = Node<Record<string, unknown>, "group">;

export function GroupMapNode({ data }: NodeProps<GroupNodeType>) {
  const t = useTranslations("taskExecutionMap");
  const d = data as {
    groupKey: string;
    grouping: string;
    count: number;
    blockedCount: number;
    overdueCount: number;
    completedCount: number;
  };
  const label =
    d.grouping === "status" && (d.groupKey in STATUS_BADGE_CLASS)
      ? t(`status.${d.groupKey as SubtaskStatus}`)
      : d.groupKey === "unassigned"
        ? t("unassigned")
        : d.groupKey;
  return (
    <div
      data-testid="tem-group-node"
      className="w-[220px] cursor-pointer rounded-lg border border-border bg-card/80 p-2.5 shadow-sm hover:border-primary/50"
      title={t("group.expandHint")}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {label}
        <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{d.count}</span>
      </div>
      <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
        <span className="text-emerald-600">✓ {d.completedCount}</span>
        {d.blockedCount > 0 && <span className="text-red-600">⛔ {d.blockedCount}</span>}
        {d.overdueCount > 0 && <span className="text-amber-600">⚠ {d.overdueCount}</span>}
      </div>
    </div>
  );
}
