import { describe, expect, it } from "vitest";
import { validateEventIntegrity, type EventIntegrityRow } from "@/lib/events/event-integrity";

const PROJECT = "22222222-2222-4222-8222-222222222222";
const ORG = "11111111-1111-4111-8111-111111111111";

function event(overrides: Partial<EventIntegrityRow> = {}): EventIntegrityRow {
  const sequence = overrides.sequenceNumber ?? 1;
  const subjectId = overrides.subjectId ?? "33333333-3333-4333-8333-333333333333";
  const subjectType = overrides.subjectType ?? "task";
  return {
    eventId: overrides.eventId ?? `event-${sequence}`,
    organizationId: ORG,
    projectId: PROJECT,
    caseId: subjectId,
    eventType: "TaskCreated",
    eventCategory: "task",
    subjectType,
    subjectId,
    actorType: "human",
    occurredAt: `2026-07-14T00:00:0${sequence}Z`,
    recordedAt: `2026-07-14T00:00:0${sequence}Z`,
    sequenceNumber: sequence,
    sourceModule: "roadmap",
    provenance: { capture_method: "direct" },
    eventHash: `hash-${sequence}`,
    previousEventHash: sequence === 1 ? null : `hash-${sequence - 1}`,
    objectRefs: [
      { objectType: subjectType, objectId: subjectId, role: "focal" },
      { objectType: "project", objectId: PROJECT, role: "context" },
    ],
    ...overrides,
  };
}

describe("P2-T3 event integrity validator", () => {
  it("accepts a mining-ready task case with a linked hash chain", () => {
    const report = validateEventIntegrity([
      event(),
      event({ eventId: "event-2", eventType: "TaskStarted", sequenceNumber: 2, previousEventHash: "hash-1", eventHash: "hash-2" }),
      event({ eventId: "event-3", eventType: "TaskCompleted", sequenceNumber: 3, previousEventHash: "hash-2", eventHash: "hash-3" }),
    ]);
    expect(report.valid).toBe(true);
    expect(report.eventCount).toBe(3);
    expect(report.caseCount).toBe(1);
  });

  it("rejects a broken chain, project case and missing OCEL refs", () => {
    const broken = event({
      eventId: "broken",
      sequenceNumber: 2,
      previousEventHash: "wrong",
      caseId: PROJECT,
      objectRefs: [],
    });
    const report = validateEventIntegrity([event(), broken]);
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "broken_hash_chain",
      "invalid_case_scope",
      "missing_focal_ref",
      "missing_project_ref",
    ]));
  });

  it("requires predecessor and relation refs on dependency events", () => {
    const report = validateEventIntegrity([
      event({ eventType: "TaskDependencyAdded", eventCategory: "dependency" }),
    ]);
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === "missing_dependency_ref")).toBe(true);
  });

  it("rejects a cross-organization row even when the project id matches", () => {
    const report = validateEventIntegrity([
      event(),
      event({
        eventId: "event-2",
        organizationId: "99999999-9999-4999-8999-999999999999",
        sequenceNumber: 2,
      }),
    ]);
    expect(report.valid).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "cross_organization_event" }));
  });

  it("reports sequence gaps as warnings without invalidating an otherwise sound window", () => {
    const report = validateEventIntegrity([
      event(),
      event({ eventId: "event-3", sequenceNumber: 3, previousEventHash: "hash-1", eventHash: "hash-3" }),
    ]);
    expect(report.valid).toBe(true);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "sequence_gap", severity: "warning" }));
  });
});
