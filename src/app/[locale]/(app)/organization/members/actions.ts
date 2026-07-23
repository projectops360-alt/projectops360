"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthEmailCallbackUrl } from "@/lib/auth/email-redirects.server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { SEAT_TYPES } from "@/lib/billing/config";

async function adminCtx() {
  let org;
  try { org = await getOrgContext(); } catch { return null; }
  if (org.role !== "owner" && org.role !== "admin") return null;
  return { org, supabase: createAdminClient() };
}

const SEAT_VALUES: string[] = SEAT_TYPES.map((s) => s.value);
const MEMBER_ROLE = (seat: string): string =>
  seat === "owner" ? "owner" : seat === "admin" ? "admin" : seat === "viewer_free" || seat === "external_free" ? "viewer" : "member";

/** Update a member's seat type, workspace role, status, department, job title. */
export async function updateMemberSeatAction(input: {
  memberId: string; billingSeatType?: string; workspaceRole?: string; status?: string; department?: string; jobTitle?: string;
}): Promise<{ error?: string }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };
  const patch: Record<string, unknown> = {};
  if (input.billingSeatType !== undefined && SEAT_VALUES.includes(input.billingSeatType)) {
    patch.billing_seat_type = input.billingSeatType;
    // Keep the legacy role column coherent with the seat type.
    patch.role = MEMBER_ROLE(input.billingSeatType);
  }
  if (input.workspaceRole !== undefined) patch.workspace_role = input.workspaceRole || null;
  if (input.status !== undefined && ["invited", "active", "suspended", "removed"].includes(input.status)) patch.status = input.status;
  if (input.department !== undefined) patch.department = input.department.trim() || null;
  if (input.jobTitle !== undefined) patch.job_title = input.jobTitle.trim() || null;
  if (Object.keys(patch).length === 0) return {};

  const { error } = await c.supabase.from("organization_members").update(patch).eq("id", input.memberId).eq("organization_id", c.org.organizationId);
  if (error) return { error: "unexpected" };
  await logAudit({ org: c.org, action: "update", entityType: "organization_members", entityId: input.memberId, metadata: patch });
  return {};
}

/** Rename a workspace collaborator (updates their display name). PMO/admin only. */
export async function renameWorkspaceUserAction(input: { userId: string; name: string }): Promise<{ error?: string }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };
  const name = (input.name ?? "").trim();
  if (!name) return { error: "empty_name" };
  if (name.length > 120) return { error: "name_too_long" };

  // Only rename users who belong to the caller's organization.
  const { data: member } = await c.supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", c.org.organizationId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!member) return { error: "not_found" };

  const { error } = await c.supabase.from("profiles").update({ display_name: name }).eq("id", input.userId);
  if (error) return { error: "unexpected" };
  await logAudit({ org: c.org, action: "update", entityType: "profiles", entityId: input.userId, metadata: { renamed_to: name } });
  return {};
}

/**
 * Manage a workspace membership and display name. Global identity changes are
 * intentionally rejected; only the account owner may change a verified email.
 */
export async function updateWorkspaceUserAction(input: {
  memberId: string; userId: string;
  name?: string; email?: string;
  billingSeatType?: string; workspaceRole?: string; status?: string;
  department?: string; jobTitle?: string;
  resourceId?: string; costRate?: number | null; costUnit?: string | null;
}): Promise<{ error?: string }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };

  const { data: targetMember } = await c.supabase
    .from("organization_members")
    .select("id")
    .eq("id", input.memberId)
    .eq("user_id", input.userId)
    .eq("organization_id", c.org.organizationId)
    .maybeSingle();
  if (!targetMember) return { error: "not_found" };

  // Workspace administrators manage memberships, not global Auth identities.
  // Email changes must be completed by the account owner through verification.
  if (input.email !== undefined) return { error: "identity_change_requires_user" };

  // Name (profiles.display_name) — never touch organization_id.
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "empty_name" };
    if (name.length > 120) return { error: "name_too_long" };
    await c.supabase.from("profiles").update({ display_name: name }).eq("id", input.userId);
  }

  // Membership fields.
  const patch: Record<string, unknown> = {};
  if (input.billingSeatType !== undefined && SEAT_VALUES.includes(input.billingSeatType)) {
    patch.billing_seat_type = input.billingSeatType;
    patch.role = MEMBER_ROLE(input.billingSeatType);
  }
  if (input.workspaceRole !== undefined) patch.workspace_role = input.workspaceRole || null;
  if (input.status !== undefined && ["invited", "active", "suspended", "removed"].includes(input.status)) {
    // Don't let an admin lock themselves out.
    if (input.userId === c.org.userId && input.status !== "active") return { error: "cannot_change_self_status" };
    patch.status = input.status;
  }
  if (input.department !== undefined) patch.department = input.department.trim() || null;
  if (input.jobTitle !== undefined) patch.job_title = input.jobTitle.trim() || null;

  if (Object.keys(patch).length > 0) {
    const { error } = await c.supabase.from("organization_members").update(patch).eq("id", input.memberId).eq("organization_id", c.org.organizationId);
    if (error) return { error: "unexpected" };
  }

  // Cost rates belong to the canonical resource, not to organization_members.
  // A user can be linked to a project resource; when no link exists yet, create
  // one organization-wide so PMO can start a rate card without changing access.
  if (input.costRate !== undefined || input.resourceId !== undefined) {
    const validRate = input.costRate == null ? null : Number(input.costRate);
    if (validRate != null && (!Number.isFinite(validRate) || validRate < 0 || validRate > 1_000_000)) return { error: "invalid_cost_rate" };
    const validUnits = ["hour", "day", "week", "month", "unit", "fixed"];
    if (input.costUnit != null && !validUnits.includes(input.costUnit)) return { error: "invalid_cost_unit" };

    const linkedQuery = input.resourceId
      ? c.supabase.from("resources").select("id").eq("id", input.resourceId).eq("organization_id", c.org.organizationId).eq("linked_user_id", input.userId).is("deleted_at", null).maybeSingle()
      : c.supabase.from("resources").select("id").eq("organization_id", c.org.organizationId).eq("linked_user_id", input.userId).is("deleted_at", null).is("project_id", null).order("created_at", { ascending: true }).limit(1).maybeSingle();
    const { data: linkedResource } = await linkedQuery;
    if (linkedResource) {
      const { error } = await c.supabase.from("resources").update({
        cost_rate: validRate,
        cost_unit: validRate == null ? null : (input.costUnit ?? "hour"),
      }).eq("id", linkedResource.id).eq("organization_id", c.org.organizationId);
      if (error) return { error: "unexpected" };
      await logAudit({ org: c.org, action: "update", entityType: "resources", entityId: linkedResource.id, metadata: { cost_rate_changed: true, cost_unit: validRate == null ? null : (input.costUnit ?? "hour") } });
    } else if (validRate != null) {
      const { data: createdResource, error } = await c.supabase.from("resources").insert({
        organization_id: c.org.organizationId,
        project_id: null,
        resource_type: "person",
        name: input.name?.trim() || input.userId,
        linked_user_id: input.userId,
        status: "active",
        cost_rate: validRate,
        cost_unit: input.costUnit ?? "hour",
        metadata: { origin: "workspace_user_rate_card" },
      }).select("id").single();
      if (error || !createdResource) return { error: "unexpected" };
      await logAudit({ org: c.org, action: "create", entityType: "resources", entityId: createdResource.id, metadata: { linked_user_rate_created: true } });
    }
  }

  await logAudit({ org: c.org, action: "update", entityType: "organization_members", entityId: input.memberId, metadata: { ...patch, renamed: input.name ? true : undefined, email_changed: input.email ? true : undefined } });
  return {};
}

/** Tenant administrators cannot reset another user's global Auth password. */
export async function resetWorkspaceUserPasswordAction(input: { userId: string; password: string }): Promise<{ error?: string }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };
  void input;
  return { error: "password_recovery_required" };
}

/**
 * Remove a workspace user from the organization — fully deletes the membership
 * (they no longer appear in the workspace). The auth account itself is left
 * intact (the person may belong to other orgs). PMO/admin only.
 */
export async function removeWorkspaceUserAction(input: { memberId: string; userId: string }): Promise<{ error?: string }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };
  if (input.userId === c.org.userId) return { error: "cannot_remove_self" };
  const { error } = await c.supabase.from("organization_members").delete()
    .eq("id", input.memberId).eq("organization_id", c.org.organizationId);
  if (error) return { error: "unexpected" };
  await logAudit({ org: c.org, action: "delete", entityType: "organization_members", entityId: input.memberId, metadata: { removed_user: input.userId } });
  return {};
}

/**
 * Global Auth-account deletion is reserved for a separately governed platform
 * operation. Tenant administrators may remove only their own membership.
 */
export async function deleteUserPermanentlyAction(input: { userId: string }): Promise<{ error?: string; activity?: number }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };
  void input;
  return { error: "platform_admin_required" };
}

/**
 * Create a login directly with an email + temporary password (no SMTP needed).
 * The person can sign in immediately; they are forced to change the password on
 * first login (must_change_password flag). PMO/admin only.
 *
 * Security: server-only service_role; owner/admin gate; email validated;
 * password length enforced; the password is never logged (audit records only
 * the email/seat); the user is attached to the caller's org with the right role.
 */
export async function createMemberWithPasswordAction(input: {
  email: string; password: string; displayName?: string; billingSeatType?: string; workspaceRole?: string;
}): Promise<{ error?: string; status?: "created" }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };

  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalid_email" };
  if (!input.password || input.password.length < 12) return { error: "weak_password" };

  const seat = SEAT_VALUES.includes(input.billingSeatType ?? "") ? input.billingSeatType! : "full_seat";
  const role = MEMBER_ROLE(seat);
  const displayName = input.displayName?.trim() || email.split("@")[0];

  try {
    const { data: created, error: createError } = await c.supabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { display_name: displayName, must_change_password: true },
    });
    if (createError || !created?.user) {
      const duplicate = createError?.code === "email_exists"
        || /already|registered|exists/i.test(createError?.message ?? "");
      return { error: duplicate ? "account_exists_invite_required" : "create_failed" };
    }
    const userId = created.user.id;

    // Set the name and make THIS org their active/default org. We must NOT touch
    // profiles.organization_id (a DB guard forbids changing it); the new user
    // keeps their auto-created personal org as home but defaults into this org.
    await c.supabase.from("profiles").update({ display_name: displayName, default_organization_id: c.org.organizationId }).eq("id", userId);
    // Add (or refresh) the membership in this org, active immediately.
    await c.supabase.from("organization_members").upsert(
      { organization_id: c.org.organizationId, user_id: userId, role, billing_seat_type: seat, workspace_role: input.workspaceRole || null, status: "active" },
      { onConflict: "organization_id,user_id" });

    // Audit — NEVER record the password.
    await logAudit({ org: c.org, action: "create", entityType: "organization_members", entityId: userId, metadata: { created_login: email, seat, status: "created" } });
    return { status: "created" };
  } catch {
    return { error: "create_failed" };
  }
}

/** Invite a new internal member by email (status = invited until accepted). */
export async function inviteMemberAction(input: { email: string; billingSeatType?: string; workspaceRole?: string }): Promise<{ error?: string; status?: "invited" }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };
  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalid_email" };
  const seat = SEAT_VALUES.includes(input.billingSeatType ?? "") ? input.billingSeatType! : "full_seat";
  const role = MEMBER_ROLE(seat);

  try {
    const redirectTo = await getAuthEmailCallbackUrl("/change-password?invite=1");
    const { data: invited, error: inviteErr } = await c.supabase.auth.admin.inviteUserByEmail(email, {
      data: { invited_to_org: c.org.organizationId },
      redirectTo,
    });
    if (inviteErr || !invited?.user) {
      const existingAccount = /already|registered|exists/i.test(inviteErr?.message ?? "");
      return { error: existingAccount ? "account_exists_invite_required" : "email_not_configured" };
    }
    await c.supabase.from("organization_members").upsert(
      { organization_id: c.org.organizationId, user_id: invited.user.id, role, billing_seat_type: seat, workspace_role: input.workspaceRole || null, status: "invited", invited_at: new Date().toISOString() },
      { onConflict: "organization_id,user_id" });
    await c.supabase.from("profiles").upsert({ id: invited.user.id, organization_id: c.org.organizationId });
    await logAudit({ org: c.org, action: "create", entityType: "organization_members", entityId: invited.user.id, metadata: { invited_email: email, seat } });
    return { status: "invited" };
  } catch {
    return { error: "email_not_configured" };
  }
}
