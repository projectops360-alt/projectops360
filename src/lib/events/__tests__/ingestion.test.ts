// ============================================================================
// Phase 2 — Event Ingestion Service guards (validation, taxonomy, idempotency)
// ============================================================================
// Protects the single controlled write path into project_event_log: only
// registered past-tense events, required payload, evidence for HIGH/CRITICAL,
// provenance+confidence for AI events, no UI telemetry, stable dedup, and
// deterministic projection-invalidation tags. DB-level guarantees (monotonic
// sequence, immutability, unique dedup) are enforced by the migration.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  validateProjectEvent,
  normalizeProjectEvent,
  generateProjectionInvalidationTags,
  computeDedupKey,
  type EmitEventInput,
} from "@/lib/events/ingestion";
import { EVENT_REGISTRY, isPastTenseName } from "@/lib/events/registry";

const ORG = "11111111-1111-1111-1111-111111111111";
const PROJ = "22222222-2222-2222-2222-222222222222";
const SUB = "33333333-3333-3333-3333-333333333333";

function valid(overrides: Partial<EmitEventInput> = {}): EmitEventInput {
  return {
    organizationId: ORG,
    projectId: PROJ,
    eventType: "TaskCreated",
    subjectId: SUB,
    actorType: "human",
    sourceModule: "roadmap",
    payload: { title: "Do the thing" },
    ...overrides,
  };
}

describe("registry hygiene (Canonical Event Taxonomy)", () => {
  it("every registered event is a past-tense name with a category and importance", () => {
    for (const [type, def] of Object.entries(EVENT_REGISTRY)) {
      expect(isPastTenseName(type), `${type} must be past tense`).toBe(true);
      expect(def.category.length).toBeGreaterThan(0);
      expect(["LOW", "NORMAL", "HIGH", "CRITICAL"]).toContain(def.importance);
    }
  });

  it("accepts good past-tense names and rejects imperative ones", () => {
    for (const ok of ["TaskCreated", "ApprovalGranted", "RiskEscalated", "MilestoneAchieved", "DecisionMade"]) {
      expect(isPastTenseName(ok)).toBe(true);
    }
    for (const bad of ["CreateTask", "UpdateTask", "HandleRisk", "ApprovalStatus"]) {
      expect(isPastTenseName(bad)).toBe(false);
    }
  });
});

describe("validateProjectEvent", () => {
  it("accepts a valid registered event", () => {
    expect(validateProjectEvent(valid()).ok).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const r = validateProjectEvent(valid({ eventType: "TaskFrobnicated" }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/not in the Canonical Event Taxonomy/);
  });

  it("rejects an EPHEMERAL_EXCLUDED event (no UI telemetry in the log)", () => {
    const r = validateProjectEvent(valid({ eventType: "MouseMoved" }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/EPHEMERAL_EXCLUDED/);
  });

  it("rejects a missing required payload field", () => {
    const r = validateProjectEvent(valid({ payload: {} })); // TaskCreated needs title
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/payload\.title is required/);
  });

  it("rejects payload that duplicates an envelope field", () => {
    const r = validateProjectEvent(valid({ payload: { title: "x", project_id: PROJ } }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/duplicates an envelope field/);
  });

  it("rejects a HIGH/CRITICAL event without evidence", () => {
    // RiskIdentified is HIGH and needs severity; provide payload but no evidence.
    const r = validateProjectEvent({
      organizationId: ORG, projectId: PROJ, eventType: "RiskIdentified",
      subjectId: SUB, actorType: "human", sourceModule: "risks",
      payload: { severity: "high" },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/requires evidence/);
  });

  it("accepts a HIGH event once evidence is present (source_entity_id)", () => {
    const r = validateProjectEvent({
      organizationId: ORG, projectId: PROJ, eventType: "RiskIdentified",
      subjectId: SUB, actorType: "human", sourceModule: "risks",
      sourceEntityId: SUB, payload: { severity: "high" },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects an AI event without provenance and confidence", () => {
    const r = validateProjectEvent({
      organizationId: ORG, projectId: PROJ, eventType: "IsabellaRecommendationGenerated",
      subjectId: SUB, actorType: "ai", sourceModule: "isabella", payload: {},
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/requires provenance/);
    expect(r.errors.join(" ")).toMatch(/requires confidence/);
  });

  it("rejects a compensating event without a reference", () => {
    const r = validateProjectEvent(valid({ isCompensatingEvent: true }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/must reference compensates_event_id/);
  });

  it("requires a valid actor_type", () => {
    const r = validateProjectEvent(valid({ actorType: "robot" as never }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/actor_type is invalid/);
  });
});

describe("normalizeProjectEvent", () => {
  it("fills importance, lifecycle class, schema version and category from the registry", () => {
    const row = normalizeProjectEvent(valid());
    expect(row.event_importance).toBe("NORMAL");
    expect(row.event_lifecycle_class).toBe("BUSINESS_EVENT");
    expect(row.event_schema_version).toBe(1);
    expect(row.event_category).toBe("task");
    expect(row.case_id).toBe(PROJ); // defaults to project
  });

  it("records an authorized importance override in provenance", () => {
    const row = normalizeProjectEvent(valid({ importanceOverride: "HIGH", sourceEntityId: SUB }));
    expect(row.event_importance).toBe("HIGH");
    expect((row.provenance as { importanceOverride?: string }).importanceOverride).toBe("HIGH");
  });
});

describe("projection invalidation tags", () => {
  it("generates project / subject / scope tags deterministically", () => {
    const tags = generateProjectionInvalidationTags(valid({ eventType: "TaskStatusChanged" }));
    expect(tags).toContain(`project:${PROJ}`);
    expect(tags).toContain(`case:${PROJ}`);
    expect(tags).toContain(`subject:task:${SUB}`);
    expect(tags).toContain("scope:schedule");
  });
});

describe("idempotency dedup key", () => {
  it("is stable for identical input and null for compensating events", () => {
    const a = computeDedupKey(valid({ occurredAt: "2026-07-02T00:00:00Z" }));
    const b = computeDedupKey(valid({ occurredAt: "2026-07-02T00:00:00Z" }));
    expect(a).toBe(b);
    expect(a).not.toBeNull();
    expect(computeDedupKey(valid({ isCompensatingEvent: true }))).toBeNull();
  });
});
