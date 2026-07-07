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
  // Identity fields — used to FILL an unassigned role placeholder with a real
  // person (internal user or external contact) instead of inserting a duplicate
  // row. member_type + exactly one of user_id / external_contact_id + a name.
  if (p.member_type !== undefined) patch.member_type = p.member_type;
  if (p.user_id !== undefined) patch.user_id = p.user_id || null;
  if (p.external_contact_id !== undefined) patch.external_contact_id = p.external_contact_id || null;
  if (p.display_name !== undefined) patch.display_name = p.display_name?.trim() || null;
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

// ── Role Assignment Board — encapsulated assign / move / remove / restore ────
// Server-side dedup (defence beyond the client oracle). A person can hold many
// roles, but never twice in the SAME role. Assigning fills an empty placeholder
// first (keeps its id → RACI-safe) before inserting a new row. Removing the last
// person of a role reverts the row to a placeholder so the bucket survives.

interface BoardPersonInput { kind: "user" | "ext"; id: string; name: string }

function identityFields(p: BoardPersonInput) {
  return {
    member_type: p.kind === "user" ? "internal_user" : "external_contact",
    user_id: p.kind === "user" ? p.id : null,
    external_contact_id: p.kind === "ext" ? p.id : null,
    display_name: p.name?.trim() || null,
  };
}

export async function assignPersonToRoleAction(input: { projectId: string; role: string; person: BoardPersonInput; locale?: string }): Promise<{ error?: string; duplicate?: boolean; memberId?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const role = input.role.trim();
  const p = input.person;
  if (!role || !p?.id) return { error: "empty" };
  const idCol = p.kind === "user" ? "user_id" : "external_contact_id";

  // Server-side dedup: same person already in this role?
  const { data: mine } = await c.supabase.from("project_team_members")
    .select("id, project_role").eq("project_id", input.projectId).eq("organization_id", c.org.organizationId)
    .neq("status", "removed").eq(idCol, p.id);
  if ((mine ?? []).some((r) => String(r.project_role ?? "").trim().toLowerCase() === role.toLowerCase())) {
    return { duplicate: true };
  }

  // Fill an empty placeholder for this role if one exists (keeps its id).
  const { data: sameRole } = await c.supabase.from("project_team_members")
    .select("id, user_id, external_contact_id, display_name").eq("project_id", input.projectId)
    .eq("organization_id", c.org.organizationId).neq("status", "removed").ilike("project_role", role);
  const placeholder = (sameRole ?? []).find((r) => !r.user_id && !r.external_contact_id && !r.display_name);
  const identity = identityFields(p);

  if (placeholder) {
    const { error } = await c.supabase.from("project_team_members").update(identity)
      .eq("id", placeholder.id).eq("organization_id", c.org.organizationId);
    if (error) return { error: "unexpected" };
    await logAudit({ org: c.org, projectId: input.projectId, action: "update", entityType: "project_team_members", entityId: String(placeholder.id), metadata: { assigned: p.name, role } });
    return { memberId: String(placeholder.id) };
  }

  const { data: inserted, error } = await c.supabase.from("project_team_members")
    .insert(buildRow(c.org.organizationId, input.projectId, { ...identity, project_role: role, permission_level: "contributor" }))
    .select("id").single();
  if (error || !inserted) return { error: "unexpected" };
  await logAudit({ org: c.org, projectId: input.projectId, action: "create", entityType: "project_team_members", entityId: String(inserted.id), metadata: { assigned: p.name, role } });
  return { memberId: String(inserted.id) };
}

export async function movePersonRoleAction(input: { projectId: string; id: string; toRole: string }): Promise<{ error?: string; duplicate?: boolean }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const toRole = input.toRole.trim();
  if (!toRole) return { error: "empty" };
  const { data: row } = await c.supabase.from("project_team_members")
    .select("id, user_id, external_contact_id, project_role").eq("id", input.id)
    .eq("organization_id", c.org.organizationId).neq("status", "removed").maybeSingle();
  if (!row) return { error: "not_found" };

  const pcol = row.user_id ? "user_id" : row.external_contact_id ? "external_contact_id" : null;
  const pid = row.user_id ?? row.external_contact_id;
  if (pcol && pid) {
    const { data: dupes } = await c.supabase.from("project_team_members")
      .select("id, project_role").eq("project_id", input.projectId).eq("organization_id", c.org.organizationId)
      .neq("status", "removed").neq("id", input.id).eq(pcol, pid);
    if ((dupes ?? []).some((r) => String(r.project_role ?? "").trim().toLowerCase() === toRole.toLowerCase())) {
      return { duplicate: true };
    }
  }
  const { error } = await c.supabase.from("project_team_members").update({ project_role: toRole })
    .eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

export async function removeAssignmentAction(input: { projectId: string; id: string }): Promise<{ error?: string; mode?: "cleared" | "removed" }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { data: row } = await c.supabase.from("project_team_members")
    .select("id, project_role").eq("id", input.id).eq("organization_id", c.org.organizationId)
    .neq("status", "removed").maybeSingle();
  if (!row) return { error: "not_found" };
  const role = String(row.project_role ?? "");

  const { data: siblings } = await c.supabase.from("project_team_members")
    .select("id, user_id, external_contact_id, display_name").eq("project_id", input.projectId)
    .eq("organization_id", c.org.organizationId).neq("status", "removed").neq("id", input.id).ilike("project_role", role);
  const hasSibling = (siblings ?? []).some((r) => r.user_id || r.external_contact_id || r.display_name);

  if (!hasSibling) {
    const { error } = await c.supabase.from("project_team_members")
      .update({ user_id: null, external_contact_id: null, display_name: null })
      .eq("id", input.id).eq("organization_id", c.org.organizationId);
    return error ? { error: "unexpected" } : { mode: "cleared" };
  }
  const { error } = await c.supabase.from("project_team_members").update({ status: "removed" })
    .eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : { mode: "removed" };
}

/** Undo a soft-removed assignment (restore status active). */
export async function restoreAssignmentAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("project_team_members").update({ status: "active" })
    .eq("id", input.id).eq("organization_id", c.org.organizationId).eq("status", "removed");
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
