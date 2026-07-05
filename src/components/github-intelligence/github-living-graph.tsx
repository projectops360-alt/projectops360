"use client";

// ============================================================================
// GitHub Living Graph — fishbone / Git-style timeline (custom SVG)
// ============================================================================
// A polished, READABLE Git fishbone: a horizontal "main" spine, feature
// branches above (ProjectOps green), hotfix (orange) / release (purple) below,
// commits as small circles, release tags as pills on the spine. Bounded by the
// graph-builder (max branches / collapsed commits) so it never becomes a
// crowded network graph. Accessible: aria-label + a text summary + native
// <title> tooltips; never relies on color alone.
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

const BLOCKED_COLOR = "text-red-500";

// Geometry (viewBox units; scales responsively via width=100%).
const VB_W = 1000;
const LANE_H = 62;
const NODE_R = 6;
const MARGIN_X = 120;

export function GitHubLivingGraph({ data, isEs = false }: Props) {
  const layout = useMemo(() => computeLayout(data), [data]);

  const totalBranches = data.branches.length;
  const summaryText = isEs
    ? `Grafo de ${data.repositoryName || "repositorio"} — rama principal ${data.mainBranch}, ${totalBranches} rama(s) mostradas${data.hiddenBranchCount ? `, ${data.hiddenBranchCount} ocultas` : ""}.`
    : `Graph of ${data.repositoryName || "repository"} — main branch ${data.mainBranch}, ${totalBranches} branch(es) shown${data.hiddenBranchCount ? `, ${data.hiddenBranchCount} hidden` : ""}.`;

  const isEmpty = data.branches.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {isEs ? "GitHub Living Graph" : "GitHub Living Graph"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {data.repositoryName || (isEs ? "Sin repositorio" : "No repository")} · {data.windowLabel}
          </p>
        </div>
        <Legend isEs={isEs} />
      </div>

      {isEmpty ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          {isEs
            ? "Sin actividad de ramas en esta ventana."
            : "No branch activity in this window."}
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${VB_W} ${layout.height}`}
          className="w-full"
          role="img"
          aria-label={summaryText}
          style={{ maxHeight: 420 }}
        >
          {/* Spine (main) */}
          <line
            x1={MARGIN_X}
            y1={layout.centerY}
            x2={VB_W - 24}
            y2={layout.centerY}
            className="text-muted-foreground/60"
            stroke="currentColor"
            strokeWidth={2}
          />
          <text x={24} y={layout.centerY + 4} className="fill-muted-foreground text-[13px] font-semibold">
            {data.mainBranch}
          </text>

          {/* Branch lanes */}
          {layout.branches.map((b) => (
            <BranchLane key={b.id} b={b} centerY={layout.centerY} />
          ))}

          {/* Release tags on the spine */}
          {layout.tags.map((t, i) => (
            <g key={`${t.label}-${i}`}>
              <rect
                x={t.x - 22}
                y={layout.centerY - 30}
                width={44}
                height={18}
                rx={9}
                className="fill-purple-500/15 stroke-purple-500/50"
                strokeWidth={1}
              />
              <text x={t.x} y={layout.centerY - 17} textAnchor="middle" className="fill-purple-600 dark:fill-purple-300 text-[10px] font-medium">
                {t.label.length > 8 ? `${t.label.slice(0, 7)}…` : t.label}
              </text>
              <line x1={t.x} y1={layout.centerY - 12} x2={t.x} y2={layout.centerY} className="text-purple-500/50" stroke="currentColor" strokeDasharray="2 2" />
              <title>{t.label}{t.occurredAt ? ` · ${new Date(t.occurredAt).toLocaleDateString()}` : ""}</title>
            </g>
          ))}
        </svg>
      )}

      {/* Overcrowding disclosure + text fallback (accessibility). */}
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

// ── Sub-components ─────────────────────────────────────────────────────────────

interface LaidOutBranch {
  id: string;
  name: string;
  type: BranchType;
  blocked: boolean;
  laneY: number;
  startX: number;
  endX: number;
  merged: boolean;
  openPrNumber?: number;
  nodes: Array<{ id: string; x: number; label: string; sha?: string; collapsedCount?: number; occurredAt: string }>;
}

function BranchLane({ b, centerY }: { b: LaidOutBranch; centerY: number }) {
  const color = b.blocked ? BLOCKED_COLOR : LANE_COLORS[b.type];
  return (
    <g className={color}>
      {/* leave the spine → lane */}
      <path
        d={`M ${b.startX} ${centerY} C ${b.startX + 20} ${centerY}, ${b.startX} ${b.laneY}, ${b.startX + 28} ${b.laneY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        opacity={0.75}
      />
      {/* lane line */}
      <line x1={b.startX + 28} y1={b.laneY} x2={b.endX} y2={b.laneY} stroke="currentColor" strokeWidth={2} opacity={0.75} />
      {/* return to spine when merged */}
      {b.merged && (
        <path
          d={`M ${b.endX} ${b.laneY} C ${b.endX + 20} ${b.laneY}, ${b.endX} ${centerY}, ${b.endX + 28} ${centerY}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          opacity={0.75}
        />
      )}
      {/* branch label pill */}
      <g>
        <rect
          x={b.startX + 20}
          y={b.laneY - 26}
          width={Math.min(190, b.name.length * 7 + 20)}
          height={18}
          rx={9}
          className="fill-current"
          opacity={0.12}
        />
        <text x={b.startX + 30} y={b.laneY - 13} className="fill-current text-[11px] font-medium">
          {b.name.length > 24 ? `${b.name.slice(0, 23)}…` : b.name}
          {b.openPrNumber ? ` · PR #${b.openPrNumber}` : ""}
        </text>
      </g>
      {/* commit nodes */}
      {b.nodes.map((n) => (
        <g key={n.id}>
          {n.collapsedCount ? (
            <>
              <rect x={n.x - 14} y={b.laneY - 9} width={28} height={18} rx={9} className="fill-current" opacity={0.18} />
              <text x={n.x} y={b.laneY + 4} textAnchor="middle" className="fill-current text-[10px] font-semibold">
                {n.label}
              </text>
            </>
          ) : (
            <circle cx={n.x} cy={b.laneY} r={NODE_R} className="fill-current" />
          )}
          <title>
            {n.collapsedCount
              ? `${n.collapsedCount} earlier commits`
              : `${n.sha ? n.sha.slice(0, 7) : n.label} · ${b.name} · ${new Date(n.occurredAt).toLocaleString()}`}
          </title>
        </g>
      ))}
    </g>
  );
}

function Legend({ isEs }: { isEs: boolean }) {
  const items: Array<{ t: BranchType; label: string }> = [
    { t: "feature", label: isEs ? "Feature" : "Feature" },
    { t: "hotfix", label: "Hotfix" },
    { t: "release", label: "Release" },
    { t: "main", label: "Main" },
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

// ── Layout computation ─────────────────────────────────────────────────────────

function computeLayout(data: GitHubLivingGraphData) {
  const above = data.branches.filter((b) => b.type === "feature" || b.type === "other");
  const below = data.branches.filter((b) => b.type === "hotfix" || b.type === "release");

  const aboveLanes = above.length;
  const belowLanes = below.length;
  const centerY = 40 + aboveLanes * LANE_H;
  const height = centerY + Math.max(1, belowLanes) * LANE_H + 40;

  const usableW = VB_W - MARGIN_X - 60;

  function layoutBranch(b: GitHubLivingGraphData["branches"][number], laneY: number): LaidOutBranch {
    const count = Math.max(1, b.nodes.length);
    // Spread nodes across ~70% of usable width, offset by lane so branches
    // don't perfectly overlap horizontally.
    const spanStart = MARGIN_X + 40;
    const spanEnd = MARGIN_X + usableW * 0.92;
    const step = (spanEnd - spanStart) / count;
    const nodes = b.nodes.map((n, i) => ({
      id: n.id,
      x: spanStart + step * (i + 0.5),
      label: n.label,
      sha: n.sha,
      collapsedCount: n.collapsedCount,
      occurredAt: n.occurredAt,
    }));
    const startX = nodes.length ? Math.max(MARGIN_X + 10, nodes[0].x - step * 0.8) : MARGIN_X + 40;
    const endX = nodes.length ? nodes[nodes.length - 1].x + step * 0.4 : spanEnd;
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      blocked: b.status === "blocked",
      laneY,
      startX,
      endX,
      merged: b.status === "merged" || Boolean(b.mergeSha),
      openPrNumber: b.openPrNumber,
      nodes,
    };
  }

  const laidAbove = above.map((b, idx) => layoutBranch(b, 40 + idx * LANE_H));
  const laidBelow = below.map((b, idx) => layoutBranch(b, centerY + (idx + 1) * LANE_H));

  const tags = data.tags.map((t, i) => ({
    label: t.label,
    occurredAt: t.occurredAt,
    x: MARGIN_X + 80 + ((i + 1) / (data.tags.length + 1)) * (usableW - 80),
  }));

  return { centerY, height, branches: [...laidAbove, ...laidBelow], tags };
}
