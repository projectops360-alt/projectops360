// ============================================================================
// PMO Intelligence Center — lens projection (CAP-048 Phase 2, Milestone 4)
// ============================================================================
// A lens REPROJECTS the canvas. It never navigates away, never mounts a second
// dashboard, and never changes which entities exist.
//
// That distinction is the whole point of Dashboard 3. Dashboard 2 answered
// "show me risk" by swapping in a risk panel, so the graph the user had built
// up in their head disappeared and came back later with no continuity. Here the
// same nodes stay where they are and only their EMPHASIS changes: a lens says
// what matters right now, dims what does not, and annotates the nodes it can
// speak about.
//
// Pure by construction, and deliberately so:
//   - no fetching, no formulas (ADR-012: this layer composes, never computes)
//   - every number is copied from the read model that produced it
//   - a lens with no data says so, rather than rendering an empty highlight set
//     that reads as "nothing is wrong"
//
// The output is intentionally NOT a node list. Returning a filtered graph would
// let a lens delete nodes from the canvas, which is the behaviour this module
// exists to prevent. It returns decoration over a graph the caller already has.
// ============================================================================

import type { GraphEdge, GraphNode } from "@/lib/pmo-living-graph/contracts";
import type { PmoLens } from "./scope";

// ---------------------------------------------------------------------------
// Output contract
// ---------------------------------------------------------------------------

/** Why a node is emphasised, so the UI can explain itself rather than glow. */
export type LensAnnotationTone = "critical" | "warning" | "info" | "neutral";

export interface LensAnnotation {
  nodeId: string;
  /** Short, already-localised-by-key label. Callers translate `labelKey`. */
  labelKey: string;
  /** Interpolation values for `labelKey`. Numbers come from the read model. */
  values?: Record<string, string | number>;
  tone: LensAnnotationTone;
  /**
   * Which engine or projection produced this figure. Mandatory for anything
   * numeric — CAP-048 §5: two capacity engines exist in different units and a
   * number without its engine is worse than no number.
   */
  source: string;
}

/**
 * Something the lens wants to say that is not attached to a node.
 *
 * Gaps live here. A lens with no data model behind it (benefits) returns a
 * notice instead of pretending the portfolio is healthy.
 */
export interface LensNotice {
  key: string;
  values?: Record<string, string | number>;
  tone: LensAnnotationTone;
  /** True when the notice reports an absent capability rather than a finding. */
  isGap: boolean;
}

export interface LensProjection {
  lens: PmoLens;
  /** Nodes the lens is about. Rendered at full strength. */
  highlightedNodeIds: Set<string>;
  /**
   * Nodes to push back. Empty means "no emphasis" — which is NOT the same as
   * "dim everything": an empty highlight set with everything dimmed would make
   * a lens with no findings look like a broken screen.
   */
  dimmedNodeIds: Set<string>;
  /** Edges the lens is about (e.g. dependency chains, rework loops). */
  highlightedEdgeIds: Set<string>;
  annotations: LensAnnotation[];
  notices: LensNotice[];
  /**
   * False when the lens has nothing to project — either no data or no data
   * model. The UI must say which; `notices` carries the reason.
   */
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Input contract
// ---------------------------------------------------------------------------
// Deliberately narrower than `PmoIntelligenceModel`: this module takes only the
// slices it reads. That keeps it pure, keeps server-only types out of the
// client bundle, and makes the tests state their fixtures instead of building a
// whole read model to check one highlight rule.

/** Flow slice — Dashboard 2's process projection. Numbers copied verbatim. */
export interface LensFlowInput {
  nodes: readonly {
    id: string;
    activity: string;
    frequency: number;
    bottleneckScore: number;
    reworkOccurrences: number;
    avgIncomingWaitingMs: number | null;
  }[];
  edges: readonly { from: string; to: string; isRework: boolean }[];
}

export interface LensRiskInput {
  rows: readonly { projectId: string; openCount: number; criticalCount: number }[];
  systemic: readonly {
    riskId: string;
    projectId: string;
    severity: string;
    downstreamTaskCount: number;
  }[];
  criticalOpenCount: number;
}

export interface LensFinanceInput {
  rows: readonly {
    projectId: string;
    baseline: number | null;
    latestEac: number | null;
    vac: number | null;
    cpi: number | null;
    currency: string;
  }[];
  alerts: readonly { projectId: string; severity: string; rule: string }[];
}

/**
 * Capacity slice. `engine` is not optional on purpose — CAP-048 §5 forbids
 * showing a capacity number without saying which engine and unit produced it.
 */
export interface LensCapacityInput {
  rows: readonly {
    projectId: string;
    hasCapacityInputs: boolean;
    workforceAvailabilityPercent: number | null;
    overallocatedResourceCount: number;
  }[];
  /** "generic" reports hours; "labor" reports headcount. Never summed. */
  engine: "generic" | "labor";
}

export interface LensDependenciesInput {
  perProject: readonly { projectId: string; dependencyCount: number }[];
  hubs: readonly { taskId: string; projectId: string; outDegree: number }[];
  totalDependencies: number;
}

export interface LensProjectionInput {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  /** Node ids the graph engine already flagged. Never recomputed here. */
  criticalNodeIds: readonly string[];
  flow: LensFlowInput | null;
  risk: LensRiskInput | null;
  finance: LensFinanceInput | null;
  capacity: LensCapacityInput | null;
  dependencies: LensDependenciesInput | null;
  /** Per-project blocked days from the event-log pass. Null ⇒ unavailable. */
  blockedDaysByProject: ReadonlyMap<string, number> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

/** Bottleneck threshold, quoted from CAP-047 flow-projection (≥ 0.7). */
const BOTTLENECK_THRESHOLD = 0.7;

function emptyProjection(lens: PmoLens, notices: LensNotice[] = []): LensProjection {
  return {
    lens,
    highlightedNodeIds: new Set(),
    dimmedNodeIds: new Set(),
    highlightedEdgeIds: new Set(),
    annotations: [],
    notices,
    hasData: false,
  };
}

function gap(key: string): LensNotice {
  return { key, tone: "info", isGap: true };
}

/**
 * Dim everything the lens did not highlight.
 *
 * Only ever called when there IS something to highlight. Dimming the whole
 * canvas because a lens found nothing would turn "no risks recorded" into a
 * screen that looks broken.
 */
function dimComplement(
  nodes: readonly GraphNode[],
  highlighted: ReadonlySet<string>,
): Set<string> {
  if (highlighted.size === 0) return new Set();
  const dimmed = new Set<string>();
  for (const node of nodes) {
    // The organization node is the canvas anchor; dimming it detaches the
    // hierarchy visually for no analytical gain.
    if (node.kind === "organization") continue;
    if (!highlighted.has(node.id)) dimmed.add(node.id);
  }
  return dimmed;
}

/** Index from canonical project id → the project node representing it. */
function projectNodeIndex(nodes: readonly GraphNode[]): Map<string, GraphNode> {
  const index = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (node.kind === "project" && node.projectId) index.set(node.projectId, node);
  }
  return index;
}

/** Index from canonical entity id → node, for subject-level lookups. */
function canonicalIndex(nodes: readonly GraphNode[]): Map<string, GraphNode> {
  const index = new Map<string, GraphNode>();
  for (const node of nodes) index.set(node.canonicalEntityId, node);
  return index;
}

// ---------------------------------------------------------------------------
// Lens implementations
// ---------------------------------------------------------------------------

/**
 * Overview — the hierarchy as it stands, with health and the graph engine's
 * critical nodes called out.
 *
 * Nothing is dimmed: overview is the default state of the canvas, and a default
 * that greys out most of the portfolio is not a default.
 */
function projectOverview(input: LensProjectionInput): LensProjection {
  const highlighted = new Set<string>(input.criticalNodeIds);
  const annotations: LensAnnotation[] = [];

  for (const node of input.nodes) {
    if (node.health === "critical" || node.health === "at_risk") {
      highlighted.add(node.id);
      annotations.push({
        nodeId: node.id,
        labelKey: node.health === "critical" ? "annotationHealthCritical" : "annotationHealthAtRisk",
        tone: node.health === "critical" ? "critical" : "warning",
        source: "portfolio-graph",
      });
    }
  }

  for (const nodeId of input.criticalNodeIds) {
    annotations.push({
      nodeId,
      labelKey: "annotationCriticalNode",
      tone: "warning",
      source: "graph-algorithms.identifyCriticalNodes",
    });
  }

  return {
    lens: "overview",
    highlightedNodeIds: highlighted,
    // Overview deliberately dims nothing — see above.
    dimmedNodeIds: new Set(),
    highlightedEdgeIds: new Set(),
    annotations,
    notices: [],
    hasData: input.nodes.length > 0,
  };
}

/**
 * Process — bottlenecks and rework, from the CAP-047 flow model.
 *
 * The flow model is keyed by ACTIVITY (an event type), not by graph node, so
 * most of its findings have no node to sit on. They are returned as notices
 * rather than forced onto an unrelated node — attaching "rework 34%" to a task
 * that merely happens to exist would be an invented claim.
 */
function projectProcess(input: LensProjectionInput): LensProjection {
  if (!input.flow) return emptyProjection("process", [gap("noticeProcessUnavailable")]);

  const notices: LensNotice[] = [];
  const annotations: LensAnnotation[] = [];
  const highlighted = new Set<string>();

  const bottlenecks = input.flow.nodes.filter(
    (node) => node.bottleneckScore >= BOTTLENECK_THRESHOLD,
  );
  const reworkEdges = input.flow.edges.filter((edge) => edge.isRework);

  if (input.flow.nodes.length === 0) {
    return emptyProjection("process", [gap("noticeProcessNoEvents")]);
  }

  for (const bottleneck of bottlenecks) {
    notices.push({
      key: "noticeBottleneck",
      values: {
        activity: bottleneck.activity,
        score: Math.round(bottleneck.bottleneckScore * 100) / 100,
        waitDays:
          bottleneck.avgIncomingWaitingMs == null
            ? 0
            : Math.round((bottleneck.avgIncomingWaitingMs / MS_PER_DAY) * 10) / 10,
      },
      tone: "warning",
      isGap: false,
    });
  }

  if (reworkEdges.length > 0) {
    notices.push({
      key: "noticeRework",
      // Rework % is Dashboard 2's formula (rework edges / total edges × 100),
      // reproduced here from its own edge counts — not a new definition.
      values: {
        count: reworkEdges.length,
        percent:
          input.flow.edges.length > 0
            ? Math.round((reworkEdges.length / input.flow.edges.length) * 1000) / 10
            : 0,
      },
      tone: "warning",
      isGap: false,
    });
  }

  // Blocked work is the one process signal that DOES map onto graph nodes: the
  // event-log pass records the subject, and the subject is a canonical entity.
  if (input.blockedDaysByProject) {
    const byProject = projectNodeIndex(input.nodes);
    for (const [projectId, days] of input.blockedDaysByProject) {
      const node = byProject.get(projectId);
      if (!node || days <= 0) continue;
      highlighted.add(node.id);
      annotations.push({
        nodeId: node.id,
        labelKey: "annotationBlockedDays",
        values: { days: Math.round(days * 10) / 10 },
        tone: days >= 7 ? "critical" : "warning",
        source: "project_event_log (blocked-days pass)",
      });
    }
  } else {
    notices.push(gap("noticeBlockedDaysUnavailable"));
  }

  return {
    lens: "process",
    highlightedNodeIds: highlighted,
    dimmedNodeIds: dimComplement(input.nodes, highlighted),
    highlightedEdgeIds: new Set(),
    annotations,
    notices,
    hasData: true,
  };
}

/** Risk — open and systemic risk from the CAP-047 overlay, per project. */
function projectRisk(input: LensProjectionInput): LensProjection {
  if (!input.risk) return emptyProjection("risk", [gap("noticeRiskUnavailable")]);

  const byProject = projectNodeIndex(input.nodes);
  const byCanonical = canonicalIndex(input.nodes);
  const highlighted = new Set<string>();
  const annotations: LensAnnotation[] = [];
  const notices: LensNotice[] = [];

  for (const row of input.risk.rows) {
    const node = byProject.get(row.projectId);
    if (!node) continue;
    highlighted.add(node.id);
    annotations.push({
      nodeId: node.id,
      labelKey: "annotationOpenRisks",
      values: { open: row.openCount, critical: row.criticalCount },
      tone: row.criticalCount > 0 ? "critical" : "warning",
      source: "risks",
    });
  }

  // Systemic risks propagate along RECORDED dependencies only. Highlighting the
  // risk node itself keeps the claim attached to the record that supports it.
  for (const systemic of input.risk.systemic) {
    const riskNode = byCanonical.get(systemic.riskId);
    if (!riskNode) continue;
    highlighted.add(riskNode.id);
    annotations.push({
      nodeId: riskNode.id,
      labelKey: "annotationSystemicRisk",
      values: { downstream: systemic.downstreamTaskCount },
      tone: "critical",
      source: "risks + task_dependencies (BFS)",
    });
  }

  if (input.risk.rows.length === 0) {
    notices.push({ key: "noticeNoOpenRisks", tone: "info", isGap: false });
  }

  return {
    lens: "risk",
    highlightedNodeIds: highlighted,
    dimmedNodeIds: dimComplement(input.nodes, highlighted),
    highlightedEdgeIds: new Set(),
    annotations,
    notices,
    // A portfolio with zero open risks is a real, readable answer.
    hasData: true,
  };
}

/** Finance — variance at completion and cost performance, per project. */
function projectFinance(input: LensProjectionInput): LensProjection {
  if (!input.finance) return emptyProjection("finance", [gap("noticeFinanceUnavailable")]);

  const byProject = projectNodeIndex(input.nodes);
  const highlighted = new Set<string>();
  const annotations: LensAnnotation[] = [];
  const notices: LensNotice[] = [];

  for (const row of input.finance.rows) {
    const node = byProject.get(row.projectId);
    if (!node) continue;
    highlighted.add(node.id);

    // VAC and CPI arrive computed. Recomputing either here would create the
    // second definition ADR-012 exists to prevent.
    if (row.vac != null) {
      annotations.push({
        nodeId: node.id,
        labelKey: "annotationVac",
        values: { amount: row.vac, currency: row.currency },
        tone: row.vac < 0 ? "critical" : "info",
        source: "financial_project_cockpit (VAC = BAC − EAC)",
      });
    } else {
      annotations.push({
        nodeId: node.id,
        labelKey: "annotationFinanceIncomplete",
        tone: "neutral",
        source: "financial_project_cockpit",
      });
    }

    if (row.cpi != null) {
      annotations.push({
        nodeId: node.id,
        labelKey: "annotationCpi",
        values: { cpi: Math.round(row.cpi * 100) / 100 },
        tone: row.cpi < 1 ? "warning" : "info",
        source: "financial_project_cockpit (CPI)",
      });
    }
  }

  for (const alert of input.finance.alerts) {
    const node = byProject.get(alert.projectId);
    if (!node) continue;
    highlighted.add(node.id);
    annotations.push({
      nodeId: node.id,
      labelKey: `annotationFinanceAlert.${alert.rule}`,
      tone: alert.severity === "critical" ? "critical" : "warning",
      source: "financial-overlay rules",
    });
  }

  if (input.finance.rows.length === 0) {
    notices.push(gap("noticeFinanceNoRows"));
  }

  return {
    lens: "finance",
    highlightedNodeIds: highlighted,
    dimmedNodeIds: dimComplement(input.nodes, highlighted),
    highlightedEdgeIds: new Set(),
    annotations,
    notices,
    hasData: input.finance.rows.length > 0,
  };
}

/**
 * Resources — capacity, with the producing engine named on every figure.
 *
 * CAP-048 §5 is binding here. The generic engine reports HOURS and the labor
 * engine reports HEADCOUNT; they answer different questions and are never
 * summed or shown in one column. The engine is therefore part of the
 * annotation, not a footnote somewhere else on the screen.
 */
function projectResources(input: LensProjectionInput): LensProjection {
  if (!input.capacity) return emptyProjection("resources", [gap("noticeResourcesUnavailable")]);

  const byProject = projectNodeIndex(input.nodes);
  const highlighted = new Set<string>();
  const annotations: LensAnnotation[] = [];
  const notices: LensNotice[] = [];

  const engineKey =
    input.capacity.engine === "generic" ? "engineGenericHours" : "engineLaborHeadcount";
  const engineSource =
    input.capacity.engine === "generic"
      ? "lib/capacity (unit: hours)"
      : "lib/labor/capacity (unit: headcount)";

  // Stated once, up front: the unit belongs to the reading, not to the reader.
  notices.push({ key: "noticeCapacityEngine", values: { engine: engineKey }, tone: "info", isGap: false });

  for (const row of input.capacity.rows) {
    const node = byProject.get(row.projectId);
    if (!node) continue;

    if (!row.hasCapacityInputs) {
      // No inputs is not 0% availability. Saying so is the whole rule.
      annotations.push({
        nodeId: node.id,
        labelKey: "annotationCapacityNoInputs",
        tone: "neutral",
        source: engineSource,
      });
      continue;
    }

    highlighted.add(node.id);
    if (row.workforceAvailabilityPercent != null) {
      annotations.push({
        nodeId: node.id,
        labelKey: "annotationAvailability",
        values: { percent: Math.round(row.workforceAvailabilityPercent), engine: engineKey },
        tone: row.workforceAvailabilityPercent < 80 ? "warning" : "info",
        source: engineSource,
      });
    }
    if (row.overallocatedResourceCount > 0) {
      annotations.push({
        nodeId: node.id,
        labelKey: "annotationOverallocated",
        values: { count: row.overallocatedResourceCount, engine: engineKey },
        tone: "critical",
        source: engineSource,
      });
    }
  }

  return {
    lens: "resources",
    highlightedNodeIds: highlighted,
    dimmedNodeIds: dimComplement(input.nodes, highlighted),
    highlightedEdgeIds: new Set(),
    annotations,
    notices,
    hasData: input.capacity.rows.length > 0,
  };
}

/**
 * Dependencies — the recorded links, and the tasks that unblock the most work.
 *
 * The overlay's own limitation (intra-project only) is surfaced rather than
 * quietly dropped: a PMO reading a cross-project dependency count that cannot
 * include cross-project dependencies would draw the wrong conclusion.
 */
function projectDependencies(input: LensProjectionInput): LensProjection {
  if (!input.dependencies) {
    return emptyProjection("dependencies", [gap("noticeDependenciesUnavailable")]);
  }

  const byProject = projectNodeIndex(input.nodes);
  const byCanonical = canonicalIndex(input.nodes);
  const highlighted = new Set<string>();
  const highlightedEdges = new Set<string>();
  const annotations: LensAnnotation[] = [];
  const notices: LensNotice[] = [
    // Declared by the overlay itself; repeated here so the lens is honest even
    // when the panel that usually carries the caveat is closed.
    gap("noticeDependenciesIntraProjectOnly"),
  ];

  for (const row of input.dependencies.perProject) {
    const node = byProject.get(row.projectId);
    if (!node) continue;
    highlighted.add(node.id);
    annotations.push({
      nodeId: node.id,
      labelKey: "annotationDependencyCount",
      values: { count: row.dependencyCount },
      tone: "info",
      source: "task_dependencies",
    });
  }

  for (const hub of input.dependencies.hubs) {
    const node = byCanonical.get(hub.taskId);
    if (!node) continue;
    highlighted.add(node.id);
    annotations.push({
      nodeId: node.id,
      labelKey: "annotationDependencyHub",
      values: { count: hub.outDegree },
      tone: "warning",
      source: "task_dependencies (out-degree)",
    });
  }

  // The graph's own dependency edges are the visual half of the same fact.
  for (const edge of input.edges) {
    if (edge.type === "depends_on" || edge.type === "blocks") highlightedEdges.add(edge.id);
  }

  return {
    lens: "dependencies",
    highlightedNodeIds: highlighted,
    dimmedNodeIds: dimComplement(input.nodes, highlighted),
    highlightedEdgeIds: highlightedEdges,
    annotations,
    notices,
    hasData: input.dependencies.totalDependencies > 0,
  };
}

/**
 * Benefits — an honest placeholder.
 *
 * There is no benefits or strategic-objective data model (CAP-048 parity matrix
 * §4). `kpi_definitions` exists but is not linked to deliverables, so any
 * benefit realisation shown here would be fabricated. The lens therefore
 * projects nothing and says why, which is the only correct behaviour available.
 */
function projectBenefits(): LensProjection {
  return emptyProjection("benefits", [gap("noticeBenefitsNoDataModel")]);
}

/**
 * What-if — the simulation lens.
 *
 * The simulation itself is `simulateWhatIf` from CAP-047, reused verbatim and
 * run by the caller (it needs finance rows and risk inputs that this pure
 * module is not given). The lens's job is to frame the canvas for it: highlight
 * the projects a scenario can move, and state that nothing is persisted.
 */
function projectWhatIf(input: LensProjectionInput): LensProjection {
  const notices: LensNotice[] = [
    { key: "noticeWhatIfEphemeral", tone: "info", isGap: false },
    gap("noticeWhatIfNoSchedule"),
  ];

  if (!input.finance) {
    notices.push(gap("noticeWhatIfNoFinance"));
    return { ...emptyProjection("whatif", notices) };
  }

  const byProject = projectNodeIndex(input.nodes);
  const highlighted = new Set<string>();
  for (const row of input.finance.rows) {
    const node = byProject.get(row.projectId);
    // Only a project with a baseline can respond to a budget delta; the others
    // would show an unchanged bar and read as "the scenario did nothing".
    if (node && row.baseline != null) highlighted.add(node.id);
  }

  return {
    lens: "whatif",
    highlightedNodeIds: highlighted,
    dimmedNodeIds: dimComplement(input.nodes, highlighted),
    highlightedEdgeIds: new Set(),
    annotations: [],
    notices,
    hasData: highlighted.size > 0,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Project a lens onto the graph the canvas is already showing.
 *
 * Total over `PmoLens`: every lens returns a projection, and a lens without
 * data returns an explained empty one rather than throwing or silently showing
 * the overview.
 */
export function projectLens(input: LensProjectionInput, lens: PmoLens): LensProjection {
  switch (lens) {
    case "overview":
      return projectOverview(input);
    case "process":
      return projectProcess(input);
    case "risk":
      return projectRisk(input);
    case "finance":
      return projectFinance(input);
    case "resources":
      return projectResources(input);
    case "dependencies":
      return projectDependencies(input);
    case "benefits":
      return projectBenefits();
    case "whatif":
      return projectWhatIf(input);
    default:
      return emptyProjection(lens);
  }
}

/**
 * Lenses that cannot work for this input, with the reason.
 *
 * Used to disable a tab instead of letting the user click into an empty screen
 * and conclude the portfolio is fine.
 */
export function unavailableLenses(input: LensProjectionInput): Map<PmoLens, string> {
  const reasons = new Map<PmoLens, string>();
  if (!input.flow) reasons.set("process", "noticeProcessUnavailable");
  if (!input.risk) reasons.set("risk", "noticeRiskUnavailable");
  if (!input.finance) reasons.set("finance", "noticeFinanceUnavailable");
  if (!input.capacity) reasons.set("resources", "noticeResourcesUnavailable");
  if (!input.dependencies) reasons.set("dependencies", "noticeDependenciesUnavailable");
  // Benefits is always unavailable — there is no data model, not merely no data.
  reasons.set("benefits", "noticeBenefitsNoDataModel");
  return reasons;
}
