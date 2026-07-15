import type { KnowledgeEvidenceRecord, KnowledgeObjectReadModel } from "@/lib/knowledge-layer/types";
import { CANONICAL_GRAPH_SPEC_VERSION, type CanonicalNodeFamily, type CanonicalRelationshipFamily } from "./canonical-graph-spec";
import type { CanonicalGraphEdge, CanonicalGraphNode, CanonicalGraphProjection } from "./canonical-graph-types";

export interface ScopedKnowledgeEvidence extends KnowledgeEvidenceRecord {
  organizationId: string;
  projectId: string;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function canonicalGraphNodeId(family: CanonicalNodeFamily, sourceRef: string): string {
  return `cg:n:${family}:${stableHash(sourceRef)}`;
}

export function canonicalGraphEdgeId(family: CanonicalRelationshipFamily, sourceNodeId: string, targetNodeId: string): string {
  return `cg:e:${family}:${stableHash(`${sourceNodeId}>${targetNodeId}`)}`;
}

function objectFamily(metadata: Record<string, unknown>): CanonicalNodeFamily {
  const type = typeof metadata.object_type === "string" ? metadata.object_type : "";
  const mapped: Record<string, CanonicalNodeFamily> = {
    project: "project", milestone: "milestone", task: "task", subtask: "subtask", risk: "risk",
    decision: "decision", document: "document", resource: "resource",
  };
  return mapped[type] ?? "external_reference";
}

function evidenceFamily(evidence: ScopedKnowledgeEvidence): CanonicalNodeFamily {
  if (evidence.type === "project_event") return "canonical_event";
  if (evidence.type === "engine_finding") return "engine_finding";
  if (evidence.type === "metric") return "metric";
  if (evidence.type === "document") return "document";
  if (evidence.type === "project_object") return objectFamily(evidence.metadata ?? {});
  return "external_reference";
}

function evidenceLayer(family: CanonicalNodeFamily): CanonicalGraphNode["layer"] {
  if (family === "canonical_event") return "event";
  if (family === "engine_finding" || family === "metric" || family === "intelligence_signal") return "intelligence";
  if (family === "prediction_signal") return "prediction";
  return "object";
}

function evidenceHref(projectId: string, evidence: ScopedKnowledgeEvidence): string | null {
  if (evidence.type === "project_event") return `/projects/${projectId}/execution-map/living-graph?event=${encodeURIComponent(evidence.ref)}`;
  if (evidence.type === "document") return `/projects/${projectId}/documents`;
  if (evidence.type === "project_object") return `/projects/${projectId}/execution-map`;
  return null;
}

function relationshipFamily(object: KnowledgeObjectReadModel, evidence: ScopedKnowledgeEvidence): CanonicalRelationshipFamily {
  if (evidence.role === "contradicts") return "contradicted_by";
  if (evidence.role === "context") return "contextualized_by";
  if (object.provenance.captureMethod === "derived" && (evidence.type === "engine_finding" || evidence.type === "metric")) {
    return "derived_from";
  }
  return "supported_by";
}

export function projectKnowledgeObjectsToCanonicalGraph(
  objects: readonly KnowledgeObjectReadModel[],
  evidence: readonly ScopedKnowledgeEvidence[],
): CanonicalGraphProjection {
  const evidenceByObjectVersion = new Map<string, ScopedKnowledgeEvidence[]>();
  for (const item of evidence) {
    const key = `${item.knowledgeObjectId}:${item.versionNo}`;
    evidenceByObjectVersion.set(key, [...(evidenceByObjectVersion.get(key) ?? []), item]);
  }

  const nodes: CanonicalGraphNode[] = [];
  const edges: CanonicalGraphEdge[] = [];
  const evidenceNodes = new Map<string, CanonicalGraphNode>();

  for (const object of [...objects].sort((left, right) => left.id.localeCompare(right.id))) {
    const objectEvidence = evidenceByObjectVersion.get(`${object.id}:${object.currentVersionNo}`) ?? [];
    const objectNodeId = canonicalGraphNodeId("knowledge_object", object.id);
    nodes.push({
      id: objectNodeId,
      organizationId: object.organizationId,
      projectId: object.projectId,
      layer: "knowledge",
      family: "knowledge_object",
      sourceRef: object.id,
      label: object.title,
      description: object.summary,
      lifecycleStatus: object.status,
      confidence: object.confidence,
      evidenceRefs: objectEvidence.map((item) => item.ref),
      provenance: object.provenance as unknown as Record<string, unknown>,
      navigation: { kind: "knowledge_object", ref: object.id, href: null },
      recordedAt: object.updatedAt,
      metadata: { knowledgeType: object.knowledgeType, versionNo: object.currentVersionNo, activeVersionNo: object.activeVersionNo },
    });

    for (const item of [...objectEvidence].sort((left, right) => left.id.localeCompare(right.id))) {
      const family = evidenceFamily(item);
      const evidenceNodeId = canonicalGraphNodeId(family, item.ref);
      if (!evidenceNodes.has(evidenceNodeId)) {
        evidenceNodes.set(evidenceNodeId, {
          id: evidenceNodeId,
          organizationId: item.organizationId,
          projectId: item.projectId,
          layer: evidenceLayer(family),
          family,
          sourceRef: item.ref,
          label: item.note || `${item.type}: ${item.ref}`,
          description: item.note ?? null,
          lifecycleStatus: null,
          confidence: item.confidence,
          evidenceRefs: [item.ref],
          provenance: null,
          navigation: { kind: item.type === "project_event" ? "project_event" : "evidence", ref: item.ref, href: evidenceHref(item.projectId, item) },
          recordedAt: item.createdAt,
          metadata: { evidenceType: item.type, evidenceRole: item.role, ...item.metadata },
        });
      }
      const familyName = relationshipFamily(object, item);
      edges.push({
        id: canonicalGraphEdgeId(familyName, objectNodeId, evidenceNodeId),
        organizationId: object.organizationId,
        projectId: object.projectId,
        layer: "relationship",
        family: familyName,
        relationshipClass: familyName === "derived_from" ? "derived_intelligence" : "association",
        sourceNodeId: objectNodeId,
        targetNodeId: evidenceNodeId,
        evidenceRefs: [item.ref],
        provenance: familyName === "derived_from" ? object.provenance as unknown as Record<string, unknown> : null,
        navigation: { kind: "evidence", ref: item.ref, href: evidenceHref(item.projectId, item) },
        metadata: { evidenceRole: item.role, evidenceType: item.type, confidence: item.confidence },
      });
    }
  }

  return {
    specVersion: CANONICAL_GRAPH_SPEC_VERSION,
    nodes: [...nodes, ...[...evidenceNodes.values()].sort((left, right) => left.id.localeCompare(right.id))],
    edges: edges.sort((left, right) => left.id.localeCompare(right.id)),
  };
}
