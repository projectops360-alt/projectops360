import "server-only";

// ============================================================================
// ProjectOps360° — Admin Console data layer (SERVER-ONLY, service-role)
// ============================================================================
// Cross-org aggregates for the Admin Console. ALL functions use the service
// role (createAdminClient) because RLS would otherwise scope reads to the
// caller's own organization. Every function here MUST only be invoked after
// isPlatformAdmin() / requirePlatformAdmin() has returned true — the page and
// server actions enforce that order; no admin query runs before the gate.
//
// Aggregation strategy: counts and group-bys run server-side; we never fetch
// all rows just to count them. Task drill-down is paginated (limit/offset).
// Soft-deleted rows (deleted_at IS NULL) are excluded.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getI18nValue, type I18nField, type Locale } from "@/types/database";
import type {
  AdminMetrics,
  AdminTaskPage,
  AdminTaskRow,
  AdminTaskFilters,
  CompanyRow,
  CompanyUserRow,
  ProjectTaskAggregate,
  UserProjectRow,
} from "./types";

const PAGE_SIZE = 25;

const STATUS_DONE = "done";
const STATUS_BLOCKED = "blocked";
const STATUS_DEFERRED = "deferred";

function nameFromI18n(field: unknown, locale: Locale): string {
  return getI18nValue(field as I18nField | null, locale) || "";
}

/** Top-of-page KPI summary. */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const supabase = createAdminClient();
  const [
    companies,
    users,
    projects,
    tasks,
    admins,
  ] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("roadmap_tasks").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("admin_authorized_users").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const count = (r: { count: number | null } | { data: unknown; error: unknown; count?: number }): number =>
    (r as { count?: number | null }).count ?? 0;

  return {
    totalCompanies: count(companies),
    totalUsers: count(users),
    totalProjects: count(projects),
    totalTasks: count(tasks),
    activeAdminUsers: count(admins),
  };
}

/** Companies with rolled-up user / project / task counts. */
export async function getCompaniesWithCounts(locale: Locale): Promise<CompanyRow[]> {
  const supabase = createAdminClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, slug, name_i18n, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (!orgs || orgs.length === 0) return [];

  const orgIds = orgs.map((o) => (o as { id: string }).id);

  const [membersByOrg, projectsByOrg, tasksByOrg] = await Promise.all([
    groupCount(supabase, "organization_members", "organization_id", orgIds),
    groupCount(supabase, "projects", "organization_id", orgIds, "deleted_at", null),
    groupCount(supabase, "roadmap_tasks", "organization_id", orgIds, "deleted_at", null),
  ]);

  return orgs.map((o) => {
    const org = o as { id: string; slug: string; name_i18n: I18nField; created_at: string | null };
    return {
      id: org.id,
      name: nameFromI18n(org.name_i18n, locale) || org.slug,
      slug: org.slug,
      userCount: membersByOrg.get(org.id) ?? 0,
      projectCount: projectsByOrg.get(org.id) ?? 0,
      taskCount: tasksByOrg.get(org.id) ?? 0,
      createdAt: org.created_at,
    };
  });
}

/** Users per company (organization_members + profiles), expandable rows. */
export async function getUsersByCompany(orgId: string, locale: Locale): Promise<CompanyUserRow[]> {
  const supabase = createAdminClient();
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at, profiles!organization_members_user_id_fkey(display_name, created_at)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  if (!members || members.length === 0) return [];

  const userIds = members
    .map((m) => (m as { user_id: string }).user_id)
    .filter(Boolean);

  // Email lives on auth.users (not exposed via RLS to the anon client); the
  // service role can query the Supabase auth schema.
  const emailById = await fetchEmailsById(supabase, userIds);

  const [projectsByUser, tasksByUser] = await Promise.all([
    groupCount(supabase, "projects", "created_by", userIds, "deleted_at", null),
    groupCount(supabase, "roadmap_tasks", "assigned_to", userIds, "deleted_at", null),
  ]);

  return members.map((m) => {
    const row = m as unknown as {
      user_id: string;
      role: string | null;
      created_at: string | null;
      profiles: { display_name: string | null; created_at: string | null } | null;
    };
    return {
      organizationId: orgId,
      userId: row.user_id,
      displayName: row.profiles?.display_name ?? null,
      email: emailById.get(row.user_id) ?? null,
      role: row.role,
      projectCount: projectsByUser.get(row.user_id) ?? 0,
      assignedTaskCount: tasksByUser.get(row.user_id) ?? 0,
      createdAt: row.profiles?.created_at ?? row.created_at,
    };
  });
  void locale;
}

/** Projects grouped by owner (created_by) with per-project task-status rollup. */
export async function getProjectsByUser(locale: Locale): Promise<UserProjectRow[]> {
  const supabase = createAdminClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, organization_id, slug, title_i18n, status, created_by, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => (p as { id: string }).id);
  const orgIds = Array.from(new Set(projects.map((p) => (p as { organization_id: string }).organization_id)));
  const ownerIds = Array.from(new Set(projects.map((p) => (p as { created_by: string | null }).created_by).filter(Boolean) as string[]));

  const [statusByProject, orgNames, ownerNames, ownerEmails] = await Promise.all([
    taskStatusByProject(supabase, projectIds),
    fetchOrgNames(supabase, orgIds, locale),
    fetchDisplayNames(supabase, ownerIds),
    fetchEmailsById(supabase, ownerIds),
  ]);

  return projects.map((p) => {
    const proj = p as {
      id: string; organization_id: string; slug: string; title_i18n: I18nField;
      status: string | null; created_by: string | null; updated_at: string | null;
    };
    const agg = statusByProject.get(proj.id) ?? { total: 0, open: 0, done: 0, blocked: 0 };
    return {
      userId: proj.created_by ?? "",
      ownerName: proj.created_by ? (ownerNames.get(proj.created_by) ?? null) : null,
      ownerEmail: proj.created_by ? (ownerEmails.get(proj.created_by) ?? null) : null,
      organizationId: proj.organization_id,
      organizationName: orgNames.get(proj.organization_id) ?? "",
      projectId: proj.id,
      projectTitle: nameFromI18n(proj.title_i18n, locale) || proj.slug,
      projectStatus: proj.status,
      totalTasks: agg.total,
      openTasks: agg.open,
      completedTasks: agg.done,
      blockedTasks: agg.blocked,
      updatedAt: proj.updated_at,
    };
  });
}

/** Per-project task-status aggregate for the Project Tasks overview. */
export async function getProjectTaskAggregates(locale: Locale): Promise<ProjectTaskAggregate[]> {
  const supabase = createAdminClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, organization_id, slug, title_i18n, created_by, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => (p as { id: string }).id);
  const orgIds = Array.from(new Set(projects.map((p) => (p as { organization_id: string }).organization_id)));
  const ownerIds = Array.from(new Set(projects.map((p) => (p as { created_by: string | null }).created_by).filter(Boolean) as string[]));

  const [statusByProject, orgNames, ownerNames] = await Promise.all([
    taskStatusByProject(supabase, projectIds),
    fetchOrgNames(supabase, orgIds, locale),
    fetchDisplayNames(supabase, ownerIds),
  ]);

  return projects.map((p) => {
    const proj = p as {
      id: string; organization_id: string; slug: string; title_i18n: I18nField;
      created_by: string | null; updated_at: string | null;
    };
    const agg = statusByProject.get(proj.id) ?? { total: 0, open: 0, done: 0, blocked: 0 };
    return {
      projectId: proj.id,
      projectTitle: nameFromI18n(proj.title_i18n, locale) || proj.slug,
      organizationId: proj.organization_id,
      organizationName: orgNames.get(proj.organization_id) ?? "",
      ownerId: proj.created_by,
      ownerName: proj.created_by ? (ownerNames.get(proj.created_by) ?? null) : null,
      totalTasks: agg.total,
      openTasks: agg.open,
      completedTasks: agg.done,
      blockedTasks: agg.blocked,
      updatedAt: proj.updated_at,
    };
  });
}

/** Paginated, server-filtered task list for one project (drill-down). */
export async function getProjectTasks(
  projectId: string,
  filters: AdminTaskFilters,
  locale: Locale,
): Promise<AdminTaskPage> {
  const supabase = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = supabase
    .from("roadmap_tasks")
    .select("id, title, status, priority, end_date, updated_at, milestone_id, assigned_to", { count: "exact" })
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.search && filters.search.trim()) {
    query = query.ilike("title", `%${filters.search.trim()}%`);
  }

  query = query.order("updated_at", { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
  const rows = (data ?? []) as Array<{
    id: string; title: string; status: AdminTaskRow["status"]; priority: string | null;
    end_date: string | null; updated_at: string | null; milestone_id: string | null; assigned_to: string | null;
  }>;

  const milestoneIds = Array.from(new Set(rows.map((r) => r.milestone_id).filter(Boolean) as string[]));
  const assigneeIds = Array.from(new Set(rows.map((r) => r.assigned_to).filter(Boolean) as string[]));

  const [milestoneTitles, assigneeNames] = await Promise.all([
    fetchMilestoneTitles(supabase, milestoneIds),
    fetchDisplayNames(supabase, assigneeIds),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      milestoneTitle: r.milestone_id ? (milestoneTitles.get(r.milestone_id) ?? null) : null,
      assigneeId: r.assigned_to,
      assigneeName: r.assigned_to ? (assigneeNames.get(r.assigned_to) ?? null) : null,
      endDate: r.end_date,
      updatedAt: r.updated_at,
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

// ── internal helpers ───────────────────────────────────────────────────────

interface StatusAgg { total: number; open: number; done: number; blocked: number }

/** Count rows grouped by `column` for a set of ids. Optional soft-delete filter. */
async function groupCount(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  column: string,
  ids: string[],
  softDeleteColumn?: string,
  softDeleteValue: unknown = null,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  let q = supabase.from(table).select(column).in(column, ids);
  if (softDeleteColumn) q = q.is(softDeleteColumn, softDeleteValue);
  const { data, error } = await q;
  if (error || !data) return out;
  for (const row of data as unknown as Record<string, unknown>[]) {
    const key = row[column] as string;
    if (!key) continue;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/** Aggregate roadmap_tasks status counts per project (single query). */
async function taskStatusByProject(
  supabase: ReturnType<typeof createAdminClient>,
  projectIds: string[],
): Promise<Map<string, StatusAgg>> {
  const out = new Map<string, StatusAgg>();
  if (projectIds.length === 0) return out;
  const { data, error } = await supabase
    .from("roadmap_tasks")
    .select("project_id, status")
    .in("project_id", projectIds)
    .is("deleted_at", null);
  if (error || !data) return out;
  for (const row of data as { project_id: string; status: string }[]) {
    const agg = out.get(row.project_id) ?? { total: 0, open: 0, done: 0, blocked: 0 };
    agg.total += 1;
    if (row.status === STATUS_DONE) agg.done += 1;
    else if (row.status === STATUS_BLOCKED) agg.blocked += 1;
    else if (row.status !== STATUS_DEFERRED) agg.open += 1;
    out.set(row.project_id, agg);
  }
  return out;
}

/** Fetch localized org names for a set of org ids. */
async function fetchOrgNames(
  supabase: ReturnType<typeof createAdminClient>,
  orgIds: string[],
  locale: Locale,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (orgIds.length === 0) return out;
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name_i18n")
    .in("id", orgIds);
  if (error || !data) return out;
  for (const row of data as { id: string; slug: string; name_i18n: I18nField }[]) {
    out.set(row.id, nameFromI18n(row.name_i18n, locale) || row.slug);
  }
  return out;
}

/** Fetch display_name for a set of profile ids (= auth.users ids). */
async function fetchDisplayNames(
  supabase: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  if (error || !data) return out;
  for (const row of data as { id: string; display_name: string | null }[]) {
    if (row.display_name) out.set(row.id, row.display_name);
  }
  return out;
}

/** Fetch milestone titles for a set of milestone ids. */
async function fetchMilestoneTitles(
  supabase: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from("milestones")
    .select("id, title")
    .in("id", ids);
  if (error || !data) return out;
  for (const row of data as { id: string; title: string }[]) {
    out.set(row.id, row.title);
  }
  return out;
}

/**
 * Fetch emails for a set of user ids. Email lives on auth.users; the service
 * role can read the Supabase auth schema. Falls back to empty on any error.
 */
async function fetchEmailsById(
  supabase: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from("auth.users")
      .select("id, email")
      .in("id", ids);
    if (error || !data) return out;
    for (const row of data as { id: string; email: string | null }[]) {
      if (row.email) out.set(row.id, row.email);
    }
  } catch {
    // auth schema unreadable in some environments — degrade to no email.
  }
  return out;
}