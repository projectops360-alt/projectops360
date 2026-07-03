// ============================================================================
// ProjectOps360° — Living Graph · Subtask Visibility Layer (pure, tested)
// ============================================================================
// NotebookLM-style progressive subtask expansion for the Project Execution
// Map: task nodes get a subtask indicator (count/progress affordance), and
// expanding a task ADDS synthetic subtask nodes + hierarchy edges — client
// presentation state only.
//
// HARD RULES (guarded by LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE):
// - Nothing is dumped by default: zero expanded parents ⇒ zero subtask nodes.
// - Synthetic nodes/edges are NEVER persisted: this layer reads server-fetched
//   task_subtasks rows (already org/project-scoped + RBAC-validated) and never
//   touches process_nodes/process_edges or any write path.
// - Hierarchy edges (`subtask_of`, solid violet) are visually distinct from
//   dependency edges (`caused`, gray) and signal edges (dashed).
// - Deleted subtasks are filtered defensively; ordering is sort_order, then
//   created_at, then id (deterministic fallback).
// ============================================================================

import type { LivingGraphNode, LivingGraphEdge } from "@/types/living-graph";

/** The subtask fields the layer needs (a projection of task_subtasks rows). */
export interface SubtaskLayerRow {
  id: string;
  task_id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  owner_id: string | null;
  due_date: string | null;
  is_critical: boolean;
  blocked_reason: string | null;
  sort_order: number;
  created_at: string;
  deleted_at: string | null;
}

// ── Expansion state (pure reducers — session/client state only) ───────────────

export function toggleSubtaskExpansion(
  expanded: ReadonlySet<string>,
  taskId: string,
): Set<string> {
  const next = new Set(expanded);
  if (next.has(taskId)) next.delete(taskId);
  else next.add(taskId);
  return next;
}

export function expandAllSubtaskParents(taskIdsWithSubtasks: readonly string[]): Set<string> {
  return new Set(taskIdsWithSubtasks);
}

/** Reset: back to the clean collapsed view (root-first, nothing expanded). */
export function collapseAllSubtaskParents(): Set<string> {
  return new Set();
}

/**
 * The task ids "Expand all" may expand, SCOPED to the currently visible graph
 * (the milestone/phase the user drilled into). Only VISIBLE task nodes that
 * actually have subtasks qualify — so Expand all never reveals tasks from other
 * milestones or subtasks from other tasks (requirements #3/#5/#6). Pure.
 */
export function scopedExpandableTaskIds(
  visibleNodes: readonly Pick<LivingGraphNode, "sourceEntityType" | "nodeType" | "sourceEntityId">[],
  subtasksByTask: ReadonlyMap<string, unknown>,
): string[] {
  const ids = new Set<string>();
  for (const n of visibleNodes) {
    if (
      n.sourceEntityType === "roadmap_tasks" &&
      n.nodeType !== "subtask_item" &&
      subtasksByTask.has(n.sourceEntityId)
    ) {
      ids.add(n.sourceEntityId);
    }
  }
  return [...ids];
}

// ── Grouping helper ───────────────────────────────────────────────────────────

export function groupSubtasksByTask(
  rows: readonly SubtaskLayerRow[],
): Map<string, SubtaskLayerRow[]> {
  const byTask = new Map<string, SubtaskLayerRow[]>();
  for (const row of rows) {
    if (row.deleted_at) continue; // defensive: never render deleted/archived
    if (!byTask.has(row.task_id)) byTask.set(row.task_id, []);
    byTask.get(row.task_id)!.push(row);
  }
  for (const list of byTask.values()) {
    list.sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  }
  return byTask;
}

// ── Layer application ─────────────────────────────────────────────────────────

export interface SubtaskLayerArgs {
  projectId: string;
  subtasksByTask: ReadonlyMap<string, SubtaskLayerRow[]>;
  /** roadmap_tasks ids the user expanded. Empty set = clean collapsed view. */
  expandedTaskIds: ReadonlySet<string>;
  generatedAt?: string;
}

const SUBTASK_NODE_PREFIX = "subtask-node:";
const SUBTASK_EDGE_PREFIX = "subtask-edge:";

export function isSubtaskGraphNodeId(id: string): boolean {
  return id.startsWith(SUBTASK_NODE_PREFIX);
}

function subtaskNode(
  parent: LivingGraphNode,
  row: SubtaskLayerRow,
  projectId: string,
  generatedAt: string,
): LivingGraphNode {
  return {
    id: `${SUBTASK_NODE_PREFIX}${row.id}`,
    projectId,
    nodeType: "subtask_item",
    sourceEntityType: "task_subtasks",
    sourceEntityId: row.id,
    label: row.title,
    description: null,
    status: row.status,
    progress: row.status === "completed" ? 100 : Math.min(100, Math.max(0, row.progress)),
    startDate: null,
    endDate: row.due_date,
    durationDays: null,
    occurredAt: row.created_at,
    createdAt: row.created_at,
    updatedAt: row.created_at,
    riskLevel: row.status === "blocked" ? "high" : row.is_critical ? "medium" : "low",
    isBlocked: row.status === "blocked",
    isCritical: row.is_critical,
    milestoneId: parent.milestoneId,
    milestoneLabel: parent.milestoneLabel,
    milestoneOrder: parent.milestoneOrder,
    traceabilityScore: null,
    metadata: {
      is_subtask: true,
      parent_task_id: row.task_id,
      parent_node_id: parent.id,
      owner_id: row.owner_id,
      due_date: row.due_date,
      priority: row.priority,
      blocked_reason: row.blocked_reason,
      subtask_status: row.status,
      generated_at: generatedAt,
    },
  };
}

/**
 * Apply the subtask visibility layer to an already-filtered display graph:
 * 1) task nodes referencing tasks WITH subtasks get indicator metadata
 *    (`subtask_total/_completed/_blocked`, `subtask_expanded`);
 * 2) for EXPANDED tasks whose node is displayed, synthetic subtask nodes and
 *    `subtask_of` hierarchy edges are appended.
 * Pure: never mutates the input graph, nodes, or rows.
 */
export function appendSubtaskGraphLayer(
  graph: { nodes: LivingGraphNode[]; edges: LivingGraphEdge[] },
  args: SubtaskLayerArgs,
): { nodes: LivingGraphNode[]; edges: LivingGraphEdge[] } {
  const generatedAt = args.generatedAt ?? "";
  if (args.subtasksByTask.size === 0) return graph;

  const outNodes: LivingGraphNode[] = [];
  const outEdges: LivingGraphEdge[] = [...graph.edges];

  for (const node of graph.nodes) {
    const isTaskNode =
      node.sourceEntityType === "roadmap_tasks" && node.nodeType !== "subtask_item";
    const rows = isTaskNode ? args.subtasksByTask.get(node.sourceEntityId) : undefined;
    if (!rows || rows.length === 0) {
      outNodes.push(node);
      continue;
    }

    const expanded = args.expandedTaskIds.has(node.sourceEntityId);
    // Indicator metadata — the affordance the node renders (count + chevron).
    outNodes.push({
      ...node,
      metadata: {
        ...node.metadata,
        subtask_total: rows.length,
        subtask_completed: rows.filter((r) => r.status === "completed").length,
        subtask_blocked: rows.filter((r) => r.status === "blocked").length,
        subtask_expanded: expanded,
      },
    });

    if (!expanded) continue; // progressive: collapsed by default, click reveals

    for (const row of rows) {
      outNodes.push(subtaskNode(node, row, args.projectId, generatedAt));
      outEdges.push({
        id: `${SUBTASK_EDGE_PREFIX}${node.id}:${row.id}`,
        projectId: args.projectId,
        sourceNodeId: node.id,
        targetNodeId: `${SUBTASK_NODE_PREFIX}${row.id}`,
        edgeType: "subtask_of",
        weight: 1,
        lagDays: null,
        isCritical: false,
        riskLevel: row.status === "blocked" ? "high" : null,
        metadata: { hierarchy: true, parent_task_id: row.task_id },
      });
    }
  }

  return { nodes: outNodes, edges: outEdges };
}
