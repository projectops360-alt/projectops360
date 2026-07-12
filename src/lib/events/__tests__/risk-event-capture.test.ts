// ============================================================================
// P2-T2 — Risk event capture guards (PD-018; RISK-EVENT-CAPTURE)
// ============================================================================
// Contract tests for the pilot: flag boundary (default OFF), canonical type
// payload invariants (RI-02, RI-07, resolution #11), deprecated legacy types,
// read-time alias map, object_refs validation, builder flags, dedup stability.
// DB-level guarantees (RLS mirror on project_event_objects, FK cascade) are
// enforced by migration 20260844000000_project_event_objects.sql.
// ============================================================================

import { describe, it, expect } from "vitest";
import { validateProjectEvent, computeDedupKey, type EmitEventInput } from "@/lib/events/ingestion";
import {
  CLOSURE_REASONS,
  DEPRECATED_EVENT_TYPES,
  LEGACY_RISK_EVENT_ALIASES,
  resolveCanonicalEventType,
  isPastTenseName,
  EVENT_REGISTRY,
} from "@/lib/events/registry";
import { isRiskEventCaptureEnabledFor } from "@/lib/events/risk-capture-flag";
import {
  buildRiskRegistered,
  buildRiskAssessed,
  buildRiskOwnerEvent,
  buildRiskClosed,
  buildRiskReopened,
  buildRiskMaterialized,
  type RiskRefInput,
} from "@/lib/events/risk-events";

const ORG = "11111111-1111-1111-1111-111111111111";
const PROJ = "22222222-2222-2222-2222-222222222222";
const RISK = "44444444-4444-4444-4444-444444444444";
const TASK = "55555555-5555-5555-5555-555555555555";
const USER = "66666666-6666-6666-6666-666666666666";

const risk: RiskRefInput = { riskId: RISK, organizationId: ORG, projectId: PROJ, linkedTaskId: TASK };

// ── Feature flag boundary (default OFF) ──────────────────────────────────────

describe("risk capture flag (per-project, default OFF)", () => {
  it("is OFF when the env value is empty, undefined, or whitespace", () => {
    expect(isRiskEventCaptureEnabledFor(PROJ, "")).toBe(false);
    expect(isRiskEventCaptureEnabledFor(PROJ, undefined)).toBe(false);
    expect(isRiskEventCaptureEnabledFor(PROJ, "   ")).toBe(false);
  });
  it("is ON only for listed pilot projects", () => {
    expect(isRiskEventCaptureEnabledFor(PROJ, `${PROJ}`)).toBe(true);
    expect(isRiskEventCaptureEnabledFor(PROJ, ` other , ${PROJ} `)).toBe(true);
    expect(isRiskEventCaptureEnabledFor(PROJ, "other-project")).toBe(false);
  });
  it("supports the literal 'all' (local testing)", () => {
    expect(isRiskEventCaptureEnabledFor(PROJ, "all")).toBe(true);
  });
  it("never enables an empty project id", () => {
    expect(isRiskEventCaptureEnabledFor("", "all")).toBe(false);
  });
});

// ── Canonical snake_case types (naming + payload invariants) ─────────────────

describe("canonical risk pilot types", () => {
  const pilotTypes = [
    "risk_registered", "risk_assessed", "risk_owner_assigned", "risk_owner_changed",
    "risk_response_plan_approved", "risk_closure_requested", "risk_closure_validated",
    "risk_closed", "risk_reopened", "risk_materialized",
    "risk_response_action_created", "risk_response_started", "risk_response_action_completed",
  ];

  it("all pilot types are registered, snake_case, past-tense, category risk", () => {
    for (const t of pilotTypes) {
      expect(EVENT_REGISTRY[t], `${t} must be registered`).toBeDefined();
      expect(isPastTenseName(t), `${t} must read as past tense`).toBe(true);
      expect(EVENT_REGISTRY[t].category).toBe("risk");
    }
  });

  it("RI-02: risk_assessed rejects missing method/values/assessed_at", () => {
    const r = validateProjectEvent({
      organizationId: ORG, projectId: PROJ, eventType: "risk_assessed",
      subjectId: RISK, actorType: "human", sourceModule: "closeout",
      sourceEntityId: RISK, payload: { method: "qualitative" },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/payload\.values is required/);
    expect(r.errors.join(" ")).toMatch(/payload\.assessed_at is required/);
  });

  it("resolution #11: risk_closed rejects a missing closure_reason", () => {
    const r = validateProjectEvent({
      organizationId: ORG, projectId: PROJ, eventType: "risk_closed",
      subjectId: RISK, actorType: "human", sourceModule: "closeout",
      sourceEntityId: RISK, payload: {},
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/payload\.closure_reason is required/);
  });

  it("RI-07: risk_reopened rejects a missing reason_code", () => {
    const r = validateProjectEvent({
      organizationId: ORG, projectId: PROJ, eventType: "risk_reopened",
      subjectId: RISK, actorType: "human", sourceModule: "closeout",
      sourceEntityId: RISK, payload: {},
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/payload\.reason_code is required/);
  });

  it("object_refs must be complete triples", () => {
    const r = validateProjectEvent({
      organizationId: ORG, projectId: PROJ, eventType: "risk_registered",
      subjectId: RISK, actorType: "human", sourceModule: "risks",
      sourceEntityId: RISK, payload: { origin: "manual" },
      objectRefs: [{ objectType: "risk", objectId: "", role: "focal" }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/object_refs\[0\]/);
  });
});

// ── Deprecated legacy types + read-time alias map (PD-018 §A.4) ──────────────

describe("legacy PascalCase risk types", () => {
  it("all five are deprecated for NEW emissions", () => {
    for (const legacy of ["RiskIdentified", "RiskEscalated", "RiskMitigated", "RiskMaterialized", "RiskClosed"]) {
      expect(DEPRECATED_EVENT_TYPES.has(legacy)).toBe(true);
      const r = validateProjectEvent({
        organizationId: ORG, projectId: PROJ, eventType: legacy,
        subjectId: RISK, actorType: "human", sourceModule: "risks",
        sourceEntityId: RISK, payload: { severity: "high" },
      });
      expect(r.ok, `${legacy} must be rejected`).toBe(false);
      expect(r.errors.join(" ")).toMatch(/deprecated/);
    }
  });

  it("read-time aliases resolve to canonical types (history never rewritten)", () => {
    expect(resolveCanonicalEventType("RiskIdentified").canonical).toBe("risk_registered");
    expect(resolveCanonicalEventType("RiskEscalated").canonical).toBe("risk_escalated");
    expect(resolveCanonicalEventType("RiskMaterialized").canonical).toBe("risk_materialized");
    expect(resolveCanonicalEventType("RiskClosed").canonical).toBe("risk_closed");
    expect(resolveCanonicalEventType("RiskClosed").dataQualityFlags).toContain("unknown_reason");
    expect(resolveCanonicalEventType("risk_registered").isLegacyAlias).toBe(false);
  });

  it("RiskMitigated projects conservatively with the ambiguity flag", () => {
    const r = resolveCanonicalEventType("RiskMitigated");
    expect(r.canonical).toBe("risk_response_action_completed");
    expect(r.dataQualityFlags).toContain("legacy_ambiguous_semantics");
  });

  it("every alias target lives in the frozen 24-event vocabulary names", () => {
    for (const { canonical } of Object.values(LEGACY_RISK_EVENT_ALIASES)) {
      expect(canonical).toMatch(/^risk_[a-z_]+$/);
    }
  });
});

// ── Builders (writers' single emission surface) ──────────────────────────────

describe("risk event builders", () => {
  it("risk_registered: imported capture carries the imported flag; system actor never flags missing_actor", () => {
    const imported = buildRiskRegistered({
      risk, actor: { actorType: "human", actorId: USER }, captureMethod: "imported",
      origin: "import", sourceModule: "import-intelligence",
    });
    expect((imported.provenance as { data_quality_flags?: string[] }).data_quality_flags).toContain("imported");
    expect(validateProjectEvent(imported).ok).toBe(true);

    const anonymous = buildRiskRegistered({
      risk, actor: { actorType: "human" }, captureMethod: "direct",
      origin: "manual", sourceModule: "risks",
    });
    expect((anonymous.provenance as { data_quality_flags?: string[] }).data_quality_flags).toContain("missing_actor");
  });

  it("risk_registered object_refs: focal risk + project context + linked task response", () => {
    const e = buildRiskRegistered({
      risk, actor: { actorType: "human", actorId: USER }, captureMethod: "direct",
      origin: "manual", sourceModule: "risks",
    });
    const refs = e.objectRefs ?? [];
    expect(refs).toContainEqual({ objectType: "risk", objectId: RISK, role: "focal" });
    expect(refs).toContainEqual({ objectType: "project", objectId: PROJ, role: "context" });
    expect(refs).toContainEqual({ objectType: "task", objectId: TASK, role: "response" });
  });

  it("risk_closed: always unvalidated_closure today; closeout adds bulk_closure; reason is canonical", () => {
    const e = buildRiskClosed({
      risk, actor: { actorType: "human", actorId: USER }, sourceModule: "closeout",
      closureReason: "accepted", viaCloseout: true,
    });
    const flags = (e.provenance as { data_quality_flags?: string[] }).data_quality_flags ?? [];
    expect(flags).toContain("unvalidated_closure");
    expect(flags).toContain("bulk_closure");
    expect(CLOSURE_REASONS).toContain((e.payload as { closure_reason: string }).closure_reason);
    expect(validateProjectEvent(e).ok).toBe(true);

    const direct = buildRiskClosed({
      risk, actor: { actorType: "human", actorId: USER }, sourceModule: "risks",
      closureReason: "mitigated", viaCloseout: false,
    });
    const directFlags = (direct.provenance as { data_quality_flags?: string[] }).data_quality_flags ?? [];
    expect(directFlags).toContain("unvalidated_closure");
    expect(directFlags).not.toContain("bulk_closure");
  });

  it("risk_reopened: flags missing_prior_closure only when no prior closure event exists", () => {
    const withPrior = buildRiskReopened({
      risk, actor: { actorType: "human", actorId: USER }, sourceModule: "closeout",
      reasonCode: "closure_invalidated", priorClosureEventId: "77777777-7777-7777-7777-777777777777",
      fromState: "closed", toState: "open",
    });
    expect((withPrior.provenance as { data_quality_flags?: string[] }).data_quality_flags).toBeUndefined();
    expect(withPrior.causedBy).toEqual(["77777777-7777-7777-7777-777777777777"]);

    const without = buildRiskReopened({
      risk, actor: { actorType: "human", actorId: USER }, sourceModule: "closeout",
      reasonCode: "closure_invalidated", fromState: "closed", toState: "open",
    });
    expect((without.provenance as { data_quality_flags?: string[] }).data_quality_flags).toContain("missing_prior_closure");
    expect(validateProjectEvent(without).ok).toBe(true);
  });

  it("risk_materialized records the RI-06 interim exception (no Issue/Blocker target yet)", () => {
    const e = buildRiskMaterialized({
      risk, actor: { actorType: "human", actorId: USER }, sourceModule: "closeout",
      materializationScope: "partial", impactNote: "install milestone slipped",
    });
    expect((e.provenance as { ri06_interim_exception?: boolean }).ri06_interim_exception).toBe(true);
    expect((e.payload as { materialization_scope: string }).materialization_scope).toBe("partial");
    expect(validateProjectEvent(e).ok).toBe(true);
  });

  it("owner builder picks assigned vs changed by the presence of a previous owner", () => {
    const assigned = buildRiskOwnerEvent({
      risk, actor: { actorType: "human", actorId: USER }, sourceModule: "risks", newOwner: USER,
    });
    expect(assigned.eventType).toBe("risk_owner_assigned");
    const changed = buildRiskOwnerEvent({
      risk, actor: { actorType: "human", actorId: USER }, sourceModule: "risks",
      newOwner: USER, previousOwner: "88888888-8888-8888-8888-888888888888",
    });
    expect(changed.eventType).toBe("risk_owner_changed");
    expect((changed.payload as { previous_owner?: string }).previous_owner).toBeDefined();
    expect(validateProjectEvent(changed).ok).toBe(true);
  });

  it("risk_assessed builder satisfies RI-02 and validates", () => {
    const e = buildRiskAssessed({
      risk, actor: { actorType: "human", actorId: USER }, sourceModule: "closeout",
      method: "probability_impact_matrix",
      values: { probability: "medium", impact: "high", severity: "high" },
      assessedAt: "2026-07-11T12:00:00.000Z",
    });
    expect(validateProjectEvent(e).ok).toBe(true);
  });

  it("dedup is stable: the same builder input yields the same dedup key (idempotent re-emission)", () => {
    const a = buildRiskRegistered({
      risk, actor: { actorType: "human", actorId: USER }, captureMethod: "direct",
      origin: "manual", sourceModule: "risks",
    });
    const withTime: EmitEventInput = { ...a, occurredAt: "2026-07-11T12:00:00.000Z" };
    expect(computeDedupKey(withTime)).toBe(computeDedupKey({ ...withTime }));
  });
});
