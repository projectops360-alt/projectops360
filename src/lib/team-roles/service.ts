// ============================================================================
// ProjectOps360° — Project Team & Roles service (server-only)
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import { CRITICAL_ROLES } from "./config";
import { computeCompletenessFromRows } from "./board-model";

type Row = Record<string, unknown>;

// ── Company directory (internal users) ──────────────────────────────────────

export interface DirectoryUser { userId: string; name: string; email: string | null; seatType: string | null; workspaceRole: string | null; status: string }

export async function getCompanyDirectory(org: OrgContext): Promise<DirectoryUser[]> {
  const supabase = createAdminClient();
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, billing_seat_type, workspace_role, status")
    .eq("organization_id", org.organizationId);
  const rows = (members ?? []) as Row[];
  if (rows.length === 0) return [];

  const ids = new Set(rows.map((r) => String(r.user_id)));
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", [...ids]);
  const nameById = new Map((profiles ?? []).map((p) => [String((p as Row).id), String((p as Row).display_name ?? "")]));

  // Emails come from auth (best-effort).
  const emailById = new Map<string, string>();
  try {
    const { data: list } = await supabase.auth.admin.listUsers();
    for (const u of list?.users ?? []) if (ids.has(u.id) && u.email) emailById.set(u.id, u.email);
  } catch { /* ignore */ }

  return rows.map((r) => {
    const uid = String(r.user_id);
    return {
      userId: uid,
      name: nameById.get(uid) || emailById.get(uid)?.split("@")[0] || "—",
      email: emailById.get(uid) ?? null,
      seatType: (r.billing_seat_type as string) ?? null,
      workspaceRole: (r.workspace_role as string) ?? null,
      status: (r.status as string) ?? "active",
    };
  });
}

// ── Company teams ───────────────────────────────────────────────────────────

export async function getCompanyTeams(org: OrgContext): Promise<{ teams: Row[]; membersByTeam: Map<string, Row[]> }> {
  const supabase = createAdminClient();
  const { data: teams } = await supabase.from("organization_teams").select("*")
    .eq("organization_id", org.organizationId).is("deleted_at", null).order("created_at", { ascending: false });
  const teamRows = (teams ?? []) as Row[];
  const membersByTeam = new Map<string, Row[]>();
  if (teamRows.length > 0) {
    const { data: tm } = await supabase.from("organization_team_members").select("*")
      .in("organization_team_id", teamRows.map((t) => String(t.id))).eq("organization_id", org.organizationId);
    for (const m of (tm ?? []) as Row[]) {
      const k = String(m.organization_team_id);
      if (!membersByTeam.has(k)) membersByTeam.set(k, []);
      membersByTeam.get(k)!.push(m);
    }
  }
  return { teams: teamRows, membersByTeam };
}

// ── External contacts ───────────────────────────────────────────────────────

export async function getExternalContacts(org: OrgContext): Promise<Row[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("external_contacts").select("*")
    .eq("organization_id", org.organizationId).is("deleted_at", null).order("created_at", { ascending: false });
  return (data ?? []) as Row[];
}

// ── Project team + RACI + stakeholder access ────────────────────────────────

export async function getProjectTeam(org: OrgContext, projectId: string): Promise<Row[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("project_team_members").select("*")
    .eq("project_id", projectId).eq("organization_id", org.organizationId).neq("status", "removed")
    .order("created_at", { ascending: true });
  return (data ?? []) as Row[];
}

export async function getProjectRaci(org: OrgContext, projectId: string): Promise<Row[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("project_raci_assignments").select("*")
    .eq("project_id", projectId).eq("organization_id", org.organizationId).order("created_at", { ascending: false });
  return (data ?? []) as Row[];
}

export async function getStakeholderAccess(org: OrgContext, projectId: string): Promise<Row[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("stakeholder_access").select("*")
    .eq("project_id", projectId).eq("organization_id", org.organizationId).eq("status", "active")
    .order("created_at", { ascending: false });
  return (data ?? []) as Row[];
}

// ── Team completeness + role gaps ───────────────────────────────────────────

export interface TeamCompleteness {
  score: number;
  hasPM: boolean;
  hasApprover: boolean;
  missingCritical: string[];
  totalMembers: number;
}

export function computeTeamCompleteness(members: Row[]): TeamCompleteness {
  // Identity-aware (board-model): empty role placeholders are NOT members and
  // never mark a role covered, so completeness reflects real people, not slots.
  return computeCompletenessFromRows(members, CRITICAL_ROLES);
}

// ── Project Memory event (best-effort, fire-and-forget) ─────────────────────

export async function recordTeamMemory(
  org: OrgContext, projectId: string,
  ev: { title: string; content: string; tag: string; importance?: "low" | "medium" | "high" | "critical" },
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("project_memory_items").insert({
      organization_id: org.organizationId, project_id: projectId,
      title: ev.title, content: ev.content,
      author_name: org.displayName ?? null, visibility: "project",
      ai_status: "skipped", index_status: "pending",
      importance_level: ev.importance ?? "medium",
      source_type: "system_event", source_system: "project_team",
      tags: [ev.tag], created_by: org.userId,
    }).select("id").maybeSingle();
    const id = (data as Row | null)?.id;
    if (id) {
      void import("@/lib/memory/service").then(({ processMemoryItem }) =>
        processMemoryItem(org, String(id), { runClassification: false }).catch(() => {}));
    }
  } catch { /* never throws — memory is best-effort */ }
}
