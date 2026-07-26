"use client";

// ============================================================================
// PMO Portfolio Living Graph — navigation trail (CAP-048)
// ============================================================================
// Drilling in isolates: entering a project hides the other four. That is only
// safe if the way out is permanently on screen — without it, hiding the
// portfolio is indistinguishable from losing it.
//
// So this bar is never conditional. At portfolio level it still renders, with a
// single crumb, so the control does not appear and disappear as the user moves.
// ============================================================================

import { useTranslations } from "next-intl";
import { ChevronRight, CornerLeftUp, Home } from "lucide-react";
import type {
  BreadcrumbEntry,
  GraphNavigation,
} from "@/lib/pmo-living-graph/navigation";

export function GraphBreadcrumbs({
  trail,
  onNavigate,
  onLevelUp,
  canLevelUp,
}: {
  trail: readonly BreadcrumbEntry[];
  onNavigate: (navigation: GraphNavigation) => void;
  onLevelUp: () => void;
  canLevelUp: boolean;
}) {
  const t = useTranslations("pmoLivingGraph");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onLevelUp}
        disabled={!canLevelUp}
        className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CornerLeftUp className="h-3.5 w-3.5" aria-hidden />
        {t("levelUp")}
      </button>

      <nav aria-label={t("breadcrumbs")} className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1">
          {trail.map((entry, index) => {
            const isLast = index === trail.length - 1;
            return (
              <li key={`${entry.level}:${entry.label}`} className="flex min-w-0 items-center gap-1">
                {index > 0 ? (
                  <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
                ) : null}
                {isLast ? (
                  // The current level is not a link: offering to navigate to
                  // where you already are is noise.
                  <span
                    aria-current="page"
                    className="flex min-w-0 items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800"
                  >
                    {index === 0 ? <Home className="h-3 w-3 shrink-0" aria-hidden /> : null}
                    <span className="truncate">{entry.label}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(entry.navigation)}
                    className="flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    {index === 0 ? <Home className="h-3 w-3 shrink-0" aria-hidden /> : null}
                    <span className="truncate">{entry.label}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
