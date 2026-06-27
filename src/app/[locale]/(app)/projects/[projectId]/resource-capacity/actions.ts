"use server";

// ============================================================================
// Resource Capacity Intelligence — capacity capture actions
// ============================================================================
// Lets a PM/PMO define per-resource capacity (weekly hours, availability,
// overhead) for a project. Writes to project_resource_allocations, which feeds
// the Resource Capacity engine + the Living Graph Workforce layer. No data is
// invented; defaults are sensible and editable.
// ============================================================================

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";

async function ctx(projectId: string) {
  let org;
  try { org = await getOrgContext(); } catch { return { error: "not_authenticated" as const }; }
  const supabase = createAdminClient();
  // Verify the project belongs to the caller's organization.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) return { error: "forbidden" as const };
  return { org, supabase, canManage: true };
}

export interface AllocationRow {
  id: string;
  displayName: string;
  projectRole: string | null;
  weeklyCapacityHours: number | null;
  availabilityPercent: number | null;
  overheadPercent: number | null;
  userId: string | null;
  projectTeamMemberId: string | null;
}
export interface TeamOption { teamMemberId: string; userId: string | null; name: string; role: string | null }

export async function getCapacityEditorDataAction(input: { projectId: string }): Promise<{
  error?: string; canManage?: boolean; allocations?: AllocationRow[]; teamOptions?: TeamOption[];
}> {
  const c = await ctx(input.projectId);
  if ("error" in c) return { error: c.error };
  const { org, supabase } = c;

  const [allocRes, teamRes, profRes] = await Promise.all([
    supabase.from("project_resource_allocations").select("*")
      .eq("project_id", input.projectId).eq("organization_id", org.organizationId).neq("status", "removed")
      .order("created_at", { ascending: true }),
    supabase.from("project_team_members").select("id, user_id, display_name, project_role")
      .eq("project_id", input.projectId).eq("organization_id", org.organizationId).neq("status", "removed"),
    supabase.from("profiles").select("id, display_name").eq("organization_id", org.organizationId),
  ]);

  const nameByUser = new Map((profRes.data ?? []).map((p) => [String((p as Record<string, unknown>).id), String((p as Record<string, unknown>).display_name ?? "")]));
  const allocations: AllocationRow[] = (allocRes.data ?? []).map((a) => {
    const r = a as Record<string, unknown>;
    return {
      id: String(r.id),
      displayName: (r.display_name as string) || (r.user_id ? nameByUser.get(String(r.user_id)) || "—" : "—"),
      projectRole: (r.project_role as string) ?? null,
      weeklyCapacityHours: r.weekly_capacity_hours == null ? null : Number(r.weekly_capacity_hours),
      availabilityPercent: r.availability_percent == null ? null : Number(r.availability_percent),
      overheadPercent: r.overhead_percent == null ? null : Number(r.overhead_percent),
      userId: (r.user_id as string) ?? null,
      projectTeamMemberId: (r.project_team_member_id as string) ?? null,
    };
  });

  // Team members not yet allocated → offered in the "add" picker.
  const allocatedTm = new Set(allocations.map((a) => a.projectTeamMemberId).filter(Boolean));
  const teamOptions: TeamOption[] = ((teamRes.data ?? []) as Record<string, unknown>[])
    .filter((m) => !allocatedTm.has(String(m.id)))
    .map((m) => ({
      teamMemberId: String(m.id), userId: (m.user_id as string) ?? null,
      name: (m.display_name as string) || (m.user_id ? nameByUser.get(String(m.user_id)) || "—" : "—"),
      role: (m.project_role as string) ?? null,
    }))
    .filter((m) => m.name && m.name !== "—");

  return { canManage: c.canManage, allocations, teamOptions };
}

const saveSchema = z.object({
  projectId: z.string().uuid(),
  id: z.string().uuid().optional(),
  projectTeamMemberId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  displayName: z.string().max(200).optional().nullable(),
  projectRole: z.string().max(120).optional().nullable(),
  weeklyCapacityHours: z.number().min(0).max(168).nullable(),
  availabilityPercent: z.number().min(0).max(100).nullable(),
  overheadPercent: z.number().min(0).max(100).nullable(),
});

export async function saveAllocationAction(input: z.infer<typeof saveSchema>): Promise<{ error?: string; id?: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: "validation_error" };
  const d = parsed.data;
  const c = await ctx(d.projectId);
  if ("error" in c) return { error: c.error };
  if (!c.canManage) return { error: "forbidden" };
  const { org, supabase } = c;

  const row = {
    weekly_capacity_hours: d.weeklyCapacityHours,
    availability_percent: d.availabilityPercent,
    overhead_percent: d.overheadPercent,
    project_role: d.projectRole?.trim() || null,
    display_name: d.displayName?.trim() || null,
  };

  if (d.id) {
    const { error } = await supabase.from("project_resource_allocations")
      .update(row).eq("id", d.id).eq("organization_id", org.organizationId);
    return error ? { error: "unexpected" } : { id: d.id };
  }

  const { data, error } = await supabase.from("project_resource_allocations").insert({
    organization_id: org.organizationId, project_id: d.projectId,
    project_team_member_id: d.projectTeamMemberId || null, user_id: d.userId || null,
    status: "active", ...row,
  }).select("id").single();
  return error || !data ? { error: "unexpected" } : { id: String(data.id) };
}

export async function removeAllocationAction(input: { projectId: string; id: string }): Promise<{ error?: string }> {
  const c = await ctx(input.projectId);
  if ("error" in c) return { error: c.error };
  if (!c.canManage) return { error: "forbidden" };
  const { org, supabase } = c;
  const { error } = await supabase.from("project_resource_allocations")
    .delete().eq("id", input.id).eq("organization_id", org.organizationId);
  return error ? { error: "unexpected" } : {};
}
