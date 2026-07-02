// ============================================================================
// Phase 3 · Task 3 — Milestone Transition & Flow Segment Builder guards
// ============================================================================
// Protects PEG-MPF-TRANSITION-SEGMENT-BUILDER: deterministic transition pairing,
// explicit event assignment + unassigned reporting, flow-segment construction
// from Task 2 semantics, unknown/backfill/compensating handling, read-only
// (no mutation), replay determinism, and engine integration (health stays
// unknown, observability counts present). No DB write-path / process tables.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMilestoneTransitions,
  buildMilestoneTransitionPairs,
  createMilestoneTransitionId,
  assignEventsToMilestoneTransitions,
  buildFlowSegmentsForTransition,
  classifyTransitionStateFromSegments,
  normalizeMilestoneFlowEventOrder,
  collectUnassignedMilestoneFlowEvents,
  createMilestoneProcessFlowEngine,
  MPF_CONFIG_VERSION,
  MPF_ENGINE_VERSION,
  type MilestoneFlowMilestoneRef,
  type MilestoneFlowEventRef,
  type MilestoneFlowProjectScope,
  type MilestoneFlowInputContract,
  type MilestoneFlowAccessContext,
} from "@/lib/milestone-flow";

const ORG = "org-1";
const PROJ = "proj-1";
const SCOPE: MilestoneFlowProjectScope = { organizationId: ORG, projectId: PROJ };

function ms(id: string, overrides: Partial<MilestoneFlowMilestoneRef> = {}): MilestoneFlowMilestoneRef {
  return {
    milestoneId: id,
    name: id,
    type: null,
    plannedDate: null,
    forecastDate: null,
    actualDate: null,
    ownerId: null,
    status: null,
    ...overrides,
  };
}

function ev(overrides: Partial<MilestoneFlowEventRef> & { eventType: string; eventId: string; occurredAt: string }): MilestoneFlowEventRef {
  return {
    eventCategory: "test",
    subjectType: "task",
    subjectId: "s1",
    fromState: null,
    toState: null,
    lifecycleClass: "BUSINESS_EVENT",
    confidence: 0.95,
    isCompensatingEvent: false,
    ...overrides,
  };
}

function builderInput(milestones: MilestoneFlowMilestoneRef[], events: MilestoneFlowEventRef[]) {
  return { scope: SCOPE, milestones, events, config: { configVersion: MPF_CONFIG_VERSION } };
}

// Two ordered milestones (m1 → m2).
const M1 = ms("m1", { plannedDate: "2026-01-01T00:00:00.000Z", actualDate: "2026-01-10T00:00:00.000Z" });
const M2 = ms("m2", { plannedDate: "2026-02-01T00:00:00.000Z" });

describe("transition pairing", () => {
  it("builds deterministic consecutive pairs from ordered milestones", () => {
    const { pairs } = buildMilestoneTransitionPairs([M2, M1], PROJ); // unordered input
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sourceMilestoneId).toBe("m1");
    expect(pairs[0].targetMilestoneId).toBe("m2");
  });

  it("creates transition ids deterministically", () => {
    expect(createMilestoneTransitionId("m1", "m2", PROJ)).toBe(createMilestoneTransitionId("m1", "m2", PROJ));
    expect(createMilestoneTransitionId("m1", "m2", PROJ)).toContain("m1_to_m2");
  });

  it("does not fabricate transitions when order is impossible", () => {
    const a = ms("a");
    const b = ms("b");
    const { pairs, warnings } = buildMilestoneTransitionPairs([a, b], PROJ);
    expect(pairs).toEqual([]);
    expect(warnings.some((w) => w.code === "MISSING_MILESTONE_ORDER")).toBe(true);
  });

  it("orders by predecessor chain when dates are absent", () => {
    const p1 = ms("p1");
    const p2 = ms("p2", { predecessorMilestoneId: "p1" });
    const { pairs } = buildMilestoneTransitionPairs([p2, p1], PROJ);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sourceMilestoneId).toBe("p1");
    expect(pairs[0].targetMilestoneId).toBe("p2");
  });

  it("handles a single milestone safely (no pair)", () => {
    const { pairs, warnings } = buildMilestoneTransitionPairs([M1], PROJ);
    expect(pairs).toEqual([]);
    expect(warnings.some((w) => w.code === "SINGLE_MILESTONE_NO_TRANSITION")).toBe(true);
  });
});

describe("event assignment", () => {
  const pairs = buildMilestoneTransitionPairs([M1, M2], PROJ).pairs;
  const mMap = new Map([M1, M2].map((m) => [m.milestoneId, m]));

  it("assigns a milestone-achieved target event to the corridor whose target it is", () => {
    const e = ev({ eventId: "e1", eventType: "MilestoneAchieved", occurredAt: "2026-01-30T00:00:00.000Z", subjectType: "milestone", subjectId: "m2" });
    const { assignments } = assignEventsToMilestoneTransitions([e], pairs, mMap);
    expect(assignments[0].transitionId).toBe(pairs[0].transitionId);
    expect(assignments[0].reason).toBe("explicit_milestone_target");
  });

  it("assigns a milestone-tagged work event to its corridor", () => {
    const e = ev({ eventId: "e2", eventType: "TaskStarted", occurredAt: "2026-01-15T00:00:00.000Z", milestoneId: "m2" });
    const { assignments } = assignEventsToMilestoneTransitions([e], pairs, mMap);
    expect(assignments[0].transitionId).toBe(pairs[0].transitionId);
  });

  it("returns unassigned events with reasons when no corridor matches", () => {
    const e = ev({ eventId: "e3", eventType: "TaskStarted", occurredAt: "2026-01-15T00:00:00.000Z", milestoneId: "m-nope" });
    const unassigned = collectUnassignedMilestoneFlowEvents([e], pairs, mMap);
    expect(unassigned).toHaveLength(1);
    expect(unassigned[0].reason).toBe("UNASSIGNED_EVENT");
  });

  it("flags missing timestamps for time-based assignment", () => {
    const e = ev({ eventId: "e4", eventType: "TaskStarted", occurredAt: "not-a-date" });
    const unassigned = collectUnassignedMilestoneFlowEvents([e], pairs, mMap);
    expect(unassigned[0].reason).toBe("MISSING_EVENT_TIMESTAMP");
  });
});

describe("flow segment construction", () => {
  const TR = "tr-x";

  it("builds active_work segments from active work events", () => {
    const segs = buildFlowSegmentsForTransition(TR, [
      ev({ eventId: "a", eventType: "TaskStarted", occurredAt: "2026-01-11T00:00:00.000Z" }),
      ev({ eventId: "b", eventType: "TaskCompleted", occurredAt: "2026-01-12T00:00:00.000Z" }),
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("active_work");
    expect(segs[0].sourceEventId).toBe("a");
  });

  it("builds a blocked segment and closes it on the unblocking event", () => {
    const segs = buildFlowSegmentsForTransition(TR, [
      ev({ eventId: "s", eventType: "TaskStarted", occurredAt: "2026-01-11T00:00:00.000Z" }),
      ev({ eventId: "b", eventType: "TaskBlocked", occurredAt: "2026-01-12T00:00:00.000Z", subjectType: "task" }),
      ev({ eventId: "u", eventType: "TaskUnblocked", occurredAt: "2026-01-13T00:00:00.000Z" }),
    ]);
    const blocked = segs.find((s) => s.type === "blocked")!;
    expect(blocked).toBeDefined();
    expect(blocked.closingEventId).toBe("u"); // unblocking event closes the blocked segment
    expect(blocked.isOpenEnded).toBe(false);
    expect(segs[segs.length - 1].type).toBe("active_work");
  });

  it("builds decision_delay and approval_delay segments", () => {
    const dec = buildFlowSegmentsForTransition(TR, [
      ev({ eventId: "d", eventType: "DecisionProposed", occurredAt: "2026-01-11T00:00:00.000Z", subjectType: "decision", subjectId: "d1" }),
    ]);
    expect(dec[0].type).toBe("decision_delay");
    const app = buildFlowSegmentsForTransition(TR, [
      ev({ eventId: "ar", eventType: "ApprovalRequested", occurredAt: "2026-01-11T00:00:00.000Z", subjectType: "approval", subjectId: "a1" }),
    ]);
    expect(app[0].type).toBe("approval_delay");
  });

  it("builds a rework segment from reopen/reject/reverse semantics", () => {
    const segs = buildFlowSegmentsForTransition(TR, [
      ev({ eventId: "r", eventType: "TaskReopened", occurredAt: "2026-01-14T00:00:00.000Z" }),
    ]);
    expect(segs[0].type).toBe("rework");
  });

  it("preserves an unknown segment for unknown events", () => {
    const segs = buildFlowSegmentsForTransition(TR, [
      ev({ eventId: "x", eventType: "SomethingUnregistered", occurredAt: "2026-01-11T00:00:00.000Z" }),
    ]);
    expect(segs[0].type).toBe("unknown");
  });

  it("normalizes out-of-order events deterministically", () => {
    const ordered = normalizeMilestoneFlowEventOrder([
      ev({ eventId: "late", eventType: "TaskCompleted", occurredAt: "2026-01-20T00:00:00.000Z" }),
      ev({ eventId: "early", eventType: "TaskStarted", occurredAt: "2026-01-10T00:00:00.000Z" }),
    ]);
    expect(ordered.map((e) => e.eventId)).toEqual(["early", "late"]);
  });
});

describe("preliminary transition state (not final health)", () => {
  it("is completed when the target was achieved, active while running, pending when empty", () => {
    expect(classifyTransitionStateFromSegments([], { completed: false, regressed: false }).status).toBe("pending");
    const seg = buildFlowSegmentsForTransition("t", [ev({ eventId: "a", eventType: "TaskStarted", occurredAt: "2026-01-11T00:00:00.000Z" })]);
    expect(classifyTransitionStateFromSegments(seg, { completed: false, regressed: false }).status).toBe("active");
    expect(classifyTransitionStateFromSegments(seg, { completed: true, regressed: false }).status).toBe("completed");
    expect(classifyTransitionStateFromSegments(seg, { completed: true, regressed: true }).status).toBe("regressed");
  });
});

describe("full builder — end to end", () => {
  const events = [
    ev({ eventId: "e-start", eventType: "TaskStarted", occurredAt: "2026-01-12T00:00:00.000Z", milestoneId: "m2" }),
    ev({ eventId: "e-block", eventType: "TaskBlocked", occurredAt: "2026-01-15T00:00:00.000Z", milestoneId: "m2" }),
    ev({ eventId: "e-unblock", eventType: "TaskUnblocked", occurredAt: "2026-01-18T00:00:00.000Z", milestoneId: "m2" }),
    ev({ eventId: "e-done", eventType: "MilestoneAchieved", occurredAt: "2026-01-30T00:00:00.000Z", subjectType: "milestone", subjectId: "m2" }),
  ];

  it("produces one completed transition with ordered segments and evidence", () => {
    const res = buildMilestoneTransitions(builderInput([M1, M2], events));
    expect(res.transitions).toHaveLength(1);
    const tr = res.transitions[0];
    expect(tr.state.status).toBe("completed");
    expect(tr.completedAt).toBe("2026-01-30T00:00:00.000Z");
    expect(tr.segments.map((s) => s.type)).toContain("blocked");
    expect(tr.orderedEventIds[0]).toBe("e-start");
    expect(tr.createdByEngineVersion).toBe(MPF_ENGINE_VERSION);
    expect(tr.segments.every((s) => s.evidence.every((e) => !!e.eventId))).toBe(true);
  });

  it("handles empty events safely", () => {
    const res = buildMilestoneTransitions(builderInput([M1, M2], []));
    expect(res.transitions).toHaveLength(1);
    expect(res.transitions[0].state.status).toBe("pending");
    expect(res.stats.segmentCount).toBe(0);
  });

  it("handles empty milestones safely", () => {
    const res = buildMilestoneTransitions(builderInput([], events));
    expect(res.transitions).toEqual([]);
  });

  it("is deterministic — identical output for identical input", () => {
    const a = buildMilestoneTransitions(builderInput([M1, M2], events));
    const b = buildMilestoneTransitions(builderInput([M1, M2], events));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("provenance — backfill + compensating", () => {
  it("caps backfilled event confidence below high", () => {
    const backfilled = ev({
      eventId: "bf",
      eventType: "TaskCompleted",
      occurredAt: "2026-01-12T00:00:00.000Z",
      milestoneId: "m2",
      lifecycleClass: "SYNTHETIC_BACKFILL_EVENT",
      confidence: 0.9,
    });
    const res = buildMilestoneTransitions(builderInput([M1, M2], [backfilled]));
    const conf = res.transitions[0].segments[0].evidence[0].confidence;
    expect(conf).not.toBe("high");
  });

  it("keeps compensating-event evidence with a correction note (originals preserved)", () => {
    const original = ev({ eventId: "orig", eventType: "TaskCompleted", occurredAt: "2026-01-12T00:00:00.000Z", milestoneId: "m2" });
    const comp = ev({ eventId: "comp", eventType: "TaskReopened", occurredAt: "2026-01-14T00:00:00.000Z", milestoneId: "m2", isCompensatingEvent: true });
    const res = buildMilestoneTransitions(builderInput([M1, M2], [original, comp]));
    const allEvidence = res.transitions[0].segments.flatMap((s) => s.evidence);
    expect(allEvidence.some((e) => e.eventId === "orig")).toBe(true); // original not erased
    expect(allEvidence.some((e) => e.eventId === "comp" && /correction/i.test(e.note ?? ""))).toBe(true);
  });
});

describe("read-only — no mutation", () => {
  it("does not mutate source events or milestones", () => {
    const events = [ev({ eventId: "e1", eventType: "TaskStarted", occurredAt: "2026-01-12T00:00:00.000Z", milestoneId: "m2" })];
    const milestones = [M1, M2];
    const evSnap = JSON.parse(JSON.stringify(events));
    const msSnap = JSON.parse(JSON.stringify(milestones));
    buildMilestoneTransitions(builderInput(milestones, events));
    expect(events).toEqual(evSnap);
    expect(milestones).toEqual(msSnap);
  });

  it("builder code never imports the event write-path or references process graph tables", () => {
    const dir = join(process.cwd(), "src/lib/milestone-flow");
    for (const f of ["transition-builder.ts", "flow-segment-builder.ts", "transition-builder-types.ts"]) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']/);
      expect(code).not.toMatch(/process_nodes|process_edges/);
      expect(code).not.toMatch(/createAdminClient|service_role/);
    }
  });
});

describe("engine integration", () => {
  function access(): MilestoneFlowAccessContext {
    return { userId: "u1", organizationId: ORG, scope: "pm", authorizedProjectIds: [PROJ] };
  }
  function input(milestones: MilestoneFlowMilestoneRef[], events: MilestoneFlowEventRef[]): MilestoneFlowInputContract {
    return { scope: SCOPE, milestones, events, config: { configVersion: MPF_CONFIG_VERSION }, access: access() };
  }
  const fixedNow = () => new Date("2026-07-02T10:00:00.000Z");

  it("returns transitions + segments and keeps health unknown (no health assessments)", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const events = [ev({ eventId: "e", eventType: "MilestoneAchieved", occurredAt: "2026-01-30T00:00:00.000Z", subjectType: "milestone", subjectId: "m2" })];
    const out = engine.buildMilestoneFlowProjection(input([M1, M2], events));
    expect(out.projection.transitions.length).toBe(1);
    expect(Object.keys(out.projection.healthByTransition)).toHaveLength(0);
    expect(out.observability.healthAssessmentCount).toBe(0);
    expect(out.observability.transitionCount).toBe(1);
    expect(typeof out.observability.segmentCount).toBe("number");
  });

  it("empty input still returns a safe empty projection", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(input([], []));
    expect(out.projection.transitions).toEqual([]);
    expect(out.projection.dataQualityFlags).toContain("insufficient_event_density");
  });

  it("buildTransitionModel + buildFlowSegments no longer throw (implemented)", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const events = [ev({ eventId: "e", eventType: "TaskStarted", occurredAt: "2026-01-12T00:00:00.000Z", milestoneId: "m2" })];
    const transitions = engine.buildTransitionModel(input([M1, M2], events));
    expect(transitions.length).toBe(1);
    const segs = engine.buildFlowSegments(transitions[0], events);
    expect(Array.isArray(segs)).toBe(true);
  });
});
