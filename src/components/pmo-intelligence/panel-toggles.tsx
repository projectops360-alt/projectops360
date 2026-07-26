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
import { PanelLeft, Sparkles } from "lucide-react";

export interface PmoPanelTogglesProps {
  isabellaOpen: boolean;
  onToggleIsabella: () => void;
  /** Number of insights behind the Isabella panel, shown as a labelled count. */
  insightCount: number;
  overviewOpen: boolean;
  onToggleOverview: () => void;
}

export function PmoPanelToggles({
  isabellaOpen,
  onToggleIsabella,
  insightCount,
  overviewOpen,
  onToggleOverview,
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
    </>
  );
}
