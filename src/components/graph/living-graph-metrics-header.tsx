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

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  severity: Severity;
  hint: string;
}

function MetricCard({ icon: Icon, label, value, severity, hint }: MetricCardProps) {
  const color = SEVERITY_COLORS[severity];
  return (
    <div
      title={hint}
      className="group relative flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-border/70 bg-card px-3 py-2.5 transition-shadow hover:shadow-md"
      style={{ boxShadow: `inset 0 1px 0 0 ${color}22` }}
    >
      <span
        aria-hidden
        className="absolute inset-x-3 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} aria-hidden />
        <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="font-mono text-lg font-bold leading-none tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

export interface LivingGraphMetricsHeaderProps {
  health: GraphHealthMetrics;
}

function LivingGraphMetricsHeaderComponent({ health }: LivingGraphMetricsHeaderProps) {
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

  return (
    <div
      role="region"
      aria-label={t("metrics.title")}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7"
    >
      <MetricCard
        icon={HeartPulse}
        label={t("metrics.graphHealthScore")}
        value={`${health.healthScore}`}
        severity={scoreSeverity}
        hint={t("metrics.hints.graphHealthScore")}
      />
      <MetricCard
        icon={AlertTriangle}
        label={t("metrics.criticalPathRisk")}
        value={t(`detailPanel.risk.${health.criticalPathRisk}`)}
        severity={riskSeverity}
        hint={t("metrics.hints.criticalPathRisk")}
      />
      <MetricCard
        icon={Gauge}
        label={t("metrics.activeBottlenecks")}
        value={`${health.activeBottlenecks}`}
        severity={countSeverity(health.activeBottlenecks, 3)}
        hint={t("metrics.hints.activeBottlenecks")}
      />
      <MetricCard
        icon={FileQuestion}
        label={t("metrics.traceabilityGaps")}
        value={`${health.traceabilityGaps}`}
        severity={countSeverity(health.traceabilityGaps, 5)}
        hint={t("metrics.hints.traceabilityGaps")}
      />
      <MetricCard
        icon={BookCheck}
        label={t("metrics.sopCandidates")}
        value={`${health.sopCandidates}`}
        severity={health.sopCandidates > 0 ? "good" : "neutral"}
        hint={t("metrics.hints.sopCandidates")}
      />
      <MetricCard
        icon={IterationCw}
        label={t("metrics.reworkSignals")}
        value={`${health.reworkSignals}`}
        severity={countSeverity(health.reworkSignals, 3)}
        hint={t("metrics.hints.reworkSignals")}
      />
      <MetricCard
        icon={BrainCircuit}
        label={t("metrics.processConfidence")}
        value={`${health.processConfidence}%`}
        severity={health.processConfidence >= 60 ? "good" : "neutral"}
        hint={t("metrics.hints.processConfidence")}
      />
    </div>
  );
}

export const LivingGraphMetricsHeader = memo(LivingGraphMetricsHeaderComponent);
LivingGraphMetricsHeader.displayName = "LivingGraphMetricsHeader";
