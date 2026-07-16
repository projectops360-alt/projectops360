import type {
  PlatformAccessDecision,
  PlatformAccessDenialReason,
  PlatformAccessRequest,
  TrustedPlatformSession,
} from "./types";

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

export function authorizePlatformAccess(
  session: TrustedPlatformSession,
  request: PlatformAccessRequest,
): PlatformAccessDecision {
  const denialReasons: PlatformAccessDenialReason[] = [];
  const obligations: string[] = ["audit_access_decision", "minimize_returned_fields"];

  if (!session.active) denialReasons.push("inactive_session");
  if (request.purpose.trim().length < 3) denialReasons.push("missing_purpose");
  if (request.resource.organizationId !== session.organizationId) denialReasons.push("cross_organization");
  if (request.resource.projectId && !session.projectIds.includes(request.resource.projectId)) {
    denialReasons.push("project_out_of_scope");
  }
  if (request.requiredCapability && !session.capabilities.includes(request.requiredCapability)) {
    denialReasons.push("capability_missing");
  }
  if (session.actorType === "ai" && request.resource.containsRawPayload) {
    denialReasons.push("ai_raw_payload_forbidden");
  }
  if (session.actorType === "ai" && ["mutate", "approve", "export"].includes(request.operation)) {
    denialReasons.push(request.operation === "approve" ? "human_approval_required" : "ai_mutation_forbidden");
  }
  if (request.operation === "approve" && session.actorType !== "human") denialReasons.push("human_approval_required");
  if (session.actorRole === "viewer" && ["propose", "mutate", "approve", "export"].includes(request.operation)) {
    denialReasons.push("viewer_write_forbidden");
  }
  if (request.operation === "approve" && !["owner", "admin"].includes(session.actorRole)) {
    denialReasons.push("human_approval_required");
  }
  if (request.operation === "export" && request.resource.sensitivity === "restricted" && session.actorRole !== "owner") {
    denialReasons.push("restricted_export_forbidden");
  }

  if (request.resource.sensitivity === "confidential" || request.resource.sensitivity === "restricted") {
    obligations.push("redact_sensitive_fields", "record_access_purpose");
  }
  if (session.actorType === "ai") obligations.push("provide_sanitized_evidence_only", "never_disclose_resource_existence_on_denial");
  if (request.operation === "propose") obligations.push("mark_advisory", "require_human_review");

  return {
    policyVersion: "1.0.0",
    allowed: denialReasons.length === 0,
    operation: request.operation,
    resourceKind: request.resource.resourceKind,
    denialReasons: unique(denialReasons),
    effectiveScope: {
      organizationId: session.organizationId,
      projectId: request.resource.projectId ?? null,
    },
    obligations: unique(obligations),
  };
}
