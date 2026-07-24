"use client";

// ============================================================================
// PMO Process Intelligence — Process Canvas (CAP-047 · M4)
// ============================================================================
// Analytical SVG process map over the pure flow model. Data-first and
// motion-free: edge thickness = frequency, dominant path = solid brand,
// rework = dashed red WITH a text marker (never color alone), bottlenecks
// carry a calculated badge. Zoom/pan, min-frequency filter (LOD), variant
// isolation, selection → evidence drawer. Saved views are presentation-only
// (localStorage — UX-007/PD-008 pattern). Nothing here derives business
// truth: every number comes from the PmoPiFlowModel contract.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import type { PmoPiFlowModel, PmoPiProcessEdge, PmoPiProcessNode } from "@/lib/pmo-process-intelligence/contracts";

const NODE_W = 190;
const NODE_H = 64;

/** Prettify a registry event type for executive reading. */
export function activityLabel(eventType: string): string {
  return eventType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

/** LOD: keep the strongest nodes/edges above the frequency floor. */
export function filterModelForDisplay(
  model: PmoPiFlowModel,
  minFrequency: number,
  reworkOnly: boolean,
): { nodes: PmoPiProcessNode[]; edges: PmoPiProcessEdge[] } {
  const nodes = model.nodes.filter((n) => n.frequency >= minFrequency);
  const keep = new Set(nodes.map((n) => n.id));
  let edges = model.edges.filter((e) => keep.has(e.from) && keep.has(e.to) && e.frequency >= Math.min(minFrequency, 1));
  if (reworkOnly) edges = edges.filter((e) => e.isRework || e.onDominantPath);
  return { nodes, edges };
}

interface LayoutNode extends PmoPiProcessNode {
  x: number;
  y: number;
}

function layout(nodes: PmoPiProcessNode[], edges: PmoPiProcessEdge[]): { nodes: LayoutNode[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 90, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) if (!e.isRework) g.setEdge(e.from, e.to);
  dagre.layout(g);
  const placed = nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, x: p?.x ?? 0, y: p?.y ?? 0 };
  });
  const graph = g.graph();
  return { nodes: placed, width: Math.max(graph.width ?? 600, 600), height: Math.max(graph.height ?? 360, 360) };
}

type Selection =
  | { kind: "node"; node: PmoPiProcessNode }
  | { kind: "edge"; edge: PmoPiProcessEdge }
  | null;

export function ProcessCanvas({
  model,
  locale,
  highlightActivities = null,
}: {
  model: PmoPiFlowModel;
  locale: "en" | "es";
  /** Activities to emphasize (e.g. from an Isabella recommendation). */
  highlightActivities?: string[] | null;
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  // LOD default: with very large graphs raise the frequency floor so the
  // initial view stays legible (usable-at-200-nodes target).
  const defaultMin = model.nodes.length > 60 ? 2 : 1;
  // Saved view (presentation only — UX-007/PD-008 pattern): filters persist
  // per organization + level in localStorage; never business data. Restored
  // via lazy initializers (no effect-driven setState).
  const viewKey = `pmo-pi-view:${model.scope.organizationId}:${model.scope.level}`;
  const readSavedView = (): { minFrequency?: number; reworkOnly?: boolean } => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(viewKey) ?? "{}") as {
        minFrequency?: number;
        reworkOnly?: boolean;
      };
    } catch {
      return {}; // corrupted saved view — defaults stand
    }
  };
  const [minFrequency, setMinFrequency] = useState(() => {
    const saved = readSavedView();
    return typeof saved.minFrequency === "number" ? saved.minFrequency : defaultMin;
  });
  const [reworkOnly, setReworkOnly] = useState(() => readSavedView().reworkOnly === true);
  const [variantId, setVariantId] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(viewKey, JSON.stringify({ minFrequency, reworkOnly }));
    } catch {
      /* storage unavailable — the view simply is not persisted */
    }
  }, [viewKey, minFrequency, reworkOnly]);

  const { nodes, edges } = useMemo(
    () => filterModelForDisplay(model, minFrequency, reworkOnly),
    [model, minFrequency, reworkOnly],
  );
  const placed = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const nodeById = useMemo(() => new Map(placed.nodes.map((n) => [n.id, n])), [placed]);

  const variant = variantId ? model.variants.variants.find((v) => v.variantId === variantId) ?? null : null;
  const variantEdges = useMemo(() => {
    if (!variant) return null;
    const set = new Set<string>();
    for (let i = 1; i < variant.signature.length; i++) set.add(`${variant.signature[i - 1]}→${variant.signature[i]}`);
    return set;
  }, [variant]);

  const maxEdgeFreq = Math.max(1, ...edges.map((e) => e.frequency));
  const fmtMs = (ms: number | null): string => {
    if (ms == null) return "—";
    const h = ms / 3_600_000;
    if (h >= 48) return `${(h / 24).toFixed(1)} d`;
    if (h >= 1) return `${h.toFixed(1)} h`;
    return `${Math.round(ms / 60_000)} min`;
  };

  if (model.nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-2 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          {tt(
            "No process events in scope yet. The map appears as soon as the Project Event Graph records activity.",
            "Aún no hay eventos de proceso en alcance. El mapa aparece en cuanto el Project Event Graph registre actividad.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Filters + zoom controls ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          {tt("Min frequency", "Frecuencia mínima")}
          <select
            value={minFrequency}
            onChange={(e) => setMinFrequency(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-1.5 py-1"
          >
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>≥ {n}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          <input type="checkbox" checked={reworkOnly} onChange={(e) => setReworkOnly(e.target.checked)} className="h-3.5 w-3.5 rounded border-border accent-brand-600" />
          {tt("Rework + dominant only", "Solo retrabajo + dominante")}
        </label>
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          {tt("Variant", "Variante")}
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="max-w-[220px] rounded-md border border-border bg-background px-1.5 py-1"
          >
            <option value="">{tt("All", "Todas")}</option>
            {model.variants.variants.slice(0, 10).map((v) => (
              <option key={v.variantId} value={v.variantId}>
                {v.caseCount}× · {Math.round(v.frequencyPct)}% {v.isReference ? tt("(reference)", "(referencia)") : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto inline-flex items-center gap-1">
          <button type="button" aria-label={tt("Zoom out", "Alejar")} onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="rounded-md border border-border p-1 hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
          <span className="w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label={tt("Zoom in", "Acercar")} onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))} className="rounded-md border border-border p-1 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label={tt("Reset view", "Restablecer vista")} onClick={() => setZoom(1)} className="rounded-md border border-border p-1 hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto rounded-xl border border-border bg-background/60">
        <svg
          role="img"
          aria-label={tt("Process map", "Mapa de proceso")}
          width={placed.width * zoom}
          height={placed.height * zoom}
          viewBox={`0 0 ${placed.width} ${placed.height}`}
        >
          <defs>
            <marker id="pmoPiArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
            </marker>
            <marker id="pmoPiArrowRework" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-red-500" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e) => {
            const from = nodeById.get(e.from);
            const to = nodeById.get(e.to);
            if (!from || !to) return null;
            const key = `${e.from}→${e.to}`;
            const dimmed = variantEdges ? !variantEdges.has(key) : false;
            const w = 1.5 + (e.frequency / maxEdgeFreq) * 4.5;
            const selected = selection?.kind === "edge" && selection.edge.from === e.from && selection.edge.to === e.to;
            const x1 = from.x + NODE_W / 2;
            const y1 = from.y;
            const x2 = to.x - NODE_W / 2;
            const y2 = to.y;
            const back = x2 <= x1; // loop/return goes back — curve above
            const path = back
              ? `M ${from.x} ${from.y - NODE_H / 2} C ${from.x} ${from.y - NODE_H / 2 - 70}, ${to.x} ${to.y - NODE_H / 2 - 70}, ${to.x} ${to.y - NODE_H / 2}`
              : `M ${x1} ${y1} C ${x1 + 45} ${y1}, ${x2 - 45} ${y2}, ${x2} ${y2}`;
            return (
              <g key={key} className={dimmed ? "opacity-20" : ""}>
                <path
                  d={path}
                  fill="none"
                  strokeWidth={selected ? w + 1.5 : w}
                  strokeDasharray={e.isRework ? "6 4" : undefined}
                  markerEnd={e.isRework ? "url(#pmoPiArrowRework)" : "url(#pmoPiArrow)"}
                  className={
                    e.isRework
                      ? "stroke-red-500"
                      : e.onDominantPath
                        ? "stroke-brand-600"
                        : "stroke-muted-foreground/50"
                  }
                />
                {/* transparent hit area */}
                <path
                  d={path}
                  fill="none"
                  strokeWidth={Math.max(w + 10, 14)}
                  stroke="transparent"
                  className="cursor-pointer"
                  onClick={() => setSelection({ kind: "edge", edge: e })}
                >
                  <title>
                    {`${activityLabel(e.from)} → ${activityLabel(e.to)} · ${e.frequency}×${e.isRework ? ` · ${tt("rework", "retrabajo")}` : ""}`}
                  </title>
                </path>
              </g>
            );
          })}

          {/* Nodes */}
          {placed.nodes.map((n) => {
            const highlighted = highlightActivities?.includes(n.id) ?? false;
            const dimmed =
              (variant ? !variant.signature.includes(n.id) : false) ||
              (highlightActivities != null && highlightActivities.length > 0 && !highlighted);
            const selected = selection?.kind === "node" && selection.node.id === n.id;
            const isBottleneck = n.bottleneckScore >= 0.7;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x - NODE_W / 2}, ${n.y - NODE_H / 2})`}
                className={`cursor-pointer ${dimmed ? "opacity-25" : ""}`}
                onClick={() => setSelection({ kind: "node", node: n })}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  strokeWidth={selected || highlighted ? 2.5 : 1.5}
                  className={`fill-card ${
                    highlighted
                      ? "stroke-amber-500"
                      : selected
                        ? "stroke-brand-600"
                        : n.onDominantPath
                          ? "stroke-brand-400"
                          : "stroke-border"
                  }`}
                />
                <text x={12} y={22} className="fill-foreground text-[12px] font-semibold">
                  {activityLabel(n.activity).slice(0, 24)}
                </text>
                <text x={12} y={40} className="fill-muted-foreground text-[10px]">
                  {n.frequency}× · {n.caseCount} {tt("cases", "casos")} · {tt("wait", "espera")} {fmtMs(n.avgIncomingWaitingMs)}
                </text>
                {(isBottleneck || n.reworkOccurrences > 0) && (
                  <text x={12} y={55} className="text-[10px] font-semibold">
                    {isBottleneck && (
                      <tspan className="fill-amber-600">⚠ {tt("Bottleneck", "Cuello de botella")} </tspan>
                    )}
                    {n.reworkOccurrences > 0 && (
                      <tspan className="fill-red-600">↩ {tt("rework", "retrabajo")} ×{n.reworkOccurrences}</tspan>
                    )}
                  </text>
                )}
                <title>{activityLabel(n.activity)}</title>
              </g>
            );
          })}
        </svg>

        {/* ── Evidence drawer (mandatory evidence, never decorated) ── */}
        {selection && (
          <aside
            aria-label={tt("Evidence", "Evidencia")}
            className="absolute right-2 top-2 w-72 rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground">
                {selection.kind === "node"
                  ? activityLabel(selection.node.activity)
                  : `${activityLabel(selection.edge.from)} → ${activityLabel(selection.edge.to)}`}
              </h3>
              <button type="button" aria-label={tt("Close", "Cerrar")} onClick={() => setSelection(null)} className="rounded p-0.5 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-2 space-y-1 text-xs">
              {selection.kind === "node" ? (
                <>
                  <Row k={tt("Frequency", "Frecuencia")} v={`${selection.node.frequency}×`} />
                  <Row k={tt("Cases", "Casos")} v={String(selection.node.caseCount)} />
                  <Row k={tt("Avg incoming wait", "Espera media de entrada")} v={fmtMs(selection.node.avgIncomingWaitingMs)} />
                  <Row k={tt("Rework occurrences", "Repeticiones (retrabajo)")} v={String(selection.node.reworkOccurrences)} />
                  <Row k={tt("Bottleneck score", "Puntaje de cuello de botella")} v={selection.node.bottleneckScore.toFixed(2)} />
                </>
              ) : (
                <>
                  <Row k={tt("Frequency", "Frecuencia")} v={`${selection.edge.frequency}×`} />
                  <Row k={tt("Cases", "Casos")} v={String(selection.edge.caseCount)} />
                  <Row k={tt("Avg waiting", "Espera media")} v={fmtMs(selection.edge.avgWaitingMs)} />
                  <Row k={tt("Rework", "Retrabajo")} v={selection.edge.isRework ? tt("yes", "sí") : "no"} />
                </>
              )}
              <Row k={tt("Data quality", "Calidad de datos")} v={`${Math.round(model.quality.dataQualityScore * 100)}%`} />
              <Row k={tt("Events used", "Eventos usados")} v={`${model.quality.businessEventsUsed}/${model.quality.totalEventsSeen}`} />
            </dl>
            <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
              {tt(
                "Formula: bottleneck = normalized avg incoming wait × frequency. Temporal order is not causality. Source: project_event_log (business events only).",
                "Fórmula: cuello de botella = espera media de entrada normalizada × frecuencia. El orden temporal no es causalidad. Fuente: project_event_log (solo eventos de negocio).",
              )}
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-foreground">{v}</dd>
    </div>
  );
}
