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
