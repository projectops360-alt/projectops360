import { describe, expect, it } from "vitest";
import { createGovernanceAuditRecord, validateGovernanceAuditChain } from "../audit";
import { authorizePlatformAccess } from "../security";
import type { TrustedPlatformSession } from "../types";
import { denverDataCenter, projectManagerSession } from "./fixtures";

describe("P8-T3B governance auditability", () => {
  it("creates a sanitized append-only audit chain for realistic access decisions", () => {
    const first = createGovernanceAuditRecord({
      eventId: "access:commissioning-email:1",
      eventType: "access_allowed",
      organizationId: denverDataCenter.organizationId,
      projectId: denverDataCenter.projectId,
      actorId: projectManagerSession.actorId,
      actorType: projectManagerSession.actorType,
      actorRole: projectManagerSession.actorRole,
      purpose: "Prepare the commissioning readiness review.",
      policyVersion: "1.0.0",
      decision: "allowed",
      reasonCodes: ["scope_matched"],
      evidenceRefs: ["communication:owner-email-2026-07-14"],
      metadata: {
        sourceType: "email",
        senderDomain: "owner.example",
        body: "Raw email content must never enter the audit record.",
        nested: { access_token: "secret", retained: "message-42" },
      },
      occurredAt: "2026-07-15T14:00:00Z",
    }, 1, null);
    const second = createGovernanceAuditRecord({
      eventId: "policy:knowledge-proposal:2",
      eventType: "policy_evaluated",
      organizationId: denverDataCenter.organizationId,
      projectId: denverDataCenter.projectId,
      actorId: "isabella",
      actorType: "ai",
      actorRole: "service",
      purpose: "Propose a candidate lesson for human review.",
      policyVersion: "1.0.0",
      decision: "allowed",
      reasonCodes: ["advisory_only", "human_review_required"],
      evidenceRefs: ["communication:owner-email-2026-07-14", "task:commissioning-checklist"],
      metadata: { candidateType: "lesson_learned", payload: { raw: true } },
      occurredAt: "2026-07-15T14:02:00Z",
    }, 2, first.recordHash);

    expect(first.metadata).toEqual({ sourceType: "email", senderDomain: "owner.example", nested: { retained: "message-42" } });
    expect(second.metadata).toEqual({ candidateType: "lesson_learned" });
    expect(validateGovernanceAuditChain([first, second])).toEqual({ valid: true, violations: [], checkedRecords: 2 });
  });

  it("detects tampering and cross-organization chain contamination", () => {
    const first = createGovernanceAuditRecord({
      eventId: "event-1",
      eventType: "access_denied",
      organizationId: denverDataCenter.organizationId,
      actorId: projectManagerSession.actorId,
      actorType: "human",
      actorRole: "admin",
      purpose: "Reject an out-of-scope request.",
      policyVersion: "1.0.0",
      decision: "denied",
      reasonCodes: ["cross_organization"],
      evidenceRefs: [],
      occurredAt: "2026-07-15T14:10:00Z",
    }, 1, null);
    const second = createGovernanceAuditRecord({
      eventId: "event-2",
      eventType: "access_allowed",
      organizationId: "22222222-2222-4222-8222-222222222222",
      actorId: projectManagerSession.actorId,
      actorType: "human",
      actorRole: "admin",
      purpose: "Contaminated chain record.",
      policyVersion: "1.0.0",
      decision: "allowed",
      reasonCodes: [],
      evidenceRefs: [],
      occurredAt: "2026-07-15T14:11:00Z",
    }, 2, first.recordHash);
    const tampered = { ...first, purpose: "Changed after recording." };
    const result = validateGovernanceAuditChain([tampered, second]);
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      "record_hash_mismatch:event-1",
      "cross_organization_chain:event-2",
    ]));
  });
});

// ── REG-034 ─────────────────────────────────────────────────────────────────
describe("REG-034 — an actor with no role", () => {
  /**
   * `none` exists so a refusal by somebody with no standing in the organization
   * can be RECORDED. Before it existed the governance audit rejected the row,
   * the insert raised, and the exception discarded both the audit record and the
   * caller's answer — losing exactly the denial that matters most.
   */
  it("is denied every operation, reads included", () => {
    const stranger: TrustedPlatformSession = {
      ...projectManagerSession,
      actorRole: "none",
      capabilities: [...projectManagerSession.capabilities],
    };
    for (const operation of ["read", "analyze", "propose", "mutate", "approve", "export"] as const) {
      const decision = authorizePlatformAccess(stranger, {
        operation,
        purpose: "checking that no role grants nothing",
        resource: {
          organizationId: stranger.organizationId,
          projectId: null,
          resourceKind: "governance_audit",
          sensitivity: "internal",
          containsRawPayload: false,
        },
      });
      expect(decision.allowed, operation).toBe(false);
      expect(decision.denialReasons).toContain("actor_without_role");
    }
  });

  it("does not weaken any existing role", () => {
    const decision = authorizePlatformAccess(projectManagerSession, {
      operation: "read",
      purpose: "regression guard: widening the vocabulary must grant nothing new",
      resource: {
        organizationId: projectManagerSession.organizationId,
        projectId: null,
        resourceKind: "governance_audit",
        sensitivity: "internal",
        containsRawPayload: false,
      },
    });
    expect(decision.denialReasons).not.toContain("actor_without_role");
  });
});
