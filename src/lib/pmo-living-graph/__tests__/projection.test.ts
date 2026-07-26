// ============================================================================
// CAP-048 — projection guards
// Guards: PMO-LG-FLAG-OFF, PMO-LG-NODE-PROJECTION, PMO-LG-EDGE-PROJECTION,
//         PMO-LG-SHARED-RESOURCE, PMO-LG-ORG-ISOLATION
// ============================================================================

import { afterEach, describe, expect, it } from "vitest";
import { canAccessPmoLivingGraph, isPmoLivingGraphEnabled } from "../flags";
import {
  assertSingleOrganization,
  healthFromStatus,
  nodeId,
  projectNodes,
  type CanonicalRows,
} from "../node-projection";
import { projectEdges, pruneDanglingEdges, type CanonicalRelations } from "../edge-projection";
import {
  detectCapacityConflicts,
  detectSharedResources,
  rangesOverlap,
  type ResourceAllocationRow,
} from "../shared-resources";

const ORG = "org-1";
const OTHER_ORG = "org-2";

function emptyRows(): CanonicalRows {
  return {
    organization: null,
    projects: [],
    milestones: [],
    tasks: [],
    subtasks: [],
    risks: [],
    decisions: [],
    resources: [],
    stakeholders: [],
    kpis: [],
    budgetItems: [],
  };
}

function emptyRelations(): CanonicalRelations {
  return {
    projects: [],
    milestones: [],
    tasks: [],
    subtasks: [],
    taskDependencies: [],
    risks: [],
    budgetItems: [],
    traceabilityLinks: [],
  };
}

// ---------------------------------------------------------------------------
// PMO-LG-FLAG-OFF
// ---------------------------------------------------------------------------

describe("feature flag (PMO-LG-FLAG-OFF)", () => {
  const original = process.env.PMO_LIVING_GRAPH_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.PMO_LIVING_GRAPH_ENABLED;
    else process.env.PMO_LIVING_GRAPH_ENABLED = original;
  });

  it("is off when the variable is unset — the default the app ships with", () => {
    delete process.env.PMO_LIVING_GRAPH_ENABLED;
    expect(isPmoLivingGraphEnabled()).toBe(false);
    expect(canAccessPmoLivingGraph("owner")).toBe(false);
  });

  it("stays off for any value other than the exact string \"true\"", () => {
    for (const value of ["1", "yes", "TRUE", "on", ""]) {
      process.env.PMO_LIVING_GRAPH_ENABLED = value;
      expect(isPmoLivingGraphEnabled(), `value ${JSON.stringify(value)}`).toBe(false);
    }
  });

  it("denies unauthorized roles even once enabled", () => {
    process.env.PMO_LIVING_GRAPH_ENABLED = "true";
    expect(canAccessPmoLivingGraph("owner")).toBe(true);
    expect(canAccessPmoLivingGraph("admin")).toBe(true);
    expect(canAccessPmoLivingGraph("member")).toBe(false);
    expect(canAccessPmoLivingGraph("viewer")).toBe(false);
    expect(canAccessPmoLivingGraph("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-NODE-PROJECTION
// ---------------------------------------------------------------------------

describe("node projection (PMO-LG-NODE-PROJECTION)", () => {
  it("keeps a pointer back to the canonical record", () => {
    const nodes = projectNodes({
      ...emptyRows(),
      projects: [
        {
          id: "p1",
          organization_id: ORG,
          title: "Terminal Expansion",
          status: "active",
          start_date: "2026-01-01",
          target_end_date: "2026-12-31",
          updated_at: "2026-07-01T00:00:00Z",
        },
      ],
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: "project:p1",
      kind: "project",
      canonicalEntityType: "projects",
      canonicalEntityId: "p1",
      provenance: "OBSERVED",
      label: "Terminal Expansion",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    });
    expect(nodes[0].evidenceRefs).toEqual([{ sourceTable: "projects", sourceId: "p1" }]);
  });

  it("treats an unrecognised status as unknown, never as healthy", () => {
    expect(healthFromStatus(null)).toBe("unknown");
    expect(healthFromStatus("something_new")).toBe("unknown");
    expect(healthFromStatus("blocked")).toBe("critical");
    expect(healthFromStatus("on_hold")).toBe("at_risk");
    expect(healthFromStatus("active")).toBe("healthy");
  });

  it("derives risk health from severity, not from the status alone", () => {
    const nodes = projectNodes({
      ...emptyRows(),
      risks: [
        { id: "r1", organization_id: ORG, project_id: "p1", title: "Permit delay", description: null, status: "open", severity: "critical", probability: "high", impact: "critical", updated_at: null },
        { id: "r2", organization_id: ORG, project_id: "p1", title: "Minor", description: null, status: "open", severity: "low", probability: "low", impact: "low", updated_at: null },
        { id: "r3", organization_id: ORG, project_id: "p1", title: "Handled", description: null, status: "resolved", severity: "critical", probability: "high", impact: "critical", updated_at: null },
      ],
    });

    expect(nodes.map((node) => node.health)).toEqual(["critical", "healthy", "healthy"]);
  });

  it("leaves criticality at zero — it depends on graph position, computed later", () => {
    const nodes = projectNodes({
      ...emptyRows(),
      tasks: [
        { id: "t1", organization_id: ORG, project_id: "p1", milestone_id: null, title: "Pour slab", description: null, status: "in_progress", priority: null, start_date: null, end_date: null, is_critical: true, slack_days: 0, estimate_hours: 8, actual_hours: 4, updated_at: null },
      ],
    });

    expect(nodes[0].criticality).toBe(0);
    expect(nodes[0].metrics.isCritical).toBe(1);
  });

  it("produces no nodes for kinds that have no table (portfolio, program, phase…)", () => {
    // The empty input is the point: there is no row source to project from, and
    // the projection must not conjure placeholder nodes.
    expect(projectNodes(emptyRows())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-ORG-ISOLATION
// ---------------------------------------------------------------------------

describe("organization isolation (PMO-LG-ORG-ISOLATION)", () => {
  it("drops nodes belonging to another tenant", () => {
    const nodes = projectNodes({
      ...emptyRows(),
      projects: [
        { id: "p1", organization_id: ORG, title: "Ours", status: "active", start_date: null, target_end_date: null, updated_at: null },
        { id: "p2", organization_id: OTHER_ORG, title: "Theirs", status: "active", start_date: null, target_end_date: null, updated_at: null },
      ],
    });

    const scoped = assertSingleOrganization(nodes, ORG);
    expect(scoped.map((node) => node.label)).toEqual(["Ours"]);
  });

  it("never builds an edge from another tenant's rows", () => {
    const edges = projectEdges(
      {
        ...emptyRelations(),
        projects: [{ id: "p2", organization_id: OTHER_ORG }],
        milestones: [{ id: "m2", organization_id: OTHER_ORG, project_id: "p2" }],
      },
      [],
      ORG,
    );

    expect(edges).toEqual([]);
  });

  it("never links two projects across organizations through a shared resource", () => {
    const allocations: ResourceAllocationRow[] = [
      { id: "a1", organization_id: ORG, project_id: "p1", resource_profile_id: "rp1", display_name: "Ana", allocation_percent: 50, start_date: "2026-01-01", end_date: "2026-06-01", status: "active" },
      { id: "a2", organization_id: OTHER_ORG, project_id: "p9", resource_profile_id: "rp1", display_name: "Ana", allocation_percent: 50, start_date: "2026-01-01", end_date: "2026-06-01", status: "active" },
    ];

    expect(detectSharedResources(allocations, ORG)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-SHARED-RESOURCE
// ---------------------------------------------------------------------------

describe("shared resource detection (PMO-LG-SHARED-RESOURCE)", () => {
  const base = {
    organization_id: ORG,
    resource_profile_id: "rp1",
    display_name: "Ana Rivera",
    status: "active",
  };

  it("detects overlapping allocations across two projects", () => {
    const links = detectSharedResources(
      [
        { ...base, id: "a1", project_id: "p1", allocation_percent: 60, start_date: "2026-01-01", end_date: "2026-06-30" },
        { ...base, id: "a2", project_id: "p2", allocation_percent: 60, start_date: "2026-05-01", end_date: "2026-09-30" },
      ],
      ORG,
    );

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      projectAId: "p1",
      projectBId: "p2",
      overlapStart: "2026-05-01",
      overlapEnd: "2026-06-30",
      combinedAllocationPercent: 120,
    });
    // Both allocations are cited, so the UI can explain the edge with records.
    expect(links[0].evidenceRefs).toHaveLength(2);
  });

  it("does not link allocations that never overlap", () => {
    const links = detectSharedResources(
      [
        { ...base, id: "a1", project_id: "p1", allocation_percent: 100, start_date: "2026-01-01", end_date: "2026-03-31" },
        { ...base, id: "a2", project_id: "p2", allocation_percent: 100, start_date: "2026-04-01", end_date: "2026-06-30" },
      ],
      ORG,
    );

    expect(links).toEqual([]);
  });

  it("treats a single shared day as an overlap", () => {
    expect(rangesOverlap("2026-01-01", "2026-03-31", "2026-03-31", "2026-06-30")).toBe(true);
    expect(rangesOverlap("2026-01-01", "2026-03-30", "2026-03-31", "2026-06-30")).toBe(false);
  });

  it("handles open-ended allocations as unbounded", () => {
    expect(rangesOverlap("2026-01-01", null, "2027-01-01", null)).toBe(true);
    expect(rangesOverlap(null, "2026-01-01", "2025-01-01", null)).toBe(true);
  });

  it("ignores allocations that were removed or never activated", () => {
    const links = detectSharedResources(
      [
        { ...base, id: "a1", project_id: "p1", allocation_percent: 50, start_date: "2026-01-01", end_date: "2026-12-31" },
        { ...base, id: "a2", project_id: "p2", allocation_percent: 50, start_date: "2026-01-01", end_date: "2026-12-31", status: "removed" },
      ],
      ORG,
    );

    expect(links).toEqual([]);
  });

  it("reports one link per project pair, however many allocations back it", () => {
    const links = detectSharedResources(
      [
        { ...base, id: "a1", project_id: "p1", allocation_percent: 30, start_date: "2026-01-01", end_date: "2026-12-31" },
        { ...base, id: "a2", project_id: "p1", allocation_percent: 30, start_date: "2026-02-01", end_date: "2026-11-30" },
        { ...base, id: "a3", project_id: "p2", allocation_percent: 30, start_date: "2026-01-01", end_date: "2026-12-31" },
      ],
      ORG,
    );

    expect(links).toHaveLength(1);
  });

  it("never pairs a project with itself", () => {
    const links = detectSharedResources(
      [
        { ...base, id: "a1", project_id: "p1", allocation_percent: 50, start_date: "2026-01-01", end_date: "2026-12-31" },
        { ...base, id: "a2", project_id: "p1", allocation_percent: 50, start_date: "2026-01-01", end_date: "2026-12-31" },
      ],
      ORG,
    );

    expect(links).toEqual([]);
  });

  it("flags only genuine over-commitment as a capacity conflict", () => {
    const links = detectSharedResources(
      [
        { ...base, id: "a1", project_id: "p1", allocation_percent: 40, start_date: "2026-01-01", end_date: "2026-12-31" },
        { ...base, id: "a2", project_id: "p2", allocation_percent: 40, start_date: "2026-01-01", end_date: "2026-12-31" },
      ],
      ORG,
    );

    expect(links).toHaveLength(1);
    expect(detectCapacityConflicts(links)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PMO-LG-EDGE-PROJECTION
// ---------------------------------------------------------------------------

describe("edge projection (PMO-LG-EDGE-PROJECTION)", () => {
  it("builds the containment spine down to tasks", () => {
    const edges = projectEdges(
      {
        ...emptyRelations(),
        projects: [{ id: "p1", organization_id: ORG }],
        milestones: [{ id: "m1", organization_id: ORG, project_id: "p1" }],
        tasks: [{ id: "t1", organization_id: ORG, project_id: "p1", milestone_id: "m1" }],
      },
      [],
      ORG,
    );

    const pairs = edges.map((edge) => [edge.type, edge.sourceNodeId, edge.targetNodeId]);
    expect(pairs).toEqual([
      ["contains", nodeId("organization", ORG), "project:p1"],
      ["contains", "project:p1", "milestone:m1"],
      ["contains", "milestone:m1", "task:t1"],
    ]);
  });

  it("hangs a milestone-less task off its project instead of dropping it", () => {
    const edges = projectEdges(
      {
        ...emptyRelations(),
        tasks: [{ id: "t1", organization_id: ORG, project_id: "p1", milestone_id: null }],
      },
      [],
      ORG,
    );

    expect(edges[0]).toMatchObject({ sourceNodeId: "project:p1", targetNodeId: "task:t1" });
  });

  it("records dependency type and lag as evidence", () => {
    const edges = projectEdges(
      {
        ...emptyRelations(),
        taskDependencies: [
          { id: "d1", organization_id: ORG, project_id: "p1", predecessor_id: "t1", successor_id: "t2", dependency_type: "finish_to_start", lag_days: 3 },
        ],
      },
      [],
      ORG,
    );

    expect(edges[0]).toMatchObject({
      type: "depends_on",
      sourceNodeId: "task:t2",
      targetNodeId: "task:t1",
      provenance: "OBSERVED",
    });
    expect(edges[0].evidenceRefs[0].note).toContain("finish_to_start");
    expect(edges[0].evidenceRefs[0].note).toContain("lag 3d");
  });

  it("attaches an unlinked risk to its project so it never becomes an orphan", () => {
    const edges = projectEdges(
      {
        ...emptyRelations(),
        risks: [
          { id: "r1", organization_id: ORG, project_id: "p1", linked_task_id: null, linked_milestone_id: null, severity: "high", status: "open" },
        ],
      },
      [],
      ORG,
    );

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ type: "impacts", sourceNodeId: "risk:r1", targetNodeId: "project:p1" });
  });

  it("marks computed resource sharing as INFERRED, never as OBSERVED", () => {
    const edges = projectEdges(emptyRelations(), [
      {
        resourceProfileId: "rp1",
        resourceLabel: "Ana",
        projectAId: "p1",
        projectBId: "p2",
        overlapStart: "2026-05-01",
        overlapEnd: "2026-06-30",
        combinedAllocationPercent: 120,
        evidenceRefs: [{ sourceTable: "project_resource_allocations", sourceId: "a1" }],
      },
    ], ORG);

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      type: "shares_resource_with",
      provenance: "INFERRED",
      direction: "undirected",
    });
    expect(edges[0].confidence).toBeLessThan(1);
  });

  it("drops traceability link types with no honest equivalent", () => {
    const edges = projectEdges(
      {
        ...emptyRelations(),
        traceabilityLinks: [
          { id: "l1", organization_id: ORG, source_type: "decision", target_type: "project", source_id: "d1", target_id: "p1", link_type: "contradicts" },
          { id: "l2", organization_id: ORG, source_type: "decision", target_type: "project", source_id: "d1", target_id: "p1", link_type: "depends_on" },
        ],
      },
      [],
      ORG,
    );

    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("depends_on");
  });

  it("prunes edges whose endpoints left the window", () => {
    const edges = projectEdges(
      {
        ...emptyRelations(),
        projects: [{ id: "p1", organization_id: ORG }],
        milestones: [{ id: "m1", organization_id: ORG, project_id: "p1" }],
      },
      [],
      ORG,
    );

    const pruned = pruneDanglingEdges(edges, new Set([nodeId("organization", ORG), "project:p1"]));
    expect(pruned).toHaveLength(1);
    expect(pruned[0].targetNodeId).toBe("project:p1");
  });
});
