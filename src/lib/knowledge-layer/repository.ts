import type { SupabaseClient } from "@supabase/supabase-js";
import { KNOWLEDGE_RELATION_SPECS } from "./contracts";
import type {
  CreateKnowledgeObjectInput,
  CreateKnowledgeRelationInput,
  KnowledgeActorContext,
  KnowledgeEvidenceInput,
  KnowledgeEvidenceRecord,
  KnowledgeObjectHistory,
  KnowledgeObjectListFilter,
  KnowledgeObjectMutationResult,
  KnowledgeObjectReadModel,
  KnowledgeProvenanceInput,
  KnowledgeRelationListFilter,
  KnowledgeRelationRecord,
  KnowledgeTransitionRecord,
  ResolveKnowledgeRelationInput,
  KnowledgeVersionRecord,
  ReviseKnowledgeObjectInput,
  TransitionKnowledgeObjectInput,
} from "./types";

export interface KnowledgeLayerRepository {
  create(context: KnowledgeActorContext, input: CreateKnowledgeObjectInput): Promise<KnowledgeObjectMutationResult>;
  revise(context: KnowledgeActorContext, input: ReviseKnowledgeObjectInput): Promise<KnowledgeObjectMutationResult>;
  transition(context: KnowledgeActorContext, input: TransitionKnowledgeObjectInput): Promise<KnowledgeObjectMutationResult>;
  list(context: KnowledgeActorContext, projectId: string, filter?: KnowledgeObjectListFilter): Promise<KnowledgeObjectReadModel[]>;
  /** Organization-scoped knowledge (ADR-013). Never returns project-scoped rows. */
  listOrganizationScoped(context: KnowledgeActorContext, filter?: KnowledgeObjectListFilter): Promise<KnowledgeObjectReadModel[]>;
  history(context: KnowledgeActorContext, projectId: string, knowledgeObjectId: string): Promise<KnowledgeObjectHistory>;
  createRelation(context: KnowledgeActorContext, input: CreateKnowledgeRelationInput): Promise<KnowledgeRelationRecord>;
  resolveRelation(context: KnowledgeActorContext, input: ResolveKnowledgeRelationInput): Promise<KnowledgeRelationRecord>;
  listRelations(context: KnowledgeActorContext, filter?: KnowledgeRelationListFilter): Promise<KnowledgeRelationRecord[]>;
}

function toRpcEvidence(evidence: KnowledgeEvidenceInput[]) {
  return evidence.map((item) => ({
    evidence_type: item.type,
    evidence_ref: item.ref,
    role: item.role,
    confidence: item.confidence,
    note: item.note ?? null,
    metadata: item.metadata ?? {},
  }));
}

function toRpcProvenance(provenance: KnowledgeProvenanceInput) {
  return {
    capture_method: provenance.captureMethod,
    source_kind: provenance.sourceKind,
    source_ref: provenance.sourceRef,
    engine_name: provenance.engineName ?? null,
    engine_version: provenance.engineVersion ?? null,
    config_version: provenance.configVersion ?? null,
    data_quality_flags: provenance.dataQualityFlags ?? [],
  };
}

function toRpcVersion(input: CreateKnowledgeObjectInput | ReviseKnowledgeObjectInput) {
  return {
    title: input.title,
    summary: input.summary,
    body: input.body,
    structured_content: input.structuredContent ?? {},
    confidence: input.confidence,
    confidence_reason: input.confidenceReason,
    provenance: toRpcProvenance(input.provenance),
    evidence: toRpcEvidence(input.evidence),
    proposal_rationale: input.proposalRationale,
  };
}

function mutationResult(value: unknown): KnowledgeObjectMutationResult {
  const row = value as Record<string, unknown>;
  return {
    knowledgeObjectId: String(row.knowledge_object_id),
    versionNo: Number(row.version_no),
    status: row.status as KnowledgeObjectMutationResult["status"],
    deduped: Boolean(row.deduped),
  };
}

function fromRpcProvenance(value: unknown): KnowledgeProvenanceInput {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    captureMethod: row.capture_method as KnowledgeProvenanceInput["captureMethod"],
    sourceKind: String(row.source_kind ?? ""),
    sourceRef: String(row.source_ref ?? ""),
    engineName: typeof row.engine_name === "string" ? row.engine_name : null,
    engineVersion: typeof row.engine_version === "string" ? row.engine_version : null,
    configVersion: typeof row.config_version === "string" ? row.config_version : null,
    dataQualityFlags: Array.isArray(row.data_quality_flags)
      ? row.data_quality_flags.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function readModel(value: unknown): KnowledgeObjectReadModel {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    scope: (row.scope_type ?? "project") as KnowledgeObjectReadModel["scope"],
    projectId: row.project_id == null ? null : String(row.project_id),
    ownerUserId: row.owner_user_id == null ? null : String(row.owner_user_id),
    knowledgeType: row.knowledge_type as KnowledgeObjectReadModel["knowledgeType"],
    status: row.current_status as KnowledgeObjectReadModel["status"],
    currentVersionNo: Number(row.current_version_no),
    activeVersionNo: row.active_version_no == null ? null : Number(row.active_version_no),
    title: String(row.title),
    summary: String(row.summary),
    body: String(row.body),
    structuredContent: (row.structured_content ?? {}) as Record<string, unknown>,
    confidence: row.confidence as KnowledgeObjectReadModel["confidence"],
    confidenceReason: String(row.confidence_reason),
    provenance: fromRpcProvenance(row.provenance),
    evidenceCount: Number(row.evidence_count),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function versionRecord(value: unknown): KnowledgeVersionRecord {
  const row = value as Record<string, unknown>;
  return {
    knowledgeObjectId: String(row.knowledge_object_id),
    versionNo: Number(row.version_no),
    title: String(row.title),
    summary: String(row.summary),
    body: String(row.body),
    structuredContent: (row.structured_content ?? {}) as Record<string, unknown>,
    confidence: row.confidence as KnowledgeVersionRecord["confidence"],
    confidenceReason: String(row.confidence_reason),
    provenance: fromRpcProvenance(row.provenance),
    contentHash: String(row.content_hash),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

function evidenceRecord(value: unknown): KnowledgeEvidenceRecord {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    knowledgeObjectId: String(row.knowledge_object_id),
    versionNo: Number(row.version_no),
    type: row.evidence_type as KnowledgeEvidenceRecord["type"],
    ref: String(row.evidence_ref),
    role: row.role as KnowledgeEvidenceRecord["role"],
    confidence: row.confidence as KnowledgeEvidenceRecord["confidence"],
    note: typeof row.note === "string" ? row.note : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

function transitionRecord(value: unknown): KnowledgeTransitionRecord {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    knowledgeObjectId: String(row.knowledge_object_id),
    versionNo: Number(row.version_no),
    fromStatus: row.from_status == null ? null : row.from_status as KnowledgeTransitionRecord["fromStatus"],
    toStatus: row.to_status as KnowledgeTransitionRecord["toStatus"],
    actorId: String(row.actor_id),
    rationale: String(row.rationale),
    createdAt: String(row.created_at),
  };
}


function relationEndpoint(
  kind: unknown, objectId: unknown, packageId: unknown, versionNo: unknown,
) {
  const endpointKind = kind as KnowledgeRelationRecord["source"]["kind"];
  return {
    kind: endpointKind,
    id: String(endpointKind === "knowledge_object" ? objectId : packageId),
    versionNo: versionNo == null ? null : Number(versionNo),
  };
}

function relationRecord(value: unknown): KnowledgeRelationRecord {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    scope: row.scope_type as KnowledgeRelationRecord["scope"],
    projectId: row.project_id == null ? null : String(row.project_id),
    relationType: row.relation_type as KnowledgeRelationRecord["relationType"],
    source: relationEndpoint(row.source_endpoint_kind, row.source_object_id, row.source_package_id, row.source_version_no),
    target: relationEndpoint(row.target_endpoint_kind, row.target_object_id, row.target_package_id, row.target_version_no),
    basis: row.basis as KnowledgeRelationRecord["basis"],
    resolutionStatus: row.resolution_status as KnowledgeRelationRecord["resolutionStatus"],
    resolutionRationale: typeof row.resolution_rationale === "string" ? row.resolution_rationale : null,
    approvedBy: row.approved_by == null ? null : String(row.approved_by),
    approvedAt: row.approved_at == null ? null : String(row.approved_at),
    note: typeof row.note === "string" ? row.note : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function throwRepositoryError(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export function createSupabaseKnowledgeLayerRepository(
  readClient: SupabaseClient,
  writeClient: SupabaseClient,
): KnowledgeLayerRepository {
  return {
    async create(context, input) {
      const { data, error } = await writeClient.rpc("create_project_knowledge_object", {
        p_input: {
          organization_id: context.organizationId,
          scope_type: input.scope,
          project_id: input.projectId,
          actor_id: context.userId,
          knowledge_type: input.knowledgeType,
          owner_user_id: input.ownerUserId ?? null,
          idempotency_key: input.idempotencyKey,
          ...toRpcVersion(input),
        },
      });
      if (error || !data) throwRepositoryError(error, "knowledge_create_failed");
      return mutationResult(data);
    },

    async revise(context, input) {
      const { data, error } = await writeClient.rpc("revise_project_knowledge_object", {
        p_knowledge_object_id: input.knowledgeObjectId,
        p_expected_version_no: input.expectedVersionNo,
        p_input: {
          actor_id: context.userId,
          ...toRpcVersion(input),
        },
      });
      if (error || !data) throwRepositoryError(error, "knowledge_revision_failed");
      return mutationResult(data);
    },

    async transition(context, input) {
      const { data, error } = await writeClient.rpc("transition_project_knowledge_object", {
        p_knowledge_object_id: input.knowledgeObjectId,
        p_expected_version_no: input.expectedVersionNo,
        p_target_status: input.targetStatus,
        p_actor_id: context.userId,
        p_rationale: input.rationale,
      });
      if (error || !data) throwRepositoryError(error, "knowledge_transition_failed");
      return mutationResult(data);
    },

    async list(context, projectId, filter = {}) {
      let query = readClient
        .from("project_knowledge_object_current")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(Math.min(Math.max(filter.limit ?? 100, 1), 500));
      if (filter.status) query = query.eq("current_status", filter.status);
      if (filter.knowledgeType) query = query.eq("knowledge_type", filter.knowledgeType);
      const { data, error } = await query;
      if (error) throwRepositoryError(error, "knowledge_list_failed");
      return (data ?? []).map(readModel);
    },

    async history(context, projectId, knowledgeObjectId) {
      const [versions, evidence, transitions] = await Promise.all([
        readClient.from("project_knowledge_object_versions").select("*")
          .eq("organization_id", context.organizationId).eq("project_id", projectId)
          .eq("knowledge_object_id", knowledgeObjectId).order("version_no", { ascending: false }),
        readClient.from("project_knowledge_object_evidence").select("*")
          .eq("organization_id", context.organizationId).eq("project_id", projectId)
          .eq("knowledge_object_id", knowledgeObjectId).order("created_at", { ascending: true }),
        readClient.from("project_knowledge_object_transitions").select("*")
          .eq("organization_id", context.organizationId).eq("project_id", projectId)
          .eq("knowledge_object_id", knowledgeObjectId).order("created_at", { ascending: true }),
      ]);
      if (versions.error) throwRepositoryError(versions.error, "knowledge_history_failed");
      if (evidence.error) throwRepositoryError(evidence.error, "knowledge_history_failed");
      if (transitions.error) throwRepositoryError(transitions.error, "knowledge_history_failed");
      return {
        versions: (versions.data ?? []).map(versionRecord),
        evidence: (evidence.data ?? []).map(evidenceRecord),
        transitions: (transitions.data ?? []).map(transitionRecord),
      };
    },
    async listOrganizationScoped(context, filter = {}) {
      let query = readClient
        .from("project_knowledge_object_current")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("scope_type", "organization")
        .order("updated_at", { ascending: false })
        .limit(Math.min(Math.max(filter.limit ?? 100, 1), 500));
      if (filter.status) query = query.eq("current_status", filter.status);
      if (filter.knowledgeType) query = query.eq("knowledge_type", filter.knowledgeType);
      const { data, error } = await query;
      if (error) throwRepositoryError(error, "knowledge_list_failed");
      return (data ?? []).map(readModel);
    },

    async createRelation(context, input) {
      const spec = KNOWLEDGE_RELATION_SPECS[input.relationType];
      const { data, error } = await writeClient
        .from("project_knowledge_relations")
        .insert({
          organization_id: context.organizationId,
          scope_type: input.scope,
          project_id: input.projectId,
          relation_type: input.relationType,
          source_endpoint_kind: input.source.kind,
          source_object_id: input.source.kind === "knowledge_object" ? input.source.id : null,
          source_package_id: input.source.kind === "knowledge_package" ? input.source.id : null,
          source_version_no: input.source.versionNo ?? null,
          target_endpoint_kind: input.target.kind,
          target_object_id: input.target.kind === "knowledge_object" ? input.target.id : null,
          target_package_id: input.target.kind === "knowledge_package" ? input.target.id : null,
          target_version_no: input.target.versionNo ?? null,
          basis: input.basis ?? "declared",
          note: input.note ?? null,
          metadata: input.metadata ?? {},
          // A relation whose assertion requires human approval records the
          // approver at the moment it is asserted by one. Nothing else may set
          // these columns, so an unapproved assertion is visibly unapproved.
          approved_by: spec.humanApproval ? context.userId : null,
          approved_at: spec.humanApproval ? new Date().toISOString() : null,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (error || !data) throwRepositoryError(error, "knowledge_relation_create_failed");
      return relationRecord(data);
    },

    async resolveRelation(context, input) {
      const { data, error } = await writeClient
        .from("project_knowledge_relations")
        .update({
          resolution_status: input.resolution,
          resolution_rationale: input.rationale,
          approved_by: context.userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", input.relationId)
        .eq("organization_id", context.organizationId)
        .select("*")
        .single();
      if (error || !data) throwRepositoryError(error, "knowledge_relation_resolve_failed");
      return relationRecord(data);
    },

    async listRelations(context, filter = {}) {
      let query = readClient
        .from("project_knowledge_relations")
        .select("*")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(filter.limit ?? 200, 1), 1000));
      if (filter.relationType) query = query.eq("relation_type", filter.relationType);
      if (filter.unresolvedOnly) query = query.eq("resolution_status", "unresolved");
      if (filter.objectId) {
        query = query.or(`source_object_id.eq.${filter.objectId},target_object_id.eq.${filter.objectId}`);
      }
      const { data, error } = await query;
      if (error) throwRepositoryError(error, "knowledge_relation_list_failed");
      return (data ?? []).map(relationRecord);
    },
  };
}
