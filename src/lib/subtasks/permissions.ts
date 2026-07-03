// ============================================================================
// ProjectOps360° — Subtasks · RBAC (pure, deny-by-default, tested)
// ============================================================================
// Respects the existing permission model (org roles + task ownership):
// - owner/admin (PM/PMO/Admin level): every subtask action.
// - member: may create subtasks and update subtasks they own or subtasks of a
//   task assigned to them (contributor-own-work rule); never restricted ops.
// - viewer: read-only — no writes.
// Restricted actions (delete, parent progress override, close parent with
// incomplete subtasks) are owner/admin ONLY and always audited.
// ============================================================================

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export type SubtaskAction =
  | "create"
  | "update"
  | "complete"
  | "block"
  | "unblock"
  | "reassign"
  | "update_progress"
  | "delete"
  | "override_parent_progress"
  | "close_parent_with_incomplete";

const RESTRICTED: ReadonlySet<SubtaskAction> = new Set([
  "delete",
  "override_parent_progress",
  "close_parent_with_incomplete",
]);

export interface SubtaskAuthzInput {
  role: OrgRole;
  userId: string;
  action: SubtaskAction;
  /** The subtask's owner (null for create / parent-level actions). */
  subtaskOwnerId?: string | null;
  /** The parent task's assignee, for the contributor-own-work rule. */
  taskAssignedTo?: string | null;
}

export function authorizeSubtaskAction(input: SubtaskAuthzInput): { allowed: boolean; reason: string } {
  if (input.role === "owner" || input.role === "admin") {
    return { allowed: true, reason: "org_manager" };
  }
  if (input.role === "viewer") return { allowed: false, reason: "viewer_read_only" };
  // member
  if (RESTRICTED.has(input.action)) return { allowed: false, reason: "restricted_action_requires_manager" };
  if (input.action === "create") return { allowed: true, reason: "member_can_create" };
  const ownsSubtask = !!input.subtaskOwnerId && input.subtaskOwnerId === input.userId;
  const ownsTask = !!input.taskAssignedTo && input.taskAssignedTo === input.userId;
  if (ownsSubtask || ownsTask) return { allowed: true, reason: "own_work" };
  return { allowed: false, reason: "not_own_work" };
}
