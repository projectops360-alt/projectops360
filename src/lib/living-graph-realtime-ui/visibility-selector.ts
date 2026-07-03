// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · Visibility Selector (pure)
// ============================================================================
// Given the view model + expansion state + evidence-overlay flag + root scope,
// compute exactly which nodes/edges are visible on the canvas — enforcing the
// mandatory hierarchy narrowing and the Task 4 visibility policies:
//   Milestone → direct tasks (default) → subtasks (parent expanded) → child
//   subtasks (branch expanded) → evidence/events ONLY in the evidence overlay.
// Never dumps descendants by default; never shows events/evidence as default
// children; never shows other milestones' tasks or other tasks' subtasks.
// Pure — no rendering, no mutation.
// ============================================================================

import type { LivingGraphRootScope } from "@/lib/living-graph/realtime";
import type { RealtimeGraphViewModel, RealtimeGraphNode, RealtimeGraphEdge } from "./view-model";

export interface VisibilityContext {
  rootScope: LivingGraphRootScope;
  /** node ids the user has expanded (already scope-keyed by the caller). */
  expandedIds: ReadonlySet<string>;
  /** Whether the evidence overlay/mode is explicitly enabled. */
  evidenceOverlay: boolean;
  /** Whether the dependency overlay is enabled (dependency edges/nodes). */
  dependencyOverlay: boolean;
}

export interface VisibleGraph {
  nodes: RealtimeGraphNode[];
  edges: RealtimeGraphEdge[];
  /** Ids hidden purely because a parent is collapsed (expand affordance count). */
  collapsedChildCount: number;
}

// ── Root-scope membership (hierarchy narrowing) ───────────────────────────────

function inRootScope(node: RealtimeGraphNode, root: LivingGraphRootScope): boolean {
  switch (root.type) {
    case "project":
      return true;
    case "milestone":
      // The milestone itself, its tasks, and their subtasks.
      return (
        node.nodeId === `milestone:${root.id}` ||
        node.milestoneId === root.id ||
        (node.nodeKind === "milestone" && node.nodeId === root.id)
      );
    case "task":
      // The task itself + its subtasks (Subtask Map root scope).
      return node.nodeId === root.id || node.taskId === root.id || node.parentId === root.id;
    case "subtask":
      return node.nodeId === root.id || node.parentId === root.id;
    case "evidence_overlay":
      return true;
    default:
      return true;
  }
}

// ── Node visibility (policy + expansion + overlays) ───────────────────────────

export function isNodeVisible(node: RealtimeGraphNode, ctx: VisibilityContext): boolean {
  if (node.changeState === "removed") return false;
  if (!inRootScope(node, ctx.rootScope)) return false;

  switch (node.visibility) {
    case "default_visible":
      return true;
    case "visible_when_parent_expanded":
      // A subtask shows only when its parent task is expanded.
      return node.parentId != null && ctx.expandedIds.has(node.parentId);
    case "visible_when_branch_expanded":
      // A child subtask shows only when its parent subtask is expanded.
      return node.parentId != null && ctx.expandedIds.has(node.parentId);
    case "visible_in_evidence_overlay":
      return ctx.evidenceOverlay;
    case "visible_in_inspector_only":
      // Dependencies show on the dependency overlay; others stay inspector-only.
      return node.nodeKind === "dependency" ? ctx.dependencyOverlay : false;
    case "hidden_unauthorized":
    case "hidden_deleted_or_archived":
    case "hidden_out_of_scope":
      return false;
    default:
      return false;
  }
}

// ── Edge visibility (both endpoints visible + kind/overlay rules) ─────────────

export function isEdgeVisible(
  edge: RealtimeGraphEdge,
  visibleNodeIds: ReadonlySet<string>,
  ctx: VisibilityContext,
): boolean {
  if (edge.changeState === "removed") return false;
  // An edge is only drawable when both endpoints are visible.
  if (!visibleNodeIds.has(edge.sourceNodeId) || !visibleNodeIds.has(edge.targetNodeId)) return false;
  switch (edge.edgeKind) {
    case "hierarchy":
    case "milestone_flow":
      return true;
    case "dependency":
      return ctx.dependencyOverlay;
    case "evidence":
      return ctx.evidenceOverlay;
    default:
      return false;
  }
}

// ── Selector ──────────────────────────────────────────────────────────────────

export function selectVisibleGraph(model: RealtimeGraphViewModel, ctx: VisibilityContext): VisibleGraph {
  const nodes: RealtimeGraphNode[] = [];
  const visibleNodeIds = new Set<string>();
  let collapsedChildCount = 0;

  for (const node of Object.values(model.nodes)) {
    if (isNodeVisible(node, ctx)) {
      nodes.push(node);
      visibleNodeIds.add(node.nodeId);
    } else if (
      (node.visibility === "visible_when_parent_expanded" || node.visibility === "visible_when_branch_expanded") &&
      inRootScope(node, ctx.rootScope)
    ) {
      collapsedChildCount += 1;
    }
  }

  const edges = Object.values(model.edges).filter((e) => isEdgeVisible(e, visibleNodeIds, ctx));
  // Deterministic order for stable rendering/tests.
  nodes.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  edges.sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  return { nodes, edges, collapsedChildCount };
}

/**
 * The task nodes "Expand all" may expand, SCOPED to the current view — only
 * VISIBLE-in-scope task nodes that have subtasks (hasDescendants/directChildCount).
 * Never returns other milestones' tasks (they're outside the root scope).
 */
export function scopedExpandableNodeIds(model: RealtimeGraphViewModel, ctx: VisibilityContext): string[] {
  const ids: string[] = [];
  for (const node of Object.values(model.nodes)) {
    if (node.changeState === "removed") continue;
    if (!inRootScope(node, ctx.rootScope)) continue;
    const expandable =
      (node.nodeKind === "task" || node.nodeKind === "subtask") &&
      ((node.directChildCount ?? 0) > 0 || node.hasDescendants === true);
    if (expandable) ids.push(node.nodeId);
  }
  return ids.sort();
}
