"use client";

// ============================================================================
// ProjectOps360° — Milestone Process Flow · Living Graph UI Consumer (Task 8)
// ============================================================================
// PRESENTATION ONLY (PEG-MPF-LIVING-GRAPH-UI-CONSUMER). This view renders the
// MPF Engine view-model built server-side from the engine projection. It holds
// selection + presentation-filter state and nothing else: no transitions are
// rebuilt, no metrics recalculated, no health classified, no findings detected,
// no Isabella language generated, no LLM called, no canonical truth mutated.
// ============================================================================

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, Filter, Flag, Info, X } from "lucide-react";
import type {
  MilestoneFlowViewModel,
  MilestoneFlowTransitionVM,
  MilestoneFlowFilters,
} from "@/lib/milestone-flow-ui/selectors";
import { filterMilestoneFlowTransitions } from "@/lib/milestone-flow-ui/selectors";
import { healthBadgeClass, segmentBarClass, confidenceClass } from "./style-maps";
import { TransitionDetailPanel } from "./transition-detail-panel";

const HEALTH_STATUSES = [
  "healthy",
  "watch",
  "degraded",
  "blocked",
  "at_risk",
  "recovering",
  "regressed",
  "unknown",
] as const;

const SEGMENT_TYPES = [
  "active_work",
  "waiting",
  "blocked",
  "decision_delay",
  "approval_delay",
  "rework",
  "handoff",
  "review",
  "external_constraint",
  "unknown",
] as const;

const FINDING_TYPES = [
  "blocker",
  "waiting_time",
  "decision_delay",
  "approval_delay",
  "rework",
  "bottleneck",
  "propagation",
] as const;

const SEVERITIES = ["critical", "high", "medium", "low", "unknown"] as const;

export interface MilestoneFlowViewProps {
  vm: MilestoneFlowViewModel;
  milestoneCount: number;
  eventCount: number;
}

export function MilestoneFlowView({ vm, milestoneCount, eventCount }: MilestoneFlowViewProps) {
  const t = useTranslations("milestoneFlow");

  const [selectedId, setSelectedId] = useState<string | null>(
    vm.transitions[0]?.transitionId ?? null,
  );
  const [healthFilter, setHealthFilter] = useState<string[]>([]);
  const [segmentType, setSegmentType] = useState<string>("");
  const [findingType, setFindingType] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [onlyUncertainty, setOnlyUncertainty] = useState(false);
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [onlyOpenFindings, setOnlyOpenFindings] = useState(false);

  const hasActiveFilters =
    healthFilter.length > 0 || !!segmentType || !!findingType || !!severity ||
    onlyUncertainty || onlyWarnings || onlyOpenFindings;

  // Presentation filtering only — the view-model itself is never mutated.
  const filtered = useMemo(() => {
    const filters: MilestoneFlowFilters = {
      healthStatuses: healthFilter.length > 0 ? (healthFilter as MilestoneFlowFilters["healthStatuses"]) : undefined,
      segmentTypes: segmentType ? ([segmentType] as MilestoneFlowFilters["segmentTypes"]) : undefined,
      findingTypes: findingType ? [findingType] : undefined,
      severities: severity ? [severity] : undefined,
      onlyWithUncertainty: onlyUncertainty,
      onlyWithWarnings: onlyWarnings,
      onlyWithOpenFindings: onlyOpenFindings,
    };
    return filterMilestoneFlowTransitions(vm.transitions, filters);
  }, [vm.transitions, healthFilter, segmentType, findingType, severity, onlyUncertainty, onlyWarnings, onlyOpenFindings]);

  const selected = filtered.find((tr) => tr.transitionId === selectedId) ?? null;

  function toggleHealth(status: string) {
    setHealthFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  }

  function clearFilters() {
    setHealthFilter([]);
    setSegmentType("");
    setFindingType("");
    setSeverity("");
    setOnlyUncertainty(false);
    setOnlyWarnings(false);
    setOnlyOpenFindings(false);
  }

  // ── Empty states (engine had nothing to derive) ─────────────────────────────
  if (vm.transitions.length === 0) {
    const emptyKey =
      milestoneCount === 0 ? "noMilestones" : eventCount === 0 ? "insufficientEvidence" : "noTransitions";
    return (
      <div className="space-y-4">
        <ObservabilityStrip vm={vm} />
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
          <Flag className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">{t(`empty.${emptyKey}.title`)}</h2>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{t(`empty.${emptyKey}.description`)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ObservabilityStrip vm={vm} />

      {/* ── Filters (presentation only) ──────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3 w-3" aria-hidden />
            {t("filters.title")}
          </span>
          {HEALTH_STATUSES.map((status) => {
            const active = healthFilter.includes(status);
            const count = vm.healthCounts[status] ?? 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleHealth(status)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  active ? healthBadgeClass(status) : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`health.statuses.${status}`)}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <select
            value={segmentType}
            onChange={(e) => setSegmentType(e.target.value)}
            aria-label={t("filters.segmentType")}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">{t("filters.segmentType")}: {t("filters.all")}</option>
            {SEGMENT_TYPES.map((s) => (
              <option key={s} value={s}>{t(`segmentsPanel.types.${s}`)}</option>
            ))}
          </select>
          <select
            value={findingType}
            onChange={(e) => setFindingType(e.target.value)}
            aria-label={t("filters.findingType")}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">{t("filters.findingType")}: {t("filters.all")}</option>
            {FINDING_TYPES.map((f) => (
              <option key={f} value={f}>{t(`findingsPanel.types.${f}`)}</option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            aria-label={t("filters.severity")}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">{t("filters.severity")}: {t("filters.all")}</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{t(`findingsPanel.severities.${s}`)}</option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={onlyUncertainty} onChange={(e) => setOnlyUncertainty(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
            {t("filters.onlyUncertainty")}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={onlyWarnings} onChange={(e) => setOnlyWarnings(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
            {t("filters.onlyWarnings")}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={onlyOpenFindings} onChange={(e) => setOnlyOpenFindings(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
            {t("filters.onlyOpenFindings")}
          </label>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
              {t("filters.clear")}
            </button>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {t("filters.showing", { shown: filtered.length, total: vm.transitions.length })}
          </span>
        </div>
      </div>

      {/* ── Corridor list + detail ───────────────────────────────────────── */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-2" data-testid="mpf-corridors">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
              {t("filters.noMatch")}
            </div>
          ) : (
            filtered.map((tr) => (
              <TransitionCorridorCard
                key={tr.transitionId}
                transition={tr}
                isSelected={tr.transitionId === selectedId}
                onSelect={() => setSelectedId(tr.transitionId)}
              />
            ))
          )}
        </div>
        <div>
          {selected ? (
            <TransitionDetailPanel transition={selected} />
          ) : (
            <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-xs text-muted-foreground">
              {t("selectPrompt")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Observability strip (engine-run summary — surfaced, never invented) ───────

function ObservabilityStrip({ vm }: { vm: MilestoneFlowViewModel }) {
  const t = useTranslations("milestoneFlow");
  const o = vm.observability;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
      <span>
        {t("observability.generatedAt")}{" "}
        <time dateTime={o.generatedAt} className="tabular-nums text-foreground/80">
          {o.generatedAt.replace("T", " ").slice(0, 16)} UTC
        </time>
      </span>
      <span>
        {t("observability.engine")} <code className="text-foreground/80">{o.engineVersion}</code> ·{" "}
        <code className="text-foreground/80">{o.configVersion}</code>
      </span>
      <span className="tabular-nums">{t("observability.summary", {
        transitions: o.transitionCount,
        segments: o.segmentCount,
        findings: o.delayFindingCount + o.reworkFindingCount + o.bottleneckFindingCount + o.constraintPropagationFindingCount,
        packets: o.isabellaPacketCount,
      })}</span>
      {o.unknownHealthCount > 0 && (
        <span className="inline-flex items-center gap-1">
          <Info className="h-3 w-3" aria-hidden />
          {t("observability.unknownHealth", { count: o.unknownHealthCount })}
        </span>
      )}
      {o.warningCount > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {t("observability.warnings", { count: o.warningCount })}
        </span>
      )}
      {vm.dataQualityFlags.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1">
          {t("observability.dataQuality")}:
          {vm.dataQualityFlags.map((f) => (
            <code key={f} className="rounded bg-muted px-1 py-px">{f}</code>
          ))}
        </span>
      )}
    </div>
  );
}

// ── Corridor card ─────────────────────────────────────────────────────────────

function TransitionCorridorCard({
  transition: tr,
  isSelected,
  onSelect,
}: {
  transition: MilestoneFlowTransitionVM;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("milestoneFlow");
  const health = tr.health;
  const status = health?.status ?? "unknown";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      data-testid={`mpf-corridor-${tr.transitionId}`}
      className={`block w-full rounded-lg border bg-card p-3 text-left transition-colors ${
        isSelected ? "border-primary/60 ring-1 ring-primary/40" : "border-border hover:border-primary/30"
      }`}
    >
      {/* Milestone anchors */}
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground">
          <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{tr.sourceMilestoneName ?? t("corridor.start")}</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground">
          <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{tr.targetMilestoneName}</span>
        </span>
      </div>

      {/* Health + state badges */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${healthBadgeClass(status)}`}>
          {t(`health.statuses.${status}`)}
        </span>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${confidenceClass(health?.confidence ?? "unknown")}`}>
          {t("health.confidence")}: {t(`confidence.${health?.confidence ?? "unknown"}`)}
        </span>
        <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
          {t(`corridor.transitionStatuses.${tr.transitionStatus}`)}
        </span>
        {health?.primaryReasonCode && (
          <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
            {t(`health.reasonCodes.${health.primaryReasonCode}`)}
          </span>
        )}
        {tr.hasUncertainty && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400">
            <Info className="h-3 w-3" aria-hidden />
            {t("corridor.uncertainty")}
          </span>
        )}
        {tr.hasWarnings && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {t("corridor.warnings")}
          </span>
        )}
      </div>

      {/* Segment corridor bar (proportional layout of ENGINE durations) */}
      {tr.segments.length > 0 && <SegmentCorridorBar transition={tr} />}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{t("corridor.segmentCount", { count: tr.segments.length })}</span>
        <span className="tabular-nums">{t("corridor.findingCount", { count: tr.findingCount })}</span>
        {tr.openFindingCount > 0 && (
          <span className="tabular-nums text-red-600 dark:text-red-400">
            {t("corridor.openFindingCount", { count: tr.openFindingCount })}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Proportional corridor bar. Widths are a LAYOUT of engine-calculated segment
 * durations — nothing is measured or recomputed here. Segments with unknown
 * duration render as fixed-width hatched slices (uncertainty stays visible).
 */
function SegmentCorridorBar({ transition: tr }: { transition: MilestoneFlowTransitionVM }) {
  const t = useTranslations("milestoneFlow");
  const known = tr.segments.filter((s) => s.durationMs != null && s.durationMs > 0);
  const totalKnown = known.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  return (
    <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={t("corridor.barLabel")}>
      {tr.segments.map((s) => {
        if (s.durationMs != null && s.durationMs > 0 && totalKnown > 0) {
          const pct = Math.max(3, (s.durationMs / totalKnown) * 100);
          return (
            <div
              key={s.segmentId}
              className={`${segmentBarClass(s.type)} h-full`}
              style={{ width: `${pct}%` }}
              title={`${t(`segmentsPanel.types.${s.type}`)} · ${s.durationLabel ?? t("metrics.unknownValue")}`}
            />
          );
        }
        return (
          <div
            key={s.segmentId}
            className={`${segmentBarClass(s.type)} h-full shrink-0 opacity-40 [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,.5)_2px,rgba(255,255,255,.5)_4px)]`}
            style={{ width: "10px" }}
            title={`${t(`segmentsPanel.types.${s.type}`)} · ${t("metrics.unknownValue")}`}
          />
        );
      })}
    </div>
  );
}
