"use client";

// ============================================================================
// ProjectOps360° — Variance Activity Detail
// ============================================================================
// Collapsible detail panel for a single activity showing variance metrics,
// trend, schedule risk, likely cause, and contributing factors.
// Follows the pattern of ReadinessDetailBlock and LaborRiskDetailBlock.
// ============================================================================

import {
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  AlertTriangle,
  Shield,
  RefreshCw,
  Users,
  Gauge,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityVarianceMetrics } from "@/lib/labor/labor-variance";
import { VARIANCE_SEVERITY_STYLES, VARIANCE_SEVERITY_LABELS, PRODUCTIVITY_LABELS } from "@/lib/labor/labor-variance";
import type { VarianceTrend, ActivityScheduleRisk } from "@/lib/labor/productivity-variance";
import { SCHEDULE_RISK_STYLES, SCHEDULE_RISK_LABELS, VARIANCE_TREND_LABELS } from "@/lib/labor/productivity-variance";
import type { VarianceCauseResult } from "@/lib/labor/variance-cause-classification";
import { VARIANCE_CAUSE_LABELS, VARIANCE_CAUSE_ICONS, VARIANCE_CAUSE_COLORS, CONFIDENCE_LEVELS } from "@/lib/labor/variance-cause-classification";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import type { VarianceSeverity } from "@/lib/labor/labor-variance";

// ── Types ────────────────────────────────────────────────────────────────────

interface VarianceActivityDetailProps {
  metrics: ActivityVarianceMetrics;
  trend: VarianceTrend | undefined;
  scheduleRisk: ActivityScheduleRisk | undefined;
  causeResult: VarianceCauseResult | undefined;
  locale: string;
}

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<VarianceSeverity, string> = {
  on_track: "text-emerald-600 dark:text-emerald-400",
  minor: "text-amber-600 dark:text-amber-400",
  major: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

const TREND_ICONS: Record<string, React.ReactNode> = {
  improving: <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />,
  worsening: <TrendingDown className="h-3.5 w-3.5 text-red-500" />,
  stable: <Minus className="h-3.5 w-3.5 text-gray-500" />,
  insufficient_data: <HelpCircle className="h-3.5 w-3.5 text-gray-400" />,
};

const PRODUCTIVITY_ICONS: Record<string, React.ReactNode> = {
  exceeds_plan: <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />,
  on_target: <Gauge className="h-3.5 w-3.5 text-blue-500" />,
  below_plan: <TrendingDown className="h-3.5 w-3.5 text-amber-500" />,
  stalled: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  not_measured: <HelpCircle className="h-3.5 w-3.5 text-gray-400" />,
};

// ── Component ────────────────────────────────────────────────────────────────

export function VarianceActivityDetail({
  metrics,
  trend,
  scheduleRisk,
  causeResult,
  locale,
}: VarianceActivityDetailProps) {
  const loc = locale as Locale;

  if (!metrics.isTracked) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground text-center">
          {locale === "en"
            ? "No tracking data available for this activity."
            : "Sin datos de seguimiento disponibles para esta actividad."}
        </p>
      </div>
    );
  }

  const severity = metrics.varianceSeverity ?? "on_track";
  const severityLabel = getI18nValue(VARIANCE_SEVERITY_LABELS[severity], loc);
  const productivityLabel = getI18nValue(PRODUCTIVITY_LABELS[metrics.productivityAssessment], loc);
  const riskLabel = scheduleRisk ? getI18nValue(SCHEDULE_RISK_LABELS[scheduleRisk.riskLevel], loc) : null;
  const trendLabel = trend ? getI18nValue(VARIANCE_TREND_LABELS[trend.direction], loc) : null;

  return (
    <div className="space-y-3">
      {/* ── Variance Metrics Section ── */}
      <div className={`rounded-md border ${VARIANCE_SEVERITY_STYLES[severity].border} ${VARIANCE_SEVERITY_STYLES[severity].bg} p-3 space-y-2`}>
        <h4 className={`flex items-center gap-1.5 text-xs font-semibold ${SEVERITY_COLORS[severity]}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {locale === "en" ? "Variance Metrics" : "Métricas de Varianza"}
        </h4>
        <dl className="divide-y divide-border/60 px-1">
          <DetailField label={locale === "en" ? "Estimated" : "Estimado"} value={`${metrics.estimatedHours}h`} />
          <DetailField label={locale === "en" ? "Actual" : "Real"} value={metrics.actualHours !== null ? `${metrics.actualHours}h` : "—"} />
          <DetailField
            label={locale === "en" ? "Variance" : "Varianza"}
            value={
              metrics.variancePct !== null
                ? `${metrics.hoursVariance !== null ? (metrics.hoursVariance > 0 ? "+" : "") + metrics.hoursVariance + "h" : ""} (${metrics.variancePct > 0 ? "+" : ""}${metrics.variancePct}%)`
                : "—"
            }
            valueClassName={SEVERITY_COLORS[severity]}
          />
          <DetailField
            label={locale === "en" ? "Severity" : "Severidad"}
            value={severityLabel ?? severity}
            valueClassName={SEVERITY_COLORS[severity]}
          />
          <DetailField
            label={locale === "en" ? "Production Rate" : "Tasa de Producción"}
            value={
              <span className="flex items-center gap-1">
                {PRODUCTIVITY_ICONS[metrics.productivityAssessment] ?? <HelpCircle className="h-3 w-3" />}
                {productivityLabel ?? metrics.productivityAssessment}
                {metrics.productionRateRatio !== null && (
                  <span className="text-muted-foreground tabular-nums">
                    ({metrics.productionRateRatio.toFixed(2)}x)
                  </span>
                )}
              </span>
            }
          />
          <DetailField
            label={locale === "en" ? "Crew" : "Cuadrilla"}
            value={
              metrics.crewRatio !== null
                ? `${metrics.actualCrewSize ?? "?"}/${metrics.plannedCrewCount} (${metrics.crewRatio.toFixed(2)}x)`
                : `${metrics.plannedCrewCount}`
            }
          />
          {metrics.reworkCount > 0 && (
            <DetailField
              label={locale === "en" ? "Rework" : "Retrabajo"}
              value={`${metrics.reworkCount} cycle${metrics.reworkCount > 1 ? "s" : ""}`}
              valueClassName="text-amber-600 dark:text-amber-400"
            />
          )}
        </dl>
      </div>

      {/* ── Trend Section ── */}
      {trend && trend.direction !== "insufficient_data" && (
        <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            {locale === "en" ? "Trend" : "Tendencia"}
          </h4>
          <dl className="divide-y divide-border/60 px-1">
            <DetailField
              label={locale === "en" ? "Direction" : "Dirección"}
              value={
                <span className="flex items-center gap-1">
                  {TREND_ICONS[trend.direction] ?? <HelpCircle className="h-3 w-3" />}
                  {trendLabel ?? trend.direction}
                </span>
              }
            />
            {trend.tradeAvgVariancePct !== null && (
              <DetailField
                label={locale === "en" ? "Trade Avg" : "Promedio Oficio"}
                value={`${trend.tradeAvgVariancePct}%`}
              />
            )}
            {trend.deviationFromTradeAvg !== null && (
              <DetailField
                label={locale === "en" ? "Deviation" : "Desviación"}
                value={`${trend.deviationFromTradeAvg > 0 ? "+" : ""}${trend.deviationFromTradeAvg}pp`}
                valueClassName={trend.deviationFromTradeAvg > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
              />
            )}
          </dl>
        </div>
      )}

      {/* ── Schedule Risk Section ── */}
      {scheduleRisk && scheduleRisk.riskLevel !== "none" && (
        <div className={`rounded-md border ${SCHEDULE_RISK_STYLES[scheduleRisk.riskLevel].border} ${SCHEDULE_RISK_STYLES[scheduleRisk.riskLevel].bg} p-3 space-y-2`}>
          <h4 className={`flex items-center gap-1.5 text-xs font-semibold ${SCHEDULE_RISK_STYLES[scheduleRisk.riskLevel].text}`}>
            <Shield className="h-3.5 w-3.5" />
            {locale === "en" ? "Schedule Risk" : "Riesgo de Cronograma"}
          </h4>
          <dl className="divide-y divide-border/60 px-1">
            <DetailField
              label={locale === "en" ? "Level" : "Nivel"}
              value={riskLabel ?? scheduleRisk.riskLevel}
              valueClassName={SCHEDULE_RISK_STYLES[scheduleRisk.riskLevel].text}
            />
            <DetailField label={locale === "en" ? "Score" : "Puntuación"} value={`${scheduleRisk.riskScore}/100`} />
            {scheduleRisk.riskFactors.length > 0 && (
              <div className="pt-1">
                <dt className="text-[11px] text-muted-foreground">{locale === "en" ? "Factors" : "Factores"}</dt>
                <dd className="mt-0.5 space-y-0.5">
                  {scheduleRisk.riskFactors.map((f, i) => (
                    <div key={i} className="text-[10px] text-foreground/80">
                      <span className="font-medium">{getI18nValue(f.description, loc)}</span>
                      <span className="text-muted-foreground ml-1">(+{f.weight})</span>
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Likely Cause Section ── */}
      {causeResult && causeResult.likelyCause.cause !== "unclassified" && (
        <div className="rounded-md border border-border bg-card p-3 space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Package className="h-3.5 w-3.5" />
            {locale === "en" ? "Likely Cause" : "Causa Probable"}
          </h4>
          <dl className="divide-y divide-border/60 px-1">
            <DetailField
              label={locale === "en" ? "Cause" : "Causa"}
              value={
                <span className={cn("flex items-center gap-1", VARIANCE_CAUSE_COLORS[causeResult.likelyCause.cause as keyof typeof VARIANCE_CAUSE_COLORS]?.text)}>
                  <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                    VARIANCE_CAUSE_COLORS[causeResult.likelyCause.cause as keyof typeof VARIANCE_CAUSE_COLORS]?.bg,
                    VARIANCE_CAUSE_COLORS[causeResult.likelyCause.cause as keyof typeof VARIANCE_CAUSE_COLORS]?.text,
                    VARIANCE_CAUSE_COLORS[causeResult.likelyCause.cause as keyof typeof VARIANCE_CAUSE_COLORS]?.border
                  )}>
                    {getI18nValue(VARIANCE_CAUSE_LABELS[causeResult.likelyCause.cause as keyof typeof VARIANCE_CAUSE_LABELS], loc) ?? causeResult.likelyCause.cause}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round(causeResult.likelyCause.confidence * 100)}%
                  </span>
                </span>
              }
            />
            <DetailField
              label={locale === "en" ? "Confidence" : "Confianza"}
              value={
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        causeResult.likelyCause.confidence >= 0.7
                          ? "bg-emerald-500"
                          : causeResult.likelyCause.confidence >= 0.4
                            ? "bg-amber-500"
                            : "bg-gray-400"
                      )}
                      style={{ width: `${causeResult.likelyCause.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {causeResult.likelyCause.confidence >= 0.7
                      ? (locale === "en" ? "High" : "Alta")
                      : causeResult.likelyCause.confidence >= 0.4
                        ? (locale === "en" ? "Moderate" : "Moderada")
                        : (locale === "en" ? "Low" : "Baja")}
                  </span>
                </div>
              }
            />
          </dl>
          {/* Evidence summary */}
          <p className="text-[10px] text-foreground/70 leading-relaxed px-1">
            {getI18nValue(causeResult.likelyCause.evidenceSummary, loc)}
          </p>
          {/* Contributing causes (up to 3) */}
          {causeResult.contributingCauses.length > 0 && (
            <div className="pt-1 border-t border-border/60">
              <dt className="text-[10px] text-muted-foreground mb-1">
                {locale === "en" ? "Contributing factors" : "Factores contribuyentes"}
              </dt>
              {causeResult.contributingCauses.slice(0, 3).map((c) => (
                <div key={c.cause} className="flex items-center gap-1 text-[10px] py-0.5">
                  <span className={cn("px-1 py-0.5 rounded border",
                    VARIANCE_CAUSE_COLORS[c.cause as keyof typeof VARIANCE_CAUSE_COLORS]?.bg,
                    VARIANCE_CAUSE_COLORS[c.cause as keyof typeof VARIANCE_CAUSE_COLORS]?.text,
                    VARIANCE_CAUSE_COLORS[c.cause as keyof typeof VARIANCE_CAUSE_COLORS]?.border
                  )}>
                    {getI18nValue(VARIANCE_CAUSE_LABELS[c.cause as keyof typeof VARIANCE_CAUSE_LABELS], loc) ?? c.cause}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round(c.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Field sub-component ──────────────────────────────────────────────────────

function DetailField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 text-right text-[11px] font-medium", valueClassName ?? "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}