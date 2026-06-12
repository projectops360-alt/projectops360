"use client";

import { useState, useMemo } from "react";
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Route,
  Wrench,
  ClipboardList,
  Filter,
  Users,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReadinessBadge } from "@/components/labor/readiness-badge";
import {
  getReadinessLabel,
  getBlockerTypeLabel,
} from "@/lib/labor/lookahead-explanation";
import { getIdleRiskLabel, getActionTypeLabel } from "@/lib/labor/crew-idle-risk-explanation";
import { buildReadinessExplanation } from "@/lib/labor/readiness-explanation";
import type { ReadinessExplanation } from "@/lib/labor/readiness-explanation";
import { getI18nValue } from "@/types/database";
import type { LookaheadResult, LookaheadActivity } from "@/lib/labor/lookahead";
import type { CrewIdleRiskResult, AssignedActivityRisk, RecommendedAction } from "@/lib/labor/crew-idle-risk";
import type {
  LaborResource,
  TradeTaxonomy,
  ConstructionActivity,
  ActivityDependency,
  Milestone,
  ReadinessLevel,
  ReadinessChecklistItem,
  Locale,
  IdleRiskSeverity,
} from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkfaceFilters {
  trade: string | null;
  week: string | null;
  readiness: ReadinessLevel | null;
  criticalPathOnly: boolean;
  blockedOnly: boolean;
}

interface WorkfaceBoardRow {
  activityKey: string;
  name: string;
  tradeKey: string;
  requiredCrewCount: number;
  status: string;
  progress: number;
  plannedStartDate: string;
  plannedEndDate: string;
  locationZone: string | null;
  assignedResourceKeys: string[];
  activeWeeks: string[];
  readiness: ReadinessLevel;
  readinessPct: number;
  readinessChecklist: ReadinessChecklistItem[];
  blockers: { blockerType: string; severity: string; description: string }[];
  onCriticalPath: boolean;
  missingPrerequisites: ReadinessChecklistItem[];
  worstIdleRisk: IdleRiskSeverity;
  totalDaysAtRisk: number;
  downstreamImpactCount: number;
  recommendedAction: RecommendedAction | null;
}

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
  filters: {
    trade: string;
    week: string;
    readiness: string;
    all: string;
    criticalPathOnly: string;
    blockedOnly: string;
    clear: string;
  };
  table: {
    activity: string;
    trade: string;
    weeks: string;
    readinessPct: string;
    status: string;
    missingPrerequisites: string;
    blockerTypes: string;
    idleRisk: string;
    daysAtRisk: string;
    downstream: string;
    criticalPath: string;
    noActivities: string;
  };
  detail: {
    checklist: string;
    assignedResources: string;
    recommendedAction: string;
    downstreamImpact: string;
    blockers: string;
    none: string;
    completed: string;
    incomplete: string;
  };
  severity: Record<IdleRiskSeverity, string>;
  actionType: {
    reassign: string;
    stagger: string;
    expedite_prerequisite: string;
    confirm_vendor: string;
    monitor: string;
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
    workface: string;
  };
  empty: string;
}

interface WorkfaceClientProps {
  projectId: string;
  projectTitle: string;
  lookahead3: LookaheadResult;
  lookahead6: LookaheadResult;
  idleRisk3: CrewIdleRiskResult;
  idleRisk6: CrewIdleRiskResult;
  resources: LaborResource[];
  activities: ConstructionActivity[];
  dependencies: ActivityDependency[];
  taxonomy: TradeTaxonomy[];
  milestones: Milestone[];
  locale: Locale;
  translations: Translations;
}

// ── Severity Rankings ───────────────────────────────────────────────────────────

const READINESS_SEVERITY: Record<ReadinessLevel, number> = {
  ready: 0,
  at_risk: 1,
  not_ready: 2,
  blocked: 3,
};

const IDLE_RISK_SEVERITY: Record<IdleRiskSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ── Color Maps ──────────────────────────────────────────────────────────────────

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

const IDLE_RISK_STYLES: Record<IdleRiskSeverity, string> = {
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

// ── Component ──────────────────────────────────────────────────────────────────

export function WorkfaceClient({
  projectId,
  projectTitle,
  lookahead3,
  lookahead6,
  idleRisk3,
  idleRisk6,
  resources,
  activities,
  dependencies,
  taxonomy,
  milestones,
  locale,
  translations: t,
}: WorkfaceClientProps) {
  const [horizon, setHorizon] = useState<3 | 6>(3);
  const [filters, setFilters] = useState<WorkfaceFilters>({
    trade: null,
    week: null,
    readiness: null,
    criticalPathOnly: false,
    blockedOnly: false,
  });
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  const result = horizon === 3 ? lookahead3 : lookahead6;
  const idleRisk = horizon === 3 ? idleRisk3 : idleRisk6;

  // Trade label lookup
  const tradeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const tax of taxonomy) {
      map.set(tax.trade_key, getI18nValue(tax.label_i18n, locale) || tax.trade_key);
    }
    return map;
  }, [taxonomy, locale]);

  // Resource name lookup
  const resourceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of resources) {
      map.set(r.resource_key, r.name);
    }
    return map;
  }, [resources]);

  // Build activity-idle-risk lookup from CrewIdleRiskResult
  const activityIdleRiskMap = useMemo(() => {
    const map = new Map<
      string,
      {
        worstIdleRisk: IdleRiskSeverity;
        totalDaysAtRisk: number;
        maxDownstreamImpact: number;
        recommendedAction: RecommendedAction | null;
      }
    >();

    for (const entry of idleRisk.entries) {
      for (const risk of entry.assignedActivities) {
        const existing = map.get(risk.activityKey);
        if (!existing) {
          map.set(risk.activityKey, {
            worstIdleRisk: risk.idleRiskSeverity,
            totalDaysAtRisk: risk.daysAtRisk,
            maxDownstreamImpact: risk.downstreamActivityKeys.length,
            recommendedAction: risk.recommendedAction,
          });
        } else {
          if (IDLE_RISK_SEVERITY[risk.idleRiskSeverity] > IDLE_RISK_SEVERITY[existing.worstIdleRisk]) {
            existing.worstIdleRisk = risk.idleRiskSeverity;
            existing.recommendedAction = risk.recommendedAction;
          }
          existing.totalDaysAtRisk += risk.daysAtRisk;
          existing.maxDownstreamImpact = Math.max(
            existing.maxDownstreamImpact,
            risk.downstreamActivityKeys.length
          );
        }
      }
    }
    return map;
  }, [idleRisk]);

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

  // Build board rows by joining LookaheadActivity with idle risk data
  const boardRows: WorkfaceBoardRow[] = useMemo(() => {
    return result.allActivities.map((activity) => {
      const idleData = activityIdleRiskMap.get(activity.activityKey);
      const missingPrerequisites = activity.readinessChecklist.filter(
        (item) => item.required && !item.completed
      );

      return {
        activityKey: activity.activityKey,
        name: activity.name,
        tradeKey: activity.tradeKey,
        requiredCrewCount: activity.requiredCrewCount,
        status: activity.status,
        progress: activity.progress,
        plannedStartDate: activity.plannedStartDate,
        plannedEndDate: activity.plannedEndDate,
        locationZone: activity.locationZone,
        assignedResourceKeys: activity.assignedResourceKeys,
        activeWeeks: activity.activeWeeks,
        readiness: activity.readiness,
        readinessPct: activity.readinessPct,
        readinessChecklist: activity.readinessChecklist,
        blockers: activity.blockers.map((b) => ({
          blockerType: b.blockerType,
          severity: b.severity,
          description: b.description,
        })),
        onCriticalPath: activity.onCriticalPath,
        missingPrerequisites,
        worstIdleRisk: idleData?.worstIdleRisk ?? "none",
        totalDaysAtRisk: idleData?.totalDaysAtRisk ?? 0,
        downstreamImpactCount: idleData?.maxDownstreamImpact ?? 0,
        recommendedAction: idleData?.recommendedAction ?? null,
      };
    });
  }, [result.allActivities, activityIdleRiskMap]);

  // Sort by readiness severity (worst first), then idle risk
  const sortedRows = useMemo(() => {
    return [...boardRows].sort((a, b) => {
      const readinessDiff = READINESS_SEVERITY[b.readiness] - READINESS_SEVERITY[a.readiness];
      if (readinessDiff !== 0) return readinessDiff;
      const idleDiff = IDLE_RISK_SEVERITY[b.worstIdleRisk] - IDLE_RISK_SEVERITY[a.worstIdleRisk];
      if (idleDiff !== 0) return idleDiff;
      return a.name.localeCompare(b.name);
    });
  }, [boardRows]);

  // Filter options
  const tradeOptions = useMemo(() => {
    const trades = new Set<string>();
    for (const row of boardRows) trades.add(row.tradeKey);
    return Array.from(trades).sort();
  }, [boardRows]);

  const weekOptions = useMemo(() => {
    return result.weeks.map((w) => w.weekLabel);
  }, [result.weeks]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      if (filters.trade && row.tradeKey !== filters.trade) return false;
      if (filters.week && !row.activeWeeks.includes(filters.week)) return false;
      if (filters.readiness && row.readiness !== filters.readiness) return false;
      if (filters.criticalPathOnly && !row.onCriticalPath) return false;
      if (filters.blockedOnly && row.readiness !== "blocked") return false;
      return true;
    });
  }, [sortedRows, filters]);

  // Summary stats
  const readinessCounts = useMemo(() => {
    const counts = { ready: 0, at_risk: 0, not_ready: 0, blocked: 0 };
    for (const row of boardRows) {
      counts[row.readiness]++;
    }
    return counts;
  }, [boardRows]);

  const hasActiveFilters =
    filters.trade !== null ||
    filters.week !== null ||
    filters.readiness !== null ||
    filters.criticalPathOnly ||
    filters.blockedOnly;

  const clearFilters = () => {
    setFilters({
      trade: null,
      week: null,
      readiness: null,
      criticalPathOnly: false,
      blockedOnly: false,
    });
  };

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
          icon={ClipboardList}
          value={boardRows.length}
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

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={filters.trade ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, trade: e.target.value || null }))
          }
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t.filters.trade}: {t.filters.all}</option>
          {tradeOptions.map((tradeKey) => (
            <option key={tradeKey} value={tradeKey}>
              {tradeLabelMap.get(tradeKey) ?? tradeKey}
            </option>
          ))}
        </select>
        <select
          value={filters.week ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, week: e.target.value || null }))
          }
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t.filters.week}: {t.filters.all}</option>
          {weekOptions.map((w) => (
            <option key={w} value={w}>
              {w.replace(/^\d{4}-W/, "W")}
            </option>
          ))}
        </select>
        <select
          value={filters.readiness ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              readiness: (e.target.value || null) as ReadinessLevel | null,
            }))
          }
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t.filters.readiness}: {t.filters.all}</option>
          <option value="ready">{t.readiness.ready}</option>
          <option value="at_risk">{t.readiness.at_risk}</option>
          <option value="not_ready">{t.readiness.not_ready}</option>
          <option value="blocked">{t.readiness.blocked}</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={filters.criticalPathOnly}
            onChange={(e) =>
              setFilters((f) => ({ ...f, criticalPathOnly: e.target.checked }))
            }
            className="rounded border-border"
          />
          {t.filters.criticalPathOnly}
        </label>
        <label className="inline-flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={filters.blockedOnly}
            onChange={(e) =>
              setFilters((f) => ({ ...f, blockedOnly: e.target.checked }))
            }
            className="rounded border-border"
          />
          {t.filters.blockedOnly}
        </label>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
          >
            {t.filters.clear}
          </button>
        )}
      </div>

      {/* ── Board Table ────────────────────────────────────────────────────── */}
      {filteredRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-muted/50 px-3 py-2.5 text-left font-medium min-w-[200px]">
                    {t.table.activity}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium min-w-[100px]">
                    {t.table.trade}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium min-w-[100px]">
                    {t.table.weeks}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium min-w-[120px]">
                    {t.table.readinessPct}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium min-w-[90px]">
                    {t.table.status}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium min-w-[150px]">
                    {t.table.missingPrerequisites}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium min-w-[100px]">
                    {t.table.blockerTypes}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium min-w-[90px]">
                    {t.table.idleRisk}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium min-w-[70px]">
                    {t.table.daysAtRisk}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium min-w-[70px]">
                    {t.table.downstream}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium min-w-[50px]">
                    {t.table.criticalPath}
                  </th>
                  <th className="px-1 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <BoardRow
                    key={row.activityKey}
                    row={row}
                    isExpanded={expandedActivity === row.activityKey}
                    isOdd={i % 2 === 0}
                    tradeLabel={tradeLabelMap.get(row.tradeKey) ?? row.tradeKey}
                    explanation={explanations.get(row.activityKey) ?? null}
                    locale={locale}
                    t={t}
                    onToggleExpand={() =>
                      setExpandedActivity(
                        expandedActivity === row.activityKey ? null : row.activityKey
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────────

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

// ── Board Row ───────────────────────────────────────────────────────────────────

function BoardRow({
  row,
  isExpanded,
  isOdd,
  tradeLabel,
  explanation,
  locale,
  t,
  onToggleExpand,
}: {
  row: WorkfaceBoardRow;
  isExpanded: boolean;
  isOdd: boolean;
  tradeLabel: string;
  explanation: ReadinessExplanation | null;
  locale: Locale;
  t: Translations;
  onToggleExpand: () => void;
}) {
  const readinessColor = READINESS_COLORS[row.readiness];
  const missingRequired = row.readinessChecklist.filter(
    (item) => item.required && !item.completed
  );
  const completedRequired = row.readinessChecklist.filter(
    (item) => item.required && item.completed
  ).length;
  const totalRequired = row.readinessChecklist.filter((item) => item.required).length;

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
            <span className="text-sm truncate max-w-[180px]" title={row.name}>
              {row.name}
            </span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{tradeLabel}</td>
        <td className="px-3 py-2 text-center">
          <div className="flex gap-0.5 justify-center flex-wrap">
            {row.activeWeeks.slice(0, 4).map((w) => (
              <span
                key={w}
                className="inline-flex items-center rounded px-1 py-0.5 text-[10px] tabular-nums bg-background/50 border border-border/50"
              >
                {w.replace(/^\d{4}-W/, "W")}
              </span>
            ))}
            {row.activeWeeks.length > 4 && (
              <span className="text-[10px] text-muted-foreground">
                +{row.activeWeeks.length - 4}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">
                {completedRequired}/{totalRequired}
              </span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  row.readinessPct >= 80
                    ? "text-emerald-600 dark:text-emerald-400"
                    : row.readinessPct >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                )}
              >
                {row.readinessPct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  row.readinessPct >= 80
                    ? "bg-emerald-500"
                    : row.readinessPct >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                )}
                style={{ width: `${row.readinessPct}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-3 py-2 text-center">
          <ReadinessBadge
            readiness={row.readiness}
            label={getReadinessLabel(row.readiness, locale)}
            compact
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {missingRequired.slice(0, 3).map((item) => {
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
            {missingRequired.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{missingRequired.length - 3}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {row.blockers.slice(0, 2).map((b, i) => (
              <span
                key={`${b.blockerType}-${i}`}
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              >
                {getBlockerTypeLabel(b.blockerType, locale)}
              </span>
            ))}
            {row.blockers.length > 2 && (
              <span className="text-[10px] text-muted-foreground">
                +{row.blockers.length - 2}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-center">
          {row.worstIdleRisk === "none" ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                IDLE_RISK_STYLES[row.worstIdleRisk]
              )}
            >
              {t.severity[row.worstIdleRisk]}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right text-sm tabular-nums">
          {row.totalDaysAtRisk > 0 ? row.totalDaysAtRisk : "—"}
        </td>
        <td className="px-3 py-2 text-center text-sm tabular-nums">
          {row.downstreamImpactCount > 0 ? row.downstreamImpactCount : "—"}
        </td>
        <td className="px-3 py-2 text-center">
          {row.onCriticalPath ? (
            <Circle className="h-3 w-3 fill-red-500 text-red-500 mx-auto" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
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
          <td colSpan={12} className="px-4 py-3">
            <ExpandedDetail
              row={row}
              explanation={explanation}
              locale={locale}
              t={t}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Expanded Detail ──────────────────────────────────────────────────────────────

function ExpandedDetail({
  row,
  explanation,
  locale,
  t,
}: {
  row: WorkfaceBoardRow;
  explanation: ReadinessExplanation | null;
  locale: Locale;
  t: Translations;
}) {
  const checklist = row.readinessChecklist;

  return (
    <div className="space-y-3">
      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
          {t.detail.checklist}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {checklist.map((item) => {
            const label = getI18nValue(item.label_i18n, locale) ?? item.item_key;
            return (
              <span
                key={item.item_key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  item.completed
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : item.required
                      ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {label}
                {!item.required && (
                  <span className="text-[9px] opacity-60">(opt)</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Blockers ──────────────────────────────────────────────────────── */}
      {row.blockers.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
            {t.detail.blockers}
          </h4>
          <div className="space-y-1">
            {row.blockers.map((b, i) => (
              <div
                key={`${b.blockerType}-${i}`}
                className="flex items-start gap-1.5 text-xs"
              >
                <AlertTriangle
                  className={cn(
                    "h-3 w-3 shrink-0 mt-0.5",
                    b.severity === "critical"
                      ? "text-red-500"
                      : b.severity === "high"
                        ? "text-orange-500"
                        : "text-amber-500"
                  )}
                />
                <span>
                  <span className="font-medium">
                    {getBlockerTypeLabel(b.blockerType, locale)}
                  </span>
                  {b.severity === "critical" && " ⚠"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recommended Action ────────────────────────────────────────────── */}
      {row.recommendedAction && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/20 p-2.5">
          <Wrench className="h-4 w-4 text-brand-500 dark:text-brand-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand-700 dark:text-brand-300">
              {getActionTypeLabel(row.recommendedAction.actionType, locale)}
            </p>
            <p className="text-xs text-foreground/80 mt-0.5">
              {getI18nValue(row.recommendedAction.description, locale)}
            </p>
          </div>
        </div>
      )}

      {/* ── Impact Summary ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {row.totalDaysAtRisk} {locale === "en" ? "days at risk" : "días en riesgo"}
        </span>
        {row.downstreamImpactCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Route className="h-3 w-3" />
            {row.downstreamImpactCount} {locale === "en" ? "downstream" : "aguas abajo"}
          </span>
        )}
        {row.onCriticalPath && (
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            <Circle className="h-3 w-3 fill-red-500 text-red-500" />
            {locale === "en" ? "On critical path" : "En ruta crítica"}
          </span>
        )}
      </div>

      {/* ── AI Readiness Explanation ────────────────────────────────────────── */}
      {explanation && (
        <div className="mt-3 rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/10 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <BrainCircuit className="h-4 w-4 text-brand-500" />
            <h4 className="text-xs font-semibold text-brand-700 dark:text-brand-300">
              {t.readinessExplanation.title}
            </h4>
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed">
            {getI18nValue(explanation.summary, locale)}
          </p>
          <div className="space-y-1">
            <WorkfaceExplanationRow
              label={t.readinessExplanation.whatIsMissing}
              text={getI18nValue(explanation.whatIsMissing, locale)}
              icon={<XCircle className="h-3 w-3 text-orange-500" />}
            />
            <WorkfaceExplanationRow
              label={t.readinessExplanation.whyItMatters}
              text={getI18nValue(explanation.whyItMatters, locale)}
              icon={<AlertTriangle className="h-3 w-3 text-amber-500" />}
            />
            <WorkfaceExplanationRow
              label={t.readinessExplanation.crewAffected}
              text={getI18nValue(explanation.crewAffected, locale)}
              icon={<Users className="h-3 w-3 text-blue-500" />}
            />
            <WorkfaceExplanationRow
              label={t.readinessExplanation.downstreamAtRisk}
              text={getI18nValue(explanation.downstreamAtRisk, locale)}
              icon={<Route className="h-3 w-3 text-red-500" />}
            />
            <WorkfaceExplanationRow
              label={t.readinessExplanation.recommendedAction}
              text={getI18nValue(explanation.recommendedAction, locale)}
              icon={<Wrench className="h-3 w-3 text-brand-500" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function WorkfaceExplanationRow({
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
        <span className="text-[11px] font-medium text-muted-foreground">{label}: </span>
        <span className="text-[11px] text-foreground/80">{text}</span>
      </div>
    </div>
  );
}