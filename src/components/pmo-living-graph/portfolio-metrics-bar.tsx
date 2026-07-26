"use client";

// ============================================================================
// PMO Portfolio Living Graph — metrics bar (CAP-048 §6)
// ============================================================================
// The rule this component exists to enforce: a MetricValue in the
// `unavailable` state renders the `dataUnavailable` text, NEVER a zero.
//
// A zero is a claim. Telling a PMO there are zero blocked days when the event
// history simply could not be read is the single most damaging thing this
// screen can do, so the unavailable branch is the default-safe path here.
// ============================================================================

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import type {
  MetricValue,
  PortfolioMetrics,
} from "@/lib/pmo-living-graph/portfolio-metrics";

/** Metrics whose non-zero value is bad news; rendered in the alert palette. */
const ALERT_METRICS = new Set<keyof PortfolioMetrics>([
  "projectsAtRisk",
  "blockedDays",
  "overallocatedResources",
]);

const ORDER: (keyof PortfolioMetrics)[] = [
  "totalProjects",
  "projectsAtRisk",
  "riskExposureAmount",
  "blockedDays",
  "crossProjectDependencies",
  "sharedResources",
  "overallocatedResources",
  "criticalNodes",
  "pendingDecisions",
  "orphanNodes",
];

const LABEL_KEY: Record<keyof PortfolioMetrics, string> = {
  totalProjects: "metricTotalProjects",
  projectsAtRisk: "metricProjectsAtRisk",
  riskExposureAmount: "metricRiskExposure",
  blockedDays: "metricBlockedDays",
  crossProjectDependencies: "metricCrossProject",
  sharedResources: "metricSharedResources",
  overallocatedResources: "metricOverallocated",
  criticalNodes: "metricCriticalNodes",
  pendingDecisions: "metricPendingDecisions",
  orphanNodes: "metricOrphanNodes",
};

/** Money is formatted as currency; everything else as a plain count. */
const CURRENCY_METRICS = new Set<keyof PortfolioMetrics>(["riskExposureAmount"]);

export function PortfolioMetricsBar({
  metrics,
  locale,
}: {
  metrics: PortfolioMetrics;
  locale: "en" | "es";
}) {
  const t = useTranslations("pmoLivingGraph");

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {ORDER.map((key) => (
        <MetricCard
          key={key}
          label={t(LABEL_KEY[key])}
          value={metrics[key]}
          unavailableLabel={t("dataUnavailable")}
          alert={ALERT_METRICS.has(key)}
          currency={CURRENCY_METRICS.has(key)}
          locale={locale}
        />
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unavailableLabel,
  alert,
  currency,
  locale,
}: {
  label: string;
  value: MetricValue;
  unavailableLabel: string;
  alert: boolean;
  currency: boolean;
  locale: "en" | "es";
}) {
  if (value.state === "unavailable") {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500"
          // The reason comes from the engine and names the missing source, so a
          // PMO can act on it instead of guessing.
          title={value.reason}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{unavailableLabel}</span>
        </p>
      </div>
    );
  }

  const formatted = currency
    ? new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value.value)
    : new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-US").format(value.value);

  const emphasise = alert && value.value > 0;

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        emphasise ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-lg font-extrabold tabular-nums ${
          emphasise ? "text-rose-700" : "text-slate-900"
        }`}
      >
        {formatted}
      </p>
    </div>
  );
}
