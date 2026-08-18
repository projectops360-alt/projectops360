// ============================================================================
// ProjectOps360° — Friction Radar operational source loader (READ-ONLY)
// ============================================================================
// Authenticated, RLS-scoped SELECTs only. This module never imports an admin
// client, never writes canonical data and never exposes raw event payloads to a
// user-facing read model. Missing sources are reported explicitly.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { loadCanonicalEventProjection } from "@/lib/graph/event-relationship-loader";
import type { TimeEntry } from "@/lib/time-tracking/types";
import type {
  Decision,
  Milestone,
  RoadmapTask,
  TaskDependency,
} from "@/types/database";
import type {
  BudgetItem,
  CostActual,
  CriticalPathSnapshot,
  Resource,
  ResourceAssignment,
  Risk,
} from "@/types/execution";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FrictionSourceAvailability =
  | "available"
  | "empty"
  | "error"
  | "truncated"
  | "not_present";

export interface FrictionSourceAudit {
  table: string;
  status: FrictionSourceAvailability;
  rowCount: number;
}

export interface TaskSubtaskSourceRow {
  id: string;
  organization_id: string;
  project_id: string;
  task_id: string;
  status: string;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  progress: number;
  blocked_reason: string | null;
}

export interface ProjectTeamMemberSourceRow {
  id: string;
  organization_id: string;
  project_id: string;
  user_id: string | null;
  display_name: string | null;
  project_role: string | null;
  allocation_percentage: number | null;
  status: string;
}

export interface ProjectResourceAllocationSourceRow {
  id: string;
  organization_id: string;
  project_id: string;
  user_id: string | null;
  project_team_member_id: string | null;
  display_name: string | null;
  allocation_percent: number;
  weekly_capacity_hours: number | null;
  availability_percent: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

export interface FinancialMeasurementSourceRow {
  id: string;
  organization_id: string;
  project_id: string;
  data_date: string;
  formula_version: string;
  currency: string;
  bac: number | string | null;
  pv: number | string | null;
  ev: number | string | null;
  ac: number | string | null;
  cv: number | string | null;
  sv: number | string | null;
  cpi: number | string | null;
  spi: number | string | null;
  quality_status: string;
  limitations: string[];
}

export interface ResourceProfileSourceRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  display_name: string;
  default_weekly_capacity_hours: number | null;
  default_availability_percent: number | null;
  is_active: boolean;
}

export interface ResourceWorkloadSourceRow {
  id: string;
  organization_id: string;
  project_id: string;
  resource_profile_id: string | null;
  resource_key: string;
  period_start: string;
  period_end: string;
  effective_capacity_hours: number | string;
  assigned_work_hours: number | string;
  remaining_capacity_hours: number | string;
  utilization_percent: number | string;
  overallocated_hours: number | string;
  status: string;
  calculation_source: string;
}

export interface FinancialProjectCockpitSourceRow {
  organization_id: string;
  project_id: string;
  currency: string;
  original_budget: number | string | null;
  current_baseline: number | string | null;
  actual_cost: number | string | null;
  latest_eac: number | string | null;
  cpi: number | string | null;
  spi: number | string | null;
  quality_status: string;
  pending_approvals: number;
  reconciliation_exceptions: number;
  unverified_actuals: number;
  data_date: string | null;
}

export interface TaskFrictionOperationalSources {
  organizationId: string;
  projectId: string;
  projectTitle: string;
  tasks: RoadmapTask[];
  milestones: Milestone[];
  events: LivingGraphCanonicalEvent[];
  timeEntries: TimeEntry[];
  dependencies: TaskDependency[];
  subtasks: TaskSubtaskSourceRow[];
  resources: Resource[];
  resourceAssignments: ResourceAssignment[];
  teamMembers: ProjectTeamMemberSourceRow[];
  projectAllocations: ProjectResourceAllocationSourceRow[];
  resourceProfiles: ResourceProfileSourceRow[];
  resourceWorkloadSnapshots: ResourceWorkloadSourceRow[];
  resourceAvailabilityExceptions: Record<string, unknown>[];
  organizationMembers: Record<string, unknown>[];
  risks: Risk[];
  issues: Record<string, unknown>[];
  decisions: Decision[];
  budgetItems: BudgetItem[];
  costActuals: CostActual[];
  financialMeasurements: FinancialMeasurementSourceRow[];
  financialCockpit: FinancialProjectCockpitSourceRow[];
  criticalPathSnapshots: CriticalPathSnapshot[];
  sourceAudit: FrictionSourceAudit[];
  limitations: string[];
}

export type TaskFrictionOperationalLoadResult =
  | { status: "ok"; sources: TaskFrictionOperationalSources }
  | { status: "unauthorized" }
  | { status: "error" };

interface QueryResultLike {
  data: unknown[] | null;
  error: unknown;
}

function audit(table: string, result: QueryResultLike): FrictionSourceAudit {
  if (result.error) return { table, status: "error", rowCount: 0 };
  const rowCount = result.data?.length ?? 0;
  return {
    table,
    status: rowCount > 0 ? "available" : "empty",
    rowCount,
  };
}

function rows<T>(result: QueryResultLike): T[] {
  return result.error ? [] : (result.data ?? []) as T[];
}

function optionalTableAudit(
  table: string,
  result: QueryResultLike,
): FrictionSourceAudit {
  if (!result.error) return audit(table, result);
  const error = result.error as { code?: string; message?: string };
  const missing =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|schema cache/i.test(error.message ?? "");
  return {
    table,
    status: missing ? "not_present" : "error",
    rowCount: 0,
  };
}

/**
 * Testable source reader. Every operational table is scoped by BOTH tenant and
 * project. The supplied client must be the caller's authenticated RLS client.
 */
export async function loadTaskFrictionOperationalSources(
  client: SupabaseClient,
  organizationId: string,
  projectId: string,
  projectTitle: string,
): Promise<TaskFrictionOperationalSources> {
  const canonicalPromise = loadCanonicalEventProjection(
    client,
    organizationId,
    projectId,
  );
  const [
    tasksResult,
    milestonesResult,
    entriesResult,
    dependenciesResult,
    subtasksResult,
    assignmentsResult,
    teamResult,
    allocationsResult,
    workloadResult,
    availabilityExceptionsResult,
    risksResult,
    issuesResult,
    decisionsResult,
    budgetResult,
    costResult,
    financialResult,
    financialCockpitResult,
    criticalPathResult,
    canonical,
  ] = await Promise.all([
    client.from("roadmap_tasks").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null).order("order_index", { ascending: true }),
    client.from("milestones").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null).order("order_index", { ascending: true }),
    client.from("subtask_time_entries").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null).order("work_date", { ascending: true }),
    client.from("task_dependencies").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId),
    client.from("task_subtasks")
      .select("id, organization_id, project_id, task_id, status, owner_id, start_date, due_date, completed_at, progress, blocked_reason")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null),
    client.from("resource_assignments").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null),
    client.from("project_team_members")
      .select("id, organization_id, project_id, user_id, display_name, project_role, allocation_percentage, status")
      .eq("organization_id", organizationId).eq("project_id", projectId),
    client.from("project_resource_allocations")
      .select("id, organization_id, project_id, user_id, project_team_member_id, display_name, allocation_percent, weekly_capacity_hours, availability_percent, start_date, end_date, status")
      .eq("organization_id", organizationId).eq("project_id", projectId),
    client.from("resource_workload_snapshots")
      .select("id, organization_id, project_id, resource_profile_id, resource_key, period_start, period_end, effective_capacity_hours, assigned_work_hours, remaining_capacity_hours, utilization_percent, overallocated_hours, status, calculation_source")
      .eq("organization_id", organizationId).eq("project_id", projectId),
    client.from("resource_availability_exceptions").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId),
    client.from("risks").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null),
    client.from("issues").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId),
    client.from("decisions").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null),
    client.from("budget_items").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null),
    client.from("cost_actuals").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .is("deleted_at", null),
    client.from("financial_measurement_snapshots")
      .select("id, organization_id, project_id, data_date, formula_version, currency, bac, pv, ev, ac, cv, sv, cpi, spi, quality_status, limitations")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .order("data_date", { ascending: false }),
    client.from("financial_project_cockpit")
      .select("organization_id, project_id, currency, original_budget, current_baseline, actual_cost, latest_eac, cpi, spi, quality_status, pending_approvals, reconciliation_exceptions, unverified_actuals, data_date")
      .eq("organization_id", organizationId).eq("project_id", projectId),
    client.from("critical_path_snapshots").select("*")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .order("computed_at", { ascending: false }).limit(1),
    canonicalPromise,
  ]);

  const tasks = rows<RoadmapTask>(tasksResult);
  const assignments = rows<ResourceAssignment>(assignmentsResult);
  const resourceIds = [...new Set([
    ...tasks.map((task) => task.assigned_resource_id),
    ...assignments.map((assignment) => assignment.resource_id),
  ].filter((value): value is string => value != null))];
  const resourcesResult: QueryResultLike = resourceIds.length === 0
    ? { data: [], error: null }
    : await client.from("resources").select("*")
        .eq("organization_id", organizationId)
        .in("id", resourceIds)
        .is("deleted_at", null);
  const resources = rows<Resource>(resourcesResult);
  const teamUserIds = [...new Set([
    ...rows<ProjectTeamMemberSourceRow>(teamResult).map((member) => member.user_id),
    ...resources.map((resource) => resource.linked_user_id),
  ].filter((value): value is string => value != null))];
  const resourceProfilesResult: QueryResultLike = teamUserIds.length === 0
    ? { data: [], error: null }
    : await client.from("resource_profiles")
        .select("id, organization_id, user_id, display_name, default_weekly_capacity_hours, default_availability_percent, is_active")
        .eq("organization_id", organizationId)
        .in("user_id", teamUserIds);
  const organizationMembersResult: QueryResultLike = teamUserIds.length === 0
    ? { data: [], error: null }
    : await client.from("organization_members")
        .select("id, organization_id, user_id, role, status, department, job_title, skills, availability_status")
        .eq("organization_id", organizationId)
        .in("user_id", teamUserIds);

  const sourceAudit = [
    audit("roadmap_tasks", tasksResult),
    audit("milestones", milestonesResult),
    audit("project_event_log", {
      data: canonical.canonicalEvents,
      error: canonical.status === "error" ? canonical.errorCode : null,
    }),
    {
      table: "project_event_objects",
      status:
        canonical.status === "error" || canonical.errorCode === "object_read_partial"
          ? "error"
          : canonical.canonicalEvents.some((event) => event.objectRefs.length > 0)
            ? "available"
            : "empty",
      rowCount: canonical.canonicalEvents.reduce(
        (count, event) => count + event.objectRefs.length,
        0,
      ),
    } as FrictionSourceAudit,
    audit("subtask_time_entries", entriesResult),
    audit("task_dependencies", dependenciesResult),
    audit("task_subtasks", subtasksResult),
    audit("resources", resourcesResult),
    audit("resource_assignments", assignmentsResult),
    audit("project_team_members", teamResult),
    audit("project_resource_allocations", allocationsResult),
    audit("resource_profiles", resourceProfilesResult),
    audit("resource_workload_snapshots", workloadResult),
    audit("resource_availability_exceptions", availabilityExceptionsResult),
    audit("organization_members", organizationMembersResult),
    audit("risks", risksResult),
    optionalTableAudit("issues", issuesResult),
    audit("decisions", decisionsResult),
    audit("budget_items", budgetResult),
    audit("cost_actuals", costResult),
    audit("financial_measurement_snapshots", financialResult),
    audit("financial_project_cockpit", financialCockpitResult),
    audit("critical_path_snapshots", criticalPathResult),
  ];
  if (canonical.eventsTruncated) {
    const eventAudit = sourceAudit.find((item) => item.table === "project_event_log");
    if (eventAudit) eventAudit.status = "truncated";
  }

  const limitations = sourceAudit.flatMap((item) => {
    if (item.status === "error") return [`${item.table}:read_error`];
    if (item.status === "truncated") return [`${item.table}:truncated`];
    if (item.status === "not_present") return [`${item.table}:not_present`];
    return [];
  });
  for (const cockpit of rows<FinancialProjectCockpitSourceRow>(
    financialCockpitResult,
  )) {
    if (cockpit.quality_status === "insufficient_inputs") {
      limitations.push("financial_project_cockpit:insufficient_inputs");
    }
  }

  return {
    organizationId,
    projectId,
    projectTitle,
    tasks,
    milestones: rows<Milestone>(milestonesResult),
    events: canonical.canonicalEvents,
    timeEntries: rows<TimeEntry>(entriesResult),
    dependencies: rows<TaskDependency>(dependenciesResult),
    subtasks: rows<TaskSubtaskSourceRow>(subtasksResult),
    resources,
    resourceAssignments: assignments,
    teamMembers: rows<ProjectTeamMemberSourceRow>(teamResult),
    projectAllocations: rows<ProjectResourceAllocationSourceRow>(allocationsResult),
    resourceProfiles: rows<ResourceProfileSourceRow>(resourceProfilesResult),
    resourceWorkloadSnapshots: rows<ResourceWorkloadSourceRow>(workloadResult),
    resourceAvailabilityExceptions: rows<Record<string, unknown>>(
      availabilityExceptionsResult,
    ),
    organizationMembers: rows<Record<string, unknown>>(organizationMembersResult),
    risks: rows<Risk>(risksResult),
    issues: rows<Record<string, unknown>>(issuesResult),
    decisions: rows<Decision>(decisionsResult),
    budgetItems: rows<BudgetItem>(budgetResult),
    costActuals: rows<CostActual>(costResult),
    financialMeasurements: rows<FinancialMeasurementSourceRow>(financialResult),
    financialCockpit: rows<FinancialProjectCockpitSourceRow>(financialCockpitResult),
    criticalPathSnapshots: rows<CriticalPathSnapshot>(criticalPathResult),
    sourceAudit,
    limitations,
  };
}

/** Authenticated production wrapper: deny-by-default before any source read. */
export async function loadTaskFrictionSourcesFromProduction(
  projectId: string,
): Promise<TaskFrictionOperationalLoadResult> {
  if (!UUID_RE.test(projectId)) return { status: "unauthorized" };
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "unauthorized" };
  }
  const client = await createClient();
  const projectResult = await client.from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (projectResult.error || !projectResult.data) {
    return { status: "unauthorized" };
  }
  const title = projectResult.data.title_i18n as Record<string, string> | null;
  const projectTitle = title?.es ?? title?.en ?? projectResult.data.slug;
  try {
    const sources = await loadTaskFrictionOperationalSources(
      client,
      org.organizationId,
      projectId,
      projectTitle,
    );
    return { status: "ok", sources };
  } catch {
    return { status: "error" };
  }
}
