// ============================================================================
// ProjectOps360° — Time Tracking Engine · RBAC (pure, deny-by-default)
// ============================================================================
// Who may do what with logged time:
//   log     — org manager (owner/admin ≈ Admin/PM), or the person responsible
//             for the work (subtask owner, or assignee of the parent task).
//   edit    — the author of the entry, or an org manager.
//   delete  — org managers only. Deleting effort erases Actual Cost history,
//             so it is never a contributor-level action.
//   read    — any org member; time is team information, not private.
//
// Logging time for SOMEONE ELSE is a manager action: a contributor may only
// record their own effort, otherwise attribution (and every utilisation or
// billing number built on it) stops meaning anything.
// ============================================================================

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export type TimeEntryAction = "log" | "edit" | "delete" | "read";

export interface TimeEntryAuthzInput {
  role: OrgRole;
  userId: string;
  action: TimeEntryAction;
  /** Owner of the subtask the time belongs to. */
  subtaskOwnerId?: string | null;
  /** Assignee of the parent task (covers subtasks with no explicit owner). */
  taskAssignedTo?: string | null;
  /** Who created the entry — only meaningful for edit/delete. */
  entryCreatedBy?: string | null;
  /** Whose effort the entry records — only meaningful for edit/delete. */
  entryUserId?: string | null;
  /** Whose effort is being logged, when different from the actor. */
  targetUserId?: string | null;
}

export interface TimeEntryAuthzDecision {
  allowed: boolean;
  reason: string;
}

const isManager = (role: OrgRole): boolean => role === "owner" || role === "admin";

export function authorizeTimeEntryAction(input: TimeEntryAuthzInput): TimeEntryAuthzDecision {
  if (input.action === "read") {
    return input.role === "viewer" || isManager(input.role) || input.role === "member"
      ? { allowed: true, reason: "org_member" }
      : { allowed: false, reason: "not_a_member" };
  }

  // Viewers never write.
  if (input.role === "viewer") return { allowed: false, reason: "viewer_read_only" };

  if (isManager(input.role)) return { allowed: true, reason: "org_manager" };

  // ── member ────────────────────────────────────────────────────────────────
  if (input.action === "delete") {
    return { allowed: false, reason: "delete_requires_manager" };
  }

  if (input.action === "log") {
    const responsible =
      (!!input.subtaskOwnerId && input.subtaskOwnerId === input.userId) ||
      (!!input.taskAssignedTo && input.taskAssignedTo === input.userId);
    if (!responsible) return { allowed: false, reason: "not_responsible_for_work" };
    // A contributor logs their own effort, never somebody else's.
    if (input.targetUserId && input.targetUserId !== input.userId) {
      return { allowed: false, reason: "cannot_log_for_others" };
    }
    return { allowed: true, reason: "responsible_for_work" };
  }

  // edit — the author may correct what they entered.
  const isAuthor =
    (!!input.entryCreatedBy && input.entryCreatedBy === input.userId) ||
    (!input.entryCreatedBy && !!input.entryUserId && input.entryUserId === input.userId);
  return isAuthor
    ? { allowed: true, reason: "entry_author" }
    : { allowed: false, reason: "not_entry_author" };
}
