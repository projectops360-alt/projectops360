"use client";

// ============================================================================
// PMO Intelligence Center — panel toggles (CAP-048 Phase 2)
// ============================================================================
// The single entry point for the two collapsible panels, living in the graph
// toolbar next to Find path and Filters.
//
// Deliberately NOT a floating button. The app already has one floating Isabella
// (`LivingGuideWidget`, bottom right) and adding a second would recreate exactly
// the confusion this change exists to remove: two Isabellas on screen, neither
// obviously the real one. A toolbar control reads as "a view of this dashboard",
// which is what the insights panel actually is.
//
// The count is labelled. A bare "2" next to a title was the reported defect —
// the number was the insight count but nothing on screen said so, so it read as
// an unexplained badge.
// ============================================================================

import { useTranslations } from "next-intl";
import { BookOpen, PanelLeft, PanelRight, Sparkles } from "lucide-react";

export interface PmoPanelTogglesProps {
  isabellaOpen: boolean;
  onToggleIsabella: () => void;
  /** Number of insights behind the Isabella panel, shown as a labelled count. */
  insightCount: number;
  overviewOpen: boolean;
  onToggleOverview: () => void;
  /**
   * Right rail. Only meaningful while the what-if lens is active, so the
   * control is omitted rather than shown disabled — a toggle for a panel that
   * cannot exist is noise.
   */
  simulationRailAvailable?: boolean;
  simulationRailOpen?: boolean;
  onToggleSimulationRail?: () => void;
  /**
   * Opens the acronym reference.
   *
   * Always available, because it depends on no data. The inline annotated term
   * only reaches someone who already has the number on screen; "where are the
   * acronyms and what do they mean?" needed an entry point of its own.
   */
  onOpenGlossary?: () => void;
}

export function PmoPanelToggles({
  isabellaOpen,
  onToggleIsabella,
  insightCount,
  overviewOpen,
  onToggleOverview,
  simulationRailAvailable = false,
  simulationRailOpen = true,
  onToggleSimulationRail,
  onOpenGlossary,
}: PmoPanelTogglesProps) {
  const t = useTranslations("pmoIntelligence");

  return (
    <>
      <button
        type="button"
        onClick={onToggleOverview}
        aria-pressed={overviewOpen}
        title={overviewOpen ? t("panelHideOverview") : t("panelShowOverview")}
        className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          overviewOpen
            ? "border-slate-300 bg-slate-100 text-slate-700"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <PanelLeft className="h-3.5 w-3.5" aria-hidden />
        {t("panelOverview")}
      </button>

      <button
        type="button"
        onClick={onToggleIsabella}
        aria-pressed={isabellaOpen}
        title={isabellaOpen ? t("panelHideIsabella") : t("panelShowIsabella")}
        className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          isabellaOpen
            ? "border-purple-400 bg-purple-50 text-purple-800"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5 text-purple-500" aria-hidden />
        {/* The count is read as "Isabella · 3 findings", never as a bare badge. */}
        {t("panelIsabellaWithCount", { count: insightCount })}
      </button>

      {simulationRailAvailable && onToggleSimulationRail ? (
        <button
          type="button"
          onClick={onToggleSimulationRail}
          aria-pressed={simulationRailOpen}
          title={simulationRailOpen ? t("panelHideSimulation") : t("panelShowSimulation")}
          className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            simulationRailOpen
              ? "border-slate-300 bg-slate-100 text-slate-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <PanelRight className="h-3.5 w-3.5" aria-hidden />
          {t("panelSimulation")}
        </button>
      ) : null}

      {onOpenGlossary ? (
        <button
          type="button"
          onClick={onOpenGlossary}
          title={t("panelGlossaryHint")}
          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <BookOpen className="h-3.5 w-3.5 text-blue-600" aria-hidden />
          {t("panelGlossary")}
        </button>
      ) : null}
    </>
  );
}
