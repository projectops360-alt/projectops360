import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { prepareAtomicEvent, type EmitResult } from "@/lib/events/ingestion";
import { authorizeFinancialAction } from "./authorization";
import { resolveFinancialCapabilities } from "./capabilities";
import { getFinancialFeatureStateFromProcess } from "./flags";
import {
  getFinancialTransition,
  type FinancialWorkflowDomain,
} from "./workflow";

export interface FinancialTransitionCommand {
  projectId: string;
  recordId: string;
  domain: FinancialWorkflowDomain;
  expectedStatus: string;
  targetStatus: string;
  operationKey: string;
  payload: Record<string, unknown>;
  evidenceRefs: string[];
  occurredAt?: string;
}

interface TransitionRpcResult {
  ok?: boolean;
  deduped?: boolean;
  event_id?: string;
  error?: string;
}

export async function executeFinancialTransition(
  command: FinancialTransitionCommand,
): Promise<EmitResult> {
  const featureState = getFinancialFeatureStateFromProcess(command.projectId);
  if (!featureState.writers) return { ok: false, error: "financial_writers_disabled" };

  const definition = getFinancialTransition(
    command.domain,
    command.expectedStatus,
    command.targetStatus,
  );
  if (!definition) return { ok: false, error: "financial_transition_not_allowed" };
  if (!command.operationKey.trim() || command.evidenceRefs.length === 0) {
    return { ok: false, error: "financial_evidence_and_operation_key_required" };
  }

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { ok: false, error: "not_authenticated" };
  }

  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", command.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return { ok: false, error: "financial_project_scope_conflict" };

  const { data: projectMember } = await supabase
    .from("project_team_members")
    .select("permission_level, project_role, governance_role, can_approve_changes, can_view_budget")
    .eq("organization_id", org.organizationId)
    .eq("project_id", command.projectId)
    .eq("user_id", org.userId)
    .eq("status", "active")
    .maybeSingle();
  const roleLabel = [projectMember?.project_role, projectMember?.governance_role]
    .filter(Boolean)
    .join(" / ");
  const capabilities = resolveFinancialCapabilities({
    organizationRole: org.role,
    projectPermissionLevel: projectMember?.permission_level ?? null,
    projectRole: roleLabel,
    permissionFlags: {
      can_approve_changes: projectMember?.can_approve_changes === true,
      can_view_budget: projectMember?.can_view_budget === true,
    },
  });
  const authorization = authorizeFinancialAction(
    {
      actorType: "human",
      userId: org.userId,
      organizationId: org.organizationId,
      projectIds: [command.projectId],
      capabilities,
    },
    {
      organizationId: org.organizationId,
      projectId: command.projectId,
      capability: definition.capability,
      occurredAt: command.occurredAt ?? new Date().toISOString(),
    },
  );
  if (!authorization.allowed) return { ok: false, error: authorization.reason };

  const prepared = prepareAtomicEvent({
    organizationId: org.organizationId,
    projectId: command.projectId,
    eventType: definition.eventType,
    subjectId: command.recordId,
    actorType: "human",
    actorId: org.userId,
    occurredAt: command.occurredAt,
    sourceModule: "financial_control",
    sourceEntityType: definition.subjectType,
    sourceEntityId: command.recordId,
    fromState: command.expectedStatus,
    toState: command.targetStatus,
    payload: command.payload,
    provenance: { evidenceRefs: command.evidenceRefs, authoritySource: authorization.source },
    objectRefs: [
      { objectType: definition.subjectType, objectId: command.recordId, role: "focal" },
      { objectType: "project", objectId: command.projectId, role: "context" },
    ],
    idempotencyKey: command.operationKey,
  });
  if (!prepared.ok) {
    return { ok: false, error: "validation_failed", errors: prepared.errors };
  }

  const { data, error } = await supabase.rpc("transition_financial_record_atomic", {
    p_domain: command.domain,
    p_record_id: command.recordId,
    p_expected_status: command.expectedStatus,
    p_target_status: command.targetStatus,
    p_event: prepared.data.event,
    p_payload_text: prepared.data.payloadText,
    p_refs: prepared.data.refs,
  });
  if (error) {
    console.error("[financial] transition failed:", error.message);
    return { ok: false, error: error.message || "financial_transition_failed" };
  }
  const result = data as TransitionRpcResult | null;
  if (!result?.ok || !result.event_id) {
    return { ok: false, error: result?.error ?? "financial_transition_failed" };
  }
  return { ok: true, eventId: result.event_id, deduped: result.deduped === true };
}
