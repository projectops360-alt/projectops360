"use client";

import { useState, useMemo } from "react";
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Circle,
  BrainCircuit,
  Users,
  Clock,
  Route,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReadinessBadge } from "@/components/labor/readiness-badge";
import { parseAvailabilityWindows } from "@/lib/labor/capacity";
import {
  getReadinessLabel,
  getBlockerTypeLabel,
} from "@/lib/labor/lookahead-explanation";
import type { LookaheadResult, LookaheadWeek, LookaheadActivity, TradeWeekNeed, LookaheadBlocker } from "@/lib/labor/lookahead";
import type { LookaheadNarrative } from "@/lib/labor/lookahead-explanation";
import type { CrewIdleRiskResult, CrewIdleRiskEntry, AssignedActivityRisk } from "@/lib/labor/crew-idle-risk";
import type { IdleRiskSummaryUI } from "@/lib/labor/crew-idle-risk-explanation";
import {
  getIdleRiskLabel,
  getActionTypeLabel,
} from "@/lib/labor/crew-idle-risk-explanation";
import {
  buildReadinessExplanation,
} from "@/lib/labor/readiness-explanation";
import type { ReadinessExplanation } from "@/lib/labor/readiness-explanation";
import type {
  LaborResource,
  Milestone,
  TradeTaxonomy,
  ConstructionActivity,
  ActivityDependency,
  ReadinessLevel,
  Locale,
  ShortageRiskLevel,
  IdleRiskSeverity,
} from "@/types/database";
import { getI18nValue } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Translations {
  title: string;
  description: string;
  horizon3Week: string;
  horizon6Week: string;
  summary: {
    totalActivities: string;
    readyActivities: string;
    atRiskActivities: string;
    blockedActivities: string;
    overallReadiness: string;
  };
  readiness: Record<ReadinessLevel, string>;
  grid: {
    trade: string;
    week: string;
    required: string;
    available: string;
    gap: string;
    activities: string;
    criticalPath: string;
    noActivities: string;
    noTrades: string;
  };
  activity: {
    readiness: string;
    blockers: string;
    assignedResources: string;
    noBlockers: string;
    onCriticalPath: string;
    offCriticalPath: string;
    progress: string;
  };
  checklist: {
    title: string;
  };
  blockers: {
    title: string;
    unmet_dependency: string;
    labor_shortage: string;
    vendor_unconfirmed: string;
    over_allocated: string;
    blocked_status: string;
    checklist_incomplete: string;
  };
  idleRisk: {
    title: string;
    description: string;
    crewsAtRisk: string;
    totalIdleDays: string;
    criticalPathIdleDays: string;
    resource: string;
    trade: string;
    constraint: string;
    assignedActivities: string;
    idleWeeks: string;
    worstRisk: string;
    downstreamImpact: string;
    daysAtRisk: string;
    recommendedAction: string;
    readiness: string;
    missingPrerequisites: string;
    noRisk: string;
    severity: Record<IdleRiskSeverity, string>;
    actionType: {
      reassign: string;
      stagger: string;
      expedite_prerequisite: string;
      confirm_vendor: string;
      monitor: string;
    };
  };
  narrative: {
    allReady: string;
    someAtRisk: string;
    someBlocked: string;
    mostCriticalTrade: string;
    criticalPathWarning: string;
    vendorUnconfirmed: string;
  };
  readinessExplanation: {
    title: string;
    whatIsMissing: string;
    whyItMatters: string;
    crewAffected: string;
    downstreamAtRisk: string;
    recommendedAction: string;
    showInsight: string;
    hideInsight: string;
  };
  nav: {
    matrix: string;
    lookahead: string;
  };
  empty: string;
}

interface LookaheadClientProps {
  projectId: string;
  projectTitle: string;
  lookahead3: LookaheadResult;
  lookahead6: LookaheadResult;
  narrative3: LookaheadNarrative;
  narrative6: LookaheadNarrative;
  idleRisk3: CrewIdleRiskResult;
  idleRisk6: CrewIdleRiskResult;
  idleRiskSummary3: IdleRiskSummaryUI;
  idleRiskSummary6: IdleRiskSummaryUI;
  resources: LaborResource[];
  activities: ConstructionActivity[];
  dependencies: ActivityDependency[];
  taxonomy: TradeTaxonomy[];
  milestones: Milestone[];
  locale: Locale;
  translations: Translations;
}

// ── Risk Badge Styles (reuse from capacity page) ────────────────────────────────

const RISK_STYLES: Record<ShortageRiskLevel, string> = {
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

// ── Readiness Color Map ────────────────────────────────────────────────────────

const READINESS_COLORS: Record<ReadinessLevel, { bg: string; text: string; border: string }> = {
  ready: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  at_risk: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  not_ready: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
  },
  blocked: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function LookaheadClient({
  projectId,
  projectTitle,
  lookahead3,
  lookahead6,
  narrative3,
  narrative6,
  idleRisk3,
  idleRisk6,
  idleRiskSummary3,
  idleRiskSummary6,
  resources,
  activities,
  dependencies,
  taxonomy,
  milestones,
  locale,
  translations: t,
}: LookaheadClientProps) {
  const [horizon, setHorizon] = useState<3 | 6>(3);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  const result = horizon === 3 ? lookahead3 : lookahead6;
  const narrative = horizon === 3 ? narrative3 : narrative6;
  const idleRisk = horizon === 3 ? idleRisk3 : idleRisk6;
  const idleRiskSummary = horizon === 3 ? idleRiskSummary3 : idleRiskSummary6;

  // Trade taxonomy label lookup
  const tradeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const tax of taxonomy) {
      map.set(tax.trade_key, getI18nValue(tax.label_i18n, locale) || tax.trade_key);
    }
    return map;
  }, [taxonomy, locale]);

  // Group activities by trade for expandable rows
  const activitiesByTrade = useMemo(() => {
    const map = new Map<string, LookaheadActivity[]>();
    for (const a of result.allActivities) {
      const existing = map.get(a.tradeKey) ?? [];
      existing.push(a);
      map.set(a.tradeKey, existing);
    }
    return map;
  }, [result.allActivities]);

  // Count by readiness
  const readinessCounts = useMemo(() => {
    const counts = { ready: 0, at_risk: 0, not_ready: 0, blocked: 0 };
    for (const a of result.allActivities) {
      counts[a.readiness]++;
    }
    return counts;
  }, [result.allActivities]);

  // Build readiness explanations for not-ready activities
  const explanations = useMemo(() => {
    const map = new Map<string, ReadinessExplanation>();
    for (const activity of result.allActivities) {
      if (activity.readiness !== "ready") {
        const explanation = buildReadinessExplanation(
          activity,
          idleRisk,
          resources,
          dependencies,
          activities,
          locale
        );
        map.set(activity.activityKey, explanation);
      }
    }
    return map;
  }, [result.allActivities, idleRisk, resources, dependencies, activities, locale]);

  // Unique trades in the grid
  const tradeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const w of result.weeks) {
      for (const tn of w.tradeNeeds) {
        keys.add(tn.tradeKey);
      }
    }
    return Array.from(keys).sort();
  }, [result.weeks]);

  // Build trade->week->need lookup
  const needLookup = useMemo(() => {
    const map = new Map<string, Map<string, TradeWeekNeed>>();
    for (const w of result.weeks) {
      for (const tn of w.tradeNeeds) {
        let tradeMap = map.get(tn.tradeKey);
        if (!tradeMap) {
          tradeMap = new Map();
          map.set(tn.tradeKey, tradeMap);
        }
        tradeMap.set(tn.weekLabel, tn);
      }
    }
    return map;
  }, [result.weeks]);

  return (
    <div className="space-y-6 mt-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
      </div>

      {/* ── Horizon Toggle ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setHorizon(3)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            horizon === 3
              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm border border-brand-500/20"
              : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <CalendarClock className="h-4 w-4" />
          {t.horizon3Week}
        </button>
        <button
          onClick={() => setHorizon(6)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            horizon === 6
              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm border border-brand-500/20"
              : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <CalendarClock className="h-4 w-4" />
          {t.horizon6Week}
        </button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          icon={Users}
          value={result.allActivities.length}
          label={t.summary.totalActivities}
          color="brand"
        />
        <SummaryCard
          icon={CheckCircle2}
          value={readinessCounts.ready}
          label={t.summary.readyActivities}
          color="emerald"
        />
        <SummaryCard
          icon={AlertTriangle}
          value={readinessCounts.at_risk}
          label={t.summary.atRiskActivities}
          color={readinessCounts.at_risk > 0 ? "amber" : "brand"}
        />
        <SummaryCard
          icon={XCircle}
          value={readinessCounts.blocked}
          label={t.summary.blockedActivities}
          color={readinessCounts.blocked > 0 ? "red" : "brand"}
        />
        <SummaryCard
          icon={ShieldAlert}
          value={getReadinessLabel(result.overallReadiness, locale)}
          label={t.summary.overallReadiness}
          color={
            result.overallReadiness === "ready"
              ? "emerald"
              : result.overallReadiness === "at_risk"
                ? "amber"
                : "red"
          }
          isText
        />
      </div>

      {/* ── Narrative ─────────────────────────────────────────────────────── */}
      <ReadinessNarrativeBlock
        narrative={narrative}
        taxonomy={taxonomy}
        locale={locale}
        t={t}
      />

      {/* ── Weekly Timeline Grid ─────────────────────────────────────────── */}
      {result.allActivities.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-muted/50 px-3 py-2.5 text-left font-medium min-w-[140px]">
                    {t.grid.trade}
                  </th>
                  {result.weeks.map((w) => (
                    <th
                      key={w.weekLabel}
                      className="px-3 py-2.5 text-center font-medium min-w-[100px]"
                    >
                      {w.weekLabel}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-medium">
                    {t.grid.criticalPath}
                  </th>
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {tradeKeys.length === 0 ? (
                  <tr>
                    <td
                      colSpan={result.weeks.length + 3}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {t.grid.noTrades}
                    </td>
                  </tr>
                ) : (
                  tradeKeys.map((tradeKey, i) => {
                    const tradeLabel =
                      tradeLabelMap.get(tradeKey) || tradeKey;
                    const isExpanded = expandedTrade === tradeKey;
                    const tradeActivities =
                      activitiesByTrade.get(tradeKey) ?? [];
                    const tradeMap = needLookup.get(tradeKey);

                    // Determine worst risk for this trade
                    let worstRisk: ShortageRiskLevel = "none";
                    let onCriticalPath = false;
                    for (const w of result.weeks) {
                      const need = tradeMap?.get(w.weekLabel);
                      if (need) {
                        if (
                          need.shortageRisk !== "none" &&
                          need.shortageRisk > worstRisk
                        ) {
                          worstRisk = need.shortageRisk;
                        }
                        if (need.onCriticalPath) onCriticalPath = true;
                      }
                    }

                    return (
                      <TradeRow
                        key={tradeKey}
                        tradeKey={tradeKey}
                        tradeLabel={tradeLabel}
                        weeks={result.weeks}
                        tradeMap={tradeMap}
                        isExpanded={isExpanded}
                        isOdd={i % 2 === 0}
                        onCriticalPath={onCriticalPath}
                        activities={tradeActivities}
                        explanations={explanations}
                        locale={locale}
                        t={t}
                        onToggleExpand={() =>
                          setExpandedTrade(isExpanded ? null : tradeKey)
                        }
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Blockers Section ──────────────────────────────────────────────── */}
      {result.blockers.length > 0 && (
        <BlockersSection blockers={result.blockers} locale={locale} t={t} />
      )}

      {/* ── Crew Idle Risk Panel ──────────────────────────────────────────── */}
      {idleRisk.entries.length > 0 && (
        <CrewIdleRiskPanel
          idleRisk={idleRisk}
          idleRiskSummary={idleRiskSummary}
          resources={resources}
          taxonomy={taxonomy}
          locale={locale}
          t={t}
        />
      )}
    </div>
  );
}

// ── Summary Card ────────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  value,
  label,
  color,
  isText,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  color: "brand" | "emerald" | "amber" | "red";
  isText?: boolean;
}) {
  const colorMap = {
    brand: "text-brand-600 dark:text-brand-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
  };

  const bgMap = {
    brand: "bg-brand-50 dark:bg-brand-950/30",
    emerald: "bg-emerald-50 dark:bg-emerald-950/30",
    amber: "bg-amber-50 dark:bg-amber-950/30",
    red: "bg-red-50 dark:bg-red-950/30",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            bgMap[color]
          )}
        >
          <Icon className={cn("h-5 w-5", colorMap[color])} />
        </div>
        <div>
          <p
            className={cn(
              "font-bold tabular-nums",
              isText ? "text-lg" : "text-xl",
              colorMap[color]
            )}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Readiness Narrative Block ────────────────────────────────────────────────

function ReadinessNarrativeBlock({
  narrative,
  taxonomy,
  locale,
  t,
}: {
  narrative: LookaheadNarrative;
  taxonomy: TradeTaxonomy[];
  locale: Locale;
  t: Translations;
}) {
  const readinessStyle = READINESS_COLORS[narrative.overallReadiness];

  const insightIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    readiness_at_risk: AlertTriangle,
    readiness_not_ready: XCircle,
    readiness_blocked: ShieldAlert,
    labor_shortage_in_window: Users,
    vendor_unconfirmed_in_window: TrendingUp,
    unmet_dependency_in_window: AlertTriangle,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <BrainCircuit className="h-5 w-5 text-brand-500 mt-0.5 shrink-0" />
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ReadinessBadge
              readiness={narrative.overallReadiness}
              label={getReadinessLabel(narrative.overallReadiness, locale)}
            />
            <span className="text-xs text-muted-foreground">
              {narrative.topBlockers.length > 0
                ? `${narrative.topBlockers.length} blocker(s)`
                : "No blockers"}
            </span>
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed">
            {narrative.summarySentence}
          </p>

          {narrative.keyInsights.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {narrative.keyInsights.map((insight, i) => {
                const Icon = insightIcons[insight.kind] ?? AlertTriangle;
                const description = buildInsightDescription(insight, locale, t);
                return (
                  <div key={i} className="flex items-start gap-1.5 pl-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildInsightDescription(
  insight: { kind: string; values: Record<string, string | number> },
  locale: Locale,
  t: Translations
): string {
  const v = insight.values;
  switch (insight.kind) {
    case "readiness_at_risk":
      return locale === "en"
        ? `${v.count} activit${Number(v.count) === 1 ? "y is" : "ies are"} at risk in the next ${v.horizon} weeks.`
        : `${v.count} actividad${Number(v.count) === 1 ? "" : "es"} en riesgo en las próximas ${v.horizon} semanas.`;
    case "readiness_not_ready":
      return locale === "en"
        ? `${v.count} activit${Number(v.count) === 1 ? "y is" : "ies are"} not ready.`
        : `${v.count} actividad${Number(v.count) === 1 ? "" : "es"} no están listas.`;
    case "readiness_blocked":
      return locale === "en"
        ? `${v.count} activit${Number(v.count) === 1 ? "y is" : "ies are"} blocked.`
        : `${v.count} actividad${Number(v.count) === 1 ? "" : "es"} bloqueada(s).`;
    case "labor_shortage_in_window":
      return t.narrative.criticalPathWarning.replace("{count}", String(v.count));
    case "vendor_unconfirmed":
      return t.narrative.vendorUnconfirmed.replace("{count}", String(v.count));
    case "unmet_dependency_in_window":
      return locale === "en"
        ? `${v.count} unmet dependenc${Number(v.count) === 1 ? "y" : "ies"} detected.`
        : `${v.count} dependencia(s) no cumplida(s) detectada(s).`;
    default:
      return insight.kind;
  }
}

// ── Trade Row ────────────────────────────────────────────────────────────────

function TradeRow({
  tradeKey,
  tradeLabel,
  weeks,
  tradeMap,
  isExpanded,
  isOdd,
  onCriticalPath,
  activities,
  explanations,
  locale,
  t,
  onToggleExpand,
}: {
  tradeKey: string;
  tradeLabel: string;
  weeks: LookaheadWeek[];
  tradeMap: Map<string, TradeWeekNeed> | undefined;
  isExpanded: boolean;
  isOdd: boolean;
  onCriticalPath: boolean;
  activities: LookaheadActivity[];
  explanations: Map<string, ReadinessExplanation>;
  locale: Locale;
  t: Translations;
  onToggleExpand: () => void;
}) {
  const hasActivities = activities.length > 0;

  return (
    <>
      <tr
        className={cn(
          "border-b border-border hover:bg-muted/30 transition-colors",
          isOdd ? "bg-muted/10" : "",
          isExpanded && "bg-muted/20"
        )}
      >
        <td className="sticky left-0 bg-inherit px-3 py-2 font-medium whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {hasActivities && (
              <button
                onClick={onToggleExpand}
                className="inline-flex items-center justify-center h-4 w-4 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <span>{tradeLabel}</span>
          </div>
        </td>
        {weeks.map((w) => {
          const need = tradeMap?.get(w.weekLabel);
          return (
            <td key={w.weekLabel} className="px-2 py-2 text-center">
              <TradeWeekCell need={need ?? null} />
            </td>
          );
        })}
        <td className="px-3 py-2 text-center">
          {onCriticalPath ? (
            <Circle className="h-3 w-3 fill-red-500 text-red-500 mx-auto" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-1 py-2 text-center">
          {hasActivities && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {activities.length}
            </span>
          )}
        </td>
      </tr>
      {isExpanded && hasActivities && (
        <tr className="border-b border-border bg-muted/5">
          <td colSpan={weeks.length + 3} className="px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activities.map((activity) => (
                <ActivityCard
                  key={activity.activityKey}
                  activity={activity}
                  explanation={explanations.get(activity.activityKey) ?? null}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Trade Week Cell ────────────────────────────────────────────────────────────

function TradeWeekCell({ need }: { need: TradeWeekNeed | null }) {
  if (!need || (need.requiredCrews === 0 && need.availableCrews === 0)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const cellBg =
    need.shortageRisk === "critical"
      ? "bg-red-100 dark:bg-red-900/30"
      : need.shortageRisk === "high"
        ? "bg-orange-100 dark:bg-orange-900/30"
        : need.shortageRisk === "medium"
          ? "bg-amber-100 dark:bg-amber-900/30"
          : need.shortageRisk === "low"
            ? "bg-blue-50 dark:bg-blue-900/20"
            : "bg-emerald-50 dark:bg-emerald-900/20";

  return (
    <div
      className={cn(
        "rounded-md px-2 py-1.5 text-center space-y-0.5",
        cellBg
      )}
    >
      <div className="text-xs font-medium tabular-nums">
        {need.requiredCrews}/{need.availableCrews}
      </div>
      {need.gap < 0 && (
        <div className="text-[10px] text-red-600 dark:text-red-400 tabular-nums">
          {need.gap}
        </div>
      )}
    </div>
  );
}

// ── Activity Card ──────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  explanation,
  locale,
  t,
}: {
  activity: LookaheadActivity;
  explanation: ReadinessExplanation | null;
  locale: Locale;
  t: Translations;
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const readinessColor = READINESS_COLORS[activity.readiness];
  const checklist = activity.readinessChecklist;
  const missingRequired = checklist.filter((item) => item.required && !item.completed);
  const completedRequired = checklist.filter((item) => item.required && item.completed).length;
  const totalRequired = checklist.filter((item) => item.required).length;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        readinessColor.border,
        readinessColor.bg
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{activity.name}</p>
          <p className="text-xs text-muted-foreground">
            {activity.tradeKey} · {activity.requiredCrewCount} {locale === "en" ? "crews" : "cuadrillas"}
          </p>
        </div>
        <ReadinessBadge
          readiness={activity.readiness}
          label={getReadinessLabel(activity.readiness, locale)}
          compact
        />
      </div>

      {/* ── Readiness Progress Bar ─────────────────────────────────────────── */}
      {totalRequired > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">
              {t.checklist.title}: {completedRequired}/{totalRequired}
            </span>
            <span className={cn(
              "font-medium tabular-nums",
              activity.readinessPct >= 80 ? "text-emerald-600 dark:text-emerald-400" :
              activity.readinessPct >= 50 ? "text-amber-600 dark:text-amber-400" :
              "text-red-600 dark:text-red-400"
            )}>
              {activity.readinessPct}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                activity.readinessPct >= 80 ? "bg-emerald-500" :
                activity.readinessPct >= 50 ? "bg-amber-500" :
                "bg-red-500"
              )}
              style={{ width: `${activity.readinessPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {activity.onCriticalPath && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900/50 dark:text-red-300">
            <Circle className="h-2 w-2 fill-red-500 text-red-500" />
            {t.activity.onCriticalPath}
          </span>
        )}
        <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {activity.assignedResourceKeys.length}/{activity.requiredCrewCount} {t.activity.assignedResources}
        </span>
        <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {Math.round(activity.progress * 100)}% {t.activity.progress}
        </span>
      </div>

      {/* ── Missing Prerequisites ─────────────────────────────────────────── */}
      {missingRequired.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {missingRequired.map((item) => {
            const label = getI18nValue(item.label_i18n, locale) ?? item.item_key;
            return (
              <span
                key={item.item_key}
                className="inline-flex items-center gap-0.5 rounded-full border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
              >
                <XCircle className="h-2.5 w-2.5" />
                {label}
              </span>
            );
          })}
        </div>
      )}

      {activity.activeWeeks.length > 0 && (
        <div className="flex gap-0.5">
          {activity.activeWeeks.map((w) => (
            <span
              key={w}
              className="inline-flex items-center rounded px-1 py-0.5 text-[10px] tabular-nums bg-background/50 border border-border/50"
            >
              {w.replace(/^\d{4}-W/, "W")}
            </span>
          ))}
        </div>
      )}

      {activity.blockers.length > 0 && (
        <div className="space-y-0.5">
          {activity.blockers.slice(0, 2).map((blocker, i) => (
            <div
              key={i}
              className="flex items-start gap-1 text-[10px] text-red-700 dark:text-red-300"
            >
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>
                {getBlockerTypeLabel(blocker.blockerType, locale)}
                {blocker.severity === "critical" && " ⚠"}
              </span>
            </div>
          ))}
          {activity.blockers.length > 2 && (
            <span className="text-[10px] text-muted-foreground">
              +{activity.blockers.length - 2} more
            </span>
          )}
        </div>
      )}

      {/* ── AI Readiness Explanation ──────────────────────────────────────────── */}
      {explanation && (
        <div className="mt-1">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            <BrainCircuit className="h-3 w-3" />
            {showExplanation ? t.readinessExplanation.hideInsight : t.readinessExplanation.showInsight}
          </button>
          {showExplanation && (
            <ReadinessExplanationBlock
              explanation={explanation}
              locale={locale}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Readiness Explanation Block ────────────────────────────────────────────────

function ReadinessExplanationBlock({
  explanation,
  locale,
  t,
}: {
  explanation: ReadinessExplanation;
  locale: Locale;
  t: Translations;
}) {
  return (
    <div className="mt-2 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/10 p-2.5 space-y-1.5">
      {/* Summary */}
      <p className="text-xs text-foreground/90 leading-relaxed">
        {getI18nValue(explanation.summary, locale)}
      </p>

      {/* Structured sections */}
      <div className="space-y-1">
        <ExplanationRow
          label={t.readinessExplanation.whatIsMissing}
          text={getI18nValue(explanation.whatIsMissing, locale)}
          icon={<XCircle className="h-3 w-3 text-orange-500" />}
        />
        <ExplanationRow
          label={t.readinessExplanation.whyItMatters}
          text={getI18nValue(explanation.whyItMatters, locale)}
          icon={<AlertTriangle className="h-3 w-3 text-amber-500" />}
        />
        <ExplanationRow
          label={t.readinessExplanation.crewAffected}
          text={getI18nValue(explanation.crewAffected, locale)}
          icon={<Users className="h-3 w-3 text-blue-500" />}
        />
        <ExplanationRow
          label={t.readinessExplanation.downstreamAtRisk}
          text={getI18nValue(explanation.downstreamAtRisk, locale)}
          icon={<Route className="h-3 w-3 text-red-500" />}
        />
        <ExplanationRow
          label={t.readinessExplanation.recommendedAction}
          text={getI18nValue(explanation.recommendedAction, locale)}
          icon={<Wrench className="h-3 w-3 text-brand-500" />}
        />
      </div>
    </div>
  );
}

function ExplanationRow({
  label,
  text,
  icon,
}: {
  label: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <span className="text-[10px] font-medium text-muted-foreground">{label}: </span>
        <span className="text-[10px] text-foreground/80">{text}</span>
      </div>
    </div>
  );
}

// ── Blockers Section ────────────────────────────────────────────────────────────

function BlockersSection({
  blockers,
  locale,
  t,
}: {
  blockers: LookaheadBlocker[];
  locale: Locale;
  t: Translations;
}) {
  const [showAll, setShowAll] = useState(false);
  const severityOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const sorted = [...blockers].sort(
    (a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0)
  );
  const display = showAll ? sorted : sorted.slice(0, 5);

  const severityStyles: Record<string, string> = {
    critical: "text-red-700 dark:text-red-300",
    high: "text-orange-700 dark:text-orange-300",
    medium: "text-amber-700 dark:text-amber-300",
    low: "text-blue-700 dark:text-blue-300",
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setShowAll(!showAll)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        {showAll ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {t.blockers.title}
        <span className="text-muted-foreground">({blockers.length})</span>
      </button>

      {showAll && (
        <div className="border-t border-border p-4">
          {display.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No blockers
            </p>
          ) : (
            <div className="space-y-2">
              {display.map((blocker, i) => (
                <div
                  key={`${blocker.activityKey}-${blocker.blockerType}-${i}`}
                  className="flex items-start gap-2 rounded-lg border border-border/50 p-2.5"
                >
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      severityStyles[blocker.severity] ?? "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {blocker.activityKey}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          RISK_STYLES[
                            blocker.severity === "critical"
                              ? "critical"
                              : blocker.severity === "high"
                                ? "high"
                                : blocker.severity === "medium"
                                  ? "medium"
                                  : "low"
                          ]
                        )}
                      >
                        {blocker.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getBlockerTypeLabel(blocker.blockerType, locale)}
                    </p>
                    <p className="text-xs text-foreground/80 mt-0.5">
                      {blocker.description}
                    </p>
                  </div>
                </div>
              ))}
              {sorted.length > 5 && !showAll && (
                <p className="text-xs text-muted-foreground text-center">
                  +{sorted.length - 5} more blockers
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Idle Risk Severity Styles ──────────────────────────────────────────────────

const IDLE_RISK_STYLES: Record<IdleRiskSeverity, string> = {
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

const IDLE_RISK_ICON_COLORS: Record<IdleRiskSeverity, string> = {
  none: "text-slate-500 dark:text-slate-400",
  low: "text-blue-500 dark:text-blue-400",
  medium: "text-amber-500 dark:text-amber-400",
  high: "text-orange-500 dark:text-orange-400",
  critical: "text-red-500 dark:text-red-400",
};

// ── Crew Idle Risk Panel ─────────────────────────────────────────────────────────

function CrewIdleRiskPanel({
  idleRisk,
  idleRiskSummary,
  resources,
  taxonomy,
  locale,
  t,
}: {
  idleRisk: CrewIdleRiskResult;
  idleRiskSummary: IdleRiskSummaryUI;
  resources: LaborResource[];
  taxonomy: TradeTaxonomy[];
  locale: Locale;
  t: Translations;
}) {
  const [expandedCrew, setExpandedCrew] = useState<string | null>(null);

  const tradeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const tax of taxonomy) {
      map.set(tax.trade_key, getI18nValue(tax.label_i18n, locale) || tax.trade_key);
    }
    return map;
  }, [taxonomy, locale]);

  const { entries, crewsAtRisk, totalIdleDays, criticalPathIdleDays } = idleRisk;
  const { severityCounts } = idleRiskSummary;

  // Only show entries with actual risk
  const riskyEntries = entries.filter((e) => e.worstIdleRisk !== "none");

  if (riskyEntries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            {t.idleRisk.noRisk}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Idle Risk Header ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500 dark:text-orange-400" />
            <h2 className="text-sm font-semibold">{t.idleRisk.title}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{t.idleRisk.description}</p>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          <div className="rounded-lg border border-border/50 bg-orange-50 dark:bg-orange-950/20 p-3">
            <div className="flex items-center gap-2">
              <Users className={cn("h-4 w-4", IDLE_RISK_ICON_COLORS[crewsAtRisk > 0 ? "high" : "none"])} />
              <span className="text-xs text-muted-foreground">{t.idleRisk.crewsAtRisk}</span>
            </div>
            <p className={cn("text-xl font-bold mt-1 tabular-nums", crewsAtRisk > 0 ? "text-orange-600 dark:text-orange-400" : "text-foreground")}>
              {crewsAtRisk}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-amber-50 dark:bg-amber-950/20 p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="text-xs text-muted-foreground">{t.idleRisk.totalIdleDays}</span>
            </div>
            <p className={cn("text-xl font-bold mt-1 tabular-nums", totalIdleDays > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
              {totalIdleDays}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-red-50 dark:bg-red-950/20 p-3">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-red-500 dark:text-red-400" />
              <span className="text-xs text-muted-foreground">{t.idleRisk.criticalPathIdleDays}</span>
            </div>
            <p className={cn("text-xl font-bold mt-1 tabular-nums", criticalPathIdleDays > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
              {criticalPathIdleDays}
            </p>
          </div>
        </div>

        {/* ── Severity Breakdown ──────────────────────────────────────────── */}
        {(severityCounts.critical > 0 || severityCounts.high > 0 || severityCounts.medium > 0) && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {severityCounts.critical > 0 && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", IDLE_RISK_STYLES.critical)}>
                <Circle className="h-2 w-2 fill-current" />
                {severityCounts.critical} {t.idleRisk.severity.critical}
              </span>
            )}
            {severityCounts.high > 0 && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", IDLE_RISK_STYLES.high)}>
                <Circle className="h-2 w-2 fill-current" />
                {severityCounts.high} {t.idleRisk.severity.high}
              </span>
            )}
            {severityCounts.medium > 0 && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", IDLE_RISK_STYLES.medium)}>
                <Circle className="h-2 w-2 fill-current" />
                {severityCounts.medium} {t.idleRisk.severity.medium}
              </span>
            )}
          </div>
        )}

        {/* ── Narrative Summary ───────────────────────────────────────────── */}
        <div className="px-4 pb-4">
          <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
            <p className="text-sm text-foreground/90 leading-relaxed">
              {idleRiskSummary.summarySentence}
            </p>
          </div>
        </div>

        {/* ── Per-Crew Table ──────────────────────────────────────────────── */}
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">{t.idleRisk.resource}</th>
                  <th className="px-3 py-2 text-left font-medium">{t.idleRisk.trade}</th>
                  <th className="px-3 py-2 text-center font-medium">{t.idleRisk.assignedActivities}</th>
                  <th className="px-3 py-2 text-center font-medium">{t.idleRisk.idleWeeks}</th>
                  <th className="px-3 py-2 text-center font-medium">{t.idleRisk.daysAtRisk}</th>
                  <th className="px-3 py-2 text-center font-medium">{t.idleRisk.worstRisk}</th>
                  <th className="px-3 py-2 text-center font-medium">{t.idleRisk.downstreamImpact}</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {riskyEntries.map((entry, i) => {
                  const isExpanded = expandedCrew === entry.resourceKey;
                  const tradeLabel = tradeLabelMap.get(entry.tradeKey) ?? entry.tradeKey;

                  return (
                    <CrewIdleRiskRow
                      key={entry.resourceKey}
                      entry={entry}
                      tradeLabel={tradeLabel}
                      isExpanded={isExpanded}
                      isOdd={i % 2 === 0}
                      locale={locale}
                      t={t}
                      onToggleExpand={() =>
                        setExpandedCrew(isExpanded ? null : entry.resourceKey)
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Top Recommended Actions ─────────────────────────────────────── */}
        {idleRiskSummary.topActions.length > 0 && (
          <div className="border-t border-border p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              {t.idleRisk.recommendedAction}
            </h3>
            <div className="space-y-1.5">
              {idleRiskSummary.topActions.map((action, i) => (
                <div
                  key={`${action.actionType}-${i}`}
                  className="flex items-start gap-2 text-xs text-foreground/80"
                >
                  <span className="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:text-brand-300 shrink-0">
                    {action.label}
                  </span>
                  <span>{action.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Crew Idle Risk Row ────────────────────────────────────────────────────────────

function CrewIdleRiskRow({
  entry,
  tradeLabel,
  isExpanded,
  isOdd,
  locale,
  t,
  onToggleExpand,
}: {
  entry: CrewIdleRiskEntry;
  tradeLabel: string;
  isExpanded: boolean;
  isOdd: boolean;
  locale: Locale;
  t: Translations;
  onToggleExpand: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-border hover:bg-muted/30 transition-colors",
          isOdd ? "bg-muted/10" : "",
          isExpanded && "bg-muted/20"
        )}
      >
        <td className="px-3 py-2 font-medium whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleExpand}
              className="inline-flex items-center justify-center h-4 w-4 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            <span className="text-sm">{entry.resourceName}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{tradeLabel}</td>
        <td className="px-3 py-2 text-center tabular-nums text-sm">
          {entry.assignedActivities.length}
        </td>
        <td className="px-3 py-2 text-center text-xs text-muted-foreground">
          {entry.idleWeeks.length > 0
            ? entry.idleWeeks.map((w) => w.replace(/^\d{4}-W/, "W")).join(", ")
            : "—"}
        </td>
        <td className="px-3 py-2 text-center tabular-nums text-sm font-medium">
          {entry.totalIdleDays > 0 ? entry.totalIdleDays : "—"}
        </td>
        <td className="px-3 py-2 text-center">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              IDLE_RISK_STYLES[entry.worstIdleRisk]
            )}
          >
            {t.idleRisk.severity[entry.worstIdleRisk]}
          </span>
        </td>
        <td className="px-3 py-2 text-center tabular-nums text-xs text-muted-foreground">
          {entry.downstreamImpactCount > 0 ? entry.downstreamImpactCount : "—"}
        </td>
        <td className="px-1 py-2 text-center">
          <button
            onClick={onToggleExpand}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border bg-muted/5">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {entry.assignedActivities.map((risk) => (
                <AssignedActivityRiskCard
                  key={risk.activityKey}
                  risk={risk}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
            {/* Recommended action for this crew */}
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/20 p-2.5">
              <Wrench className="h-4 w-4 text-brand-500 dark:text-brand-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-brand-700 dark:text-brand-300">
                  {getActionTypeLabel(entry.recommendedAction.actionType, locale)}
                </p>
                <p className="text-xs text-foreground/80 mt-0.5">
                  {getI18nValue(entry.recommendedAction.description, locale)}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Assigned Activity Risk Card ───────────────────────────────────────────────────

function AssignedActivityRiskCard({
  risk,
  locale,
  t,
}: {
  risk: AssignedActivityRisk;
  locale: Locale;
  t: Translations;
}) {
  const readinessColor = READINESS_COLORS[risk.readiness];

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        readinessColor.border,
        readinessColor.bg
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{risk.activityName}</p>
        </div>
        <ReadinessBadge
          readiness={risk.readiness}
          label={getReadinessLabel(risk.readiness, locale)}
          compact
        />
      </div>

      {/* Readiness progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">{t.idleRisk.readiness}</span>
          <span className={cn(
            "font-medium tabular-nums",
            risk.readinessPct >= 80 ? "text-emerald-600 dark:text-emerald-400" :
            risk.readinessPct >= 50 ? "text-amber-600 dark:text-amber-400" :
            "text-red-600 dark:text-red-400"
          )}>
            {risk.readinessPct}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              risk.readinessPct >= 80 ? "bg-emerald-500" :
              risk.readinessPct >= 50 ? "bg-amber-500" :
              "bg-red-500"
            )}
            style={{ width: `${risk.readinessPct}%` }}
          />
        </div>
      </div>

      {/* Missing prerequisites */}
      {risk.missingPrerequisites.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">{t.idleRisk.missingPrerequisites}</p>
          <div className="flex flex-wrap gap-1">
            {risk.missingPrerequisites.map((item) => {
              const label = getI18nValue(item.label_i18n, locale) ?? item.item_key;
              return (
                <span
                  key={item.item_key}
                  className="inline-flex items-center gap-0.5 rounded-full border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                >
                  <XCircle className="h-2.5 w-2.5" />
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk details */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {risk.daysAtRisk} {locale === "en" ? "days at risk" : "días en riesgo"}
        </span>
        {risk.downstreamActivityKeys.length > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Route className="h-2.5 w-2.5" />
            {risk.downstreamActivityKeys.length} {locale === "en" ? "downstream" : "aguas abajo"}
          </span>
        )}
        <span className={cn("rounded-full px-1.5 py-0.5 font-medium", IDLE_RISK_STYLES[risk.idleRiskSeverity])}>
          {t.idleRisk.severity[risk.idleRiskSeverity]}
        </span>
      </div>

      {/* Per-activity recommended action */}
      <div className="flex items-start gap-1.5 text-[10px] text-foreground/80">
        <Wrench className="h-3 w-3 shrink-0 mt-0.5 text-brand-500" />
        <span>{getActionTypeLabel(risk.recommendedAction.actionType, locale)}: {getI18nValue(risk.recommendedAction.description, locale)}</span>
      </div>
    </div>
  );
}