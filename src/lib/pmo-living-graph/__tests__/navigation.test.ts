// ============================================================================
// CAP-048 — hierarchical navigation guards
// Guards: PMO-LG-NAV-ISOLATION, PMO-LG-NAV-DRILLDOWN, PMO-LG-NAV-DRILLUP,
//         PMO-LG-NAV-BREADCRUMBS
// ============================================================================
// The bug these guards exist to prevent: opening one project used to leave the
// other four on screen, with their edges crossing it. Drilling in must ISOLATE.
// If any of these fail, the portfolio has become a hairball again.
// ============================================================================

import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode, GraphNodeKind } from "../contracts";
import {
  PORTFOLIO_NAVIGATION,
  buildBreadcrumbs,
  drillDownTo,
  drillUp,
  scopeToNavigation,
  type GraphNavigation,
} from "../navigation";

const ORG = "org-1";

function node(
  kind: GraphNodeKind,
  canonicalId: string,
  projectId: string | null,
  label = `${kind}-${canonicalId}`,
): GraphNode {
  return {
    id: `${kind}:${canonicalId}`,
    organizationId: ORG,
    projectId,
    kind,
    canonicalEntityType: kind,
    canonicalEntityId: canonicalId,
    label,
    description: null,
    status: null,
    health: "unknown",
    criticality: 0,
    metrics: {},
    provenance: "OBSERVED",
    confidence: 1,
    evidenceRefs: [],
    validFrom: null,
    validTo: null,
    updatedAt: null,
  };
}

function edge(
  type: GraphEdge["type"],
  sourceNodeId: string,
  targetNodeId: string,
): GraphEdge {
  return {
    id: `${type}:${sourceNodeId}->${targetNodeId}`,
    organizationId: ORG,
    sourceNodeId,
    targetNodeId,
    type,
    direction: "directed",
    weight: 1,
    status: null,
    provenance: "OBSERVED",
    confidence: 1,
    evidenceRefs: [],
    validFrom: null,
    validTo: null,
    updatedAt: null,
  };
}

/**
 * Two projects, so isolation has something to hide. Project A carries a full
 * chain org → project → milestone → task → subtask plus a risk and a budget
 * item; project B exists only to prove it disappears.
 */
function fixture(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [
    node("organization", ORG, null, "Acme"),
    node("project", "p-a", "p-a", "Alpha"),
    node("project", "p-b", "p-b", "Bravo"),
    node("milestone", "m-a1", "p-a", "M9"),
    node("milestone", "m-a2", "p-a", "M8"),
    node("milestone", "m-b1", "p-b", "Bravo milestone"),
    node("task", "t-a1", "p-a", "Pour slab"),
    node("task", "t-a2", "p-a", "Cure slab"),
    node("task", "t-b1", "p-b", "Bravo task"),
    node("subtask", "s-a1", "p-a", "Order concrete"),
    node("risk", "r-a1", "p-a", "Supplier delay"),
    node("risk", "r-a2", "p-a", "Weather"),
    node("budget_item", "b-a1", "p-a", "Concrete budget"),
    node("resource", "res-a1", "p-a", "Crew 1"),
  ];

  const edges: GraphEdge[] = [
    edge("contains", "organization:org-1", "project:p-a"),
    edge("contains", "organization:org-1", "project:p-b"),
    edge("contains", "project:p-a", "milestone:m-a1"),
    edge("contains", "project:p-a", "milestone:m-a2"),
    edge("contains", "project:p-b", "milestone:m-b1"),
    edge("contains", "milestone:m-a1", "task:t-a1"),
    edge("contains", "milestone:m-a1", "task:t-a2"),
    edge("contains", "milestone:m-b1", "task:t-b1"),
    edge("contains", "task:t-a1", "subtask:s-a1"),
    // A risk on the task, and one on the milestone.
    edge("impacts", "risk:r-a1", "task:t-a1"),
    edge("impacts", "risk:r-a2", "milestone:m-a1"),
    edge("consumes_budget", "budget_item:b-a1", "task:t-a1"),
    edge("depends_on", "task:t-a2", "task:t-a1"),
    edge("shares_resource_with", "project:p-a", "project:p-b"),
  ];

  return { nodes, edges };
}

const ids = (nodes: readonly GraphNode[]) => nodes.map((item) => item.id).sort();

// ---------------------------------------------------------------------------
// PMO-LG-NAV-ISOLATION
// ---------------------------------------------------------------------------

describe("scopeToNavigation (PMO-LG-NAV-ISOLATION)", () => {
  it("shows only the organization and its projects at portfolio level", () => {
    const { nodes, edges } = fixture();
    const scoped = scopeToNavigation(nodes, edges, PORTFOLIO_NAVIGATION);

    expect(ids(scoped.nodes)).toEqual([
      "organization:org-1",
      "project:p-a",
      "project:p-b",
    ]);
    expect(scoped.anchorNodeId).toBeNull();
  });

  it("keeps the cross-project link at portfolio level — that entanglement is the point", () => {
    const { nodes, edges } = fixture();
    const scoped = scopeToNavigation(nodes, edges, PORTFOLIO_NAVIGATION);

    expect(scoped.edges.some((item) => item.type === "shares_resource_with")).toBe(true);
  });

  it("hides every other project when one is entered", () => {
    const { nodes, edges } = fixture();
    const scoped = scopeToNavigation(nodes, edges, {
      level: "project",
      projectId: "p-a",
      milestoneNodeId: null,
      taskNodeId: null,
    });

    const kept = ids(scoped.nodes);
    // The regression this guards: Bravo and everything under it must be gone.
    expect(kept).not.toContain("project:p-b");
    expect(kept).not.toContain("milestone:m-b1");
    expect(kept).not.toContain("task:t-b1");
    expect(kept).toContain("project:p-a");
    expect(scoped.anchorNodeId).toBe("project:p-a");
  });

  it("shows a project's milestones but not its tasks — tasks wait for a milestone", () => {
    const { nodes, edges } = fixture();
    const scoped = scopeToNavigation(nodes, edges, {
      level: "project",
      projectId: "p-a",
      milestoneNodeId: null,
      taskNodeId: null,
    });

    const kept = ids(scoped.nodes);
    expect(kept).toContain("milestone:m-a1");
    expect(kept).toContain("milestone:m-a2");
    expect(kept).not.toContain("task:t-a1");
    expect(kept).not.toContain("subtask:s-a1");
    // Project-level signals still belong on the project screen.
    expect(kept).toContain("risk:r-a1");
    expect(kept).toContain("resource:res-a1");
  });

  it("drops edges whose other endpoint is out of scope", () => {
    const { nodes, edges } = fixture();
    const scoped = scopeToNavigation(nodes, edges, {
      level: "project",
      projectId: "p-a",
      milestoneNodeId: null,
      taskNodeId: null,
    });

    const present = new Set(scoped.nodes.map((item) => item.id));
    for (const item of scoped.edges) {
      expect(present.has(item.sourceNodeId)).toBe(true);
      expect(present.has(item.targetNodeId)).toBe(true);
    }
    // The cross-project edge cannot survive: Bravo is not on screen.
    expect(scoped.edges.some((item) => item.type === "shares_resource_with")).toBe(false);
  });

  it("shows a milestone's tasks and the risks that hit them", () => {
    const { nodes, edges } = fixture();
    const scoped = scopeToNavigation(nodes, edges, {
      level: "milestone",
      projectId: "p-a",
      milestoneNodeId: "milestone:m-a1",
      taskNodeId: null,
    });

    const kept = ids(scoped.nodes);
    expect(kept).toContain("milestone:m-a1");
    expect(kept).toContain("task:t-a1");
    expect(kept).toContain("task:t-a2");
    // Risks on the milestone and on its tasks both belong here.
    expect(kept).toContain("risk:r-a1");
    expect(kept).toContain("risk:r-a2");
    // The sibling milestone is not part of this answer.
    expect(kept).not.toContain("milestone:m-a2");
    expect(scoped.anchorNodeId).toBe("milestone:m-a1");
  });

  it("shows a task's subtasks, its risks, its budget and what it depends on", () => {
    const { nodes, edges } = fixture();
    const scoped = scopeToNavigation(nodes, edges, {
      level: "task",
      projectId: "p-a",
      milestoneNodeId: "milestone:m-a1",
      taskNodeId: "task:t-a1",
    });

    const kept = ids(scoped.nodes);
    expect(kept).toContain("task:t-a1");
    expect(kept).toContain("subtask:s-a1");
    expect(kept).toContain("risk:r-a1");
    expect(kept).toContain("budget_item:b-a1");
    // The dependent task is one hop away and stays; the milestone above does not.
    expect(kept).toContain("task:t-a2");
    expect(kept).not.toContain("milestone:m-a1");
    expect(scoped.anchorNodeId).toBe("task:t-a1");
  });

  it("falls back to nothing when the navigation names an id the graph does not have", () => {
    const { nodes, edges } = fixture();
    const scoped = scopeToNavigation(nodes, edges, {
      level: "milestone",
      projectId: "p-a",
      milestoneNodeId: "milestone:does-not-exist",
      taskNodeId: null,
    });

    // A dangling anchor must yield an empty screen, never a silent fallback to
    // the whole portfolio.
    expect(scoped.nodes).toHaveLength(0);
    expect(scoped.edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-NAV-DRILLDOWN
// ---------------------------------------------------------------------------

describe("drillDownTo (PMO-LG-NAV-DRILLDOWN)", () => {
  const { nodes } = fixture();
  const byId = new Map(nodes.map((item) => [item.id, item]));

  it("opens a project", () => {
    const next = drillDownTo(byId.get("project:p-a")!, PORTFOLIO_NAVIGATION);
    expect(next).toEqual({
      level: "project",
      projectId: "p-a",
      milestoneNodeId: null,
      taskNodeId: null,
    });
  });

  it("opens a milestone and remembers its project", () => {
    const current: GraphNavigation = {
      level: "project",
      projectId: "p-a",
      milestoneNodeId: null,
      taskNodeId: null,
    };
    expect(drillDownTo(byId.get("milestone:m-a1")!, current)).toEqual({
      level: "milestone",
      projectId: "p-a",
      milestoneNodeId: "milestone:m-a1",
      taskNodeId: null,
    });
  });

  it("opens a task and keeps the milestone it came from, so drillUp can return there", () => {
    const current: GraphNavigation = {
      level: "milestone",
      projectId: "p-a",
      milestoneNodeId: "milestone:m-a1",
      taskNodeId: null,
    };
    expect(drillDownTo(byId.get("task:t-a1")!, current)).toEqual({
      level: "task",
      projectId: "p-a",
      milestoneNodeId: "milestone:m-a1",
      taskNodeId: "task:t-a1",
    });
  });

  it("returns null for leaves — they open the panel, not a new level", () => {
    const current: GraphNavigation = {
      level: "task",
      projectId: "p-a",
      milestoneNodeId: "milestone:m-a1",
      taskNodeId: "task:t-a1",
    };
    for (const id of [
      "subtask:s-a1",
      "risk:r-a1",
      "budget_item:b-a1",
      "resource:res-a1",
      "organization:org-1",
    ]) {
      expect(drillDownTo(byId.get(id)!, current)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-NAV-DRILLUP
// ---------------------------------------------------------------------------

describe("drillUp (PMO-LG-NAV-DRILLUP)", () => {
  it("walks task → milestone → project → portfolio", () => {
    const atTask: GraphNavigation = {
      level: "task",
      projectId: "p-a",
      milestoneNodeId: "milestone:m-a1",
      taskNodeId: "task:t-a1",
    };

    const atMilestone = drillUp(atTask);
    expect(atMilestone.level).toBe("milestone");
    expect(atMilestone.taskNodeId).toBeNull();
    expect(atMilestone.milestoneNodeId).toBe("milestone:m-a1");

    const atProject = drillUp(atMilestone);
    expect(atProject.level).toBe("project");
    expect(atProject.milestoneNodeId).toBeNull();
    expect(atProject.projectId).toBe("p-a");

    expect(drillUp(atProject)).toEqual(PORTFOLIO_NAVIGATION);
  });

  it("skips the milestone level for a task that has no milestone", () => {
    const orphanTask: GraphNavigation = {
      level: "task",
      projectId: "p-a",
      milestoneNodeId: null,
      taskNodeId: "task:t-a1",
    };
    expect(drillUp(orphanTask).level).toBe("project");
  });

  it("stays at the portfolio, which is the root", () => {
    expect(drillUp(PORTFOLIO_NAVIGATION)).toEqual(PORTFOLIO_NAVIGATION);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-NAV-BREADCRUMBS
// ---------------------------------------------------------------------------

describe("buildBreadcrumbs (PMO-LG-NAV-BREADCRUMBS)", () => {
  const { nodes } = fixture();

  it("always offers the way back to the portfolio", () => {
    const trail = buildBreadcrumbs(nodes, PORTFOLIO_NAVIGATION, "Portfolio");
    expect(trail).toHaveLength(1);
    expect(trail[0].label).toBe("Portfolio");
    expect(trail[0].navigation).toEqual(PORTFOLIO_NAVIGATION);
  });

  it("labels each level with the node's real title", () => {
    const trail = buildBreadcrumbs(
      nodes,
      {
        level: "task",
        projectId: "p-a",
        milestoneNodeId: "milestone:m-a1",
        taskNodeId: "task:t-a1",
      },
      "Portfolio",
    );

    expect(trail.map((entry) => entry.label)).toEqual([
      "Portfolio",
      "Alpha",
      "M9",
      "Pour slab",
    ]);
    expect(trail.map((entry) => entry.level)).toEqual([
      "portfolio",
      "project",
      "milestone",
      "task",
    ]);
  });

  it("each crumb navigates to its own level, not the current one", () => {
    const trail = buildBreadcrumbs(
      nodes,
      {
        level: "task",
        projectId: "p-a",
        milestoneNodeId: "milestone:m-a1",
        taskNodeId: "task:t-a1",
      },
      "Portfolio",
    );

    const milestoneCrumb = trail.find((entry) => entry.level === "milestone")!;
    expect(milestoneCrumb.navigation.level).toBe("milestone");
    expect(milestoneCrumb.navigation.taskNodeId).toBeNull();
  });

  it("falls back to the id when the node is missing rather than rendering a blank crumb", () => {
    const trail = buildBreadcrumbs(
      nodes,
      {
        level: "milestone",
        projectId: "p-a",
        milestoneNodeId: "milestone:ghost",
        taskNodeId: null,
      },
      "Portfolio",
    );
    expect(trail.at(-1)!.label).toBe("milestone:ghost");
  });
});
