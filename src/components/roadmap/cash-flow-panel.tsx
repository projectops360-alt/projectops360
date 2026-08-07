"use client";

// ============================================================================
// The cash-flow curve, under the schedule that causes it
// ============================================================================
// Sits beneath the Gantt on purpose. The schedule and the cash are the same
// fact seen twice: drag a task three months right and the money moves with it,
// and the two views next to each other make that consequence visible instead of
// something you work out later in a spreadsheet.
//
// Drawn with plain divs rather than a charting library — bars and a cumulative
// line are not worth 40kB of dependency, and this way the empty and partial
// states are ours to control.
// ============================================================================

import { useMemo } from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { monthlyCashFlow, type CashFlowTask } from "@/lib/roadmap/cash-flow";
import type { Locale } from "@/types/database";

export interface CashFlowPanelProps {
  tasks: CashFlowTask[];
  /** resource id → hourly rate. Without it there is no money to plot. */
  rateByResource: Record<string, number>;
  currency: string;
  locale: Locale;
}

const COPY = {
  en: {
    title: "Monthly cash flow",
    subtitle: "What the plan spends, month by month",
    planned: "Current plan",
    baseline: "Original plan",
    actual: "Spent",
    cumulative: "Cumulative",
    peak: "Heaviest month",
    noRates: "No resource has an hourly rate yet, so there is no cost to spread across months.",
    noDates: "No task has dates, so there is nothing to place on a calendar.",
    partial: (n: number) => `${n} task${n === 1 ? "" : "s"} left out — no rate or no dates.`,
    total: "Total planned",
  },
  es: {
    title: "Flujo de caja mensual",
    subtitle: "Lo que el plan gasta, mes a mes",
    planned: "Plan actual",
    baseline: "Plan inicial",
    actual: "Gastado",
    cumulative: "Acumulado",
    peak: "Mes más cargado",
    noRates: "Ningún recurso tiene tarifa por hora todavía, así que no hay coste que repartir por meses.",
    noDates: "Ninguna tarea tiene fechas, así que no hay nada que situar en un calendario.",
    partial: (n: number) => `${n} tarea${n === 1 ? "" : "s"} fuera del cálculo: sin tarifa o sin fechas.`,
    total: "Total planificado",
  },
} as const;

function money(value: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0,
  }).format(value);
}

function monthLabel(key: string, locale: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function CashFlowPanel({ tasks, rateByResource, currency, locale }: CashFlowPanelProps) {
  const isEs = locale === "es";
  const t = COPY[isEs ? "es" : "en"];
  const intlLocale = isEs ? "es-ES" : "en-US";

  const result = useMemo(
    () => monthlyCashFlow(tasks, new Map(Object.entries(rateByResource))),
    [tasks, rateByResource],
  );

  // An empty state that says WHICH thing is missing. "No data" would leave the
  // user guessing between two different fixes.
  if (result.months.length === 0) {
    const reason = result.skippedUnpriced > 0 ? t.noRates : t.noDates;
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" aria-hidden />
        <p className="text-sm font-medium text-foreground">{t.title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{reason}</p>
      </div>
    );
  }

  const peak = Math.max(
    1,
    ...result.months.map((m) => Math.max(m.planned, m.baseline, m.actual)),
  );
  const totalPlanned = result.months[result.months.length - 1]?.cumulativePlanned ?? 0;
  const maxCumulative = Math.max(
    1,
    ...result.months.map((m) => Math.max(m.cumulativePlanned, m.cumulativeBaseline)),
  );
  const skipped = result.skippedUnpriced + result.skippedUndated;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="h-2 w-2 rounded-sm bg-brand-500" aria-hidden />
            {t.planned}
          </span>
          {result.hasBaseline && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-sm border border-dashed border-slate-400 bg-slate-300/60" aria-hidden />
              {t.baseline}
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" aria-hidden />
            {t.actual}
          </span>
        </div>
      </div>

      {/* Bars. Cumulative is drawn as a faint band behind them so the running
          total is legible without a second axis nobody reads. */}
      <div className="overflow-x-auto">
        <div className="flex min-w-full items-end gap-1" style={{ height: 140 }}>
          {result.months.map((m) => {
            const cumulativeHeight = (m.cumulativePlanned / maxCumulative) * 100;
            return (
              <div
                key={m.month}
                className="relative flex min-w-[34px] flex-1 flex-col justify-end"
                style={{ height: "100%" }}
                title={`${monthLabel(m.month, intlLocale)} · ${t.planned}: ${money(m.planned, intlLocale, currency)} · ${t.cumulative}: ${money(m.cumulativePlanned, intlLocale, currency)}`}
              >
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t bg-brand-500/10"
                  style={{ height: `${cumulativeHeight}%` }}
                  aria-hidden
                />
                <div className="relative flex items-end justify-center gap-[2px]" style={{ height: "100%" }}>
                  {result.hasBaseline && (
                    <div
                      className="w-1/3 rounded-t border border-dashed border-slate-400/70 bg-slate-300/50 dark:border-slate-500/70 dark:bg-slate-600/40"
                      style={{ height: `${(m.baseline / peak) * 100}%` }}
                    />
                  )}
                  <div
                    className="w-1/3 rounded-t bg-brand-500"
                    style={{ height: `${(m.planned / peak) * 100}%` }}
                  />
                  <div
                    className="w-1/3 rounded-t bg-emerald-500"
                    style={{ height: `${(m.actual / peak) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex min-w-full gap-1">
          {result.months.map((m) => (
            <div
              key={m.month}
              className="min-w-[34px] flex-1 truncate text-center text-[9px] text-muted-foreground"
            >
              {monthLabel(m.month, intlLocale)}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px]">
        <span className="text-muted-foreground">
          {t.total}:{" "}
          <span className="font-mono font-semibold text-foreground">
            {money(totalPlanned, intlLocale, currency)}
          </span>
        </span>
        {result.peakMonth && (
          <span className="text-muted-foreground">
            {t.peak}:{" "}
            <span className="font-semibold text-foreground">
              {monthLabel(result.peakMonth, intlLocale)}
            </span>{" "}
            <span className="font-mono">{money(result.peakAmount, intlLocale, currency)}</span>
          </span>
        )}
      </div>

      {/* A curve missing a third of the work must say so, or it reads as the
          whole picture. */}
      {skipped > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          {t.partial(skipped)}
        </p>
      )}
    </div>
  );
}
