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
import { Maximize2, Minimize2, Layers, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import type { BranchType, GitHubLivingGraphData, GitHubGraphBranch } from "@/lib/github-intelligence/types";
import { createTimeScale, generateTicks, applyLabelCollision, densityGranularity, bucketDensity, bucketMerges, DAY_MS } from "@/lib/github-intelligence/time-axis";
import { pointerXToTime, zoomAround, brushToDomain, isValidSelection, clampDomain, type Domain } from "@/lib/github-intelligence/graph-zoom";
import { packLanes, type LaneInterval } from "@/lib/github-intelligence/lane-packing";
import { BranchPanel, type PanelState, type DayBranchItem } from "./branch-panel";
import type { DailyMerge } from "@/lib/github-intelligence/types";

interface Props { data: GitHubLivingGraphData; isEs?: boolean }

const LANE_COLORS: Record<BranchType, string> = {
  main: "text-muted-foreground", feature: "text-brand-500", hotfix: "text-orange-500", release: "text-purple-500", other: "text-sky-500",
};
const DENSITY_OPACITY = [0.08, 0.3, 0.55, 0.85];
const STICKY_W = 66, PLOT_LEFT = STICKY_W + 12, MARGIN_RIGHT = 44, LANE_GAP = 30, NODE_R = 4, ELBOW = 14;
const TOP_PAD = 46, AXIS_H = 36, DENSITY_H = 12, MIN_PLOT = 680, MAX_PLOT = 6400, LABEL_MIN_SPACING = 54;
// Horizontal lane budget (packing reuses lanes; overflow → spine badges).
const LANE_BUDGET_UP = 6, LANE_BUDGET_DOWN = 4, PILL_MARGIN = 12, DASH_TAIL = 34;

const ms = (iso: string) => new Date(iso).getTime();

interface LaidNode { x: number; label: string; sha?: string; occurredAt: string; collapsed?: number }
interface LaidBranch {
  id: string; name: string; type: BranchType; color: string;
  laneY: number; above: boolean; open: boolean; openPrNumber?: number;
  // flat geometry: rounded elbow → horizontal segment → rounded elbow
  elbowOut: string | null; // master → lane at startX (null when enterLeft)
  leadIn: string | null;   // dashed off-screen entry (enterLeft)
  segSolid: string;        // solid horizontal segment
  segDash: string | null;  // dashed right tail (open branch)
  elbowIn: string | null;  // lane → master at endX (merged only)
  mergeDotX: number | null;
  pillX: number; pillY: number; pillW: number; pillText: string; pillShort: boolean;
  nodes: LaidNode[];
}

export function GitHubLivingGraph({ data, isEs = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<PanelState>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Overview stays compact (density band + daily merge badges + only OPEN
  // branches as lanes). Clicking a day badge opens a filterable detail panel of
  // everything that happened that day.
  const branchByName = useMemo(() => {
    const m = new Map<string, GitHubGraphBranch>();
    for (const b of data.branches) m.set(b.name, b);
    return m;
  }, [data.branches]);
  const commitCountOf = useCallback((b?: GitHubGraphBranch) => (b ? b.nodes.length || b.hiddenCommitCount || 0 : 0), []);
  // Open branches grouped by their last-commit calendar day (so a day panel can
  // show open work alongside that day's merges).
  const openByDay = useMemo(() => {
    const m = new Map<string, DayBranchItem[]>();
    for (const b of data.branches) {
      if (b.mergedAt || !b.lastCommitAt) continue;
      const day = b.lastCommitAt.slice(0, 10);
      const arr = m.get(day) ?? [];
      arr.push({ name: b.name, type: b.type, status: "open", commitCount: commitCountOf(b), prNumber: b.openPrNumber, time: b.lastCommitAt });
      m.set(day, arr);
    }
    return m;
  }, [data.branches, commitCountOf]);
  const openDayPanel = useCallback((m: DailyMerge) => {
    const merged: DayBranchItem[] = m.prs.map((p) => ({
      name: p.branch, type: branchByName.get(p.branch)?.type ?? "other", status: "merged",
      commitCount: commitCountOf(branchByName.get(p.branch)), prNumber: p.number, time: p.mergedAt,
    }));
    const open = openByDay.get(m.start.slice(0, 10)) ?? [];
    setPanel({ kind: "day", dayStart: m.start, items: [...merged, ...open] });
  }, [branchByName, commitCountOf, openByDay]);

  const bounds = useMemo<Domain>(() => ({ start: ms(data.fullStartAt), end: ms(data.fullEndAt) }), [data.fullStartAt, data.fullEndAt]);
  const autoDomain = useMemo<Domain>(() => ({ start: ms(data.autoStartAt), end: ms(data.autoEndAt) }), [data.autoStartAt, data.autoEndAt]);

  // domain = target; view = animated current. Changing the range resets to auto.
  const [domain, setDomain] = useState<Domain>(autoDomain);
  const [view, setView] = useState<Domain>(autoDomain);
  const viewRef = useRef(view); viewRef.current = view;
  const [mode, setMode] = useState<"auto" | "full" | "manual">("auto");
  const instantRef = useRef(false); // skip the ease when panning (1:1 drag feel)
  useEffect(() => { setDomain(autoDomain); setMode("auto"); }, [autoDomain]);

  // animate view → domain (~250ms ease-out), or jump instantly while panning
  useEffect(() => {
    if (instantRef.current) { instantRef.current = false; setView(domain); return; }
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

  const layout = useMemo(() => computeLayout(data, view, isEs), [data, view, isEs]);

  const didInit = useRef(false);
  useLayoutEffect(() => {
    const el = scrollRef.current; if (!el || didInit.current) return;
    el.scrollLeft = el.scrollWidth; didInit.current = true; // start at recent
  }, [layout.width]);

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

  // ── pan the time window (drag / horizontal wheel / ◀ ▶) ──────────────────────
  const plotInnerW = () => layout.width - PLOT_LEFT - MARGIN_RIGHT;
  const shiftTo = (start: number, end: number, instant: boolean) => {
    let s = start, e = end;
    if (s < bounds.start) { e += bounds.start - s; s = bounds.start; }
    if (e > bounds.end) { s -= e - bounds.end; e = bounds.end; }
    const d = clampDomain({ start: Math.max(bounds.start, s), end: Math.min(bounds.end, e) }, bounds.start, bounds.end);
    setMode("manual"); instantRef.current = instant; setDomain(d);
  };
  const panBy = (dtMs: number, instant = false) => shiftTo(view.start + dtMs, view.end + dtMs, instant);
  const atStart = view.start <= bounds.start + 1000;
  const atEnd = view.end >= bounds.end - 1000;

  // Set an absolute edge (from the date inputs) without shifting the other edge.
  const setAbs = (s: number, e: number, instant = false) => {
    const d = clampDomain({ start: Math.max(bounds.start, Math.min(s, e - 1000)), end: Math.min(bounds.end, Math.max(e, s + 1000)) }, bounds.start, bounds.end);
    setMode("manual"); instantRef.current = instant; setDomain(d);
  };
  const dateVal = (v: number) => { const d = new Date(v); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const onDateEdge = (which: "start" | "end", v: string) => {
    if (!v) return;
    const [y, mo, da] = v.split("-").map(Number);
    const t = new Date(y, mo - 1, da, which === "end" ? 23 : 0, which === "end" ? 59 : 0, which === "end" ? 59 : 0).getTime();
    if (which === "start") setAbs(t, view.end); else setAbs(view.start, t);
  };

  const panRef = useRef<{ x: number; dom: Domain } | null>(null);
  const onPanDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest?.("[data-nopan]")) return; // ruler / badges keep their own gestures
    panRef.current = { x: e.clientX, dom: view };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPanMove = (e: React.PointerEvent) => {
    if (!panRef.current) return;
    const span = panRef.current.dom.end - panRef.current.dom.start;
    const dt = -(e.clientX - panRef.current.x) * span / plotInnerW();
    shiftTo(panRef.current.dom.start + dt, panRef.current.dom.end + dt, true);
  };
  const onPanUp = () => { panRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const x = localX(e as unknown as React.PointerEvent, scrollRef.current);
      zoomBy(e.deltaY > 0 ? 1.2 : 0.8, timeAt(x));
      return;
    }
    const dx = e.shiftKey ? e.deltaY : e.deltaX;
    if (Math.abs(dx) < 1) return; // vertical intent → let the page scroll
    e.preventDefault();
    panBy(dx * (view.end - view.start) / plotInnerW(), true);
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
          {/* explicit date range — jump anywhere in the loaded history */}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-[11px] text-foreground">
            <input type="date" aria-label={isEs ? "Desde" : "From"} value={dateVal(view.start)} min={dateVal(bounds.start)} max={dateVal(view.end)} onChange={(e) => onDateEdge("start", e.target.value)} className="rounded bg-transparent px-1 py-0.5 outline-none [color-scheme:light] dark:[color-scheme:dark]" />
            <span className="text-muted-foreground">→</span>
            <input type="date" aria-label={isEs ? "Hasta" : "To"} value={dateVal(view.end)} min={dateVal(view.start)} max={dateVal(bounds.end)} onChange={(e) => onDateEdge("end", e.target.value)} className="rounded bg-transparent px-1 py-0.5 outline-none [color-scheme:light] dark:[color-scheme:dark]" />
          </div>
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button type="button" onClick={() => panBy(-(view.end - view.start) * 0.6)} disabled={atStart} title={isEs ? "más atrás" : "earlier"} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => zoomBy(0.6)} title={isEs ? "acercar" : "zoom in"} className="rounded p-1 text-muted-foreground hover:text-foreground"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => zoomBy(1.6)} title={isEs ? "alejar" : "zoom out"} className="rounded p-1 text-muted-foreground hover:text-foreground"><ZoomOut className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={reset} title={isEs ? "restablecer" : "reset"} className="rounded p-1 text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => panBy((view.end - view.start) * 0.6)} disabled={atEnd} title={isEs ? "más adelante" : "later"} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <button type="button" onClick={seeFull} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            {mode === "full" ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}{mode === "full" ? (isEs ? "auto-zoom" : "auto-zoom") : (isEs ? "ver rango completo" : "see full range")}
          </button>
          <Legend isEs={isEs} />
        </div>
      </div>

      {isEmpty ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">{isEs ? "Sin actividad en esta ventana." : "No activity in this window."}</div>
      ) : (
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden rounded-xl" role="group" aria-label={summaryText}>
            <svg width={layout.width} height={layout.height} className="block select-none" style={{ minWidth: "100%", cursor: panRef.current ? "grabbing" : "grab", touchAction: "pan-y" }}
              onWheel={onWheel} onDoubleClick={onDblClick} onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={onPanUp} onPointerLeave={onPanUp}>
              <line x1={PLOT_LEFT - 10} y1={layout.centerY} x2={layout.width - 12} y2={layout.centerY} className="text-muted-foreground/50" stroke="currentColor" strokeWidth={2.5} />

              {layout.density.map((c, i) => (
                <g key={i} className="text-muted-foreground">
                  <rect x={c.x} y={layout.centerY + 6} width={Math.max(1, c.w - 1)} height={DENSITY_H} rx={2} fill="currentColor" fillOpacity={DENSITY_OPACITY[c.level]} />
                  <title>{`${fmtDay(c.start)} · ${c.count} commit${c.count === 1 ? "" : "s"}`}</title>
                </g>
              ))}

              {/* ruler (also the brush surface) */}
              <rect data-nopan x={PLOT_LEFT - 10} y={layout.axisY - 12} width={layout.width - PLOT_LEFT - 2} height={AXIS_H} fill="transparent" style={{ cursor: "ew-resize" }} onPointerDown={onRulerDown} onPointerMove={onRulerMove} onPointerUp={onRulerUp} onPointerCancel={onRulerUp} />
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

              {/* pass 1 — connectors (behind, so crossings pass under segments) */}
              {layout.branches.map((b) => {
                const dim = hovered !== null && hovered !== b.id;
                return (
                  <g key={`c-${b.id}`} className={b.color} pointerEvents="none" opacity={dim ? 0.22 : 1}>
                    {b.leadIn && <path d={b.leadIn} fill="none" stroke="currentColor" strokeWidth={2.25} strokeDasharray="3 3" opacity={0.55} />}
                    {b.elbowOut && <path d={b.elbowOut} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.9} />}
                    {b.elbowIn && <path d={b.elbowIn} fill="none" stroke="currentColor" strokeWidth={2.25} opacity={0.9} />}
                  </g>
                );
              })}
              {/* pass 2 — horizontal segments (hover target) */}
              {layout.branches.map((b) => {
                const dim = hovered !== null && hovered !== b.id;
                return (
                  <g key={`s-${b.id}`} className={b.color} opacity={dim ? 0.22 : 1}
                    onMouseEnter={() => setHovered(b.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
                    <path d={b.segSolid} fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.95} />
                    {b.segDash && <path d={b.segDash} fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray="4 4" opacity={0.8} />}
                    <path d={b.segSolid} fill="none" stroke="transparent" strokeWidth={16} />
                    <title>{branchTooltip(b, isEs)}</title>
                  </g>
                );
              })}
              {/* pass 3 — commit dots, merge dots, pills (front) */}
              {layout.branches.map((b) => {
                const dim = hovered !== null && hovered !== b.id;
                const showPill = !b.pillShort || hovered === b.id;
                return (
                  <g key={`d-${b.id}`} className={b.color} opacity={dim ? 0.22 : 1}>
                    {b.mergeDotX !== null && <circle cx={b.mergeDotX} cy={layout.centerY} r={4} className="fill-current" />}
                    {b.nodes.map((n, i) => (
                      <g key={i}>
                        {n.collapsed ? <>
                          <rect x={n.x - 12} y={b.laneY - 8} width={24} height={16} rx={8} className="fill-current" opacity={0.2} />
                          <text x={n.x} y={b.laneY + 4} textAnchor="middle" className="fill-current text-[9px] font-semibold">{n.label}</text>
                        </> : <circle cx={n.x} cy={b.laneY} r={NODE_R} className="fill-current" />}
                        <title>{n.collapsed ? `${n.collapsed} commits` : `${n.sha ? n.sha.slice(0, 7) : n.label} · ${b.name} · ${fmtTime(n.occurredAt)}`}</title>
                      </g>
                    ))}
                    {showPill && (
                      <g onMouseEnter={() => setHovered(b.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
                        <rect x={b.pillX} y={b.pillY} width={b.pillW} height={15} rx={7.5} className="fill-current" opacity={0.14} />
                        <text x={b.pillX + 8} y={b.pillY + 11} className="fill-current text-[10px] font-medium">{b.pillText}</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {layout.merges.map((m, i) => (
                <g key={i} data-nopan className="text-muted-foreground cursor-pointer" onClick={() => openDayPanel(m.day)}>
                  <circle cx={m.x} cy={layout.centerY} r={5} className="fill-current" />
                  {m.day.count > 1 && <>
                    <rect x={m.x - 10} y={layout.centerY - 20} width={20 + String(m.day.count).length * 3} height={15} rx={7.5} className="fill-muted stroke-border" strokeWidth={1} />
                    <text x={m.x} y={layout.centerY - 9} textAnchor="middle" className="fill-foreground text-[9px] font-semibold">{m.day.count}</text>
                  </>}
                  <title>{isEs ? `${m.day.count} merge${m.day.count === 1 ? "" : "s"} · ${fmtDay(m.day.start)} — clic para ver` : `${m.day.count} merge${m.day.count === 1 ? "" : "s"} · ${fmtDay(m.day.start)} — click to explore`}</title>
                </g>
              ))}

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

function branchTooltip(b: LaidBranch, isEs: boolean): string {
  const commits = b.nodes.reduce((s, n) => s + (n.collapsed ?? 1), 0);
  const st = b.open ? (isEs ? "abierta" : "open") : (isEs ? "mergeada" : "merged");
  const pr = b.openPrNumber ? ` · PR #${b.openPrNumber}` : "";
  return `${b.name} · ${commits} commit${commits === 1 ? "" : "s"} · ${st}${pr}`;
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

function computeLayout(data: GitHubLivingGraphData, domain: Domain, isEs: boolean) {
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
  const plotRight = PLOT_LEFT + plotW;
  // Draw ALL branches intersecting the domain (merged + open) as flat lanes.
  // fix/* go below master; everything else above. Packing reuses lanes and the
  // budget caps height — overflow branches stay in the spine's merge badges.
  const visible = data.branches.filter((b) => branchEnd(b) >= startMs && branchStart(b) <= endMs);
  const isUp = (b: GitHubGraphBranch) => b.type !== "hotfix";
  const toInterval = (b: GitHubGraphBranch): LaneInterval => {
    const enterLeft = branchStart(b) - startMs < (endMs - startMs) * 0.02;
    const open = !b.mergedAt;
    const startX = enterLeft ? PLOT_LEFT : xAt(b.startAt ?? b.lastCommitAt ?? b.mergedAt);
    const endX = open ? plotRight : Math.max(startX + ELBOW * 2 + 8, xAt(b.mergedAt ?? b.lastCommitAt));
    return { id: b.id, startX, endX, open, enterLeft };
  };
  const upPack = packLanes(visible.filter(isUp).map(toInterval), LANE_BUDGET_UP, PILL_MARGIN);
  const downPack = packLanes(visible.filter((b) => !isUp(b)).map(toInterval), LANE_BUDGET_DOWN, PILL_MARGIN);
  const byId = new Map(visible.map((b) => [b.id, b]));

  const aLanes = upPack.placed.reduce((m, p) => Math.max(m, p.lane + 1), 0);
  const bLanes = downPack.placed.reduce((m, p) => Math.max(m, p.lane + 1), 0);
  const centerY = TOP_PAD + aLanes * LANE_GAP;
  const height = centerY + Math.max(1, bLanes) * LANE_GAP + AXIS_H + 26;
  const axisY = height - AXIS_H + 6;

  const layNodes = (b: GitHubGraphBranch, segStart: number, segEnd: number): LaidNode[] => {
    const lo = segStart + 4, hi = Math.max(lo + 1, segEnd - 4);
    if (b.nodes.length === 0 && (b.hiddenCommitCount ?? 0) > 0) {
      return [{ x: (lo + hi) / 2, label: `+${b.hiddenCommitCount}`, occurredAt: b.mergedAt ?? b.lastCommitAt ?? "", collapsed: b.hiddenCommitCount }];
    }
    return b.nodes.map((n) => ({ x: Math.max(lo, Math.min(hi, xAt(n.occurredAt))), label: n.label, sha: n.sha, occurredAt: n.occurredAt, collapsed: n.collapsedCount }));
  };

  const buildLaid = (placed: (typeof upPack.placed)[number], above: boolean): LaidBranch => {
    const b = byId.get(placed.id)!;
    const { startX, endX, open, enterLeft, lane } = placed;
    const laneY = above ? centerY - (lane + 1) * LANE_GAP : centerY + (lane + 1) * LANE_GAP;
    const segStart = enterLeft ? PLOT_LEFT + 20 : startX + ELBOW;
    const elbowOut = enterLeft ? null : `M ${startX} ${centerY} Q ${startX} ${laneY} ${startX + ELBOW} ${laneY}`;
    const leadIn = enterLeft ? `M ${PLOT_LEFT} ${laneY} L ${segStart} ${laneY}` : null;
    const solidRight = open ? Math.max(segStart, endX - DASH_TAIL) : Math.max(segStart, endX - ELBOW);
    const segSolid = `M ${segStart} ${laneY} L ${solidRight} ${laneY}`;
    const segDash = open ? `M ${solidRight} ${laneY} L ${endX} ${laneY}` : null;
    const elbowIn = open ? null : `M ${endX - ELBOW} ${laneY} Q ${endX} ${laneY} ${endX} ${centerY}`;
    const nodes = layNodes(b, segStart, open ? endX - 6 : endX - ELBOW);
    const label = `${b.name}${b.openPrNumber ? ` · #${b.openPrNumber}` : ""}`;
    const pillText = label.length > 18 ? `${label.slice(0, 17)}…` : label;
    const pillW = Math.min(150, pillText.length * 6.2 + 20);
    return {
      id: b.id, name: b.name, type: b.type, color: LANE_COLORS[b.type], laneY, above, open, openPrNumber: b.openPrNumber,
      elbowOut, leadIn, segSolid, segDash, elbowIn, mergeDotX: open ? null : endX,
      pillX: segStart, pillY: above ? laneY - 18 : laneY + 5, pillW, pillText, pillShort: pillW > endX - segStart, nodes,
    };
  };
  const branches: LaidBranch[] = [
    ...upPack.placed.map((p) => buildLaid(p, true)),
    ...downPack.placed.map((p) => buildLaid(p, false)),
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
