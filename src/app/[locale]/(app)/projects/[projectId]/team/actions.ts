"use server";

// ============================================================================
// Project Team & Roles Center — server actions.
// Project team members are OPERATIONAL, not billing entities. Adding someone
// here never creates a billable seat.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Locale } from "@/types/database";
import { PERMISSION_PRESETS, PERMISSION_FLAGS } from "@/lib/team-roles/config";
import { recordTeamMemory } from "@/lib/team-roles/service";

async function ctx() {
  try { const org = await getOrgContext(); return { org, supabase: createAdminClient() }; }
  catch { return null; }
}

function flagsFor(level: string, overrides?: Record<string, boolean>): Record<string, boolean> {
  const preset = PERMISSION_PRESETS[level] ?? PERMISSION_PRESETS.contributor;
  const out: Record<string, boolean> = {};
  for (const f of PERMISSION_FLAGS) out[f] = overrides?.[f] ?? preset[f];
  return out;
}

export interface ProjectMemberInput {
  member_type?: string;
  user_id?: string | null;
  external_contact_id?: string | null;
  organization_team_id?: string | null;
  display_name?: string | null;
  project_role?: string;
  delivery_role?: string;
  governance_role?: string;
  responsibility?: string;
  authority_level?: string;
  allocation_percentage?: number | null;
  permission_level?: string;
  flags?: Record<string, boolean>;
}

function buildRow(orgId: string, projectId: string, m: ProjectMemberInput) {
  const level = m.permission_level || "contributor";
  return {
    organization_id: orgId, project_id: projectId,
    member_type: m.member_type || "internal_user",
    user_id: m.user_id || null,
    external_contact_id: m.external_contact_id || null,
    organization_team_id: m.organization_team_id || null,
    display_name: m.display_name?.trim() || null,
    project_role: m.project_role?.trim() || null,
    delivery_role: m.delivery_role?.trim() || null,
    governance_role: m.governance_role?.trim() || null,
    responsibility: m.responsibility?.trim() || null,
    authority_level: m.authority_level?.trim() || null,
    allocation_percentage: m.allocation_percentage ?? null,
    permission_level: level,
    ...flagsFor(level, m.flags),
    status: "active",
  };
}

// ── Add a single member (manual / directory / external) ─────────────────────

export async function addProjectMemberAction(input: { projectId: string; member: ProjectMemberInput; locale: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const m = input.member;
  if (!m.user_id && !m.external_contact_id && !m.display_name?.trim() && !m.project_role?.trim())
    return { error: "empty" };
  const { error } = await c.supabase.from("project_team_members").insert(buildRow(c.org.organizationId, input.projectId, m));
  if (error) return { error: "unexpected" };
  await logAudit({ org: c.org, projectId: input.projectId, action: "create", entityType: "project_team_members", entityId: input.projectId, metadata: { role: m.project_role } });
  void recordTeamMemory(c.org, input.projectId, { title: `Team member added: ${m.display_name || m.project_role || "member"}`, content: `${m.project_role ?? ""} · ${m.permission_level ?? ""}`, tag: "project_team" });
  return {};
}

// ── Add an entire company team → expand to project members ──────────────────

export async function addCompanyTeamToProjectAction(input: { projectId: string; teamId: string; locale: string }): Promise<{ error?: string; added?: number }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { data: tm } = await c.supabase.from("organization_team_members").select("*")
    .eq("organization_team_id", input.teamId).eq("organization_id", c.org.organizationId);
  const teamMembers = (tm ?? []) as Record<string, unknown>[];
  if (teamMembers.length === 0) return { added: 0 };

  // Resolve display names for internal users.
  const userIds = teamMembers.map((m) => m.user_id).filter(Boolean) as string[];
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await c.supabase.from("profiles").select("id, display_name").in("id", userIds);
    for (const p of profiles ?? []) nameById.set(String((p as Record<string, unknown>).id), String((p as Record<string, unknown>).display_name ?? ""));
  }

  // Skip members already on the project (by user_id / external_contact_id).
  const { data: existing } = await c.supabase.from("project_team_members").select("user_id, external_contact_id")
    .eq("project_id", input.projectId).eq("organization_id", c.org.organizationId).neq("status", "removed");
  const haveUsers = new Set((existing ?? []).map((e) => String((e as Record<string, unknown>).user_id)).filter(Boolean));
  const haveExt = new Set((existing ?? []).map((e) => String((e as Record<string, unknown>).external_contact_id)).filter(Boolean));

  const rows = teamMembers
    .filter((m) => (m.user_id ? !haveUsers.has(String(m.user_id)) : m.external_contact_id ? !haveExt.has(String(m.external_contact_id)) : true))
    .map((m) => buildRow(c.org.organizationId, input.projectId, {
      member_type: "group_imported",
      user_id: (m.user_id as string) || null,
      external_contact_id: (m.external_contact_id as string) || null,
      organization_team_id: input.teamId,
      display_name: m.user_id ? (nameById.get(String(m.user_id)) || null) : null,
      project_role: (m.default_project_role as string) || (m.role_in_team as string) || undefined,
      delivery_role: (m.default_delivery_role as string) || undefined,
      governance_role: (m.default_governance_role as string) || undefined,
      permission_level: "contributor",
    }));
  if (rows.length === 0) return { added: 0 };
  const { error } = await c.supabase.from("project_team_members").insert(rows);
  if (error) return { error: "unexpected" };
  void recordTeamMemory(c.org, input.projectId, { title: `Company team imported (${rows.length} members)`, content: `Team ${input.teamId}`, tag: "project_team" });
  return { added: rows.length };
}

// ── Add a stakeholder viewer (free, light access) ───────────────────────────

export async function addStakeholderViewerAction(input: {
  projectId: string; name: string; email?: string; externalContactId?: string; userId?: string;
  accessLevel?: string; canApprove?: boolean; canComment?: boolean; locale: string;
}): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  if (!input.name?.trim() && !input.externalContactId && !input.userId) return { error: "empty" };
  const { error } = await c.supabase.from("stakeholder_access").insert({
    organization_id: c.org.organizationId, project_id: input.projectId,
    user_id: input.userId || null, external_contact_id: input.externalContactId || null,
    display_name: input.name?.trim() || null,
    access_level: input.accessLevel || "viewer",
    can_view_summary: true, can_view_reports: true,
    can_comment: !!input.canComment, can_approve: !!input.canApprove,
    status: "active",
  });
  if (error) return { error: "unexpected" };
  void recordTeamMemory(c.org, input.projectId, { title: `Stakeholder access granted: ${input.name}`, content: `level ${input.accessLevel ?? "viewer"}`, tag: "stakeholder_assignment" });
  return {};
}

export async function revokeStakeholderAccessAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("stakeholder_access").update({ status: "revoked" }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

// ── Update / remove member ──────────────────────────────────────────────────

export async function updateProjectMemberAction(input: { projectId: string; id: string; patch: ProjectMemberInput & { applyPreset?: boolean } }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const p = input.patch;
  const patch: Record<string, unknown> = {};
  if (p.project_role !== undefined) patch.project_role = p.project_role?.trim() || null;
  if (p.delivery_role !== undefined) patch.delivery_role = p.delivery_role?.trim() || null;
  if (p.governance_role !== undefined) patch.governance_role = p.governance_role?.trim() || null;
  if (p.responsibility !== undefined) patch.responsibility = p.responsibility?.trim() || null;
  if (p.allocation_percentage !== undefined) patch.allocation_percentage = p.allocation_percentage ?? null;
  if (p.permission_level !== undefined) {
    patch.permission_level = p.permission_level;
    if (p.applyPreset) Object.assign(patch, flagsFor(p.permission_level, p.flags));
  }
  if (p.flags && !p.applyPreset) for (const [k, v] of Object.entries(p.flags)) if ((PERMISSION_FLAGS as readonly string[]).includes(k)) patch[k] = v;
  if (Object.keys(patch).length === 0) return {};
  const { error } = await c.supabase.from("project_team_members").update(patch).eq("id", input.id).eq("organization_id", c.org.organizationId);
  if (error) return { error: "unexpected" };
  void recordTeamMemory(c.org, input.projectId, { title: "Team role/permission changed", content: JSON.stringify(patch).slice(0, 300), tag: "team_role_change" });
  return {};
}

export async function removeProjectMemberAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_team_members").update({ status: "removed" }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

// ── AI role recommendation ──────────────────────────────────────────────────

export async function recommendRolesAction(input: { projectId: string; locale: string }) {
  const c = await ctx();
  if (!c) return { error: "not_authenticated", roles: [] };
  const { recommendProjectRoles } = await import("@/lib/team-roles/ai");
  const roles = await recommendProjectRoles(c.org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale);
  return { roles };
}

/** Insert recommended roles as unassigned role placeholders (no person yet). */
export async function addRecommendedRolesAction(input: { projectId: string; roles: { project_role: string; delivery_role?: string; governance_role?: string; permission_level?: string }[]; locale: string }): Promise<{ error?: string; added?: number }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const rows = (input.roles ?? []).filter((r) => r.project_role?.trim()).map((r) =>
    buildRow(c.org.organizationId, input.projectId, {
      member_type: "internal_user", display_name: null,
      project_role: r.project_role, delivery_role: r.delivery_role, governance_role: r.governance_role,
      permission_level: r.permission_level || "contributor",
    }));
  if (rows.length === 0) return { added: 0 };
  const { error } = await c.supabase.from("project_team_members").insert(rows);
  if (error) return { error: "unexpected" };
  void recordTeamMemory(c.org, input.projectId, { title: `AI recommended ${rows.length} project roles`, content: rows.map((r) => r.project_role).join(", "), tag: "team_recommendation", importance: "high" });
  return { added: rows.length };
}

// ── RACI ────────────────────────────────────────────────────────────────────

export async function addRaciAction(input: { projectId: string; entityType: string; entityLabel: string; entityId?: string; memberId: string; raciRole: string; notes?: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_raci_assignments").insert({
    organization_id: c.org.organizationId, project_id: input.projectId,
    entity_type: input.entityType, entity_id: input.entityId || null, entity_label: input.entityLabel?.trim() || null,
    project_team_member_id: input.memberId, raci_role: input.raciRole, notes: input.notes?.trim() || null,
  });
  if (error) return { error: "unexpected" };
  void recordTeamMemory(c.org, input.projectId, { title: "RACI updated", content: `${input.entityLabel}: ${input.raciRole}`, tag: "raci_assignment" });
  return {};
}

export async function deleteRaciAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_raci_assignments").delete().eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

/** AI RACI draft: assign milestones × team roles, mapping role hints to members. */
export async function generateRaciDraftAction(input: { projectId: string; locale: string }): Promise<{ error?: string; added?: number }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { data: members } = await c.supabase.from("project_team_members").select("id, project_role")
    .eq("project_id", input.projectId).eq("organization_id", c.org.organizationId).neq("status", "removed");
  const team = (members ?? []) as Record<string, unknown>[];
  const byRole = new Map<string, string>();
  for (const m of team) if (m.project_role) byRole.set(String(m.project_role).toLowerCase(), String(m.id));
  const roles = [...new Set(team.map((m) => String(m.project_role ?? "")).filter(Boolean))];
  if (roles.length === 0) return { error: "no_roles" };

  const { generateRaciDraft } = await import("@/lib/team-roles/ai");
  const items = await generateRaciDraft(c.org, input.projectId, (input.locale === "es" ? "es" : "en") as Locale, roles);
  const rows = items.map((it) => {
    const mid = byRole.get(it.role_hint.toLowerCase());
    return mid ? {
      organization_id: c.org.organizationId, project_id: input.projectId,
      entity_type: "milestone", entity_label: it.entity_label, project_team_member_id: mid, raci_role: it.raci_role,
    } : null;
  }).filter(Boolean) as Record<string, unknown>[];
  if (rows.length === 0) return { added: 0 };
  const { error } = await c.supabase.from("project_raci_assignments").insert(rows);
  if (error) return { error: "unexpected" };
  void recordTeamMemory(c.org, input.projectId, { title: `AI generated ${rows.length} RACI assignments`, content: "", tag: "raci_assignment", importance: "high" });
  return { added: rows.length };
}
