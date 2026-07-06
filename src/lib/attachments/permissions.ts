// ============================================================================
// ProjectOps360° — Task & Subtask Attachments · RBAC (pure, deny-by-default)
// ============================================================================
// Mirrors the platform role model (org roles + task ownership), aligned with
// the Subtasks permission module:
//   - owner/admin (PM/PMO/Admin): every attachment action, including removing
//     anyone's attachment.
//   - member: may view, and upload to any task/subtask in a project they can
//     access; may remove ONLY their own attachment (contributor-own-work).
//   - viewer: read-only — list/view/download, never upload or remove.
// Project/org scoping (the file belongs to the caller's org + project) is
// enforced separately in the server action; this module decides the ACTION
// given an already-scoped context. Deny-by-default. Tested by permissions.test.ts.
// ============================================================================

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export type AttachmentAction = "list" | "view" | "upload" | "remove";

export interface AttachmentAuthzInput {
  role: OrgRole;
  userId: string;
  action: AttachmentAction;
  /** Who uploaded the attachment (null for list/upload where it is N/A). */
  uploadedById?: string | null;
}

export interface AttachmentAuthzDecision {
  allowed: boolean;
  reason: string;
}

export function authorizeAttachmentAction(
  input: AttachmentAuthzInput,
): AttachmentAuthzDecision {
  const isManager = input.role === "owner" || input.role === "admin";

  // Managers can do everything.
  if (isManager) return { allowed: true, reason: "org_manager" };

  // Read is available to every role with project access (list/view/download).
  if (input.action === "list" || input.action === "view") {
    return { allowed: true, reason: "read_access" };
  }

  // Viewers are read-only beyond this point.
  if (input.role === "viewer") return { allowed: false, reason: "viewer_read_only" };

  // Members may upload.
  if (input.action === "upload") return { allowed: true, reason: "member_can_upload" };

  // Members may remove only their own attachment.
  if (input.action === "remove") {
    const ownsIt = !!input.uploadedById && input.uploadedById === input.userId;
    return ownsIt
      ? { allowed: true, reason: "own_attachment" }
      : { allowed: false, reason: "not_own_attachment" };
  }

  return { allowed: false, reason: "denied" };
}
