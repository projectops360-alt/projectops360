"use server";

// ============================================================================
// Team — Resource management server actions
// ============================================================================
// Manage the people / crews / vendors (project `resources`) surfaced on the
// Team page: add, edit, merge duplicates, archive, and invite as a workspace
// user. All org-scoped via the session context.
// ============================================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { planMerge, type MergeableResource } from "@/lib/team/merge";

const ASSIGNABLE_TYPES = ["person", "crew", "team", "role", "vendor", "subcontractor"] as const;

// Tables that reference resources.id and must follow a merge.
const RESOURCE_REF_TABLES: { table: string; column: string }[] = [
  { table: "roadmap_tasks", column: "assigned_resource_id" },
  { table: "resource_assignments", column: "resource_id" },
  { table: "material_requirements", column: "resource_id" },
  { table: "cost_actuals", column: "resource_id" },
];

// ── Create ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "nameRequired").max(200).transform((s) => s.trim()),
  resourceType: z.enum(ASSIGNABLE_TYPES).default("person"),
  trade: z.string().max(80).optional().default(""),
  projectId: z.string().uuid().nullable().optional(),
});

export async function createTeamResourceAction(input: {
  name: string;
  resourceType?: string;
  trade?: string;
  projectId?: string | null;
}): Promise<{ error?: string; resourceId?: string }> {
  let org;
  try { org = await getOrgContext(); } catch { return { error: "not_authenticated" }; }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "validation_error" };
  const d = parsed.data;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("resources")
    .insert({
      organization_id: org.organizationId,
      project_id: d.projectId ?? null,
      resource_type: d.resourceType,
      name: d.name,
      trade_key: d.trade || null,
      status: "active",
      metadata: { origin: "team_page" },
    })
    .select("id")
    .single();
  if (error || !data) return { error: "unexpected" };
  await logAudit({ org, projectId: d.projectId ?? undefined, action: "create", entityType: "resources", entityId: data.id, metadata: { name: d.name, type: d.resourceType } });
  revalidatePath("/(app)/team", "page");
  return { resourceId: data.id };
}

// ── Update ───────────────────────────────────────────────────────────────────

const updateSchema = z.object({
  resourceId: z.string().uuid(),
  name: z.string().min(1, "nameRequired").max(200).transform((s) => s.trim()),
  resourceType: z.enum(ASSIGNABLE_TYPES),
  trade: z.string().max(80).optional().default(""),
  costRate: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  costUnit: z.enum(["hour", "day", "week", "month", "unit", "fixed"]).nullable().optional(),
  status: z.enum(["active", "inactive", "unavailable", "retired"]).default("active"),
});

export async function updateTeamResourceAction(input: {
  resourceId: string;
  name: string;
  resourceType: string;
  trade?: string;
  costRate?: number | null;
  costUnit?: string | null;
  status?: string;
}): Promise<{ error?: string }> {
  let org;
  try { org = await getOrgContext(); } catch { return { error: "not_authenticated" }; }
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "validation_error" };
  const d = parsed.data;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("resources")
    .update({
      name: d.name,
      resource_type: d.resourceType,
      trade_key: d.trade || null,
      cost_rate: d.costRate ?? null,
      cost_unit: d.costRate != null ? (d.costUnit ?? "hour") : null,
      status: d.status,
    })
    .eq("id", d.resourceId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  if (error) return { error: "unexpected" };
  await logAudit({ org, action: "update", entityType: "resources", entityId: d.resourceId, metadata: { name: d.name } });
  revalidatePath("/(app)/team", "page");
  return {};
}

// ── Merge duplicates ────────────────────────────────────────────────────────

export async function mergeTeamResourcesAction(input: { resourceIds: string[] }): Promise<{ error?: string; keptId?: string; merged?: number }> {
  let org;
  try { org = await getOrgContext(); } catch { return { error: "not_authenticated" }; }
  const ids = [...new Set((input.resourceIds ?? []).filter((id) => z.string().uuid().safeParse(id).success))];
  if (ids.length < 2) return { error: "need_two" };

  const supabase = createAdminClient();
  // Load only the caller's org resources from the requested set.
  const { data: rows } = await supabase
    .from("resources")
    .select("id, linked_user_id")
    .in("id", ids)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  if (!rows || rows.length < 2) return { error: "need_two" };

  // Usage weight per resource (distinct project references on tasks).
  const usage = new Map<string, number>();
  for (const id of rows.map((r) => r.id)) usage.set(id, 0);
  const { data: taskRefs } = await supabase
    .from("roadmap_tasks").select("assigned_resource_id").in("assigned_resource_id", rows.map((r) => r.id)).is("deleted_at", null);
  for (const t of taskRefs ?? []) if (t.assigned_resource_id) usage.set(t.assigned_resource_id, (usage.get(t.assigned_resource_id) ?? 0) + 1);

  const mergeable: MergeableResource[] = rows.map((r) => ({ id: r.id, linkedUserId: r.linked_user_id, usage: usage.get(r.id) ?? 0 }));
  const plan = planMerge(mergeable);
  if (!plan) return { error: "need_two" };

  // Reassign every reference from merged ids → kept id.
  for (const { table, column } of RESOURCE_REF_TABLES) {
    await supabase.from(table).update({ [column]: plan.keepId }).in(column, plan.mergeIds).eq("organization_id", org.organizationId);
  }
  // Soft-delete the folded-in resources.
  await supabase.from("resources").update({ deleted_at: new Date().toISOString() }).in("id", plan.mergeIds).eq("organization_id", org.organizationId);

  await logAudit({ org, action: "update", entityType: "resources", entityId: plan.keepId, metadata: { merged_ids: plan.mergeIds } });
  revalidatePath("/(app)/team", "page");
  return { keptId: plan.keepId, merged: plan.mergeIds.length };
}

// ── Archive ──────────────────────────────────────────────────────────────────

export async function archiveTeamResourceAction(input: { resourceId: string }): Promise<{ error?: string }> {
  let org;
  try { org = await getOrgContext(); } catch { return { error: "not_authenticated" }; }
  if (!z.string().uuid().safeParse(input.resourceId).success) return { error: "validation_error" };
  const supabase = createAdminClient();
  // Detach references so tasks don't point at an archived resource.
  for (const { table, column } of RESOURCE_REF_TABLES) {
    await supabase.from(table).update({ [column]: null }).eq(column, input.resourceId).eq("organization_id", org.organizationId);
  }
  const { error } = await supabase
    .from("resources").update({ deleted_at: new Date().toISOString(), status: "retired" })
    .eq("id", input.resourceId).eq("organization_id", org.organizationId).is("deleted_at", null);
  if (error) return { error: "unexpected" };
  await logAudit({ org, action: "delete", entityType: "resources", entityId: input.resourceId, metadata: { archived: true } });
  revalidatePath("/(app)/team", "page");
  return {};
}

// ── Invite as workspace user ─────────────────────────────────────────────────

const inviteSchema = z.object({
  resourceId: z.string().uuid(),
  email: z.string().email("invalid_email").max(200),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

/**
 * Promote a resource (person) to a workspace user by email.
 * If the email already has an account it is linked into the org; otherwise an
 * invite email is sent via Supabase Auth (requires the project's email/SMTP to
 * be configured — the action reports clearly when it is not).
 */
export async function inviteResourceAsUserAction(input: {
  resourceId: string;
  email: string;
  role?: string;
}): Promise<{ error?: string; status?: "linked" | "invited" }> {
  let org;
  try { org = await getOrgContext(); } catch { return { error: "not_authenticated" }; }
  if (org.role !== "owner" && org.role !== "admin") return { error: "not_allowed" };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "validation_error" };
  const d = parsed.data;

  const supabase = createAdminClient();
  const { data: resource } = await supabase
    .from("resources").select("id, name").eq("id", d.resourceId).eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!resource) return { error: "not_found" };

  // Already a member?
  const { data: existingProfiles } = await supabase
    .from("profiles").select("id").eq("organization_id", org.organizationId);
  // (We can't read auth.users emails via PostgREST; rely on admin API below.)

  try {
    // 1) Look for an existing auth user with this email.
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === d.email.toLowerCase());

    if (existing) {
      // Link into org: membership + profile + resource link.
      await supabase.from("organization_members").upsert(
        { organization_id: org.organizationId, user_id: existing.id, role: d.role },
        { onConflict: "organization_id,user_id" },
      );
      const alreadyProfile = (existingProfiles ?? []).some((p) => p.id === existing.id);
      if (!alreadyProfile) {
        await supabase.from("profiles").upsert({ id: existing.id, organization_id: org.organizationId, display_name: resource.name });
      }
      await supabase.from("resources").update({ linked_user_id: existing.id }).eq("id", d.resourceId);
      await logAudit({ org, action: "update", entityType: "resources", entityId: d.resourceId, metadata: { linked_user: existing.id, email: d.email } });
      revalidatePath("/(app)/team", "page");
      return { status: "linked" };
    }

    // 2) Send an invite email (Supabase Auth). Requires SMTP/email config.
    const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(d.email, {
      data: { display_name: resource.name, invited_to_org: org.organizationId },
    });
    if (inviteErr || !invited?.user) {
      return { error: "email_not_configured" };
    }
    await supabase.from("organization_members").upsert(
      { organization_id: org.organizationId, user_id: invited.user.id, role: d.role },
      { onConflict: "organization_id,user_id" },
    );
    await supabase.from("profiles").upsert({ id: invited.user.id, organization_id: org.organizationId, display_name: resource.name });
    await supabase.from("resources").update({ linked_user_id: invited.user.id }).eq("id", d.resourceId);
    await logAudit({ org, action: "create", entityType: "organization_members", entityId: invited.user.id, metadata: { invited_email: d.email, from_resource: d.resourceId } });
    revalidatePath("/(app)/team", "page");
    return { status: "invited" };
  } catch {
    return { error: "email_not_configured" };
  }
}
