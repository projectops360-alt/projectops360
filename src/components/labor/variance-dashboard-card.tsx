"use client";

// ============================================================================
// ProjectOps360° — Productivity Variance Dashboard Card
// ============================================================================
// Compact dashboard card showing project-level variance KPIs, activities at
// risk list, and overall schedule risk. Follows the SummaryCard pattern from
// labor-capacity-client.tsx but richer — includes metric chips and a compact
// risk list.
// ============================================================================

import { useMemo } from "react";
import {
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Users,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LaborVarianceResult } from "@/lib/labor/labor-variance";
import { VARIANCE_SEVERITY_STYLES, VARIANCE_SEVERITY_LABELS } from "@/lib/labor/labor-variance";
import type { ProductivityVarianceResult } from "@/lib/labor/productivity-variance";
import { SCHEDULE_RISK_STYLES, SCHEDULE_RISK_LABELS } from "@/lib/labor/productivity-variance";
import { VARIANCE_CAUSE_LABELS } from "@/lib/labor/variance-cause-classification";
import type { VarianceCauseResult } from "@/lib/labor/variance-cause-classification";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────────────

interface VarianceDashboardCardProps {
  laborVariance: LaborVarianceResult;
  varianceResult: ProductivityVarianceResult;
  causeResults: VarianceCauseResult[];
  locale: string;
}

// ── Severity color helper ─────────────────────────────────────────────────────

function severityColor(severity: string): string {
  const s = severity as keyof typeof VARIANCE_SEVERITY_STYLES;
  if (s in VARIANCE_SEVERITY_STYLES) return VARIANCE_SEVERITY_STYLES[s].text;
  return "text-muted-foreground";
}

function severityBg(severity: string): string {
  const s = severity as keyof typeof VARIANCE_SEVERITY_STYLES;
  if (s in VARIANCE_SEVERITY_STYLES) return VARIANCE_SEVERITY_STYLES[s].bg;
  return "bg-muted";
}

// ── Component ────────────────────────────────────────────────────────────────

export function VarianceDashboardCard({
  laborVariance,
  varianceResult,
  causeResults,
  locale,
}: VarianceDashboardCardProps) {
  const { summary } = laborVariance;
  const { scheduleRisks, byTrade, overallScheduleRisk, activitiesAtRisk } = varianceResult;

  const riskActivities = useMemo(
    () => scheduleRisks.filter((r) => r.riskLevel !== "none").slice(0, 3),
    [scheduleRisks]
  );

  const worstTrade = byTrade.length > 0 ? byTrade[0] : null;

  // Resolve labels
  const overallRiskLabel = getI18nValue(SCHEDULE_RISK_LABELS[overallScheduleRisk], locale as Locale);
  const overallSeverityLabel = getI18nValue(VARIANCE_SEVERITY_LABELS[summary.worstVarianceSeverity], locale as Locale);

  return (
    <div className="space-y-4">
      {/* KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Overall Variance */}
        <MetricChip
          icon={TrendingUp}
          label={locale === "en" ? "Overall Variance" : "Varianza General"}
          value={summary.overallVariancePct !== null ? `${summary.overallVariancePct}%` : "—"}
          color={severityColor(summary.worstVarianceSeverity)}
          bgColor={severityBg(summary.worstVarianceSeverity)}
        />

        {/* Activities at Risk */}
        <MetricChip
          icon={AlertTriangle}
          label={locale === "en" ? "At Risk" : "En Riesgo"}
          value={String(activitiesAtRisk)}
          color="text-orange-600 dark:text-orange-400"
          bgColor="bg-orange-500/5"
        />

        {/* Schedule Risk */}
        <MetricChip
          icon={ShieldAlert}
          label={locale === "en" ? "Schedule Risk" : "Riesgo Cronograma"}
          value={overallRiskLabel ?? overallScheduleRisk}
          color={SCHEDULE_RISK_STYLES[overallScheduleRisk].text}
          bgColor={SCHEDULE_RISK_STYLES[overallScheduleRisk].bg}
        />

        {/* Worst Trade */}
        <MetricChip
          icon={Users}
          label={locale === "en" ? "Worst Trade" : "Peor Oficio"}
          value={worstTrade ? getI18nValue(worstTrade.tradeLabel, locale as Locale) ?? worstTrade.tradeKey : "—"}
          color={worstTrade && worstTrade.worstVarianceSeverity ? severityColor(worstTrade.worstVarianceSeverity) : "text-muted-foreground"}
          bgColor={worstTrade && worstTrade.worstVarianceSeverity ? severityBg(worstTrade.worstVarianceSeverity) : "bg-muted"}
        />

        {/* Rework */}
        <MetricChip
          icon={RefreshCw}
          label={locale === "en" ? "Rework" : "Retrabajo"}
          value={String(summary.reworkCount)}
          color={summary.reworkCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}
          bgColor={summary.reworkCount > 0 ? "bg-amber-500/5" : "bg-emerald-500/5"}
        />
      </div>

      {/* Activities at Risk List (compact, max 3) */}
      {riskActivities.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {locale === "en" ? "Top Activities at Risk" : "Actividades en Riesgo Principal"}
          </h3>
          <div className="space-y-1.5">
            {riskActivities.map((risk) => {
              const cause = causeResults.find((c) => c.activityKey === risk.activityKey);
              const causeLabel = cause
                ? getI18nValue(VARIANCE_CAUSE_LABELS[cause.likelyCause.cause as keyof typeof VARIANCE_CAUSE_LABELS], locale as Locale)
                : null;
              const metrics = laborVariance.activities.find((a) => a.activityKey === risk.activityKey);
              const riskStyles = SCHEDULE_RISK_STYLES[risk.riskLevel];

              return (
                <div key={risk.activityKey} className="flex items-center gap-2 text-[11px]">
                  <ChevronRight className={cn("h-3 w-3 shrink-0", riskStyles.text)} />
                  <span className="font-medium text-foreground truncate">
                    {metrics?.activityName ?? risk.activityKey}
                  </span>
                  {metrics?.variancePct !== null && metrics?.variancePct !== undefined && (
                    <span className={cn("tabular-nums", severityColor(metrics.varianceSeverity ?? "on_track"))}>
                      {metrics.variancePct}%
                    </span>
                  )}
                  {causeLabel && (
                    <span className="text-muted-foreground truncate">
                      · {causeLabel}
                    </span>
                  )}
                  <span className={cn("ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium", riskStyles.bg, riskStyles.text, riskStyles.border, "border")}>
                    {getI18nValue(SCHEDULE_RISK_LABELS[risk.riskLevel], locale as Locale)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MetricChip sub-component ────────────────────────────────────────────────

interface MetricChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}

function MetricChip({ icon: Icon, label, value, color, bgColor }: MetricChipProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 flex flex-col gap-1.5", bgColor)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-4 w-4 shrink-0", color)} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <p className={cn("text-xl font-bold tabular-nums", color)}>
        {value}
      </p>
    </div>
  );
}