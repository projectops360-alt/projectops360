"use client";

// ============================================================================
// PMO Portfolio Living Graph — toolbar (CAP-048)
// ============================================================================
// Every control here narrows or interrogates what is already on the canvas.
// None of them create, edit or infer anything: this dashboard is read-only by
// contract, and the toolbar is where that promise is most tempting to break.
// ============================================================================

import { useTranslations } from "next-intl";
import {
  Crosshair,
  Filter,
  RotateCcw,
  Route,
  Save,
  Search,
  Target,
  X,
} from "lucide-react";
import type { GraphFilters, GraphNodeKind } from "@/lib/pmo-living-graph/contracts";
import { KIND_LABEL } from "./graph-nodes";

const FILTERABLE_KINDS: GraphNodeKind[] = [
  "project",
  "milestone",
  "task",
  "risk",
  "decision",
  "resource",
  "kpi",
  "budget_item",
];

const HOP_OPTIONS: { hops: 1 | 2 | 3; key: "hops1" | "hops2" | "hops3" }[] = [
  { hops: 1, key: "hops1" },
  { hops: 2, key: "hops2" },
  { hops: 3, key: "hops3" },
];

export interface GraphToolbarProps {
  locale: "en" | "es";
  filters: GraphFilters;
  onFiltersChange: (filters: GraphFilters) => void;
  filtersActive: boolean;
  onClearFilters: () => void;
  /** Focus mode is only meaningful with a node selected. */
  focusActive: boolean;
  canFocus: boolean;
  onToggleFocus: () => void;
  pathActive: boolean;
  onTogglePathMode: () => void;
  pathHint: string | null;
  blastHops: 1 | 2 | 3 | null;
  onBlastHopsChange: (hops: 1 | 2 | 3 | null) => void;
  canBlast: boolean;
  onSaveLayout: () => void;
  onResetLayout: () => void;
  layoutSavedAt: number | null;
  /**
   * Extra view controls, rendered in the same row.
   *
   * The intelligence layer contributes its panel toggles here rather than
   * floating them over the canvas, so every control that changes what is on
   * screen lives in one place. Optional: without the layer the toolbar is
   * exactly what Phase 1 shipped.
   */
  children?: React.ReactNode;
}

export function GraphToolbar({
  locale,
  filters,
  onFiltersChange,
  filtersActive,
  onClearFilters,
  focusActive,
  canFocus,
  onToggleFocus,
  pathActive,
  onTogglePathMode,
  pathHint,
  blastHops,
  onBlastHopsChange,
  canBlast,
  onSaveLayout,
  onResetLayout,
  layoutSavedAt,
  children,
}: GraphToolbarProps) {
  const t = useTranslations("pmoLivingGraph");
  const es = locale === "es";

  const toggleKind = (kind: GraphNodeKind) => {
    const active = filters.nodeKinds.includes(kind);
    onFiltersChange({
      ...filters,
      nodeKinds: active
        ? filters.nodeKinds.filter((item) => item !== kind)
        : [...filters.nodeKinds, kind],
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      {/* Search ------------------------------------------------------------ */}
      <label className="relative flex min-w-[200px] flex-1 items-center">
        <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-400" aria-hidden />
        <span className="sr-only">{t("search")}</span>
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          placeholder={t("search")}
          className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>

      {/* The semantic-zoom selector used to live here. It is gone on purpose:
          with level navigation, "how deep am I" is answered by the breadcrumb
          trail, and two competing depth controls made the canvas contradict
          itself (zoom "Portfolio" while a task was open). Depth is now a
          consequence of where you drilled to, not a separate setting. */}

      {/* Kind filters ------------------------------------------------------- */}
      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          {t("filters")}
          {filters.nodeKinds.length > 0 ? (
            <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">
              {filters.nodeKinds.length}
            </span>
          ) : null}
        </summary>
        <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <ul className="space-y-1">
            {FILTERABLE_KINDS.map((kind) => (
              <li key={kind}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={filters.nodeKinds.includes(kind)}
                    onChange={() => toggleKind(kind)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {KIND_LABEL[kind][es ? "es" : "en"]}
                </label>
              </li>
            ))}
          </ul>

          {/* Confidence floor: hides links the graph is least sure about. */}
          <label className="mt-2 block border-t border-slate-100 pt-2 text-[11px] font-semibold text-slate-600">
            {t("confidence")} ≥ {Math.round(filters.minConfidence * 100)}%
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(filters.minConfidence * 100)}
              onChange={(event) =>
                onFiltersChange({ ...filters, minConfidence: Number(event.target.value) / 100 })
              }
              className="mt-1 w-full accent-emerald-600"
            />
          </label>
        </div>
      </details>

      {filtersActive ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {t("clearFilters")}
        </button>
      ) : null}

      <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />

      {/* Focus mode --------------------------------------------------------- */}
      <button
        type="button"
        onClick={onToggleFocus}
        disabled={!canFocus && !focusActive}
        aria-pressed={focusActive}
        className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          focusActive
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Crosshair className="h-3.5 w-3.5" aria-hidden />
        {focusActive ? t("exitFocus") : t("focusMode")}
      </button>

      {/* Find path ---------------------------------------------------------- */}
      <button
        type="button"
        onClick={onTogglePathMode}
        aria-pressed={pathActive}
        className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          pathActive
            ? "border-sky-600 bg-sky-600 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Route className="h-3.5 w-3.5" aria-hidden />
        {t("findPath")}
      </button>

      {/* Blast radius ------------------------------------------------------- */}
      <div
        role="group"
        aria-label={t("blastRadius")}
        title={t("blastRadiusHint")}
        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1"
      >
        <Target className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        {HOP_OPTIONS.map(({ hops, key }) => (
          <button
            key={hops}
            type="button"
            // Re-clicking the active depth turns impact analysis off, so the
            // control does not become a one-way trip.
            onClick={() => onBlastHopsChange(blastHops === hops ? null : hops)}
            disabled={!canBlast}
            aria-pressed={blastHops === hops}
            title={t(key)}
            className={`h-5 w-5 rounded text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              blastHops === hops
                ? "bg-amber-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {hops}
          </button>
        ))}
      </div>

      <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />

      {/* Panel toggles, when the intelligence layer supplies them ----------- */}
      {children}

      {children ? (
        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
      ) : null}

      {/* Layout ------------------------------------------------------------- */}
      <button
        type="button"
        onClick={onSaveLayout}
        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Save className="h-3.5 w-3.5" aria-hidden />
        {t("saveLayout")}
      </button>
      <button
        type="button"
        onClick={onResetLayout}
        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {t("resetLayout")}
      </button>

      {/* Transient confirmations and hints share this slot; only one can be
          relevant at a time. */}
      {layoutSavedAt ? (
        <span role="status" className="text-xs font-semibold text-emerald-700">
          {t("layoutSaved")}
        </span>
      ) : pathHint ? (
        <span role="status" className="text-xs font-medium text-sky-700">
          {pathHint}
        </span>
      ) : null}
    </div>
  );
}
