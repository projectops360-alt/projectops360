"use client";

// ============================================================================
// Pin your own KPIs to the milestone cards
// ============================================================================
// The cost rollup can answer far more than fits on a 260px card, and which
// answers matter depends entirely on who is looking: budget, effort, duration,
// open scope. Rather than picking for everyone, the cards show whatever is
// ticked here.
//
// The choice is per project and per browser (the saved-layout precedent,
// UX-007/PD-008): a view preference, not project data, so it never needs a
// migration, never syncs, and never affects what anyone else sees.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { BarChart3, ChevronDown, X } from "lucide-react";
import {
  MILESTONE_CARD_METRICS,
  MAX_MILESTONE_CARD_METRICS,
  type MilestoneMetricGroup,
} from "@/lib/graph/milestone-card-metrics";
import type { Locale } from "@/types/database";

export interface MilestoneMetricsPickerProps {
  locale: Locale;
  /** Currently pinned metric ids, in the order they appear on the card. */
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

const COPY = {
  en: {
    button: "Card KPIs",
    title: "Show on each milestone card",
    hint: `Up to ${MAX_MILESTONE_CARD_METRICS}. A metric with no data shows “—”.`,
    clear: "Clear",
    none: "None pinned",
    groups: { effort: "Effort", time: "Time", money: "Money", scope: "Scope" },
  },
  es: {
    button: "KPIs de tarjeta",
    title: "Mostrar en cada tarjeta de hito",
    hint: `Hasta ${MAX_MILESTONE_CARD_METRICS}. Una métrica sin datos muestra «—».`,
    clear: "Quitar todos",
    none: "Ninguno fijado",
    groups: { effort: "Esfuerzo", time: "Tiempo", money: "Dinero", scope: "Alcance" },
  },
} as const;

const GROUP_ORDER: MilestoneMetricGroup[] = ["money", "effort", "time", "scope"];

export function MilestoneMetricsPicker({
  locale,
  selected,
  onToggle,
  onClear,
}: MilestoneMetricsPickerProps) {
  const isEs = locale === "es";
  const t = COPY[isEs ? "es" : "en"];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const atCap = selected.length >= MAX_MILESTONE_CARD_METRICS;

  return (
    <div ref={rootRef} className="absolute right-3 top-3 z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={t.title}
        className={
          "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-xs font-medium shadow-md backdrop-blur transition-colors hover:bg-muted " +
          (selected.length > 0 ? "text-brand-700 dark:text-brand-300" : "text-foreground")
        }
      >
        <BarChart3 className="h-3.5 w-3.5" aria-hidden />
        {t.button}
        {selected.length > 0 && (
          <span className="rounded bg-brand-500/15 px-1 font-mono text-[10px] tabular-nums">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </button>

      {open && (
        <div
          role="group"
          aria-label={t.title}
          className="absolute right-0 mt-1.5 w-72 rounded-lg border border-border bg-card p-3 shadow-xl"
        >
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">{t.title}</p>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
                {t.clear}
              </button>
            )}
          </div>
          <p className="mb-2.5 text-[10px] leading-snug text-muted-foreground">{t.hint}</p>

          <div className="max-h-[52vh] space-y-2.5 overflow-y-auto pr-1">
            {GROUP_ORDER.map((group) => {
              const metrics = MILESTONE_CARD_METRICS.filter((m) => m.group === group);
              if (metrics.length === 0) return null;
              return (
                <div key={group}>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.groups[group]}
                  </p>
                  <ul className="space-y-0.5">
                    {metrics.map((m) => {
                      const isOn = selected.includes(m.id);
                      return (
                        <li key={m.id}>
                          <label
                            className={
                              "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] transition-colors hover:bg-muted " +
                              // At the cap, an unticked metric still works — it
                              // replaces the oldest — but it is dimmed so the
                              // swap is not a surprise.
                              (atCap && !isOn ? "text-muted-foreground" : "text-foreground")
                            }
                          >
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={() => onToggle(m.id)}
                              className="h-3.5 w-3.5 rounded border-border accent-brand-500"
                            />
                            <span className="flex-1">{isEs ? m.es : m.en}</span>
                            {isOn && (
                              <span className="font-mono text-[9px] uppercase text-muted-foreground">
                                {isEs ? m.esShort : m.enShort}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
