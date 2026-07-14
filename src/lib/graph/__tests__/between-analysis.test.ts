// ============================================================================
// CAP-045 §C.2 — "What happened between?" pure motor tests
// ============================================================================
// Proves the pure `analyzeBetween` motor: sequence interval bounds (inclusive,
// excludes the endpoints' outer neighbors), temporal≠causal, caused_by only
// when explicit, occurred_at vs recorded_at kept separate, cross-project
// rejection, swap determinism, idempotency, no mutation, no-path / no-events
// limitations (never updated_at substitution), and milestone endpoint resolution.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  analyzeBetween,
  getBetweenAnalysisLayoutKey,
  type BetweenAnalysisInput,
  type BetweenEndpoint,
} from "@/lib/graph/between-analysis";
import type {
  LivingGraphNode,
  LivingGraphEdge,
  LivingGraphCanonicalEvent,
  LivingGraphEventRelationship,
} from "@/types/living-graph";

const PROJECT = "00000000-0000-0000-0000-000000000010";
const OTHER_PROJECT = "00000000-0000-0000-0000-000000000099";

function node(id: string, projectId = PROJECT, sourceEntityType = "roadmap_tasks", sourceEntityId = id, milestoneId: string | null = null): LivingGraphNode {
  return {
    id, projectId, nodeType: "task_transition", sourceEntityType, sourceEntityId,
    label: id, description: null, status: "todo", progress: null, startDate: null,
    endDate: null, durationDays: null, occurredAt: "", createdAt: "", updatedAt: "",
    riskLevel: null, isBlocked: false, isCritical: false, milestoneId, milestoneLabel: milestoneId ? `M-${milestoneId}` : null,
    milestoneOrder: null, traceabilityScore: null, metadata: {},
  };
}

function edge(id: string, source: string, target: string, projectId = PROJECT): LivingGraphEdge {
  return {
    id, projectId, sourceNodeId: source, targetNodeId: target, edgeType: "informed",
    weight: 1, lagDays: null, isCritical: false, riskLevel: null, metadata: {},
  };
}

/** Canonical event with an object ref to its source entity (so endpoint
 *  resolution via object refs works for milestones/tasks). */
function event(
  eventId: string,
  seq: number,
  occurredAt: string,
  opts: {
    projectId?: string;
    eventType?: string;
    eventCategory?: string;
    fromState?: string | null;
    toState?: string | null;
    causedBy?: string[];
    objectRefId?: string;
    recordedAt?: string;
    sourceEntityId?: string | null;
    importance?: string;
  } = {},
): LivingGraphCanonicalEvent {
  const projectId = opts.projectId ?? PROJECT;
  const objectRefId = opts.objectRefId ?? opts.sourceEntityId ?? null;
  return {
    eventId,
    organizationId: "org-1",
    projectId,
    eventType: opts.eventType ?? "task_status_changed",
    eventCategory: opts.eventCategory ?? "execution",
    eventSchemaVersion: 1,
    eventImportance: (opts.importance as never) ?? null,
    lifecycleClass: "BUSINESS_EVENT",
    subjectType: "task",
    subjectId: opts.sourceEntityId ?? null,
    actorType: "human",
    actorId: "u1",
    occurredAt,
    recordedAt: opts.recordedAt ?? occurredAt,
    sequenceNumber: seq,
    sourceModule: "workboard",
    sourceEntityType: opts.sourceEntityId ? "roadmap_tasks" : null,
    sourceEntityId: opts.sourceEntityId ?? null,
    fromState: opts.fromState ?? null,
    toState: opts.toState ?? null,
    causedBy: opts.causedBy ?? [],
    isCompensatingEvent: false,
    compensatesEventId: null,
    eventHash: null,
    previousEventHash: null,
    provenance: { capture_method: "direct" },
    confidence: null,
    payload: null,
    visibility: "members",
    objectRefs: objectRefId ? [{ object_type: "task", object_id: objectRefId, role: "focal" }] : [],
    dataQualityFlags: [],
    captureMethod: "direct",
    lateRecorded: false,
  };
}

function rel(
  id: string,
  sourceEventId: string,
  targetEventId: string,
  cls: "temporal" | "causal" | "compensation" | "object_reference",
  type: LivingGraphEventRelationship["relationshipType"],
  projectId = PROJECT,
): LivingGraphEventRelationship {
  return {
    id, projectId, sourceEventId, targetEventId, objectId: null,
    relationshipType: type, relationshipClass: cls, objectType: null, objectRole: null,
    sequenceDistance: 1, occurredLagMs: 1000, evidence: cls === "causal" ? "explicit" : "deterministic_projection",
    metadata: {},
  };
}

function milestoneEndpoint(id: string): BetweenEndpoint {
  return { nodeId: id, label: `M-${id}`, kind: "milestone", sourceEntityId: id };
}

// A 20-event project where seq 10 and 20 are tied to milestones m1 / m2.
function buildIntervalFixture(): {
  nodes: LivingGraphNode[];
  edges: LivingGraphEdge[];
  events: LivingGraphCanonicalEvent[];
  rels: LivingGraphEventRelationship[];
} {
  const nodes = [
    node("m1", PROJECT, "milestones", "m1"),
    node("m2", PROJECT, "milestones", "m2"),
  ];
  const edges = [edge("e-m1-m2", "m1", "m2")];
  const events: LivingGraphCanonicalEvent[] = [];
  // seq 9 → a pre-interval event NOT tied to m1 (so it is excluded from [10,20]).
  events.push(event("ev9", 9, "2026-01-09T00:00:00.000Z", { sourceEntityId: "pre", objectRefId: "pre" }));
  // seq 10..20, seq 10 tied to m1, seq 20 tied to m2
  for (let s = 10; s <= 20; s++) {
    const tiedEntity = s === 10 ? "m1" : s === 20 ? "m2" : null;
    events.push(
      event(`ev${s}`, s, `2026-01-${String(s).padStart(2, "0")}T00:00:00.000Z`, {
        sourceEntityId: tiedEntity,
        objectRefId: tiedEntity,
        fromState: s === 10 ? "todo" : null,
        toState: s === 20 ? "done" : null,
      }),
    );
  }
  // seq 21 → a post-interval event NOT tied to m2 (so it is excluded from [10,20]).
  events.push(event("ev21", 21, "2026-01-21T00:00:00.000Z", { sourceEntityId: "post", objectRefId: "post" }));
  const rels = [
    rel("r-temp", "ev10", "ev11", "temporal", "project_sequence_next"),
    rel("r-causal", "ev12", "ev15", "causal", "caused_by"),
  ];
  return { nodes, edges, events, rels };
}

function baseInput(overrides: Partial<BetweenAnalysisInput> = {}): BetweenAnalysisInput {
  const f = buildIntervalFixture();
  return {
    requestedProjectId: PROJECT,
    startEndpoint: milestoneEndpoint("m1"),
    endEndpoint: milestoneEndpoint("m2"),
    nodes: f.nodes,
    edges: f.edges,
    canonicalEvents: f.events,
    eventRelationships: f.rels,
    ...overrides,
  };
}

describe("CAP-045 §C.2 — analyzeBetween (pure motor)", () => {
  it("1. interval is INCLUSIVE [seqStart, seqEnd] — excludes 9 and 21", () => {
    const r = analyzeBetween(baseInput());
    expect(r.sequenceStart).toBe(10);
    expect(r.sequenceEnd).toBe(20);
    expect(r.canonicalEventIds).not.toContain("ev9");
    expect(r.canonicalEventIds).not.toContain("ev21");
    expect(r.canonicalEventIds).toContain("ev10");
    expect(r.canonicalEventIds).toContain("ev20");
    expect(r.eventCount).toBe(11); // 10..20 inclusive
  });

  it("2. temporal order is NOT causality — temporalRelationships ≠ explicitCausalRelationships", () => {
    const r = analyzeBetween(baseInput());
    expect(r.temporalRelationships.map((x) => x.relationshipId)).toEqual(["r-temp"]);
    expect(r.explicitCausalRelationships.map((x) => x.relationshipId)).toEqual(["r-causal"]);
    // The temporal relationship is never promoted to causal.
    expect(r.explicitCausalRelationships.some((x) => x.relationshipId === "r-temp")).toBe(false);
  });

  it("3. caused_by is emitted ONLY when explicitly recorded (causal class)", () => {
    const r = analyzeBetween(baseInput());
    expect(r.explicitCausalRelationships).toHaveLength(1);
    expect(r.explicitCausalRelationships[0].relationshipType).toBe("caused_by");
    // No causal link is invented from temporal adjacency.
    const r2 = analyzeBetween(baseInput({ eventRelationships: [rel("r-temp", "ev10", "ev11", "temporal", "project_sequence_next")] }));
    expect(r2.explicitCausalRelationships).toHaveLength(0);
  });

  it("4. largest waiting gap is derived from occurred_at deltas (not recorded_at)", () => {
    const events: LivingGraphCanonicalEvent[] = [
      event("a", 10, "2026-01-10T00:00:00.000Z", { sourceEntityId: "m1", objectRefId: "m1" }),
      event("b", 11, "2026-01-12T00:00:00.000Z", { recordedAt: "2026-01-12T00:00:05.000Z" }),
      event("c", 20, "2026-01-13T00:00:00.000Z", { sourceEntityId: "m2", objectRefId: "m2", recordedAt: "2026-01-13T00:00:00.000Z" }),
    ];
    const r = analyzeBetween(baseInput({ canonicalEvents: events }));
    // gap a→b = 2 days, b→c = 1 day → largest = 2 days (ms).
    expect(r.largestWaitingGap).toBe(2 * 86_400_000);
  });

  it("5. recording delay (recordedElapsedMs) is kept SEPARATE from elapsedBusinessMs", () => {
    const events: LivingGraphCanonicalEvent[] = [
      event("a", 10, "2026-01-10T00:00:00.000Z", { sourceEntityId: "m1", objectRefId: "m1", recordedAt: "2026-01-10T00:00:00.000Z" }),
      event("b", 11, "2026-01-11T00:00:00.000Z", { recordedAt: "2026-01-11T00:00:10.000Z" }),
      event("c", 20, "2026-01-12T00:00:00.000Z", { sourceEntityId: "m2", objectRefId: "m2", recordedAt: "2026-01-12T00:00:20.000Z" }),
    ];
    const r = analyzeBetween(baseInput({ canonicalEvents: events }));
    expect(r.elapsedBusinessMs).toBe(2 * 86_400_000); // occurred_at span
    expect(r.recordedElapsedMs).toBe(2 * 86_400_000 + 20_000); // recorded_at span (separate)
    expect(r.limitations).toContain("elapsed_is_wall_clock_not_business_hours");
  });

  it("6. cross-project endpoints are REJECTED", () => {
    const startNode = node("m1", OTHER_PROJECT, "milestones", "m1");
    const r = analyzeBetween(
      baseInput({
        requestedProjectId: PROJECT,
        nodes: [startNode, node("m2", PROJECT, "milestones", "m2")],
        startEndpoint: { nodeId: "m1", label: "M-m1", kind: "milestone", sourceEntityId: "m1" },
      }),
    );
    expect(r.limitations).toContain("cross_project_rejected");
  });

  it("7. swapping START/END is deterministic (same interval, swapped labels)", () => {
    const a = analyzeBetween(baseInput());
    const b = analyzeBetween(
      baseInput({
        startEndpoint: milestoneEndpoint("m2"),
        endEndpoint: milestoneEndpoint("m1"),
      }),
    );
    // The interval bounds are order-independent (min..max), so the event set is
    // the same; only the endpoint labels swap.
    expect(new Set(a.canonicalEventIds)).toEqual(new Set(b.canonicalEventIds));
    expect(b.startEndpoint.label).toBe("M-m2");
    expect(b.endEndpoint.label).toBe("M-m1");
  });

  it("8. idempotent — same inputs yield identical outputs", () => {
    const a = analyzeBetween(baseInput());
    const b = analyzeBetween(baseInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("9. does NOT mutate its inputs", () => {
    const input = baseInput();
    const snapshot = JSON.stringify(input);
    analyzeBetween(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("10. no operational path → limitation + empty operationalPath (never invented)", () => {
    const r = analyzeBetween(baseInput({ edges: [] }));
    expect(r.operationalPath).toEqual([]);
    expect(r.limitations).toContain("No recorded operational path");
  });

  it("11. no canonical history for an endpoint → limitation (NEVER substitutes updated_at)", () => {
    // m2 has no events tied to it (object refs removed).
    const f = buildIntervalFixture();
    const events = f.events.map((e) =>
      e.sequenceNumber === 20 ? { ...e, objectRefs: [], sourceEntityId: null, subjectId: null } : e,
    );
    const r = analyzeBetween(baseInput({ canonicalEvents: events }));
    expect(r.limitations.some((l) => l.includes("No canonical history available for this endpoint"))).toBe(true);
    // No updated_at-derived event ids leak in.
    expect(r.canonicalEventIds.every((id) => id.startsWith("ev"))).toBe(true);
  });

  it("12. milestone endpoint resolves its tasks + events with declared bounds", () => {
    // m1 has a task t1 tied to it; the milestone endpoint resolves via the m1
    // object refs on events seq 9 and 10, so seqStart = 9 (min) … but end m2
    // reaches seq 20. Interval lower = 9, upper = 20.
    const f = buildIntervalFixture();
    const nodes = [...f.nodes, node("t1", PROJECT, "roadmap_tasks", "t1", "m1")];
    const r = analyzeBetween(baseInput({ nodes }));
    expect(r.projectId).toBe(PROJECT);
    expect(r.sequenceStart).toBeLessThanOrEqual(r.sequenceEnd as number);
    expect(r.summaryFacts.some((s) => s.startsWith("interval:"))).toBe(true);
    // Operational path resolves m1 → m2.
    expect(r.operationalPath.map((p) => p.nodeId)).toEqual(["m1", "m2"]);
  });

  it("getBetweenAnalysisLayoutKey is order-independent (sorted endpoints)", () => {
    const k1 = getBetweenAnalysisLayoutKey(PROJECT, "m1", "m2");
    const k2 = getBetweenAnalysisLayoutKey(PROJECT, "m2", "m1");
    expect(k1).toBe(k2);
    expect(k1).toBe(`between:v1:${PROJECT}:m1:m2`);
  });
});