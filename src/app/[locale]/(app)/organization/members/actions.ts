"use server";

import { createAdminClient } from "@/lib/supabase/admin";
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
}): Promise<{ error?: string; status?: "created" | "linked" }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };

  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalid_email" };
  if (!input.password || input.password.length < 8) return { error: "weak_password" };

  const seat = SEAT_VALUES.includes(input.billingSeatType ?? "") ? input.billingSeatType! : "full_seat";
  const role = MEMBER_ROLE(seat);
  const displayName = input.displayName?.trim() || email.split("@")[0];

  try {
    const { data: list } = await c.supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);

    let userId: string;
    let status: "created" | "linked";
    if (existing) {
      // Account exists — (re)set the temporary password and link into this org.
      userId = existing.id;
      status = "linked";
      await c.supabase.auth.admin.updateUserById(userId, {
        password: input.password,
        user_metadata: { ...(existing.user_metadata ?? {}), must_change_password: true },
      });
    } else {
      const { data: created, error: cErr } = await c.supabase.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true, // no SMTP confirmation needed
        user_metadata: { display_name: displayName, must_change_password: true },
      });
      if (cErr || !created?.user) return { error: "create_failed" };
      userId = created.user.id;
      status = "created";
    }

    // Set the name and make THIS org their active/default org. We must NOT touch
    // profiles.organization_id (a DB guard forbids changing it); the new user
    // keeps their auto-created personal org as home but defaults into this org.
    await c.supabase.from("profiles").update({ display_name: displayName, default_organization_id: c.org.organizationId }).eq("id", userId);
    // Add (or refresh) the membership in this org, active immediately.
    await c.supabase.from("organization_members").upsert(
      { organization_id: c.org.organizationId, user_id: userId, role, billing_seat_type: seat, workspace_role: input.workspaceRole || null, status: "active" },
      { onConflict: "organization_id,user_id" });

    // Audit — NEVER record the password.
    await logAudit({ org: c.org, action: "create", entityType: "organization_members", entityId: userId, metadata: { created_login: email, seat, status } });
    return { status };
  } catch {
    return { error: "create_failed" };
  }
}

/** Invite a new internal member by email (status = invited until accepted). */
export async function inviteMemberAction(input: { email: string; billingSeatType?: string; workspaceRole?: string }): Promise<{ error?: string; status?: "linked" | "invited" }> {
  const c = await adminCtx();
  if (!c) return { error: "not_allowed" };
  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "invalid_email" };
  const seat = SEAT_VALUES.includes(input.billingSeatType ?? "") ? input.billingSeatType! : "full_seat";
  const role = MEMBER_ROLE(seat);

  try {
    const { data: list } = await c.supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);

    if (existing) {
      await c.supabase.from("organization_members").upsert(
        { organization_id: c.org.organizationId, user_id: existing.id, role, billing_seat_type: seat, workspace_role: input.workspaceRole || null, status: "active" },
        { onConflict: "organization_id,user_id" });
      await c.supabase.from("profiles").upsert({ id: existing.id, organization_id: c.org.organizationId });
      return { status: "linked" };
    }

    const { data: invited, error: inviteErr } = await c.supabase.auth.admin.inviteUserByEmail(email, { data: { invited_to_org: c.org.organizationId } });
    if (inviteErr || !invited?.user) return { error: "email_not_configured" };
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
