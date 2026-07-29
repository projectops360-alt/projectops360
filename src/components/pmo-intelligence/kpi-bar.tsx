"use client";

// ============================================================================
// PMO Intelligence Center — unified KPI bar (CAP-048 Phase 2, M5)
// ============================================================================
// Eight KPIs, every one of them a control rather than a label.
//
// Two rules govern this component and both come from the parity matrix:
//
//   1. UNITS ARE NEVER MIXED. A score, a count, a number of days and a
//      percentage are formatted differently and are never placed in a shared
//      column where they could read as comparable. CAP-048 §5 makes the point
//      about capacity engines specifically; it applies to the whole bar.
//
//   2. `unavailable` IS NOT ZERO. A KPI whose source could not be read shows
//      the explicit not-available text and its reason. Rendering 0 would state
//      "there are no blocked days" when the truth is "we could not tell".
//
// Clicking a KPI does not navigate. It applies `kpiIntent` — changes the lens,
// selects nodes, opens a panel — because the point of a portfolio dashboard is
// that the answer stays on the same screen as the question.
// ============================================================================

import { useTranslations } from "next-intl";
import { HelpCircle } from "lucide-react";
import type { PmoKpi } from "@/lib/pmo-intelligence/dashboard-model";
import type { PmoKpiKey } from "@/lib/pmo-intelligence/kpi-bindings";

export interface PmoKpiBarProps {
  kpis: readonly PmoKpi[];
  locale: "en" | "es";
  activeKpi: PmoKpiKey | null;
  onKpiClick: (key: PmoKpiKey) => void;
}

/**
 * Format a value in its own unit.
 *
 * Deliberately explicit rather than a shared number formatter: the whole point
 * is that these four cases look different on screen.
 */
function formatValue(
  value: number,
  unit: PmoKpi["unit"],
  locale: "en" | "es",
  daysLabel: string,
): string {
  const intl = locale === "es" ? "es-ES" : "en-US";
  switch (unit) {
    case "percent":
      // Sign is kept: a negative budget variance is a different fact from a
      // positive one and dropping the sign inverts the reading.
      return `${value > 0 ? "+" : ""}${value.toLocaleString(intl, { maximumFractionDigits: 1 })}%`;
    case "days":
      return `${value.toLocaleString(intl, { maximumFractionDigits: 1 })} ${daysLabel}`;
    case "score":
      // Out of 100, stated. A bare "72" next to a count of 72 projects would
      // read as the same kind of number.
      return `${Math.round(value)}/100`;
    case "count":
    default:
      return value.toLocaleString(intl, { maximumFractionDigits: 0 });
  }
}

const UNIT_ACCENT: Record<PmoKpi["unit"], string> = {
  score: "text-emerald-700",
  count: "text-slate-900",
  days: "text-amber-700",
  percent: "text-sky-700",
};

export function PmoKpiBar({ kpis, locale, activeKpi, onKpiClick }: PmoKpiBarProps) {
  const t = useTranslations("pmoIntelligence");

  return (
    // `items-stretch` makes every card as tall as the tallest in its row, and
    // the card itself is `h-full`, so the borders line up even when one KPI has
    // a two-word label and its neighbour has none.
    <ul
      aria-label={t("kpiBarLabel")}
      className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4 xl:grid-cols-8"
    >
      {kpis.map((kpi) => {
        const isActive = activeKpi === kpi.key;
        // Destructured so TypeScript narrows the discriminated union below —
        // a boolean flag would not, and the `reason` branch is the one that
        // must never be reachable with a fabricated 0.
        const metric = kpi.value;
        return (
          <li key={kpi.key} className="flex">
            <button
              type="button"
              onClick={() => onKpiClick(kpi.key)}
              aria-pressed={isActive}
              title={t("kpiSource", { source: kpi.source })}
              className={`flex h-full w-full flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-colors ${
                isActive
                  ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {/*
                Three rows, always all three, in every card. The reported defect
                was that values sat at different heights across the bar because
                cards with no subtitle were shorter and labels wrapped to two
                lines at some widths. Fixing it needs the STRUCTURE to be
                identical, not just the styling: a fixed one-line label, a value
                row that grows to absorb the slack, and a subtitle row that
                reserves its space even when empty.
              */}
              {/*
                Stays one line at every width — PMO-IC-KPI-ALIGNMENT. Labels
                like "Shared Resources" were clipping on a phone only because
                the shell still reserved 64px for a sidebar rail there
                (REG-040); with that gutter gone the card is wide enough, and
                wrapping to two lines would reintroduce the ragged rows this
                guard exists to prevent. The tooltip carries the full string.
              */}
              <span
                className="line-clamp-1 h-4 w-full text-[10px] font-bold uppercase leading-4 tracking-wide text-slate-500"
                title={t(`kpi_${kpi.key}`)}
              >
                {t(`kpi_${kpi.key}`)}
              </span>

              {/*
                `flex-1` + `items-end` is what actually aligns the numbers: the
                value row absorbs whatever height difference remains and pins its
                content to the same baseline in every card.
              */}
              <span className="flex w-full flex-1 items-end">
                {metric.state === "ok" ? (
                  <span
                    className={`line-clamp-1 text-lg font-extrabold leading-6 ${UNIT_ACCENT[kpi.unit]}`}
                  >
                    {formatValue(metric.value, kpi.unit, locale, t("unitDays"))}
                  </span>
                ) : (
                  // Never 0. The reason is carried in the title so a PMO can
                  // tell a broken source from an empty portfolio.
                  <span
                    className="flex items-center gap-1 text-xs font-bold leading-6 text-slate-400"
                    title={t("kpiUnavailableReason", { reason: metric.reason })}
                  >
                    <HelpCircle className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="line-clamp-1">{t("kpiUnavailable")}</span>
                  </span>
                )}
              </span>

              {/*
                Rendered even with no subtitle. A conditional row is what made
                the cards different heights in the first place; `&nbsp;` holds
                the line so the reserved space is real. Truncated to ONE line so
                a long helper string cannot push the row out of alignment — the
                full text stays available in the tooltip.
              */}
              <span
                className="line-clamp-1 h-4 w-full text-[10px] leading-4 text-slate-500"
                title={kpi.subtitle ?? undefined}
              >
                {kpi.subtitle ? kpi.subtitle : " "}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
