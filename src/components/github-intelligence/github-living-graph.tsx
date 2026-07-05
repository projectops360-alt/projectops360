"use client";

// ============================================================================
// GitHub Living Graph — Git timeline on a scrollable TIME RULER
// ============================================================================
// The graph is mounted on a real time scale: every commit dot, divergence and
// merge sits at its actual date. A bottom ruler shows day/week ticks + a "today"
// marker; the canvas is wider than the viewport and scrolls horizontally (the
// `main` label stays pinned). Branches whose true divergence predates the window
// enter from the left edge with a dashed fade — never a fake divergence.
// ============================================================================

import { useMemo, useRef, useState, useEffect, useLayoutEffect } from "react";
import type { BranchType, GitHubLivingGraphData } from "@/lib/github-intelligence/types";
import {
  createTimeScale, pxPerDay, generateTicks, applyLabelCollision, DAY_MS,
} from "@/lib/github-intelligence/time-axis";

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

// Geometry (px). The `main` label is an HTML overlay pinned to the left, so the
// plot begins past STICKY_W to avoid hiding content under it.
const STICKY_W = 66;
const PLOT_LEFT = STICKY_W + 12;
const MARGIN_RIGHT = 44;
const LANE_GAP = 58;
const NODE_R = 5;
const CURVE = 24;
const TOP_PAD = 46;
const AXIS_H = 36; // ruler band at the bottom
const MIN_PLOT = 680;
const MAX_PLOT = 6000;
const LABEL_MIN_SPACING = 54;

interface LaidNode { x: number; label: string; sha?: string; occurredAt: string; collapsed?: number }
interface LaidBranch {
  id: string; name: string; type: BranchType; color: string;
  laneY: number; startX: number; endX: number; merged: boolean; enterLeft: boolean;
  openPrNumber?: number; status?: string; nodes: LaidNode[]; above: boolean;
}

export function GitHubLivingGraph({ data, isEs = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  const layout = useMemo(() => computeLayout(data, isEs), [data, isEs]);

  // Start scrolled to the most recent activity (right edge), and detect overflow.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    setOverflow(el.scrollWidth > el.clientWidth + 4);
  }, [layout.width]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onResize = () => setOverflow(el.scrollWidth > el.clientWidth + 4);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
        <div className="flex items-center gap-3">
          {overflow && (
            <span className="text-[11px] font-medium text-muted-foreground">{isEs ? "desliza →" : "scroll →"}</span>
          )}
          <Legend isEs={isEs} />
        </div>
      </div>

      {isEmpty ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          {isEs ? "Sin actividad de ramas en esta ventana." : "No branch activity in this window."}
        </div>
      ) : (
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden rounded-xl" role="group" aria-label={summaryText}>
            <svg width={layout.width} height={layout.height} className="block" style={{ minWidth: "100%" }}>
              {/* main spine */}
              <line x1={PLOT_LEFT - 10} y1={layout.centerY} x2={layout.width - 12} y2={layout.centerY} className="text-muted-foreground/50" stroke="currentColor" strokeWidth={2.5} />

              {/* time ruler */}
              <line x1={PLOT_LEFT - 10} y1={layout.axisY} x2={layout.width - 12} y2={layout.axisY} className="text-border" stroke="currentColor" strokeWidth={1} />
              {layout.ticks.map((tk, i) => (
                <g key={i} className="text-muted-foreground">
                  <line x1={tk.x} y1={layout.axisY} x2={tk.x} y2={layout.axisY - (tk.major ? 6 : 3)} stroke="currentColor" strokeWidth={1} opacity={tk.major ? 0.7 : 0.4} />
                  {tk.showLabel && (
                    <text x={tk.x} y={layout.axisY + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">{tk.label}</text>
                  )}
                </g>
              ))}

              {/* "today" marker */}
              <g className="text-muted-foreground">
                <line x1={layout.todayX} y1={TOP_PAD - 20} x2={layout.todayX} y2={layout.axisY} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                <text x={layout.todayX} y={TOP_PAD - 24} textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">{isEs ? "hoy" : "today"}</text>
              </g>

              {/* main commit dots */}
              {layout.mainNodes.map((n, i) => (
                <g key={i} className="text-muted-foreground">
                  <circle cx={n.x} cy={layout.centerY} r={NODE_R} className="fill-current" />
                  <title>{`${n.sha ? n.sha.slice(0, 7) : n.label} · ${data.mainBranch} · ${fmt(n.occurredAt)}`}</title>
                </g>
              ))}

              {/* branch bumps */}
              {layout.branches.map((b) => <BranchBump key={b.id} b={b} centerY={layout.centerY} isEs={isEs} />)}

              {/* release tags on the spine */}
              {layout.tags.map((t, i) => (
                <g key={`${t.label}-${i}`} className="text-purple-500">
                  <circle cx={t.x} cy={layout.centerY} r={4} className="fill-current" />
                  <rect x={t.x - 24} y={layout.centerY - 34} width={48} height={17} rx={8.5} className="fill-purple-500/15 stroke-purple-500/50" strokeWidth={1} />
                  <text x={t.x} y={layout.centerY - 22} textAnchor="middle" className="fill-purple-600 dark:fill-purple-300 text-[10px] font-semibold">
                    {t.label.length > 8 ? `${t.label.slice(0, 7)}…` : t.label}
                  </text>
                  <line x1={t.x} y1={layout.centerY - 17} x2={t.x} y2={layout.centerY} stroke="currentColor" strokeDasharray="2 2" opacity={0.5} />
                  <title>{`${t.label}${t.occurredAt ? ` · ${fmt(t.occurredAt)}` : ""}`}</title>
                </g>
              ))}
            </svg>
          </div>

          {/* pinned `main` label (stays put while the canvas scrolls) */}
          <div
            className="pointer-events-none absolute left-0 flex items-center"
            style={{ top: layout.centerY - 12, height: 24 }}
          >
            <span className="rounded-md border border-border bg-card px-2 py-0.5 text-[13px] font-semibold text-foreground shadow-sm">
              {data.mainBranch}
            </span>
          </div>
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

// ── Branch bump (leave spine or enter-from-left → commits → merge back) ────────

function BranchBump({ b, centerY, isEs }: { b: LaidBranch; centerY: number; isEs: boolean }) {
  const { laneY, startX, endX, merged, color, enterLeft } = b;
  const laneStart = enterLeft ? startX : startX + CURVE;
  const leave = enterLeft
    ? ""
    : `M ${startX} ${centerY} C ${startX + CURVE} ${centerY}, ${startX} ${laneY}, ${startX + CURVE} ${laneY}`;
  const lane = `M ${laneStart} ${laneY} L ${endX - (merged ? CURVE : 0)} ${laneY}`;
  const rejoin = merged ? `M ${endX - CURVE} ${laneY} C ${endX} ${laneY}, ${endX - CURVE} ${centerY}, ${endX} ${centerY}` : "";
  const stateLabel = b.status === "merged" ? (isEs ? "mergeado" : "merged") : b.status === "stale" ? "stale" : (isEs ? "activo" : "active");

  return (
    <g className={color}>
      {/* enter-from-left dashed fade lead-in for off-window divergences */}
      {enterLeft && (
        <path d={`M ${startX - 20} ${laneY} L ${startX + 18} ${laneY}`} fill="none" stroke="currentColor" strokeWidth={2.25} strokeDasharray="3 3" opacity={0.5} />
      )}
      {!enterLeft && <path d={leave} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />}
      <path d={lane} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />
      {merged && <path d={rejoin} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />}
      {merged && <circle cx={endX} cy={centerY} r={4} className="fill-current" />}

      {/* label pill (truncated, full name on hover) */}
      <g>
        <rect x={laneStart} y={b.above ? laneY - 26 : laneY + 8} width={Math.min(210, b.name.length * 6.6 + 40)} height={17} rx={8.5} className="fill-current" opacity={0.12} />
        <text x={laneStart + 8} y={b.above ? laneY - 14 : laneY + 20} className="fill-current text-[11px] font-medium">
          {b.name.length > 28 ? `${b.name.slice(0, 27)}…` : b.name}
          {b.openPrNumber ? ` · PR #${b.openPrNumber}` : ""}
        </text>
        <title>{`${b.name} · ${b.nodes.length} ${isEs ? "commits en la ventana" : "commits in window"} · ${stateLabel}`}</title>
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
              : `${n.sha ? n.sha.slice(0, 7) : n.label}${n.label && n.sha ? ` · ${n.label}` : ""} · ${b.name} · ${fmt(n.occurredAt)}`}
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

// ── Layout computation (time-scaled) ──────────────────────────────────────────

function computeLayout(data: GitHubLivingGraphData, isEs: boolean) {
  const windowDays = data.windowDays || 14;
  const rangeStartMs = new Date(data.rangeStartAt).getTime() || Date.now() - windowDays * DAY_MS;
  const rangeEndMs = Math.max(rangeStartMs + 1, new Date(data.rangeEndAt).getTime() || Date.now());

  const ppd = pxPerDay(windowDays);
  const plotW = Math.max(MIN_PLOT, Math.min(MAX_PLOT, windowDays * ppd));
  const width = PLOT_LEFT + plotW + MARGIN_RIGHT;
  const scale = createTimeScale(rangeStartMs, rangeEndMs, PLOT_LEFT, PLOT_LEFT + plotW);
  const clampX = (x: number) => Math.max(PLOT_LEFT, Math.min(PLOT_LEFT + plotW, x));
  const xAt = (iso?: string, fallback = rangeEndMs) => clampX(scale(iso ? new Date(iso).getTime() || fallback : fallback));

  const above = data.branches.filter((b) => b.type === "feature" || b.type === "other");
  const below = data.branches.filter((b) => b.type === "hotfix" || b.type === "release");
  const mainBranch = data.branches.find((b) => b.type === "main");

  function assign(branches: GitHubLivingGraphData["branches"]) {
    const laneEnds: number[] = [];
    return branches
      .slice()
      .sort((a, b) => xAt(a.startAt) - xAt(b.startAt))
      .map((b) => {
        const startMs = b.startAt ? new Date(b.startAt).getTime() : rangeStartMs;
        // Adjustment (1): first visible commit within a day of the window start ⇒
        // the true divergence predates the window → enter from the left edge.
        const enterLeft = startMs - rangeStartMs < DAY_MS;
        const startX = enterLeft ? PLOT_LEFT + 20 : xAt(b.startAt);
        const endX = Math.max(startX + CURVE * 2 + 8, xAt(b.mergedAt ?? b.lastCommitAt));
        let lane = laneEnds.findIndex((end) => end < startX - 14);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(endX); } else laneEnds[lane] = endX;
        return { b, startX, endX, lane, enterLeft };
      });
  }

  const laidAbove = assign(above);
  const laidBelow = assign(below);
  const aboveLanes = laidAbove.reduce((m, x) => Math.max(m, x.lane + 1), 0);
  const belowLanes = laidBelow.reduce((m, x) => Math.max(m, x.lane + 1), 0);

  const centerY = TOP_PAD + aboveLanes * LANE_GAP;
  const height = centerY + Math.max(1, belowLanes) * LANE_GAP + AXIS_H + 24;
  const axisY = height - AXIS_H + 6;

  const layNodes = (b: GitHubLivingGraphData["branches"][number], startX: number, endX: number, enterLeft: boolean): LaidNode[] => {
    const lo = (enterLeft ? startX : startX + CURVE) + 4;
    const hi = Math.max(lo + 1, endX - CURVE - 4);
    return b.nodes.map((n) => {
      const x = Math.max(lo, Math.min(hi, xAt(n.occurredAt)));
      return { x, label: n.label, sha: n.sha, occurredAt: n.occurredAt, collapsed: n.collapsedCount };
    });
  };

  const branches: LaidBranch[] = [
    ...laidAbove.map(({ b, startX, endX, lane, enterLeft }) => ({
      id: b.id, name: b.name, type: b.type, color: b.status === "blocked" ? "text-red-500" : LANE_COLORS[b.type],
      laneY: centerY - (lane + 1) * LANE_GAP, startX, endX, enterLeft,
      merged: b.status === "merged" || Boolean(b.mergedAt), openPrNumber: b.openPrNumber, status: b.status,
      nodes: layNodes(b, startX, endX, enterLeft), above: true,
    })),
    ...laidBelow.map(({ b, startX, endX, lane, enterLeft }) => ({
      id: b.id, name: b.name, type: b.type, color: b.status === "blocked" ? "text-red-500" : LANE_COLORS[b.type],
      laneY: centerY + (lane + 1) * LANE_GAP, startX, endX, enterLeft,
      merged: b.status === "merged" || Boolean(b.mergedAt), openPrNumber: b.openPrNumber, status: b.status,
      nodes: layNodes(b, startX, endX, enterLeft), above: false,
    })),
  ];

  const mainNodes: LaidNode[] = mainBranch
    ? mainBranch.nodes.map((n) => ({ x: xAt(n.occurredAt), label: n.label, sha: n.sha, occurredAt: n.occurredAt, collapsed: n.collapsedCount }))
    : [];

  const tags = data.tags.map((t) => ({ label: t.label, occurredAt: t.occurredAt, x: xAt(t.occurredAt) }));

  const ticks = applyLabelCollision(
    generateTicks(rangeStartMs, rangeEndMs, windowDays, scale, isEs ? "es" : "en"),
    LABEL_MIN_SPACING,
  ).map((tk) => ({ ...tk, x: clampX(tk.x) }));

  const todayX = clampX(scale(rangeEndMs));

  return { width, height, centerY, axisY, branches, mainNodes, tags, ticks, todayX };
}

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
