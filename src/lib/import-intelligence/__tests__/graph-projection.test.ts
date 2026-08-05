// ============================================================================
// REG-048 (perf) — the import graph is described once, then written in bulk
// ============================================================================
// Guard: IMPORT-GRAPH-BULK
//
// Emitting the Living Graph one row at a time cost ~800 round trips for a
// 274-task plan, which is what made the phase unaffordable and got it cut
// short. The projection is now pure — described first, written in two bulk
// statements — so its shape can be asserted here.
//
// The property that matters: an edge is only produced when BOTH of its nodes
// exist. If the node phase is cut short, the surviving edges must still be
// coherent instead of pointing at nodes that were never written.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildImportGraphNodes, buildImportGraphEdges } from "../graph-projection";
import { processNodeKey } from "@/lib/graph/emit-event";
import { emptyCanonicalImport } from "../extract";
import type { CanonicalImport, CanonicalTask } from "@/types/import-intelligence";

const ORG = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const IMPORT_NODE = "99999999-9999-4999-8999-999999999999";

function task(overrides: Partial<CanonicalTask>): CanonicalTask {
  return {
    source_id: "T-1", name: "Task", description: "", phase: "", milestone: "",
    status: "not_started", priority: "p2", planned_start: "", planned_finish: "",
    duration_days: null, estimated_hours: null, assigned_to: "", required_materials: [],
    cost_code: "", location: "", discipline: "", trade: "",
    confidence_score: 0.9, source_reference: "sheet · row 2",
    ...overrides,
  };
}

function scenario(): {
  canonical: CanonicalImport;
  milestoneIdBySourceName: Map<string, string>;
  taskIdBySourceId: Map<string, string>;
  materialIdBySourceId: Map<string, string>;
} {
  const canonical = emptyCanonicalImport();
  canonical.tasks = [
    task({ source_id: "T-1", name: "Detallar el plan", phase: "Preparación" }),
    task({ source_id: "T-2", name: "Organigrama", phase: "Preparación" }),
    task({ source_id: "T-3", name: "Sin hito", phase: "" }),
  ];
  return {
    canonical,
    milestoneIdBySourceName: new Map([["preparacion", "ms-db-1"]]),
    taskIdBySourceId: new Map([["T-1", "task-db-1"], ["T-2", "task-db-2"], ["T-3", "task-db-3"]]),
    materialIdBySourceId: new Map(),
  };
}

const base = { organizationId: ORG, projectId: PROJECT, semanticallyCapturedIds: new Set<string>() };

describe("buildImportGraphNodes", () => {
  it("describes one node per milestone and task", () => {
    const s = scenario();
    const nodes = buildImportGraphNodes({ ...base, ...s });

    expect(nodes).toHaveLength(4); // 1 milestone + 3 tasks
    expect(nodes.filter((n) => n.nodeType === "milestone_gate")).toHaveLength(1);
    expect(nodes.filter((n) => n.nodeType === "task_transition")).toHaveLength(3);
  });

  it("skips entities that were never written to the database", () => {
    const s = scenario();
    s.taskIdBySourceId.delete("T-2"); // e.g. the row was rejected
    const nodes = buildImportGraphNodes({ ...base, ...s });

    expect(nodes.filter((n) => n.nodeType === "task_transition")).toHaveLength(2);
    expect(nodes.map((n) => n.sourceEntityId)).not.toContain("task-db-2");
  });

  it("records whether a canonical event was already emitted", () => {
    const s = scenario();
    const nodes = buildImportGraphNodes({
      ...base,
      ...s,
      semanticallyCapturedIds: new Set(["task-db-1"]),
    });
    const first = nodes.find((n) => n.sourceEntityId === "task-db-1")!;
    const second = nodes.find((n) => n.sourceEntityId === "task-db-2")!;
    expect(first.metadata?.canonical_event_emitted).toBe(true);
    expect(second.metadata?.canonical_event_emitted).toBe(false);
  });
});

describe("buildImportGraphEdges", () => {
  /** Emitting every described node, as a complete run would. */
  function allNodeIds(nodes: ReturnType<typeof buildImportGraphNodes>): Map<string, string> {
    return new Map(
      nodes.map((n, i) => [
        processNodeKey(n.sourceEntityType, n.sourceEntityId, n.nodeType),
        `node-${i}`,
      ]),
    );
  }

  it("links every node to the import, and tasks to their milestone", () => {
    const s = scenario();
    const nodeIdByKey = allNodeIds(buildImportGraphNodes({ ...base, ...s }));
    const edges = buildImportGraphEdges({
      organizationId: ORG, projectId: PROJECT, importNodeId: IMPORT_NODE, nodeIdByKey, ...s,
    });

    // 1 milestone + 3 tasks hang off the import; 2 tasks sit under Preparación.
    expect(edges.filter((e) => e.edgeType === "imported_from")).toHaveLength(4);
    expect(edges.filter((e) => e.edgeType === "contains")).toHaveLength(2);
  });

  it("produces no edge whose nodes were not written", () => {
    const s = scenario();
    // The node phase ran out of budget after the milestone.
    const nodes = buildImportGraphNodes({ ...base, ...s });
    const milestoneNode = nodes.find((n) => n.nodeType === "milestone_gate")!;
    const partial = new Map([
      [processNodeKey(milestoneNode.sourceEntityType, milestoneNode.sourceEntityId, milestoneNode.nodeType), "node-ms"],
    ]);

    const edges = buildImportGraphEdges({
      organizationId: ORG, projectId: PROJECT, importNodeId: IMPORT_NODE, nodeIdByKey: partial, ...s,
    });

    // Only the milestone edge survives — no dangling references to task nodes.
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ toNodeId: "node-ms", edgeType: "imported_from" });

    const known = new Set([IMPORT_NODE, ...partial.values()]);
    for (const edge of edges) {
      expect(known.has(edge.fromNodeId)).toBe(true);
      expect(known.has(edge.toNodeId)).toBe(true);
    }
  });

  it("still links milestones to tasks when the import node is missing", () => {
    const s = scenario();
    const nodeIdByKey = allNodeIds(buildImportGraphNodes({ ...base, ...s }));
    const edges = buildImportGraphEdges({
      organizationId: ORG, projectId: PROJECT, importNodeId: null, nodeIdByKey, ...s,
    });

    expect(edges.filter((e) => e.edgeType === "imported_from")).toHaveLength(0);
    expect(edges.filter((e) => e.edgeType === "contains")).toHaveLength(2);
  });

  it("matches a milestone by normalized title, accents included", () => {
    const s = scenario();
    const nodeIdByKey = allNodeIds(buildImportGraphNodes({ ...base, ...s }));
    const edges = buildImportGraphEdges({
      organizationId: ORG, projectId: PROJECT, importNodeId: IMPORT_NODE, nodeIdByKey, ...s,
    });
    // "Preparación" on the task resolves to the "preparacion" milestone key.
    expect(edges.some((e) => e.edgeType === "contains")).toBe(true);
  });
});
