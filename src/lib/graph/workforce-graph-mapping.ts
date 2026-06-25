// ============================================================================
// ProjectOps360° — Resource Capacity → Living Graph (Workforce Intelligence Layer)
// ============================================================================
// Pure, deterministic bridge from the generic Resource Capacity engine to the
// Living Graph. Mirrors labor-graph-mapping (construction) but for ALL project
// types: creates `resource_event` nodes for people/resources, connects them to
// their assigned task nodes via `assigned_to` edges, and enriches task/milestone
// nodes with workforce status so the workforceCapacity overlay can emphasize
// overloaded resources and at-risk work. No DB, no AI, no randomness.
// ============================================================================

import type { LivingGraphNode, LivingGraphEdge, LivingGraphRiskLevel, WorkforceNodeData } from "@/types/living-graph";
import type { ResourceCapacityResult, ResourceCapacityRow } from "@/lib/capacity/service";

export const workforceResourceNodeId = (resourceKey: string): string => `workforce:${resourceKey}`;

function statusRisk(status: string): LivingGraphRiskLevel | null {
  if (status === "critical" || status === "overallocated") return "high";
  if (status === "near_capacity") return "medium";
  if (status === "available" || status === "healthy") return "low";
  return null;
}

function rowToWorkforce(r: ResourceCapacityRow, kind: "resource" | "task"): WorkforceNodeData {
  return {
    status: r.status,
    utilizationPercent: r.utilizationPercent,
    resourceName: r.name,
    role: r.role,
    effectiveHours: r.effectivePeriodHours,
    assignedHours: r.assignedHours,
    overallocatedHours: r.overallocatedHours,
    kind,
  };
}

/** One synthetic `resource_event` node per resource (with capacity metadata). */
export function mapWorkforceResourceNodes(result: ResourceCapacityResult): LivingGraphNode[] {
  return result.resources.map((r) => {
    const wf = rowToWorkforce(r, "resource");
    return {
      id: workforceResourceNodeId(r.resourceKey),
      projectId: "",
      nodeType: "resource_event",
      sourceEntityType: "roadmap_tasks", // synthetic; not a real source row
      sourceEntityId: r.resourceKey,
      label: r.role ? `${r.name} · ${r.role}` : r.name,
      description: r.utilizationPercent != null ? `${Math.round(r.utilizationPercent)}% utilization` : "No capacity data",
      status: r.status,
      progress: null,
      startDate: null, endDate: null, durationDays: null,
      occurredAt: new Date().toISOString(), createdAt: "", updatedAt: "",
      riskLevel: statusRisk(r.status),
      isBlocked: r.status === "critical",
      isCritical: r.status === "critical" || r.status === "overallocated",
      milestoneId: null, milestoneLabel: null, milestoneOrder: null,
      traceabilityScore: null,
      metadata: { workforce: wf },
    };
  });
}

/** assigned_to edges: resource node → its assigned task nodes. */
export function mapWorkforceAssignmentEdges(
  resourceNodes: LivingGraphNode[],
  existingNodes: LivingGraphNode[],
  taskResourceKey: Map<string, string>,
  projectId: string,
): LivingGraphEdge[] {
  const resourceNodeByKey = new Map(resourceNodes.map((n) => [n.sourceEntityId, n.id]));
  const edges: LivingGraphEdge[] = [];
  for (const node of existingNodes) {
    if (node.sourceEntityType !== "roadmap_tasks") continue;
    const key = taskResourceKey.get(node.sourceEntityId);
    if (!key) continue;
    const sourceId = resourceNodeByKey.get(key);
    if (!sourceId || sourceId === node.id) continue;
    edges.push({
      id: `workforce-edge:${sourceId}:${node.id}`,
      projectId,
      sourceNodeId: sourceId,
      targetNodeId: node.id,
      edgeType: "assigned_to",
      weight: 1,
      lagDays: null,
      isCritical: false,
      riskLevel: null,
      metadata: { workforceAssignment: true },
    });
  }
  return edges;
}

/** Attach workforce status to task nodes (by assignee) and milestone nodes (by capacity risk). */
export function enrichNodesWithWorkforce(
  nodes: LivingGraphNode[],
  result: ResourceCapacityResult,
  taskResourceKey: Map<string, string>,
): LivingGraphNode[] {
  const rowByKey = new Map(result.resources.map((r) => [r.resourceKey, r]));
  const milestoneById = new Map(result.milestones.map((m) => [m.milestoneId, m]));

  return nodes.map((node) => {
    // Task nodes → their assignee's status.
    if (node.sourceEntityType === "roadmap_tasks") {
      const key = taskResourceKey.get(node.sourceEntityId);
      const row = key ? rowByKey.get(key) : undefined;
      if (row) return { ...node, metadata: { ...node.metadata, workforce: rowToWorkforce(row, "task") } };
      return node;
    }
    // Milestone nodes → capacity risk level.
    const msId = node.milestoneId ?? (node.sourceEntityType === "milestones" ? node.sourceEntityId : null);
    const ms = msId ? milestoneById.get(msId) : undefined;
    if (ms && ms.capacityRiskLevel !== "none") {
      const status = ms.capacityRiskLevel === "high" ? "critical" : ms.capacityRiskLevel === "medium" ? "near_capacity" : "healthy";
      const wf: WorkforceNodeData = {
        status, utilizationPercent: null, resourceName: null, role: null,
        effectiveHours: null, assignedHours: ms.requiredHours, overallocatedHours: null, kind: "milestone",
      };
      return { ...node, metadata: { ...node.metadata, workforce: wf } };
    }
    return node;
  });
}
