// ============================================================================
// P2-T2 — Risk backfill guards (PD-018 §B.4: the ONLY authorized reconstruction)
// ============================================================================
// mapRiskToEvents may reconstruct risk_registered ONLY — never transitions
// (frozen guardrail: no invented history). Actors are recovered exclusively
// via the Scribe/import chains; otherwise missing_actor. Idempotence comes
// from the stable dedup key with the backfill marker.
// ============================================================================

import { describe, it, expect } from "vitest";
import { mapRiskToEvents, BACKFILL_CONFIDENCE } from "@/lib/events/backfill";
import { validateProjectEvent, computeDedupKey } from "@/lib/events/ingestion";

const ORG = "11111111-1111-1111-1111-111111111111";
const PROJ = "22222222-2222-2222-2222-222222222222";
const RISK = "44444444-4444-4444-4444-444444444444";
const USER = "66666666-6666-6666-6666-666666666666";
const BATCH = "batch-001";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: RISK,
    organization_id: ORG,
    project_id: PROJ,
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-10T09:00:00.000Z",
    origin: "manual",
    title: "Vendor SDK deprecation",
    linked_task_id: null,
    linked_milestone_id: null,
    ...overrides,
  };
}

describe("mapRiskToEvents (risk_registered only)", () => {
  it("emits exactly one risk_registered per risk — never any transition", () => {
    const events = mapRiskToEvents(row({ status: "closed" } as never), BATCH, null);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("risk_registered");
    // Even a terminal current status reconstructs NOTHING beyond registration.
    expect(events.map((e) => e.eventType)).not.toContain("risk_closed");
  });

  it("emits nothing without created_at (no invented timestamps)", () => {
    expect(mapRiskToEvents(row({ created_at: null }), BATCH, null)).toHaveLength(0);
  });

  it("marks synthetic backfill with reduced-not-invented confidence and flags", () => {
    const [e] = mapRiskToEvents(row(), BATCH, null);
    expect(e.lifecycleClassOverride).toBe("SYNTHETIC_BACKFILL_EVENT");
    expect(e.confidence).toBe(BACKFILL_CONFIDENCE.OWNER_TIMESTAMP);
    const prov = e.provenance as { backfilled?: boolean; data_quality_flags?: string[] };
    expect(prov.backfilled).toBe(true);
    expect(prov.data_quality_flags).toContain("backfilled");
    expect(e.occurredAt).toBe("2026-07-01T09:00:00.000Z");
    expect(validateProjectEvent(e).ok).toBe(true);
  });

  it("never invents an actor: missing_actor without a chain hint; recovered actor is recorded with its source", () => {
    const [anonymous] = mapRiskToEvents(row(), BATCH, null);
    expect(anonymous.actorId).toBeNull();
    expect((anonymous.provenance as { data_quality_flags?: string[] }).data_quality_flags).toContain("missing_actor");

    const [recovered] = mapRiskToEvents(row(), BATCH, { actorId: USER, source: "scribe" });
    expect(recovered.actorId).toBe(USER);
    expect((recovered.provenance as { data_quality_flags?: string[] }).data_quality_flags).not.toContain("missing_actor");
    expect((recovered.provenance as { actor_recovered_via?: string }).actor_recovered_via).toBe("scribe");
  });

  it("carries object refs (focal + context + linked objects when present)", () => {
    const [e] = mapRiskToEvents(
      row({ linked_task_id: "55555555-5555-5555-5555-555555555555", linked_milestone_id: "77777777-7777-7777-7777-777777777777" }),
      BATCH, null,
    );
    const refs = e.objectRefs ?? [];
    expect(refs).toContainEqual({ objectType: "risk", objectId: RISK, role: "focal" });
    expect(refs).toContainEqual({ objectType: "project", objectId: PROJ, role: "context" });
    expect(refs).toContainEqual({ objectType: "milestone", objectId: "77777777-7777-7777-7777-777777777777", role: "impacted" });
    expect(refs).toContainEqual({ objectType: "task", objectId: "55555555-5555-5555-5555-555555555555", role: "response" });
  });

  it("is idempotent: re-running the mapper yields the same dedup key (re-executable backfill)", () => {
    const [a] = mapRiskToEvents(row(), BATCH, null);
    const [b] = mapRiskToEvents(row(), BATCH, null);
    expect(computeDedupKey(a)).toBe(computeDedupKey(b));
    // The backfill marker keeps synthetic history distinct from live capture.
    const live = { ...a, lifecycleClassOverride: undefined };
    expect(computeDedupKey(live)).not.toBe(computeDedupKey(a));
  });
});
