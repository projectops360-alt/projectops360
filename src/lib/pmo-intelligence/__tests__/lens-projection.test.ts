// ============================================================================
// CAP-048 Phase 2 · Milestone 4 — lens projection
// Guards: PMO-IC-LENS-REPROJECTS, PMO-IC-LENS-HONEST-GAPS,
//         PMO-IC-LENS-CAPACITY-ENGINE, PMO-IC-LENS-NO-RECOMPUTE
// ============================================================================
// The rule these tests exist to protect: a lens REPROJECTS the canvas. It never
// removes a node, never navigates, and never invents a number. Everything else
// here follows from that.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  projectLens,
  unavailableLenses,
  type LensProjectionInput,
} from "../lens-projection";
import { PMO_LENSES, type PmoLens } from "../scope";
import type { GraphEdge, GraphNode } from "@/lib/pmo-living-graph/contracts";

const ORG = "org-1";
const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

function node(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    organizationId: ORG,
    projectId: null,
    kind: "project",
    canonicalEntityType: "projects",
    canonicalEntityId: id.split(":")[1] ?? id,
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

function edge(id: string, overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id,
    organizationId: ORG,
    sourceNodeId: "a",
    targetNodeId: "b",
    type: "contains",
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

/** A small, realistic portfolio: org → two projects, with a risk and a task. */
function baseInput(overrides: Partial<LensProjectionInput> = {}): LensProjectionInput {
  return {
    nodes: [
      node("org:1", { kind: "organization", canonicalEntityId: "1" }),
      node("project:p1", { projectId: "p1", canonicalEntityId: "p1", label: "Bridge" }),
      node("project:p2", { projectId: "p2", canonicalEntityId: "p2", label: "Tunnel" }),
      node("task:t1", { kind: "task", projectId: "p1", canonicalEntityId: "t1" }),
      node("risk:r1", { kind: "risk", projectId: "p1", canonicalEntityId: "r1" }),
    ],
    edges: [
      edge("e1", { sourceNodeId: "project:p1", targetNodeId: "task:t1" }),
      edge("e2", { sourceNodeId: "task:t1", targetNodeId: "project:p2", type: "depends_on" }),
    ],
    criticalNodeIds: [],
    flow: null,
    risk: null,
    finance: null,
    capacity: null,
    dependencies: null,
    blockedDaysByProject: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PMO-IC-LENS-REPROJECTS
// ---------------------------------------------------------------------------

describe("a lens reprojects the same graph (PMO-IC-LENS-REPROJECTS)", () => {
  it("returns a projection for every declared lens", () => {
    // Totality matters: a missing case would silently fall through to a blank
    // canvas that reads as "this part of the portfolio is fine".
    const input = baseInput();
    for (const lens of PMO_LENSES) {
      const projection = projectLens(input, lens);
      expect(projection.lens).toBe(lens);
      expect(projection.highlightedNodeIds).toBeInstanceOf(Set);
    }
  });

  it("never removes a node — it only decorates", () => {
    // The output has no node list at all, which is the structural guarantee.
    // Highlight and dim are ids drawn from the input; nothing else can happen.
    const input = baseInput({
      risk: { rows: [{ projectId: "p1", openCount: 2, criticalCount: 1 }], systemic: [], criticalOpenCount: 1 },
    });
    const projection = projectLens(input, "risk");
    const known = new Set(input.nodes.map((item) => item.id));
    for (const id of projection.highlightedNodeIds) expect(known.has(id)).toBe(true);
    for (const id of projection.dimmedNodeIds) expect(known.has(id)).toBe(true);
    expect(Object.keys(projection)).not.toContain("nodes");
  });

  it("dims nothing on overview — the default view must not grey itself out", () => {
    const projection = projectLens(baseInput(), "overview");
    expect(projection.dimmedNodeIds.size).toBe(0);
  });

  it("dims the complement only when something is actually highlighted", () => {
    // A lens that found nothing must not dim the whole canvas: an empty answer
    // and a broken screen would look identical.
    const empty = projectLens(
      baseInput({ risk: { rows: [], systemic: [], criticalOpenCount: 0 } }),
      "risk",
    );
    expect(empty.highlightedNodeIds.size).toBe(0);
    expect(empty.dimmedNodeIds.size).toBe(0);
  });

  it("never dims the organization anchor", () => {
    const projection = projectLens(
      baseInput({
        risk: { rows: [{ projectId: "p1", openCount: 1, criticalCount: 0 }], systemic: [], criticalOpenCount: 0 },
      }),
      "risk",
    );
    expect(projection.dimmedNodeIds.has("org:1")).toBe(false);
    expect(projection.highlightedNodeIds.has("project:p1")).toBe(true);
    expect(projection.dimmedNodeIds.has("project:p2")).toBe(true);
  });

  it("highlights dependency edges as well as nodes", () => {
    const projection = projectLens(
      baseInput({
        dependencies: {
          perProject: [{ projectId: "p1", dependencyCount: 3 }],
          hubs: [{ taskId: "t1", projectId: "p1", outDegree: 4 }],
          totalDependencies: 3,
        },
      }),
      "dependencies",
    );
    expect(projection.highlightedEdgeIds.has("e2")).toBe(true);
    expect(projection.highlightedEdgeIds.has("e1")).toBe(false);
    // The hub is a task, matched by canonical id rather than node id.
    expect(projection.highlightedNodeIds.has("task:t1")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-LENS-HONEST-GAPS
// ---------------------------------------------------------------------------

describe("absent capabilities are declared, never simulated (PMO-IC-LENS-HONEST-GAPS)", () => {
  it("benefits projects nothing and says there is no data model", () => {
    // Parity matrix §4: no benefits / strategic-objective data model exists.
    const projection = projectLens(baseInput(), "benefits");
    expect(projection.hasData).toBe(false);
    expect(projection.highlightedNodeIds.size).toBe(0);
    expect(projection.annotations).toHaveLength(0);
    expect(projection.notices.some((n) => n.key === "noticeBenefitsNoDataModel" && n.isGap)).toBe(true);
  });

  it("marks benefits unavailable even when every other source is present", () => {
    const rich = baseInput({
      flow: { nodes: [], edges: [] },
      risk: { rows: [], systemic: [], criticalOpenCount: 0 },
      finance: { rows: [], alerts: [] },
      capacity: { rows: [], engine: "generic" },
      dependencies: { perProject: [], hubs: [], totalDependencies: 0 },
    });
    expect(unavailableLenses(rich).get("benefits")).toBe("noticeBenefitsNoDataModel");
    // Everything else is available, so nothing else is disabled.
    expect([...unavailableLenses(rich).keys()]).toEqual(["benefits"]);
  });

  it("disables a lens whose source failed rather than showing an empty one", () => {
    const reasons = unavailableLenses(baseInput());
    for (const lens of ["process", "risk", "finance", "resources", "dependencies"] as PmoLens[]) {
      expect(reasons.has(lens)).toBe(true);
    }
    expect(reasons.has("overview")).toBe(false);
  });

  it("states that blocked days could not be computed instead of showing zero", () => {
    const projection = projectLens(
      baseInput({ flow: { nodes: [{ id: "a", activity: "a", frequency: 1, bottleneckScore: 0, reworkOccurrences: 0, avgIncomingWaitingMs: null }], edges: [] } }),
      "process",
    );
    expect(projection.notices.some((n) => n.key === "noticeBlockedDaysUnavailable")).toBe(true);
  });

  it("declares the dependency overlay's own intra-project limitation", () => {
    const projection = projectLens(
      baseInput({ dependencies: { perProject: [], hubs: [], totalDependencies: 0 } }),
      "dependencies",
    );
    expect(
      projection.notices.some((n) => n.key === "noticeDependenciesIntraProjectOnly" && n.isGap),
    ).toBe(true);
  });

  it("says what-if is ephemeral and has no schedule simulation", () => {
    const projection = projectLens(
      baseInput({ finance: { rows: [{ projectId: "p1", baseline: 100, latestEac: 120, vac: -20, cpi: 0.9, currency: "USD" }], alerts: [] } }),
      "whatif",
    );
    const keys = projection.notices.map((n) => n.key);
    expect(keys).toContain("noticeWhatIfEphemeral");
    expect(keys).toContain("noticeWhatIfNoSchedule");
    // Only projects with a baseline can respond to a budget delta.
    expect(projection.highlightedNodeIds.has("project:p1")).toBe(true);
    expect(projection.highlightedNodeIds.has("project:p2")).toBe(false);
  });

  it("distinguishes no capacity inputs from zero availability", () => {
    const projection = projectLens(
      baseInput({
        capacity: {
          rows: [{ projectId: "p1", hasCapacityInputs: false, workforceAvailabilityPercent: null, overallocatedResourceCount: 0 }],
          engine: "generic",
        },
      }),
      "resources",
    );
    const annotation = projection.annotations.find((a) => a.nodeId === "project:p1");
    expect(annotation?.labelKey).toBe("annotationCapacityNoInputs");
    // A project with no inputs is not a finding; it must not be highlighted as
    // though a capacity problem were recorded.
    expect(projection.highlightedNodeIds.has("project:p1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-LENS-CAPACITY-ENGINE  (parity matrix §5 — the dangerous one)
// ---------------------------------------------------------------------------

describe("capacity figures name their engine (PMO-IC-LENS-CAPACITY-ENGINE)", () => {
  const rows = [
    { projectId: "p1", hasCapacityInputs: true, workforceAvailabilityPercent: 72, overallocatedResourceCount: 2 },
  ];

  it("labels the generic engine as hours", () => {
    const projection = projectLens(baseInput({ capacity: { rows, engine: "generic" } }), "resources");
    for (const annotation of projection.annotations) {
      expect(annotation.source).toContain("hours");
    }
    expect(
      projection.notices.some(
        (n) => n.key === "noticeCapacityEngine" && n.values?.engine === "engineGenericHours",
      ),
    ).toBe(true);
  });

  it("labels the labor engine as headcount", () => {
    const projection = projectLens(baseInput({ capacity: { rows, engine: "labor" } }), "resources");
    for (const annotation of projection.annotations) {
      expect(annotation.source).toContain("headcount");
    }
    expect(
      projection.notices.some(
        (n) => n.key === "noticeCapacityEngine" && n.values?.engine === "engineLaborHeadcount",
      ),
    ).toBe(true);
  });

  it("never emits a capacity number without a source", () => {
    // An unlabelled figure is exactly the failure §5 warns about: hours and
    // headcount are different units and the reader cannot tell them apart.
    const projection = projectLens(baseInput({ capacity: { rows, engine: "generic" } }), "resources");
    expect(projection.annotations.length).toBeGreaterThan(0);
    for (const annotation of projection.annotations) {
      expect(annotation.source).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-LENS-NO-RECOMPUTE  (ADR-012)
// ---------------------------------------------------------------------------

describe("the lens layer computes no metric of its own (PMO-IC-LENS-NO-RECOMPUTE)", () => {
  it("copies VAC and CPI from the read model rather than deriving them", () => {
    // The read model's VAC is negative here while baseline − EAC would be
    // positive. The lens must show the value it was GIVEN: if it recomputed,
    // this test fails, which is the point.
    const projection = projectLens(
      baseInput({
        finance: {
          rows: [{ projectId: "p1", baseline: 500, latestEac: 100, vac: -42, cpi: 0.8, currency: "EUR" }],
          alerts: [],
        },
      }),
      "finance",
    );
    const vac = projection.annotations.find((a) => a.labelKey === "annotationVac");
    expect(vac?.values?.amount).toBe(-42);
    expect(vac?.values?.currency).toBe("EUR");
    expect(vac?.source).toContain("financial_project_cockpit");
  });

  it("reports risk counts exactly as the overlay supplied them", () => {
    const projection = projectLens(
      baseInput({
        risk: {
          rows: [{ projectId: "p1", openCount: 7, criticalCount: 3 }],
          systemic: [{ riskId: "r1", projectId: "p1", severity: "critical", downstreamTaskCount: 9 }],
          criticalOpenCount: 3,
        },
      }),
      "risk",
    );
    const counts = projection.annotations.find((a) => a.labelKey === "annotationOpenRisks");
    expect(counts?.values).toEqual({ open: 7, critical: 3 });
    const systemic = projection.annotations.find((a) => a.labelKey === "annotationSystemicRisk");
    expect(systemic?.values?.downstream).toBe(9);
    expect(systemic?.nodeId).toBe("risk:r1");
  });

  it("uses the flow model's own bottleneck score and threshold", () => {
    const projection = projectLens(
      baseInput({
        flow: {
          nodes: [
            { id: "a", activity: "review", frequency: 10, bottleneckScore: 0.71, reworkOccurrences: 0, avgIncomingWaitingMs: 172_800_000 },
            { id: "b", activity: "approve", frequency: 5, bottleneckScore: 0.69, reworkOccurrences: 0, avgIncomingWaitingMs: null },
          ],
          edges: [{ from: "a", to: "b", isRework: false }],
        },
        blockedDaysByProject: new Map(),
      }),
      "process",
    );
    const bottlenecks = projection.notices.filter((n) => n.key === "noticeBottleneck");
    // Threshold is ≥ 0.7 (CAP-047 flow-projection), so 0.69 is not one.
    expect(bottlenecks).toHaveLength(1);
    expect(bottlenecks[0].values?.activity).toBe("review");
    expect(bottlenecks[0].values?.waitDays).toBe(2);
  });

  it("attaches blocked days to the project the event log named", () => {
    const projection = projectLens(
      baseInput({
        flow: { nodes: [{ id: "a", activity: "a", frequency: 1, bottleneckScore: 0, reworkOccurrences: 0, avgIncomingWaitingMs: null }], edges: [] },
        blockedDaysByProject: new Map([["p1", 12.34]]),
      }),
      "process",
    );
    const blocked = projection.annotations.find((a) => a.labelKey === "annotationBlockedDays");
    expect(blocked?.nodeId).toBe("project:p1");
    expect(blocked?.values?.days).toBe(12.3);
    expect(blocked?.tone).toBe("critical");
  });

  it("issues no query and imports no service", () => {
    // Structural guard, in the spirit of the Milestone 2 no-recompute test.
    // A lens that could read the database could also define a second version of
    // a metric, which is the exact failure ADR-012 exists to prevent.
    const text = source("src/lib/pmo-intelligence/lens-projection.ts");
    expect(text).not.toMatch(/@\/lib\/supabase/);
    expect(text).not.toMatch(/\bcreateClient\s*\(/);
    // Every import is type-only, and `server-only` is not among them. A runtime
    // import here would be a service call, and a service call could define a
    // second version of a metric.
    const runtimeImports = [...text.matchAll(/^import\s+(?!type\b)/gm)];
    expect(runtimeImports).toHaveLength(0);
  });

  it("is a pure function of its input", () => {
    // Same input twice must produce the same answer, and the input must come
    // back unmutated — the projection is recomputed on every lens click.
    const input = baseInput({
      risk: {
        rows: [{ projectId: "p1", openCount: 2, criticalCount: 1 }],
        systemic: [],
        criticalOpenCount: 1,
      },
    });
    const snapshot = JSON.stringify(input.nodes);
    const first = projectLens(input, "risk");
    const second = projectLens(input, "risk");
    expect([...first.highlightedNodeIds]).toEqual([...second.highlightedNodeIds]);
    expect(first.annotations).toEqual(second.annotations);
    expect(JSON.stringify(input.nodes)).toBe(snapshot);
  });
});
