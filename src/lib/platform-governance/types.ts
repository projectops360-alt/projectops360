export type PlatformActorType = "human" | "ai" | "system";
/**
 * `none` is a real value, not a placeholder.
 *
 * An actor with no standing in the organization is exactly the actor whose
 * refusal most needs recording, and until this existed the vocabulary could not
 * express it: the governance audit rejected the row, the insert raised, and the
 * refusal was lost together with the error. `none` is denied every operation in
 * `security.ts` — widening the vocabulary grants nothing. See REG-034.
 */
export type PlatformActorRole = "owner" | "admin" | "member" | "viewer" | "service" | "none";
export type PlatformOperation = "read" | "analyze" | "propose" | "mutate" | "approve" | "export";
export type PlatformResourceKind =
  | "project_data"
  | "communication"
  | "memory"
  | "knowledge"
  | "decision"
  | "governance_audit";
export type PlatformDataSensitivity = "public" | "internal" | "confidential" | "restricted";

export interface TrustedPlatformSession {
  actorId: string;
  actorType: PlatformActorType;
  actorRole: PlatformActorRole;
  organizationId: string;
  projectIds: readonly string[];
  active: boolean;
  capabilities: readonly string[];
}

export interface PlatformResourceScope {
  organizationId: string;
  projectId?: string | null;
  resourceKind: PlatformResourceKind;
  sensitivity: PlatformDataSensitivity;
  containsRawPayload: boolean;
}

export interface PlatformAccessRequest {
  operation: PlatformOperation;
  purpose: string;
  resource: PlatformResourceScope;
  requiredCapability?: string;
}

export type PlatformAccessDenialReason =
  | "inactive_session"
  | "missing_purpose"
  | "cross_organization"
  | "project_out_of_scope"
  | "capability_missing"
  | "ai_raw_payload_forbidden"
  | "ai_mutation_forbidden"
  | "human_approval_required"
  | "viewer_write_forbidden"
  | "actor_without_role"
  | "restricted_export_forbidden";

export interface PlatformAccessDecision {
  policyVersion: "1.0.0";
  allowed: boolean;
  operation: PlatformOperation;
  resourceKind: PlatformResourceKind;
  denialReasons: PlatformAccessDenialReason[];
  effectiveScope: {
    organizationId: string;
    projectId: string | null;
  };
  obligations: string[];
}

export type GovernanceEventType =
  | "access_allowed"
  | "access_denied"
  | "human_override_recorded"
  | "knowledge_transition_reviewed"
  | "policy_evaluated";

export interface GovernanceAuditInput {
  eventId: string;
  eventType: GovernanceEventType;
  organizationId: string;
  projectId?: string | null;
  actorId: string;
  actorType: PlatformActorType;
  actorRole: PlatformActorRole;
  purpose: string;
  policyVersion: string;
  decision: "allowed" | "denied" | "recorded";
  reasonCodes: readonly string[];
  evidenceRefs: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
  occurredAt: string;
}

export interface GovernanceAuditRecord extends GovernanceAuditInput {
  sequence: number;
  previousHash: string | null;
  recordHash: string;
  reasonCodes: string[];
  evidenceRefs: string[];
  metadata: Record<string, unknown>;
}

export interface GovernanceAuditValidation {
  valid: boolean;
  violations: string[];
  checkedRecords: number;
}
