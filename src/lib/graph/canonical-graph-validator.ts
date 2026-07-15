import { CANONICAL_NODE_FAMILIES, CANONICAL_RELATIONSHIP_RULES } from "./canonical-graph-spec";
import { canonicalGraphEdgeId, canonicalGraphNodeId } from "./canonical-graph-projection";
import type { CanonicalGraphProjection, CanonicalGraphValidationIssue, CanonicalGraphValidationResult } from "./canonical-graph-types";

export function validateCanonicalGraph(
  projection: CanonicalGraphProjection,
  expectedOrganizationId: string,
  expectedProjectId: string,
): CanonicalGraphValidationResult {
  const issues: CanonicalGraphValidationIssue[] = [];
  const ids = new Set<string>();
  const nodes = new Map(projection.nodes.map((node) => [node.id, node]));

  for (const entity of [...projection.nodes, ...projection.edges]) {
    if (entity.organizationId !== expectedOrganizationId) issues.push({ code: "cross_tenant", entityId: entity.id, message: "Entity organization does not match the requested tenant." });
    if (entity.projectId !== expectedProjectId) issues.push({ code: "cross_project", entityId: entity.id, message: "Entity project does not match the requested project." });
    if (ids.has(entity.id)) issues.push({ code: "duplicate_id", entityId: entity.id, message: "Canonical graph identifiers must be unique." });
    ids.add(entity.id);
  }

  for (const node of projection.nodes) {
    if (!(CANONICAL_NODE_FAMILIES as readonly string[]).includes(node.family)) issues.push({ code: "unknown_family", entityId: node.id, message: "Unknown canonical node family." });
    if (node.id !== canonicalGraphNodeId(node.family, node.sourceRef)) issues.push({ code: "unstable_id", entityId: node.id, message: "Node identifier is not derived from its canonical family and source reference." });
  }

  for (const edge of projection.edges) {
    const source = nodes.get(edge.sourceNodeId);
    const target = nodes.get(edge.targetNodeId);
    if (!source || !target) {
      issues.push({ code: "dangling_endpoint", entityId: edge.id, message: "Relationship endpoint is missing." });
      continue;
    }
    if (edge.id !== canonicalGraphEdgeId(edge.family, edge.sourceNodeId, edge.targetNodeId)) issues.push({ code: "unstable_id", entityId: edge.id, message: "Relationship identifier is not deterministic." });
    const rule = CANONICAL_RELATIONSHIP_RULES.find((candidate) => candidate.family === edge.family);
    if (!rule) {
      issues.push({ code: "unknown_family", entityId: edge.id, message: "Unknown canonical relationship family." });
      continue;
    }
    if (rule.relationshipClass !== edge.relationshipClass) issues.push({ code: "invalid_relationship_class", entityId: edge.id, message: "Relationship class does not match the canonical specification." });
    if (!rule.sourceFamilies.includes(source.family) || !rule.targetFamilies.includes(target.family)) issues.push({ code: "invalid_source_target", entityId: edge.id, message: "Source-target pair is not allowed by the canonical specification." });
    if (rule.requiresEvidence && edge.evidenceRefs.length === 0) issues.push({ code: "missing_evidence", entityId: edge.id, message: "Relationship requires traceable evidence." });
    if (rule.requiresExplicitProvenance && !edge.provenance) issues.push({ code: "missing_provenance", entityId: edge.id, message: "Relationship requires explicit provenance." });
    if (source.organizationId !== target.organizationId || edge.organizationId !== source.organizationId) issues.push({ code: "cross_tenant", entityId: edge.id, message: "Relationship endpoints cross tenant boundaries." });
    if (source.projectId !== target.projectId || edge.projectId !== source.projectId) issues.push({ code: "cross_project", entityId: edge.id, message: "Relationship endpoints cross project boundaries." });
  }

  return { valid: issues.length === 0, issues };
}
