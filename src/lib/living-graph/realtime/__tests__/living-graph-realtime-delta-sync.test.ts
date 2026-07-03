// ============================================================================
// Phase 4 · Task 4 — Delta Store & Sync Contract guards (LGRE-DELTA-SYNC-HIERARCHY-SAFE)
// ============================================================================
// Protects the hierarchy-safe delta/sync layer: deltas built from Task 3
// recalc results carry explicit node/edge KINDS, HIERARCHY refs, and VISIBILITY
// policy (evidence/events never default-visible; hierarchy edges distinct from
// dependency); replay-safe versioning (basedOn→produced); safe empty delta;
// dedup; missed-update recovery vs full_resync; RBAC deny-by-default with tenant
// isolation; observability; and no canonical / project_event_log / process graph
// mutation and no UI (import boundary).
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createLivingGraphDeltaStore,
  buildDeltaFromRecalculation,
  buildHierarchicalDelta,
  classifyGraphNodeKind,
  classifyGraphEdgeKind,
  resolveNodeVisibility,
  LGRE_ENGINE_VERSION,
  LGRE_CONFIG_VERSION,
  type LivingGraphRecalculationResult,
  type LivingGraphChangedEntity,
  type LivingGraphRealtimeAccessContext,
  type GraphSyncRequest,
} from "@/lib/living-graph/realtime";

const ORG = "org-aaaa";
const OTHER_ORG = "org-bbbb";
const PROJ = "proj-1111";
const SCOPE = { organizationId: ORG, projectId: PROJ };
const fixedNow = () => new Date("2026-07-03T15:00:00.000Z");

function access(o: Partial<LivingGraphRealtimeAccessContext> = {}): LivingGraphRealtimeAccessContext {
  return { userId: "u1", organizationId: ORG, scope: "pm", authorizedProjectIds: [PROJ], ...o };
}

function node(
  id: string,
  change: LivingGraphChangedEntity["change"],
  payload: Record<string, unknown> | null = {},
): LivingGraphChangedEntity {
  return { id, change, payload, sourceNoticeIds: [], sourceEventIds: [] };
}

function recalc(
  over: Partial<LivingGraphRecalculationResult> = {},
): LivingGraphRecalculationResult {
  return {
    resultId: "r1",
    scope: SCOPE,
    mode: "partial",
    basedOnSnapshotVersion: 0,
    affectedNodeIds: [],
    affectedEdgeIds: [],
    nodeChanges: [],
    edgeChanges: [],
    reasons: ["event_appended"],
    confidence: "high",
    warnings: [],
    engineVersion: LGRE_ENGINE_VERSION,
    configVersion: LGRE_CONFIG_VERSION,
    generatedAt: "2026-07-03T14:59:00.000Z",
    ...over,
  };
}

// ── Node / edge kind classification ───────────────────────────────────────────

describe("kind classification (explicit, never guessed from labels)", () => {
  it("classifies node kinds from id conventions + payload hints", () => {
    expect(classifyGraphNodeKind("milestone:m1")).toBe("milestone");
    expect(classifyGraphNodeKind("task:t1")).toBe("task");
    expect(classifyGraphNodeKind("subtask:s1")).toBe("subtask");
    expect(classifyGraphNodeKind("subtask-node:s1")).toBe("subtask");
    expect(classifyGraphNodeKind("cluster:roadmap_tasks:t1")).toBe("task");
    expect(classifyGraphNodeKind("cluster:milestones:m1")).toBe("milestone");
    expect(classifyGraphNodeKind("event:e1")).toBe("event");
    expect(classifyGraphNodeKind("evidence:x")).toBe("evidence");
    expect(classifyGraphNodeKind("x1", { is_subtask: true })).toBe("subtask");
    expect(classifyGraphNodeKind("mystery")).toBe("unknown");
  });

  it("hierarchy edges are DISTINCT from dependency and evidence edges", () => {
    expect(classifyGraphEdgeKind("subtask-edge:a", { hierarchy: true }, "task", "subtask")).toBe("hierarchy");
    expect(classifyGraphEdgeKind("e1", { edgeType: "subtask_of" }, "task", "subtask")).toBe("hierarchy");
    expect(classifyGraphEdgeKind("e2", { edgeType: "caused" }, "task", "task")).toBe("dependency");
    expect(classifyGraphEdgeKind("e3", { edgeType: "informed" }, "task", "event")).toBe("evidence");
    expect(classifyGraphEdgeKind("e4", { edgeType: "milestone_chain" }, "milestone", "milestone")).toBe("milestone_flow");
    // endpoint fallback: milestone→task is hierarchy, never dependency.
    expect(classifyGraphEdgeKind("e5", null, "milestone", "task")).toBe("hierarchy");
  });

  it("visibility policy: evidence/events never default-visible; subtasks gated by expansion", () => {
    expect(resolveNodeVisibility("milestone")).toBe("default_visible");
    expect(resolveNodeVisibility("task")).toBe("default_visible");
    expect(resolveNodeVisibility("subtask")).toBe("visible_when_parent_expanded");
    expect(resolveNodeVisibility("subtask", { evidenceLayerIncluded: false, isChildSubtask: true })).toBe(
      "visible_when_branch_expanded",
    );
    expect(resolveNodeVisibility("evidence")).toBe("visible_in_evidence_overlay");
    expect(resolveNodeVisibility("event")).toBe("visible_in_evidence_overlay");
    expect(resolveNodeVisibility("event")).not.toBe("default_visible");
  });
});

// ── Delta builder ─────────────────────────────────────────────────────────────

describe("hierarchy-safe delta builder", () => {
  it("builds node/edge deltas with kinds, visibility, hierarchy refs + scope", () => {
    const delta = buildDeltaFromRecalculation({
      result: recalc({
        nodeChanges: [
          node("task:t1", "updated", { status: "done", milestone_id: "m1", subtask_total: 2 }),
          node("subtask-node:s1", "added", { is_subtask: true, parent_task_id: "task:t1", parent_node_id: "task:t1" }),
        ],
        edgeChanges: [
          node("subtask-edge:x", "added", { hierarchy: true, source: "task:t1", target: "subtask-node:s1" }),
        ],
      }),
      basedOnVersion: 0,
      producedVersion: 1,
      deltaId: "d1",
      now: fixedNow,
    });

    const task = delta.nodeDeltas.find((n) => n.nodeId === "task:t1")!;
    expect(task.nodeKind).toBe("task");
    expect(task.visibility).toBe("default_visible");
    expect(task.milestoneId).toBe("m1");
    expect(task.directChildCount).toBe(2);
    expect(task.hasDescendants).toBe(true);

    const sub = delta.nodeDeltas.find((n) => n.nodeId === "subtask-node:s1")!;
    expect(sub.nodeKind).toBe("subtask");
    expect(sub.visibility).toBe("visible_when_parent_expanded"); // NOT default
    expect(sub.taskId).toBe("task:t1");
    expect(sub.parentId).toBe("task:t1");

    const edge = delta.edgeDeltas[0];
    expect(edge.edgeKind).toBe("hierarchy");
    expect(edge.sourceNodeId).toBe("task:t1");
    expect(edge.targetNodeId).toBe("subtask-node:s1");

    expect(delta.scope.affectedTaskIds).toContain("task:t1");
    expect(delta.scope.affectedSubtaskIds).toContain("subtask-node:s1");
    expect(delta.scope.affectedMilestoneIds).toContain("m1");
    expect(delta.scope.affectedLayerKinds).toContain("hierarchy");
    expect(delta.isEmpty).toBe(false);
  });

  it("evidence/event node deltas are evidence-overlay only, never default children", () => {
    const delta = buildDeltaFromRecalculation({
      result: recalc({ nodeChanges: [node("event:e1", "added", {}), node("evidence:x", "added", {})] }),
      basedOnVersion: 0,
      producedVersion: 1,
      deltaId: "d1",
      now: fixedNow,
    });
    for (const n of delta.nodeDeltas) {
      expect(n.visibility).toBe("visible_in_evidence_overlay");
      expect(n.visibility).not.toBe("default_visible");
    }
    expect(delta.scope.affectedLayerKinds).toContain("evidence");
  });

  it("added/updated/removed node & edge deltas carry the change kind (removals drop payload)", () => {
    const delta = buildDeltaFromRecalculation({
      result: recalc({
        nodeChanges: [node("task:t1", "added", {}), node("task:t2", "updated", {}), node("task:t3", "removed", null)],
        edgeChanges: [node("e:1", "added", { edgeType: "caused", source: "task:t1", target: "task:t2" })],
      }),
      basedOnVersion: 0,
      producedVersion: 1,
      deltaId: "d1",
      now: fixedNow,
    });
    expect(delta.nodeDeltas.map((n) => n.change)).toEqual(["added", "updated", "removed"]);
    expect(delta.nodeDeltas.find((n) => n.change === "removed")!.payload).toBeNull();
    expect(delta.edgeDeltas[0].edgeKind).toBe("dependency");
  });

  it("an empty recalc → a valid EMPTY delta (observable, not fabricated)", () => {
    const delta = buildDeltaFromRecalculation({
      result: recalc(),
      basedOnVersion: 3,
      producedVersion: 4,
      deltaId: "d1",
      now: fixedNow,
    });
    expect(delta.isEmpty).toBe(true);
    expect(delta.nodeDeltas).toEqual([]);
    expect(delta.edgeDeltas).toEqual([]);
    expect(delta.basedOnVersion).toBe(3);
    expect(delta.producedVersion).toBe(4);
  });

  it("is pure — never mutates the recalc result", () => {
    const result = recalc({ nodeChanges: [node("task:t1", "updated", { a: 1 })] });
    const snapshot = JSON.parse(JSON.stringify(result));
    buildHierarchicalDelta({
      recalcResult: result,
      rootScope: { type: "milestone", id: "m1" },
      producedVersion: 1,
      basedOnVersion: 0,
      evidenceLayerIncluded: false,
      deltaId: "d1",
      now: fixedNow,
    });
    expect(result).toEqual(snapshot);
  });
});

// ── Delta store: versioning + replay + recovery ───────────────────────────────

describe("delta store — versioning, dedup, replay, recovery", () => {
  function store(retainedDeltaWindow = 200) {
    return createLivingGraphDeltaStore(SCOPE, { now: fixedNow, idSeed: "t", retainedDeltaWindow });
  }

  it("assigns a monotonic version per ingest (basedOn→produced chain)", () => {
    const s = store();
    const a = s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t1", "added", {})] }) });
    const b = s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t2", "added", {})] }) });
    expect(a.delta.basedOnVersion).toBe(0);
    expect(a.delta.producedVersion).toBe(1);
    expect(b.delta.basedOnVersion).toBe(1);
    expect(b.delta.producedVersion).toBe(2);
  });

  it("fresh client at current version → noop", () => {
    const s = store();
    s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t1", "added", {})] }) });
    const res = s.requestSync({ access: access(), scope: SCOPE, sinceVersion: 1 });
    expect(res.kind).toBe("noop");
  });

  it("stale client with a retained contiguous window → ordered missed deltas", () => {
    const s = store();
    s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t1", "added", {})] }) }); // v1
    s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t2", "added", {})] }) }); // v2
    const res = s.requestSync({ access: access(), scope: SCOPE, sinceVersion: 0 });
    expect(res.kind).toBe("deltas");
    expect(res.deltas.map((d) => d.producedVersion)).toEqual([1, 2]);
    expect(res.targetVersion).toBe(2);
  });

  it("stale client past the evicted window → full_resync (never unsafe partial merge)", () => {
    const s = store(1); // retain only the last delta
    s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t1", "added", {})] }) }); // v1
    s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t2", "added", {})] }) }); // v2 (v1 evicted)
    const res = s.requestSync({ access: access(), scope: SCOPE, sinceVersion: 0 });
    expect(res.kind).toBe("full_resync");
    expect(res.reason).toBe("missed_delta_window_evicted");
    expect(res.snapshot).not.toBeNull();
  });

  it("client ahead of the store / brand-new client → full_resync", () => {
    const s = store();
    s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t1", "added", {})] }) }); // v1
    expect(s.requestSync({ access: access(), scope: SCOPE, sinceVersion: 99 }).kind).toBe("full_resync");
    expect(s.requestSync({ access: access(), scope: SCOPE, sinceVersion: null }).kind).toBe("full_resync");
  });

  it("snapshot descriptor exposes the current + oldest recoverable version", () => {
    const s = store();
    s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t1", "added", {})] }) });
    const d = s.getSnapshotDescriptor();
    expect(d.snapshotVersion).toBe(1);
    // A client at v0 is recoverable (delta v1 is based on v0).
    expect(d.oldestRecoverableVersion).toBe(0);
    expect(d.engineVersion).toBe(LGRE_ENGINE_VERSION);
  });
});

// ── RBAC / tenant isolation ───────────────────────────────────────────────────

describe("delta store — RBAC (deny-by-default, no leakage)", () => {
  const s = createLivingGraphDeltaStore(SCOPE, { now: fixedNow });
  s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t1", "added", {})] }) });

  const cases: { name: string; req: GraphSyncRequest }[] = [
    { name: "unauthorized project", req: { access: access({ authorizedProjectIds: [] }), scope: SCOPE, sinceVersion: 0 } },
    { name: "cross-org", req: { access: access({ organizationId: OTHER_ORG }), scope: SCOPE, sinceVersion: 0 } },
    { name: "cross-project scope", req: { access: access(), scope: { organizationId: ORG, projectId: "proj-other" }, sinceVersion: 0 } },
    { name: "cross-org scope", req: { access: access({ organizationId: OTHER_ORG }), scope: { organizationId: OTHER_ORG, projectId: PROJ }, sinceVersion: 0 } },
  ];
  for (const c of cases) {
    it(`denies ${c.name} with a safe unauthorized response (no deltas, no snapshot)`, () => {
      const res = s.requestSync(c.req);
      expect(res.kind).toBe("unauthorized");
      expect(res.deltas).toEqual([]);
      expect(res.snapshot).toBeNull();
    });
  }
});

// ── Observability ─────────────────────────────────────────────────────────────

describe("delta store — observability records the delta lifecycle", () => {
  it("counts created/empty/entities/layers/recoveries/full-resyncs/unauthorized", () => {
    const s = createLivingGraphDeltaStore(SCOPE, { now: fixedNow });
    s.ingestRecalculation({ result: recalc({ nodeChanges: [node("task:t1", "added", {}), node("event:e1", "added", {})] }) });
    s.ingestRecalculation({ result: recalc() }); // empty
    s.requestSync({ access: access(), scope: SCOPE, sinceVersion: 0 }); // recovery
    s.requestSync({ access: access({ authorizedProjectIds: [] }), scope: SCOPE, sinceVersion: 0 }); // unauthorized
    const o = s.observability();
    expect(o.deltasCreated).toBe(2);
    expect(o.emptyDeltas).toBe(1);
    expect(o.nodesAdded).toBe(2);
    expect(o.evidenceLayerDeltas).toBeGreaterThan(0);
    expect(o.hierarchyLayerDeltas).toBeGreaterThan(0);
    expect(o.missedUpdateRecoveries).toBe(1);
    expect(o.unauthorizedRequests).toBe(1);
    expect(o.currentVersion).toBe(2);
  });
});

// ── Canonical protection / import boundary ────────────────────────────────────

describe("delta store — canonical protection (no mutation, no write path, no UI)", () => {
  it("never imports a write path, DB client, process graph tables, or UI", () => {
    const dir = join(process.cwd(), "src/lib/living-graph/realtime");
    for (const f of ["delta-types.ts", "delta-builder.ts", "delta-store.ts"]) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']|from\s+["']@\/lib\/events\/dual-write["']/);
      expect(code).not.toMatch(/process_nodes|process_edges/);
      expect(code).not.toMatch(/supabase|createAdminClient|createClient|service_role/i);
      expect(code).not.toMatch(/react|tsx|useState|@xyflow/i);
    }
  });
});
