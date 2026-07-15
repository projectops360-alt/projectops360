import { describe, expect, it } from "vitest";
import { createKnowledgeObjectSchema } from "../contracts";
import {
  buildProcessDiscoveryKnowledgeProposals,
  type KnowledgeBackfillEvent,
} from "../process-discovery-backfill";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

function event(sequenceNumber: number, eventType: string, hour: number, overrides: Partial<KnowledgeBackfillEvent> = {}): KnowledgeBackfillEvent {
  return {
    eventId: `33333333-3333-4333-8333-${String(sequenceNumber).padStart(12, "0")}`,
    evidenceRef: `44444444-4444-4444-8444-${String(sequenceNumber).padStart(12, "0")}`,
    organizationId,
    projectId,
    caseId: "task-1",
    eventType,
    eventCategory: "task",
    occurredAt: `2026-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`,
    recordedAt: `2026-01-01T${String(hour).padStart(2, "0")}:05:00.000Z`,
    sequenceNumber,
    lifecycleClass: "BUSINESS_EVENT",
    isCompensatingEvent: false,
    ...overrides,
  };
}

const events = [
  event(1, "TaskCreated", 8),
  event(2, "TaskStarted", 9),
  event(3, "TaskReopened", 10),
  event(4, "TaskStarted", 11),
  event(5, "TaskCompleted", 13),
];

describe("process discovery knowledge backfill", () => {
  it("builds schema-valid evidence-backed proposals", () => {
    const proposals = buildProcessDiscoveryKnowledgeProposals(events, organizationId, projectId);
    expect(proposals.map((item) => item.title)).toEqual([
      "Canonical process history baseline",
      "Observed direct-follow process map",
      "Observed execution variants",
      "Observed process timing baseline",
      "Observed repeated-activity pattern",
    ]);
    expect(proposals.every((item) => createKnowledgeObjectSchema.safeParse(item).success)).toBe(true);
    expect(proposals.every((item) => item.evidence.length === events.length)).toBe(true);
    expect(proposals.every((item) => item.provenance.captureMethod === "derived")).toBe(true);
  });

  it("is deterministic and snapshot-idempotent", () => {
    const first = buildProcessDiscoveryKnowledgeProposals(events, organizationId, projectId);
    const retry = buildProcessDiscoveryKnowledgeProposals([...events].reverse(), organizationId, projectId);
    expect(retry).toEqual(first);
    const next = buildProcessDiscoveryKnowledgeProposals([...events, event(6, "TaskStatusChanged", 14)], organizationId, projectId);
    expect(next[0].idempotencyKey).not.toBe(first[0].idempotencyKey);
  });

  it("preserves causal and temporal honesty", () => {
    const proposals = buildProcessDiscoveryKnowledgeProposals(events, organizationId, projectId);
    const text = proposals.map((item) => `${item.summary} ${item.body}`).join(" ").toLowerCase();
    expect(text).toContain("not proof");
    expect(text).toContain("does not identify who caused");
    expect(text).not.toMatch(/taskstarted caused taskreopened/);
  });

  it("downgrades snapshots containing synthetic evidence", () => {
    const proposals = buildProcessDiscoveryKnowledgeProposals([
      event(1, "TaskCreated", 8, { lifecycleClass: "SYNTHETIC_BACKFILL_EVENT" }),
      event(2, "TaskCompleted", 9),
    ], organizationId, projectId);
    expect(proposals.every((item) => item.confidence === "medium")).toBe(true);
    expect(proposals.every((item) => item.evidence.every((item) => item.confidence === "high"))).toBe(true);
  });

  it("does not create knowledge without minable evidence", () => {
    expect(buildProcessDiscoveryKnowledgeProposals([], organizationId, projectId)).toEqual([]);
    expect(buildProcessDiscoveryKnowledgeProposals([
      event(1, "SystemIndexed", 8, { lifecycleClass: "SYSTEM_EVENT" }),
    ], organizationId, projectId)).toEqual([]);
  });
});
