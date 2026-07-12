// ============================================================================
// P2-T2 round-4 — idempotency fingerprint + scope (pure, no DB)
// ============================================================================
// Locks the TS-side invariants of computeIdempotencyFingerprint + computeDedupKey
// that the SQL RPC relies on for its dedup-hit scope + fingerprint checks:
//   * the dedup_key intentionally does NOT embed the riskId (a reused commandId
//     on another risk collides → detected by the RPC scope check);
//   * the fingerprint is STABLE across a retry (occurredAt / per-attempt
//     attemptRiskId / new memoryItemId / sequence / hash excluded) but CHANGES
//     when the significative request changes (method / scope / reasonCode /
//     logical risk content);
//   * the fingerprint is injected into provenance.idempotency_fingerprint by
//     prepareAtomicEvent ONLY when idempotencyKey is set.
// No DB: pure function contracts.
// ============================================================================

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  prepareAtomicEvent,
  computeDedupKey,
  computeIdempotencyFingerprint,
  type EmitEventInput,
} from "@/lib/events/ingestion";

const ORG = "00000000-0000-0000-0000-000000000001";
const PROJ = "00000000-0000-0000-0000-000000000002";
const RISK_A = "00000000-0000-0000-0000-000000000003";
const RISK_B = "00000000-0000-0000-0000-000000000004";
const USER = "00000000-0000-0000-0000-000000000005";

function assessInput(riskId: string, method: string, occurredAt: string): EmitEventInput {
  return {
    organizationId: ORG,
    projectId: PROJ,
    eventType: "risk_assessed",
    subjectId: riskId,
    actorType: "human",
    actorId: USER,
    sourceModule: "closeout",
    sourceEntityType: "risks",
    sourceEntityId: riskId,
    occurredAt,
    payload: { method, values: { probability: "medium", impact: "high", severity: "high" }, assessed_at: occurredAt },
    objectRefs: [
      { objectType: "risk", objectId: riskId, role: "focal" },
      { objectType: "project", objectId: PROJ, role: "context" },
    ],
  };
}

describe("computeDedupKey — scope does NOT embed riskId (BLOCKER 2)", () => {
  it("same commandId + same project + same type → SAME key regardless of riskId", () => {
    const a = computeDedupKey({ ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"), idempotencyKey: "cmd-1" });
    const b = computeDedupKey({ ...assessInput(RISK_B, "qualitative", "2026-07-12T02:00:00Z"), idempotencyKey: "cmd-1" });
    // Intentional: the key collides so the RPC scope check can DETECT the reuse
    // (a distinct key would let the second event be created silently).
    expect(a).toBe(b);
    expect(a).toBe(createHash("sha256").update(`${PROJ}|risk_assessed|cmd-1`).digest("hex"));
  });

  it("same commandId + different project → DIFFERENT key (independent per scope)", () => {
    const a = computeDedupKey({ ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"), idempotencyKey: "cmd-1" });
    const b = computeDedupKey({ ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"), idempotencyKey: "cmd-1", projectId: "00000000-0000-0000-0000-000000000099" });
    expect(a).not.toBe(b);
  });

  it("same commandId + different event type → DIFFERENT key", () => {
    const a = computeDedupKey({ ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"), idempotencyKey: "cmd-1" });
    const b = computeDedupKey({ ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"), idempotencyKey: "cmd-1", eventType: "risk_materialized" });
    expect(a).not.toBe(b);
  });
});

describe("computeIdempotencyFingerprint — stability + sensitivity (BLOCKER 3)", () => {
  it("is STABLE across a retry: occurredAt + assessed_at + per-attempt riskId excluded", () => {
    const first = computeIdempotencyFingerprint(assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"));
    const retry = computeIdempotencyFingerprint(assessInput(RISK_A, "qualitative", "2026-07-12T09:00:00Z"));
    expect(retry).toBe(first);
  });

  it("CHANGES when the assessment method differs (same commandId, different request)", () => {
    const a = computeIdempotencyFingerprint(assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"));
    const b = computeIdempotencyFingerprint(assessInput(RISK_A, "quantitative", "2026-07-12T01:00:00Z"));
    expect(a).not.toBe(b);
  });

  it("CHANGES when the materialization scope differs", () => {
    const base = (scope: string): EmitEventInput => ({
      organizationId: ORG, projectId: PROJ, eventType: "risk_materialized",
      subjectId: RISK_A, actorType: "human", actorId: USER,
      sourceModule: "closeout", sourceEntityType: "risks", sourceEntityId: RISK_A,
      payload: { materialization_scope: scope },
      objectRefs: [{ objectType: "risk", objectId: RISK_A, role: "focal" }, { objectType: "project", objectId: PROJ, role: "context" }],
    });
    expect(computeIdempotencyFingerprint(base("total"))).not.toBe(computeIdempotencyFingerprint(base("partial")));
  });

  it("CHANGES when the reopen reasonCode differs", () => {
    const base = (reason: string): EmitEventInput => ({
      organizationId: ORG, projectId: PROJ, eventType: "risk_reopened",
      subjectId: RISK_A, actorType: "human", actorId: USER,
      sourceModule: "closeout", sourceEntityType: "risks", sourceEntityId: RISK_A,
      fromState: "resolved", toState: "open",
      payload: { reason_code: reason },
      objectRefs: [{ objectType: "risk", objectId: RISK_A, role: "focal" }, { objectType: "project", objectId: PROJ, role: "context" }],
    });
    expect(computeIdempotencyFingerprint(base("risk_resurfaced"))).not.toBe(computeIdempotencyFingerprint(base("new_information")));
  });

  it("is the SAME for two risks of the same project with the SAME request (riskId excluded)", () => {
    // The riskId is excluded from the fingerprint (it is validated via the RPC
    // scope check). So assess with the same method on risk A and risk B produces
    // the SAME fingerprint — the scope check is what distinguishes them.
    const a = computeIdempotencyFingerprint(assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"));
    const b = computeIdempotencyFingerprint(assessInput(RISK_B, "qualitative", "2026-07-12T01:00:00Z"));
    expect(a).toBe(b);
  });

  it("CHANGES when a non-focal ref differs (e.g. a linked task)", () => {
    const withTask: EmitEventInput = {
      ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"),
      objectRefs: [
        { objectType: "risk", objectId: RISK_A, role: "focal" },
        { objectType: "project", objectId: PROJ, role: "context" },
        { objectType: "task", objectId: "00000000-0000-0000-0000-000000000070", role: "response" },
      ],
    };
    const withOtherTask: EmitEventInput = {
      ...withTask,
      objectRefs: [
        { objectType: "risk", objectId: RISK_A, role: "focal" },
        { objectType: "project", objectId: PROJ, role: "context" },
        { objectType: "task", objectId: "00000000-0000-0000-0000-000000000071", role: "response" },
      ],
    };
    expect(computeIdempotencyFingerprint(withTask)).not.toBe(computeIdempotencyFingerprint(withOtherTask));
  });

  it("is INSENSITIVE to ref order (canonical sort)", () => {
    const a: EmitEventInput = {
      ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"),
      objectRefs: [
        { objectType: "risk", objectId: RISK_A, role: "focal" },
        { objectType: "project", objectId: PROJ, role: "context" },
      ],
    };
    const b: EmitEventInput = {
      ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"),
      objectRefs: [
        { objectType: "project", objectId: PROJ, role: "context" },
        { objectType: "risk", objectId: RISK_A, role: "focal" },
      ],
    };
    expect(computeIdempotencyFingerprint(a)).toBe(computeIdempotencyFingerprint(b));
  });
});

describe("computeIdempotencyFingerprint — risk_registered logical content (BLOCKER 3)", () => {
  const baseRisk = (title: string, category: string): Record<string, unknown> => ({
    title, category, probability: "medium", impact: "medium", severity: "medium",
    status: "open", origin: "ai_suggested",
  });
  const baseInput = (): EmitEventInput => ({
    organizationId: ORG, projectId: PROJ, eventType: "risk_registered",
    subjectId: "attempt-uuid-1", // per-attempt uuid (excluded)
    actorType: "human", actorId: USER,
    sourceModule: "scribe", sourceEntityType: "risks", sourceEntityId: "attempt-uuid-1",
    payload: { origin: "ai_suggested", title: "Risk X" },
    objectRefs: [{ objectType: "risk", objectId: "attempt-uuid-1", role: "focal" }, { objectType: "project", objectId: PROJ, role: "context" }],
  });

  it("is STABLE across a full-capture retry: new attemptRiskId + new memoryItemId excluded", () => {
    const first = computeIdempotencyFingerprint(baseInput(), baseRisk("Risk X", "other"));
    const retryInput: EmitEventInput = {
      ...baseInput(),
      subjectId: "attempt-uuid-2", // new per-attempt uuid
      sourceEntityId: "attempt-uuid-2",
      objectRefs: [{ objectType: "risk", objectId: "attempt-uuid-2", role: "focal" }, { objectType: "project", objectId: PROJ, role: "context" }],
    };
    const retry = computeIdempotencyFingerprint(retryInput, baseRisk("Risk X", "other"));
    expect(retry).toBe(first);
  });

  it("CHANGES when the logical risk content differs (same captureOperationId:item:index)", () => {
    const a = computeIdempotencyFingerprint(baseInput(), baseRisk("Risk X", "other"));
    const b = computeIdempotencyFingerprint(baseInput(), baseRisk("Risk X", "technical"));
    expect(a).not.toBe(b);
  });

  it("CHANGES when the title differs", () => {
    const a = computeIdempotencyFingerprint(baseInput(), baseRisk("Risk A", "other"));
    const b = computeIdempotencyFingerprint(baseInput(), baseRisk("Risk B", "other"));
    expect(a).not.toBe(b);
  });
});

describe("prepareAtomicEvent — fingerprint injection (BLOCKER 3)", () => {
  it("injects provenance.idempotency_fingerprint when idempotencyKey is set", () => {
    const res = prepareAtomicEvent({ ...assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"), idempotencyKey: "cmd-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const prov = res.data.event.provenance as Record<string, unknown>;
    expect(typeof prov.idempotency_fingerprint).toBe("string");
    expect(prov.idempotency_fingerprint).toBe(
      computeIdempotencyFingerprint(assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z")),
    );
  });

  it("does NOT inject a fingerprint when idempotencyKey is absent (legacy path untouched)", () => {
    const res = prepareAtomicEvent(assessInput(RISK_A, "qualitative", "2026-07-12T01:00:00Z"));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const prov = res.data.event.provenance as Record<string, unknown>;
    expect(prov.idempotency_fingerprint).toBeUndefined();
  });
});