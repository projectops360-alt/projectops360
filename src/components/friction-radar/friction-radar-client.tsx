"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Database,
  FileSearch,
  Gauge,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FRICTION_SIGNAL_FILTERS,
  affectedTaskCount,
  filterAndSortFrictionSignals,
  frictionSignalEntityHref,
  type FrictionSignalFilters,
} from "@/lib/friction-radar/ui-model";
import {
  FRICTION_CATEGORIES,
  type FrictionSignal,
  type FrictionSignalGap,
} from "@/lib/friction-radar/types";
import type { FrictionSourceAudit } from "@/lib/friction-radar/load-task-production";
import type { FrictionEvidenceTimelineEvent } from "@/lib/friction-radar/load-production";

interface FrictionRadarClientProps {
  projectId: string;
  projectTitle: string;
  locale: "en" | "es";
  generatedAt: string;
  milestoneCount: number;
  eventCount: number;
  taskCount: number;
  dependencyCount: number;
  timeEntryCount: number;
  rejectedEvidenceCount: number;
  signals: FrictionSignal[];
  gaps: FrictionSignalGap[];
  topSignalIds: string[];
  taskTitles: Record<string, string>;
  milestoneTitles: Record<string, string>;
  evidenceEvents: FrictionEvidenceTimelineEvent[];
  sourceAudit: FrictionSourceAudit[];
  limitations: string[];
}

const SIGNAL_KIND_KEYS: Record<string, string> = {
  queue_friction: "queueFriction",
  stagnation: "stagnation",
  backward_transition: "backwardTransition",
  repeated_completion: "repeatedCompletion",
  tested_to_rework: "testedToRework",
  completed_then_reopened: "completedThenReopened",
  process_interruption: "processInterruption",
  resource_interruption: "resourceInterruption",
  blocked_by_predecessor: "blockedByPredecessor",
  dependency_propagation_risk: "dependencyPropagationRisk",
  planned_finish_variance: "plannedFinishVariance",
  overdue_task: "overdueTask",
  critical_path_exposure: "criticalPathExposure",
  milestone_lateness: "milestoneLateness",
  effort_overrun: "effortOverrun",
  actual_cost_overrun: "actualCostOverrun",
  forecast_cost_overrun: "forecastCostOverrun",
  cpi_underperformance: "cpiUnderperformance",
  spi_underperformance: "spiUnderperformance",
  key_person_dependency: "keyPersonDependency",
  assignee_concentration: "assigneeConcentration",
  effort_concentration: "effortConcentration",
  resource_overload: "resourceOverload",
  open_risk_exposure: "openRiskExposure",
  decision_wait: "decisionWait",
  financial_approval_wait: "financialApprovalWait",
};

function signalKindKey(type: string): string {
  if (SIGNAL_KIND_KEYS[type]) return SIGNAL_KIND_KEYS[type];
  if (type.startsWith("rework:")) return "rework";
  if (type.startsWith("bottleneck:")) return "bottleneck";
  if (type.startsWith("constraint_propagation:")) return "constraintPropagation";
  if (type.startsWith("transition_health:")) return "transitionHealth";
  return "other";
}

function badgeTone(value: string): string {
  switch (value) {
    case "critical": return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "high": return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "medium": return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "low": return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    default: return "border-border bg-muted/50 text-muted-foreground";
  }
}

function scoreTone(score: number): string {
  if (score >= 80) return "text-red-600 dark:text-red-300";
  if (score >= 60) return "text-orange-600 dark:text-orange-300";
  if (score >= 35) return "text-amber-600 dark:text-amber-300";
  return "text-sky-600 dark:text-sky-300";
}

function compactId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function FrictionRadarClient(props: FrictionRadarClientProps) {
  const t = useTranslations("frictionRadar");
  const [filters, setFilters] = useState<FrictionSignalFilters>(DEFAULT_FRICTION_SIGNAL_FILTERS);
  const [selectedSignal, setSelectedSignal] = useState<FrictionSignal | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const filtered = useMemo(
    () => filterAndSortFrictionSignals({
      signals: props.signals,
      topSignalIds: props.topSignalIds,
      filters,
      taskTitles: props.taskTitles,
    }),
    [filters, props.signals, props.taskTitles, props.topSignalIds],
  );
  const topSet = useMemo(() => new Set(props.topSignalIds), [props.topSignalIds]);
  const affected = useMemo(() => affectedTaskCount(props.signals), [props.signals]);
  const highConfidence = props.signals.filter((signal) => signal.confidence === "high").length;
  const highConfidencePct = props.signals.length === 0
    ? 0
    : Math.round((highConfidence / props.signals.length) * 100);
  const milestoneOptions = useMemo(() => {
    const ids = new Set(props.signals.map((signal) => signal.milestoneId).filter((id): id is string => Boolean(id)));
    return [...ids].sort((a, b) => (props.milestoneTitles[a] ?? a).localeCompare(props.milestoneTitles[b] ?? b));
  }, [props.milestoneTitles, props.signals]);
  const taskOptions = useMemo(() => {
    const ids = new Set(props.signals.map((signal) => signal.taskId).filter((id): id is string => Boolean(id)));
    return [...ids].sort((a, b) => (props.taskTitles[a] ?? a).localeCompare(props.taskTitles[b] ?? b));
  }, [props.signals, props.taskTitles]);
  const selectedTimeline = useMemo(() => {
    if (!selectedSignal) return [];
    const ids = new Set(
      selectedSignal.evidenceRefs
        .filter((ref) => ref.kind === "project_event_log")
        .map((ref) => ref.id),
    );
    return props.evidenceEvents
      .filter((event) => ids.has(event.eventId))
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }, [props.evidenceEvents, selectedSignal]);

  useEffect(() => {
    if (!selectedSignal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedSignal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedSignal]);

  useEffect(() => {
    if (!selectedSignal) previousFocusRef.current?.focus();
  }, [selectedSignal]);

  const openEvidence = (signal: FrictionSignal, trigger: HTMLElement) => {
    previousFocusRef.current = trigger;
    setSelectedSignal(signal);
  };

  const updateFilter = <K extends keyof FrictionSignalFilters>(
    key: K,
    value: FrictionSignalFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const trapDialogFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return t("values.unknown");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(props.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(parsed);
  };

  const formatValue = (value: FrictionSignal["observedValue"]) => {
    if (value == null || value === "") return t("values.unknown");
    if (typeof value === "boolean") return value ? t("values.yes") : t("values.no");
    if (typeof value === "number") return new Intl.NumberFormat(props.locale, { maximumFractionDigits: 2 }).format(value);
    return value;
  };

  const signalLabel = (signal: FrictionSignal) =>
    t(`signalKinds.${signalKindKey(signal.signalType)}` as never);

  return (
    <section className="mx-auto max-w-[1600px] space-y-6" data-testid="friction-radar-root">
      <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="relative bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 px-5 py-7 text-white sm:px-8">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <Activity className="h-4 w-4" aria-hidden="true" />
                {t("eyebrow")}
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 normal-case tracking-normal">
                  {t("readOnly")}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">{props.projectTitle}</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{t("description")}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t("generatedAt")}</p>
              <p className="mt-1 font-medium text-slate-100">{formatDate(props.generatedAt)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={AlertTriangle} label={t("metrics.signals")} value={String(props.signals.length)} detail={t("metrics.promotedOnly")} />
        <MetricCard icon={FileSearch} label={t("metrics.affectedTasks")} value={String(affected)} detail={t("metrics.ofTasks", { count: props.taskCount })} />
        <MetricCard icon={ShieldCheck} label={t("metrics.highConfidence")} value={`${highConfidencePct}%`} detail={t("metrics.highConfidenceCount", { count: highConfidence })} />
        <MetricCard icon={CircleHelp} label={t("metrics.dataGaps")} value={String(props.gaps.length)} detail={t("metrics.unknownNotZero")} />
        <MetricCard icon={Gauge} label={t("metrics.globalScore")} value={t("values.notCalculated")} detail={t("metrics.globalScoreReason")} muted />
      </div>

      <section aria-labelledby="friction-categories-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="friction-categories-title" className="text-lg font-semibold text-foreground">{t("categoriesTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("categoriesDescription")}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FRICTION_CATEGORIES.map((category) => {
            const categorySignals = props.signals.filter((signal) => signal.category === category);
            const topScore = categorySignals.reduce((max, signal) => Math.max(max, signal.score), 0);
            return (
              <button
                type="button"
                key={category}
                onClick={() => setFilters((current) => ({
                  ...current,
                  category: current.category === category ? "all" : category,
                  scope: "all",
                }))}
                aria-pressed={filters.category === category}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition hover:border-emerald-500/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  filters.category === category ? "border-emerald-500 ring-1 ring-emerald-500/30" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{t(`categories.${category}` as never)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{categorySignals.length}</span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("highestIndependentScore")}</p>
                    <p className={cn("mt-1 text-2xl font-semibold", categorySignals.length ? scoreTone(topScore) : "text-muted-foreground")}>{categorySignals.length ? topScore : "—"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("values.noAggregate")}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="friction-signals-title" className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 id="friction-signals-title" className="text-lg font-semibold text-foreground">{t("signalsTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("signalsDescription")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label={t("filters.label")}>
              <label className="relative min-w-[220px] flex-1 sm:flex-none">
                <span className="sr-only">{t("filters.search")}</span>
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <input
                  value={filters.query}
                  onChange={(event) => updateFilter("query", event.target.value)}
                  placeholder={t("filters.search")}
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  data-testid="friction-filter-search"
                />
              </label>
              <FilterSelect label={t("filters.category")} value={filters.category} onChange={(value) => updateFilter("category", value as FrictionSignalFilters["category"])}>
                <option value="all">{t("filters.allCategories")}</option>
                {FRICTION_CATEGORIES.map((category) => <option value={category} key={category}>{t(`categories.${category}` as never)}</option>)}
              </FilterSelect>
              <FilterSelect label={t("filters.severity")} value={filters.severity} onChange={(value) => updateFilter("severity", value as FrictionSignalFilters["severity"])}>
                <option value="all">{t("filters.allSeverities")}</option>
                {(["critical", "high", "medium", "low"] as const).map((value) => <option value={value} key={value}>{t(`severity.${value}` as never)}</option>)}
              </FilterSelect>
              <FilterSelect label={t("filters.confidence")} value={filters.confidence} onChange={(value) => updateFilter("confidence", value as FrictionSignalFilters["confidence"])}>
                <option value="all">{t("filters.allConfidence")}</option>
                {(["high", "medium", "low", "unknown"] as const).map((value) => <option value={value} key={value}>{t(`confidence.${value}` as never)}</option>)}
              </FilterSelect>
              <FilterSelect label={t("filters.milestone")} value={filters.milestoneId} onChange={(value) => updateFilter("milestoneId", value)}>
                <option value="all">{t("filters.allMilestones")}</option>
                {milestoneOptions.map((id) => <option value={id} key={id}>{props.milestoneTitles[id] ?? compactId(id)}</option>)}
              </FilterSelect>
              <FilterSelect label={t("filters.task")} value={filters.taskId} onChange={(value) => updateFilter("taskId", value)}>
                <option value="all">{t("filters.allTasks")}</option>
                {taskOptions.map((id) => <option value={id} key={id}>{props.taskTitles[id] ?? compactId(id)}</option>)}
              </FilterSelect>
              <FilterSelect label={t("filters.scope")} value={filters.scope} onChange={(value) => updateFilter("scope", value as FrictionSignalFilters["scope"])}>
                <option value="top20">{t("filters.top20")}</option>
                <option value="all">{t("filters.allSignals")}</option>
              </FilterSelect>
              <FilterSelect label={t("filters.sort")} value={filters.sort} onChange={(value) => updateFilter("sort", value as FrictionSignalFilters["sort"])}>
                <option value="score">{t("filters.score")}</option>
                <option value="newest">{t("filters.newest")}</option>
                <option value="oldest">{t("filters.oldest")}</option>
              </FilterSelect>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground sm:px-5">
          <span>{t("showing", { shown: filtered.length, total: props.signals.length })}</span>
          {(filters.query || filters.category !== "all" || filters.severity !== "all" || filters.confidence !== "all" || filters.milestoneId !== "all" || filters.taskId !== "all") && (
            <button type="button" onClick={() => setFilters(DEFAULT_FRICTION_SIGNAL_FILTERS)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">{t("filters.clear")}</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptySignals hasAny={props.signals.length > 0} onReset={() => setFilters(DEFAULT_FRICTION_SIGNAL_FILTERS)} />
        ) : (
          <ol className="divide-y divide-border" data-testid="friction-signal-list">
            {filtered.map((signal, index) => {
              const taskTitle = signal.taskId ? props.taskTitles[signal.taskId] : null;
              const rank = props.topSignalIds.indexOf(signal.signalId) + 1;
              return (
                <li key={signal.signalId} className="p-4 transition-colors hover:bg-muted/20 sm:p-5" data-testid="friction-signal-row" data-category={signal.category}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background text-lg font-semibold", scoreTone(signal.score))} aria-label={t("independentScore", { score: signal.score })}>
                        {signal.score}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {topSet.has(signal.signalId) && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">#{rank || index + 1}</span>}
                          <h3 className="font-semibold text-foreground">{signalLabel(signal)}</h3>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", badgeTone(signal.severity))}>{t(`severity.${signal.severity}` as never)}</span>
                          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{t(`categories.${signal.category}` as never)}</span>
                        </div>
                        {taskTitle && <p className="mt-1 truncate text-sm font-medium text-foreground/80">{taskTitle}</p>}
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {t("evidenceSummary", {
                            observed: formatValue(signal.observedValue),
                            baseline: formatValue(signal.expectedOrBaseline),
                          })}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{t("labels.confidence")}: <strong className="font-medium text-foreground">{t(`confidence.${signal.confidence}` as never)}</strong></span>
                          <span>{t("labels.evidence")}: <strong className="font-medium text-foreground">{signal.evidenceRefs.length}</strong></span>
                          <span>{t("labels.lastEvidence")}: <strong className="font-medium text-foreground">{formatDate(signal.evidenceTimestampEnd ?? signal.evidenceTimestampStart)}</strong></span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => openEvidence(signal, event.currentTarget)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      data-testid="open-friction-evidence"
                    >
                      {t("viewEvidence")}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-amber-500" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">{t("gapsTitle")}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("gapsDescription")}</p>
          {props.gaps.length === 0 ? (
            <p className="mt-4 rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">{t("noGaps")}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {props.gaps.map((gap) => (
                <li key={`${gap.category}:${gap.signalType}`} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{t(`signalKinds.${signalKindKey(gap.signalType)}` as never)}</span>
                    <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{t(`evidenceStatus.${gap.status}` as never)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t("gapReason", { reason: gap.reason })}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{t("labels.sources")}: {gap.sourceTables.join(", ") || t("values.unknown")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <details className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-foreground">
            <Database className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            {t("sourceAuditTitle")}
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">{t("sourceAuditDescription")}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {props.sourceAudit.map((source) => (
              <div key={source.table} className="rounded-lg border border-border p-3">
                <dt className="truncate font-mono text-xs text-muted-foreground" title={source.table}>{source.table}</dt>
                <dd className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{t(`sourceStatus.${source.status}` as never)}</span>
                  <span className="text-xs text-muted-foreground">{source.rowCount}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <span>{t("sourceCounts.milestones", { count: props.milestoneCount })}</span>
            <span>{t("sourceCounts.events", { count: props.eventCount })}</span>
            <span>{t("sourceCounts.dependencies", { count: props.dependencyCount })}</span>
            <span>{t("sourceCounts.timeEntries", { count: props.timeEntryCount })}</span>
          </div>
          {(props.limitations.length > 0 || props.rejectedEvidenceCount > 0) && (
            <div className="mt-4 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{t("limitationsTitle")}</p>
              <p className="mt-1">{t("rejectedEvidence", { count: props.rejectedEvidenceCount })}</p>
              <ul className="mt-2 list-inside list-disc space-y-1 font-mono">
                {props.limitations.slice(0, 12).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
        </details>
      </section>

      {selectedSignal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedSignal(null); }}>
          <aside
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="friction-evidence-title"
            className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background shadow-2xl"
            data-testid="friction-evidence-panel"
            onKeyDown={trapDialogFocus}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background/95 p-5 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t("evidencePanel.eyebrow")}</p>
                <h2 id="friction-evidence-title" className="mt-1 text-xl font-semibold text-foreground">{signalLabel(selectedSignal)}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedSignal.signalType}</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setSelectedSignal(null)} aria-label={t("evidencePanel.close")} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-6 p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <EvidenceStat label={t("labels.score")} value={String(selectedSignal.score)} />
                <EvidenceStat label={t("labels.severity")} value={t(`severity.${selectedSignal.severity}` as never)} />
                <EvidenceStat label={t("labels.confidence")} value={t(`confidence.${selectedSignal.confidence}` as never)} />
                <EvidenceStat label={t("labels.status")} value={t(`evidenceStatus.${selectedSignal.evidenceStatus}` as never)} />
              </div>

              {(selectedSignal.taskId || selectedSignal.milestoneId) && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="font-semibold text-foreground">{t("evidencePanel.entityContext")}</h3>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("labels.task")}</dt>
                      <dd className="mt-1 text-sm font-medium text-foreground">{selectedSignal.taskId ? props.taskTitles[selectedSignal.taskId] ?? compactId(selectedSignal.taskId) : t("values.notApplicable")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("labels.milestone")}</dt>
                      <dd className="mt-1 text-sm font-medium text-foreground">{selectedSignal.milestoneId ? props.milestoneTitles[selectedSignal.milestoneId] ?? compactId(selectedSignal.milestoneId) : t("values.notApplicable")}</dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-semibold text-foreground">{t("evidencePanel.observation")}</h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">{t("labels.observed")}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{formatValue(selectedSignal.observedValue)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t("labels.baseline")}</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{formatValue(selectedSignal.expectedOrBaseline)}</dd></div>
                </dl>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("evidenceSummary", { observed: formatValue(selectedSignal.observedValue), baseline: formatValue(selectedSignal.expectedOrBaseline) })}</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">{t("evidencePanel.trace")}</h3>
                <div className="mt-3 rounded-xl border border-border bg-card p-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-muted-foreground">{t("labels.start")}</dt><dd className="mt-1 text-foreground">{formatDate(selectedSignal.evidenceTimestampStart)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{t("labels.end")}</dt><dd className="mt-1 text-foreground">{formatDate(selectedSignal.evidenceTimestampEnd)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{t("labels.engine")}</dt><dd className="mt-1 font-mono text-xs text-foreground">{selectedSignal.source}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{t("labels.signalId")}</dt><dd className="mt-1 font-mono text-xs text-foreground" title={selectedSignal.signalId}>{compactId(selectedSignal.signalId)}</dd></div>
                  </dl>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground">{t("evidencePanel.timeline")}</h3>
                {selectedTimeline.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{t("evidencePanel.timelineUnavailable")}</p>
                ) : (
                  <ol className="relative mt-4 space-y-4 border-l border-emerald-500/40 pl-5" data-testid="friction-evidence-timeline">
                    {selectedTimeline.map((event) => (
                      <li key={event.eventId} className="relative">
                        <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-background" />
                        <div className="rounded-lg border border-border bg-card p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-mono text-sm font-semibold text-foreground">{event.eventType}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{t("evidencePanel.sequence", { number: event.sequenceNumber })}</p>
                            </div>
                            <time className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</time>
                          </div>
                          {(event.fromState || event.toState) && (
                            <p className="mt-2 text-sm text-muted-foreground">{event.fromState ?? t("values.unknown")} <span aria-hidden="true">→</span> {event.toState ?? t("values.unknown")}</p>
                          )}
                          <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{event.eventId}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-foreground">{t("evidencePanel.references", { count: selectedSignal.evidenceRefs.length })}</h3>
                <ul className="mt-3 space-y-2">
                  {selectedSignal.evidenceRefs.map((ref, index) => (
                    <li key={`${ref.kind}:${ref.id}:${index}`} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{ref.kind}</p>
                          {ref.label && <p className="mt-1 text-sm text-foreground">{ref.label}</p>}
                          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{ref.id}</p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label={t("evidencePanel.sourceReference")} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedSignal.metadata && Object.keys(selectedSignal.metadata).length > 0 && (
                <details className="rounded-xl border border-border bg-card p-4">
                  <summary className="cursor-pointer font-medium text-foreground">{t("evidencePanel.metadata")}</summary>
                  <dl className="mt-3 space-y-2 text-sm">
                    {Object.entries(selectedSignal.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-4 border-t border-border pt-2 first:border-0 first:pt-0">
                        <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                        <dd className="text-right text-foreground">{formatValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <Link href={frictionSignalEntityHref(props.projectId, selectedSignal)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                  {t("evidencePanel.openEntity")}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href={`/projects/${props.projectId}/execution-map/living-graph${selectedSignal.taskId ? `?task=${encodeURIComponent(selectedSignal.taskId)}` : ""}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                  {t("evidencePanel.openLivingGraph")}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail, muted = false }: { icon: typeof BarChart3; label: string; value: string; detail: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4", muted ? "text-muted-foreground" : "text-emerald-600")} aria-hidden="true" />
      </div>
      <p className={cn("mt-3 text-2xl font-semibold", muted ? "text-muted-foreground" : "text-foreground")}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500">
        {children}
      </select>
    </label>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold text-foreground">{value}</p></div>;
}

function EmptySignals({ hasAny, onReset }: { hasAny: boolean; onReset: () => void }) {
  const t = useTranslations("frictionRadar");
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center" data-testid="friction-empty-state">
      <div className="rounded-full bg-muted p-4"><FileSearch className="h-7 w-7 text-muted-foreground" aria-hidden="true" /></div>
      <h3 className="mt-4 font-semibold text-foreground">{hasAny ? t("empty.filteredTitle") : t("empty.noSignalsTitle")}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{hasAny ? t("empty.filteredDescription") : t("empty.noSignalsDescription")}</p>
      {hasAny && <button type="button" onClick={onReset} className="mt-4 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">{t("filters.clear")}</button>}
    </div>
  );
}
