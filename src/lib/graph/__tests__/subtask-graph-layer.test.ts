// ============================================================================
// LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE — graph layer guards
// ============================================================================
// Protects the Project Execution Map subtask visibility layer:
// - subtasks are NEVER dumped by default (no expanded parent ⇒ no subtask nodes);
// - tasks with subtasks get indicator metadata (count/progress/collapsed marker);
// - expanding a task adds synthetic subtask nodes + `subtask_of` hierarchy edges;
// - hierarchy edges are distinct from dependency edges;
// - deleted subtasks are never rendered;
// - deterministic ordering (sort_order → created_at → id);
// - expand/collapse/reset reducers are pure;
// - synthetic ids never collide with real process nodes;
// - the layer never mutates its inputs (no canonical mutation).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  appendSubtaskGraphLayer,
  groupSubtasksByTask,
  toggleSubtaskExpansion,
  expandAllSubtaskParents,
  collapseAllSubtaskParents,
  scopedExpandableTaskIds,
  isSubtaskGraphNodeId,
  type SubtaskLayerRow,
} from "@/lib/graph/subtask-graph-layer";
import type { LivingGraphNode, LivingGraphEdge } from "@/types/living-graph";

function taskNode(id: string, entityId: string, overrides: Partial<LivingGraphNode> = {}): LivingGraphNode {
  return {
    id,
    projectId: "proj-1",
    nodeType: "task_transition",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: entityId,
    label: `Task ${entityId}`,
    description: null,
    status: "in_progress",
    progress: 20,
    startDate: null,
    endDate: null,
    durationDays: null,
    occurredAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    riskLevel: "low",
    isBlocked: false,
    isCritical: false,
    milestoneId: "m1",
    milestoneLabel: "Phase 1",
    milestoneOrder: 0,
    traceabilityScore: null,
    metadata: {},
    ...overrides,
  };
}

function depEdge(id: string, from: string, to: string): LivingGraphEdge {
  return {
    id,
    projectId: "proj-1",
    sourceNodeId: from,
    targetNodeId: to,
    edgeType: "caused",
    weight: 1,
    lagDays: null,
    isCritical: false,
    riskLevel: null,
    metadata: {},
  };
}

let seq = 0;
function subtaskRow(taskId: string, overrides: Partial<SubtaskLayerRow> = {}): SubtaskLayerRow {
  seq += 1;
  return {
    id: `st-${seq}`,
    task_id: taskId,
    title: `Subtask ${seq}`,
    status: "in_progress",
    priority: "p2",
    progress: 40,
    owner_id: null,
    due_date: null,
    is_critical: false,
    blocked_reason: null,
    sort_order: seq,
    created_at: `2026-07-0${seq}T00:00:00.000Z`,
    deleted_at: null,
    ...overrides,
  };
}

describe("grouping", () => {
  it("groups by task, filters deleted, and orders deterministically", () => {
    const rows = [
      subtaskRow("t1", { id: "b", sort_order: 2, created_at: "2026-07-02T00:00:00.000Z" }),
      subtaskRow("t1", { id: "a", sort_order: 1, created_at: "2026-07-01T00:00:00.000Z" }),
      subtaskRow("t1", { id: "z", sort_order: 1, created_at: "2026-07-01T00:00:00.000Z" }),
      subtaskRow("t1", { id: "gone", deleted_at: "2026-07-03T00:00:00.000Z" }),
      subtaskRow("t2", { id: "c" }),
    ];
    const grouped = groupSubtasksByTask(rows);
    expect(grouped.get("t1")!.map((r) => r.id)).toEqual(["a", "z", "b"]); // sort_order then created_at then id
    expect(grouped.get("t1")!.find((r) => r.id === "gone")).toBeUndefined();
    expect(grouped.get("t2")!.map((r) => r.id)).toEqual(["c"]);
  });
});

describe("no dump by default (NotebookLM root-first)", () => {
  it("adds NO subtask nodes when nothing is expanded, but still marks the indicator", () => {
    const graph = { nodes: [taskNode("n1", "t1")], edges: [] as LivingGraphEdge[] };
    const subtasksByTask = groupSubtasksByTask([subtaskRow("t1"), subtaskRow("t1")]);
    const out = appendSubtaskGraphLayer(graph, {
      projectId: "proj-1",
      subtasksByTask,
      expandedTaskIds: new Set(), // collapsed
    });
    // No synthetic subtask nodes — clean collapsed view.
    expect(out.nodes.filter((n) => n.nodeType === "subtask_item")).toHaveLength(0);
    expect(out.edges.filter((e) => e.edgeType === "subtask_of")).toHaveLength(0);
    // But the task node carries indicator metadata (count + collapsed marker).
    const marked = out.nodes.find((n) => n.id === "n1")!;
    expect(marked.metadata.subtask_total).toBe(2);
    expect(marked.metadata.subtask_expanded).toBe(false);
  });
});

describe("progressive expansion", () => {
  it("expanding a task adds its subtask nodes + hierarchy edges connected to the parent", () => {
    const graph = { nodes: [taskNode("n1", "t1"), taskNode("n2", "t2")], edges: [] as LivingGraphEdge[] };
    const subtasksByTask = groupSubtasksByTask([
      subtaskRow("t1", { id: "s1" }),
      subtaskRow("t1", { id: "s2" }),
      subtaskRow("t2", { id: "s3" }),
    ]);
    const out = appendSubtaskGraphLayer(graph, {
      projectId: "proj-1",
      subtasksByTask,
      expandedTaskIds: new Set(["t1"]), // only t1 expanded
    });
    const subtaskNodes = out.nodes.filter((n) => n.nodeType === "subtask_item");
    // Only t1's subtasks appear — t2 stays collapsed (progressive).
    expect(subtaskNodes.map((n) => n.sourceEntityId).sort()).toEqual(["s1", "s2"]);
    // Hierarchy edges connect parent node → subtask nodes.
    const hierEdges = out.edges.filter((e) => e.edgeType === "subtask_of");
    expect(hierEdges).toHaveLength(2);
    for (const e of hierEdges) {
      expect(e.sourceNodeId).toBe("n1");
      expect(isSubtaskGraphNodeId(e.targetNodeId)).toBe(true);
    }
    // t2 marked expanded=false.
    expect(out.nodes.find((n) => n.id === "n2")!.metadata.subtask_expanded).toBe(false);
  });

  it("hierarchy edges (subtask_of) are distinct from dependency edges (caused)", () => {
    const graph = { nodes: [taskNode("n1", "t1")], edges: [depEdge("d1", "n1", "nx")] };
    const out = appendSubtaskGraphLayer(graph, {
      projectId: "proj-1",
      subtasksByTask: groupSubtasksByTask([subtaskRow("t1", { id: "s1" })]),
      expandedTaskIds: new Set(["t1"]),
    });
    expect(out.edges.find((e) => e.id === "d1")!.edgeType).toBe("caused"); // dependency preserved
    expect(out.edges.some((e) => e.edgeType === "subtask_of")).toBe(true); // hierarchy added
    expect("caused").not.toBe("subtask_of"); // different edge vocabularies
  });

  it("subtask nodes reflect status/progress/blocked/critical from the row", () => {
    const out = appendSubtaskGraphLayer(
      { nodes: [taskNode("n1", "t1")], edges: [] },
      {
        projectId: "proj-1",
        subtasksByTask: groupSubtasksByTask([
          subtaskRow("t1", { id: "s1", status: "blocked", is_critical: true, blocked_reason: "waiting" }),
          subtaskRow("t1", { id: "s2", status: "completed", progress: 30 }),
        ]),
        expandedTaskIds: new Set(["t1"]),
      },
    );
    const blocked = out.nodes.find((n) => n.sourceEntityId === "s1")!;
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.isCritical).toBe(true);
    expect(blocked.riskLevel).toBe("high");
    expect(blocked.metadata.blocked_reason).toBe("waiting");
    const completed = out.nodes.find((n) => n.sourceEntityId === "s2")!;
    expect(completed.progress).toBe(100); // completed always 100 regardless of stored progress
  });
});

describe("reducers (pure)", () => {
  it("toggle adds then removes a task id", () => {
    const a = toggleSubtaskExpansion(new Set(), "t1");
    expect([...a]).toEqual(["t1"]);
    const b = toggleSubtaskExpansion(a, "t1");
    expect(b.size).toBe(0);
  });

  it("expand-all expands every task with subtasks; collapse-all/reset clears", () => {
    expect([...expandAllSubtaskParents(["t1", "t2"])].sort()).toEqual(["t1", "t2"]);
    expect(collapseAllSubtaskParents().size).toBe(0);
  });
});

describe("scopedExpandableTaskIds (Expand all scope — requirements #3/#5/#6)", () => {
  const subtasksByTask = groupSubtasksByTask([
    subtaskRow("t1", { id: "a" }),
    subtaskRow("t2", { id: "b" }),
    subtaskRow("t3", { id: "c" }),
  ]);

  it("returns ONLY visible task nodes that have subtasks (never other milestones' tasks)", () => {
    // Visible = only t1 and t2 (t3 is in another milestone → not in the filtered set).
    const visible = [taskNode("n1", "t1"), taskNode("n2", "t2")];
    expect(scopedExpandableTaskIds(visible, subtasksByTask).sort()).toEqual(["t1", "t2"]);
    // t3 has subtasks but is NOT visible → never expanded.
    expect(scopedExpandableTaskIds(visible, subtasksByTask)).not.toContain("t3");
  });

  it("excludes visible tasks that have no subtasks", () => {
    const visible = [taskNode("n1", "t1"), taskNode("nx", "t-none")];
    expect(scopedExpandableTaskIds(visible, subtasksByTask)).toEqual(["t1"]);
  });

  it("excludes milestone/synthetic nodes (only roadmap_tasks qualify)", () => {
    const visible = [
      taskNode("ms", "t1", { nodeType: "milestone_gate", sourceEntityType: "milestones" }),
      taskNode("st", "t2", { nodeType: "subtask_item", sourceEntityType: "task_subtasks" }),
    ];
    expect(scopedExpandableTaskIds(visible, subtasksByTask)).toEqual([]);
  });

  it("is empty when nothing visible has subtasks (Expand all is a no-op)", () => {
    expect(scopedExpandableTaskIds([], subtasksByTask)).toEqual([]);
  });
});

describe("safety", () => {
  it("does nothing when there are no subtasks (existing graph untouched)", () => {
    const graph = { nodes: [taskNode("n1", "t1")], edges: [depEdge("d1", "n1", "nx")] };
    const out = appendSubtaskGraphLayer(graph, {
      projectId: "proj-1",
      subtasksByTask: new Map(),
      expandedTaskIds: new Set(["t1"]),
    });
    expect(out).toBe(graph); // identity — zero overhead, zero change
  });

  it("never mutates the input nodes, edges, or rows", () => {
    const nodes = [taskNode("n1", "t1")];
    const edges: LivingGraphEdge[] = [];
    const rows = [subtaskRow("t1", { id: "s1" })];
    const snapshot = JSON.parse(JSON.stringify({ nodes, edges, rows }));
    appendSubtaskGraphLayer(
      { nodes, edges },
      { projectId: "proj-1", subtasksByTask: groupSubtasksByTask(rows), expandedTaskIds: new Set(["t1"]) },
    );
    expect({ nodes, edges, rows }).toEqual(snapshot);
  });

  it("only roadmap_tasks nodes get subtasks (never milestone/other nodes)", () => {
    const milestoneNode = taskNode("ms1", "m1", {
      nodeType: "milestone_gate",
      sourceEntityType: "milestones",
    });
    const out = appendSubtaskGraphLayer(
      { nodes: [milestoneNode], edges: [] },
      {
        projectId: "proj-1",
        // A subtask row keyed by the milestone's entity id must NOT attach.
        subtasksByTask: groupSubtasksByTask([subtaskRow("m1", { id: "s1" })]),
        expandedTaskIds: new Set(["m1"]),
      },
    );
    expect(out.nodes.filter((n) => n.nodeType === "subtask_item")).toHaveLength(0);
  });
});
