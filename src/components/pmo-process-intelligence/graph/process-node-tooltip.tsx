"use client";

import { useEffect, useRef, useState } from "react";
import type { ProcessGraphEntity } from "@/lib/pmo-process-intelligence/process-graph.types";

/**
 * Delay before the hover card appears. Long enough that simply crossing the
 * canvas with the pointer never pops cards open, short enough to feel immediate
 * when the user actually rests on a node.
 */
export const HOVER_OPEN_DELAY_MS = 450;

function money(value: number | null | undefined): string {
  if (value == null) return "—";
  const absolute = Math.abs(value);
  const compact =
    absolute >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : absolute >= 1_000
        ? `${(value / 1_000).toFixed(1)}K`
        : Math.round(value).toString();
  return `$${compact}`;
}

function duration(value: number | null | undefined): string {
  if (value == null) return "—";
  const hours = value / 3_600_000;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

interface Stat {
  label: string;
  value: string | number | null | undefined;
}

/**
 * Only the headline signals live in the hover card. The exhaustive metric table
 * belongs to the detail drawer (click), which the user can dismiss on purpose.
 */
function summaryStats(
  entity: ProcessGraphEntity,
  es: boolean,
): Stat[] {
  const metrics = entity.metrics;
  if (entity.kind === "stage") {
    return [
      { label: es ? "Activos" : "Active", value: metrics.activeProjectCount },
      { label: "Cycle time", value: duration(metrics.cycleTimeMs) },
      { label: es ? "Fuera de SLA" : "Outside SLA", value: metrics.outsideSlaProjectCount },
      { label: es ? "Riesgos" : "Risks", value: metrics.criticalRisks },
    ];
  }
  if (entity.kind === "project") {
    return [
      { label: "Health", value: metrics.healthScore == null ? "—" : `${metrics.healthScore}/100` },
      { label: es ? "Avance" : "Progress", value: metrics.progressPercent == null ? "—" : `${metrics.progressPercent}%` },
      { label: "EAC", value: money(metrics.eac) },
      { label: es ? "Riesgos" : "Risks", value: metrics.criticalRisks },
    ];
  }
  return [
    { label: es ? "Avance" : "Progress", value: metrics.progressPercent == null ? "—" : `${metrics.progressPercent}%` },
    { label: es ? "Estado" : "Status", value: entity.status.replaceAll("_", " ") },
  ];
}

export function ProcessNodeTooltip({
  entity,
  locale,
  active,
}: {
  entity: ProcessGraphEntity;
  locale: "en" | "es";
  active: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(false);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setVisible(true);
      timerRef.current = null;
    }, HOVER_OPEN_DELAY_MS);
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active]);

  if (!visible) return null;

  const es = locale === "es";
  const stats = summaryStats(entity, es);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-60 -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 p-2.5 text-left shadow-lg backdrop-blur-sm"
    >
      <p className="truncate text-[11px] font-bold text-slate-950">
        {entity.label}
      </p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-baseline justify-between gap-2">
            <dt className="truncate text-slate-500">{stat.label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-slate-900">
              {stat.value == null ? "—" : stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[9px] text-slate-400">
        {es ? "Click para ver el detalle completo" : "Click to open full detail"}
      </p>
    </div>
  );
}
