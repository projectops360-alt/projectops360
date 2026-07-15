import type { LivingGraphEdge, LivingGraphNode } from "@/types/living-graph";
import type { CanonicalGraphProjection } from "./canonical-graph-types";

export function adaptCanonicalKnowledgeGraph(projection: CanonicalGraphProjection): { nodes: LivingGraphNode[]; edges: LivingGraphEdge[] } {
  return {
    nodes: projection.nodes.map((node) => ({
      id: node.id, projectId: node.projectId,
      nodeType: node.family === "knowledge_object" ? "knowledge_object" : "evidence_reference",
      sourceEntityType: node.family === "knowledge_object" ? "project_knowledge_objects" : "knowledge_evidence",
      sourceEntityId: node.sourceRef, label: node.label, description: node.description, status: node.lifecycleStatus,
      progress: null, startDate: null, endDate: null, durationDays: null, occurredAt: node.recordedAt, createdAt: node.recordedAt, updatedAt: node.recordedAt,
      riskLevel: null, isBlocked: false, isCritical: false, milestoneId: null, milestoneLabel: null, milestoneOrder: null,
      traceabilityScore: node.evidenceRefs.length > 0 ? 1 : 0,
      metadata: { canonicalGraph: true, layer: node.layer, family: node.family, confidence: node.confidence, evidenceRefs: node.evidenceRefs, provenance: node.provenance, navigationHref: node.navigation.href, navigationKind: node.navigation.kind, ...node.metadata },
    })),
    edges: projection.edges.map((edge) => ({
      id: edge.id, projectId: edge.projectId, sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId,
      edgeType: edge.family === "derived_from" ? "derived_from" : edge.family === "contradicted_by" ? "contradicted_by" : "supported_by",
      weight: 1, lagDays: null, isCritical: false, riskLevel: null,
      metadata: { canonicalGraph: true, family: edge.family, relationshipClass: edge.relationshipClass, evidenceRefs: edge.evidenceRefs, provenance: edge.provenance, navigationHref: edge.navigation?.href ?? null, ...edge.metadata },
    })),
  };
}
