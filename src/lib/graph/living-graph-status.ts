// ============================================================================
// ProjectOps360° — Living Graph deterministic node status (REG-008 / ADR-006)
// ============================================================================
// Bridges Living Graph nodes to the Execution Status Engine so the graph shows
// the TRUE operational state of each node — never a false or stale "blocked".
//
// Hard rules (ADR-006):
//   • Blocked requires an EXPLICIT active impediment AND a non-terminal item.
//     A completed/cancelled task is NEVER blocked, even with a stale is_blocked
//     flag (the cause of REG-008).
//   • Waiting on Dependency = unfinished predecessor(s); it is NOT blocked.
//
// Pure + deterministic. Same inputs → same outputs.
// ============================================================================

import {
  resolveExecutionStatus,
  type ExecutionStatus,
  type ExecutionSignals,
} from "@/lib/execution/status-engine";
import type { LivingGraphNode } from "@/types/living-graph";
import type { GraphAdjacency } from "./living-graph-analysis";

const COMPLETED = new Set(["done", "completed", "tested"]);
const STARTED = new Set(["in_progress", "implemented", "sent_to_ai"]);
const ON_HOLD = new Set(["deferred"]);
const CANCELLED = new Set(["cancelled", "canceled"]);

/** Edge types that represent a real prerequisite/sequencing dependency. */
const DEPENDENCY_EDGE_TYPES = new Set([
  "caused",
  "enabled",
  "blocked",
  "requires_material",
  "requires_resource",
  "requires_approval",
  "supplied_by",
]);

function isNodeCompleted(node: LivingGraphNode): boolean {
  const s = node.status?.toLowerCase() ?? null;
  return (s != null && COMPLETED.has(s)) || node.progress === 100;
}

/** Map a Living Graph node to deterministic Execution Status Engine signals. */
export function buildNodeExecutionSignals(
  node: LivingGraphNode,
  adjacency: GraphAdjacency,
  onCriticalPath = false,
  inCycle = false,
): ExecutionSignals {
  const s = node.status?.toLowerCase() ?? null;
  const completed = isNodeCompleted(node);
  const cancelled = s != null && CANCELLED.has(s);

  const lifecycle: ExecutionSignals["lifecycle"] = cancelled
    ? "cancelled"
    : completed
      ? "completed"
      : s != null && ON_HOLD.has(s)
        ? "on_hold"
        : (s != null && STARTED.has(s)) || (node.progress != null && node.progress > 0)
          ? "started"
          : "not_started";

  // Explicit impediment ONLY when the item is not terminal. This is the core
  // REG-008 fix: a completed task's stale is_blocked flag is ignored.
  const explicitBlockers =
    !completed && !cancelled && node.isBlocked
      ? [
          {
            kind: "manual_flag" as const,
            reason_i18n: {
              en: "An impediment is recorded against this item.",
              es: "Hay un impedimento registrado en este elemento.",
            },
            evidence_entity_id: node.sourceEntityId,
            severity: "high" as const,
          },
        ]
      : [];

  // Pending predecessors: incoming dependency edges whose source is not complete.
  const incoming = adjacency.inc.get(node.id) ?? [];
  const depEdges = incoming.filter((e) => DEPENDENCY_EDGE_TYPES.has(e.edgeType));
  const pendingPredecessors = [];
  for (const e of depEdges) {
    const src = adjacency.nodeById.get(e.sourceNodeId);
    if (!src || isNodeCompleted(src)) continue;
    pendingPredecessors.push({ id: src.id, title: src.label, status: src.status });
  }

  return {
    lifecycle,
    explicitBlockers,
    pendingPredecessors,
    predecessorCount: depEdges.length,
    inCycle,
    onCriticalPath,
    scheduledStartReached: null,
    progress: node.progress,
  };
}

/** Resolve a node's Execution Status deterministically (ADR-006). */
export function resolveNodeExecutionStatus(
  node: LivingGraphNode,
  adjacency: GraphAdjacency,
  onCriticalPath = false,
  inCycle = false,
): ExecutionStatus {
  return resolveExecutionStatus(
    buildNodeExecutionSignals(node, adjacency, onCriticalPath, inCycle),
  );
}

export interface GraphStatusCounts {
  /** Explicit active impediments only (never completed, never dependency-derived). */
  blockedCount: number;
  /** Items waiting on unfinished predecessor(s) — NOT blocked. */
  waitingCount: number;
  onHoldCount: number;
}

/** Deterministic per-node status + project-level counts for the graph header. */
export function computeGraphStatuses(
  nodes: LivingGraphNode[],
  adjacency: GraphAdjacency,
): { statusById: Map<string, ExecutionStatus>; counts: GraphStatusCounts } {
  const statusById = new Map<string, ExecutionStatus>();
  let blockedCount = 0;
  let waitingCount = 0;
  let onHoldCount = 0;
  for (const node of nodes) {
    const status = resolveNodeExecutionStatus(node, adjacency);
    statusById.set(node.id, status);
    if (status === "blocked") blockedCount++;
    else if (status === "waiting_on_dependency") waitingCount++;
    else if (status === "on_hold") onHoldCount++;
  }
  return { statusById, counts: { blockedCount, waitingCount, onHoldCount } };
}
