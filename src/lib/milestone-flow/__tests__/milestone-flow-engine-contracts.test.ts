// ============================================================================
// Phase 3 · Task 1 — Milestone Process Flow Engine foundation guards
// ============================================================================
// Protects the MPF Engine architecture + contract foundation (PEG-MPF-FOUNDATION):
// empty input yields a safe UNKNOWN projection (never fabricated intelligence),
// output is versioned + observable, evidence packets separate fact/inference/
// prediction/recommendation/uncertainty, the Living Graph model is a consumer
// model (no UI), unauthorized/cross-tenant access is denied, canonical event
// history is treated read-only, and process_nodes/process_edges are never touched.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMilestoneProcessFlowEngine,
  validateInputContract,
  milestoneFlowEvidenceContract,
  milestoneFlowHealthContract,
  milestoneFlowSecurityContract,
  milestoneFlowLivingGraphContract,
  resolveMilestoneFlowAccess,
  aggregateConfidence,
  confidenceFromEvent,
  openRunContext,
  closeRunSummary,
  MpfUnauthorizedAccessError,
  MpfMissingProjectScopeError,
  MpfUnsupportedOperationError,
  isMpfError,
  MPF_ENGINE_VERSION,
  MPF_CONFIG_VERSION,
  MPF_HEALTH_STATUSES,
  MPF_EVIDENCE_KINDS,
  type MilestoneFlowInputContract,
  type MilestoneFlowAccessContext,
  type MilestoneFlowEventRef,
} from "@/lib/milestone-flow";

const ORG = "org-aaaa";
const OTHER_ORG = "org-bbbb";
const PROJ = "proj-1111";

function access(overrides: Partial<MilestoneFlowAccessContext> = {}): MilestoneFlowAccessContext {
  return {
    userId: "user-1",
    organizationId: ORG,
    scope: "pm",
    authorizedProjectIds: [PROJ],
    ...overrides,
  };
}

function input(overrides: Partial<MilestoneFlowInputContract> = {}): MilestoneFlowInputContract {
  return {
    scope: { organizationId: ORG, projectId: PROJ },
    milestones: [],
    events: [],
    config: { configVersion: MPF_CONFIG_VERSION },
    access: access(),
    ...overrides,
  };
}

const fixedNow = () => new Date("2026-07-02T10:00:00.000Z");

describe("MPF engine — safe empty projection", () => {
  it("returns a valid empty projection for an authorized empty input (no fake intelligence)", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow, runIdSeed: "t1" });
    const out = engine.buildMilestoneFlowProjection(input());

    expect(out.projection.transitions).toEqual([]);
    expect(out.projection.bottlenecks).toEqual([]);
    expect(out.projection.constraintPropagations).toEqual([]);
    expect(out.transitionSummaries).toEqual([]);
    // Empty evidence must not manufacture health assessments.
    expect(Object.keys(out.projection.healthByTransition)).toHaveLength(0);
    expect(out.projection.dataQualityFlags).toContain("insufficient_event_density");
  });

  it("stamps engineVersion and configVersion on the projection", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(input());
    expect(out.projection.engineVersion).toBe(MPF_ENGINE_VERSION);
    expect(out.projection.configVersion).toBe(MPF_CONFIG_VERSION);
  });

  it("observability summary reports input event count and zero transitions", () => {
    const events: MilestoneFlowEventRef[] = [
      {
        eventId: "e1",
        eventType: "MilestoneAchieved",
        eventCategory: "milestone",
        occurredAt: "2026-06-01T00:00:00.000Z",
        subjectType: "milestone",
        subjectId: "m1",
        fromState: null,
        toState: null,
        lifecycleClass: "BUSINESS_EVENT",
        confidence: null,
        isCompensatingEvent: false,
      },
    ];
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(input({ events }));
    expect(out.observability.inputEventCount).toBe(1);
    expect(out.observability.transitionCount).toBe(0);
    // Accepting-but-not-interpreting events is disclosed as a warning, not hidden.
    expect(out.observability.warningCount).toBe(1);
    expect(out.observability.engineVersion).toBe(MPF_ENGINE_VERSION);
  });
});

describe("MPF engine — honest unknown defaults", () => {
  it("evidence packet for an empty transition is unknown, never fabricated", () => {
    const engine = createMilestoneProcessFlowEngine();
    const packet = engine.buildEvidencePacket({
      transitionId: "tr1",
      scope: { organizationId: ORG, projectId: PROJ },
      sourceMilestoneId: null,
      targetMilestoneId: "m1",
      startedAt: null,
      completedAt: null,
      state: { status: "unknown", currentSegmentType: null, isBlocked: false, lastEventAt: null },
      segments: [],
      evidenceEventIds: [],
    });
    expect(packet.confidence).toBe("unknown");
    expect(packet.refs).toEqual([]);
  });

  it("health contract default status is unknown and is a member of the closed set", () => {
    expect(milestoneFlowHealthContract.defaultStatus).toBe("unknown");
    expect(milestoneFlowHealthContract.statuses).toEqual(MPF_HEALTH_STATUSES);
    expect(MPF_HEALTH_STATUSES).toContain("unknown");
  });

  it("aggregateConfidence returns unknown for no supporting evidence", () => {
    expect(aggregateConfidence([])).toBe("unknown");
    expect(aggregateConfidence([{ kind: "uncertainty", note: "n", confidence: "unknown" }])).toBe("unknown");
  });

  it("aggregateConfidence takes the weakest supporting ref", () => {
    expect(
      aggregateConfidence([
        { kind: "fact", eventId: "e1", confidence: "high" },
        { kind: "fact", eventId: "e2", confidence: "low" },
      ]),
    ).toBe("low");
  });

  it("backfilled events can never be asserted at high confidence", () => {
    expect(confidenceFromEvent({ confidence: 0.95, lifecycleClass: "SYNTHETIC_BACKFILL_EVENT" })).toBe("medium");
    expect(confidenceFromEvent({ confidence: 0.95, lifecycleClass: "BUSINESS_EVENT" })).toBe("high");
    expect(confidenceFromEvent({ confidence: null, lifecycleClass: "BUSINESS_EVENT" })).toBe("unknown");
  });
});

describe("MPF engine — evidence packet frame (fact/inference/prediction/recommendation/uncertainty)", () => {
  it("Isabella packet exposes all five explanation slots", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(input());
    const packet = engine.buildIsabellaEvidencePacket(out.projection, "tr1");
    for (const slot of MPF_EVIDENCE_KINDS) {
      expect(packet.frame).toHaveProperty(slot);
      expect(Array.isArray((packet.frame as unknown as Record<string, unknown[]>)[slot])).toBe(true);
    }
    expect(packet.confidence).toBe("unknown");
    expect(packet.engineVersion).toBe(MPF_ENGINE_VERSION);
  });

  it("evidence contract requires a grounding fact", () => {
    expect(milestoneFlowEvidenceContract.requireEvidence([])).toBe(false);
    expect(milestoneFlowEvidenceContract.requireEvidence([{ kind: "inference", confidence: "low" }])).toBe(false);
    expect(
      milestoneFlowEvidenceContract.requireEvidence([{ kind: "fact", eventId: "e1", confidence: "high" }]),
    ).toBe(true);
  });
});

describe("MPF engine — Living Graph consumer model (no UI logic)", () => {
  it("produces a pure data model with nodes/edges arrays and version stamps", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(input());
    const model = milestoneFlowLivingGraphContract.toLivingGraphModel(out.projection);
    expect(Array.isArray(model.nodes)).toBe(true);
    expect(Array.isArray(model.edges)).toBe(true);
    expect(model.engineVersion).toBe(MPF_ENGINE_VERSION);
    // No UI / layout fields leak into the consumer model.
    expect(model).not.toHaveProperty("x");
    expect(model).not.toHaveProperty("render");
    expect(JSON.stringify(model)).not.toMatch(/position|width|height|pixel/i);
  });
});

describe("MPF engine — security (deny-by-default, tenant isolation)", () => {
  it("denies cross-organization access", () => {
    const decision = resolveMilestoneFlowAccess(access({ organizationId: OTHER_ORG }), {
      organizationId: ORG,
      projectId: PROJ,
    });
    expect(decision.allowed).toBe(false);
  });

  it("denies a project not in the authorized set", () => {
    const decision = resolveMilestoneFlowAccess(access({ authorizedProjectIds: [] }), {
      organizationId: ORG,
      projectId: PROJ,
    });
    expect(decision.allowed).toBe(false);
  });

  it("buildMilestoneFlowProjection throws MpfUnauthorizedAccessError for unauthorized callers", () => {
    const engine = createMilestoneProcessFlowEngine();
    expect(() =>
      engine.buildMilestoneFlowProjection(input({ access: access({ authorizedProjectIds: [] }) })),
    ).toThrow(MpfUnauthorizedAccessError);
  });

  it("PMO aggregate requests are refused for PM-level callers", () => {
    const decision = resolveMilestoneFlowAccess(access({ scope: "pm" }), { organizationId: ORG });
    expect(decision.allowed).toBe(false);
  });

  it("redactUnauthorized strips projects outside the authorized set (no leakage)", () => {
    const kept = milestoneFlowSecurityContract.redactUnauthorized(access(), [PROJ, "proj-secret"]);
    expect(kept).toEqual([PROJ]);
  });
});

describe("MPF engine — input validation + typed errors", () => {
  it("throws a typed error when project scope is missing", () => {
    expect(() =>
      validateInputContract(input({ scope: { organizationId: ORG } as never })),
    ).toThrow(MpfMissingProjectScopeError);
  });

  it("not-yet-implemented algorithmic methods throw MpfUnsupportedOperationError (never fake output)", () => {
    // buildTransitionModel/buildFlowSegments are implemented in Task 3; the
    // metrics + health classifiers remain deferred and must never fabricate.
    const engine = createMilestoneProcessFlowEngine();
    const transition = {
      transitionId: "tr1",
      scope: { organizationId: ORG, projectId: PROJ },
      sourceMilestoneId: null,
      targetMilestoneId: "m1",
      startedAt: null,
      completedAt: null,
      state: { status: "unknown" as const, currentSegmentType: null, isBlocked: false, lastEventAt: null },
      segments: [],
      evidenceEventIds: [],
    };
    expect(() => engine.calculateFlowMetrics(transition)).toThrow(MpfUnsupportedOperationError);
    try {
      engine.calculateFlowMetrics(transition);
    } catch (err) {
      expect(isMpfError(err)).toBe(true);
      if (isMpfError(err)) expect(err.code).toBe("UNSUPPORTED_ENGINE_OPERATION");
    }
  });
});

describe("MPF engine — observability run lifecycle", () => {
  it("openRunContext → closeRunSummary yields a complete, versioned summary", () => {
    const start = () => new Date("2026-07-02T10:00:00.000Z");
    const end = () => new Date("2026-07-02T10:00:00.250Z");
    const ctx = openRunContext({ scope: { organizationId: ORG, projectId: PROJ }, now: start });
    const summary = closeRunSummary(
      ctx,
      {
        inputEventCount: 3,
        includedEventCount: 3,
        excludedEventCount: 0,
        transitionCount: 0,
        segmentCount: 0,
        bottleneckCount: 0,
        healthAssessmentCount: 0,
      },
      end,
    );
    expect(summary.durationMs).toBe(250);
    expect(summary.engineVersion).toBe(MPF_ENGINE_VERSION);
    expect(summary.configVersion).toBe(MPF_CONFIG_VERSION);
    expect(summary.projectId).toBe(PROJ);
    expect(summary.inputEventCount).toBe(3);
  });
});

describe("MPF engine — canonical protection (read-only, no mutation)", () => {
  it("does not mutate the input event refs or milestones", () => {
    const events: MilestoneFlowEventRef[] = [
      {
        eventId: "e1",
        eventType: "MilestoneAchieved",
        eventCategory: "milestone",
        occurredAt: "2026-06-01T00:00:00.000Z",
        subjectType: "milestone",
        subjectId: "m1",
        fromState: null,
        toState: null,
        lifecycleClass: "BUSINESS_EVENT",
        confidence: 0.9,
        isCompensatingEvent: false,
      },
    ];
    const snapshot = JSON.parse(JSON.stringify(events));
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    engine.buildMilestoneFlowProjection(input({ events }));
    expect(events).toEqual(snapshot);
  });

  it("the engine module never imports the event write path, process_nodes, or process_edges", () => {
    const dir = join(process.cwd(), "src/lib/milestone-flow");
    const files = ["engine.ts", "contracts.ts", "types.ts", "security.ts", "evidence.ts", "observability.ts"];
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      // Strip comment lines — reassuring banners legitimately NAME the tables
      // they promise not to touch; we assert the executable CODE never does.
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      // No write path into the event log.
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']/);
      // No process graph tables referenced in code.
      expect(code).not.toMatch(/process_nodes|process_edges/);
      // No Supabase admin/service-role client (engine is a pure consumer here).
      expect(code).not.toMatch(/createAdminClient|service_role/);
    }
  });

  it("uses a vi spy-free deterministic clock (no real time leakage)", () => {
    const spy = vi.fn(() => new Date("2026-07-02T10:00:00.000Z"));
    const engine = createMilestoneProcessFlowEngine({ now: spy });
    const out = engine.buildMilestoneFlowProjection(input());
    expect(spy).toHaveBeenCalled();
    expect(out.projection.generatedAt).toBe("2026-07-02T10:00:00.000Z");
  });
});
