"use client";

// ============================================================================
// ProjectOps360° — Variance Detail Block for Living Graph detail panel
// ============================================================================
// Compact block showing variance severity, schedule risk, likely cause,
// and trend direction for a selected node. Follows the same visual pattern
// as ReadinessDetailBlock and LaborRiskDetailBlock.
// ============================================================================

import { useTranslations } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VarianceNodeData } from "@/types/living-graph";
import {
  VARIANCE_SEVERITY_STYLES,
  VARIANCE_SEVERITY_LABELS,
} from "@/lib/labor/labor-variance";
import {
  SCHEDULE_RISK_STYLES,
  SCHEDULE_RISK_LABELS,
  VARIANCE_TREND_LABELS,
} from "@/lib/labor/productivity-variance";
import {
  VARIANCE_CAUSE_LABELS,
  VARIANCE_CAUSE_COLORS,
} from "@/lib/labor/variance-cause-classification";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import type { VarianceSeverity } from "@/lib/labor/labor-variance";

// ── Severity styles for variance (reused from labor-variance) ──────────────────

const SEVERITY_COLORS: Record<VarianceSeverity, string> = {
  on_track: "text-emerald-600 dark:text-emerald-400",
  minor: "text-amber-600 dark:text-amber-400",
  major: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

const SEVERITY_BG: Record<VarianceSeverity, string> = {
  on_track: "border-emerald-500/30 bg-emerald-500/5",
  minor: "border-amber-500/30 bg-amber-500/5",
  major: "border-orange-500/30 bg-orange-500/5",
  critical: "border-red-500/30 bg-red-500/5",
};

const RISK_COLORS: Record<string, string> = {
  none: "text-gray-600 dark:text-gray-400",
  low: "text-blue-600 dark:text-blue-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

const TREND_ICONS: Record<string, React.ReactNode> = {
  improving: <TrendingUp className="h-3 w-3 text-emerald-500" />,
  worsening: <TrendingDown className="h-3 w-3 text-red-500" />,
  stable: <Minus className="h-3 w-3 text-gray-500" />,
  insufficient_data: <HelpCircle className="h-3 w-3 text-gray-400" />,
};

// ── Variance Detail Block ─────────────────────────────────────────────────────

interface VarianceDetailBlockProps {
  variance: VarianceNodeData;
  locale?: string;
}

export function VarianceDetailBlock({ variance, locale = "en" }: VarianceDetailBlockProps) {
  const t = useTranslations("livingGraph");

  const severity = variance.varianceSeverity;
  const severityStyles = VARIANCE_SEVERITY_STYLES[severity];
  const severityLabel = getI18nValue(VARIANCE_SEVERITY_LABELS[severity], locale as Locale) ?? severity;
  const riskLabel = getI18nValue(SCHEDULE_RISK_LABELS[variance.scheduleRisk], locale as Locale) ?? variance.scheduleRisk;
  const trendLabel = getI18nValue(VARIANCE_TREND_LABELS[variance.trendDirection], locale as Locale) ?? variance.trendDirection;
  const causeLabel = getI18nValue(VARIANCE_CAUSE_LABELS[variance.likelyCause as keyof typeof VARIANCE_CAUSE_LABELS], locale as Locale) ?? variance.likelyCause;

  return (
    <div className={`rounded-md border ${SEVERITY_BG[severity]} p-2.5 space-y-2`}>
      <h4 className={`flex items-center gap-1 text-[11px] font-medium ${SEVERITY_COLORS[severity]}`}>
        <AlertTriangle className="h-3 w-3" />
        {t("detailPanel.variance.title")}
      </h4>
      <dl className="divide-y divide-border/60 px-1 py-0.5">
        <Field label={t("detailPanel.variance.varianceSeverity")}>
          <span className={SEVERITY_COLORS[severity]}>
            {severityLabel}
            {variance.variancePct !== null && (
              <span className="ml-1 tabular-nums">({variance.variancePct}%)</span>
            )}
          </span>
        </Field>
        <Field label={t("detailPanel.variance.scheduleRisk")}>
          <span className={RISK_COLORS[variance.scheduleRisk] ?? "text-muted-foreground"}>
            {riskLabel}
            <span className="ml-1 tabular-nums text-muted-foreground">
              ({variance.scheduleRiskScore})
            </span>
          </span>
        </Field>
        <Field label={t("detailPanel.variance.likelyCause")}>
          <span className="text-[11px]">
            {causeLabel}
            {variance.causeConfidence > 0 && (
              <span className="ml-1 tabular-nums text-muted-foreground">
                ({Math.round(variance.causeConfidence * 100)}%)
              </span>
            )}
          </span>
        </Field>
        <Field label={t("detailPanel.variance.trend")}>
          <span className="flex items-center gap-1 text-[11px]">
            {TREND_ICONS[variance.trendDirection] ?? <HelpCircle className="h-3 w-3 text-gray-400" />}
            {trendLabel}
          </span>
        </Field>
      </dl>
    </div>
  );
}

// ── Field sub-component (matches detail panel pattern) ───────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-[11px] font-medium text-foreground">{children}</dd>
    </div>
  );
}