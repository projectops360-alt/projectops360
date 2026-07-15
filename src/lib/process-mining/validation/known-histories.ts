import type { DiscoveryEvent } from "@/lib/process-mining/discovery";
import type { KnownHistoryScenario } from "./types";

const ORGANIZATION_ID = "known-history-org";

function event(
  projectId: string,
  caseId: string,
  sequenceNumber: number,
  eventType: string,
  occurredAt: string,
): DiscoveryEvent {
  const recordedAt = new Date(Date.parse(occurredAt) + 5 * 60 * 1000).toISOString();
  return {
    eventId: `${projectId}:${sequenceNumber}`,
    organizationId: ORGANIZATION_ID,
    projectId,
    caseId,
    eventType,
    eventCategory: "task",
    occurredAt,
    recordedAt,
    sequenceNumber,
    lifecycleClass: "BUSINESS_EVENT",
    isCompensatingEvent: false,
  };
}

const HOUR = 60 * 60 * 1000;

export const KNOWN_PROCESS_HISTORIES: KnownHistoryScenario[] = [
  {
    id: "straight-through",
    title: "Straight-through task delivery",
    organizationId: ORGANIZATION_ID,
    projectId: "known-straight-through",
    events: [
      event("known-straight-through", "task-a", 1, "TaskCreated", "2026-01-01T08:00:00.000Z"),
      event("known-straight-through", "task-a", 2, "TaskStarted", "2026-01-01T09:00:00.000Z"),
      event("known-straight-through", "task-a", 3, "TaskCompleted", "2026-01-01T12:00:00.000Z"),
    ],
    expected: {
      caseCount: 1,
      directFollowCount: 2,
      variantCount: 1,
      unknownActivityCount: 0,
      explicitWaitingByCaseMs: { "task-a": null },
      cycleTimeByCaseMs: { "task-a": 4 * HOUR },
      hasRework: false,
      activeExplicitBlocker: false,
    },
  },
  {
    id: "explicit-wait-recovery",
    title: "Explicit blocker followed by recovery",
    organizationId: ORGANIZATION_ID,
    projectId: "known-explicit-wait",
    events: [
      event("known-explicit-wait", "task-b", 1, "TaskCreated", "2026-02-01T08:00:00.000Z"),
      event("known-explicit-wait", "task-b", 2, "TaskBlocked", "2026-02-01T09:00:00.000Z"),
      event("known-explicit-wait", "task-b", 3, "TaskUnblocked", "2026-02-01T11:00:00.000Z"),
      event("known-explicit-wait", "task-b", 4, "TaskCompleted", "2026-02-01T13:00:00.000Z"),
    ],
    expected: {
      caseCount: 1,
      directFollowCount: 3,
      variantCount: 1,
      unknownActivityCount: 0,
      explicitWaitingByCaseMs: { "task-b": 2 * HOUR },
      cycleTimeByCaseMs: { "task-b": 5 * HOUR },
      hasRework: false,
      activeExplicitBlocker: false,
    },
  },
  {
    id: "variant-with-rework",
    title: "Two variants with an observed rework loop",
    organizationId: ORGANIZATION_ID,
    projectId: "known-rework",
    events: [
      event("known-rework", "task-c1", 1, "TaskCreated", "2026-03-01T08:00:00.000Z"),
      event("known-rework", "task-c1", 2, "TaskStarted", "2026-03-01T09:00:00.000Z"),
      event("known-rework", "task-c1", 3, "TaskCompleted", "2026-03-01T11:00:00.000Z"),
      event("known-rework", "task-c2", 4, "TaskCreated", "2026-03-02T08:00:00.000Z"),
      event("known-rework", "task-c2", 5, "TaskStarted", "2026-03-02T09:00:00.000Z"),
      event("known-rework", "task-c2", 6, "TaskReopened", "2026-03-02T10:00:00.000Z"),
      event("known-rework", "task-c2", 7, "TaskStarted", "2026-03-02T11:00:00.000Z"),
      event("known-rework", "task-c2", 8, "TaskCompleted", "2026-03-02T14:00:00.000Z"),
    ],
    expected: {
      caseCount: 2,
      directFollowCount: 4,
      variantCount: 2,
      unknownActivityCount: 0,
      explicitWaitingByCaseMs: { "task-c1": null, "task-c2": null },
      cycleTimeByCaseMs: { "task-c1": 3 * HOUR, "task-c2": 6 * HOUR },
      hasRework: true,
      activeExplicitBlocker: false,
    },
  },
  {
    id: "active-explicit-blocker",
    title: "Active explicit blocker with no invented resolution",
    organizationId: ORGANIZATION_ID,
    projectId: "known-active-blocker",
    events: [
      event("known-active-blocker", "task-d", 1, "TaskCreated", "2026-04-01T08:00:00.000Z"),
      event("known-active-blocker", "task-d", 2, "TaskBlocked", "2026-04-01T10:00:00.000Z"),
    ],
    expected: {
      caseCount: 1,
      directFollowCount: 1,
      variantCount: 1,
      unknownActivityCount: 0,
      explicitWaitingByCaseMs: { "task-d": null },
      cycleTimeByCaseMs: { "task-d": 2 * HOUR },
      hasRework: false,
      activeExplicitBlocker: true,
    },
  },
];
