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

/** Display info for an assignee (person or group resource). Real data only. */
export interface AssigneeInfo {
  name: string | null;
  /** Project role (person) or resource type — null when unknown (never invented). */
  role: string | null;
  avatarUrl: string | null;
}

export type TaskOwner =
  | { state: "unassigned" }
  /** An owner id is set but no name could be resolved (lookup failed). */
  | { state: "unavailable"; id: string }
  | {
      state: "assigned";
      id: string;
      name: string;
      role: string | null;
      avatarUrl: string | null;
      initials: string;
    };

/** The id of whoever owns the task: the person, else the assigned resource, else null. */
export function resolveTaskOwnerId(task: TaskOwnerInput): string | null {
  return task.assigned_to || task.assigned_resource_id || null;
}

/** Up to two uppercase initials from a display name (e.g. "Efraín Prada" → "EP"). */
export function ownerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Resolve full owner display state for a Workboard card:
 *   • assigned    → person/resource with a resolved name (+ optional role/avatar).
 *   • unavailable → an owner id exists but no name resolved (show "Assigned user unavailable").
 *   • unassigned  → no owner at all.
 * Real data only — never invents a name, role, or avatar.
 */
export function resolveTaskOwner(
  task: TaskOwnerInput,
  assignees: Record<string, AssigneeInfo>,
): TaskOwner {
  const id = resolveTaskOwnerId(task);
  if (!id) return { state: "unassigned" };
  const info = assignees[id];
  if (!info || !info.name || !info.name.trim()) return { state: "unavailable", id };
  return {
    state: "assigned",
    id,
    name: info.name,
    role: info.role && info.role.trim() ? info.role : null,
    avatarUrl: info.avatarUrl,
    initials: ownerInitials(info.name),
  };
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
