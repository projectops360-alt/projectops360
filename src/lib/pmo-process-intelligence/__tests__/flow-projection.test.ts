// ============================================================================
// CAP-047 M2 — flow projection contract (guard: PMO-PI-FLOW-PROJECTION)
// ============================================================================
// Fails if: rework stops being detected from event repetition, bottlenecks
// stop being calculated from waiting pressure, the dominant path stops
// matching the most frequent variant, non-business/compensating events leak
// into the projection, or the engine mutates its inputs / loses determinism.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildFlowModel } from "../flow-projection";
import type { PmoPiCase, PmoPiEventRecord, PmoPiScope } from "../contracts";

const SCOPE: PmoPiScope = { organizationId: "org-1", projectIds: [], level: "organization" };

let seq = 0;
function ev(
  caseId: string,
  eventType: string,
  occurredAt: string,
  overrides: Partial<PmoPiEventRecord> = {},
): PmoPiEventRecord {
  seq++;
  return {
    eventId: `e${seq}`,
    eventType,
    eventCategory: "task",
    occurredAt,
    lifecycleClass: "BUSINESS_EVENT",
    isCompensatingEvent: false,
    organizationId: "org-1",
    projectId: "p1",
    caseId,
    subjectType: "task",
    subjectId: `t-${seq}`,
    actorType: "human",
    recordedAt: occurredAt,
    sourceModule: "roadmap",
    ...overrides,
  };
}

function makeCase(caseId: string, events: PmoPiEventRecord[], outcome: PmoPiCase["outcome"] = "success"): PmoPiCase {
  return { caseId, caseLabel: caseId, organizationId: "org-1", projectId: "p1", events, outcome };
}

// Two cases follow A→B→C (dominant); one case reworks: A→B→A→C with a long
// wait before C (bottleneck pressure on C).
const cases: PmoPiCase[] = [
  makeCase("c1", [
    ev("c1", "TaskStarted", "2026-07-01T00:00:00Z"),
    ev("c1", "TaskCompleted", "2026-07-01T01:00:00Z"),
    ev("c1", "MilestoneAchieved", "2026-07-01T02:00:00Z"),
  ]),
  makeCase("c2", [
    ev("c2", "TaskStarted", "2026-07-02T00:00:00Z"),
    ev("c2", "TaskCompleted", "2026-07-02T01:00:00Z"),
    ev("c2", "MilestoneAchieved", "2026-07-02T02:00:00Z"),
  ]),
  makeCase("c3", [
    ev("c3", "TaskStarted", "2026-07-03T00:00:00Z"),
    ev("c3", "TaskCompleted", "2026-07-03T01:00:00Z"),
    ev("c3", "TaskStarted", "2026-07-03T02:00:00Z"), // rework: A repeats
    ev("c3", "MilestoneAchieved", "2026-07-05T00:00:00Z"), // 46h wait → pressure
  ], "failure"),
];

const NOW = "2026-07-23T00:00:00Z";

describe("buildFlowModel (CAP-047 M2)", () => {
  const model = buildFlowModel(SCOPE, cases, NOW);

  it("derives nodes and edges with frequencies from real event order", () => {
    const started = model.nodes.find((n) => n.id === "TaskStarted")!;
    expect(started.frequency).toBe(4); // 3 cases + 1 rework
    expect(started.caseCount).toBe(3);
    expect(started.reworkOccurrences).toBe(1);
    const edgeAB = model.edges.find((e) => e.from === "TaskStarted" && e.to === "TaskCompleted")!;
    expect(edgeAB.frequency).toBe(3);
  });

  it("marks rework edges only when the target activity already happened in the case", () => {
    const reworkEdge = model.edges.find((e) => e.from === "TaskCompleted" && e.to === "TaskStarted")!;
    expect(reworkEdge.isRework).toBe(true);
    const normalEdge = model.edges.find((e) => e.from === "TaskStarted" && e.to === "TaskCompleted")!;
    expect(normalEdge.isRework).toBe(false);
  });

  it("dominant path matches the most frequent variant (2 of 3 cases)", () => {
    expect(model.dominantPath).toEqual(["TaskStarted", "TaskCompleted", "MilestoneAchieved"]);
    expect(model.edges.find((e) => e.from === "TaskStarted" && e.to === "TaskCompleted")?.onDominantPath).toBe(true);
  });

  it("bottleneck score is calculated from waiting pressure, max normalized to 1", () => {
    const milestone = model.nodes.find((n) => n.id === "MilestoneAchieved")!;
    expect(milestone.bottleneckScore).toBe(1); // longest waits land here
    for (const n of model.nodes) {
      expect(n.bottleneckScore).toBeGreaterThanOrEqual(0);
      expect(n.bottleneckScore).toBeLessThanOrEqual(1);
    }
  });

  it("excludes non-business and compensating events, reporting honest quality", () => {
    const noisy = [
      makeCase("c4", [
        ev("c4", "TaskStarted", "2026-07-01T00:00:00Z"),
        ev("c4", "CacheInvalidated", "2026-07-01T00:30:00Z", { lifecycleClass: "SYSTEM_EVENT" }),
        ev("c4", "TaskCompleted", "2026-07-01T01:00:00Z", { isCompensatingEvent: true }),
      ]),
    ];
    const m = buildFlowModel(SCOPE, noisy, NOW);
    expect(m.nodes.map((n) => n.id)).toEqual(["TaskStarted"]);
    expect(m.quality.totalEventsSeen).toBe(3);
    expect(m.quality.businessEventsUsed).toBe(1);
    expect(m.quality.excludedEvents).toBe(2);
  });

  it("is deterministic and never mutates its inputs", () => {
    const frozen = JSON.stringify(cases);
    const a = buildFlowModel(SCOPE, cases, NOW);
    const b = buildFlowModel(SCOPE, cases, NOW);
    expect(a).toEqual(b);
    expect(JSON.stringify(cases)).toBe(frozen);
  });

  it("delegates variant discovery to the CAP-046 engine (no second implementation)", () => {
    expect(model.variants.processType).toBe("pmo_process_intelligence");
    expect(model.variants.variants.length).toBe(2);
    expect(model.variants.quality.businessEventsUsed).toBeGreaterThan(0);
  });
});
