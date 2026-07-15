import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeEvidenceRecord, KnowledgeObjectReadModel, KnowledgeProvenanceInput } from "@/lib/knowledge-layer/types";
import { projectKnowledgeObjectsToCanonicalGraph, type ScopedKnowledgeEvidence } from "./canonical-graph-projection";
import type { CanonicalGraphProjection, CanonicalGraphValidationIssue } from "./canonical-graph-types";
import { validateCanonicalGraph } from "./canonical-graph-validator";

export type KnowledgeGraphProjectionStatus = "empty" | "ready" | "insufficient_evidence" | "invalid" | "error";

export interface KnowledgeGraphLoadResult {
  status: KnowledgeGraphProjectionStatus;
  projection: CanonicalGraphProjection | null;
  validationIssues: CanonicalGraphValidationIssue[];
}

function provenance(value: unknown): KnowledgeProvenanceInput {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    captureMethod: row.capture_method as KnowledgeProvenanceInput["captureMethod"],
    sourceKind: String(row.source_kind ?? ""), sourceRef: String(row.source_ref ?? ""),
    engineName: typeof row.engine_name === "string" ? row.engine_name : null,
    engineVersion: typeof row.engine_version === "string" ? row.engine_version : null,
    configVersion: typeof row.config_version === "string" ? row.config_version : null,
    dataQualityFlags: Array.isArray(row.data_quality_flags) ? row.data_quality_flags.filter((item): item is string => typeof item === "string") : [],
  };
}

function objectRow(value: Record<string, unknown>): KnowledgeObjectReadModel {
  return {
    id: String(value.id), organizationId: String(value.organization_id), projectId: String(value.project_id),
    knowledgeType: value.knowledge_type as KnowledgeObjectReadModel["knowledgeType"], status: value.current_status as KnowledgeObjectReadModel["status"],
    currentVersionNo: Number(value.current_version_no), activeVersionNo: value.active_version_no == null ? null : Number(value.active_version_no),
    title: String(value.title), summary: String(value.summary), body: String(value.body), structuredContent: (value.structured_content ?? {}) as Record<string, unknown>,
    confidence: value.confidence as KnowledgeObjectReadModel["confidence"], confidenceReason: String(value.confidence_reason), provenance: provenance(value.provenance),
    evidenceCount: Number(value.evidence_count), createdBy: String(value.created_by), createdAt: String(value.created_at), updatedAt: String(value.updated_at),
  };
}

function evidenceRow(value: Record<string, unknown>): ScopedKnowledgeEvidence {
  return {
    id: String(value.id), knowledgeObjectId: String(value.knowledge_object_id), versionNo: Number(value.version_no),
    organizationId: String(value.organization_id), projectId: String(value.project_id),
    type: value.evidence_type as KnowledgeEvidenceRecord["type"], ref: String(value.evidence_ref), role: value.role as KnowledgeEvidenceRecord["role"],
    confidence: value.confidence as KnowledgeEvidenceRecord["confidence"], note: typeof value.note === "string" ? value.note : null,
    metadata: (value.metadata ?? {}) as Record<string, unknown>, createdBy: String(value.created_by), createdAt: String(value.created_at),
  };
}

export async function loadKnowledgeGraphProjection(
  client: SupabaseClient,
  organizationId: string,
  projectId: string,
): Promise<KnowledgeGraphLoadResult> {
  const [objectsResult, evidenceResult] = await Promise.all([
    client.from("project_knowledge_object_current").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("updated_at", { ascending: false }).limit(500),
    client.from("project_knowledge_object_evidence").select("*").eq("organization_id", organizationId).eq("project_id", projectId).order("created_at", { ascending: true }).limit(5000),
  ]);
  if (objectsResult.error || evidenceResult.error) return { status: "error", projection: null, validationIssues: [] };
  const objects = ((objectsResult.data ?? []) as Record<string, unknown>[]).map(objectRow);
  if (objects.length === 0) return { status: "empty", projection: projectKnowledgeObjectsToCanonicalGraph([], []), validationIssues: [] };
  const evidence = ((evidenceResult.data ?? []) as Record<string, unknown>[]).map(evidenceRow);
  const projection = projectKnowledgeObjectsToCanonicalGraph(objects, evidence);
  const validation = validateCanonicalGraph(projection, organizationId, projectId);
  if (!validation.valid) return { status: "invalid", projection, validationIssues: validation.issues };
  const insufficient = objects.some((object) => !evidence.some((item) => item.knowledgeObjectId === object.id && item.versionNo === object.currentVersionNo));
  return { status: insufficient ? "insufficient_evidence" : "ready", projection, validationIssues: [] };
}
