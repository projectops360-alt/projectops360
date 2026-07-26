"use client";

// ============================================================================
// PMO Intelligence Center — portfolio health (CAP-048 Phase 2, M5)
// ============================================================================
// Dashboard 1's health, VERBATIM: the same overall score and the same six
// dimensions, produced by `getCommandCenterSummary` and copied through the read
// model without a formula anywhere in between (ADR-012).
//
// The one thing added here is that each dimension is clickable: it activates
// the lens that explains it. `materials` has no lens — no materials projection
// exists on the canvas — so it renders as a dimension with a stated absence
// rather than being wired to something unrelated just to make the row
// clickable. A control that does the wrong thing is worse than one that says it
// cannot act.
// ============================================================================

import { useTranslations } from "next-intl";
import { Activity, Ban } from "lucide-react";
import { healthDimensionLens } from "@/lib/pmo-intelligence/kpi-bindings";
import type { PmoHealthSlice } from "@/lib/pmo-intelligence/dashboard-model";
import type { PmoLens } from "@/lib/pmo-intelligence/scope";

export interface PmoHealthPanelProps {
  health: PmoHealthSlice | null;
  activeLens: PmoLens;
  onLensChange: (lens: PmoLens) => void;
}

/** Bands quoted from `command-center/service.ts` — not a second threshold set. */
function bandClass(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function bandText(score: number): string {
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  return "text-rose-700";
}

export function PmoHealthPanel({ health, activeLens, onLensChange }: PmoHealthPanelProps) {
  const t = useTranslations("pmoIntelligence");

  if (!health) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
          {t("healthTitle")}
        </h2>
        <p className="mt-2 text-xs text-slate-500">{t("healthUnavailable")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">
        <Activity className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        {t("healthTitle")}
      </h2>

      <p className={`mt-1 text-2xl font-extrabold leading-none ${bandText(health.overall)}`}>
        {health.overall}
        <span className="text-sm font-bold text-slate-400">/100</span>
      </p>
      {/* The provenance string the source produced. Traceability is the contract
          (ADR-012 §1), not a nicety. */}
      <p className="mt-0.5 text-[10px] text-slate-500">
        {t("healthDerivedFrom", { source: health.derivedFrom })}
      </p>

      <ul className="mt-2 space-y-1">
        {health.dimensions.map((dimension) => {
          const lens = healthDimensionLens(dimension.key);
          const isActive = lens != null && lens === activeLens;
          const label = t(`healthDimension_${dimension.key}`);

          // No lens ⇒ not a button. Rendering it as one and doing nothing on
          // click is the failure mode this branch exists to avoid.
          if (lens == null) {
            return (
              <li
                key={dimension.key}
                className="flex items-center gap-2 rounded-md border border-dashed border-slate-200 px-2 py-1"
              >
                <DimensionRow label={label} score={dimension.score} />
                <span
                  title={t("healthNoLensFor", { dimension: label })}
                  className="flex shrink-0 items-center gap-0.5 text-[9px] font-bold uppercase text-slate-400"
                >
                  <Ban className="h-2.5 w-2.5" aria-hidden />
                  {t("healthNoLens")}
                </span>
              </li>
            );
          }

          return (
            <li key={dimension.key}>
              <button
                type="button"
                onClick={() => onLensChange(lens)}
                aria-pressed={isActive}
                title={t("healthOpenLens", { lens: t(`lens_${lens}`) })}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left transition-colors ${
                  isActive
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <DimensionRow label={label} score={dimension.score} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DimensionRow({ label, score }: { label: string; score: number }) {
  return (
    <>
      <span className="w-24 shrink-0 truncate text-[11px] font-semibold text-slate-700">
        {label}
      </span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span
          className={`block h-full rounded-full ${bandClass(score)}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </span>
      <span className={`w-8 shrink-0 text-right text-[11px] font-bold ${bandText(score)}`}>
        {score}
      </span>
    </>
  );
}
