// ============================================================================
// Import → Living Graph projection (pure)
// ============================================================================
// Describes the nodes and edges an import should produce, without writing
// anything. Keeping it pure means the shape of the projection can be asserted
// in tests, and lets the executor emit it in two bulk statements instead of
// one round trip per row — the cost that made this phase unaffordable and got
// it cut short mid-import (REG-048).
// ============================================================================

import { processNodeKey, type EmitNodeInput, type EmitEdgeInput } from "@/lib/graph/emit-event";
import type { CanonicalImport } from "@/types/import-intelligence";

function normTitle(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export interface GraphProjectionInput {
  organizationId: string;
  projectId: string;
  canonical: CanonicalImport;
  /** normalized milestone title → milestones.id */
  milestoneIdBySourceName: Map<string, string>;
  /** canonical task source_id → roadmap_tasks.id */
  taskIdBySourceId: Map<string, string>;
  /** canonical material source_id → material_requirements.id */
  materialIdBySourceId: Map<string, string>;
  /** entity ids that already emitted a canonical event */
  semanticallyCapturedIds: Set<string>;
}

/** Every node the import projects: one per milestone, task and material. */
export function buildImportGraphNodes(input: GraphProjectionInput): EmitNodeInput[] {
  const {
    organizationId,
    projectId,
    canonical,
    milestoneIdBySourceName,
    taskIdBySourceId,
    materialIdBySourceId,
    semanticallyCapturedIds,
  } = input;

  const nodes: EmitNodeInput[] = [];

  for (const [titleKey, milestoneId] of milestoneIdBySourceName) {
    nodes.push({
      organizationId,
      projectId,
      nodeType: "milestone_gate",
      sourceEntityType: "milestones",
      sourceEntityId: milestoneId,
      title: titleKey,
      metadata: {
        origin: "import",
        canonical_event_emitted: semanticallyCapturedIds.has(milestoneId),
      },
    });
  }

  for (const task of canonical.tasks) {
    const taskId = taskIdBySourceId.get(task.source_id);
    if (!taskId) continue;
    nodes.push({
      organizationId,
      projectId,
      nodeType: "task_transition",
      sourceEntityType: "roadmap_tasks",
      sourceEntityId: taskId,
      title: task.name,
      metadata: {
        origin: "import",
        new_status: task.status,
        canonical_event_emitted: semanticallyCapturedIds.has(taskId),
      },
    });
  }

  for (const material of canonical.materials) {
    const materialId = materialIdBySourceId.get(material.source_id);
    if (!materialId) continue;
    nodes.push({
      organizationId,
      projectId,
      nodeType: "material_event",
      sourceEntityType: "material_requirements",
      sourceEntityId: materialId,
      title: material.name,
      metadata: { origin: "import" },
    });
  }

  return nodes;
}

export interface GraphEdgeInput extends Omit<GraphProjectionInput, "semanticallyCapturedIds"> {
  /** The import event node everything hangs off. Null if it could not be created. */
  importNodeId: string | null;
  /** Result of emitting the nodes: key → node id. */
  nodeIdByKey: Map<string, string>;
}

/**
 * Every edge the import projects: `imported_from` back to the import event,
 * and `contains` from a milestone to the tasks under it.
 *
 * An edge is only described when BOTH of its nodes exist. If the node phase
 * was cut short, the surviving edges still make sense instead of pointing at
 * nodes that were never written.
 */
export function buildImportGraphEdges(input: GraphEdgeInput): EmitEdgeInput[] {
  const {
    organizationId,
    projectId,
    canonical,
    importNodeId,
    nodeIdByKey,
    milestoneIdBySourceName,
    taskIdBySourceId,
    materialIdBySourceId,
  } = input;

  const edges: EmitEdgeInput[] = [];
  const milestoneNodeByTitleKey = new Map<string, string>();

  for (const [titleKey, milestoneId] of milestoneIdBySourceName) {
    const nodeId = nodeIdByKey.get(processNodeKey("milestones", milestoneId, "milestone_gate"));
    if (!nodeId) continue;
    milestoneNodeByTitleKey.set(titleKey, nodeId);
    if (importNodeId) {
      edges.push({
        organizationId,
        projectId,
        fromNodeId: importNodeId,
        toNodeId: nodeId,
        edgeType: "imported_from",
      });
    }
  }

  for (const task of canonical.tasks) {
    const taskId = taskIdBySourceId.get(task.source_id);
    if (!taskId) continue;
    const taskNodeId = nodeIdByKey.get(processNodeKey("roadmap_tasks", taskId, "task_transition"));
    if (!taskNodeId) continue;

    if (importNodeId) {
      edges.push({
        organizationId,
        projectId,
        fromNodeId: importNodeId,
        toNodeId: taskNodeId,
        edgeType: "imported_from",
      });
    }
    const milestoneNodeId = milestoneNodeByTitleKey.get(normTitle(task.milestone || task.phase));
    if (milestoneNodeId) {
      edges.push({
        organizationId,
        projectId,
        fromNodeId: milestoneNodeId,
        toNodeId: taskNodeId,
        edgeType: "contains",
      });
    }
  }

  if (importNodeId) {
    for (const material of canonical.materials) {
      const materialId = materialIdBySourceId.get(material.source_id);
      if (!materialId) continue;
      const nodeId = nodeIdByKey.get(
        processNodeKey("material_requirements", materialId, "material_event"),
      );
      if (!nodeId) continue;
      edges.push({
        organizationId,
        projectId,
        fromNodeId: importNodeId,
        toNodeId: nodeId,
        edgeType: "imported_from",
      });
    }
  }

  return edges;
}
