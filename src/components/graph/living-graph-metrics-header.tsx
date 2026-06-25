"use client";

// ============================================================================
// ProjectOps360° — Living Graph executive metrics header
// ============================================================================
// Seven polished metric cards summarizing process intelligence at a glance:
// health, critical path risk, bottlenecks, traceability, SOPs, rework and
// confidence. Severity-coded, with hover explanations.
// ============================================================================

import { memo } from "react";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  HeartPulse,
  AlertTriangle,
  Gauge,
  FileQuestion,
  BookCheck,
  IterationCw,
  BrainCircuit,
} from "lucide-react";
import type { GraphHealthMetrics } from "@/lib/graph/living-graph-analysis";

type Severity = "good" | "warning" | "critical" | "neutral";

const SEVERITY_COLORS: Record<Severity, string> = {
  good: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
  neutral: "#64748b",
};

interface MetricChipProps {
  icon: LucideIcon;
  label: string;
  value: string;
  severity: Severity;
  hint: string;
}

/** Compact, single-line metric: colored icon + value + label. The Living Graph
 *  is the hero of the page, so these read like a slim status bar, not cards. */
function MetricChip({ icon: Icon, label, value, severity, hint }: MetricChipProps) {
  const color = SEVERITY_COLORS[severity];
  return (
    <div
      title={hint}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 transition-colors hover:bg-muted/60"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} aria-hidden />
      <span className="font-mono text-sm font-bold leading-none tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

export interface LivingGraphMetricsHeaderProps {
  health: GraphHealthMetrics;
  /** "strip" = single scrollable row (default); "grid" = 2-col for narrow panels. */
  layout?: "strip" | "grid";
}

function LivingGraphMetricsHeaderComponent({ health, layout = "strip" }: LivingGraphMetricsHeaderProps) {
  const t = useTranslations("livingGraph");

  const scoreSeverity: Severity =
    health.healthScore >= 75 ? "good" : health.healthScore >= 50 ? "warning" : "critical";
  const riskSeverity: Severity =
    health.criticalPathRisk === "low"
      ? "good"
      : health.criticalPathRisk === "medium"
        ? "warning"
        : "critical";
  const countSeverity = (count: number, warnAt: number): Severity =>
    count === 0 ? "good" : count < warnAt ? "warning" : "critical";

  const chips: MetricChipProps[] = [
    { icon: HeartPulse, label: t("metrics.graphHealthScore"), value: `${health.healthScore}`, severity: scoreSeverity, hint: t("metrics.hints.graphHealthScore") },
    { icon: AlertTriangle, label: t("metrics.criticalPathRisk"), value: t(`detailPanel.risk.${health.criticalPathRisk}`), severity: riskSeverity, hint: t("metrics.hints.criticalPathRisk") },
    { icon: Gauge, label: t("metrics.activeBottlenecks"), value: `${health.activeBottlenecks}`, severity: countSeverity(health.activeBottlenecks, 3), hint: t("metrics.hints.activeBottlenecks") },
    { icon: FileQuestion, label: t("metrics.traceabilityGaps"), value: `${health.traceabilityGaps}`, severity: countSeverity(health.traceabilityGaps, 5), hint: t("metrics.hints.traceabilityGaps") },
    { icon: BookCheck, label: t("metrics.sopCandidates"), value: `${health.sopCandidates}`, severity: health.sopCandidates > 0 ? "good" : "neutral", hint: t("metrics.hints.sopCandidates") },
    { icon: IterationCw, label: t("metrics.reworkSignals"), value: `${health.reworkSignals}`, severity: countSeverity(health.reworkSignals, 3), hint: t("metrics.hints.reworkSignals") },
    { icon: BrainCircuit, label: t("metrics.processConfidence"), value: `${health.processConfidence}%`, severity: health.processConfidence >= 60 ? "good" : "neutral", hint: t("metrics.hints.processConfidence") },
  ];

  if (layout === "grid") {
    return (
      <div role="region" aria-label={t("metrics.title")} className="grid grid-cols-2 gap-1">
        {chips.map((c) => (
          <MetricChip key={c.label} {...c} />
        ))}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={t("metrics.title")}
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card px-1.5 py-1 [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-border/60"
    >
      {chips.map((c) => (
        <MetricChip key={c.label} {...c} />
      ))}
    </div>
  );
}

export const LivingGraphMetricsHeader = memo(LivingGraphMetricsHeaderComponent);
LivingGraphMetricsHeader.displayName = "LivingGraphMetricsHeader";
