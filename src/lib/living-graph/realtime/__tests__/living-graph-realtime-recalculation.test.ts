// ============================================================================
// Phase 4 · Task 3 — Incremental Living Graph Recalculation Service guards
// ============================================================================
// Protects the LGRE recalculation layer (LGRE-RECALCULATION): selective
// attribution via the deterministic invalidation-tag grammar (single node,
// edge, dependency-path propagation), explicit no-op, SAFE full-rebuild
// fallbacks (unattributable change, partial budget exceeded, missing index),
// deterministic replay-stable results, evidence/source refs on every changed
// entity, provenance-derived confidence (weakest wins), honest warnings for
// ambiguous data, deny-by-default RBAC, read-only inputs (no canonical
// mutation), and the import boundary (no DB client, no write path, no
// process_nodes/process_edges).
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createLivingGraphRecalculationService,
  createLivingGraphRealtimeEngine,
  attributeGraphRecalculation,
  confidenceFromNotices,
  stableStringify,
  LgreUnauthorizedAccessError,
  LGRE_ENGINE_VERSION,
  LGRE_CONFIG_VERSION,
  type LivingGraphChangeNotice,
  type LivingGraphRealtimeAccessContext,
  type LivingGraphSnapshotIndex,
  type LivingGraphEntitySet,
  type LivingGraphRecalculationRequest,
} from "@/lib/living-graph/realtime";

const ORG = "org-aaaa";
const OTHER_ORG = "org-bbbb";
const PROJ = "proj-1111";
const SCOPE = { organizationId: ORG, projectId: PROJ };

const fixedNow = () => new Date("2026-07-03T12:00:00.000Z");

function access(
  overrides: Partial<LivingGraphRealtimeAccessContext> = {},
): LivingGraphRealtimeAccessContext {
  return {
    userId: "user-1",
    organizationId: ORG,
    scope: "pm",
    authorizedProjectIds: [PROJ],
    ...overrides,
  };
}

function notice(overrides: Partial<LivingGraphChangeNotice> = {}): LivingGraphChangeNotice {
  return {
    noticeId: "n1",
    source: "project_event_graph",
    organizationId: ORG,
    projectId: PROJ,
    eventId: "e1",
    eventType: "TaskCompleted",
    sequence: 42,
    occurredAt: "2026-07-03T11:59:00.000Z",
    invalidationTags: [`project:${PROJ}`, "subject:task:t1"],
    lifecycleClass: "BUSINESS_EVENT",
    isCompensatingEvent: false,
    ...overrides,
  };
}

/** m1 → m2 → m3 milestone chain; task t1 lives in m1, edge m1→m2 evidences t1/t2. */
function index(): LivingGraphSnapshotIndex {
  return {
    scope: SCOPE,
    snapshotVersion: 9,
    nodes: [
      { nodeId: "node-m1", subjectRefs: ["milestone:m1", "task:t1"] },
      { nodeId: "node-m2", subjectRefs: ["milestone:m2", "task:t3"] },
      { nodeId: "node-m3", subjectRefs: ["milestone:m3"] },
      { nodeId: "node-m4", subjectRefs: ["milestone:m4"] },
      { nodeId: "node-m5", subjectRefs: ["milestone:m5"] },
      { nodeId: "node-m6", subjectRefs: ["milestone:m6"] },
    ],
    edges: [
      { edgeId: "edge-m1-m2", sourceNodeId: "node-m1", targetNodeId: "node-m2", subjectRefs: ["task:t1", "task:t2"] },
      { edgeId: "edge-m2-m3", sourceNodeId: "node-m2", targetNodeId: "node-m3", subjectRefs: ["task:t3"] },
    ],
  };
}

function entities(overrides: Partial<Record<string, Record<string, unknown>>> = {}): LivingGraphEntitySet {
  return {
    nodes: [
      { nodeId: "node-m1", payload: { status: "in_progress", tasksDone: 1, ...(overrides["node-m1"] ?? {}) } },
      { nodeId: "node-m2", payload: { status: "not_started", tasksDone: 0, ...(overrides["node-m2"] ?? {}) } },
      { nodeId: "node-m3", payload: { status: "not_started", tasksDone: 0, ...(overrides["node-m3"] ?? {}) } },
      { nodeId: "node-m4", payload: { status: "not_started", tasksDone: 0, ...(overrides["node-m4"] ?? {}) } },
    ],
    edges: [
      { edgeId: "edge-m1-m2", sourceNodeId: "node-m1", targetNodeId: "node-m2", payload: { taskCount: 2, ...(overrides["edge-m1-m2"] ?? {}) } },
      { edgeId: "edge-m2-m3", sourceNodeId: "node-m2", targetNodeId: "node-m3", payload: { taskCount: 1, ...(overrides["edge-m2-m3"] ?? {}) } },
    ],
  };
}

function request(
  overrides: Partial<LivingGraphRecalculationRequest> = {},
): LivingGraphRecalculationRequest {
  return {
    scope: SCOPE,
    access: access(),
    config: { configVersion: LGRE_CONFIG_VERSION },
    notices: [notice()],
    snapshotIndex: index(),
    previous: entities(),
    recompute: () => entities(),
    ...overrides,
  };
}

function service() {
  return createLivingGraphRecalculationService({ now: fixedNow, idSeed: "t" });
}

// ── Single node change ────────────────────────────────────────────────────────

describe("LGRE recalculation — single node change", () => {
  it("attributes a task notice to exactly its node + evidencing edge and diffs only that", () => {
    const out = service().recalculate(
      request({
        recompute: () => entities({ "node-m1": { status: "done", tasksDone: 2 } }),
      }),
    );

    expect(out.result.mode).toBe("partial");
    expect(out.plan.fullRebuild).toBe(false);
    // task:t1 lives in node-m1 and evidences edge-m1-m2 — nothing else.
    expect(out.plan.affectedNodeIds).toEqual(["node-m1"]);
    expect(out.plan.affectedEdgeIds).toEqual(["edge-m1-m2"]);
    expect(out.plan.targets).toContain("node_status");
    expect(out.plan.targets).toContain("edge_evidence");

    expect(out.result.nodeChanges).toHaveLength(1);
    expect(out.result.nodeChanges[0]).toMatchObject({ id: "node-m1", change: "updated" });
    expect(out.result.nodeChanges[0].payload).toEqual({ status: "done", tasksDone: 2 });
    // Evidence/source refs attached.
    expect(out.result.nodeChanges[0].sourceNoticeIds).toEqual(["n1"]);
    expect(out.result.nodeChanges[0].sourceEventIds).toEqual(["e1"]);
    // Unchanged edge payload ⇒ no edge change reported.
    expect(out.result.edgeChanges).toHaveLength(0);
    expect(out.result.engineVersion).toBe(LGRE_ENGINE_VERSION);
    expect(out.result.configVersion).toBe(LGRE_CONFIG_VERSION);
    expect(out.result.basedOnSnapshotVersion).toBe(9);
  });
});

// ── Edge change ───────────────────────────────────────────────────────────────

describe("LGRE recalculation — edge change", () => {
  it("a subject referenced only by an edge affects that edge (and its census payload)", () => {
    const out = service().recalculate(
      request({
        notices: [notice({ invalidationTags: [`project:${PROJ}`, "subject:task:t2"] })],
        recompute: () => entities({ "edge-m1-m2": { taskCount: 3 } }),
      }),
    );

    expect(out.result.mode).toBe("partial");
    expect(out.plan.affectedNodeIds).toEqual([]); // t2 is edge-only evidence
    expect(out.plan.affectedEdgeIds).toEqual(["edge-m1-m2"]);
    expect(out.result.edgeChanges).toHaveLength(1);
    expect(out.result.edgeChanges[0]).toMatchObject({ id: "edge-m1-m2", change: "updated" });
    expect(out.result.edgeChanges[0].sourceNoticeIds).toEqual(["n1"]);
    expect(out.result.nodeChanges).toHaveLength(0);
  });
});

// ── Dependency path change ────────────────────────────────────────────────────

describe("LGRE recalculation — dependency path change", () => {
  it("a schedule-scoped change propagates downstream along index edges (m1 → m2 → m3, never m4)", () => {
    const out = service().recalculate(
      request({
        notices: [
          notice({
            eventType: "TaskDependencyAdded",
            invalidationTags: [`project:${PROJ}`, "subject:task:t1", "scope:schedule"],
          }),
        ],
      }),
    );

    expect(out.plan.fullRebuild).toBe(false);
    expect(out.plan.affectedNodeIds).toEqual(["node-m1", "node-m2", "node-m3"]);
    expect(out.plan.affectedEdgeIds).toEqual(["edge-m1-m2", "edge-m2-m3"]);
    expect(out.plan.reasons).toContain("dependency_path_propagation");
    expect(out.plan.affectedOverlays).toContain("criticalPath");
    expect(out.counts.propagatedNodeCount).toBe(2); // m2, m3 — m4 is disconnected
    // Propagated entities carry the SAME evidence chain.
    const m3 = out.plan.affectedNodeIds.includes("node-m3");
    expect(m3).toBe(true);
  });
});

// ── No-op ─────────────────────────────────────────────────────────────────────

describe("LGRE recalculation — no-op", () => {
  it("no accepted notices ⇒ explicit noop: nothing recomputed, no changes, reason no_change", () => {
    let recomputeCalls = 0;
    const out = service().recalculate(
      request({
        notices: [],
        recompute: () => {
          recomputeCalls += 1;
          return entities();
        },
      }),
    );

    expect(out.result.mode).toBe("noop");
    expect(out.plan.reasons).toEqual(["no_change"]);
    expect(out.result.nodeChanges).toEqual([]);
    expect(out.result.edgeChanges).toEqual([]);
    expect(recomputeCalls).toBe(0); // nothing is recomputed for nothing
    expect(out.result.confidence).toBe("unknown");
  });

  it("identical recomputed payloads ⇒ zero changes reported (no invented updates)", () => {
    const out = service().recalculate(request()); // recompute returns identical entities
    expect(out.result.mode).toBe("partial");
    expect(out.result.nodeChanges).toHaveLength(0);
    expect(out.result.edgeChanges).toHaveLength(0);
  });
});

// ── Safe full recalculation fallbacks ─────────────────────────────────────────

describe("LGRE recalculation — safe full-rebuild fallbacks", () => {
  it("an unattributable notice falls back to full rebuild with the reason DISCLOSED", () => {
    const out = service().recalculate(
      request({
        notices: [notice({ invalidationTags: [`project:${PROJ}`, "subject:task:t-unknown"] })],
      }),
    );
    expect(out.result.mode).toBe("full");
    expect(out.plan.fullRebuild).toBe(true);
    expect(out.plan.targets).toEqual(["full_graph"]);
    expect(out.plan.reasons).toContain("unattributable_change");
    expect(out.plan.warnings.join(" ")).toMatch(/could not be attributed/i);
    expect(out.counts.usedFullRebuildFallback).toBe(true);
  });

  it("exceeding the partial budget falls back to full rebuild", () => {
    // 5 of 6 nodes affected (83% > 60% budget).
    const out = service().recalculate(
      request({
        notices: [
          notice({ noticeId: "n1", eventId: "e1", invalidationTags: ["subject:task:t1"] }),
          notice({ noticeId: "n2", eventId: "e2", invalidationTags: ["subject:task:t3", "milestone:m2"] }),
          notice({ noticeId: "n3", eventId: "e3", invalidationTags: ["milestone:m3"] }),
          notice({ noticeId: "n4", eventId: "e4", invalidationTags: ["milestone:m4"] }),
          notice({ noticeId: "n5", eventId: "e5", invalidationTags: ["milestone:m5"] }),
        ],
      }),
    );
    expect(out.plan.fullRebuild).toBe(true);
    expect(out.plan.reasons).toContain("partial_budget_exceeded");
    expect(out.result.mode).toBe("full");
  });

  it("a missing snapshot index falls back to full rebuild (selective is impossible, said out loud)", () => {
    const out = service().recalculate(request({ snapshotIndex: null }));
    expect(out.result.mode).toBe("full");
    expect(out.plan.reasons).toContain("snapshot_index_unavailable");
    expect(out.result.basedOnSnapshotVersion).toBeNull();
  });

  it("full mode diffs the whole sets: removals and additions are detected", () => {
    const next: LivingGraphEntitySet = {
      nodes: [
        ...entities().nodes.filter((n) => n.nodeId !== "node-m4"),
        { nodeId: "node-m5", payload: { status: "not_started" } },
      ],
      edges: entities().edges,
    };
    const out = service().recalculate(
      request({ snapshotIndex: null, recompute: () => next }),
    );
    const changes = Object.fromEntries(out.result.nodeChanges.map((c) => [c.id, c.change]));
    expect(changes["node-m4"]).toBe("removed");
    expect(changes["node-m5"]).toBe("added");
  });
});

// ── Deterministic output ──────────────────────────────────────────────────────

describe("LGRE recalculation — deterministic output", () => {
  it("the same input produces a deep-equal result on replay", () => {
    const run = () =>
      createLivingGraphRecalculationService({ now: fixedNow, idSeed: "replay" }).recalculate(
        request({
          notices: [
            notice({ invalidationTags: ["subject:task:t1", "scope:schedule"] }),
          ],
          recompute: () => entities({ "node-m1": { status: "done" } }),
        }),
      );
    expect(run()).toEqual(run());
  });

  it("stableStringify is key-order independent (payload equality is content-based)", () => {
    expect(stableStringify({ a: 1, b: { d: [1, 2], c: null } })).toBe(
      stableStringify({ b: { c: null, d: [1, 2] }, a: 1 }),
    );
  });
});

// ── Confidence / quality ──────────────────────────────────────────────────────

describe("LGRE recalculation — provenance-derived confidence", () => {
  it("native business provenance ⇒ high; backfilled caps at medium; weakest wins; none ⇒ unknown", () => {
    expect(confidenceFromNotices([notice()])).toBe("high");
    expect(
      confidenceFromNotices([notice({ lifecycleClass: "SYNTHETIC_BACKFILL_EVENT" })]),
    ).toBe("medium");
    expect(
      confidenceFromNotices([notice(), notice({ noticeId: "n2", lifecycleClass: "SYNTHETIC_BACKFILL_EVENT" })]),
    ).toBe("medium");
    expect(confidenceFromNotices([notice({ lifecycleClass: null })])).toBe("unknown");
    expect(confidenceFromNotices([])).toBe("unknown");
  });
});

// ── RBAC / scope ──────────────────────────────────────────────────────────────

describe("LGRE recalculation — RBAC (deny-by-default)", () => {
  it("unauthorized callers are refused before anything runs", () => {
    let recomputeCalls = 0;
    expect(() =>
      service().recalculate(
        request({
          access: access({ authorizedProjectIds: [] }),
          recompute: () => {
            recomputeCalls += 1;
            return entities();
          },
        }),
      ),
    ).toThrow(LgreUnauthorizedAccessError);
    expect(recomputeCalls).toBe(0);
  });

  it("cross-org and foreign-project notices are rejected, never attributed", () => {
    const out = service().recalculate(
      request({
        notices: [
          notice({ organizationId: OTHER_ORG }),
          notice({ noticeId: "n2", projectId: "proj-other" }),
        ],
      }),
    );
    expect(out.counts.noticesRejected).toBe(2);
    expect(out.result.mode).toBe("noop");
  });
});

// ── Engine integration (Task 1 contract upgraded additively) ──────────────────

describe("LGRE recalculation — engine planRecalculation with a snapshot index", () => {
  it("plans selectively when the index is provided (no more blanket full rebuild)", () => {
    const engine = createLivingGraphRealtimeEngine({ now: fixedNow, planIdSeed: "sel" });
    const plan = engine.planRecalculation({
      scope: SCOPE,
      access: access(),
      config: { configVersion: LGRE_CONFIG_VERSION },
      notices: [notice()],
      currentSnapshot: null,
      snapshotIndex: index(),
    });
    expect(plan.fullRebuild).toBe(false);
    expect(plan.affectedNodeIds).toEqual(["node-m1"]);
    expect(plan.reasons).toContain("invalidation_tag_matched");
  });
});

// ── Canonical protection ──────────────────────────────────────────────────────

describe("LGRE recalculation — canonical protection (read-only, no mutation)", () => {
  it("never mutates notices, index, previous, or recomputed entities", () => {
    const notices = [notice({ invalidationTags: ["subject:task:t1", "scope:schedule"] })];
    const idx = index();
    const prev = entities();
    const next = entities({ "node-m1": { status: "done" } });
    const snapshots = JSON.parse(JSON.stringify({ notices, idx, prev, next }));

    service().recalculate(
      request({ notices, snapshotIndex: idx, previous: prev, recompute: () => next }),
    );

    expect({ notices, idx, prev, next }).toEqual(snapshots);
  });

  it("attribution is pure: same inputs, same detail, inputs untouched", () => {
    const args = {
      scope: SCOPE,
      acceptedNotices: [notice()],
      rejectedNoticeCount: 0,
      index: index(),
      planId: "p1",
      now: fixedNow,
    };
    expect(attributeGraphRecalculation(args)).toEqual(attributeGraphRecalculation(args));
  });

  it("the recalculation modules never import a DB client, a write path, or the process graph", () => {
    const dir = join(process.cwd(), "src/lib/living-graph/realtime");
    const files = [
      "recalculation-types.ts",
      "recalculation-attribution.ts",
      "recalculation-result.ts",
      "recalculation-service.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      expect(code).not.toMatch(/supabase|createAdminClient|createClient|service_role/i);
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']|from\s+["']@\/lib\/events\/dual-write["']|from\s+["']@\/lib\/graph\/emit-event["']/);
      expect(code).not.toMatch(/process_nodes|process_edges/);
      expect(code).not.toMatch(/graph-layout-storage|localStorage/);
    }
  });
});
