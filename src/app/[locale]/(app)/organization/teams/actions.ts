"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function ctx() {
  try { const org = await getOrgContext(); return { org, supabase: createAdminClient() }; }
  catch { return null; }
}

export async function createTeamAction(input: { name: string; description?: string; teamType?: string }): Promise<{ error?: string; id?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  if (!input.name?.trim()) return { error: "name_required" };
  const { data, error } = await c.supabase.from("organization_teams").insert({
    organization_id: c.org.organizationId, name: input.name.trim(),
    description: input.description?.trim() || null, team_type: input.teamType || null, created_by: c.org.userId,
  }).select("id").single();
  if (error || !data) return { error: "unexpected" };
  await logAudit({ org: c.org, action: "create", entityType: "organization_teams", entityId: data.id, metadata: { name: input.name } });
  return { id: data.id };
}

export async function updateTeamAction(input: { id: string; name?: string; description?: string; teamType?: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  if (input.teamType !== undefined) patch.team_type = input.teamType || null;
  const { error } = await c.supabase.from("organization_teams").update(patch).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

export async function deleteTeamAction(input: { id: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("organization_teams").update({ deleted_at: new Date().toISOString() }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

export async function addTeamMemberAction(input: {
  teamId: string; userId?: string; externalContactId?: string;
  roleInTeam?: string; defaultProjectRole?: string; defaultDeliveryRole?: string; defaultGovernanceRole?: string;
}): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  if (!input.userId && !input.externalContactId) return { error: "empty" };
  const { error } = await c.supabase.from("organization_team_members").insert({
    organization_id: c.org.organizationId, organization_team_id: input.teamId,
    user_id: input.userId || null, external_contact_id: input.externalContactId || null,
    role_in_team: input.roleInTeam?.trim() || null,
    default_project_role: input.defaultProjectRole?.trim() || null,
    default_delivery_role: input.defaultDeliveryRole?.trim() || null,
    default_governance_role: input.defaultGovernanceRole?.trim() || null,
  });
  return error ? { error: "unexpected" } : {};
}

export async function removeTeamMemberAction(input: { id: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("organization_team_members").delete().eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}
