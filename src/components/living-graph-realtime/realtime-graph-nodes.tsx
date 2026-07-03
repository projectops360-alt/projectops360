"use client";

// ============================================================================
// ProjectOps360° — Realtime Living Graph · Custom nodes
// ============================================================================
// High-fidelity React Flow nodes per hierarchy kind. Pure display of the view
// model (verbatim payload) — never recomputes truth. A recently-changed node
// pulses (from delta metadata). Accessibility: every kind/status has text +
// icon, never color alone.
// ============================================================================

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { Ban, ChevronDown, ChevronRight, Flag, GitBranch, ListTree, Sparkles, Users } from "lucide-react";
import {
  nodeTitle,
  nodeStatus,
  nodeProgress,
  nodeIsBlocked,
  type RealtimeGraphNode,
} from "@/lib/living-graph-realtime-ui";

export interface RealtimeNodeData extends Record<string, unknown> {
  node: RealtimeGraphNode;
  ownerName: string | null;
  expanded: boolean;
  isCurrentVersion: boolean;
  onToggleExpand?: (nodeId: string) => void;
  onOpenInspector?: (nodeId: string) => void;
}
type RtNode = Node<RealtimeNodeData>;

const KIND_ACCENT: Record<string, string> = {
  milestone: "border-amber-500/60",
  phase: "border-amber-500/60",
  task: "border-primary/50",
  subtask: "border-violet-500/50",
  evidence: "border-emerald-500/50",
  event: "border-emerald-500/50",
  dependency: "border-slate-400/50",
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${value >= 100 ? "bg-emerald-500" : "bg-primary"}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function pulseClass(node: RealtimeGraphNode, isCurrent: boolean): string {
  if (!isCurrent) return "";
  if (node.changeState === "added") return "ring-2 ring-emerald-500/70 animate-pulse";
  if (node.changeState === "updated") return "ring-2 ring-primary/70 animate-pulse";
  return "";
}

function BaseCard({
  data,
  children,
  width = 240,
}: {
  data: RealtimeNodeData;
  children: React.ReactNode;
  width?: number;
}) {
  const accent = KIND_ACCENT[data.node.nodeKind] ?? "border-border";
  return (
    <div
      data-testid={`rt-node-${data.node.nodeKind}`}
      data-node-kind={data.node.nodeKind}
      style={{ width }}
      className={`rounded-lg border-2 bg-card p-2.5 shadow-md transition-shadow ${accent} ${pulseClass(data.node, data.isCurrentVersion)}`}
      onClick={() => data.onOpenInspector?.(data.node.nodeId)}
      role="button"
      tabIndex={0}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !bg-muted-foreground" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !bg-muted-foreground" />
      {children}
    </div>
  );
}

function SubtaskAffordance({ data }: { data: RealtimeNodeData }) {
  const t = useTranslations("realtimeGraph");
  const total = data.node.directChildCount ?? 0;
  if (total <= 0) return null;
  return (
    <button
      type="button"
      data-testid="rt-node-expand"
      className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
      onClick={(e) => {
        e.stopPropagation();
        data.onToggleExpand?.(data.node.nodeId);
      }}
      aria-expanded={data.expanded}
    >
      {data.expanded ? <ChevronDown className="h-2.5 w-2.5" aria-hidden /> : <ChevronRight className="h-2.5 w-2.5" aria-hidden />}
      <ListTree className="h-2.5 w-2.5" aria-hidden />
      {t("node.subtasks", { count: total })}
    </button>
  );
}

function StatusLine({ data }: { data: RealtimeNodeData }) {
  const status = nodeStatus(data.node);
  const progress = nodeProgress(data.node);
  return (
    <>
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {status && <span className="uppercase tracking-wide">{status.replaceAll("_", " ")}</span>}
        {nodeIsBlocked(data.node) && <Ban className="h-3 w-3 text-red-500" aria-label="blocked" />}
        {data.ownerName && (
          <span className="ml-auto inline-flex items-center gap-1 truncate">
            <Users className="h-2.5 w-2.5" aria-hidden />
            {data.ownerName}
          </span>
        )}
      </div>
      {progress != null && <ProgressBar value={progress} />}
    </>
  );
}

export const MilestoneNode = memo(function MilestoneNode({ data }: NodeProps<RtNode>) {
  return (
    <BaseCard data={data} width={260}>
      <div className="flex items-center gap-1.5">
        <Flag className="h-3.5 w-3.5 text-amber-500" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{nodeTitle(data.node)}</p>
      </div>
      <StatusLine data={data} />
    </BaseCard>
  );
});

export const TaskNode = memo(function TaskNode({ data }: NodeProps<RtNode>) {
  return (
    <BaseCard data={data}>
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{nodeTitle(data.node)}</p>
        {data.node.evidenceAvailable && <Sparkles className="h-3 w-3 text-emerald-500" aria-label="evidence available" />}
      </div>
      <StatusLine data={data} />
      <SubtaskAffordance data={data} />
    </BaseCard>
  );
});

export const SubtaskNode = memo(function SubtaskNode({ data }: NodeProps<RtNode>) {
  return (
    <BaseCard data={data} width={210}>
      <div className="flex items-center gap-1.5">
        <ListTree className="h-3 w-3 text-violet-500" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{nodeTitle(data.node)}</p>
      </div>
      <StatusLine data={data} />
      <SubtaskAffordance data={data} />
    </BaseCard>
  );
});

export const EvidenceNode = memo(function EvidenceNode({ data }: NodeProps<RtNode>) {
  const t = useTranslations("realtimeGraph");
  return (
    <BaseCard data={data} width={190}>
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-emerald-500" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{nodeTitle(data.node)}</p>
      </div>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-emerald-600">{t("node.evidence")}</p>
    </BaseCard>
  );
});

export const DependencyNode = memo(function DependencyNode({ data }: NodeProps<RtNode>) {
  return (
    <BaseCard data={data} width={190}>
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-3 w-3 text-slate-400" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[11px] text-foreground">{nodeTitle(data.node)}</p>
      </div>
    </BaseCard>
  );
});

export const REALTIME_NODE_TYPES = {
  milestone: MilestoneNode,
  phase: MilestoneNode,
  task: TaskNode,
  subtask: SubtaskNode,
  evidence: EvidenceNode,
  event: EvidenceNode,
  dependency: DependencyNode,
} as const;

/** Map a node kind to its registered React Flow node type. */
export function realtimeNodeType(kind: string): keyof typeof REALTIME_NODE_TYPES {
  return (kind in REALTIME_NODE_TYPES ? kind : "task") as keyof typeof REALTIME_NODE_TYPES;
}
