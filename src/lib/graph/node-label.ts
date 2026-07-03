// ============================================================================
// ProjectOps360° — Living Graph canonical node label (pure)
// ============================================================================
// "Different views, same truth" (REG-018 / CAP-001) extended to LABELS: a
// Living Graph node's display label must come from the CANONICAL owner
// (roadmap_tasks.title / milestones.title) so the graph shows the same title
// as the Workboard — never a stale process_node snapshot captured at event
// time (a task renamed after its last transition kept the old title on its
// process_node). Non-canonical node types (decisions, documents, …) fall back
// to the process_node title, which is their own record's title.
// ============================================================================

export interface CanonicalNodeLabelInput {
  /** The process_node.title (captured at event time — may be stale). */
  processTitle: string;
  /** roadmap_tasks.title when the node is a task, else null/undefined. */
  taskTitle?: string | null;
  /** milestones.title when the node is a milestone, else null/undefined. */
  milestoneTitle?: string | null;
}

/**
 * Resolve the label to display for a Living Graph node: prefer the canonical
 * task/milestone title, fall back to the process_node title. Pure.
 */
export function resolveCanonicalNodeLabel(input: CanonicalNodeLabelInput): string {
  const task = input.taskTitle?.trim();
  if (task) return task;
  const milestone = input.milestoneTitle?.trim();
  if (milestone) return milestone;
  return input.processTitle;
}
