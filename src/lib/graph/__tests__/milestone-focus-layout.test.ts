// ============================================================================
// LIVING-GRAPH-MILESTONE-FOCUS-LAYOUT-READABILITY — deterministic focus layout
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  computeMilestoneFocusLayout,
  computeMilestoneFocusPositions,
  groupMilestoneTasks,
  topologicallyOrderMilestoneTasks,
  detectMilestoneTaskCycles,
  summarizeExternalDependencies,
  shouldApplySavedFocusLayout,
  getMilestoneFocusLayoutKey,
} from "@/lib/graph/milestone-focus-layout";
import type { LivingGraphNode, LivingGraphEdge } from "@/types/living-graph";
import type { SavedGraphLayout } from "@/lib/graph/graph-layout-storage";

let seq = 0;
function node(o: Partial<LivingGraphNode> = {}): LivingGraphNode {
  seq += 1;
  return {
    id: o.id ?? `n${seq}`, projectId: "p1", nodeType: o.nodeType ?? "task_transition", sourceEntityType: "roadmap_tasks",
    sourceEntityId: o.id ?? `n${seq}`, label: o.label ?? `Task ${seq}`, description: null,
    status: o.status ?? "not_started", progress: o.progress ?? 0, startDate: null, endDate: null, durationDays: null,
    occurredAt: "2026-07-01T00:00:00Z", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
    riskLevel: null, isBlocked: o.isBlocked ?? false, isCritical: false,
    milestoneId: o.milestoneId ?? "M1", milestoneLabel: "Phase 5", milestoneOrder: 1,
    traceabilityScore: null, metadata: o.metadata ?? {},
  };
}
function edge(source: string, target: string, o: Partial<LivingGraphEdge> = {}): LivingGraphEdge {
  return {
    id: `${source}->${target}`, projectId: "p1", sourceNodeId: source, targetNodeId: target,
    edgeType: o.edgeType ?? "caused", weight: 1, lagDays: null, isCritical: false, riskLevel: null, metadata: o.metadata ?? {},
  };
}

describe("focus filtering + grouping", () => {
  it("includes only the selected milestone's tasks; excludes others", () => {
    const nodes = [node({ id: "a", milestoneId: "M1" }), node({ id: "b", milestoneId: "M2" })];
    const res = computeMilestoneFocusLayout({ selectedMilestoneId: "M1", nodes, edges: [] });
    const ids = res.nodes.map((n) => n.id);
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
  });

  it("groups tasks by status priority", () => {
    const nodes = [
      node({ id: "blk", isBlocked: true }),
      node({ id: "prog", status: "in_progress" }),
      node({ id: "todo", status: "not_started" }),
      node({ id: "done", status: "done" }),
      node({ id: "unk", status: "weird_status" }),
    ];
    const groups = groupMilestoneTasks(nodes, new Set());
    expect(groups.get("blocked")!.map((n) => n.id)).toEqual(["blk"]);
    expect(groups.get("in_progress")!.map((n) => n.id)).toEqual(["prog"]);
    expect(groups.get("not_started")!.map((n) => n.id)).toEqual(["todo"]);
    expect(groups.get("done")!.map((n) => n.id)).toEqual(["done"]);
    expect(groups.get("unsequenced")!.map((n) => n.id)).toEqual(["unk"]);
  });
});

describe("dependency ordering + cycles", () => {
  it("places predecessors before dependents (topological level)", () => {
    const edges = [edge("a", "b"), edge("b", "c")];
    const { level } = topologicallyOrderMilestoneTasks(new Set(["a", "b", "c"]), edges);
    expect(level.get("a")).toBe(0);
    expect(level.get("b")).toBe(1);
    expect(level.get("c")).toBe(2);
  });

  it("ignores synthetic milestone_chain edges as real dependencies", () => {
    const edges = [edge("a", "b", { edgeType: "enabled", metadata: { milestone_chain: true } })];
    const { level, cycleNodeIds } = topologicallyOrderMilestoneTasks(new Set(["a", "b"]), edges);
    expect(level.get("a")).toBe(0);
    expect(level.get("b")).toBe(0); // no real dependency → same level
    expect(cycleNodeIds.size).toBe(0);
  });

  it("does not crash on a cycle; puts affected nodes in cycle_conflict", () => {
    const nodes = [node({ id: "a", status: "not_started" }), node({ id: "b", status: "not_started" })];
    const edges = [edge("a", "b"), edge("b", "a")];
    const cycles = detectMilestoneTaskCycles(new Set(["a", "b"]), edges);
    expect([...cycles].sort()).toEqual(["a", "b"]);
    const res = computeMilestoneFocusLayout({ selectedMilestoneId: "M1", nodes, edges });
    expect(res.cycleWarnings[0].nodeIds).toEqual(["a", "b"]);
    expect(res.groups.find((g) => g.key === "cycle_conflict")!.nodeIds.sort()).toEqual(["a", "b"]);
  });
});

describe("external dependencies (compact summaries, not scattered)", () => {
  it("summarizes predecessors and successors crossing the milestone boundary", () => {
    const nodes = [node({ id: "in", milestoneId: "M1" }), node({ id: "extPred", label: "Phase 4 task", milestoneId: "M0" }), node({ id: "extSucc", label: "Phase 6 task", milestoneId: "M2" })];
    const edges = [edge("extPred", "in"), edge("in", "extSucc")];
    const sums = summarizeExternalDependencies("M1", nodes, edges);
    expect(sums).toContainEqual({ direction: "predecessor", nodeId: "extPred", label: "Phase 4 task", relatedTaskId: "in" });
    expect(sums).toContainEqual({ direction: "successor", nodeId: "extSucc", label: "Phase 6 task", relatedTaskId: "in" });
    // external nodes are NOT positioned as focus nodes
    const res = computeMilestoneFocusLayout({ selectedMilestoneId: "M1", nodes, edges });
    expect(res.nodes.map((n) => n.id)).toEqual(["in"]);
  });
});

describe("mind-map (radial) is the default initial layout", () => {
  it("fans tasks to the right of the center, spread vertically around y=0, order preserved", () => {
    const nodes = [
      node({ id: "a", status: "in_progress", label: "Alpha" }),
      node({ id: "b", status: "in_progress", label: "Beta" }),
      node({ id: "c", status: "in_progress", label: "Gamma" }),
    ];
    const res = computeMilestoneFocusLayout({ selectedMilestoneId: "M1", nodes, edges: [] }); // default mind_map
    // all tasks to the RIGHT of the root (x > 0)
    expect(res.nodes.every((n) => n.x > 0)).toBe(true);
    // vertically spread around the center (some above, some below 0)
    const ys = res.nodes.map((n) => n.y);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(0);
    // deterministic order preserved (Alpha, Beta, Gamma top→bottom)
    const byY = [...res.nodes].sort((p, q) => p.y - q.y).map((n) => n.id);
    expect(byY).toEqual(["a", "b", "c"]);
  });

  it("still supports the compact flow (columns) mode explicitly", () => {
    const nodes = [node({ id: "x", status: "blocked" }), node({ id: "y", status: "done" })];
    const res = computeMilestoneFocusLayout({ selectedMilestoneId: "M1", nodes, edges: [], mode: "flow" });
    // flow places groups in distinct columns (different x)
    const xs = new Set(res.nodes.map((n) => n.x));
    expect(xs.size).toBe(2);
  });
});

describe("compact, bounded, stable positions", () => {
  it("produces bounded compact coordinates (no huge gaps) and is stable", () => {
    const nodes = Array.from({ length: 6 }, (_, i) => node({ id: `t${i}`, status: i % 2 ? "in_progress" : "not_started" }));
    const a = computeMilestoneFocusPositions({ selectedMilestoneId: "M1", nodes, edges: [] });
    const b = computeMilestoneFocusPositions({ selectedMilestoneId: "M1", nodes, edges: [] });
    expect([...a.entries()]).toEqual([...b.entries()]); // stable
    for (const p of a.values()) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(6 * 320);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(20 * 108);
    }
  });

  it("positions every input node (leftover/subtasks → unsequenced, never 0,0 pile-up)", () => {
    const nodes = [node({ id: "task", milestoneId: "M1" }), node({ id: "sub", milestoneId: null, nodeType: "subtask_item" })];
    const map = computeMilestoneFocusPositions({ selectedMilestoneId: "M1", nodes, edges: [] });
    expect(map.has("task")).toBe(true);
    expect(map.has("sub")).toBe(true);
  });
});

describe("a task's subtasks branch off the parent (attached, not scattered)", () => {
  it("places subtasks to the right of and near their parent, sharing its group", () => {
    const parent = node({ id: "p", status: "done", label: "Fix Isabella", milestoneId: "M1" });
    const s1 = node({ id: "sub:1", milestoneId: null, nodeType: "subtask_item", label: "Sub A" });
    const s2 = node({ id: "sub:2", milestoneId: null, nodeType: "subtask_item", label: "Sub B" });
    const edges = [
      edge("p", "sub:1", { edgeType: "subtask_of" }),
      edge("p", "sub:2", { edgeType: "subtask_of" }),
    ];
    const res = computeMilestoneFocusLayout({ selectedMilestoneId: "M1", nodes: [parent, s1, s2], edges });
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    const p = byId.get("p")!;
    const a = byId.get("sub:1")!;
    const b = byId.get("sub:2")!;
    expect(a.x).toBeGreaterThan(p.x); // to the right of the parent
    expect(b.x).toBeGreaterThan(p.x);
    expect(Math.abs(a.y - p.y)).toBeLessThanOrEqual(120); // vertically near the parent
    expect(a.group).toBe(p.group); // same branch/group as the parent
    expect(res.groups.find((g) => g.key === "done")!.nodeIds).toContain("p");
  });
});

describe("saved-layout scoping (global never applied to focus)", () => {
  const focusKey = getMilestoneFocusLayoutKey("p1", "M1");
  const savedGlobal: SavedGraphLayout = { version: 1, projectId: "p1", layoutKey: "activities:timeline", level: "activities", layoutMode: "timeline", nodes: { a: { x: 999, y: 999 } }, savedAt: "" };

  it("a global saved layout is NOT applied to focus mode", () => {
    expect(shouldApplySavedFocusLayout({ saved: savedGlobal, focusKey, nodeIds: ["a"] }).apply).toBe(false);
  });
  it("a focus saved layout applies only with matching key + exact node set", () => {
    const focusSaved: SavedGraphLayout = { ...savedGlobal, layoutKey: focusKey, nodes: { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } } };
    expect(shouldApplySavedFocusLayout({ saved: focusSaved, focusKey, nodeIds: ["a", "b"] }).apply).toBe(true);
    expect(shouldApplySavedFocusLayout({ saved: focusSaved, focusKey, nodeIds: ["a"] }).apply).toBe(false); // node-set mismatch
    expect(shouldApplySavedFocusLayout({ saved: focusSaved, focusKey: getMilestoneFocusLayoutKey("p1", "M2"), nodeIds: ["a", "b"] }).apply).toBe(false); // milestone mismatch
  });
  it("no saved layout → not applied", () => {
    expect(shouldApplySavedFocusLayout({ saved: null, focusKey, nodeIds: [] }).apply).toBe(false);
  });
});
