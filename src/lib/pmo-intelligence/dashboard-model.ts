// ============================================================================
// PMO Intelligence Center — dashboard slice (CAP-048 Phase 2, M5/M6)
// ============================================================================
// The shape Milestone 5's panels render, derived from the composed read model
// and nothing else.
//
// It exists for two reasons:
//
//   1. SERIALISATION. `PmoIntelligenceModel` holds a `Map` (blocked days per
//      project) and the graph model holds `Map`/`Set` values. None of those
//      survive the server-action boundary, so the reload path needs a flat
//      shape. Passing the raw model would work on first paint (server render)
//      and silently degrade after the first reload — the worst kind of bug,
//      because it looks fine until a filter is touched.
//
//   2. TRACEABILITY. Every KPI here carries the function that produced it. A
//      number a PMO cannot trace back to its source is a number they cannot
//      check, and ADR-012 §1 makes that traceability a contract rather than a
//      convention.
//
// What this module must NEVER do — and the tests assert it does not:
//
//   - Compute a metric. Values are COPIED. `parseKpiValue` reads a string the
//     Command Center already formatted; it does not recompute the figure, and
//     when the string is not parseable the KPI reports `unavailable` rather
//     than falling back to 0. A zero is a claim.
//   - Invent a fallback. An absent source produces `{ state: "unavailable" }`
//     with a reason, never a plausible-looking number.
// ============================================================================

import type { CommandCenterData } from "@/lib/command-center/service";
import type { MetricValue } from "@/lib/pmo-living-graph/portfolio-metrics";
import type { PmoPiInsight } from "@/lib/pmo-process-intelligence/insights";
import type { PmoKpiKey } from "./kpi-bindings";
import { KPI_UNIT } from "./kpi-bindings";
import type { PmoIntelligenceModel } from "./read-model.server";

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

export interface PmoKpi {
  key: PmoKpiKey;
  value: MetricValue;
  unit: (typeof KPI_UNIT)[PmoKpiKey];
  /**
   * Sub-line the source produced, or null. Copied verbatim from Dashboard 1's
   * own KPI card so the two screens read identically.
   */
  subtitle: string | null;
  /**
   * The function that produced this figure. Mandatory: ADR-012 §1 requires a
   * Dashboard 3 number to be traceable to the Dashboard 1/2 function behind it.
   */
  source: string;
}

/**
 * Read a number out of a Command Center KPI string.
 *
 * Dashboard 1 renders KPI values as display strings ("+12.4%", "37"). This
 * recovers the number so the unit can be re-rendered correctly, WITHOUT
 * recomputing it — the arithmetic already happened in `service.ts`.
 *
 * Returns null rather than 0 for anything unparseable. Returning 0 would turn
 * "we could not read this" into "the value is zero", which is exactly the
 * failure `MetricValue` exists to prevent.
 */
export function parseKpiValue(raw: string | undefined): number | null {
  if (raw == null) return null;
  // Strip only presentation: sign is kept (a negative variance is a fact),
  // separators and the unit suffix are not part of the number.
  const cleaned = raw.replace(/[%\s,]/g, "");
  if (cleaned === "" || !/^[+-]?\d*\.?\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function fromCommandCenterKpi(
  commandCenter: CommandCenterData | null,
  sourceKey: string,
): { value: MetricValue; subtitle: string | null } {
  if (!commandCenter) {
    return { value: { state: "unavailable", reason: "command-center" }, subtitle: null };
  }
  const card = commandCenter.kpis.find((kpi) => kpi.key === sourceKey);
  if (!card) {
    return { value: { state: "unavailable", reason: `kpi:${sourceKey}` }, subtitle: null };
  }
  const parsed = parseKpiValue(card.value);
  return {
    value: parsed == null ? { state: "unavailable", reason: `kpi:${sourceKey}` } : { state: "ok", value: parsed },
    subtitle: card.subtitle || null,
  };
}

/**
 * The eight KPIs of the unified bar.
 *
 * Each is bound to ONE source, named. Where Dashboard 1 and the graph engine
 * both have an opinion (projects, projects at risk), Dashboard 1 wins: it is
 * the surface a PMO has been reading for months and REG-010 is about surfaces
 * agreeing, not about picking the technically nicer source.
 */
export function buildKpis(model: {
  commandCenter: CommandCenterData | null;
  graphMetrics: {
    sharedResources: MetricValue;
    criticalNodes: MetricValue;
    projectsAtRisk: MetricValue;
    blockedDays: MetricValue;
  };
  blockedDaysTotal: number | null;
}): PmoKpi[] {
  const cc = model.commandCenter;

  const health: MetricValue = cc
    ? { state: "ok", value: cc.portfolioHealth.overall }
    : { state: "unavailable", reason: "command-center" };

  const projects = fromCommandCenterKpi(cc, "active_projects");
  const budget = fromCommandCenterKpi(cc, "budget_variance");
  const decisions = fromCommandCenterKpi(cc, "pm_decisions");

  // Blocked days: the Phase 2 event-log pass is the only engine that computes
  // it. The graph metric is consulted first so an `unavailable` reason from
  // there is preserved rather than replaced with a fabricated zero.
  const blockedDays: MetricValue =
    model.blockedDaysTotal != null
      ? { state: "ok", value: Math.round(model.blockedDaysTotal * 10) / 10 }
      : model.graphMetrics.blockedDays;

  return [
    {
      key: "portfolioHealth",
      value: health,
      unit: KPI_UNIT.portfolioHealth,
      subtitle: cc?.portfolioHealth.derivedFrom ?? null,
      source: "command-center/service.getCommandCenterSummary → portfolioHealth.overall",
    },
    {
      key: "projects",
      value: projects.value,
      unit: KPI_UNIT.projects,
      subtitle: projects.subtitle,
      source: "command-center/service.getCommandCenterSummary → kpi:active_projects",
    },
    {
      key: "projectsAtRisk",
      value: model.graphMetrics.projectsAtRisk,
      unit: KPI_UNIT.projectsAtRisk,
      subtitle: null,
      source: "pmo-living-graph/portfolio-metrics → projectsAtRisk",
    },
    {
      key: "blockedDays",
      value: blockedDays,
      unit: KPI_UNIT.blockedDays,
      subtitle: null,
      source: "project_event_log → computeBlockedDays (closed intervals only)",
    },
    {
      key: "budgetVariance",
      value: budget.value,
      unit: KPI_UNIT.budgetVariance,
      subtitle: budget.subtitle,
      source: "command-center/service.getCommandCenterSummary → kpi:budget_variance",
    },
    {
      key: "sharedResources",
      value: model.graphMetrics.sharedResources,
      unit: KPI_UNIT.sharedResources,
      subtitle: null,
      source: "pmo-living-graph/shared-resources → sharedResources",
    },
    {
      key: "criticalNodes",
      value: model.graphMetrics.criticalNodes,
      unit: KPI_UNIT.criticalNodes,
      subtitle: null,
      source: "pmo-living-graph/graph-algorithms.identifyCriticalNodes",
    },
    {
      key: "pendingDecisions",
      value: decisions.value,
      unit: KPI_UNIT.pendingDecisions,
      subtitle: decisions.subtitle,
      source: "command-center/service.getCommandCenterSummary → kpi:pm_decisions",
    },
  ];
}

// ---------------------------------------------------------------------------
// Critical path drawer — context resolution
// ---------------------------------------------------------------------------

export interface CriticalPathStep {
  order: number;
  task: string;
  project: string;
  status: string;
  risk: "green" | "amber" | "red";
  blocker: string | null;
  float: number | null;
  /** Graph node this step corresponds to, when one can be resolved. */
  nodeId: string | null;
}

/**
 * Attach graph node ids to the Command Center's critical path.
 *
 * The monitor is a list of task TITLES; the canvas is a list of node ids. Steps
 * are matched by label within the step's project, which is the only key the two
 * share — `CriticalPathItem` carries no task id.
 *
 * Unmatched steps keep `nodeId: null` and stay in the list. Dropping them would
 * silently shorten the critical path, and a critical path missing steps is
 * worse than one with unclickable steps.
 */
export function resolveCriticalPathNodes(
  steps: readonly {
    order: number;
    task: string;
    project: string;
    status: string;
    risk: "green" | "amber" | "red";
    blocker: string | null;
    float: number | null;
  }[],
  nodes: readonly { id: string; kind: string; label: string; projectId: string | null }[],
  projectLabelById: ReadonlyMap<string, string>,
): CriticalPathStep[] {
  // Index by (project label, task label). Titles repeat across projects far
  // more often than within one, so the project is part of the key.
  const index = new Map<string, string>();
  for (const node of nodes) {
    if (node.kind !== "task") continue;
    const projectLabel = node.projectId ? projectLabelById.get(node.projectId) ?? "" : "";
    index.set(`${projectLabel}||${node.label}`, node.id);
  }

  return steps.map((step) => ({
    ...step,
    nodeId: index.get(`${step.project}||${step.task}`) ?? null,
  }));
}

/**
 * Which critical-path steps belong to the current selection.
 *
 * The drawer is contextual: with a project selected it shows that project's
 * steps; with a task selected it highlights that step. With nothing selected it
 * shows the whole monitor — the Command Center's own default.
 *
 * Returns the FULL list when a selection matches nothing, rather than an empty
 * drawer. "This selection has no critical-path steps" and "the critical path is
 * empty" are different statements and the second one would be a lie.
 */
export function filterCriticalPathForSelection(
  steps: readonly CriticalPathStep[],
  selection: {
    selectedNodeIds: readonly string[];
    /** Project labels of the selected nodes, resolved by the caller. */
    selectedProjectLabels: readonly string[];
  },
): { steps: CriticalPathStep[]; contextual: boolean } {
  if (selection.selectedNodeIds.length === 0) return { steps: [...steps], contextual: false };

  const selectedIds = new Set(selection.selectedNodeIds);
  const projectLabels = new Set(selection.selectedProjectLabels);

  const matched = steps.filter(
    (step) =>
      (step.nodeId != null && selectedIds.has(step.nodeId)) || projectLabels.has(step.project),
  );

  if (matched.length === 0) return { steps: [...steps], contextual: false };
  return { steps: matched, contextual: true };
}

// ---------------------------------------------------------------------------
// The serialisable slice
// ---------------------------------------------------------------------------

/** Health, copied from Dashboard 1 verbatim (parity matrix §1). */
export interface PmoHealthSlice {
  overall: number;
  dimensions: { key: string; score: number }[];
  derivedFrom: string;
}

export interface PmoFocusSlice {
  id: string;
  title: string;
  explanation: string;
  severity: string;
  project: string | null;
  action: string;
  href: string | null;
}

/**
 * Everything Milestone 5 and 6 render, flat and JSON-safe.
 *
 * Deliberately NOT the whole read model: the graph itself is already a prop of
 * the shell, and sending it twice would let the two copies drift.
 */
export interface PmoDashboardSlice {
  kpis: PmoKpi[];
  health: PmoHealthSlice | null;
  focus: PmoFocusSlice[];
  criticalPath: {
    order: number;
    task: string;
    project: string;
    status: string;
    risk: "green" | "amber" | "red";
    blocker: string | null;
    float: number | null;
  }[];
  insights: PmoPiInsight[];
  /** What-if inputs, already flattened. `capacity` is an ARRAY, never null. */
  whatIf: {
    financeRows: PmoWhatIfFinanceRow[];
    criticalRiskCount: number;
    systemicRisks: PmoWhatIfSystemicRisk[];
    capacity: PmoWhatIfCapacityRow[];
  };
  /** Blocked days per project, as entries — a Map does not serialise. */
  blockedDaysByProject: [string, number][];
  unavailableSources: string[];
  generatedAt: string;
}

/**
 * The finance fields `simulateWhatIf` actually reads.
 *
 * Narrowed on purpose: the full `PmoPiFinanceRow` has 20 fields, all of which
 * would cross the wire on every reload for a simulation that touches three.
 */
export interface PmoWhatIfFinanceRow {
  projectId: string;
  currency: string;
  baseline: number | null;
  latestEac: number | null;
}

export interface PmoWhatIfSystemicRisk {
  riskId: string;
  projectId: string;
  title: string;
  severity: string;
  downstreamTaskCount: number;
}

export interface PmoWhatIfCapacityRow {
  projectId: string;
  hasCapacityInputs: boolean;
  workforceAvailabilityPercent: number | null;
}

/**
 * Flatten the composed read model into the slice.
 *
 * Copy only. Every value here has a `source` string pointing at the function
 * that produced it, and the tests assert equality against those functions
 * rather than against literals (ADR-012 §1).
 */
export function toDashboardSlice(model: PmoIntelligenceModel): PmoDashboardSlice {
  const cc = model.commandCenter;

  return {
    kpis: buildKpis({
      commandCenter: cc,
      graphMetrics: {
        sharedResources: model.graph.metrics.sharedResources,
        criticalNodes: model.graph.metrics.criticalNodes,
        projectsAtRisk: model.graph.metrics.projectsAtRisk,
        blockedDays: model.graph.metrics.blockedDays,
      },
      blockedDaysTotal: model.blockedDays?.totalDays ?? null,
    }),
    // Verbatim: the six dimensions and the overall score are Dashboard 1's,
    // reproduced without a second formula anywhere in the path.
    health: cc
      ? {
          overall: cc.portfolioHealth.overall,
          dimensions: cc.portfolioHealth.dimensions.map((dimension) => ({ ...dimension })),
          derivedFrom: cc.portfolioHealth.derivedFrom,
        }
      : null,
    focus: (cc?.pmoFocus ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      explanation: item.explanation,
      severity: item.severity,
      project: item.project,
      action: item.action,
      href: item.href ?? null,
    })),
    criticalPath: (cc?.criticalPath ?? []).map((step) => ({
      order: step.order,
      task: step.task,
      project: step.project,
      status: step.status,
      risk: step.risk,
      blocker: step.blocker,
      float: step.float,
    })),
    insights: model.insights,
    whatIf: {
      financeRows: (model.finance?.rows ?? []).map((row) => ({
        projectId: row.projectId,
        currency: row.currency,
        baseline: row.baseline,
        latestEac: row.latestEac,
      })),
      criticalRiskCount: model.overlays?.risk.criticalOpenCount ?? 0,
      systemicRisks: (model.overlays?.risk.systemic ?? []).map((risk) => ({
        riskId: risk.riskId,
        projectId: risk.projectId,
        title: risk.title,
        severity: risk.severity,
        downstreamTaskCount: risk.downstreamTaskCount,
      })),
      // ALWAYS an array. `simulateWhatIf` calls `.filter()` on this without a
      // guard, so a null here throws inside the simulator rather than showing
      // an empty scenario — the failure the prompt flagged explicitly.
      capacity: (model.overlays?.capacity ?? []).map((row) => ({
        projectId: row.projectId,
        hasCapacityInputs: row.hasCapacityInputs,
        workforceAvailabilityPercent: row.workforceAvailabilityPercent,
      })),
    },
    blockedDaysByProject: [...(model.blockedDays?.daysByProject ?? new Map())],
    unavailableSources: model.unavailableSources,
    generatedAt: model.generatedAt,
  };
}
