import { describe, expect, it } from "vitest";
import { authorizePlatformAccess } from "../security";
import {
  denverDataCenter,
  isabellaSession,
  ownerEmailThread,
  phoenixHospital,
  projectManagerSession,
} from "./fixtures";

describe("P8-T3A platform security and tenant isolation", () => {
  it("allows an authorized project manager to read scoped communication", () => {
    const decision = authorizePlatformAccess(projectManagerSession, {
      operation: "read",
      purpose: "Review owner commitments before the commissioning meeting.",
      resource: ownerEmailThread,
      requiredCapability: "communications:read",
    });
    expect(decision.allowed).toBe(true);
    expect(decision.effectiveScope).toEqual({
      organizationId: denverDataCenter.organizationId,
      projectId: denverDataCenter.projectId,
    });
    expect(decision.obligations).toEqual(expect.arrayContaining(["redact_sensitive_fields", "record_access_purpose"]));
  });

  it("rejects cross-organization access without disclosing the resource", () => {
    const decision = authorizePlatformAccess(projectManagerSession, {
      operation: "read",
      purpose: "Read another portfolio project.",
      resource: {
        organizationId: phoenixHospital.organizationId,
        projectId: phoenixHospital.projectId,
        resourceKind: "project_data",
        sensitivity: "internal",
        containsRawPayload: false,
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.denialReasons).toEqual(expect.arrayContaining(["cross_organization", "project_out_of_scope"]));
  });

  it("never exposes raw communication payloads to an AI actor", () => {
    const decision = authorizePlatformAccess(isabellaSession, {
      operation: "analyze",
      purpose: "Extract candidate commitments for human review.",
      resource: ownerEmailThread,
      requiredCapability: "communications:analyze",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.denialReasons).toContain("ai_raw_payload_forbidden");
    expect(decision.obligations).toContain("provide_sanitized_evidence_only");
  });

  it("forbids AI approval and mutation even with a matching scope", () => {
    for (const operation of ["approve", "mutate"] as const) {
      const decision = authorizePlatformAccess(isabellaSession, {
        operation,
        purpose: "Attempt an automated governance transition.",
        resource: {
          organizationId: denverDataCenter.organizationId,
          projectId: denverDataCenter.projectId,
          resourceKind: "knowledge",
          sensitivity: "internal",
          containsRawPayload: false,
        },
      });
      expect(decision.allowed).toBe(false);
      expect(decision.denialReasons).toContain(operation === "approve" ? "human_approval_required" : "ai_mutation_forbidden");
    }
  });
});
