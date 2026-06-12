"use client";

import { useState, useMemo } from "react";
import {
  Users,
  AlertTriangle,
  TrendingUp,
  Clock,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Circle,
  BrainCircuit,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseAvailabilityWindows } from "@/lib/labor/capacity";
import {
  buildGapExplanation,
  buildCapacitySummary,
} from "@/lib/labor/explanation";
import type {
  WeeklyCapacityGap,
  LaborCapacityResult,
  AvailabilityWindow,
} from "@/lib/labor/capacity";
import type { CapacitySummaryNarrative } from "@/lib/labor/explanation";
import type {
  LaborResource,
  Milestone,
  TradeTaxonomy,
  ShortageRiskLevel,
  Locale,
  ConstructionActivity,
} from "@/types/database";
import { getI18nValue } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Translations {
  title: string;
  description: string;
  summary: {
    totalTrades: string;
    shortageWeeks: string;
    criticalTrades: string;
    maxUtilization: string;
  };
  filters: {
    trade: string;
    week: string;
    milestone: string;
    location: string;
    criticalOnly: string;
    all: string;
    clear: string;
  };
  table: {
    trade: string;
    week: string;
    zone: string;
    requiredHC: string;
    availableHC: string;
    gapHC: string;
    requiredHrs: string;
    availableHrs: string;
    gapHrs: string;
    utilization: string;
    risk: string;
    criticalPath: string;
    activities: string;
    resources: string;
  };
  skills: {
    title: string;
    type: string;
    skillLevel: string;
    constraint: string;
    availability: string;
  };
  risk: Record<ShortageRiskLevel, string>;
  empty: string;
}

interface LaborCapacityFilters {
  trade: string | null;
  week: string | null;
  milestone: string | null;
  locationZone: string | null;
  criticalOnly: boolean;
}

interface LaborCapacityClientProps {
  projectId: string;
  projectTitle: string;
  capacity: LaborCapacityResult;
  resources: LaborResource[];
  activities: ConstructionActivity[];
  taxonomy: TradeTaxonomy[];
  milestones: Milestone[];
  locale: Locale;
  translations: Translations;
}

// ── Risk Badge ──────────────────────────────────────────────────────────────────

const RISK_STYLES: Record<ShortageRiskLevel, string> = {
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  medium:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  critical:
    "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

function RiskBadge({
  risk,
  label,
}: {
  risk: ShortageRiskLevel;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        RISK_STYLES[risk]
      )}
    >
      {label}
    </span>
  );
}

// ── Utilization Bar ─────────────────────────────────────────────────────────────

function UtilizationBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const capped = Math.min(value, 200);
  const barColor =
    value <= 80
      ? "bg-brand-500"
      : value <= 100
        ? "bg-amber-500"
        : value <= 125
          ? "bg-orange-500"
          : "bg-red-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${(capped / 200) * 100}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-10 text-right">{value}%</span>
    </div>
  );
}

// ── Constraint Badge ────────────────────────────────────────────────────────────

const CONSTRAINT_STYLES: Record<string, string> = {
  none: "bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300",
  partial_availability:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  over_allocated:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  shortage:
    "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  vendor_unconfirmed:
    "border border-red-300 text-red-800 dark:border-red-700 dark:text-red-300",
};

const CONSTRAINT_LABELS: Record<string, Record<Locale, string>> = {
  none: { en: "None", es: "Ninguna" },
  partial_availability: { en: "Partial", es: "Parcial" },
  over_allocated: { en: "Over-allocated", es: "Sobre-asignado" },
  shortage: { en: "Shortage", es: "Déficit" },
  vendor_unconfirmed: { en: "Vendor Unconfirmed", es: "Proveedor Sin Confirmar" },
};

// ── Skill Level Badge ───────────────────────────────────────────────────────────

const SKILL_STYLES: Record<string, string> = {
  apprentice:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  journeyman: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  senior: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
  master: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
};

// ── Resource Type Badge ─────────────────────────────────────────────────────────

const RESOURCE_TYPE_LABELS: Record<string, Record<Locale, string>> = {
  crew: { en: "Crew", es: "Cuadrilla" },
  specialist: { en: "Specialist", es: "Especialista" },
  inspector: { en: "Inspector", es: "Inspector" },
  vendor: { en: "Vendor", es: "Proveedor" },
  witness: { en: "Witness", es: "Testigo" },
};

// ── Availability Dots ────────────────────────────────────────────────────────────

function AvailabilityDots({ windows }: { windows: AvailabilityWindow[] }) {
  const statusColors: Record<string, string> = {
    available: "bg-brand-500",
    partial: "bg-amber-500",
    unavailable: "bg-red-500",
  };

  return (
    <div className="flex gap-0.5">
      {windows.map((w) => (
        <div
          key={w.week}
          className={cn("h-2.5 w-2.5 rounded-full", statusColors[w.status] ?? "bg-slate-300")}
          title={`${w.week}: ${w.status} (${w.available_hours}h)`}
        />
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────────

export function LaborCapacityClient({
  projectId,
  projectTitle,
  capacity,
  resources,
  activities,
  taxonomy,
  milestones,
  locale,
  translations: t,
}: LaborCapacityClientProps) {
  const [filters, setFilters] = useState<LaborCapacityFilters>({
    trade: null,
    week: null,
    milestone: null,
    locationZone: null,
    criticalOnly: false,
  });
  const [showSkills, setShowSkills] = useState(false);
  const [expandedGap, setExpandedGap] = useState<string | null>(null);

  // Build capacity summary narrative
  const summaryNarrative = useMemo(
    () =>
      buildCapacitySummary(
        capacity,
        resources,
        activities,
        milestones,
        taxonomy,
        locale
      ),
    [capacity, resources, activities, milestones, taxonomy, locale]
  );

  // Derive unique filter options from data
  const tradeOptions = useMemo(
    () => [...new Set(capacity.weeklyGaps.map((g) => g.tradeKey))].sort(),
    [capacity]
  );

  const weekOptions = useMemo(
    () => [...new Set(capacity.weeklyGaps.map((g) => g.weekLabel))].sort(),
    [capacity]
  );

  const locationOptions = useMemo(
    () =>
      [
        ...new Set(
          capacity.weeklyGaps
            .map((g) => g.locationZone)
            .filter(Boolean) as string[]
        ),
      ].sort(),
    [capacity]
  );

  const affectedMilestones = useMemo(
    () =>
      milestones.filter((m) =>
        capacity.affectedMilestoneIds.includes(m.id)
      ),
    [milestones, capacity.affectedMilestoneIds]
  );

  // Trade taxonomy label lookup
  const tradeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const tax of taxonomy) {
      map.set(
        tax.trade_key,
        getI18nValue(tax.label_i18n, locale) || tax.trade_key
      );
    }
    return map;
  }, [taxonomy, locale]);

  // Filter gaps
  const filteredGaps = useMemo(() => {
    return capacity.weeklyGaps.filter((gap) => {
      if (filters.trade && gap.tradeKey !== filters.trade) return false;
      if (filters.week && gap.weekLabel !== filters.week) return false;
      if (filters.locationZone && gap.locationZone !== filters.locationZone)
        return false;
      if (
        filters.milestone &&
        (gap.shortageRisk === "none" ||
          !capacity.affectedMilestoneIds.includes(filters.milestone))
      )
        return false;
      if (
        filters.criticalOnly &&
        gap.shortageRisk !== "high" &&
        gap.shortageRisk !== "critical"
      )
        return false;
      return true;
    });
  }, [capacity, filters]);

  // Filter resources for skills section based on trade filter
  const filteredResources = useMemo(() => {
    if (!filters.trade) return resources;
    return resources.filter((r) => r.trade_key === filters.trade);
  }, [resources, filters.trade]);

  const hasFilters =
    filters.trade ||
    filters.week ||
    filters.milestone ||
    filters.locationZone ||
    filters.criticalOnly;

  const clearFilters = () =>
    setFilters({
      trade: null,
      week: null,
      milestone: null,
      locationZone: null,
      criticalOnly: false,
    });

  // Count unique trades in filtered view
  const filteredTradeCount = useMemo(
    () => new Set(filteredGaps.map((g) => g.tradeKey)).size,
    [filteredGaps]
  );

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.description}
        </p>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Users}
          value={filteredTradeCount}
          label={t.summary.totalTrades}
          color="brand"
        />
        <SummaryCard
          icon={Clock}
          value={capacity.shortageWeekCount}
          label={t.summary.shortageWeeks}
          color={capacity.shortageWeekCount > 0 ? "amber" : "brand"}
        />
        <SummaryCard
          icon={AlertTriangle}
          value={capacity.criticalTradeCount}
          label={t.summary.criticalTrades}
          color={capacity.criticalTradeCount > 0 ? "red" : "brand"}
        />
        <SummaryCard
          icon={TrendingUp}
          value={capacity.maxUtilizationPct !== null ? `${capacity.maxUtilizationPct}%` : "—"}
          label={t.summary.maxUtilization}
          color={
            capacity.maxUtilizationPct !== null && capacity.maxUtilizationPct > 100
              ? "red"
              : "brand"
          }
        />
      </div>

      {/* ── Capacity Narrative ─────────────────────────────────────────────── */}
      <CapacityNarrativeBlock
        narrative={summaryNarrative}
        taxonomy={taxonomy}
        locale={locale}
        translations={t}
      />

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Filter className="h-4 w-4 text-muted-foreground" />

        <select
          value={filters.trade ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, trade: e.target.value || null }))
          }
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        >
          <option value="">{t.filters.trade}: {t.filters.all}</option>
          {tradeOptions.map((tk) => (
            <option key={tk} value={tk}>
              {tradeLabelMap.get(tk) || tk}
            </option>
          ))}
        </select>

        <select
          value={filters.week ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, week: e.target.value || null }))
          }
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        >
          <option value="">{t.filters.week}: {t.filters.all}</option>
          {weekOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <select
          value={filters.milestone ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, milestone: e.target.value || null }))
          }
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        >
          <option value="">{t.filters.milestone}: {t.filters.all}</option>
          {affectedMilestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>

        <select
          value={filters.locationZone ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, locationZone: e.target.value || null }))
          }
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        >
          <option value="">{t.filters.location}: {t.filters.all}</option>
          {locationOptions.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filters.criticalOnly}
            onChange={(e) =>
              setFilters((f) => ({ ...f, criticalOnly: e.target.checked }))
            }
            className="rounded border-border text-red-600 focus:ring-red-500"
          />
          <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
          {t.filters.criticalOnly}
        </label>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="h-3 w-3" />
            {t.filters.clear}
          </button>
        )}
      </div>

      {/* ── Capacity Matrix Table ──────────────────────────────────────────── */}
      {filteredGaps.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <th className="sticky left-0 bg-muted/50 px-3 py-2.5 text-left font-medium">
                    {t.table.trade}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    {t.table.week}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    {t.table.zone}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.table.requiredHC}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.table.availableHC}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.table.gapHC}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.table.requiredHrs}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.table.availableHrs}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.table.gapHrs}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium min-w-[120px]">
                    {t.table.utilization}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    {t.table.risk}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium">
                    {t.table.criticalPath}
                  </th>
                  <th className="px-3 py-2.5 w-8" /> {/* expand button column */}
                </tr>
              </thead>
              <tbody>
                {filteredGaps.map((gap, i) => {
                  const rowKey = `${gap.tradeKey}-${gap.weekLabel}-${gap.locationZone ?? "all"}`;
                  const isExpanded = expandedGap === rowKey;
                  const explanation =
                    gap.shortageRisk !== "none"
                      ? buildGapExplanation(
                          gap,
                          resources,
                          activities,
                          milestones,
                          taxonomy,
                          capacity.affectedMilestoneIds,
                          locale
                        )
                      : null;

                  return (
                    <CapacityRowWithExplanation
                      key={rowKey}
                      rowKey={rowKey}
                      gap={gap}
                      tradeLabel={tradeLabelMap.get(gap.tradeKey) || gap.tradeKey}
                      riskLabel={t.risk[gap.shortageRisk]}
                      isOdd={i % 2 === 0}
                      isExpanded={isExpanded}
                      explanation={explanation}
                      onToggleExpand={() =>
                        setExpandedGap(isExpanded ? null : rowKey)
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Skills & Resources Section ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => setShowSkills(!showSkills)}
          className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          {showSkills ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {t.skills.title}
          <span className="text-muted-foreground">
            ({filteredResources.length})
          </span>
        </button>

        {showSkills && (
          <div className="border-t border-border p-4">
            {filteredResources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t.empty}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredResources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary Card ────────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  color: "brand" | "amber" | "red";
}) {
  const colorMap = {
    brand: "text-brand-600 dark:text-brand-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
  };

  const bgMap = {
    brand: "bg-brand-50 dark:bg-brand-950/30",
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
          <p className={cn("text-xl font-bold tabular-nums", colorMap[color])}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Capacity Table Row (with expandable explanation) ─────────────────────────────

function CapacityRowWithExplanation({
  rowKey,
  gap,
  tradeLabel,
  riskLabel,
  isOdd,
  isExpanded,
  explanation,
  onToggleExpand,
}: {
  rowKey: string;
  gap: WeeklyCapacityGap;
  tradeLabel: string;
  riskLabel: string;
  isOdd: boolean;
  isExpanded: boolean;
  explanation: string | null;
  onToggleExpand: () => void;
}) {
  const gapHcColor =
    gap.gapHeadcount < 0
      ? "text-red-600 dark:text-red-400 font-medium"
      : gap.gapHeadcount === 0
        ? "text-muted-foreground"
        : "text-brand-600 dark:text-brand-400";

  const gapHrsColor =
    gap.gapHours < 0
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  const hasExplanation = explanation !== null;

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
          {tradeLabel}
        </td>
        <td className="px-3 py-2 tabular-nums whitespace-nowrap">
          {gap.weekLabel}
        </td>
        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
          {gap.locationZone || "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{gap.requiredHeadcount}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {gap.availableHeadcount}
        </td>
        <td className={cn("px-3 py-2 text-right tabular-nums", gapHcColor)}>
          {gap.gapHeadcount > 0 ? "+" : ""}
          {gap.gapHeadcount}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {gap.requiredHours.toFixed(0)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {gap.availableHours.toFixed(0)}
        </td>
        <td className={cn("px-3 py-2 text-right tabular-nums", gapHrsColor)}>
          {gap.gapHours > 0 ? "+" : ""}
          {gap.gapHours.toFixed(0)}
        </td>
        <td className="px-3 py-2">
          <UtilizationBar value={gap.utilizationPct} />
        </td>
        <td className="px-3 py-2">
          <RiskBadge risk={gap.shortageRisk} label={riskLabel} />
        </td>
        <td className="px-3 py-2 text-center">
          {gap.criticalPathImpact ? (
            <Circle className="h-3 w-3 fill-red-500 text-red-500 mx-auto" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-1 py-2 text-center">
          {hasExplanation && (
            <button
              onClick={onToggleExpand}
              className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle explanation"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </td>
      </tr>
      {isExpanded && explanation && (
        <tr className="bg-muted/10 border-b border-border">
          <td colSpan={13} className="px-4 py-3">
            <div className="flex items-start gap-2">
              <BrainCircuit className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/90 leading-relaxed">
                {explanation}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Resource Card ───────────────────────────────────────────────────────────────

function ResourceCard({
  resource,
  locale,
}: {
  resource: LaborResource;
  locale: Locale;
}) {
  const windows = parseAvailabilityWindows(resource.availability);
  const constraintType =
    (resource.constraints?.type as string) ?? "none";

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{resource.name}</p>
          <p className="text-xs text-muted-foreground">
            {resource.trade_key}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
            SKILL_STYLES[resource.skill_level] ?? "bg-slate-100 text-slate-700"
          )}
        >
          {resource.skill_level}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {RESOURCE_TYPE_LABELS[resource.resource_type]?.[locale] ??
            resource.resource_type}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            CONSTRAINT_STYLES[constraintType] ?? CONSTRAINT_STYLES.none
          )}
        >
          {CONSTRAINT_LABELS[constraintType]?.[locale] ?? constraintType}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {resource.headcount} HC · {resource.capacity_hours_per_week}h/wk
        </span>
      </div>

      {windows.length > 0 && <AvailabilityDots windows={windows} />}

      {constraintType !== "none" && Boolean(resource.constraints?.description_i18n) && (
        <p className="text-[10px] text-muted-foreground leading-tight">
          {String(
            getI18nValue(
              resource.constraints!.description_i18n as Record<string, string>,
              locale
            ) ?? ""
          )}
        </p>
      )}
    </div>
  );
}

// ── Capacity Narrative Block ────────────────────────────────────────────────────

function CapacityNarrativeBlock({
  narrative,
  taxonomy,
  locale,
  translations: t,
}: {
  narrative: CapacitySummaryNarrative;
  taxonomy: TradeTaxonomy[];
  locale: Locale;
  translations: Translations;
}) {
  const isEn = locale === "en";

  // Don't render if there's no risk at all
  if (narrative.overallSeverity === "none") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
        <BrainCircuit className="h-5 w-5 text-brand-500 shrink-0" />
        <p className="text-sm text-foreground/90">
          {isEn
            ? "No labor capacity risks detected. All trades have adequate coverage across the project schedule."
            : "No se detectaron riesgos de capacidad laboral. Todos los oficios tienen cobertura adecuada en el cronograma del proyecto."}
        </p>
      </div>
    );
  }

  const v = narrative.summaryValues;
  const severityStyle = RISK_STYLES[narrative.overallSeverity];

  // Build cascade risk text
  const cascadeText = narrative.cascadeRisks.length > 0
    ? narrative.cascadeRisks.map((cr) => {
        const tradeLabel =
          taxonomy.find((tx) => tx.trade_key === cr.tradeKey)
            ? getI18nValue(
                taxonomy.find((tx) => tx.trade_key === cr.tradeKey)!.label_i18n,
                locale
              )
            : cr.tradeKey;
        return isEn
          ? `${tradeLabel} gaps in ${cr.weekLabel} could impact ${cr.affectedMilestoneIds.length} downstream milestones`
          : `Brechas de ${tradeLabel} en ${cr.weekLabel} podrían impactar ${cr.affectedMilestoneIds.length} hitos aguas abajo`;
      }).join(". ")
    : null;

  // Build summary sentence
  const summarySentence = isEn
    ? `The project shows ${v.severity} labor capacity risk across ${v.tradeCount} trade(s) during ${v.weekCount} week(s). The most affected trade is ${v.mostCriticalTrade}.`
    : `El proyecto presenta riesgo de capacidad laboral ${v.severity} en ${v.tradeCount} oficio(s) durante ${v.weekCount} semana(s). El oficio más afectado es ${v.mostCriticalTrade}.`;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <BrainCircuit className="h-5 w-5 text-brand-500 mt-0.5 shrink-0" />
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                severityStyle
              )}
            >
              {t.risk[narrative.overallSeverity]}
            </span>
            <span className="text-xs text-muted-foreground">
              {isEn
                ? `${v.criticalGapCount} critical gap(s)`
                : `${v.criticalGapCount} brecha(s) crítica(s)`}
            </span>
          </div>

          <p className="text-sm text-foreground/90 leading-relaxed">
            {summarySentence}
          </p>

          {cascadeText && (
            <div className="flex items-start gap-1.5 pl-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                {cascadeText}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}