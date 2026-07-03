// ============================================================================
// Phase 4 · Task 1 — Living Graph Realtime Engine foundation guards
// ============================================================================
// Protects the LGRE architecture + contract foundation (LGRE-FOUNDATION):
// the engine is orchestration only (no fabricated liveness/intelligence),
// deny-by-default RBAC with tenant isolation, honest conservative planning
// (full rebuild disclosed until selective planning ships), deterministic
// versioned sync (base mismatch ⇒ full_resync, never a partial merge),
// honest fallback ladder (realtime → polling → manual_refresh), read-only
// change notices (never mutated), deltas are DATA-only (no layout/position —
// UX-007 saved layouts stay presentation-only and client-owned), and the
// module never imports the event write path, any DB client, or
// process_nodes/process_edges.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createLivingGraphRealtimeEngine,
  validateSubscriptionRequest,
  decideLivingGraphSync,
  decideLivingGraphFallback,
  isAcceptableChangeNotice,
  livingGraphRealtimeSecurityContract,
  resolveLivingGraphRealtimeAccess,
  filterAuthorizedProjectIds,
  openTickContext,
  closeTickSummary,
  LgreUnauthorizedAccessError,
  LgreUnsupportedOperationError,
  LgreMissingProjectScopeError,
  LgreInvalidSubscriptionTopicError,
  LGRE_ENGINE_VERSION,
  LGRE_CONFIG_VERSION,
  LGRE_DELTA_OPERATIONS,
  LGRE_SYNC_INSTRUCTIONS,
  LGRE_FALLBACK_MODES,
  LGRE_DEFAULT_PERFORMANCE_BUDGET,
  type LivingGraphChangeNotice,
  type LivingGraphRealtimeAccessContext,
  type LivingGraphRecalculationInput,
  type LivingGraphDelta,
} from "@/lib/living-graph/realtime";

const ORG = "org-aaaa";
const OTHER_ORG = "org-bbbb";
const PROJ = "proj-1111";

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
    occurredAt: "2026-07-01T10:00:00.000Z",
    invalidationTags: [`project:${PROJ}`, "subject:task:t1"],
    lifecycleClass: "BUSINESS_EVENT",
    isCompensatingEvent: false,
    ...overrides,
  };
}

function recalcInput(
  overrides: Partial<LivingGraphRecalculationInput> = {},
): LivingGraphRecalculationInput {
  return {
    scope: { organizationId: ORG, projectId: PROJ },
    access: access(),
    config: { configVersion: LGRE_CONFIG_VERSION },
    notices: [],
    currentSnapshot: null,
    ...overrides,
  };
}

function delta(overrides: Partial<LivingGraphDelta> = {}): LivingGraphDelta {
  return {
    deltaId: "d1",
    scope: { organizationId: ORG, projectId: PROJ },
    basedOnVersion: 7,
    snapshotVersion: 8,
    operations: [{ op: "upsert_node", targetId: "node-1", payload: { status: "in_progress" } }],
    sourcePlanId: null,
    generatedAt: "2026-07-01T10:00:01.000Z",
    ...overrides,
  };
}

const fixedNow = () => new Date("2026-07-02T10:00:00.000Z");

describe("LGRE — honest conservative planning (no fabricated intelligence)", () => {
  it("empty notices yield an explicit no_change plan (never an invented rebuild)", () => {
    const engine = createLivingGraphRealtimeEngine({ now: fixedNow, planIdSeed: "t1" });
    const plan = engine.planRecalculation(recalcInput());
    expect(plan.fullRebuild).toBe(false);
    expect(plan.targets).toEqual([]);
    expect(plan.reasons).toEqual(["no_change"]);
    expect(plan.coalescedNoticeCount).toBe(0);
  });

  it("valid notices produce a conservative full rebuild with the limitation DISCLOSED", () => {
    const engine = createLivingGraphRealtimeEngine({ now: fixedNow });
    const plan = engine.planRecalculation(recalcInput({ notices: [notice()] }));
    expect(plan.fullRebuild).toBe(true);
    expect(plan.targets).toEqual(["full_graph"]);
    expect(plan.reasons).toContain("selective_recalculation_not_implemented");
    expect(plan.warnings.join(" ")).toMatch(/not implemented/i);
    expect(plan.coalescedNoticeCount).toBe(1);
  });

  it("notices from another project/org are rejected and reported — never planned", () => {
    const engine = createLivingGraphRealtimeEngine({ now: fixedNow });
    const plan = engine.planRecalculation(
      recalcInput({
        notices: [
          notice({ projectId: "proj-other" }),
          notice({ organizationId: OTHER_ORG }),
        ],
      }),
    );
    expect(plan.coalescedNoticeCount).toBe(0);
    expect(plan.rejectedNoticeCount).toBe(2);
    expect(plan.fullRebuild).toBe(false);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it("plans never carry layout/position data (UX-007: presentation-only, client-owned)", () => {
    const engine = createLivingGraphRealtimeEngine({ now: fixedNow });
    const plan = engine.planRecalculation(recalcInput({ notices: [notice()] }));
    expect(JSON.stringify(plan)).not.toMatch(/position|viewport|"x"|"y"|width|height/i);
  });
});

describe("LGRE — unimplemented runtime throws, never fakes", () => {
  it("registerSubscription throws UNSUPPORTED (after validating + authorizing)", () => {
    const engine = createLivingGraphRealtimeEngine();
    expect(() =>
      engine.registerSubscription({
        consumerId: "c1",
        scope: { organizationId: ORG, projectId: PROJ },
        topics: ["project_events"],
        access: access(),
      }),
    ).toThrow(LgreUnsupportedOperationError);
  });

  it("buildDelta throws UNSUPPORTED (delta builder is a later Phase 4 task)", () => {
    const engine = createLivingGraphRealtimeEngine();
    expect(() =>
      engine.buildDelta(
        { scope: { organizationId: ORG, projectId: PROJ }, snapshotVersion: 1, generatedAt: "2026-07-01T00:00:00.000Z", upstreamEngineVersions: {}, nodeCount: 0, edgeCount: 0 },
        { scope: { organizationId: ORG, projectId: PROJ }, snapshotVersion: 2, generatedAt: "2026-07-01T00:00:01.000Z", upstreamEngineVersions: {}, nodeCount: 0, edgeCount: 0 },
      ),
    ).toThrow(LgreUnsupportedOperationError);
  });

  it("subscription requests with unregistered topics are rejected loudly", () => {
    expect(() =>
      validateSubscriptionRequest({
        consumerId: "c1",
        scope: { organizationId: ORG, projectId: PROJ },
        topics: ["not_a_topic" as never],
        access: access(),
      }),
    ).toThrow(LgreInvalidSubscriptionTopicError);
  });
});

describe("LGRE — security (deny-by-default, tenant isolation)", () => {
  it("denies cross-organization access", () => {
    const decision = resolveLivingGraphRealtimeAccess(access({ organizationId: OTHER_ORG }), {
      organizationId: ORG,
      projectId: PROJ,
    });
    expect(decision.allowed).toBe(false);
  });

  it("denies a project not in the authorized set", () => {
    const decision = resolveLivingGraphRealtimeAccess(access({ authorizedProjectIds: [] }), {
      organizationId: ORG,
      projectId: PROJ,
    });
    expect(decision.allowed).toBe(false);
  });

  it("denies unregistered access scopes (viewer/client has no realtime access)", () => {
    const decision = resolveLivingGraphRealtimeAccess(access({ scope: "viewer" as never }), {
      organizationId: ORG,
      projectId: PROJ,
    });
    expect(decision.allowed).toBe(false);
  });

  it("aggregate (org-wide) scope is reserved to pmo/admin — pm/team denied", () => {
    expect(resolveLivingGraphRealtimeAccess(access({ scope: "pm" }), { organizationId: ORG }).allowed).toBe(false);
    expect(resolveLivingGraphRealtimeAccess(access({ scope: "team" }), { organizationId: ORG }).allowed).toBe(false);
    expect(resolveLivingGraphRealtimeAccess(access({ scope: "pmo" }), { organizationId: ORG }).allowed).toBe(true);
  });

  it("planRecalculation throws LgreUnauthorizedAccessError for unauthorized callers", () => {
    const engine = createLivingGraphRealtimeEngine();
    expect(() =>
      engine.planRecalculation(recalcInput({ access: access({ authorizedProjectIds: [] }) })),
    ).toThrow(LgreUnauthorizedAccessError);
  });

  it("missing project scope is a typed error", () => {
    const engine = createLivingGraphRealtimeEngine();
    expect(() =>
      engine.planRecalculation(recalcInput({ scope: { organizationId: ORG } as never })),
    ).toThrow(LgreMissingProjectScopeError);
  });

  it("redactUnauthorized strips projects outside the authorized set (no leakage)", () => {
    const kept = livingGraphRealtimeSecurityContract.redactUnauthorized(access(), [PROJ, "proj-secret"]);
    expect(kept).toEqual([PROJ]);
    expect(filterAuthorizedProjectIds(access(), ["proj-secret"])).toEqual([]);
  });
});

describe("LGRE — versioned delta/sync decision (deterministic)", () => {
  it("consumer already at the snapshot version ⇒ noop", () => {
    expect(decideLivingGraphSync(8, delta()).instruction).toBe("noop");
  });

  it("consumer base matches the delta base ⇒ apply_delta", () => {
    expect(decideLivingGraphSync(7, delta()).instruction).toBe("apply_delta");
  });

  it("base mismatch or no base ⇒ full_resync (never a partial, possibly-wrong merge)", () => {
    expect(decideLivingGraphSync(3, delta()).instruction).toBe("full_resync");
    expect(decideLivingGraphSync(null, delta()).instruction).toBe("full_resync");
  });

  it("oversized deltas force full_resync (performance budget)", () => {
    const ops = Array.from(
      { length: LGRE_DEFAULT_PERFORMANCE_BUDGET.maxDeltaOperations + 1 },
      (_, i) => ({ op: "upsert_node" as const, targetId: `n${i}`, payload: {} }),
    );
    const decision = decideLivingGraphSync(7, delta({ operations: ops }));
    expect(decision.instruction).toBe("full_resync");
    expect(decision.reason).toBe("delta_operation_budget_exceeded");
  });

  it("delta operations are a closed DATA-only vocabulary (no layout/position op)", () => {
    expect(LGRE_DELTA_OPERATIONS).toEqual([
      "upsert_node",
      "remove_node",
      "upsert_edge",
      "remove_edge",
      "patch_overlay",
      "patch_summary",
    ]);
    expect(JSON.stringify(LGRE_DELTA_OPERATIONS)).not.toMatch(/position|layout|viewport|coordinate/i);
    expect(LGRE_SYNC_INSTRUCTIONS).toContain("full_resync");
  });
});

describe("LGRE — honest fallback ladder", () => {
  it("degrades realtime → polling → manual_refresh with failures; never fabricates liveness", () => {
    expect(decideLivingGraphFallback("live", 0)).toBe("realtime");
    expect(decideLivingGraphFallback("live", 1)).toBe("polling");
    expect(decideLivingGraphFallback("degraded_polling", 2)).toBe("polling");
    expect(
      decideLivingGraphFallback("degraded_polling", LGRE_DEFAULT_PERFORMANCE_BUDGET.maxFailuresBeforeManualRefresh),
    ).toBe("manual_refresh");
    expect(decideLivingGraphFallback("offline_snapshot", 0)).toBe("manual_refresh");
    expect(LGRE_FALLBACK_MODES).toEqual(["realtime", "polling", "manual_refresh"]);
  });
});

describe("LGRE — observability tick lifecycle", () => {
  it("openTickContext → closeTickSummary yields a complete, versioned summary", () => {
    const start = () => new Date("2026-07-02T10:00:00.000Z");
    const end = () => new Date("2026-07-02T10:00:00.250Z");
    const ctx = openTickContext({ scope: { organizationId: ORG, projectId: PROJ }, now: start, tickIdSeed: "t" });
    const summary = closeTickSummary(
      ctx,
      {
        noticesReceived: 5,
        noticesCoalesced: 4,
        noticesRejected: 1,
        plansEmitted: 1,
        deltasEmitted: 0,
        fullResyncsRequested: 0,
        warnings: ["w1"],
      },
      end,
    );
    expect(summary.durationMs).toBe(250);
    expect(summary.engineVersion).toBe(LGRE_ENGINE_VERSION);
    expect(summary.configVersion).toBe(LGRE_CONFIG_VERSION);
    expect(summary.projectId).toBe(PROJ);
    expect(summary.noticesReceived).toBe(5);
    expect(summary.warningCount).toBe(1);
  });
});

describe("LGRE — canonical protection (read-only, no mutation, no write path)", () => {
  it("does not mutate the input change notices", () => {
    const notices = [notice()];
    const snapshot = JSON.parse(JSON.stringify(notices));
    const engine = createLivingGraphRealtimeEngine({ now: fixedNow });
    engine.planRecalculation(recalcInput({ notices }));
    expect(notices).toEqual(snapshot);
  });

  it("malformed notices are unacceptable (never silently interpreted)", () => {
    expect(
      isAcceptableChangeNotice(notice({ noticeId: "" }), { organizationId: ORG, projectId: PROJ }),
    ).toBe(false);
    expect(
      isAcceptableChangeNotice(notice({ source: "made_up" as never }), { organizationId: ORG, projectId: PROJ }),
    ).toBe(false);
  });

  it("the module never imports a write path, a DB client, process_nodes, process_edges, or layout storage", () => {
    const dir = join(process.cwd(), "src/lib/living-graph/realtime");
    const files = [
      "constants.ts",
      "types.ts",
      "errors.ts",
      "security.ts",
      "observability.ts",
      "contracts.ts",
      "engine.ts",
      "index.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      // Strip comment lines — banners legitimately NAME the tables they promise
      // not to touch; we assert the executable CODE never does.
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      // No write path into the event log; no event emission.
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']|from\s+["']@\/lib\/events\/dual-write["']|from\s+["']@\/lib\/graph\/emit-event["']/);
      // No process graph tables referenced in code.
      expect(code).not.toMatch(/process_nodes|process_edges/);
      // No DB client at all (the LGRE is pure orchestration in this layer).
      expect(code).not.toMatch(/supabase|createAdminClient|createClient|service_role/i);
      // Saved layouts are presentation-only and client-owned (UX-007) — the
      // engine must never read or write them.
      expect(code).not.toMatch(/graph-layout-storage|localStorage/);
    }
  });
});
