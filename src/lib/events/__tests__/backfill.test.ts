// ============================================================================
// Phase 2 — Historical Backfill Service guards
// ============================================================================
// Backfilled events are marked (SYNTHETIC_BACKFILL_EVENT + provenance.backfilled),
// carry reduced confidence when inferred, pass registry validation, are
// idempotent (stable dedup key with a backfill marker distinct from live events),
// and never invent risky transitions (no TaskStarted/BlockerRaised).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  mapTaskToEvents, mapMilestoneToEvents, mapDependencyToEvents,
  BACKFILL_CONFIDENCE,
} from "@/lib/events/backfill";
import { validateProjectEvent, computeDedupKey } from "@/lib/events/ingestion";

const ORG = "11111111-1111-1111-1111-111111111111";
const PROJ = "22222222-2222-2222-2222-222222222222";
const T = "33333333-3333-3333-3333-333333333333";
const B = "batch-1";

const taskRow = {
  id: T, organization_id: ORG, project_id: PROJ,
  created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-10T00:00:00Z",
  status: "done", assigned_to: "44444444-4444-4444-4444-444444444444", title: "Ship it",
};

describe("task backfill mappers", () => {
  const events = mapTaskToEvents(taskRow, B);

  it("emits TaskCreated (explicit, high confidence) marked as synthetic backfill", () => {
    const created = events.find((e) => e.eventType === "TaskCreated")!;
    expect(created.lifecycleClassOverride).toBe("SYNTHETIC_BACKFILL_EVENT");
    expect(created.confidence).toBe(BACKFILL_CONFIDENCE.OWNER_TIMESTAMP);
    expect((created.provenance as { backfilled?: boolean }).backfilled).toBe(true);
    expect((created.provenance as { source_table?: string }).source_table).toBe("roadmap_tasks");
    expect(created.occurredAt).toBe("2026-06-01T00:00:00Z"); // preserves business time
  });

  it("emits TaskAssigned and TaskCompleted as INFERRED (lower confidence)", () => {
    const assigned = events.find((e) => e.eventType === "TaskAssigned")!;
    const completed = events.find((e) => e.eventType === "TaskCompleted")!;
    expect(assigned.confidence).toBe(BACKFILL_CONFIDENCE.INFERRED_CURRENT_STATE);
    expect(completed.confidence).toBe(BACKFILL_CONFIDENCE.INFERRED_CURRENT_STATE);
    expect(assigned.confidence).toBeLessThan(BACKFILL_CONFIDENCE.OWNER_TIMESTAMP);
  });

  it("does NOT invent risky transitions (no TaskStarted / BlockerRaised)", () => {
    const types = events.map((e) => e.eventType);
    expect(types).not.toContain("TaskStarted");
    expect(types).not.toContain("TaskPaused");
    expect(types).not.toContain("BlockerRaised");
  });

  it("every backfilled event passes registry/governance validation", () => {
    for (const e of events) expect(validateProjectEvent(e).ok, e.eventType).toBe(true);
  });

  it("a non-terminal task with no assignee only backfills TaskCreated", () => {
    const evs = mapTaskToEvents({ ...taskRow, status: "in_progress", assigned_to: null }, B);
    expect(evs.map((e) => e.eventType)).toEqual(["TaskCreated"]);
  });
});

describe("milestone backfill mapper", () => {
  it("emits MilestoneAchieved only for completed milestones", () => {
    const done = mapMilestoneToEvents({ id: "m1", organization_id: ORG, project_id: PROJ, created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-05T00:00:00Z", status: "completed" }, B);
    expect(done.map((e) => e.eventType)).toContain("MilestoneAchieved");
    const open = mapMilestoneToEvents({ id: "m2", organization_id: ORG, project_id: PROJ, created_at: "2026-06-01T00:00:00Z", status: "in_progress" }, B);
    expect(open.map((e) => e.eventType)).toEqual(["MilestoneCreated"]);
  });
});

describe("backfill governance guards", () => {
  it("rejects a synthetic backfill event without provenance.backfilled or confidence", () => {
    const created = mapTaskToEvents(taskRow, B).find((e) => e.eventType === "TaskCreated")!;
    expect(validateProjectEvent({ ...created, provenance: {} }).ok).toBe(false);
    expect(validateProjectEvent({ ...created, confidence: undefined }).ok).toBe(false);
  });

  it("dependency backfill sets subject to the successor and payload.dependency_id to the predecessor", () => {
    const [dep] = mapDependencyToEvents({ id: "d1", organization_id: ORG, project_id: PROJ, predecessor_id: "pre", successor_id: "suc", created_at: "2026-06-02T00:00:00Z" }, B);
    expect(dep.subjectId).toBe("suc");
    expect((dep.payload as { dependency_id?: string }).dependency_id).toBe("pre");
  });
});

describe("idempotency", () => {
  it("dedup key is stable across runs and distinct from a live event", () => {
    const created = mapTaskToEvents(taskRow, B).find((e) => e.eventType === "TaskCreated")!;
    const createdOtherBatch = mapTaskToEvents(taskRow, "batch-2").find((e) => e.eventType === "TaskCreated")!;
    // Same source record → same dedup key regardless of batch id (idempotent re-run).
    expect(computeDedupKey(created)).toBe(computeDedupKey(createdOtherBatch));
    // A live (non-backfill) event of the same shape has a DIFFERENT key (backfill marker).
    const live = { ...created, lifecycleClassOverride: undefined };
    expect(computeDedupKey(created)).not.toBe(computeDedupKey(live));
  });
});
