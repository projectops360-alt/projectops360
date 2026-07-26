// ============================================================================
// PMO Portfolio Living Graph — portfolio metrics (CAP-048 §6)
// ============================================================================
// Every metric here is computable from real rows. Anything that is not
// reports `unavailable` rather than 0 — a zero is a claim, and claiming zero
// risk when the data is simply missing is the worst failure this screen can
// have.
//
// Monetary exposure and day exposure are returned as SEPARATE fields and are
// never summed. Adding currency to duration produces a number that means
// nothing.
// ============================================================================

import type { GraphEdge, GraphNode } from "./contracts";
import type { CrossProjectDependency } from "./graph-algorithms";
import type { SharedResourceLink } from "./shared-resources";

/** A value that knows whether it is real. */
export type MetricValue =
  | { state: "ok"; value: number }
  | { state: "unavailable"; reason: string };

export function ok(value: number): MetricValue {
  return { state: "ok", value };
}

export function unavailable(reason: string): MetricValue {
  return { state: "unavailable", reason };
}

export interface PortfolioMetrics {
  totalProjects: MetricValue;
  projectsAtRisk: MetricValue;
  /** Money. Never added to `blockedDays`. */
  riskExposureAmount: MetricValue;
  /** Duration. Never added to `riskExposureAmount`. */
  blockedDays: MetricValue;
  crossProjectDependencies: MetricValue;
  sharedResources: MetricValue;
  overallocatedResources: MetricValue;
  criticalNodes: MetricValue;
  pendingDecisions: MetricValue;
  orphanNodes: MetricValue;
}

export interface MetricsInput {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  crossProject: readonly CrossProjectDependency[];
  sharedResources: readonly SharedResourceLink[];
  criticalNodeCount: number;
  orphanNodeCount: number;
  /** Blocked-day totals per project, from the event log. Absent ⇒ unavailable. */
  blockedDaysByProject: ReadonlyMap<string, number> | null;
}

const OPEN_RISK_STATUSES = new Set(["open", "mitigating"]);
const SEVERE = new Set(["high", "critical"]);

/**
 * Projects carrying at least one open, severe risk.
 *
 * A project with five critical risks is ONE project at risk. Counting risks
 * here instead of projects is the classic double count this guards against.
 */
export function countProjectsAtRisk(nodes: readonly GraphNode[]): number {
  const flagged = new Set<string>();
  for (const node of nodes) {
    if (node.kind !== "risk" || !node.projectId) continue;
    const severity = node.metrics.severity;
    const status = node.status;
    if (
      typeof severity === "string" &&
      SEVERE.has(severity) &&
      status != null &&
      OPEN_RISK_STATUSES.has(status)
    ) {
      flagged.add(node.projectId);
    }
  }
  return flagged.size;
}

/**
 * Monetary exposure: budget attached to work that severe open risks impact.
 *
 * A budget item reachable from several risks counts once — hence the set of
 * budget node ids rather than a running total per risk.
 */
export function computeRiskExposureAmount(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): MetricValue {
  const budgetAmounts = new Map<string, number>();
  for (const node of nodes) {
    if (node.kind !== "budget_item") continue;
    const estimated = node.metrics.estimatedCost;
    if (typeof estimated === "number") budgetAmounts.set(node.id, estimated);
  }
  if (budgetAmounts.size === 0) {
    return unavailable("No budget items with an estimated cost");
  }

  const riskyNodeIds = new Set(
    nodes
      .filter(
        (node) =>
          node.kind === "risk" &&
          typeof node.metrics.severity === "string" &&
          SEVERE.has(node.metrics.severity) &&
          node.status != null &&
          OPEN_RISK_STATUSES.has(node.status),
      )
      .map((node) => node.id),
  );
  if (riskyNodeIds.size === 0) return ok(0);

  // What severe risks impact, then which budget items feed those targets.
  const impacted = new Set<string>();
  for (const edge of edges) {
    if (edge.type === "impacts" && riskyNodeIds.has(edge.sourceNodeId)) {
      impacted.add(edge.targetNodeId);
    }
  }

  const countedBudgetIds = new Set<string>();
  for (const edge of edges) {
    if (edge.type !== "consumes_budget") continue;
    if (!impacted.has(edge.targetNodeId)) continue;
    countedBudgetIds.add(edge.sourceNodeId);
  }

  let total = 0;
  for (const id of countedBudgetIds) total += budgetAmounts.get(id) ?? 0;
  return ok(total);
}

/** Resources allocated to more than one project at the same time. */
export function countSharedResources(links: readonly SharedResourceLink[]): number {
  return new Set(links.map((link) => link.resourceProfileId)).size;
}

/** Of those, the ones committed past 100% — a real scheduling conflict. */
export function countOverallocatedResources(
  links: readonly SharedResourceLink[],
): number {
  const ids = new Set<string>();
  for (const link of links) {
    if (link.combinedAllocationPercent != null && link.combinedAllocationPercent > 100) {
      ids.add(link.resourceProfileId);
    }
  }
  return ids.size;
}

export function computePortfolioMetrics(input: MetricsInput): PortfolioMetrics {
  const projectCount = input.nodes.filter((node) => node.kind === "project").length;

  const pending = input.nodes.filter(
    (node) => node.kind === "decision" && (node.status === "proposed" || node.status === "deferred"),
  ).length;

  let blockedDays: MetricValue;
  if (input.blockedDaysByProject == null) {
    blockedDays = unavailable("Blocked-state history is not available");
  } else {
    let total = 0;
    for (const days of input.blockedDaysByProject.values()) total += days;
    blockedDays = ok(total);
  }

  return {
    totalProjects: ok(projectCount),
    projectsAtRisk: ok(countProjectsAtRisk(input.nodes)),
    riskExposureAmount: computeRiskExposureAmount(input.nodes, input.edges),
    blockedDays,
    crossProjectDependencies: ok(input.crossProject.length),
    sharedResources: ok(countSharedResources(input.sharedResources)),
    overallocatedResources: ok(countOverallocatedResources(input.sharedResources)),
    criticalNodes: ok(input.criticalNodeCount),
    pendingDecisions: ok(pending),
    orphanNodes: ok(input.orphanNodeCount),
  };
}
