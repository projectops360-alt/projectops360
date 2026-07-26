// ============================================================================
// PMO Intelligence Center — KPI interaction bindings (CAP-048 Phase 2)
// ============================================================================
// A KPI that only displays a number makes the PMO go looking for the thing it
// refers to. Each one here declares what clicking it should do to the rest of
// the screen: which lens to activate, which nodes to select, what to highlight.
//
// Pure: it maps a KPI to an intent. The shell applies it. Keeping the mapping
// out of the component is what makes it testable and what stops each KPI card
// growing its own private navigation logic.
// ============================================================================

import type { GraphNode } from "@/lib/pmo-living-graph/contracts";
import type { PmoLens } from "./scope";

export const PMO_KPI_KEYS = [
  "portfolioHealth",
  "projects",
  "projectsAtRisk",
  "blockedDays",
  "budgetVariance",
  "sharedResources",
  "criticalNodes",
  "pendingDecisions",
] as const;
export type PmoKpiKey = (typeof PMO_KPI_KEYS)[number];

export interface KpiIntent {
  /** Lens to switch to, or null to stay on the current one. */
  lens: PmoLens | null;
  /** Nodes to select and centre. */
  selectNodeIds: string[];
  /** Panel to open, if any. */
  openPanel: "health" | "focus" | "evidence" | null;
  /** Turn on focus mode around the selection. */
  focus: boolean;
}

const NOOP: KpiIntent = { lens: null, selectNodeIds: [], openPanel: null, focus: false };

function idsOf(nodes: readonly GraphNode[], predicate: (node: GraphNode) => boolean): string[] {
  return nodes.filter(predicate).map((node) => node.id);
}

/**
 * What a KPI click should do to the rest of the dashboard.
 *
 * The node lists are computed from the graph that is already loaded, so a click
 * never triggers a fetch — it re-aims what is on screen.
 */
export function kpiIntent(
  key: PmoKpiKey,
  nodes: readonly GraphNode[],
  context: {
    criticalNodeIds: readonly string[];
    sharedResourceProjectIds: readonly string[];
    blockedSubjectIds: readonly string[];
  },
): KpiIntent {
  switch (key) {
    case "portfolioHealth":
      // Health is an explanation, not a location on the graph.
      return { ...NOOP, openPanel: "health" };

    case "projects":
      // Frame every project without narrowing the lens.
      return { ...NOOP, selectNodeIds: idsOf(nodes, (node) => node.kind === "project") };

    case "projectsAtRisk":
      return {
        lens: "risk",
        selectNodeIds: idsOf(
          nodes,
          (node) => node.kind === "project" && (node.health === "at_risk" || node.health === "critical"),
        ),
        openPanel: null,
        focus: false,
      };

    case "blockedDays":
      // Select the blocked work itself; the drawer then shows its chain.
      return {
        lens: "process",
        selectNodeIds: nodes
          .filter((node) => context.blockedSubjectIds.includes(node.canonicalEntityId))
          .map((node) => node.id),
        openPanel: null,
        focus: false,
      };

    case "budgetVariance":
      return { lens: "finance", selectNodeIds: [], openPanel: null, focus: false };

    case "sharedResources":
      return {
        lens: "resources",
        selectNodeIds: idsOf(
          nodes,
          (node) =>
            node.kind === "project" &&
            node.projectId != null &&
            context.sharedResourceProjectIds.includes(node.projectId),
        ),
        openPanel: null,
        focus: false,
      };

    case "criticalNodes":
      // The only KPI that isolates: criticality is about a neighbourhood, and
      // it is unreadable with the rest of the portfolio still drawn.
      return {
        lens: null,
        selectNodeIds: [...context.criticalNodeIds],
        openPanel: null,
        focus: true,
      };

    case "pendingDecisions":
      return {
        lens: null,
        selectNodeIds: idsOf(
          nodes,
          (node) => node.kind === "decision" && (node.status === "proposed" || node.status === "deferred"),
        ),
        openPanel: null,
        focus: false,
      };

    default:
      return NOOP;
  }
}

/**
 * Health dimension → lens.
 *
 * Clicking "Budget 100" should show the finance projection, not leave the user
 * to find it. Dimensions with no lens of their own return null rather than
 * being forced into an unrelated one.
 */
export function healthDimensionLens(dimension: string): PmoLens | null {
  switch (dimension) {
    case "schedule":
    case "critical_path":
      return "process";
    case "budget":
      return "finance";
    case "resources":
      return "resources";
    case "risk":
      return "risk";
    case "materials":
      // No materials lens exists. Saying so beats opening something unrelated.
      return null;
    default:
      return null;
  }
}

/** Units, so the UI can never render a score as money or days as a percentage. */
export const KPI_UNIT: Record<PmoKpiKey, "score" | "count" | "days" | "percent"> = {
  portfolioHealth: "score",
  projects: "count",
  projectsAtRisk: "count",
  blockedDays: "days",
  budgetVariance: "percent",
  sharedResources: "count",
  criticalNodes: "count",
  pendingDecisions: "count",
};
