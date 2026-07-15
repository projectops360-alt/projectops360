"use client";

// ============================================================================
// ProjectOps360° — Living Graph toolbar
// ============================================================================
// Search (debounced), node/edge type filters, status/risk/date filters,
// overlay selector, layout mode selector, cluster + focus controls,
// fit view and fullscreen.
// ============================================================================

import { memo, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Crosshair,
  XCircle,
  Locate,
  Wand2,
  Focus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_TYPE_STYLES, EDGE_TYPE_STYLES } from "@/lib/graph/living-graph-styles";
import type { ProcessNodeType, ProcessEdgeType } from "@/types/database";
import type {
  LivingGraphOverlay,
  LivingGraphLayoutMode,
  LivingGraphViewLevel,
  GraphMetricSummary,
} from "@/types/living-graph";

const OVERLAYS: LivingGraphOverlay[] = [
  "normal",
  "bottleneck",
  "criticalPath",
  "rework",
  "traceabilityGap",
  "risk",
  "sopCandidate",
  "blocker",
  "laborCapacity",
  "workforceCapacity",
  "readiness",
  "variance",
  "timeline",
  "simulation",
];

const LAYOUT_MODES: LivingGraphLayoutMode[] = ["hierarchical", "timeline", "force"];

const VIEW_LEVELS: LivingGraphViewLevel[] = ["milestones", "activities", "events", "knowledge"];

const NODE_TYPES = Object.keys(NODE_TYPE_STYLES) as ProcessNodeType[];
const EDGE_TYPES = Object.keys(EDGE_TYPE_STYLES) as ProcessEdgeType[];

export interface LivingGraphToolbarProps {
  overlay: LivingGraphOverlay;
  onOverlayChange: (overlay: LivingGraphOverlay) => void;
  layoutMode: LivingGraphLayoutMode;
  onLayoutModeChange: (mode: LivingGraphLayoutMode) => void;
  onSearchChange: (query: string) => void;
  searchHitCount: number;
  searchActive: boolean;
  onCenterSearchHit: () => void;
  nodeTypeFilter: Set<ProcessNodeType>;
  onToggleNodeType: (type: ProcessNodeType) => void;
  edgeTypeFilter: Set<ProcessEdgeType>;
  onToggleEdgeType: (type: ProcessEdgeType) => void;
  statusFilter: string | null;
  statuses: string[];
  onStatusFilterChange: (status: string | null) => void;
  riskFilter: "low" | "medium" | "high" | null;
  onRiskFilterChange: (risk: "low" | "medium" | "high" | null) => void;
  blockedOnly: boolean;
  onBlockedOnlyChange: (value: boolean) => void;
  criticalOnly: boolean;
  onCriticalOnlyChange: (value: boolean) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  viewLevel: LivingGraphViewLevel;
  onViewLevelChange: (level: LivingGraphViewLevel) => void;
  simplifyEdges: boolean;
  onToggleSimplifyEdges: () => void;
  focusActive: boolean;
  onClearFocus: () => void;
  onFitView: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  onResetFilters: () => void;
  /** Sprint #2 — number of filters currently narrowing the graph (badge). */
  activeFilterCount: number;
  summary: GraphMetricSummary;
  largeGraphWarning: boolean;
}

function LivingGraphToolbarComponent(props: LivingGraphToolbarProps) {
  const t = useTranslations("livingGraph");
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onSearchChange } = props;
  const knowledgeView = props.viewLevel === "knowledge";

  // Debounced search propagation
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(searchInput), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, onSearchChange]);

  const selectClass =
    "h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40";

  return (
    <div className="space-y-2">
      {/* Primary row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        {props.searchActive && (
          <button
            type="button"
            onClick={props.onCenterSearchHit}
            disabled={props.searchHitCount === 0}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Locate className="h-3.5 w-3.5" aria-hidden />
            {props.searchHitCount > 0
              ? t("search.results", { count: props.searchHitCount })
              : t("search.noResults")}
          </button>
        )}

        {/* Detail level: milestones → activities → events */}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden lg:inline">{t("level.label")}</span>
          <select
            value={props.viewLevel}
            onChange={(e) => props.onViewLevelChange(e.target.value as LivingGraphViewLevel)}
            aria-label={t("level.label")}
            className={selectClass}
          >
            {VIEW_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`level.${level}`)}
              </option>
            ))}
          </select>
        </label>

        {/* Overlay selector */}
        {!knowledgeView && <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden lg:inline">{t("overlays.label")}</span>
          <select
            value={props.overlay}
            onChange={(e) => props.onOverlayChange(e.target.value as LivingGraphOverlay)}
            aria-label={t("overlays.label")}
            className={selectClass}
          >
            {OVERLAYS.map((o) => (
              <option key={o} value={o}>
                {t(`overlays.${o}`)}
              </option>
            ))}
          </select>
        </label>}

        {/* Layout selector */}
        {!knowledgeView && <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden lg:inline">{t("layoutModes.label")}</span>
          <select
            value={props.layoutMode}
            onChange={(e) => props.onLayoutModeChange(e.target.value as LivingGraphLayoutMode)}
            aria-label={t("layoutModes.label")}
            className={selectClass}
          >
            {LAYOUT_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`layoutModes.${m}`)}
              </option>
            ))}
          </select>
        </label>}

        {/* Toggles */}
        {!knowledgeView && <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          title={t("filters.label")}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs transition-colors",
            showFilters || props.activeFilterCount > 0
              ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          {t("filters.label")}
          {props.activeFilterCount > 0 && (
            <span
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold tabular-nums text-white"
              aria-label={t("filters.activeCount", { count: props.activeFilterCount })}
            >
              {props.activeFilterCount}
            </span>
          )}
        </button>}
        {props.viewLevel !== "milestones" && !knowledgeView && (
          <button
            type="button"
            onClick={props.onToggleSimplifyEdges}
            aria-pressed={props.simplifyEdges}
            title={t("actions.simplify")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs transition-colors",
              props.simplifyEdges
                ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden lg:inline">{t("actions.simplify")}</span>
          </button>
        )}
        {props.focusActive && (
          <button
            type="button"
            onClick={props.onClearFocus}
            title={t("actions.clearFocus")}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 text-xs text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            {t("actions.clearFocus")}
          </button>
        )}
        <button
          type="button"
          onClick={props.onFitView}
          title={t("actions.fitView")}
          aria-label={t("actions.fitView")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted"
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={props.onToggleFocus}
          title={props.focusMode ? t("actions.exitFocus") : t("actions.focusGraph")}
          aria-label={props.focusMode ? t("actions.exitFocus") : t("actions.focusGraph")}
          aria-pressed={props.focusMode}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md border text-foreground hover:bg-muted",
            props.focusMode ? "border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-400" : "border-border bg-card",
          )}
        >
          <Focus className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={props.onToggleFullscreen}
          title={props.isFullscreen ? t("actions.exitFullscreen") : t("actions.fullscreen")}
          aria-label={props.isFullscreen ? t("actions.exitFullscreen") : t("actions.fullscreen")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted"
        >
          {props.isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>

        {/* Summary */}
        {!knowledgeView && <span className="ml-auto hidden text-[11px] text-muted-foreground md:inline">
          {t("summary", {
            nodes: props.summary.nodeCount,
            edges: props.summary.edgeCount,
            blocked: props.summary.blockedCount,
            waiting: props.summary.waitingCount,
          })}
        </span>}
      </div>

      {/* Large graph warning */}
      {props.largeGraphWarning && !knowledgeView && (
        <p
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400"
        >
          {t("warnings.largeGraph")}
        </p>
      )}

      {/* Expanded filters */}
      {showFilters && !knowledgeView && (
        <div className="space-y-3 rounded-md border border-border bg-card p-3">
          {/* Node types */}
          <fieldset>
            <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("filters.nodeTypes")}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {NODE_TYPES.map((type) => {
                const active = props.nodeTypeFilter.has(type);
                const accent = NODE_TYPE_STYLES[type].accent;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => props.onToggleNodeType(type)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      active
                        ? "text-foreground"
                        : "border-border text-muted-foreground opacity-50 hover:opacity-80",
                    )}
                    style={active ? { borderColor: accent, backgroundColor: `${accent}1a` } : undefined}
                  >
                    {t(`nodeTypes.${type}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Edge types */}
          <fieldset>
            <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("filters.edgeTypes")}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {EDGE_TYPES.map((type) => {
                const active = props.edgeTypeFilter.has(type);
                const stroke = EDGE_TYPE_STYLES[type].stroke;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => props.onToggleEdgeType(type)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      active
                        ? "text-foreground"
                        : "border-border text-muted-foreground opacity-50 hover:opacity-80",
                    )}
                    style={active ? { borderColor: stroke, backgroundColor: `${stroke}1a` } : undefined}
                  >
                    {t(`edgeTypes.${type}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Status / risk / date / flags */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t("filters.status")}
              <select
                value={props.statusFilter ?? ""}
                onChange={(e) => props.onStatusFilterChange(e.target.value || null)}
                className={selectClass}
              >
                <option value="">{t("filters.all")}</option>
                {props.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t("filters.riskLevel")}
              <select
                value={props.riskFilter ?? ""}
                onChange={(e) =>
                  props.onRiskFilterChange((e.target.value || null) as "low" | "medium" | "high" | null)
                }
                className={selectClass}
              >
                <option value="">{t("filters.all")}</option>
                {(["low", "medium", "high"] as const).map((r) => (
                  <option key={r} value={r}>
                    {t(`detailPanel.risk.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t("filters.dateFrom")}
              <input
                type="date"
                value={props.dateFrom}
                onChange={(e) => props.onDateFromChange(e.target.value)}
                className={selectClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t("filters.dateTo")}
              <input
                type="date"
                value={props.dateTo}
                onChange={(e) => props.onDateToChange(e.target.value)}
                className={selectClass}
              />
            </label>
            <label className="flex h-8 items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={props.blockedOnly}
                onChange={(e) => props.onBlockedOnlyChange(e.target.checked)}
                className="h-3.5 w-3.5 accent-red-500"
              />
              {t("filters.blockedOnly")}
            </label>
            <label className="flex h-8 items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={props.criticalOnly}
                onChange={(e) => props.onCriticalOnlyChange(e.target.checked)}
                className="h-3.5 w-3.5 accent-rose-500"
              />
              {t("filters.criticalOnly")}
            </label>
            <button
              type="button"
              onClick={props.onResetFilters}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("filters.reset")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const LivingGraphToolbar = memo(LivingGraphToolbarComponent);
LivingGraphToolbar.displayName = "LivingGraphToolbar";
