import { getOrgContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseEkiEvidenceRepository } from "./repository";
import { EkiEvidenceService } from "./service";
import type {
  AssignOwnerInput,
  BindingScheduleInput,
  CreateEvidenceBindingInput,
  ResolveFindingInput,
} from "./types";

/**
 * Internal entry points for the evidence engine.
 *
 * The actor is taken from `getOrgContext()` and never from an argument. A caller
 * that could name its own organization or user id would be able to evaluate,
 * close findings and reassign ownership in a tenant it has no access to, and the
 * audit trail would faithfully record the lie.
 */
async function runtime() {
  const org = await getOrgContext();
  const repository = createSupabaseEkiEvidenceRepository(await createClient(), createAdminClient());
  return {
    context: {
      organizationId: org.organizationId,
      userId: org.userId,
      role: org.role,
    },
    service: new EkiEvidenceService(repository),
  };
}

export async function defineEvidenceBinding(input: CreateEvidenceBindingInput) {
  const { context, service } = await runtime();
  return service.defineBinding(context, input);
}

export async function activateEvidenceBinding(bindingObjectId: string) {
  const { context, service } = await runtime();
  return service.activateBinding(context, bindingObjectId);
}

export async function retireEvidenceBinding(bindingObjectId: string) {
  const { context, service } = await runtime();
  return service.retireBinding(context, bindingObjectId);
}

export async function getEvidenceBinding(bindingObjectId: string) {
  const { context, service } = await runtime();
  return service.getBinding(context, bindingObjectId);
}

export async function listEvidenceBindings() {
  const { context, service } = await runtime();
  return service.listBindings(context);
}

export async function evaluateEvidenceBinding(bindingObjectId: string) {
  const { context, service } = await runtime();
  return service.evaluate(context, bindingObjectId);
}

export async function getLatestEvidenceEvaluation(bindingObjectId: string) {
  const { context, service } = await runtime();
  return service.latestEvaluation(context, bindingObjectId);
}

export async function getEvidenceHistory(bindingObjectId: string, limit?: number) {
  const { context, service } = await runtime();
  return service.evidenceHistory(context, bindingObjectId, limit);
}

export async function getControlEvidenceStatus(controlObjectId: string) {
  const { context, service } = await runtime();
  return service.controlEvidenceStatus(context, controlObjectId);
}

export async function recalculateControlState(controlObjectId: string) {
  const { context, service } = await runtime();
  return service.recalculateControl(context, controlObjectId);
}

export async function listOpenGovernanceFindings(targetObjectId?: string) {
  const { context, service } = await runtime();
  return service.listOpenFindings(context, targetObjectId);
}

export async function resolveGovernanceFinding(input: ResolveFindingInput) {
  const { context, service } = await runtime();
  return service.resolveFinding(context, input);
}

export async function assignGovernanceOwner(input: AssignOwnerInput) {
  const { context, service } = await runtime();
  return service.assignOwner(context, input);
}

// ── Macrophase 3 — automation surface ───────────────────────────────────────

export async function setEvidenceBindingSchedule(bindingObjectId: string, input: BindingScheduleInput) {
  const { context, service } = await runtime();
  return service.setSchedule(context, bindingObjectId, input);
}

export async function requestEvidenceEvaluation(bindingObjectId: string) {
  const { context, service } = await runtime();
  return service.requestEvaluation(context, bindingObjectId);
}

export async function listEvidenceEvaluationRuns(limit?: number) {
  const { context, service } = await runtime();
  return service.listRuns(context, limit);
}

export async function getEvidenceEvaluationRunDetail(runId: string) {
  const { context, service } = await runtime();
  return service.runDetail(context, runId);
}

export async function getBindingEvaluationHistory(bindingObjectId: string, limit?: number) {
  const { context, service } = await runtime();
  return service.bindingRunHistory(context, bindingObjectId, limit);
}
