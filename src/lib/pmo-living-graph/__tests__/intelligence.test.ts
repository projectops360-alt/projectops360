// ============================================================================
// CAP-048 — graph intelligence guards
// Guards: PMO-LG-PATH, PMO-LG-BLAST-RADIUS, PMO-LG-CENTRALITY, PMO-LG-METRICS,
//         PMO-LG-LAYOUT, PMO-LG-EMPTY-STATE
// ============================================================================

import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "../contracts";
import {
  buildAdjacency,
  computeDegreeCentrality,
  detectCommunities,
  detectCrossProjectDependencies,
  detectOrphanNodes,
  findPath,
  getBlastRadius,
  getNeighbors,
  identifyCriticalNodes,
} from "../graph-algorithms";
import {
  computePortfolioMetrics,
  computeRiskExposureAmount,
  countOverallocatedResources,
  countProjectsAtRisk,
  countSharedResources,
} from "../portfolio-metrics";
import { buildGraphWindow, defaultFilters, pruneOrphanPositions } from "../subgraph";
import type { SharedResourceLink } from "../shared-resources";

const ORG = "org-1";

function node(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    organizationId: ORG,
    projectId: null,
    kind: "task",
    canonicalEntityType: "roadmap_tasks",
    canonicalEntityId: id,
    label: id,
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
    ...overrides,
  };
}

function edge(source: string, target: string, overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: `${source}->${target}`,
    organizationId: ORG,
    sourceNodeId: source,
    targetNodeId: target,
    type: "depends_on",
    direction: "directed",
    weight: 1,
    status: null,
    provenance: "OBSERVED",
    confidence: 1,
    evidenceRefs: [],
    validFrom: null,
    validTo: null,
    updatedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PMO-LG-PATH
// ---------------------------------------------------------------------------

describe("path finding (PMO-LG-PATH)", () => {
  it("finds the shortest route between two nodes", () => {
    // a→b→c→d plus the shortcut a→d
    const index = buildAdjacency([edge("a", "b"), edge("b", "c"), edge("c", "d"), edge("a", "d")]);

    const path = findPath(index, "a", "d");
    expect(path?.nodeIds).toEqual(["a", "d"]);
    expect(path?.hops).toBe(1);
  });

  it("walks against edge direction — connection matters, not arrow direction", () => {
    const index = buildAdjacency([edge("a", "b"), edge("c", "b")]);

    expect(findPath(index, "a", "c")?.nodeIds).toEqual(["a", "b", "c"]);
  });

  it("returns null when nothing connects the two", () => {
    const index = buildAdjacency([edge("a", "b"), edge("c", "d")]);

    expect(findPath(index, "a", "d")).toBeNull();
  });

  it("terminates on a cycle instead of looping forever", () => {
    const index = buildAdjacency([edge("a", "b"), edge("b", "c"), edge("c", "a")]);

    expect(findPath(index, "a", "c")?.hops).toBe(1);
    expect(findPath(index, "a", "zzz")).toBeNull();
  });

  it("treats a node as reachable from itself in zero hops", () => {
    const index = buildAdjacency([edge("a", "b")]);

    expect(findPath(index, "a", "a")).toEqual({ nodeIds: ["a"], edges: [], hops: 0 });
  });

  it("returns the edges along the path so the UI can explain it", () => {
    const index = buildAdjacency([edge("a", "b"), edge("b", "c")]);

    expect(findPath(index, "a", "c")?.edges).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-BLAST-RADIUS
// ---------------------------------------------------------------------------

describe("blast radius (PMO-LG-BLAST-RADIUS)", () => {
  it("groups affected nodes by hop distance", () => {
    const index = buildAdjacency([edge("a", "b"), edge("b", "c"), edge("c", "d")]);

    const blast = getBlastRadius(index, "a", 3);
    expect(blast.byHop.get(1)).toEqual(["b"]);
    expect(blast.byHop.get(2)).toEqual(["c"]);
    expect(blast.byHop.get(3)).toEqual(["d"]);
    expect(blast.totalAffected).toBe(3);
  });

  it("counts a node once when several paths reach it", () => {
    // Diamond: a→b, a→c, b→d, c→d. `d` is reachable two ways.
    const index = buildAdjacency([edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")]);

    const blast = getBlastRadius(index, "a", 3);
    expect(blast.affectedNodeIds.sort()).toEqual(["b", "c", "d"]);
    expect(blast.totalAffected).toBe(3);
    // `d` belongs to its shortest ring only.
    expect(blast.byHop.get(2)).toEqual(["d"]);
  });

  it("never includes the origin among the affected", () => {
    const index = buildAdjacency([edge("a", "b"), edge("b", "a")]);

    expect(getBlastRadius(index, "a", 3).affectedNodeIds).toEqual(["b"]);
  });

  it("respects the hop limit", () => {
    const index = buildAdjacency([edge("a", "b"), edge("b", "c"), edge("c", "d"), edge("d", "e")]);

    expect(getBlastRadius(index, "a", 2).affectedNodeIds.sort()).toEqual(["b", "c"]);
  });

  it("reports truncation rather than silently capping", () => {
    const edges = Array.from({ length: 50 }, (_, i) => edge("hub", `n${i}`));
    const index = buildAdjacency(edges);

    const blast = getBlastRadius(index, "hub", 3, 10);
    expect(blast.truncated).toBe(true);
    expect(blast.totalAffected).toBe(10);
  });

  it("returns an empty radius for an isolated node", () => {
    const index = buildAdjacency([edge("a", "b")]);

    const blast = getBlastRadius(index, "lonely", 3);
    expect(blast.totalAffected).toBe(0);
    expect(blast.truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-CENTRALITY
// ---------------------------------------------------------------------------

describe("centrality and critical nodes (PMO-LG-CENTRALITY)", () => {
  it("normalises degree against the most connected node", () => {
    const index = buildAdjacency([edge("hub", "a"), edge("hub", "b"), edge("hub", "c"), edge("a", "b")]);

    const centrality = computeDegreeCentrality(index, ["hub", "a", "b", "c"]);
    expect(centrality.get("hub")).toBe(1);
    expect(centrality.get("c")).toBeCloseTo(1 / 3);
  });

  it("gives every node zero centrality when there are no edges", () => {
    const centrality = computeDegreeCentrality(buildAdjacency([]), ["a", "b"]);
    expect(centrality.get("a")).toBe(0);
  });

  it("never reports a critical node without an explanation", () => {
    const index = buildAdjacency([edge("hub", "a"), edge("hub", "b"), edge("hub", "c")]);
    const centrality = computeDegreeCentrality(index, ["hub", "a", "b", "c"]);

    const critical = identifyCriticalNodes([node("hub"), node("a")], index, centrality, []);
    expect(critical.length).toBeGreaterThan(0);
    for (const entry of critical) {
      expect(entry.reasons.length).toBeGreaterThan(0);
    }
  });

  it("ranks a node that is connected AND blocked AND cross-project highest", () => {
    const index = buildAdjacency([edge("hub", "a"), edge("hub", "b")]);
    const centrality = computeDegreeCentrality(index, ["hub", "a", "b"]);
    const crossProject = detectCrossProjectDependencies(
      [edge("hub", "a")],
      [node("hub", { projectId: "p1" }), node("a", { projectId: "p2" })],
    );

    const critical = identifyCriticalNodes(
      [node("hub", { projectId: "p1", health: "critical", status: "blocked", metrics: { isCritical: 1 } })],
      index,
      centrality,
      crossProject,
    );

    expect(critical[0].reasons.length).toBeGreaterThanOrEqual(3);
  });

  it("finds nodes with no relationships at all", () => {
    const index = buildAdjacency([edge("a", "b")]);

    const orphans = detectOrphanNodes(index, [node("a"), node("b"), node("lonely")]);
    expect(orphans.map((entry) => entry.id)).toEqual(["lonely"]);
  });

  it("reports a cross-project pair once per relationship type", () => {
    const nodes = [node("a", { projectId: "p1" }), node("b", { projectId: "p2" })];
    const crossProject = detectCrossProjectDependencies(
      [edge("a", "b"), edge("a", "b", { id: "second" })],
      nodes,
    );

    expect(crossProject).toHaveLength(1);
  });

  it("ignores relationships inside a single project", () => {
    const nodes = [node("a", { projectId: "p1" }), node("b", { projectId: "p1" })];

    expect(detectCrossProjectDependencies([edge("a", "b")], nodes)).toEqual([]);
  });

  it("assigns the same community to a connected cluster, deterministically", () => {
    const index = buildAdjacency([edge("a", "b"), edge("b", "c"), edge("x", "y")]);
    const ids = ["a", "b", "c", "x", "y"];

    const first = detectCommunities(index, ids);
    const second = detectCommunities(index, ids);

    expect([...first.entries()]).toEqual([...second.entries()]);
    expect(first.get("a")).toBe(first.get("c"));
    expect(first.get("a")).not.toBe(first.get("x"));
  });

  it("returns neighbours by direction", () => {
    const index = buildAdjacency([edge("a", "b"), edge("c", "a")]);

    expect(getNeighbors(index, "a", "outgoing")).toEqual(["b"]);
    expect(getNeighbors(index, "a", "incoming")).toEqual(["c"]);
    expect(getNeighbors(index, "a", "both").sort()).toEqual(["b", "c"]);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-METRICS
// ---------------------------------------------------------------------------

describe("portfolio metrics (PMO-LG-METRICS)", () => {
  function risk(id: string, projectId: string, severity: string, status: string): GraphNode {
    return node(id, {
      kind: "risk",
      projectId,
      status,
      metrics: { severity },
      canonicalEntityType: "risks",
    });
  }

  it("counts a project with many severe risks exactly once", () => {
    const nodes = [
      risk("risk:1", "p1", "critical", "open"),
      risk("risk:2", "p1", "high", "open"),
      risk("risk:3", "p1", "critical", "mitigating"),
      risk("risk:4", "p2", "critical", "open"),
    ];

    expect(countProjectsAtRisk(nodes)).toBe(2);
  });

  it("ignores risks that are closed or not severe", () => {
    const nodes = [
      risk("risk:1", "p1", "critical", "resolved"),
      risk("risk:2", "p2", "low", "open"),
    ];

    expect(countProjectsAtRisk(nodes)).toBe(0);
  });

  it("counts a budget item once when several risks reach it", () => {
    const nodes = [
      risk("risk:1", "p1", "critical", "open"),
      risk("risk:2", "p1", "high", "open"),
      node("task:1", { kind: "task", projectId: "p1" }),
      node("budget_item:1", { kind: "budget_item", projectId: "p1", metrics: { estimatedCost: 100_000 } }),
    ];
    const edges = [
      edge("risk:1", "task:1", { type: "impacts" }),
      edge("risk:2", "task:1", { type: "impacts" }),
      edge("budget_item:1", "task:1", { type: "consumes_budget" }),
    ];

    const exposure = computeRiskExposureAmount(nodes, edges);
    expect(exposure).toEqual({ state: "ok", value: 100_000 });
  });

  it("says unavailable — not zero — when there is no budget data", () => {
    const exposure = computeRiskExposureAmount([risk("risk:1", "p1", "critical", "open")], []);
    expect(exposure.state).toBe("unavailable");
  });

  it("reports zero exposure honestly when budgets exist but no severe risk does", () => {
    const nodes = [node("budget_item:1", { kind: "budget_item", metrics: { estimatedCost: 5_000 } })];
    expect(computeRiskExposureAmount(nodes, [])).toEqual({ state: "ok", value: 0 });
  });

  it("keeps monetary exposure and blocked days as separate fields", () => {
    const metrics = computePortfolioMetrics({
      nodes: [node("budget_item:1", { kind: "budget_item", metrics: { estimatedCost: 1_000 } })],
      edges: [],
      crossProject: [],
      sharedResources: [],
      criticalNodeCount: 0,
      orphanNodeCount: 0,
      blockedDaysByProject: new Map([["p1", 12]]),
    });

    expect(metrics.blockedDays).toEqual({ state: "ok", value: 12 });
    expect(metrics.riskExposureAmount.state).toBe("ok");
    // Two distinct fields, never one combined figure.
    expect(Object.keys(metrics)).toContain("riskExposureAmount");
    expect(Object.keys(metrics)).toContain("blockedDays");
  });

  it("marks blocked days unavailable when there is no history to read", () => {
    const metrics = computePortfolioMetrics({
      nodes: [],
      edges: [],
      crossProject: [],
      sharedResources: [],
      criticalNodeCount: 0,
      orphanNodeCount: 0,
      blockedDaysByProject: null,
    });

    expect(metrics.blockedDays.state).toBe("unavailable");
  });

  it("counts a resource shared across three projects once", () => {
    const links: SharedResourceLink[] = [
      { resourceProfileId: "rp1", resourceLabel: "Ana", projectAId: "p1", projectBId: "p2", overlapStart: "2026-01-01", overlapEnd: null, combinedAllocationPercent: 120, evidenceRefs: [] },
      { resourceProfileId: "rp1", resourceLabel: "Ana", projectAId: "p1", projectBId: "p3", overlapStart: "2026-01-01", overlapEnd: null, combinedAllocationPercent: 80, evidenceRefs: [] },
    ];

    expect(countSharedResources(links)).toBe(1);
    expect(countOverallocatedResources(links)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-LAYOUT / PMO-LG-EMPTY-STATE
// ---------------------------------------------------------------------------

describe("subgraph window (PMO-LG-LAYOUT, PMO-LG-EMPTY-STATE)", () => {
  const portfolio = [
    node("organization:org-1", { kind: "organization" }),
    node("project:p1", { kind: "project", projectId: "p1", label: "Terminal" }),
    node("project:p2", { kind: "project", projectId: "p2", label: "Runway" }),
    node("task:t1", { kind: "task", projectId: "p1", label: "Pour slab" }),
    node("milestone:m1", { kind: "milestone", projectId: "p1", label: "Foundation" }),
  ];

  it("keeps projects collapsed by default — never renders the whole portfolio", () => {
    const window = buildGraphWindow(portfolio, [], {
      zoom: "far",
      expandedProjectIds: [],
      filters: defaultFilters(),
    });

    expect(window.nodes.map((entry) => entry.id).sort()).toEqual([
      "organization:org-1",
      "project:p1",
      "project:p2",
    ]);
  });

  it("reveals a project's internals only once expanded", () => {
    const window = buildGraphWindow(portfolio, [], {
      zoom: "near",
      expandedProjectIds: ["p1"],
      filters: defaultFilters(),
    });

    const ids = window.nodes.map((entry) => entry.id);
    expect(ids).toContain("task:t1");
    expect(ids).toContain("milestone:m1");
  });

  it("hides kinds that are illegible at the current zoom", () => {
    const window = buildGraphWindow(portfolio, [], {
      zoom: "far",
      expandedProjectIds: ["p1"],
      filters: defaultFilters(),
    });

    expect(window.nodes.some((entry) => entry.kind === "task")).toBe(false);
  });

  it("searches node labels", () => {
    const window = buildGraphWindow(portfolio, [], {
      zoom: "far",
      expandedProjectIds: [],
      filters: { ...defaultFilters(), search: "runway" },
    });

    expect(window.nodes.map((entry) => entry.label)).toEqual(["Runway"]);
  });

  it("states truncation instead of hiding it", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      node(`project:p${i}`, { kind: "project", projectId: `p${i}` }),
    );

    const window = buildGraphWindow(many, [], {
      zoom: "far",
      expandedProjectIds: [],
      filters: defaultFilters(),
      nodeLimit: 10,
    });

    expect(window.truncated).toBe(true);
    expect(window.nodes).toHaveLength(10);
    expect(window.totalNodeCount).toBe(30);
  });

  it("drops edges left dangling by the window", () => {
    const edges = [edge("project:p1", "task:t1", { type: "contains" })];
    const window = buildGraphWindow(portfolio, edges, {
      zoom: "far",
      expandedProjectIds: [],
      filters: defaultFilters(),
    });

    expect(window.edges).toEqual([]);
  });

  it("returns an honestly empty projection for an empty portfolio", () => {
    const window = buildGraphWindow([], [], {
      zoom: "far",
      expandedProjectIds: [],
      filters: defaultFilters(),
    });

    expect(window).toEqual({ nodes: [], edges: [], truncated: false, totalNodeCount: 0 });
  });

  it("discards saved positions whose nodes no longer exist", () => {
    const result = pruneOrphanPositions(
      { "project:p1": { x: 10, y: 20 }, "project:gone": { x: 30, y: 40 } },
      new Set(["project:p1"]),
    );

    expect(result.positions).toEqual({ "project:p1": { x: 10, y: 20 } });
    expect(result.dropped).toEqual(["project:gone"]);
  });
});
