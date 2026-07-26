"use client";

// ============================================================================
// PMO Intelligence Center — lens selector (CAP-048 Phase 2, M4)
// ============================================================================
// Tabs, not links. Every one of these reprojects the canvas that is already on
// screen; none navigates. That is the contract the whole milestone rests on, so
// they are rendered as buttons — an anchor would invite someone to give one an
// href later and quietly break it.
//
// A lens with no data behind it is disabled and says why, rather than opening
// an empty canvas that reads as "nothing is wrong here".
// ============================================================================

import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  DollarSign,
  FlaskConical,
  GitBranch,
  LayoutGrid,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PMO_LENSES, type PmoLens } from "@/lib/pmo-intelligence/scope";

const LENS_ICON: Record<PmoLens, LucideIcon> = {
  overview: LayoutGrid,
  process: Workflow,
  risk: AlertTriangle,
  finance: DollarSign,
  resources: Users,
  dependencies: GitBranch,
  benefits: Target,
  whatif: FlaskConical,
};

export interface PmoLensTabsProps {
  activeLens: PmoLens;
  onLensChange: (lens: PmoLens) => void;
  /** Lens → i18n key explaining why it cannot be used. */
  unavailable: ReadonlyMap<PmoLens, string>;
}

export function PmoLensTabs({ activeLens, onLensChange, unavailable }: PmoLensTabsProps) {
  const t = useTranslations("pmoIntelligence");

  return (
    <div role="tablist" aria-label={t("lensesLabel")} className="flex flex-wrap items-center gap-1">
      {PMO_LENSES.map((lens) => {
        const Icon = LENS_ICON[lens];
        const reason = unavailable.get(lens);
        const active = activeLens === lens;
        return (
          <button
            key={lens}
            type="button"
            role="tab"
            aria-selected={active}
            // Disabled rather than hidden: the capability exists as a concept
            // even when the data does not, and hiding it would make the gap
            // invisible instead of explained.
            disabled={reason != null}
            title={reason ? t(reason) : undefined}
            onClick={() => onLensChange(lens)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:border-dashed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 ${
              active
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {t(`lens_${lens}`)}
          </button>
        );
      })}
    </div>
  );
}
