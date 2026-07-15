import type { LivingGraphEdge, LivingGraphNode } from "@/types/living-graph";
import type { NodePosition } from "./living-graph-layout";

export interface ProgressiveKnowledgeGraph {
  nodes: LivingGraphNode[];
  edges: LivingGraphEdge[];
  positions: Map<string, NodePosition>;
  knowledgeCount: number;
  evidenceCount: number;
  evidenceGroupCount: number;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function knowledgeOrder(left: LivingGraphNode, right: LivingGraphNode): number {
  const time = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  return time || left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}

function evidenceLabel(type: string, count: number, locale: string): string {
  const names: Record<string, { en: string; es: string }> = {
    project_event: { en: "canonical events", es: "eventos canónicos" },
    project_object: { en: "project objects", es: "objetos del proyecto" },
    document: { en: "documents", es: "documentos" },
    metric: { en: "metrics", es: "métricas" },
    engine_finding: { en: "engine findings", es: "hallazgos del motor" },
    external_reference: { en: "external references", es: "referencias externas" },
  };
  const language = locale === "es" ? "es" : "en";
  return `${count} ${names[type]?.[language] ?? (language === "es" ? "referencias de evidencia" : "evidence references")}`;
}

export function buildProgressiveKnowledgeGraph(
  nodes: readonly LivingGraphNode[],
  edges: readonly LivingGraphEdge[],
  focusedKnowledgeId: string | null,
  locale: string,
): ProgressiveKnowledgeGraph {
  const knowledgeNodes = nodes
    .filter((node) => node.nodeType === "knowledge_object")
    .sort(knowledgeOrder);
  const knowledgeIds = new Set(knowledgeNodes.map((node) => node.id));
  const effectiveFocus = focusedKnowledgeId && knowledgeIds.has(focusedKnowledgeId)
    ? focusedKnowledgeId
    : null;
  const positions = new Map<string, NodePosition>();

  knowledgeNodes.forEach((node, index) => {
    positions.set(node.id, { x: 40 + index * 280, y: 100 });
  });

  if (!effectiveFocus) {
    return {
      nodes: knowledgeNodes,
      edges: [],
      positions,
      knowledgeCount: knowledgeNodes.length,
      evidenceCount: 0,
      evidenceGroupCount: 0,
    };
  }

  const evidenceById = new Map(nodes
    .filter((node) => node.nodeType === "evidence_reference")
    .map((node) => [node.id, node]));
  const groups = new Map<string, { type: string; role: string; refs: string[]; edges: LivingGraphEdge[] }>();

  for (const edge of edges) {
    if (edge.sourceNodeId !== effectiveFocus) continue;
    const evidenceNode = evidenceById.get(edge.targetNodeId);
    if (!evidenceNode) continue;
    const type = typeof edge.metadata.evidenceType === "string"
      ? edge.metadata.evidenceType
      : String(evidenceNode.metadata.evidenceType ?? "evidence");
    const role = typeof edge.metadata.evidenceRole === "string"
      ? edge.metadata.evidenceRole
      : String(evidenceNode.metadata.evidenceRole ?? "supports");
    const key = `${role}:${type}`;
    const refs = Array.isArray(edge.metadata.evidenceRefs)
      ? edge.metadata.evidenceRefs.filter((ref): ref is string => typeof ref === "string")
      : Array.isArray(evidenceNode.metadata.evidenceRefs)
        ? evidenceNode.metadata.evidenceRefs.filter((ref): ref is string => typeof ref === "string")
        : [evidenceNode.sourceEntityId];
    const current = groups.get(key) ?? { type, role, refs: [], edges: [] };
    current.refs.push(...refs);
    current.edges.push(edge);
    groups.set(key, current);
  }

  const aggregateNodes: LivingGraphNode[] = [];
  const aggregateEdges: LivingGraphEdge[] = [];
  const sortedGroups = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  const focusedIndex = knowledgeNodes.findIndex((node) => node.id === effectiveFocus);
  const focusX = 40 + Math.max(0, focusedIndex) * 280;

  sortedGroups.forEach(([key, group], index) => {
    const refs = unique(group.refs);
    const aggregateId = `kg:aggregate:${effectiveFocus}:${key}`;
    const sourceEdge = group.edges[0];
    const sourceNode = evidenceById.get(sourceEdge.targetNodeId)!;
    aggregateNodes.push({
      ...sourceNode,
      id: aggregateId,
      sourceEntityId: aggregateId,
      label: evidenceLabel(group.type, refs.length, locale),
      description: locale === "es"
        ? "Evidencia agrupada. Selecciona este nodo para revisar su alcance; no representa una transición del proceso."
        : "Grouped evidence. Select this node to inspect its scope; it does not represent a process transition.",
      metadata: {
        ...sourceNode.metadata,
        aggregateEvidence: true,
        clusterSize: refs.length,
        evidenceRefs: refs,
        evidenceType: group.type,
        evidenceRole: group.role,
        canonicalGraph: true,
        navigationHref: null,
      },
    });
    aggregateEdges.push({
      ...sourceEdge,
      id: `kg:aggregate-edge:${effectiveFocus}:${key}`,
      targetNodeId: aggregateId,
      weight: refs.length,
      metadata: {
        ...sourceEdge.metadata,
        aggregateEvidence: true,
        evidenceRefs: refs,
        evidenceCount: refs.length,
      },
    });
    positions.set(aggregateId, {
      x: focusX + (index - (sortedGroups.length - 1) / 2) * 280,
      y: 300,
    });
  });

  return {
    nodes: [...knowledgeNodes, ...aggregateNodes],
    edges: aggregateEdges,
    positions,
    knowledgeCount: knowledgeNodes.length,
    evidenceCount: aggregateNodes.reduce((sum, node) => sum + Number(node.metadata.clusterSize ?? 0), 0),
    evidenceGroupCount: aggregateNodes.length,
  };
}
