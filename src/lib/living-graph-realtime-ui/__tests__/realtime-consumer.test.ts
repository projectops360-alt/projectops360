// ============================================================================
// LIVING-GRAPH-HIGH-FIDELITY-REALTIME-VISUALIZATION — pure consumer guards
// ============================================================================
// Protects the realtime UI's PURE consumer layer: it consumes ONLY the Task 4
// hierarchy-safe delta/sync contract (never raw events/DB/recalc internals),
// applies deltas replay-safely, narrows the hierarchy correctly (milestone →
// tasks → subtasks → child subtasks → evidence only in the overlay), keeps
// Expand-all scoped with no cross-scope leak, and derives honest sync state.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDeltaFromRecalculation,
  type LivingGraphChangedEntity,
  type LivingGraphRecalculationResult,
  LGRE_ENGINE_VERSION,
  LGRE_CONFIG_VERSION,
} from "@/lib/living-graph/realtime";
import {
  emptyViewModel,
  applyDelta,
  rebuildFromDeltas,
  markChangesAgainstPrevious,
  decayChangeStates,
  computeGraphSignature,
  emptyExpansion,
  expansionScopeKey,
  toggleExpanded,
  expandAllScoped,
  collapseAllScoped,
  resetScope,
  expandedIds,
  selectVisibleGraph,
  scopedExpandableNodeIds,
  computeRealtimeLayout,
  applySyncResponse,
  markStaleIfExpired,
  initialSyncState,
} from "@/lib/living-graph-realtime-ui";

const ORG = "org-a";
const PROJ = "proj-1";

function ent(id: string, change: LivingGraphChangedEntity["change"], payload: Record<string, unknown> | null = {}): LivingGraphChangedEntity {
  return { id, change, payload, sourceNoticeIds: [], sourceEventIds: [] };
}

function recalc(nodeChanges: LivingGraphChangedEntity[], edgeChanges: LivingGraphChangedEntity[] = []): LivingGraphRecalculationResult {
  return {
    resultId: "r", scope: { organizationId: ORG, projectId: PROJ }, mode: "partial",
    basedOnSnapshotVersion: 0, affectedNodeIds: [], affectedEdgeIds: [],
    nodeChanges, edgeChanges, reasons: ["event_appended"], confidence: "high", warnings: [],
    engineVersion: LGRE_ENGINE_VERSION, configVersion: LGRE_CONFIG_VERSION, generatedAt: "2026-07-03T00:00:00.000Z",
  };
}

function delta(nodeChanges: LivingGraphChangedEntity[], edgeChanges: LivingGraphChangedEntity[], based: number, produced: number) {
  return buildDeltaFromRecalculation({
    result: recalc(nodeChanges, edgeChanges),
    basedOnVersion: based, producedVersion: produced,
    rootScope: { type: "project", id: null }, deltaId: `d${produced}`,
    now: () => new Date("2026-07-03T00:00:00.000Z"),
  });
}

// A milestone + a task with 2 subtasks + hierarchy edges (all "added").
function seedDelta() {
  return delta(
    [
      ent("milestone:m1", "added", { nodeKind: "milestone", title: "Phase 1", status: "in_progress" }),
      ent("task:t1", "added", { title: "Build X", status: "in_progress", milestone_id: "m1", subtask_total: 2 }),
      ent("subtask:s1", "added", { is_subtask: true, parent_task_id: "task:t1", parent_node_id: "task:t1", milestone_id: "m1", title: "Sub 1", status: "in_progress" }),
      ent("subtask:s2", "added", { is_subtask: true, parent_task_id: "task:t1", parent_node_id: "task:t1", milestone_id: "m1", title: "Sub 2", status: "blocked" }),
      ent("event:e1", "added", { nodeKind: "event", title: "Evt" }),
    ],
    [
      ent("hierarchy:m1:t1", "added", { hierarchy: true, source: "milestone:m1", target: "task:t1" }),
      ent("hierarchy:t1:s1", "added", { hierarchy: true, source: "task:t1", target: "subtask:s1" }),
      ent("hierarchy:t1:s2", "added", { hierarchy: true, source: "task:t1", target: "subtask:s2" }),
      ent("dep:t1", "added", { edgeType: "caused", source: "task:t1", target: "task:t1" }),
      ent("ev:t1:e1", "added", { edgeType: "informed", source: "task:t1", target: "event:e1" }),
    ],
    0, 1,
  );
}

// ── Delta application (replay-safe) ───────────────────────────────────────────

describe("snapshot adapter — replay-safe delta application", () => {
  it("applies an initial add delta into the view model (consumes Task 4, not raw data)", () => {
    const res = applyDelta(emptyViewModel(PROJ, ORG), seedDelta());
    expect(res.applied).toBe(true);
    expect(res.model.version).toBe(1);
    expect(res.model.nodes["task:t1"].nodeKind).toBe("task");
    expect(res.model.nodes["subtask:s1"].visibility).toBe("visible_when_parent_expanded");
    expect(res.model.nodes["event:e1"].visibility).toBe("visible_in_evidence_overlay");
  });

  it("added/updated/removed all apply; removed drops the node", () => {
    let m = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model;
    m = applyDelta(m, delta([ent("task:t1", "updated", { title: "Build X2", status: "done" })], [], 1, 2)).model;
    expect(m.nodes["task:t1"].changeState).toBe("updated");
    m = applyDelta(m, delta([ent("subtask:s2", "removed", null)], [], 2, 3)).model;
    expect(m.nodes["subtask:s2"]).toBeUndefined();
  });

  it("rejects a delta with a mismatched base version → caller must full_resync (no unsafe merge)", () => {
    const m = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model;
    const res = applyDelta(m, delta([ent("task:t9", "added", {})], [], 5, 6)); // base 5 ≠ model 1
    expect(res.applied).toBe(false);
    expect(res.rejectedReason).toBe("base_version_mismatch");
    expect(res.model).toBe(m); // unchanged
  });

  it("rejects a wrong-scope delta (no cross-project merge)", () => {
    const other = buildDeltaFromRecalculation({
      result: { ...recalc([ent("task:x", "added", {})]), scope: { organizationId: ORG, projectId: "proj-other" } },
      basedOnVersion: 0, producedVersion: 1, rootScope: { type: "project", id: null }, deltaId: "dx",
    });
    const res = applyDelta(emptyViewModel(PROJ, ORG), other);
    expect(res.applied).toBe(false);
    expect(res.rejectedReason).toBe("wrong_scope");
  });

  it("an empty delta is valid — only the version advances", () => {
    const m = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model;
    const res = applyDelta(m, delta([], [], 1, 2));
    expect(res.applied).toBe(true);
    expect(res.model.version).toBe(2);
    expect(Object.keys(res.model.nodes)).toHaveLength(Object.keys(m.nodes).length);
  });

  it("rebuildFromDeltas replays an ordered sequence deterministically", () => {
    const seq = [seedDelta(), delta([ent("task:t1", "updated", { status: "done" })], [], 1, 2)];
    const m = rebuildFromDeltas(PROJ, ORG, seq);
    expect(m.version).toBe(2);
    expect(m.nodes["task:t1"].payload.status).toBe("done");
  });

  it("decayChangeStates settles pulses to stable past the window", () => {
    let m = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model; // all added @ v1
    m = applyDelta(m, delta([], [], 1, 5)).model; // advance version to 5
    const decayed = decayChangeStates(m, 2); // cutoff = 3; v1 changes decay
    expect(decayed.nodes["task:t1"].changeState).toBe("stable");
  });
});

// ── Realtime task-status sync (Workboard → LGRE → Living Graph) ───────────────

describe("realtime task status sync — end-to-end consumer path", () => {
  it("a status change flips the graph signature (drives the polling refetch)", () => {
    const before = computeGraphSignature([], [{ id: "t1", token: "in_progress" }], []);
    const after = computeGraphSignature([], [{ id: "t1", token: "done" }], []);
    expect(before).not.toBe(after);
    // Unchanged data → identical signature (no needless refetch/render).
    expect(computeGraphSignature([], [{ id: "t1", token: "done" }], [])).toBe(after);
  });

  it("a polled full-resync updates the visible task node status and pulses ONLY it", () => {
    // Browser state: task t1 in_progress.
    const v1 = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model;
    expect(v1.nodes["task:t1"].payload.status).toBe("in_progress");
    // A poll detects the change and rebuilds from the new snapshot (t1 → done).
    const newSnapshot = delta(
      [
        ent("milestone:m1", "added", { nodeKind: "milestone", title: "Phase 1", status: "in_progress" }),
        ent("task:t1", "added", { title: "Build X", status: "done", milestone_id: "m1", subtask_total: 2 }),
        ent("subtask:s1", "added", { is_subtask: true, parent_task_id: "task:t1", parent_node_id: "task:t1", milestone_id: "m1", title: "Sub 1", status: "in_progress" }),
        ent("subtask:s2", "added", { is_subtask: true, parent_task_id: "task:t1", parent_node_id: "task:t1", milestone_id: "m1", title: "Sub 2", status: "blocked" }),
        ent("event:e1", "added", { nodeKind: "event", title: "Evt" }),
      ],
      [],
      0, 1,
    );
    const rebuilt = rebuildFromDeltas(PROJ, ORG, [newSnapshot]);
    const marked = markChangesAgainstPrevious(rebuilt, v1);
    // The task node now shows "done" — WITHOUT any manual refresh.
    expect(marked.nodes["task:t1"].payload.status).toBe("done");
    // Only the changed node is marked updated (pulse); unchanged nodes stay stable.
    expect(marked.nodes["task:t1"].changeState).toBe("updated");
    expect(marked.nodes["subtask:s1"].changeState).toBe("stable");
    expect(marked.nodes["event:e1"].changeState).toBe("stable");
    expect(marked.version).toBe(v1.version + 1);
  });

  it("two clients converge on the same delta stream (cross-browser simulation)", () => {
    // Browser A and Browser B both start from the same snapshot.
    const a0 = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model;
    const b0 = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model;
    // Browser A moves t1 → done (persist happens server-side; both poll the new snapshot).
    const changed = delta([ent("task:t1", "added", { title: "Build X", status: "done", milestone_id: "m1", subtask_total: 2 })], [], 0, 1);
    // A rebuilds from its own action's result; B rebuilds from the SAME server snapshot.
    const aFinal = markChangesAgainstPrevious(rebuildFromDeltas(PROJ, ORG, [changed]), a0);
    const bFinal = markChangesAgainstPrevious(rebuildFromDeltas(PROJ, ORG, [changed]), b0);
    // Both browsers show the same task status — B never touched the DB, just the delta.
    expect(aFinal.nodes["task:t1"].payload.status).toBe("done");
    expect(bFinal.nodes["task:t1"].payload.status).toBe("done");
    expect(bFinal.nodes["task:t1"].changeState).toBe("updated"); // pulses on B too
  });
});

// ── Visibility narrowing (mandatory hierarchy) ────────────────────────────────

describe("visibility selector — mandatory hierarchy narrowing", () => {
  const model = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model;

  it("milestone scope shows milestone + direct tasks, NOT subtasks/events by default", () => {
    const v = selectVisibleGraph(model, { rootScope: { type: "milestone", id: "m1" }, expandedIds: new Set(), evidenceOverlay: false, dependencyOverlay: false });
    const ids = v.nodes.map((n) => n.nodeId);
    expect(ids).toContain("milestone:m1");
    expect(ids).toContain("task:t1");
    expect(ids).not.toContain("subtask:s1"); // subtasks hidden by default
    expect(ids).not.toContain("event:e1"); // evidence hidden by default
    expect(v.collapsedChildCount).toBe(2); // two hidden subtasks reported
  });

  it("expanding the task reveals its direct subtasks only", () => {
    const v = selectVisibleGraph(model, { rootScope: { type: "milestone", id: "m1" }, expandedIds: new Set(["task:t1"]), evidenceOverlay: false, dependencyOverlay: false });
    const ids = v.nodes.map((n) => n.nodeId);
    expect(ids).toContain("subtask:s1");
    expect(ids).toContain("subtask:s2");
    expect(ids).not.toContain("event:e1");
  });

  it("evidence/events appear ONLY with the evidence overlay enabled", () => {
    const off = selectVisibleGraph(model, { rootScope: { type: "project", id: null }, expandedIds: new Set(), evidenceOverlay: false, dependencyOverlay: false });
    expect(off.nodes.map((n) => n.nodeId)).not.toContain("event:e1");
    const on = selectVisibleGraph(model, { rootScope: { type: "project", id: null }, expandedIds: new Set(), evidenceOverlay: true, dependencyOverlay: false });
    expect(on.nodes.map((n) => n.nodeId)).toContain("event:e1");
  });

  it("hierarchy edges are visible by default; dependency/evidence edges only with their overlay", () => {
    const base = selectVisibleGraph(model, { rootScope: { type: "milestone", id: "m1" }, expandedIds: new Set(["task:t1"]), evidenceOverlay: false, dependencyOverlay: false });
    const kinds = new Set(base.edges.map((e) => e.edgeKind));
    expect(kinds.has("hierarchy")).toBe(true);
    expect(kinds.has("dependency")).toBe(false); // gated
    expect(kinds.has("evidence")).toBe(false); // gated
  });

  it("scopedExpandableNodeIds returns only in-scope tasks that have subtasks", () => {
    const ids = scopedExpandableNodeIds(model, { rootScope: { type: "milestone", id: "m1" }, expandedIds: new Set(), evidenceOverlay: false, dependencyOverlay: false });
    expect(ids).toContain("task:t1");
    expect(ids).not.toContain("event:e1");
    expect(ids).not.toContain("milestone:m1");
  });
});

// ── Expansion reducer (scoped, no leak) ───────────────────────────────────────

describe("expansion reducer — scoped, no cross-scope leak", () => {
  it("toggle/expand-all/collapse-all/reset are pure and scope-isolated", () => {
    const kM1 = expansionScopeKey(PROJ, { type: "milestone", id: "m1" });
    const kM2 = expansionScopeKey(PROJ, { type: "milestone", id: "m2" });
    let s = emptyExpansion();
    s = expandAllScoped(s, kM1, ["task:t1", "task:t2"]);
    expect(expandedIds(s, kM1).length).toBe(2);
    // Another milestone's scope is untouched — no leak.
    expect(expandedIds(s, kM2)).toEqual([]);
    s = toggleExpanded(s, kM1, "task:t1");
    expect(expandedIds(s, kM1)).toEqual(["task:t2"]);
    s = collapseAllScoped(s, kM1);
    expect(expandedIds(s, kM1)).toEqual([]);
    s = expandAllScoped(s, kM1, ["task:t1"]);
    s = resetScope(s, kM1);
    expect(expandedIds(s, kM1)).toEqual([]);
  });

  it("scope keys differ across milestones / tasks / projects", () => {
    expect(expansionScopeKey("p1", { type: "milestone", id: "m1" })).not.toBe(expansionScopeKey("p1", { type: "milestone", id: "m2" }));
    expect(expansionScopeKey("p1", { type: "task", id: "t1" })).not.toBe(expansionScopeKey("p1", { type: "milestone", id: "t1" }));
    expect(expansionScopeKey("p1", { type: "milestone", id: "m1" })).not.toBe(expansionScopeKey("p2", { type: "milestone", id: "m1" }));
  });
});

// ── Sync state ────────────────────────────────────────────────────────────────

describe("sync state — honest freshness", () => {
  const NOW = "2026-07-03T12:00:00.000Z";
  it("noop → live, deltas → recovering(live), full_resync → resync_required, unauthorized → unknown", () => {
    expect(applySyncResponse({ kind: "noop", reason: "x", deltas: [], snapshot: null, targetVersion: 3 }, NOW).freshness).toBe("live");
    const rec = applySyncResponse({ kind: "deltas", reason: "x", deltas: [], snapshot: null, targetVersion: 4 }, NOW);
    expect(rec.freshness).toBe("live");
    expect(rec.recovering).toBe(true);
    const rs = applySyncResponse({ kind: "full_resync", reason: "x", deltas: [], snapshot: null, targetVersion: 5 }, NOW);
    expect(rs.needsFullResync).toBe(true);
    expect(rs.freshness).toBe("resync_required");
    const un = applySyncResponse({ kind: "unauthorized", reason: "x", deltas: [], snapshot: null, targetVersion: null }, NOW);
    expect(un.unauthorized).toBe(true);
    expect(un.freshness).toBe("unknown");
  });

  it("markStaleIfExpired flips live → stale past the budget", () => {
    const live = applySyncResponse({ kind: "noop", reason: "x", deltas: [], snapshot: null, targetVersion: 1 }, NOW);
    expect(markStaleIfExpired(live, 1000, 5000).freshness).toBe("live");
    expect(markStaleIfExpired(live, 9000, 5000).freshness).toBe("stale");
    expect(initialSyncState().freshness).toBe("unknown");
  });
});

// ── Layout (deterministic, presentation-only) ─────────────────────────────────

describe("layout — deterministic, 3 modes", () => {
  const model = applyDelta(emptyViewModel(PROJ, ORG), seedDelta()).model;
  const nodes = Object.values(model.nodes);
  it("produces a position per node and is deterministic per mode", () => {
    for (const mode of ["mind_map", "hierarchical", "left_to_right"] as const) {
      const a = computeRealtimeLayout(nodes, mode);
      const b = computeRealtimeLayout(nodes, mode);
      expect(a.size).toBe(nodes.length);
      expect([...a.entries()]).toEqual([...b.entries()]);
    }
  });
  it("left_to_right places deeper depths further right", () => {
    const pos = computeRealtimeLayout(nodes, "left_to_right");
    expect(pos.get("milestone:m1")!.x).toBeLessThan(pos.get("task:t1")!.x);
    expect(pos.get("task:t1")!.x).toBeLessThan(pos.get("subtask:s1")!.x);
  });
});

// ── Import boundary ───────────────────────────────────────────────────────────

describe("import boundary — no raw event/DB consumption in the pure library", () => {
  it("the pure consumer modules never import Supabase, the event write path, or process graph tables", () => {
    const dir = join(process.cwd(), "src/lib/living-graph-realtime-ui");
    for (const f of ["view-model.ts", "snapshot-adapter.ts", "expansion-reducer.ts", "visibility-selector.ts", "sync-state.ts", "layout.ts", "index.ts"]) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
      expect(code).not.toMatch(/supabase|createClient|createAdminClient/i);
      expect(code).not.toMatch(/project_event_log|process_nodes|process_edges/);
      expect(code).not.toMatch(/emitProjectEvent|@\/lib\/events\//);
    }
  });
});
