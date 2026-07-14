import { describe, expect, it } from "vitest";
import { buildProcessMiningEvidence } from "../process-mining-evidence";
import type { CanonicalEventLoadResult } from "@/lib/graph/event-relationship-loader";
import type { MilestoneFlowLoadResult } from "@/lib/milestone-flow-ui/load-projection";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";

const PROJECT = "22222222-2222-4222-8222-222222222222";
const ORG = "11111111-1111-4111-8111-111111111111";
const TASK = "33333333-3333-4333-8333-333333333333";

function canonicalEvent(overrides: Partial<LivingGraphCanonicalEvent> = {}): LivingGraphCanonicalEvent {
  const sequence = overrides.sequenceNumber ?? 1;
  const subjectType = overrides.subjectType ?? "task";
  const subjectId = overrides.subjectId ?? TASK;
  return {
    eventId: overrides.eventId ?? `event-${sequence}`,
    organizationId: ORG,
    projectId: PROJECT,
    caseId: overrides.caseId ?? subjectId,
    eventType: overrides.eventType ?? "TaskCreated",
    eventCategory: overrides.eventCategory ?? "task",
    eventSchemaVersion: 1,
    eventImportance: "MEDIUM",
    lifecycleClass: "BUSINESS_EVENT",
    subjectType,
    subjectId,
    actorType: "human",
    actorId: "44444444-4444-4444-8444-444444444444",
    occurredAt: `2026-07-14T00:00:0${sequence}Z`,
    recordedAt: `2026-07-14T00:00:0${sequence}Z`,
    sequenceNumber: sequence,
    sourceModule: "roadmap",
    sourceEntityType: subjectType,
    sourceEntityId: subjectId,
    fromState: null,
    toState: null,
    causedBy: [],
    isCompensatingEvent: false,
    compensatesEventId: null,
    eventHash: `hash-${sequence}`,
    previousEventHash: sequence === 1 ? null : `hash-${sequence - 1}`,
    provenance: { capture_method: "direct" },
    confidence: 1,
    payload: { private_note: "must not reach Isabella" },
    visibility: "normal",
    objectRefs: [
      { object_type: subjectType, object_id: subjectId, role: "focal" },
      { object_type: "project", object_id: PROJECT, role: "context" },
    ],
    dataQualityFlags: [],
    captureMethod: "direct",
    lateRecorded: false,
    ...overrides,
  };
}

function flowLoad(): MilestoneFlowLoadResult {
  return {
    status: "ok",
    milestoneNamesById: { m1: "Foundation", m2: "Design" },
    milestoneCount: 2,
    eventCount: 3,
    projectTitle: "Mining Layer",
    projection: {
      transitions: [{
        transitionId: "tr-1",
        sourceMilestoneId: "m1",
        targetMilestoneId: "m2",
        state: { status: "active", currentSegmentType: "waiting", isBlocked: false, lastEventAt: "2026-07-14T00:00:03Z" },
        evidenceEventIds: ["event-3"],
      }],
      healthSummariesByTransition: {
        "tr-1": { healthStatus: "at_risk", confidence: "medium", uncertaintyNotes: ["partial evidence"] },
      },
      findingsByTransition: {
        "tr-1": [{
          findingId: "delay-1", transitionId: "tr-1", findingType: "waiting_time",
          status: "open", severity: "medium", durationMs: 3600000,
          startedAt: "2026-07-14T00:00:01Z", endedAt: null, confidence: "medium",
        }],
      },
      reworkFindingsByTransition: {
        "tr-1": [{
          findingId: "rework-1", transitionId: "tr-1", reworkType: "reopened_work",
          status: "open", severity: "medium", triggerType: "TaskReopened",
          startedAt: "2026-07-14T00:00:02Z", endedAt: null, confidence: "medium",
        }],
      },
      bottleneckFindingsByTransition: {
        "tr-1": [{
          findingId: "bottleneck-1", transitionId: "tr-1", bottleneckType: "repeated_wait",
          status: "candidate", severity: "medium", occurrenceCount: 3, confidence: "medium",
        }],
      },
      observability: {
        transitionCount: 1,
        delayFindingCount: 1,
        blockerFindingCount: 0,
        reworkFindingCount: 1,
        bottleneckFindingCount: 1,
        engineVersion: "mpf-test",
      },
    },
  } as unknown as MilestoneFlowLoadResult;
}

describe("Isabella Process Mining evidence adapter", () => {
  it("validates the complete canonical chain while counting mining cases only", () => {
    const taskCreated = canonicalEvent();
    const interleavedRisk = canonicalEvent({
      eventId: "event-2",
      sequenceNumber: 2,
      eventType: "risk_registered",
      eventCategory: "risk",
      subjectType: "risk",
      subjectId: "55555555-5555-4555-8555-555555555555",
      caseId: "55555555-5555-4555-8555-555555555555",
      objectRefs: [],
    });
    const taskCompleted = canonicalEvent({
      eventId: "event-3",
      sequenceNumber: 3,
      eventType: "TaskCompleted",
      previousEventHash: "hash-2",
    });
    const eventLoad: CanonicalEventLoadResult = {
      status: "ok",
      canonicalEvents: [taskCreated, interleavedRisk, taskCompleted],
      eventRelationships: [],
      eventsTruncated: false,
    };

    const result = buildProcessMiningEvidence(eventLoad, flowLoad(), {
      projectId: PROJECT,
      organizationId: ORG,
      userId: "user-1",
      locale: "en",
    });

    expect(result.context.integrityValid).toBe(true);
    expect(result.context.eventCount).toBe(2);
    expect(result.context.caseCount).toBe(1);
    expect(result.context.transitionCount).toBe(1);
  });

  it("emits sanitized direct and derived packets with explicit limitations", () => {
    const result = buildProcessMiningEvidence({
      status: "ok",
      canonicalEvents: [canonicalEvent()],
      eventRelationships: [],
      eventsTruncated: false,
    }, flowLoad(), {
      projectId: PROJECT,
      organizationId: ORG,
      userId: "user-1",
      locale: "en",
    });

    expect(result.packets.map((packet) => packet.sourceKind)).toEqual(expect.arrayContaining([
      "project_event_graph",
      "milestone_process_flow",
    ]));
    expect(result.packets.map((packet) => packet.evidenceType)).toEqual(expect.arrayContaining([
      "event_summary",
      "milestone_flow_segment",
      "delay_finding",
      "rework_finding",
      "bottleneck_finding",
    ]));
    expect(JSON.stringify(result.packets)).not.toContain("private_note");
    expect(JSON.stringify(result.packets)).not.toContain('"payload"');
    expect(result.packets.find((packet) => packet.evidenceType === "delay_finding")?.limitations?.join(" "))
      .toMatch(/not a canonical event or causal proof/i);
  });
});
