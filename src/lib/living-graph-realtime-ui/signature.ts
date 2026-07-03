// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · Graph Signature (pure)
// ============================================================================
// A stable, cheap content signature of the graph's canonical state, used by
// the polling sync (the LGRE "polling" delivery fallback) to detect when a
// task status / progress / membership change means the client must refetch the
// snapshot. It changes iff something the graph shows changed — moving a task
// In Progress → Done flips its status token and thus the signature. Pure.
// ============================================================================

export interface SignatureRow {
  id: string;
  /** status/progress token — whatever affects the visible graph. */
  token: string;
}

/**
 * Compute a deterministic signature from the milestone/task/subtask status
 * tokens. Order-independent (rows are sorted) so it's stable across queries.
 */
export function computeGraphSignature(
  milestones: readonly SignatureRow[],
  tasks: readonly SignatureRow[],
  subtasks: readonly SignatureRow[],
): string {
  const part = (rows: readonly SignatureRow[]) =>
    [...rows]
      .map((r) => `${r.id}:${r.token}`)
      .sort()
      .join("|");
  return `m[${part(milestones)}]t[${part(tasks)}]s[${part(subtasks)}]`;
}
