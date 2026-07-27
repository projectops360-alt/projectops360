import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssignOwnerInput,
  AuthorizedResult,
  ControlGate,
  ControlRuntimeRecord,
  ControlState,
  CreateEvidenceBindingInput,
  EvaluationSyncResult,
  EvidenceActorContext,
  EvidenceBindingRecord,
  EvidenceEvaluationRecord,
  OpenFindingRecord,
  ResolveFindingInput,
} from "./types";

/**
 * Data access for the evidence engine.
 *
 * Reads go through the caller's client so RLS applies; writes go through the
 * service-role client, because every mutation is a database function that
 * refuses any other role. Same split as the knowledge layer — no parallel
 * data-access pattern is introduced.
 */
export interface EkiEvidenceRepository {
  createBinding(context: EvidenceActorContext, input: CreateEvidenceBindingInput): Promise<EvidenceBindingRecord>;
  setBindingState(context: EvidenceActorContext, bindingObjectId: string, state: "active" | "retired"): Promise<EvidenceBindingRecord>;
  getBinding(context: EvidenceActorContext, bindingObjectId: string): Promise<EvidenceBindingRecord | null>;
  listBindings(context: EvidenceActorContext): Promise<EvidenceBindingRecord[]>;
  evaluateAndSync(context: EvidenceActorContext, bindingObjectId: string): Promise<EvaluationSyncResult>;
  latestEvaluation(context: EvidenceActorContext, bindingObjectId: string): Promise<EvidenceEvaluationRecord | null>;
  evaluationHistory(context: EvidenceActorContext, bindingObjectId: string, limit?: number): Promise<EvidenceEvaluationRecord[]>;
  getControlRuntime(context: EvidenceActorContext, controlObjectId: string): Promise<ControlRuntimeRecord | null>;
  controlGate(context: EvidenceActorContext, controlObjectId: string): Promise<ControlGate>;
  recalculateControl(context: EvidenceActorContext, controlObjectId: string): Promise<{ controlState: ControlState; changed: boolean; reason: string }>;
  listOpenFindings(context: EvidenceActorContext, targetObjectId?: string): Promise<OpenFindingRecord[]>;
  resolveFinding(context: EvidenceActorContext, input: ResolveFindingInput): Promise<AuthorizedResult<{ controlState: string | null }>>;
  assignOwner(context: EvidenceActorContext, input: AssignOwnerInput): Promise<AuthorizedResult<{ previousOwner: string | null }>>;
}

function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

function bindingRecord(value: unknown): EvidenceBindingRecord {
  const row = value as Record<string, unknown>;
  return {
    bindingObjectId: String(row.binding_object_id),
    organizationId: String(row.organization_id),
    resolverKey: row.resolver_key as EvidenceBindingRecord["resolverKey"],
    freshnessInterval: String(row.freshness_interval),
    warningInterval: String(row.warning_interval),
    bindingState: row.binding_state as EvidenceBindingRecord["bindingState"],
    lastEvaluatedAt: row.last_evaluated_at == null ? null : String(row.last_evaluated_at),
    lastSuccessAt: row.last_success_at == null ? null : String(row.last_success_at),
    lastEvidenceAt: row.last_evidence_at == null ? null : String(row.last_evidence_at),
    lastOutcome: (row.last_outcome ?? null) as EvidenceBindingRecord["lastOutcome"],
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function evaluationRecord(value: unknown): EvidenceEvaluationRecord {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    bindingObjectId: String(row.binding_object_id),
    organizationId: String(row.organization_id),
    evaluatedAt: String(row.evaluated_at),
    sequenceNo: Number(row.sequence_no),
    outcome: row.outcome as EvidenceEvaluationRecord["outcome"],
    evidenceCount: Number(row.evidence_count ?? 0),
    latestEvidenceAt: row.latest_evidence_at == null ? null : String(row.latest_evidence_at),
    contradictionCount: Number(row.contradiction_count ?? 0),
    reasonCode: String(row.reason_code),
    detail: (row.detail ?? {}) as Record<string, unknown>,
    evaluatedBy: row.evaluated_by as EvidenceEvaluationRecord["evaluatedBy"],
  };
}

function controlRecord(value: unknown): ControlRuntimeRecord {
  const row = value as Record<string, unknown>;
  return {
    controlObjectId: String(row.control_object_id),
    organizationId: String(row.organization_id),
    controlState: row.control_state as ControlState,
    lastStateChangeAt: String(row.last_state_change_at),
    lastEvaluatedAt: row.last_evaluated_at == null ? null : String(row.last_evaluated_at),
  };
}

function openFindingRecord(value: unknown): OpenFindingRecord {
  const row = value as Record<string, unknown>;
  return {
    organizationId: String(row.organization_id),
    targetObjectId: String(row.target_object_id),
    conditionCode: row.condition_code as OpenFindingRecord["conditionCode"],
    findingObjectId: String(row.finding_object_id),
    openedAt: String(row.opened_at),
    lastSeenAt: String(row.last_seen_at),
    occurrenceCount: Number(row.occurrence_count ?? 1),
  };
}

export function createSupabaseEkiEvidenceRepository(
  readClient: SupabaseClient,
  writeClient: SupabaseClient,
): EkiEvidenceRepository {
  return {
    async createBinding(context, input) {
      const { data, error } = await writeClient
        .from("eki_evidence_binding_runtime")
        .insert({
          binding_object_id: input.bindingObjectId,
          organization_id: context.organizationId,
          resolver_key: input.resolverKey,
          freshness_interval: input.freshnessInterval,
          warning_interval: input.warningInterval,
          binding_state: "defined",
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (error || !data) fail(error, "eki_binding_create_failed");
      return bindingRecord(data);
    },

    async setBindingState(context, bindingObjectId, state) {
      const { data, error } = await writeClient
        .from("eki_evidence_binding_runtime")
        .update({ binding_state: state, updated_at: new Date().toISOString() })
        .eq("binding_object_id", bindingObjectId)
        .eq("organization_id", context.organizationId)
        .select("*")
        .single();
      if (error || !data) fail(error, "eki_binding_state_change_failed");
      return bindingRecord(data);
    },

    async getBinding(context, bindingObjectId) {
      const { data, error } = await readClient
        .from("eki_evidence_binding_runtime")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("binding_object_id", bindingObjectId)
        .maybeSingle();
      if (error) fail(error, "eki_binding_read_failed");
      return data ? bindingRecord(data) : null;
    },

    async listBindings(context) {
      const { data, error } = await readClient
        .from("eki_evidence_binding_runtime")
        .select("*")
        .eq("organization_id", context.organizationId)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) fail(error, "eki_binding_list_failed");
      return (data ?? []).map(bindingRecord);
    },

    async evaluateAndSync(_context, bindingObjectId) {
      const { data, error } = await writeClient.rpc("eki_evaluate_and_sync", {
        p_binding_object_id: bindingObjectId,
      });
      if (error || !data) fail(error, "eki_evaluate_failed");
      const row = data as Record<string, unknown>;
      const control = row.control as Record<string, unknown> | null;
      const finding = row.finding as Record<string, unknown> | null;
      return {
        outcome: row.outcome as EvaluationSyncResult["outcome"],
        reasonCode: String(row.reason_code),
        evidenceCount: Number(row.evidence_count ?? 0),
        latestEvidenceAt: row.latest_evidence_at == null ? null : String(row.latest_evidence_at),
        evaluationId: String(row.evaluation_id),
        bindingState: row.binding_state as EvaluationSyncResult["bindingState"],
        controlObjectId: row.control_object_id == null ? null : String(row.control_object_id),
        control: control
          ? {
              controlState: control.control_state as ControlState,
              changed: Boolean(control.changed),
              reason: String(control.reason),
            }
          : null,
        finding: finding
          ? {
              findingObjectId: String(finding.finding_object_id),
              created: Boolean(finding.created),
              occurrenceCount: Number(finding.occurrence_count ?? 1),
            }
          : null,
        condition: (row.condition ?? null) as EvaluationSyncResult["condition"],
      };
    },

    async latestEvaluation(context, bindingObjectId) {
      const { data, error } = await readClient
        .from("eki_evidence_evaluations")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("binding_object_id", bindingObjectId)
        .order("sequence_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail(error, "eki_evaluation_read_failed");
      return data ? evaluationRecord(data) : null;
    },

    async evaluationHistory(context, bindingObjectId, limit = 100) {
      const { data, error } = await readClient
        .from("eki_evidence_evaluations")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("binding_object_id", bindingObjectId)
        .order("sequence_no", { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 500));
      if (error) fail(error, "eki_evaluation_history_failed");
      return (data ?? []).map(evaluationRecord);
    },

    async getControlRuntime(context, controlObjectId) {
      const { data, error } = await readClient
        .from("eki_control_runtime")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("control_object_id", controlObjectId)
        .maybeSingle();
      if (error) fail(error, "eki_control_read_failed");
      return data ? controlRecord(data) : null;
    },

    async controlGate(_context, controlObjectId) {
      const { data, error } = await writeClient.rpc("eki_control_can_operate", {
        p_control_object_id: controlObjectId,
      });
      if (error || !data) fail(error, "eki_control_gate_failed");
      const row = data as Record<string, unknown>;
      return {
        canOperate: Boolean(row.can_operate),
        reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
        bindingCount: Number(row.binding_count ?? 0),
        healthyBindingCount: Number(row.healthy_binding_count ?? 0),
        blockingContradictions: Number(row.blocking_contradictions ?? 0),
      };
    },

    async recalculateControl(_context, controlObjectId) {
      const { data, error } = await writeClient.rpc("eki_recalculate_control_state", {
        p_control_object_id: controlObjectId,
      });
      if (error || !data) fail(error, "eki_control_recalculate_failed");
      const row = data as Record<string, unknown>;
      return {
        controlState: row.control_state as ControlState,
        changed: Boolean(row.changed),
        reason: String(row.reason),
      };
    },

    async listOpenFindings(context, targetObjectId) {
      let query = readClient
        .from("eki_open_findings")
        .select("*")
        .eq("organization_id", context.organizationId)
        .order("opened_at", { ascending: false })
        .limit(500);
      if (targetObjectId) query = query.eq("target_object_id", targetObjectId);
      const { data, error } = await query;
      if (error) fail(error, "eki_finding_list_failed");
      return (data ?? []).map(openFindingRecord);
    },

    async resolveFinding(context, input) {
      const { data, error } = await writeClient.rpc("eki_resolve_finding", {
        p_finding_object_id: input.findingObjectId,
        p_actor_id: context.userId,
        p_resolution: input.resolution,
        p_rationale: input.rationale,
        p_evidence_ref: input.evidenceRef ?? null,
      });
      if (error || !data) fail(error, "eki_finding_resolve_failed");
      const row = data as Record<string, unknown>;
      const control = row.control_state as Record<string, unknown> | null;
      return {
        authorized: Boolean(row.authorized),
        reason: row.reason == null ? undefined : String(row.reason),
        value: { controlState: control ? String(control.control_state) : null },
      };
    },

    async assignOwner(context, input) {
      const { data, error } = await writeClient.rpc("eki_assign_owner", {
        p_object_id: input.objectId,
        p_owner_user_id: input.ownerUserId,
        p_actor_id: context.userId,
        p_rationale: input.rationale,
      });
      if (error || !data) fail(error, "eki_owner_assign_failed");
      const row = data as Record<string, unknown>;
      return {
        authorized: Boolean(row.authorized),
        reason: row.reason == null ? undefined : String(row.reason),
        value: { previousOwner: row.previous_owner == null ? null : String(row.previous_owner) },
      };
    },
  };
}
