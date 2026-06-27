// ============================================================================
// ProjectOps360° — Task ownership resolution (Sprint #1, Workboard visibility)
// ============================================================================
// Pure, deterministic helpers that resolve who owns a task for display on the
// Workboard. Real data only — never invents a name. A task can be assigned to a
// person (assigned_to → profiles) or a group resource (assigned_resource_id →
// resources). When neither resolves, the card shows the "Unassigned" state.
// ============================================================================

export interface TaskOwnerInput {
  assigned_to: string | null;
  assigned_resource_id: string | null;
}

/** The id of whoever owns the task: the person, else the assigned resource, else null. */
export function resolveTaskOwnerId(task: TaskOwnerInput): string | null {
  return task.assigned_to || task.assigned_resource_id || null;
}

/**
 * The display name of the task owner, or null when unassigned OR when the owner
 * id cannot be resolved to a name (lookup failure → treated as unassigned, never
 * a fabricated name). `names` maps user/resource id → display name.
 */
export function resolveTaskOwnerName(
  task: TaskOwnerInput,
  names: Record<string, string>,
): string | null {
  const id = resolveTaskOwnerId(task);
  if (!id) return null;
  const name = names[id];
  return name && name.trim() ? name : null;
}
