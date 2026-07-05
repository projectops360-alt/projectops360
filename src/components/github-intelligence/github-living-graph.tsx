"use client";

// ============================================================================
// GitHub Living Graph — density + focus + brush/zoom navigation
// ============================================================================
// The graph is mounted on a controllable time domain: drag on the ruler to zoom
// to a selection (brush), Ctrl+wheel / double-click / buttons to zoom around the
// cursor, "reset" back to auto-zoom, "see full range" for the whole window.
// Density and ruler ticks re-bucket to the domain granularity (month → week →
// day → hour). master = a commit-density band. EVERY branch is drawn as a
// packed bump-and-merge lane (rows are reused when spans don't overlap), each
// carrying its own commits. Clicking a day on master collapses that day's
// branches into a count badge (default: everything expanded). No color outside
// the legend.
// ============================================================================

import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { Maximize2, Minimize2, Layers, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { BranchType, GitHubLivingGraphData, GitHubGraphBranch } from "@/lib/github-intelligence/types";
import { createTimeScale, generateTicks, applyLabelCollision, densityGranularity, bucketDensity, bucketMerges, DAY_MS } from "@/lib/github-intelligence/time-axis";
import { pointerXToTime, zoomAround, brushToDomain, isValidSelection, clampDomain, type Domain } from "@/lib/github-intelligence/graph-zoom";
import { BranchPanel, type PanelState } from "./branch-panel";

interface Props { data: GitHubLivingGraphData; isEs?: boolean }

const LANE_COLORS: Record<BranchType, string> = {
  main: "text-muted-foreground", feature: "text-brand-500", hotfix: "text-orange-500", release: "text-purple-500", other: "text-sky-500",
};
const DENSITY_OPACITY = [0.08, 0.3, 0.55, 0.85];
const STICKY_W = 66, PLOT_LEFT = STICKY_W + 12, MARGIN_RIGHT = 44, LANE_GAP = 54, NODE_R = 5, CURVE = 22;
const TOP_PAD = 46, AXIS_H = 36, DENSITY_H = 12, MIN_PLOT = 680, MAX_PLOT = 6400, LABEL_MIN_SPACING = 54;
// Interval packing: min horizontal gap to reuse a row; safety cap on rows/side.
const LANE_MIN_GAP = 36, MAX_LANES = 40;

const ms = (iso: string) => new Date(iso).getTime();

interface LaidNode { x: number; label: string; sha?: string; occurredAt: string; collapsed?: number }
interface LaidBranch { id: string; name: string; type: BranchType; color: string; laneY: number; startX: number; endX: number; merged: boolean; enterLeft: boolean; openPrNumber?: number; nodes: LaidNode[]; above: boolean }

export function GitHubLivingGraph({ data, isEs = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [panel, setPanel] = useState<PanelState>(null);

  // Per-day collapse: clicking a day on master folds that day's branches back
  // into a count badge. Default = everything expanded (all lanes visible).
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(() => new Set());
  const toggleDay = useCallback((k: string) => setCollapsedDays((s) => {
    const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n;
  }), []);
  const allMergeDays = useMemo(() => new Set(data.merges.map((m) => m.mergedAt.slice(0, 10))), [data.merges]);
  const allCollapsed = allMergeDays.size > 0 && collapsedDays.size >= allMergeDays.size;
  const collapseAll = () => setCollapsedDays(allCollapsed ? new Set() : new Set(allMergeDays));
  const hiddenBranchNames = useMemo(() => {
    const set = new Set<string>();
    for (const b of data.branches) if (b.mergedAt && collapsedDays.has(b.mergedAt.slice(0, 10))) set.add(b.name);
    return set;
  }, [data.branches, collapsedDays]);

  const bounds = useMemo<Domain>(() => ({ start: ms(data.fullStartAt), end: ms(data.fullEndAt) }), [data.fullStartAt, data.fullEndAt]);
  const autoDomain = useMemo<Domain>(() => ({ start: ms(data.autoStartAt), end: ms(data.autoEndAt) }), [data.autoStartAt, data.autoEndAt]);

  // domain = target; view = animated current. Changing the range resets to auto.
  const [domain, setDomain] = useState<Domain>(autoDomain);
  const [view, setView] = useState<Domain>(autoDomain);
  const viewRef = useRef(view); viewRef.current = view;
  const [mode, setMode] = useState<"auto" | "full" | "manual">("auto");
  useEffect(() => { setDomain(autoDomain); setMode("auto"); }, [autoDomain]);

  // animate view → domain (~250ms ease-out)
  useEffect(() => {
    const from = viewRef.current, to = domain, t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 250), e = 1 - Math.pow(1 - k, 3);
      setView({ start: from.start + (to.start - from.start) * e, end: from.end + (to.end - from.end) * e });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [domain]);

  const layout = useMemo(() => computeLayout(data, view, isEs, hiddenBranchNames), [data, view, isEs, hiddenBranchNames]);

  useLayoutEffect(() => {
    const el = scrollRef.current; if (!el) return;
    el.scrollLeft = el.scrollWidth; // start at the most recent activity
    setOverflow(el.scrollWidth > el.clientWidth + 4);
  }, [layout.width]);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onResize = () => setOverflow(el.scrollWidth > el.clientWidth + 4);
    window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── brush on the ruler band ─────────────────────────────────────────────────
  const [brush, setBrush] = useState<{ x0: number; x1: number } | null>(null);
  const brushingRef = useRef(false);
  const timeAt = (x: number) => pointerXToTime(x, PLOT_LEFT, layout.width - MARGIN_RIGHT, view.start, view.end);
  const onRulerDown = (e: React.PointerEvent) => { brushingRef.current = true; const x = localX(e, scrollRef.current); setBrush({ x0: x, x1: x }); (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onRulerMove = (e: React.PointerEvent) => { if (!brushingRef.current) return; const x = localX(e, scrollRef.current); setBrush((b) => (b ? { ...b, x1: x } : b)); };
  const onRulerUp = () => {
    brushingRef.current = false;
    setBrush((b) => {
      if (b) {
        const sel = brushToDomain(timeAt(b.x0), timeAt(b.x1));
        if (isValidSelection(sel)) applyDomain(clampDomain(sel, bounds.start, bounds.end));
      }
      return null;
    });
  };

  const applyDomain = useCallback((d: Domain) => { setDomain(clampDomain(d, bounds.start, bounds.end)); setMode("manual"); }, [bounds]);
  const reset = () => { setDomain(autoDomain); setMode("auto"); };
  const seeFull = () => {
    if (mode === "full") { setDomain(autoDomain); setMode("auto"); }
    else { setDomain(bounds); setMode("full"); }
  };
  const zoomBy = (factor: number, centerT?: number) => applyDomain(zoomAround(view, centerT ?? (view.start + view.end) / 2, factor, bounds.start, bounds.end));

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const x = localX(e as unknown as React.PointerEvent, scrollRef.current);
    zoomBy(e.deltaY > 0 ? 1.2 : 0.8, timeAt(x));
  };
  const onDblClick = (e: React.MouseEvent) => { const x = localX(e as unknown as React.PointerEvent, scrollRef.current); zoomBy(0.5, timeAt(x)); };

  const isEmpty = data.masterCommitTimes.length === 0 && data.branches.length === 0 && data.merges.length === 0;
  const totalMerges = data.merges.length;
  const summaryText = isEs
    ? `${data.repositoryName || "repositorio"} — ${data.totalMasterCommits} commits, ${totalMerges} merges, ${data.branches.length} ramas.`
    : `${data.repositoryName || "repository"} — ${data.totalMasterCommits} commits, ${totalMerges} merges, ${data.branches.length} branches.`;
  const domainLabel = `${fmtDay(new Date(view.start).toISOString())} – ${fmtDay(new Date(view.end).toISOString())}${mode === "manual" ? " · zoom" : ""}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">GitHub Living Graph</h2>
          <p className="text-xs text-muted-foreground">{data.repositoryName || (isEs ? "Sin repositorio" : "No repository")} · {domainLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button type="button" onClick={() => zoomBy(0.6)} title={isEs ? "acercar" : "zoom in"} className="rounded p-1 text-muted-foreground hover:text-foreground"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => zoomBy(1.6)} title={isEs ? "alejar" : "zoom out"} className="rounded p-1 text-muted-foreground hover:text-foreground"><ZoomOut className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={reset} title={isEs ? "restablecer" : "reset"} className="rounded p-1 text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>
          <button type="button" onClick={seeFull} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            {mode === "full" ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}{mode === "full" ? (isEs ? "auto-zoom" : "auto-zoom") : (isEs ? "ver rango completo" : "see full range")}
          </button>
          {allMergeDays.size > 0 && (
            <button type="button" onClick={collapseAll} title={isEs ? "colapsar/expandir todos los días" : "collapse/expand all days"} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
              <Layers className="h-3 w-3" />{allCollapsed ? (isEs ? "expandir ramas" : "expand branches") : (isEs ? "colapsar ramas" : "collapse branches")}
            </button>
          )}
          {overflow && <span className="text-[11px] font-medium text-muted-foreground">{isEs ? "desliza →" : "scroll →"}</span>}
          <Legend isEs={isEs} />
        </div>
      </div>

      {isEmpty ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">{isEs ? "Sin actividad en esta ventana." : "No activity in this window."}</div>
      ) : (
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden rounded-xl" role="group" aria-label={summaryText}>
            <svg width={layout.width} height={layout.height} className="block select-none" style={{ minWidth: "100%" }} onWheel={onWheel} onDoubleClick={onDblClick}>
              <line x1={PLOT_LEFT - 10} y1={layout.centerY} x2={layout.width - 12} y2={layout.centerY} className="text-muted-foreground/50" stroke="currentColor" strokeWidth={2.5} />

              {layout.density.map((c, i) => (
                <g key={i} className="text-muted-foreground">
                  <rect x={c.x} y={layout.centerY + 6} width={Math.max(1, c.w - 1)} height={DENSITY_H} rx={2} fill="currentColor" fillOpacity={DENSITY_OPACITY[c.level]} />
                  <title>{`${fmtDay(c.start)} · ${c.count} commit${c.count === 1 ? "" : "s"}`}</title>
                </g>
              ))}

              {/* ruler (also the brush surface) */}
              <rect x={PLOT_LEFT - 10} y={layout.axisY - 12} width={layout.width - PLOT_LEFT - 2} height={AXIS_H} fill="transparent" style={{ cursor: "ew-resize" }} onPointerDown={onRulerDown} onPointerMove={onRulerMove} onPointerUp={onRulerUp} onPointerCancel={onRulerUp} />
              <line x1={PLOT_LEFT - 10} y1={layout.axisY} x2={layout.width - 12} y2={layout.axisY} className="text-border" stroke="currentColor" strokeWidth={1} pointerEvents="none" />
              {layout.ticks.map((tk, i) => (
                <g key={i} className="text-muted-foreground" pointerEvents="none">
                  <line x1={tk.x} y1={layout.axisY} x2={tk.x} y2={layout.axisY - (tk.major ? 6 : 3)} stroke="currentColor" strokeWidth={1} opacity={tk.major ? 0.7 : 0.4} />
                  {tk.showLabel && <text x={tk.x} y={layout.axisY + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">{tk.label}</text>}
                </g>
              ))}
              {brush && Math.abs(brush.x1 - brush.x0) > 2 && (
                <rect x={Math.min(brush.x0, brush.x1)} y={TOP_PAD - 20} width={Math.abs(brush.x1 - brush.x0)} height={layout.axisY - (TOP_PAD - 20)} className="fill-brand-500/15 stroke-brand-500/50" strokeWidth={1} pointerEvents="none" />
              )}

              {layout.todayX !== null && (
                <g className="text-muted-foreground" pointerEvents="none">
                  <line x1={layout.todayX} y1={TOP_PAD - 18} x2={layout.todayX} y2={layout.axisY} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                  <text x={layout.todayX} y={TOP_PAD - 22} textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">{isEs ? "hoy" : "today"}</text>
                </g>
              )}

              {layout.branches.map((b) => <BranchBump key={b.id} b={b} centerY={layout.centerY} isEs={isEs} />)}

              {layout.merges.map((m, i) => {
                const dk = m.day.start.slice(0, 10);
                const collapsed = collapsedDays.has(dk);
                const showBadge = m.day.count > 1 || collapsed;
                return (
                  <g key={i} className="text-muted-foreground cursor-pointer" onClick={() => toggleDay(dk)}>
                    <circle cx={m.x} cy={layout.centerY} r={collapsed ? 5 : 3.5} className="fill-current" opacity={collapsed ? 1 : 0.55} />
                    {showBadge && <>
                      <rect x={m.x - 10} y={layout.centerY - 20} width={20 + String(m.day.count).length * 3} height={15} rx={7.5}
                        className={collapsed ? "fill-foreground/85 stroke-transparent" : "fill-muted stroke-border"} strokeWidth={1} />
                      <text x={m.x} y={layout.centerY - 9} textAnchor="middle" className={`text-[9px] font-semibold ${collapsed ? "fill-background" : "fill-foreground"}`}>{m.day.count}</text>
                    </>}
                    <title>{collapsed
                      ? (isEs ? `${m.day.count} ramas ocultas · ${fmtDay(m.day.start)} — clic para mostrar` : `${m.day.count} branches hidden · ${fmtDay(m.day.start)} — click to show`)
                      : (isEs ? `${m.day.count} merge${m.day.count === 1 ? "" : "s"} · ${fmtDay(m.day.start)} — clic para ocultar` : `${m.day.count} merge${m.day.count === 1 ? "" : "s"} · ${fmtDay(m.day.start)} — click to hide`)}</title>
                  </g>
                );
              })}

              {layout.tags.map((t, i) => (
                <g key={`${t.label}-${i}`} className="text-purple-500" pointerEvents="none">
                  <circle cx={t.x} cy={layout.centerY} r={4} className="fill-current" />
                  <rect x={t.x - 22} y={layout.centerY - 38} width={44} height={16} rx={8} className="fill-purple-500/15 stroke-purple-500/50" strokeWidth={1} />
                  <text x={t.x} y={layout.centerY - 27} textAnchor="middle" className="fill-purple-600 dark:fill-purple-300 text-[10px] font-semibold">{t.label.length > 8 ? `${t.label.slice(0, 7)}…` : t.label}</text>
                </g>
              ))}
            </svg>
          </div>

          <div className="pointer-events-none absolute left-0 flex items-center" style={{ top: layout.centerY - 12, height: 24 }}>
            <span className="rounded-md border border-border bg-card px-2 py-0.5 text-[13px] font-semibold text-foreground shadow-sm">{data.mainBranch}</span>
          </div>
          <BranchPanel panel={panel} onClose={() => setPanel(null)} isEs={isEs} />
        </div>
      )}

      {data.inactiveBranches.length > 0 && (
        <button type="button" onClick={() => setPanel({ kind: "inactive", branches: data.inactiveBranches })} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Layers className="h-3.5 w-3.5" />{isEs ? `${data.inactiveBranches.length} ramas inactivas` : `${data.inactiveBranches.length} inactive branches`} ▸
        </button>
      )}
      <p className="sr-only">{summaryText}</p>
    </div>
  );
}

/** SVG-local x from a pointer event (accounts for horizontal scroll). */
function localX(e: React.PointerEvent | React.MouseEvent, scroll: HTMLDivElement | null): number {
  const rect = scroll?.getBoundingClientRect();
  const left = rect?.left ?? 0;
  return (e.clientX - left) + (scroll?.scrollLeft ?? 0);
}

function BranchBump({ b, centerY, isEs }: { b: LaidBranch; centerY: number; isEs: boolean }) {
  const { laneY, startX, endX, merged, color, enterLeft } = b;
  const laneStart = enterLeft ? startX : startX + CURVE;
  const leave = enterLeft ? "" : `M ${startX} ${centerY} C ${startX + CURVE} ${centerY}, ${startX} ${laneY}, ${startX + CURVE} ${laneY}`;
  const lane = `M ${laneStart} ${laneY} L ${endX - (merged ? CURVE : 0)} ${laneY}`;
  const rejoin = merged ? `M ${endX - CURVE} ${laneY} C ${endX} ${laneY}, ${endX - CURVE} ${centerY}, ${endX} ${centerY}` : "";
  const pillW = Math.min(150, b.name.length * 6.2 + 34);
  return (
    <g className={color}>
      {enterLeft && <path d={`M ${startX - 20} ${laneY} L ${startX + 18} ${laneY}`} fill="none" stroke="currentColor" strokeWidth={2.25} strokeDasharray="3 3" opacity={0.5} />}
      {!enterLeft && <path d={leave} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />}
      <path d={lane} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />
      {merged && <path d={rejoin} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.85} />}
      {merged && <circle cx={endX} cy={centerY} r={4} className="fill-current" />}
      <g>
        <rect x={endX - pillW} y={b.above ? laneY - 26 : laneY + 8} width={pillW} height={17} rx={8.5} className="fill-current" opacity={0.12} />
        <text x={endX - pillW + 8} y={b.above ? laneY - 14 : laneY + 20} className="fill-current text-[10px] font-medium">{b.name.length > 18 ? `${b.name.slice(0, 17)}…` : b.name}{b.openPrNumber ? ` · #${b.openPrNumber}` : ""}</text>
      </g>
      {b.nodes.map((n, i) => (
        <g key={i}>
          {n.collapsed ? <>
            <rect x={n.x - 13} y={laneY - 8.5} width={26} height={17} rx={8.5} className="fill-current" opacity={0.2} />
            <text x={n.x} y={laneY + 4} textAnchor="middle" className="fill-current text-[10px] font-semibold">{n.label}</text>
          </> : <circle cx={n.x} cy={laneY} r={NODE_R} className="fill-current" />}
          <title>{n.collapsed ? `${n.collapsed} ${isEs ? "commits anteriores" : "earlier commits"}` : `${n.sha ? n.sha.slice(0, 7) : n.label} · ${b.name} · ${fmtTime(n.occurredAt)}`}</title>
        </g>
      ))}
    </g>
  );
}

function Legend({ isEs }: { isEs: boolean }) {
  const items: Array<{ t: BranchType; label: string }> = [
    { t: "feature", label: "Feature" }, { t: "hotfix", label: "Hotfix" }, { t: "release", label: "Release" },
    { t: "other", label: "Other" }, { t: "main", label: isEs ? "Main / densidad" : "Main / density" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((i) => <span key={i.t} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full bg-current ${LANE_COLORS[i.t]}`} />{i.label}</span>)}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

function computeLayout(data: GitHubLivingGraphData, domain: Domain, isEs: boolean, hidden: Set<string>) {
  const startMs = domain.start;
  const endMs = Math.max(startMs + 60 * 60 * 1000, domain.end);
  const nowMs = ms(data.fullEndAt);
  const spanDays = Math.max(0.2, (endMs - startMs) / DAY_MS);
  const ppd = spanDays <= 2 ? 300 : spanDays <= 4 ? 200 : spanDays <= 7 ? 120 : spanDays <= 14 ? 80 : spanDays <= 42 ? 46 : 22;
  const plotW = Math.max(MIN_PLOT, Math.min(MAX_PLOT, spanDays * ppd));
  const width = PLOT_LEFT + plotW + MARGIN_RIGHT;
  const scale = createTimeScale(startMs, endMs, PLOT_LEFT, PLOT_LEFT + plotW);
  const clampX = (x: number) => Math.max(PLOT_LEFT, Math.min(PLOT_LEFT + plotW, x));
  const xAt = (iso?: string, fb = endMs) => clampX(scale(iso ? new Date(iso).getTime() || fb : fb));

  const branchStart = (b: GitHubGraphBranch) => ms(b.startAt ?? b.lastCommitAt ?? b.mergedAt ?? "") || startMs;
  const branchEnd = (b: GitHubGraphBranch) => ms(b.mergedAt ?? b.lastCommitAt ?? b.startAt ?? "") || nowMs;
  // Draw every branch that intersects the visible domain and isn't collapsed.
  const visible = data.branches.filter((b) => !hidden.has(b.name) && branchEnd(b) >= startMs && branchStart(b) <= endMs);
  const above = visible.filter((b) => b.type === "feature" || b.type === "other");
  const below = visible.filter((b) => b.type === "hotfix" || b.type === "release");

  // Interval packing: a branch reuses the first row whose previous branch ended
  // (+gap) before this one starts — so N non-overlapping branches share a row.
  function pack(list: GitHubGraphBranch[]) {
    const items = list.map((b) => {
      const enterLeft = branchStart(b) - startMs < (endMs - startMs) * 0.02;
      const startX = enterLeft ? PLOT_LEFT + 20 : xAt(b.startAt ?? b.lastCommitAt ?? b.mergedAt);
      const endX = Math.max(startX + CURVE * 2 + 8, xAt(b.mergedAt ?? b.lastCommitAt));
      return { b, startX, endX, enterLeft, lane: 0 };
    }).sort((a, z) => a.startX - z.startX || a.endX - z.endX);
    const rowEnd: number[] = [];
    for (const it of items) {
      let lane = rowEnd.findIndex((e) => e + LANE_MIN_GAP <= it.startX);
      if (lane === -1) {
        if (rowEnd.length < MAX_LANES) { lane = rowEnd.length; rowEnd.push(it.endX); }
        else { lane = MAX_LANES - 1; rowEnd[lane] = Math.max(rowEnd[lane], it.endX); }
      } else rowEnd[lane] = it.endX;
      it.lane = lane;
    }
    return items;
  }
  const la = pack(above), lb = pack(below);
  const aLanes = la.reduce((m, x) => Math.max(m, x.lane + 1), 0);
  const bLanes = lb.reduce((m, x) => Math.max(m, x.lane + 1), 0);
  const centerY = TOP_PAD + aLanes * LANE_GAP;
  const height = centerY + Math.max(1, bLanes) * LANE_GAP + AXIS_H + 26;
  const axisY = height - AXIS_H + 6;

  const layNodes = (b: GitHubGraphBranch, sx: number, ex: number, el: boolean): LaidNode[] => {
    const lo = (el ? sx : sx + CURVE) + 4, hi = Math.max(lo + 1, ex - CURVE - 4);
    // No per-branch commits ingested yet: show the count as a single marker.
    if (b.nodes.length === 0 && (b.hiddenCommitCount ?? 0) > 0) {
      return [{ x: (lo + hi) / 2, label: `+${b.hiddenCommitCount}`, occurredAt: b.mergedAt ?? b.lastCommitAt ?? "", collapsed: b.hiddenCommitCount }];
    }
    return b.nodes.map((n) => ({ x: Math.max(lo, Math.min(hi, xAt(n.occurredAt))), label: n.label, sha: n.sha, occurredAt: n.occurredAt, collapsed: n.collapsedCount }));
  };
  const branches: LaidBranch[] = [
    ...la.map(({ b, startX, endX, lane, enterLeft }) => ({ id: b.id, name: b.name, type: b.type, color: LANE_COLORS[b.type], laneY: centerY - (lane + 1) * LANE_GAP, startX, endX, enterLeft, merged: b.status === "merged" || Boolean(b.mergedAt), openPrNumber: b.openPrNumber, nodes: layNodes(b, startX, endX, enterLeft), above: true })),
    ...lb.map(({ b, startX, endX, lane, enterLeft }) => ({ id: b.id, name: b.name, type: b.type, color: LANE_COLORS[b.type], laneY: centerY + (lane + 1) * LANE_GAP, startX, endX, enterLeft, merged: b.status === "merged" || Boolean(b.mergedAt), openPrNumber: b.openPrNumber, nodes: layNodes(b, startX, endX, enterLeft), above: false })),
  ];

  const g = densityGranularity(endMs - startMs);
  const density = bucketDensity(data.masterCommitTimes.map(ms), startMs, endMs, g).map((c) => {
    const x0 = clampX(scale(new Date(c.start).getTime())), x1 = clampX(scale(new Date(c.end).getTime()));
    return { x: x0, w: Math.max(2, x1 - x0), level: c.level, count: c.count, start: c.start };
  });
  const merges = bucketMerges(data.merges, startMs, endMs, g).map((m) => ({ day: m, x: xAt(m.start) }));

  const ticks = applyLabelCollision(generateTicks(startMs, endMs, data.windowDays, scale, isEs ? "es" : "en"), LABEL_MIN_SPACING).map((tk) => ({ ...tk, x: clampX(tk.x) }));
  const tags = data.tags.map((t) => ({ label: t.label, occurredAt: t.occurredAt, x: xAt(t.occurredAt) }));
  const todayX = nowMs >= startMs && nowMs <= endMs ? clampX(scale(nowMs)) : null;

  return { width, height, centerY, axisY, branches, density, merges, ticks, tags, todayX };
}

function fmtDay(iso: string): string { try { return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(iso)); } catch { return iso; } }
function fmtTime(iso: string): string { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
