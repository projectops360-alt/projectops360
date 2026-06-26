"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { SEAT_TYPES, workspaceRoleToOrgRole, seatTypeToOrgRole } from "@/lib/billing/config";

// This section is for PM and PMO roles only (plus legacy owner/admin).
async function adminCtx() {
  let org;
  try { org = await getOrgContext(); } catch { return null; }
  const allowed = org.isPmoLevel || org.orgRole === "PROJECT_MANAGER" || org.role === "owner" || org.role === "admin";
  if (!allowed) return null;
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
  if (input.workspaceRole !== undefined) {
    patch.workspace_role = input.workspaceRole || null;
    // Keep the enforced org_role coherent with the chosen workspace role.
    if (input.workspaceRole) patch.org_role = workspaceRoleToOrgRole(input.workspaceRole);
  }
  if (input.status !== undefined && ["invited", "active", "suspended", "removed"].includes(input.status)) patch.status = input.status;
  if (input.department !== undefined) patch.department = input.department.trim() || null;
  if (input.jobTitle !== undefined) patch.job_title = input.jobTitle.trim() || null;
  if (Object.keys(patch).length === 0) return {};

  const { error } = await c.supabase.from("organization_members").update(patch).eq("id", input.memberId).eq("organization_id", c.org.organizationId);
  if (error) return { error: "unexpected" };
  await logAudit({ org: c.org, action: "update", entityType: "organization_members", entityId: input.memberId, metadata: patch });
  return {};
}

/** Create a login directly with an email + temporary password (no SMTP needed).
 *  The person can sign in immediately and change the password later in Settings. */
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
  const orgRole = input.workspaceRole ? workspaceRoleToOrgRole(input.workspaceRole) : seatTypeToOrgRole(seat);
  const displayName = input.displayName?.trim() || email.split("@")[0];

  try {
    const { data: list } = await c.supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);

    let userId: string;
    let status: "created" | "linked";
    if (existing) {
      userId = existing.id;
      status = "linked";
      // Optionally (re)set the password for an existing account.
      await c.supabase.auth.admin.updateUserById(userId, { password: input.password });
    } else {
      const { data: created, error: cErr } = await c.supabase.auth.admin.createUser({
        email, password: input.password, email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (cErr || !created?.user) return { error: "create_failed" };
      userId = created.user.id;
      status = "created";
    }

    // Attach to THIS org (the signup trigger may have created a separate personal
    // org; we add membership here and make this the user's default org).
    await c.supabase.from("organization_members").upsert(
      { organization_id: c.org.organizationId, user_id: userId, role, org_role: orgRole, billing_seat_type: seat, workspace_role: input.workspaceRole || null, status: "active" },
      { onConflict: "organization_id,user_id" });
    const { data: prof } = await c.supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (prof) {
      await c.supabase.from("profiles").update({ default_organization_id: c.org.organizationId, display_name: displayName }).eq("id", userId);
    } else {
      await c.supabase.from("profiles").insert({ id: userId, organization_id: c.org.organizationId, default_organization_id: c.org.organizationId, display_name: displayName });
    }

    await logAudit({ org: c.org, action: "create", entityType: "organization_members", entityId: userId, metadata: { created_login: email, seat, org_role: orgRole, status } });
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
  const orgRole = input.workspaceRole ? workspaceRoleToOrgRole(input.workspaceRole) : seatTypeToOrgRole(seat);

  // Ensure a profile exists for a user WITHOUT moving an existing user's org.
  // profiles.organization_id is single-binding and protected by a DB trigger;
  // membership lives in organization_members, so we only create a profile when
  // the user has none (e.g. a brand-new invited user).
  async function ensureProfile(userId: string) {
    const { data: existingProfile } = await c!.supabase
      .from("profiles").select("id, default_organization_id").eq("id", userId).maybeSingle();
    if (!existingProfile) {
      await c!.supabase.from("profiles").insert({ id: userId, organization_id: c!.org.organizationId, default_organization_id: c!.org.organizationId });
    }
    // Do NOT overwrite organization_id for users who already have a profile.
  }

  try {
    const { data: list } = await c.supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);

    if (existing) {
      await c.supabase.from("organization_members").upsert(
        { organization_id: c.org.organizationId, user_id: existing.id, role, org_role: orgRole, billing_seat_type: seat, workspace_role: input.workspaceRole || null, status: "active" },
        { onConflict: "organization_id,user_id" });
      await ensureProfile(existing.id);
      await logAudit({ org: c.org, action: "create", entityType: "organization_members", entityId: existing.id, metadata: { linked_email: email, seat, org_role: orgRole } });
      return { status: "linked" };
    }

    const { data: invited, error: inviteErr } = await c.supabase.auth.admin.inviteUserByEmail(email, { data: { invited_to_org: c.org.organizationId } });
    if (inviteErr || !invited?.user) return { error: "email_not_configured" };
    await c.supabase.from("organization_members").upsert(
      { organization_id: c.org.organizationId, user_id: invited.user.id, role, org_role: orgRole, billing_seat_type: seat, workspace_role: input.workspaceRole || null, status: "invited", invited_at: new Date().toISOString() },
      { onConflict: "organization_id,user_id" });
    await ensureProfile(invited.user.id);
    await logAudit({ org: c.org, action: "create", entityType: "organization_members", entityId: invited.user.id, metadata: { invited_email: email, seat, org_role: orgRole } });
    return { status: "invited" };
  } catch {
    return { error: "email_not_configured" };
  }
}
