// ============================================================================
// PMO Portfolio Living Graph — hierarchical navigation (CAP-048)
// ============================================================================
// Large to small, one level at a time.
//
// The first build expanded projects in place, so opening one project left the
// other four on screen with their edges crossing it. At portfolio scale that is
// unreadable. Drilling in now ISOLATES: entering a project hides every other
// project, entering a milestone shows only its tasks, entering a task shows its
// subtasks and what is attached to it.
//
// Pure and level-driven: given the full graph and a position in the hierarchy,
// it returns exactly what belongs on screen.
// ============================================================================

import type { GraphEdge, GraphNode } from "./contracts";

export type NavigationLevel = "portfolio" | "project" | "milestone" | "task";

export interface GraphNavigation {
  level: NavigationLevel;
  /** Canonical project id (not a node id). Set from `project` level down. */
  projectId: string | null;
  /** Node ids, because that is what the canvas and the edges speak. */
  milestoneNodeId: string | null;
  taskNodeId: string | null;
}

export const PORTFOLIO_NAVIGATION: GraphNavigation = {
  level: "portfolio",
  projectId: null,
  milestoneNodeId: null,
  taskNodeId: null,
};

/** Hierarchy edges. Anything else crosses the tree rather than forming it. */
const CONTAINMENT: ReadonlySet<GraphEdge["type"]> = new Set(["contains", "belongs_to"]);

function childrenOf(edges: readonly GraphEdge[], parentNodeId: string): Set<string> {
  const children = new Set<string>();
  for (const edge of edges) {
    if (!CONTAINMENT.has(edge.type)) continue;
    if (edge.sourceNodeId === parentNodeId) children.add(edge.targetNodeId);
  }
  return children;
}

export interface ScopedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Node the view is centred on, so the canvas can highlight it. */
  anchorNodeId: string | null;
}

/**
 * Which nodes belong on screen at this position in the hierarchy.
 *
 * Each level answers one question, and nothing else competes for attention:
 *   portfolio → which projects exist, and which of them are entangled
 *   project   → what this project is made of
 *   milestone → which tasks deliver it
 *   task      → what this task contains and what touches it
 */
export function scopeToNavigation(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  navigation: GraphNavigation,
): ScopedGraph {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const keep = new Set<string>();
  let anchorNodeId: string | null = null;

  if (navigation.level === "portfolio") {
    // Only the organization and its projects. Cross-project links survive
    // because both endpoints are projects — that entanglement is the whole
    // reason this dashboard exists.
    for (const node of nodes) {
      if (node.kind === "organization" || node.kind === "project") keep.add(node.id);
    }
  } else if (navigation.level === "project" && navigation.projectId) {
    const projectNodeId = `project:${navigation.projectId}`;
    anchorNodeId = projectNodeId;
    keep.add(projectNodeId);
    // The project's own layer: milestones, plus risks and resources hanging off
    // it. Tasks stay hidden until a milestone is opened.
    for (const child of childrenOf(edges, projectNodeId)) keep.add(child);
    for (const node of nodes) {
      if (node.projectId !== navigation.projectId) continue;
      if (node.kind === "risk" || node.kind === "decision" || node.kind === "resource") {
        keep.add(node.id);
      }
    }
  } else if (navigation.level === "milestone" && navigation.milestoneNodeId) {
    anchorNodeId = navigation.milestoneNodeId;
    keep.add(navigation.milestoneNodeId);
    for (const child of childrenOf(edges, navigation.milestoneNodeId)) keep.add(child);
    // Risks that hit this milestone or any of its tasks belong here: a task
    // list that hides its risks is the report, not the reality.
    for (const edge of edges) {
      if (edge.type !== "impacts") continue;
      if (keep.has(edge.targetNodeId)) keep.add(edge.sourceNodeId);
    }
  } else if (navigation.level === "task" && navigation.taskNodeId) {
    anchorNodeId = navigation.taskNodeId;
    keep.add(navigation.taskNodeId);
    for (const child of childrenOf(edges, navigation.taskNodeId)) keep.add(child);
    // Everything attached to the task: risks, budget, and the tasks it depends
    // on — one hop, so the view stays a task view rather than a whole plan.
    for (const edge of edges) {
      const touchesTask =
        edge.sourceNodeId === navigation.taskNodeId ||
        edge.targetNodeId === navigation.taskNodeId;
      if (!touchesTask) continue;
      if (edge.type === "impacts" || edge.type === "consumes_budget" || edge.type === "depends_on") {
        keep.add(edge.sourceNodeId);
        keep.add(edge.targetNodeId);
      }
    }
  }

  const scopedNodes = [...keep].map((id) => byId.get(id)).filter((node): node is GraphNode => !!node);
  const present = new Set(scopedNodes.map((node) => node.id));
  const scopedEdges = edges.filter(
    (edge) => present.has(edge.sourceNodeId) && present.has(edge.targetNodeId),
  );

  return { nodes: scopedNodes, edges: scopedEdges, anchorNodeId };
}

/** What double-clicking this node should open, or null if it is a leaf. */
export function drillDownTo(
  node: GraphNode,
  current: GraphNavigation,
): GraphNavigation | null {
  if (node.kind === "project" && node.projectId) {
    return { level: "project", projectId: node.projectId, milestoneNodeId: null, taskNodeId: null };
  }
  if (node.kind === "milestone") {
    return {
      level: "milestone",
      projectId: node.projectId ?? current.projectId,
      milestoneNodeId: node.id,
      taskNodeId: null,
    };
  }
  if (node.kind === "task") {
    return {
      level: "task",
      projectId: node.projectId ?? current.projectId,
      milestoneNodeId: current.milestoneNodeId,
      taskNodeId: node.id,
    };
  }
  // Subtasks, risks, decisions and the rest are leaves: they open the side
  // panel rather than a new level.
  return null;
}

/** One step back up. Portfolio is the root and stays put. */
export function drillUp(current: GraphNavigation): GraphNavigation {
  switch (current.level) {
    case "task":
      return current.milestoneNodeId
        ? { ...current, level: "milestone", taskNodeId: null }
        : { ...current, level: "project", taskNodeId: null, milestoneNodeId: null };
    case "milestone":
      return { ...current, level: "project", milestoneNodeId: null, taskNodeId: null };
    case "project":
      return PORTFOLIO_NAVIGATION;
    default:
      return PORTFOLIO_NAVIGATION;
  }
}

export interface BreadcrumbEntry {
  level: NavigationLevel;
  label: string;
  navigation: GraphNavigation;
}

/**
 * The trail back to the portfolio.
 *
 * Isolation is only safe if the way out is always visible — otherwise drilling
 * in feels like the rest of the portfolio was lost rather than hidden.
 */
export function buildBreadcrumbs(
  nodes: readonly GraphNode[],
  navigation: GraphNavigation,
  portfolioLabel: string,
): BreadcrumbEntry[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const trail: BreadcrumbEntry[] = [
    { level: "portfolio", label: portfolioLabel, navigation: PORTFOLIO_NAVIGATION },
  ];

  if (navigation.projectId) {
    const project = byId.get(`project:${navigation.projectId}`);
    trail.push({
      level: "project",
      label: project?.label ?? navigation.projectId,
      navigation: {
        level: "project",
        projectId: navigation.projectId,
        milestoneNodeId: null,
        taskNodeId: null,
      },
    });
  }

  if (navigation.milestoneNodeId) {
    const milestone = byId.get(navigation.milestoneNodeId);
    trail.push({
      level: "milestone",
      label: milestone?.label ?? navigation.milestoneNodeId,
      navigation: { ...navigation, level: "milestone", taskNodeId: null },
    });
  }

  if (navigation.taskNodeId) {
    const task = byId.get(navigation.taskNodeId);
    trail.push({
      level: "task",
      label: task?.label ?? navigation.taskNodeId,
      navigation: { ...navigation, level: "task" },
    });
  }

  return trail;
}
