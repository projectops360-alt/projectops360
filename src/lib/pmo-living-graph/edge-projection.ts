// ============================================================================
// PMO Portfolio Living Graph — edge projection (CAP-048)
// ============================================================================
// Relationships come from real foreign keys, real dependency rows and real
// traceability links. Nothing here infers a connection from coincidence, and
// temporal adjacency is never promoted to causation — the same rule CAP-045
// enforces on the project Living Graph.
// ============================================================================

import type {
  GraphEdge,
  GraphEdgeType,
  GraphProvenance,
} from "./contracts";
import { nodeId } from "./node-projection";
import type { SharedResourceLink } from "./shared-resources";

export interface CanonicalRelations {
  projects: readonly { id: string; organization_id: string }[];
  milestones: readonly {
    id: string;
    organization_id: string;
    project_id: string;
  }[];
  tasks: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    milestone_id: string | null;
  }[];
  subtasks: readonly {
    id: string;
    organization_id: string;
    task_id: string;
  }[];
  taskDependencies: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    predecessor_id: string;
    successor_id: string;
    dependency_type: string | null;
    lag_days: number | null;
  }[];
  risks: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    linked_task_id: string | null;
    linked_milestone_id: string | null;
    severity: string | null;
    status: string | null;
  }[];
  budgetItems: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    milestone_id: string | null;
  }[];
  traceabilityLinks: readonly {
    id: string;
    organization_id: string;
    source_type: string;
    source_id: string;
    target_type: string;
    target_id: string;
    link_type: string;
  }[];
}

let sequence = 0;
/** Deterministic per projection run; ids are only meaningful within one graph. */
function edgeId(type: GraphEdgeType, source: string, target: string): string {
  sequence += 1;
  return `${type}:${source}->${target}:${sequence}`;
}

/** Reset between projections so ids stay stable and tests stay deterministic. */
export function resetEdgeSequence(): void {
  sequence = 0;
}

function edge(
  organizationId: string,
  type: GraphEdgeType,
  sourceNodeId: string,
  targetNodeId: string,
  options: {
    provenance?: GraphProvenance;
    confidence?: number;
    weight?: number;
    direction?: GraphEdge["direction"];
    status?: string | null;
    evidence: GraphEdge["evidenceRefs"];
  },
): GraphEdge {
  return {
    id: edgeId(type, sourceNodeId, targetNodeId),
    organizationId,
    sourceNodeId,
    targetNodeId,
    type,
    direction: options.direction ?? "directed",
    weight: options.weight ?? 1,
    status: options.status ?? null,
    provenance: options.provenance ?? "OBSERVED",
    confidence: options.confidence ?? 1,
    evidenceRefs: options.evidence,
    validFrom: null,
    validTo: null,
    updatedAt: null,
  };
}

/** Traceability endpoints name their table; map them onto our node kinds. */
const TRACEABILITY_KIND: Record<string, string> = {
  decision: "decision",
  project: "project",
  stakeholder: "stakeholder",
};

/** `traceability_links.link_type` already uses a controlled vocabulary. */
const TRACEABILITY_EDGE_TYPE: Record<string, GraphEdgeType> = {
  depends_on: "depends_on",
  caused_by: "triggered_by",
  related_to: "contributes_to",
  derived_from: "contributes_to",
  supersedes: "contributes_to",
  // `contradicts` has no honest equivalent in the controlled vocabulary and is
  // deliberately dropped rather than bent into a type that means something else.
};

export function projectEdges(
  relations: CanonicalRelations,
  sharedResources: readonly SharedResourceLink[],
  organizationId: string,
): GraphEdge[] {
  resetEdgeSequence();
  const edges: GraphEdge[] = [];
  const scoped = <T extends { organization_id: string }>(rows: readonly T[]) =>
    rows.filter((row) => row.organization_id === organizationId);

  // ── Containment: organization → project → milestone → task ────────────────
  for (const project of scoped(relations.projects)) {
    edges.push(
      edge(organizationId, "contains", nodeId("organization", organizationId), nodeId("project", project.id), {
        evidence: [{ sourceTable: "projects", sourceId: project.id }],
      }),
    );
  }

  for (const milestone of scoped(relations.milestones)) {
    edges.push(
      edge(organizationId, "contains", nodeId("project", milestone.project_id), nodeId("milestone", milestone.id), {
        evidence: [{ sourceTable: "milestones", sourceId: milestone.id }],
      }),
    );
  }

  for (const task of scoped(relations.tasks)) {
    // A task hangs off its milestone when it has one, off the project otherwise.
    const parent = task.milestone_id
      ? nodeId("milestone", task.milestone_id)
      : nodeId("project", task.project_id);
    edges.push(
      edge(organizationId, "contains", parent, nodeId("task", task.id), {
        evidence: [{ sourceTable: "roadmap_tasks", sourceId: task.id }],
      }),
    );
  }

  for (const subtask of scoped(relations.subtasks)) {
    edges.push(
      edge(organizationId, "contains", nodeId("task", subtask.task_id), nodeId("subtask", subtask.id), {
        evidence: [{ sourceTable: "task_subtasks", sourceId: subtask.id }],
      }),
    );
  }

  // ── Dependencies ──────────────────────────────────────────────────────────
  for (const dependency of scoped(relations.taskDependencies)) {
    edges.push(
      edge(
        organizationId,
        "depends_on",
        nodeId("task", dependency.successor_id),
        nodeId("task", dependency.predecessor_id),
        {
          // Lag widens the edge: a dependency with slack binds more loosely.
          weight: 1 + Math.abs(dependency.lag_days ?? 0) / 10,
          status: dependency.dependency_type,
          evidence: [
            {
              sourceTable: "task_dependencies",
              sourceId: dependency.id,
              note: `${dependency.dependency_type ?? "finish_to_start"}${
                dependency.lag_days ? ` · lag ${dependency.lag_days}d` : ""
              }`,
            },
          ],
        },
      ),
    );
  }

  // ── Risk impact ───────────────────────────────────────────────────────────
  for (const risk of scoped(relations.risks)) {
    const weight = risk.severity === "critical" ? 3 : risk.severity === "high" ? 2 : 1;
    if (risk.linked_task_id) {
      edges.push(
        edge(organizationId, "impacts", nodeId("risk", risk.id), nodeId("task", risk.linked_task_id), {
          weight,
          status: risk.status,
          evidence: [{ sourceTable: "risks", sourceId: risk.id, note: risk.severity ?? undefined }],
        }),
      );
    }
    if (risk.linked_milestone_id) {
      edges.push(
        edge(organizationId, "impacts", nodeId("risk", risk.id), nodeId("milestone", risk.linked_milestone_id), {
          weight,
          status: risk.status,
          evidence: [{ sourceTable: "risks", sourceId: risk.id, note: risk.severity ?? undefined }],
        }),
      );
    }
    // A risk with no link still belongs to its project — otherwise it would
    // float as an orphan and vanish from every impact calculation.
    if (!risk.linked_task_id && !risk.linked_milestone_id) {
      edges.push(
        edge(organizationId, "impacts", nodeId("risk", risk.id), nodeId("project", risk.project_id), {
          weight,
          status: risk.status,
          evidence: [{ sourceTable: "risks", sourceId: risk.id }],
        }),
      );
    }
  }

  // ── Budget ────────────────────────────────────────────────────────────────
  for (const item of scoped(relations.budgetItems)) {
    const target = item.milestone_id
      ? nodeId("milestone", item.milestone_id)
      : nodeId("project", item.project_id);
    edges.push(
      edge(organizationId, "consumes_budget", nodeId("budget_item", item.id), target, {
        evidence: [{ sourceTable: "budget_items", sourceId: item.id }],
      }),
    );
  }

  // ── Traceability ──────────────────────────────────────────────────────────
  for (const link of scoped(relations.traceabilityLinks)) {
    const type = TRACEABILITY_EDGE_TYPE[link.link_type];
    const sourceKind = TRACEABILITY_KIND[link.source_type];
    const targetKind = TRACEABILITY_KIND[link.target_type];
    // Endpoints we cannot map to a supported node kind are skipped rather than
    // pointed at a node that does not exist.
    if (!type || !sourceKind || !targetKind) continue;
    edges.push(
      edge(
        organizationId,
        type,
        `${sourceKind}:${link.source_id}`,
        `${targetKind}:${link.target_id}`,
        {
          evidence: [
            { sourceTable: "traceability_links", sourceId: link.id, note: link.link_type },
          ],
        },
      ),
    );
  }

  // ── Shared resources: the cross-project signal ────────────────────────────
  for (const link of sharedResources) {
    edges.push(
      edge(
        organizationId,
        "shares_resource_with",
        nodeId("project", link.projectAId),
        nodeId("project", link.projectBId),
        {
          direction: "undirected",
          // Computed, not read. This is the distinction that keeps the graph honest.
          provenance: "INFERRED",
          confidence: 0.9,
          weight: link.combinedAllocationPercent != null && link.combinedAllocationPercent > 100 ? 3 : 1,
          status: link.overlapEnd,
          evidence: link.evidenceRefs,
        },
      ),
    );
  }

  return edges;
}

/**
 * Drop edges pointing at nodes that are not in the projection.
 *
 * Semantic zoom and filters remove nodes; their edges must go too, or the
 * canvas renders arrows into empty space and path finding walks off the graph.
 */
export function pruneDanglingEdges(
  edges: readonly GraphEdge[],
  presentNodeIds: ReadonlySet<string>,
): GraphEdge[] {
  return edges.filter(
    (edge) =>
      presentNodeIds.has(edge.sourceNodeId) && presentNodeIds.has(edge.targetNodeId),
  );
}
