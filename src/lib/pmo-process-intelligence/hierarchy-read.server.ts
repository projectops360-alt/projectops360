import { createClient } from "@/lib/supabase/server";
import type { OrgContext } from "@/lib/auth";
import type {
  ProcessGraphActivity,
  ProcessGraphDependency,
  ProcessGraphHierarchyModel,
  ProcessGraphMilestone,
} from "./process-graph.types";

const MAX_MILESTONES = 500;
const MAX_ACTIVITIES = 2_000;
const MAX_DEPENDENCIES = 4_000;

export async function loadPmoPiHierarchy(
  org: OrgContext,
  authorizedProjectIds: readonly string[],
): Promise<ProcessGraphHierarchyModel> {
  if (authorizedProjectIds.length === 0) {
    return {
      organizationId: org.organizationId,
      milestones: [],
      activities: [],
      dependencies: [],
      truncated: false,
      limitations: [
        "portfolio_and_program_taxonomy_not_configured_in_current_project_schema",
      ],
    };
  }

  const supabase = await createClient();
  const [milestoneResult, activityResult, dependencyResult] = await Promise.all([
    supabase
      .from("milestones")
      .select(
        "id, organization_id, project_id, title, description, status, start_date, target_date, completed_date, progress_percent, order_index",
      )
      .eq("organization_id", org.organizationId)
      .in("project_id", [...authorizedProjectIds])
      .is("deleted_at", null)
      .order("project_id", { ascending: true })
      .order("order_index", { ascending: true })
      .limit(MAX_MILESTONES),
    supabase
      .from("roadmap_tasks")
      .select(
        "id, organization_id, project_id, milestone_id, title, description, status, priority, progress, estimate_hours, actual_hours, start_date, end_date, is_blocked, blocker_reason, is_critical, assigned_to, order_index",
      )
      .eq("organization_id", org.organizationId)
      .in("project_id", [...authorizedProjectIds])
      .is("deleted_at", null)
      .order("project_id", { ascending: true })
      .order("order_index", { ascending: true })
      .limit(MAX_ACTIVITIES),
    supabase
      .from("task_dependencies")
      .select(
        "id, organization_id, project_id, predecessor_id, successor_id, dependency_type, lag_days",
      )
      .eq("organization_id", org.organizationId)
      .in("project_id", [...authorizedProjectIds])
      .limit(MAX_DEPENDENCIES),
  ]);

  if (milestoneResult.error || activityResult.error || dependencyResult.error) {
    throw new Error("Unable to load the authorized Process Intelligence hierarchy.");
  }

  const projectIdSet = new Set(authorizedProjectIds);
  const milestones = (milestoneResult.data ?? [])
    .filter(
      (row) =>
        row.organization_id === org.organizationId &&
        projectIdSet.has(row.project_id as string),
    )
    .map(
      (row): ProcessGraphMilestone => ({
        id: row.id as string,
        organizationId: row.organization_id as string,
        projectId: row.project_id as string,
        title: row.title as string,
        description: (row.description as string | null) ?? null,
        status: row.status as string,
        startDate: (row.start_date as string | null) ?? null,
        targetDate: (row.target_date as string | null) ?? null,
        completedDate: (row.completed_date as string | null) ?? null,
        progressPercent: Number(row.progress_percent ?? 0),
        orderIndex: Number(row.order_index ?? 0),
      }),
    );
  const activities = (activityResult.data ?? [])
    .filter(
      (row) =>
        row.organization_id === org.organizationId &&
        projectIdSet.has(row.project_id as string),
    )
    .map(
      (row): ProcessGraphActivity => ({
        id: row.id as string,
        organizationId: row.organization_id as string,
        projectId: row.project_id as string,
        milestoneId: (row.milestone_id as string | null) ?? null,
        title: row.title as string,
        description: (row.description as string | null) ?? null,
        status: row.status as string,
        priority: row.priority as string,
        progressPercent: Number(row.progress ?? 0),
        estimateHours:
          row.estimate_hours == null ? null : Number(row.estimate_hours),
        actualHours:
          row.actual_hours == null ? null : Number(row.actual_hours),
        startDate: (row.start_date as string | null) ?? null,
        endDate: (row.end_date as string | null) ?? null,
        isBlocked: row.is_blocked === true,
        blockerReason: (row.blocker_reason as string | null) ?? null,
        isCritical: row.is_critical === true,
        assignedTo: (row.assigned_to as string | null) ?? null,
        orderIndex: Number(row.order_index ?? 0),
      }),
    );
  const activityIdSet = new Set(activities.map((activity) => activity.id));
  const dependencies = (dependencyResult.data ?? [])
    .filter(
      (row) =>
        row.organization_id === org.organizationId &&
        projectIdSet.has(row.project_id as string) &&
        activityIdSet.has(row.predecessor_id as string) &&
        activityIdSet.has(row.successor_id as string),
    )
    .map(
      (row): ProcessGraphDependency => ({
        id: row.id as string,
        organizationId: row.organization_id as string,
        projectId: row.project_id as string,
        predecessorId: row.predecessor_id as string,
        successorId: row.successor_id as string,
        dependencyType: row.dependency_type as string,
        lagDays: Number(row.lag_days ?? 0),
      }),
    );

  return {
    organizationId: org.organizationId,
    milestones,
    activities,
    dependencies,
    truncated:
      milestones.length >= MAX_MILESTONES ||
      activities.length >= MAX_ACTIVITIES ||
      dependencies.length >= MAX_DEPENDENCIES,
    limitations: [
      "portfolio_and_program_taxonomy_not_configured_in_current_project_schema",
      "workstreams_are_represented_by_milestones_until_a_canonical_workstream_model_exists",
      "manual_layout_is_presentation_state_only",
    ],
  };
}
