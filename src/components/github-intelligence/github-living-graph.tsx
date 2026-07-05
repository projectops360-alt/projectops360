"use client";

// ============================================================================
// GitHub Living Graph — time-based Git timeline (bump-and-merge, scrollable)
// ============================================================================
// A polished Git-style timeline: a horizontal "main" spine that runs left→right
// through TIME, with commit dots at their real timestamps. Feature branches bump
// ABOVE the spine, hotfix/release bump BELOW, each with commit dots and a curve
// that returns (merges) to the spine at the merge time. Release tags render as
// pills on the spine. The chart is wider than the viewport and scrolls
// horizontally so you can travel through the project's history.
// ============================================================================

import { useMemo } from "react";
import type { BranchType, GitHubLivingGraphData } from "@/lib/github-intelligence/types";

interface Props {
  data: GitHubLivingGraphData;
  isEs?: boolean;
}

const LANE_COLORS: Record<BranchType, string> = {
  main: "text-muted-foreground",
  feature: "text-brand-500",
  hotfix: "text-orange-500",
  release: "text-purple-500",
  other: "text-sky-500",
};

// Geometry (pixels — the SVG uses its natural width and scrolls).
const MARGIN_LEFT = 96;
const MARGIN_RIGHT = 56;
const LANE_GAP = 58;
const NODE_R = 5;
const CURVE = 26;
const TOP_PAD = 44;
const BOTTOM_PAD = 48;
const PX_PER_NODE = 46;
const MIN_PLOT = 760;
const MAX_PLOT = 4200;

interface LaidNode { x: number; label: string; sha?: string; occurredAt: string; collapsed?: number }
interface LaidBranch {
  id: string; name: string; type: BranchType; color: string; blocked: boolean;
  laneY: number; startX: number; endX: number; merged: boolean; openPrNumber?: number;
  nodes: LaidNode[]; above: boolean;
}

export function GitHubLivingGraph({ data, isEs = false }: Props) {
  const layout = useMemo(() => computeTimeline(data), [data]);

  const totalBranches = data.branches.length;
  const summaryText = isEs
    ? `Línea de tiempo de ${data.repositoryName || "repositorio"} — rama principal ${data.mainBranch}, ${totalBranches} rama(s) mostradas${data.hiddenBranchCount ? `, ${data.hiddenBranchCount} ocultas` : ""}.`
    : `Timeline of ${data.repositoryName || "repository"} — main branch ${data.mainBranch}, ${totalBranches} branch(es) shown${data.hiddenBranchCount ? `, ${data.hiddenBranchCount} hidden` : ""}.`;

  const isEmpty = data.branches.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">GitHub Living Graph</h2>
          <p className="text-xs text-muted-foreground">
            {data.repositoryName || (isEs ? "Sin repositorio" : "No repository")} · {data.windowLabel}
          </p>
        </div>
        <Legend isEs={isEs} />
      </div>

      {isEmpty ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          {isEs ? "Sin actividad de ramas en esta ventana." : "No branch activity in this window."}
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-hidden rounded-xl" role="group" aria-label={summaryText}>
          <svg width={layout.width} height={layout.height} className="block" style={{ minWidth: "100%" }}>
            {/* Spine (main) */}
            <line x1={MARGIN_LEFT - 8} y1={layout.centerY} x2={layout.width - 12} y2={layout.centerY} className="text-muted-foreground/50" stroke="currentColor" strokeWidth={2.5} />
            <text x={12} y={layout.centerY + 4} className="fill-foreground text-[13px] font-semibold">{data.mainBranch}</text>

            {/* main commit dots on the spine */}
            {layout.mainNodes.map((n) => (
              <g key={n.x + n.occurredAt} className="text-muted-foreground">
                <circle cx={n.x} cy={layout.centerY} r={NODE_R} className="fill-current" />
                <title>{`${n.sha ? n.sha.slice(0, 7) : n.label} · ${data.mainBranch} · ${fmt(n.occurredAt)}`}</title>
              </g>
            ))}

            {/* branch bumps */}
            {layout.branches.map((b) => <BranchBump key={b.id} b={b} centerY={layout.centerY} isEs={isEs} />)}

            {/* release tags on the spine */}
            {layout.tags.map((t, i) => (
              <g key={`${t.label}-${i}`} className="text-purple-500">
                <line x1={t.x} y1={layout.centerY} x2={t.x} y2={layout.centerY + 16} stroke="currentColor" strokeDasharray="2 2" opacity={0.6} />
                <circle cx={t.x} cy={layout.centerY} r={4} className="fill-current" />
                <rect x={t.x - 24} y={layout.centerY + 16} width={48} height={17} rx={8.5} className="fill-purple-500/15 stroke-purple-500/50" strokeWidth={1} />
                <text x={t.x} y={layout.centerY + 28} textAnchor="middle" className="fill-purple-600 dark:fill-purple-300 text-[10px] font-semibold">
                  {t.label.length > 8 ? `${t.label.slice(0, 7)}…` : t.label}
                </text>
                <title>{`${t.label}${t.occurredAt ? ` · ${fmt(t.occurredAt)}` : ""}`}</title>
              </g>
            ))}

            {/* time axis hint */}
            <text x={MARGIN_LEFT} y={layout.height - 14} className="fill-muted-foreground text-[11px]">
              {isEs ? "tiempo →" : "time →"}
            </text>
          </svg>
        </div>
      )}

      {data.hiddenBranchCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {isEs
            ? `+${data.hiddenBranchCount} rama(s) adicionales no mostradas para mantener el grafo legible.`
            : `+${data.hiddenBranchCount} more branch(es) not shown to keep the graph readable.`}
        </p>
      )}
      <p className="sr-only">{summaryText}</p>
    </div>
  );
}

// ── Branch bump (leave spine → commits → merge back) ──────────────────────────

function BranchBump({ b, centerY, isEs }: { b: LaidBranch; centerY: number; isEs: boolean }) {
  const { laneY, startX, endX, merged, color } = b;
  const leave = `M ${startX} ${centerY} C ${startX + CURVE} ${centerY}, ${startX} ${laneY}, ${startX + CURVE} ${laneY}`;
  const lane = `M ${startX + CURVE} ${laneY} L ${endX - (merged ? CURVE : 0)} ${laneY}`;
  const rejoin = merged ? `M ${endX - CURVE} ${laneY} C ${endX} ${laneY}, ${endX - CURVE} ${centerY}, ${endX} ${centerY}` : "";
  const labelAbove = b.above;

  return (
    <g className={color}>
      <path d={leave} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />
      <path d={lane} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />
      {merged && <path d={rejoin} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />}
      {merged && <circle cx={endX} cy={centerY} r={4} className="fill-current" />}

      {/* label pill */}
      <g>
        <rect
          x={startX + CURVE}
          y={labelAbove ? laneY - 26 : laneY + 8}
          width={Math.min(210, b.name.length * 6.6 + 40)}
          height={17}
          rx={8.5}
          className="fill-current"
          opacity={0.12}
        />
        <text x={startX + CURVE + 8} y={labelAbove ? laneY - 14 : laneY + 20} className="fill-current text-[11px] font-medium">
          {b.name.length > 26 ? `${b.name.slice(0, 25)}…` : b.name}
          {b.openPrNumber ? ` · PR #${b.openPrNumber}` : ""}
        </text>
      </g>

      {/* commit dots */}
      {b.nodes.map((n, i) => (
        <g key={i}>
          {n.collapsed ? (
            <>
              <rect x={n.x - 13} y={laneY - 8.5} width={26} height={17} rx={8.5} className="fill-current" opacity={0.2} />
              <text x={n.x} y={laneY + 4} textAnchor="middle" className="fill-current text-[10px] font-semibold">{n.label}</text>
            </>
          ) : (
            <circle cx={n.x} cy={laneY} r={NODE_R} className="fill-current" />
          )}
          <title>
            {n.collapsed
              ? `${n.collapsed} ${isEs ? "commits anteriores" : "earlier commits"}`
              : `${n.sha ? n.sha.slice(0, 7) : n.label} · ${b.name} · ${fmt(n.occurredAt)}`}
          </title>
        </g>
      ))}
    </g>
  );
}

function Legend({ isEs }: { isEs: boolean }) {
  const items: Array<{ t: BranchType; label: string }> = [
    { t: "feature", label: "Feature" },
    { t: "hotfix", label: "Hotfix" },
    { t: "release", label: "Release" },
    { t: "main", label: isEs ? "Main / release" : "Main / release" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((i) => (
        <span key={i.t} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={`h-2.5 w-2.5 rounded-full bg-current ${LANE_COLORS[i.t]}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ── Timeline layout computation ───────────────────────────────────────────────

function computeTimeline(data: GitHubLivingGraphData) {
  const above = data.branches.filter((b) => b.type === "feature" || b.type === "other");
  const below = data.branches.filter((b) => b.type === "hotfix" || b.type === "release");
  const mainBranch = data.branches.find((b) => b.type === "main");

  // Collect all timestamps to build the time axis.
  const times: number[] = [];
  const push = (s?: string) => { if (s) { const t = new Date(s).getTime(); if (t > 0) times.push(t); } };
  for (const b of data.branches) {
    push(b.startAt); push(b.mergedAt); push(b.lastCommitAt);
    for (const n of b.nodes) push(n.occurredAt);
  }
  for (const t of data.tags) push(t.occurredAt);

  let minT = times.length ? Math.min(...times) : 0;
  let maxT = times.length ? Math.max(...times) : 1;
  if (maxT <= minT) { maxT = minT + 1; }
  // pad the range a touch so start/end curves have room
  const pad = (maxT - minT) * 0.04 || 1;
  minT -= pad; maxT += pad;

  const totalNodes = data.branches.reduce((s, b) => s + b.nodes.length, 0) + data.tags.length;
  const plotW = Math.max(MIN_PLOT, Math.min(MAX_PLOT, totalNodes * PX_PER_NODE));
  const width = MARGIN_LEFT + plotW + MARGIN_RIGHT;

  const xForTime = (iso?: string, fallback = maxT): number => {
    const t = iso ? new Date(iso).getTime() : NaN;
    const tt = Number.isFinite(t) && t > 0 ? t : fallback;
    return MARGIN_LEFT + ((tt - minT) / (maxT - minT)) * plotW;
  };

  // Lane assignment (greedy interval packing so bumps don't overlap in time).
  function assignLanes(branches: GitHubLivingGraphData["branches"]) {
    const laneEnds: number[] = [];
    return branches
      .slice()
      .sort((a, b) => xForTime(a.startAt) - xForTime(b.startAt))
      .map((b) => {
        const startX = xForTime(b.startAt);
        const endX = Math.max(startX + CURVE * 2 + 8, xForTime(b.mergedAt ?? b.lastCommitAt));
        let lane = laneEnds.findIndex((end) => end < startX - 12);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(endX); }
        else laneEnds[lane] = endX;
        return { b, startX, endX, lane };
      });
  }

  const laidAbove = assignLanes(above);
  const laidBelow = assignLanes(below);
  const aboveLanes = laidAbove.reduce((m, x) => Math.max(m, x.lane + 1), 0);
  const belowLanes = laidBelow.reduce((m, x) => Math.max(m, x.lane + 1), 0);

  const centerY = TOP_PAD + aboveLanes * LANE_GAP;
  const height = centerY + Math.max(1, belowLanes) * LANE_GAP + BOTTOM_PAD;

  const layNodes = (b: GitHubLivingGraphData["branches"][number], startX: number, endX: number): LaidNode[] => {
    const lo = startX + CURVE + 4;
    const hi = Math.max(lo + 1, endX - CURVE - 4);
    return b.nodes.map((n) => {
      let x = xForTime(n.occurredAt);
      if (x < lo) x = lo; if (x > hi) x = hi;
      return { x, label: n.label, sha: n.sha, occurredAt: n.occurredAt, collapsed: n.collapsedCount };
    });
  };

  const branches: LaidBranch[] = [
    ...laidAbove.map(({ b, startX, endX, lane }) => ({
      id: b.id, name: b.name, type: b.type, color: b.status === "blocked" ? "text-red-500" : LANE_COLORS[b.type],
      blocked: b.status === "blocked", laneY: centerY - (lane + 1) * LANE_GAP, startX, endX,
      merged: b.status === "merged" || Boolean(b.mergedAt), openPrNumber: b.openPrNumber,
      nodes: layNodes(b, startX, endX), above: true,
    })),
    ...laidBelow.map(({ b, startX, endX, lane }) => ({
      id: b.id, name: b.name, type: b.type, color: b.status === "blocked" ? "text-red-500" : LANE_COLORS[b.type],
      blocked: b.status === "blocked", laneY: centerY + (lane + 1) * LANE_GAP, startX, endX,
      merged: b.status === "merged" || Boolean(b.mergedAt), openPrNumber: b.openPrNumber,
      nodes: layNodes(b, startX, endX), above: false,
    })),
  ];

  const mainNodes: LaidNode[] = mainBranch
    ? mainBranch.nodes.map((n) => ({ x: xForTime(n.occurredAt), label: n.label, sha: n.sha, occurredAt: n.occurredAt, collapsed: n.collapsedCount }))
    : [];

  const tags = data.tags.map((t) => ({ label: t.label, occurredAt: t.occurredAt, x: xForTime(t.occurredAt) }));

  return { width, height, centerY, branches, mainNodes, tags };
}

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
