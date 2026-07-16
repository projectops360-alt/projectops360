import { describe, expect, it } from "vitest";
import { createGovernanceAuditRecord, validateGovernanceAuditChain } from "../audit";
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
