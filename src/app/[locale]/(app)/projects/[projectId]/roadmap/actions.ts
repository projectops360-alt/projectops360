"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { emitAndAutoLink, emitProcessNode } from "@/lib/graph/emit-event";
import {
  buildMilestoneCreatedEvents,
  buildMilestoneDeletedEvent,
  buildMilestoneStatusTransitionEvent,
  buildTaskCreatedEvents,
  buildTaskDeletedEvent,
  buildTaskDependencyEvent,
  buildTaskMutationEvents,
  captureProcessMiningEvents,
  TASK_CAPTURE_SELECT,
  taskCaptureSnapshotFromRow,
  type ProcessMiningCaptureSource,
} from "@/lib/events/process-mining-capture";
import { getComputedMilestoneStatus, computeMilestoneProgress } from "@/lib/roadmap/progress";
import { computeMilestoneReorder } from "@/lib/roadmap/milestone-reorder";
import {
  createTaskSchema,
  updateTaskSchema,
  buildTaskUpdatePatch,
  taskStatusValues,
} from "@/lib/workboard/task-schemas";
import type { AuditAction, Milestone, RoadmapTask } from "@/types/database";

function humanCaptureSource(userId: string, sourceModule = "roadmap"): ProcessMiningCaptureSource {
  return { actorType: "human", actorId: userId, sourceModule, captureMethod: "direct" };
}

// ── Zod Schemas ──────────────────────────────────────────────────────────────────
// Task create/update schemas + the preserve-on-absent update patch live in
// src/lib/workboard/task-schemas.ts (directly unit-tested).

const milestoneStatusValues = ["planned", "in_progress", "completed", "blocked", "deferred"] as const;
const iconKeyValues = ["setup", "shield_database", "users", "notebook", "link", "sparkles", "chart", "loop", "check_circle", "rocket"] as const;

const createMilestoneSchema = z.object({
  title: z.string().min(1, "titleRequired").max(200, "titleTooLong").transform((s) => s.trim()),
  description: z.string().max(20000, "descriptionTooLong").transform((s) => s.trim()).optional().default(""),
  status: z.enum(milestoneStatusValues).default("planned"),
  start_date: z.string().optional().default(""),
  target_date: z.string().optional().default(""),
  icon_key: z.enum(iconKeyValues).optional().default("setup"),
  order_index: z.coerce.number().int().min(0).default(0),
  progress_percent: z.coerce.number().int().min(0).max(100).default(0),
  projectId: z.string().uuid("invalid_project_id"),
});

const updateMilestoneSchema = z.object({
  milestoneId: z.string().uuid("invalid_milestone_id"),
  title: z.string().min(1, "titleRequired").max(200, "titleTooLong").transform((s) => s.trim()),
  description: z.string().max(20000, "descriptionTooLong").transform((s) => s.trim()).optional().default(""),
  status: z.enum(milestoneStatusValues),
  start_date: z.string().optional().default(""),
  target_date: z.string().optional().default(""),
  icon_key: z.enum(iconKeyValues).optional().default("setup"),
  order_index: z.coerce.number().int().min(0).optional(),
  progress_percent: z.coerce.number().int().min(0).max(100).optional(),
  status_override_enabled: z.boolean().default(false),
  status_override_value: z.enum(milestoneStatusValues).nullable().optional(),
  projectId: z.string().uuid("invalid_project_id"),
});


// ── Assignment type resolution ─────────────────────────────────────────────────────

/** Derive roadmap_tasks.assignment_type from how the task is assigned:
 *  direct user → 'person'; group-like resource → its mapped type. */
async function resolveAssignmentType(
  supabase: ReturnType<typeof createAdminClient>,
  assignedTo: string | null | undefined,
  assignedResourceId: string | null | undefined,
): Promise<string | null> {
  if (assignedResourceId) {
    const { data } = await supabase
      .from("resources")
      .select("resource_type")
      .eq("id", assignedResourceId)
      .single();
    const map: Record<string, string> = {
      person: "person",
      crew: "crew",
      team: "team",
      role: "role",
      vendor: "vendor",
      subcontractor: "vendor",
    };
    return map[data?.resource_type ?? ""] ?? "resource_group";
  }
  if (assignedTo) return "person";
  return null;
}

/** Resolve the effective owner when a Project Team member is chosen. Keeps the
 *  legacy assigned_to (a workspace user) in sync so reports/labor still see an
 *  assignee, while project_team_member_id holds the real Team & Roles link. */
async function resolveTeamAssignment(
  supabase: ReturnType<typeof createAdminClient>,
  projectTeamMemberId: string | null | undefined,
  fallbackUser: string | null | undefined,
  fallbackResource: string | null | undefined,
): Promise<{ teamMemberId: string | null; assignedTo: string | null; assignedResourceId: string | null }> {
  if (!projectTeamMemberId) {
    return { teamMemberId: null, assignedTo: fallbackUser ?? null, assignedResourceId: fallbackResource ?? null };
  }
  const { data } = await supabase.from("project_team_members").select("user_id").eq("id", projectTeamMemberId).maybeSingle();
  const userId = (data?.user_id as string | null) ?? null;
  // Owner = the team member; mirror its user into assigned_to (if internal).
  return { teamMemberId: projectTeamMemberId, assignedTo: userId, assignedResourceId: null };
}

// ── Task planning sync (predecessors + required materials) ────────────────────────

/** Returns true if adding predecessor → successor would create a cycle. */
function wouldCreateDependencyCycle(
  existingDeps: { predecessor_id: string; successor_id: string }[],
  newPredecessor: string,
  newSuccessor: string,
): boolean {
  const predecessorsOf = new Map<string, Set<string>>();
  for (const dep of existingDeps) {
    if (!predecessorsOf.has(dep.successor_id)) predecessorsOf.set(dep.successor_id, new Set());
    predecessorsOf.get(dep.successor_id)!.add(dep.predecessor_id);
  }
  // DFS upward from the new predecessor: reaching the successor means a cycle.
  const visited = new Set<string>();
  const stack = [newPredecessor];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSuccessor) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const pred of predecessorsOf.get(current) ?? []) stack.push(pred);
  }
  return false;
}

/**
 * Sync the form-managed planning of a task: finish_to_start predecessors and
 * required materials. Only finish_to_start dependencies are managed here so
 * manually created SS/FF/SF links are never touched.
 */
async function syncTaskPlanning(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  projectId: string,
  taskId: string,
  source: ProcessMiningCaptureSource,
  planning: {
    predecessorIds?: string[];
    materialIds?: string[];
    newMaterials?: string[];
  },
): Promise<void> {
  // ── Predecessors (finish_to_start) ────────────────────────────────────────
  if (planning.predecessorIds) {
    const wanted = new Set(planning.predecessorIds.filter((id) => id !== taskId));

    const { data: allDeps } = await supabase
      .from("task_dependencies")
      .select("id, predecessor_id, successor_id, dependency_type, lag_days")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId);

    const currentFs = (allDeps ?? []).filter(
      (d) => d.successor_id === taskId && d.dependency_type === "finish_to_start",
    );

    // Remove deselected
    const toRemove = currentFs.filter((d) => !wanted.has(d.predecessor_id));
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from("task_dependencies")
        .delete()
        .in("id", toRemove.map((d) => d.id));
      if (!removeError) {
        await captureProcessMiningEvents(toRemove.map((dependency) => buildTaskDependencyEvent({
          dependency: {
            dependencyId: dependency.id,
            organizationId,
            projectId,
            predecessorId: dependency.predecessor_id,
            successorId: dependency.successor_id,
            dependencyType: dependency.dependency_type,
            lagDays: dependency.lag_days,
          },
          change: "removed",
          source,
        })));
      }
    }

    // Add new ones, skipping anything that would create a cycle
    const currentSet = new Set(currentFs.map((d) => d.predecessor_id));
    const graph = (allDeps ?? []).map((d) => ({
      predecessor_id: d.predecessor_id,
      successor_id: d.successor_id,
    }));
    for (const predecessorId of wanted) {
      if (currentSet.has(predecessorId)) continue;
      if (wouldCreateDependencyCycle(graph, predecessorId, taskId)) continue;
      const { data: dependency, error } = await supabase
        .from("task_dependencies")
        .insert({
          organization_id: organizationId,
          project_id: projectId,
          predecessor_id: predecessorId,
          successor_id: taskId,
          dependency_type: "finish_to_start",
          lag_days: 0,
        })
        .select("id, predecessor_id, successor_id, dependency_type, lag_days")
        .single();
      if (!error && dependency) {
        graph.push({ predecessor_id: predecessorId, successor_id: taskId });
        await captureProcessMiningEvents([buildTaskDependencyEvent({
          dependency: {
            dependencyId: dependency.id,
            organizationId,
            projectId,
            predecessorId: dependency.predecessor_id,
            successorId: dependency.successor_id,
            dependencyType: dependency.dependency_type,
            lagDays: dependency.lag_days,
          },
          change: "added",
          source,
        })]);
      }
    }
  }

  // ── Required materials ────────────────────────────────────────────────────
  if (planning.materialIds) {
    const wanted = new Set(planning.materialIds);

    const { data: currentMaterials } = await supabase
      .from("material_requirements")
      .select("id")
      .eq("project_id", projectId)
      .eq("required_by_task_id", taskId)
      .is("deleted_at", null);

    const toUnlink = (currentMaterials ?? []).filter((m) => !wanted.has(m.id));
    if (toUnlink.length > 0) {
      await supabase
        .from("material_requirements")
        .update({ required_by_task_id: null })
        .in("id", toUnlink.map((m) => m.id));
    }
    if (wanted.size > 0) {
      await supabase
        .from("material_requirements")
        .update({ required_by_task_id: taskId })
        .in("id", [...wanted])
        .eq("project_id", projectId)
        .eq("organization_id", organizationId);
    }
  }

  // ── Quick-added materials ─────────────────────────────────────────────────
  const newNames = (planning.newMaterials ?? []).filter((n) => n.length > 0);
  if (newNames.length > 0) {
    await supabase.from("material_requirements").insert(
      newNames.map((name) => ({
        organization_id: organizationId,
        project_id: projectId,
        name,
        status: "required",
        required_by_task_id: taskId,
        origin: "manual",
      })),
    );
  }
}

// ── Task form options (people, tasks, materials) ──────────────────────────────────

/** Resource types that can own a task (shown in the assignee selector). */
const ASSIGNABLE_RESOURCE_TYPES = ["person", "crew", "team", "role", "vendor", "subcontractor"] as const;

export async function getTaskFormOptionsAction(input: {
  projectId: string;
}): Promise<{
  error?: string;
  people?: { id: string; name: string }[];
  resources?: { id: string; name: string; resource_type: string }[];
  teamMembers?: { id: string; name: string; role: string | null }[];
  tasks?: { id: string; title: string; milestone_id: string | null; start_date: string | null; end_date: string | null; order_index: number }[];
  materials?: { id: string; name: string; status: string; required_by_task_id: string | null }[];
  dependencies?: { predecessor_id: string; successor_id: string; dependency_type: string }[];
  /** Project type — drives the scoped "AI Execution" section (UX-014 exception). */
  projectType?: string;
}> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  if (!z.string().uuid().safeParse(input.projectId).success) {
    return { error: "invalid_project_id" };
  }

  const supabase = createAdminClient();
  const [peopleRes, resourcesRes, teamRes, tasksRes, materialsRes, depsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("organization_id", org.organizationId),
    supabase
      .from("resources")
      .select("id, name, resource_type")
      .eq("organization_id", org.organizationId)
      .eq("project_id", input.projectId)
      .in("resource_type", [...ASSIGNABLE_RESOURCE_TYPES])
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("project_team_members")
      .select("id, display_name, project_role, user_id")
      .eq("project_id", input.projectId)
      .eq("organization_id", org.organizationId)
      .neq("status", "removed"),
    supabase
      .from("roadmap_tasks")
      .select("id, title, milestone_id, start_date, end_date, order_index")
      .eq("project_id", input.projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    supabase
      .from("material_requirements")
      .select("id, name, status, required_by_task_id")
      .eq("project_id", input.projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("task_dependencies")
      .select("predecessor_id, successor_id, dependency_type")
      .eq("project_id", input.projectId)
      .eq("organization_id", org.organizationId),
  ]);

  const nameByUser = new Map((peopleRes.data ?? []).map((p) => [p.id, p.display_name || ""]));
  const teamMembers = ((teamRes.data ?? []) as { id: string; display_name: string | null; project_role: string | null; user_id: string | null }[])
    .map((m) => ({
      id: m.id,
      name: m.display_name || (m.user_id ? nameByUser.get(m.user_id) || "" : "") || m.project_role || "",
      role: m.project_role,
      assignable: !!(m.display_name || m.user_id), // skip pure unassigned role placeholders
    }))
    .filter((m) => m.assignable && m.name)
    .map(({ id, name, role }) => ({ id, name, role }));

  // Project type gates the scoped "AI Execution" section (UX-014 exception for
  // software_development / ai_native_execution). Cheap single-column read.
  const { data: projectRow } = await supabase
    .from("projects")
    .select("project_type")
    .eq("id", input.projectId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  return {
    people: (peopleRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.display_name || "—",
    })),
    resources: resourcesRes.data ?? [],
    teamMembers,
    tasks: tasksRes.data ?? [],
    materials: materialsRes.data ?? [],
    dependencies: depsRes.data ?? [],
    projectType: (projectRow as { project_type?: string } | null)?.project_type ?? "general",
  };
}

// ── Quick-add an assignable resource (person/crew/team/vendor) ────────────────────

const createPersonResourceSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  name: z.string().min(1, "nameRequired").max(200).transform((s) => s.trim()),
  resourceType: z.enum(ASSIGNABLE_RESOURCE_TYPES).default("person"),
});

export async function createPersonResourceAction(input: {
  projectId: string;
  name: string;
  resourceType?: string;
}): Promise<{ error?: string; resourceId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = createPersonResourceSchema.safeParse(input);
  if (!parsed.success) return { error: "validation_error" };
  const data = parsed.data;

  const supabase = createAdminClient();

  // Reuse an existing resource with the same name instead of duplicating
  const { data: existing } = await supabase
    .from("resources")
    .select("id")
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .ilike("name", data.name)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) return { resourceId: existing.id };

  const { data: resource, error } = await supabase
    .from("resources")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      resource_type: data.resourceType,
      name: data.name,
      status: "active",
      metadata: { origin: "task_form_quick_add" },
    })
    .select("id")
    .single();
  if (error || !resource) {
    console.error("Failed to create resource:", error);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "resources",
    entityId: resource.id,
    metadata: { name: data.name, resource_type: data.resourceType },
  });

  return { resourceId: resource.id };
}

// ── Create Milestone ──────────────────────────────────────────────────────────────

export async function createMilestoneAction(input: {
  title: string;
  description?: string;
  status?: string;
  start_date?: string;
  target_date?: string;
  icon_key?: string;
  order_index?: number;
  progress_percent?: number;
  projectId: string;
}): Promise<{ error?: string; milestoneId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = createMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  // Auto-assign order_index: if not specified (0), place at end
  let milestoneOrderIndex = data.order_index;
  if (milestoneOrderIndex === 0) {
    const { data: existingMilestones } = await supabase
      .from("milestones")
      .select("order_index")
      .eq("project_id", data.projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: false })
      .limit(1);

    if (existingMilestones && existingMilestones.length > 0 && existingMilestones[0].order_index >= 0) {
      milestoneOrderIndex = existingMilestones[0].order_index + 1;
    } else {
      milestoneOrderIndex = 0;
    }
  }

  const { data: milestone, error: insertError } = await supabase
    .from("milestones")
    .insert({
      title: data.title,
      description: data.description || null,
      status: data.status,
      start_date: data.start_date || null,
      target_date: data.target_date || null,
      icon_key: data.icon_key,
      order_index: milestoneOrderIndex,
      progress_percent: data.progress_percent,
      project_id: data.projectId,
      organization_id: org.organizationId,
    })
    .select("id, title, status")
    .single();

  if (insertError || !milestone) {
    console.error("Failed to create milestone:", insertError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "milestones",
    entityId: milestone.id,
    metadata: { title: data.title, status: data.status },
  });

  const milestoneCapture = await captureProcessMiningEvents(buildMilestoneCreatedEvents({
    milestone: {
      milestoneId: milestone.id,
      organizationId: org.organizationId,
      projectId: data.projectId,
      title: milestone.title,
      status: milestone.status,
    },
    source: humanCaptureSource(org.userId),
  }));

  // Materialize the milestone into the Living Graph projection via the APPROVED
  // path (emit-event). The classic Living Graph / Project Execution Map derives
  // milestone nodes exclusively from process_nodes (source_entity_type =
  // 'milestones', node_type = 'milestone_gate'); without this a newly created
  // milestone would exist in Roadmap but be invisible in the graph (bug:
  // LIVING-GRAPH-NEW-MILESTONE-AUTO-INCLUSION). Awaited (not fire-and-forget) so
  // the node exists BEFORE revalidate → the milestone appears on the next render
  // with 0 tasks and no milestone-flow edge yet (planned/unconnected node).
  // emitProcessNode is idempotent (unique violation → existing id).
  await emitProcessNode({
    organizationId: org.organizationId,
    projectId: data.projectId,
    nodeType: "milestone_gate",
    sourceEntityType: "milestones",
    sourceEntityId: milestone.id,
    title: data.title,
    metadata: {
      status: data.status,
      progress: data.progress_percent,
      canonical_event_emitted: milestoneCapture.complete,
    },
  });

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");

  return { milestoneId: milestone.id };
}

// ── Update Milestone ──────────────────────────────────────────────────────────────

export async function updateMilestoneAction(input: {
  milestoneId: string;
  title: string;
  description?: string;
  status: string;
  start_date?: string;
  target_date?: string;
  icon_key?: string;
  order_index?: number;
  progress_percent?: number;
  status_override_enabled?: boolean;
  status_override_value?: string | null;
  projectId: string;
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = updateMilestoneSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  const { data: currentMilestone, error: currentMilestoneError } = await supabase
    .from("milestones")
    .select("id, title, status")
    .eq("id", data.milestoneId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .single();

  if (currentMilestoneError || !currentMilestone) {
    console.error("Failed to load milestone before update:", currentMilestoneError);
    return { error: "unexpected" };
  }

  const updateData: Record<string, unknown> = {
    title: data.title,
    description: data.description || null,
    status: data.status,
    start_date: data.start_date || null,
    target_date: data.target_date || null,
    icon_key: data.icon_key,
    status_override_enabled: data.status_override_enabled,
    status_override_value: data.status_override_enabled ? (data.status_override_value ?? null) : null,
  };
  if (data.order_index !== undefined) updateData.order_index = data.order_index;
  if (data.progress_percent !== undefined) updateData.progress_percent = data.progress_percent;

  const { data: updatedMilestone, error: updateError } = await supabase
    .from("milestones")
    .update(updateData)
    .eq("id", data.milestoneId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .select("id, title, status")
    .single();

  if (updateError || !updatedMilestone) {
    console.error("Failed to update milestone:", updateError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "milestones",
    entityId: data.milestoneId,
    metadata: { title: data.title, status: data.status },
  });

  const milestoneStatusEvent = buildMilestoneStatusTransitionEvent({
    milestone: {
      milestoneId: updatedMilestone.id,
      organizationId: org.organizationId,
      projectId: data.projectId,
      title: updatedMilestone.title,
      status: updatedMilestone.status,
    },
    fromStatus: currentMilestone.status,
    toStatus: updatedMilestone.status,
    source: humanCaptureSource(org.userId),
  });
  if (milestoneStatusEvent) await captureProcessMiningEvents([milestoneStatusEvent]);

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");

  return {};
}

// ── Reorder Milestone (move up / down in the sequence) ───────────────────────────────

/**
 * Move a milestone one position earlier ("up") or later ("down") in the project
 * sequence. This is the USER-FACING way to reshape the Living Graph flow line
 * (which follows `order_index`) — no database editing required. Swaps the
 * order_index with the adjacent milestone; a boundary move is a safe no-op.
 */
export async function reorderMilestoneAction(
  milestoneId: string,
  projectId: string,
  direction: "up" | "down",
): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();
  const { data: rows, error: fetchError } = await supabase
    .from("milestones")
    .select("id, order_index")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });

  if (fetchError || !rows) {
    console.error("Failed to load milestones for reorder:", fetchError);
    return { error: "unexpected" };
  }

  const result = computeMilestoneReorder(rows, milestoneId, direction);
  if (!result) return {}; // not found or already at the boundary — safe no-op

  for (const u of result.updates) {
    const { error: updateError } = await supabase
      .from("milestones")
      .update({ order_index: u.order_index })
      .eq("id", u.id)
      .eq("organization_id", org.organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (updateError) {
      console.error("Failed to reorder milestone:", updateError);
      return { error: "unexpected" };
    }
  }

  await logAudit({
    org,
    projectId,
    action: "update",
    entityType: "milestones",
    entityId: milestoneId,
    metadata: { reorder: direction },
  });

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");

  return {};
}

// ── Create Task ────────────────────────────────────────────────────────────────────

export async function createTaskAction(input: {
  title: string;
  description?: string;
  milestone_id?: string;
  status?: string;
  priority?: string;
  sprint_name?: string;
  estimate_hours?: number | null;
  actual_hours?: number | null;
  dependency_notes?: string;
  acceptance_criteria?: string;
  order_index?: number;
  prompt_body?: string;
  prompt_context?: string;
  ai_tool_target?: string;
  implementation_notes?: string;
  test_notes?: string;
  execution_notes?: string;
  blocker_reason?: string;
  start_date?: string;
  end_date?: string;
  progress?: number;
  assigned_to?: string | null;
  assigned_resource_id?: string | null;
  project_team_member_id?: string | null;
  predecessor_ids?: string[];
  material_ids?: string[];
  new_materials?: string[];
  projectId: string;
}): Promise<{ error?: string; taskId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  // Auto-assign order_index: if not specified (0), place at end of milestone
  let orderIndex = data.order_index;
  if (orderIndex === 0) {
    let maxOrderQuery = supabase
      .from("roadmap_tasks")
      .select("order_index")
      .eq("project_id", data.projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null);

    if (data.milestone_id) {
      maxOrderQuery = maxOrderQuery.eq("milestone_id", data.milestone_id);
    } else {
      maxOrderQuery = maxOrderQuery.is("milestone_id", null);
    }

    const { data: existingTasks } = await maxOrderQuery
      .order("order_index", { ascending: false })
      .limit(1);

    if (existingTasks && existingTasks.length > 0 && existingTasks[0].order_index >= 0) {
      orderIndex = existingTasks[0].order_index + 1;
    } else {
      orderIndex = 0;
    }
  }

  const own = await resolveTeamAssignment(supabase, data.project_team_member_id, data.assigned_to, data.assigned_resource_id);

  const { data: task, error: insertError } = await supabase
    .from("roadmap_tasks")
    .insert({
      title: data.title,
      description: data.description || null,
      milestone_id: data.milestone_id || null,
      status: data.status,
      priority: data.priority,
      sprint_name: data.sprint_name || null,
      estimate_hours: data.estimate_hours ?? null,
      actual_hours: data.actual_hours ?? null,
      dependency_notes: data.dependency_notes || null,
      acceptance_criteria: data.acceptance_criteria || null,
      order_index: orderIndex,
      prompt_body: data.prompt_body || null,
      prompt_context: data.prompt_context || null,
      ai_tool_target: data.ai_tool_target || null,
      implementation_notes: data.implementation_notes || null,
      test_notes: data.test_notes || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      progress: data.progress,
      assigned_to: own.assignedTo,
      assigned_resource_id: own.assignedResourceId,
      project_team_member_id: own.teamMemberId,
      assignment_type: await resolveAssignmentType(supabase, own.assignedTo, own.assignedResourceId),
      project_id: data.projectId,
      organization_id: org.organizationId,
    })
    .select(TASK_CAPTURE_SELECT)
    .single();

  if (insertError || !task) {
    console.error("Failed to create roadmap task:", insertError);
    return { error: "unexpected" };
  }

  const taskSource = humanCaptureSource(org.userId);
  const taskCapture = await captureProcessMiningEvents(buildTaskCreatedEvents({
    task: taskCaptureSnapshotFromRow(task, org.organizationId, data.projectId),
    source: taskSource,
    blockerReason: data.blocker_reason,
  }));

  // Predecessors + required materials chosen in the form
  await syncTaskPlanning(supabase, org.organizationId, data.projectId, task.id, taskSource, {
    predecessorIds: data.predecessor_ids,
    materialIds: data.material_ids,
    newMaterials: data.new_materials,
  });

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "roadmap_tasks",
    entityId: task.id,
    metadata: { title: data.title, status: data.status, priority: data.priority },
  });

  // Materialize the task into the Living Graph projection via the APPROVED path,
  // parallel to milestone creation above. The graph derives task nodes from
  // process_nodes (source_entity_type = 'roadmap_tasks', node_type =
  // 'task_transition'); previously a task node only appeared once its STATUS
  // changed (updateTaskStatusAction), so tasks created and left untouched were
  // invisible — and a milestone's direct tasks would not appear on expansion
  // (bug: LIVING-GRAPH-NEW-MILESTONE-AUTO-INCLUSION, hierarchy gate). Awaited so
  // the node exists before revalidate. Idempotent.
  await emitProcessNode({
    organizationId: org.organizationId,
    projectId: data.projectId,
    nodeType: "task_transition",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: task.id,
    title: data.title,
    metadata: {
      status: data.status,
      priority: data.priority,
      canonical_event_emitted: taskCapture.complete,
    },
  });

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");

  // Fire-and-forget: generate embedding for semantic search
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("roadmap_tasks", task.id, {
      title: data.title,
      description: data.description || null,
      dependency_notes: data.dependency_notes || null,
      acceptance_criteria: data.acceptance_criteria || null,
      prompt_body: data.prompt_body || null,
      prompt_context: data.prompt_context || null,
      implementation_notes: data.implementation_notes || null,
      test_notes: data.test_notes || null,
    }).catch(() => { /* already logged inside */ });
  });

  // Recalculate parent milestone status (adding first task can change milestone from planned to in_progress)
  await recalculateMilestoneStatus(task.id, data.projectId, org.organizationId, supabase);

  return { taskId: task.id };
}

// ── Update Task ────────────────────────────────────────────────────────────────────

export async function updateTaskAction(input: {
  taskId: string;
  title: string;
  description?: string;
  milestone_id?: string | null;
  status: string;
  priority: string;
  sprint_name?: string;
  estimate_hours?: number | null;
  actual_hours?: number | null;
  dependency_notes?: string;
  acceptance_criteria?: string;
  order_index?: number;
  prompt_body?: string;
  prompt_context?: string;
  ai_tool_target?: string;
  implementation_notes?: string;
  test_notes?: string;
  execution_notes?: string;
  blocker_reason?: string;
  start_date?: string;
  end_date?: string;
  progress?: number;
  assigned_to?: string | null;
  assigned_resource_id?: string | null;
  project_team_member_id?: string | null;
  predecessor_ids?: string[];
  material_ids?: string[];
  new_materials?: string[];
  projectId: string;
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  const { data: currentTask, error: currentTaskError } = await supabase
    .from("roadmap_tasks")
    .select(TASK_CAPTURE_SELECT)
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .single();

  if (currentTaskError || !currentTask) {
    console.error("Failed to load roadmap task before update:", currentTaskError);
    return { error: "unexpected" };
  }

  // Preserve-on-absent for EVERY optional field (UX-014 pattern, generalized):
  // only columns the caller explicitly sent are written — an omitted field
  // (collapsed section, partial caller, gated AI Execution) keeps its stored
  // value; an explicit "" clears it. Built by the unit-tested pure patch
  // builder in src/lib/workboard/task-schemas.ts.
  const updateData: Record<string, unknown> = buildTaskUpdatePatch(data);
  if (data.assigned_to !== undefined || data.assigned_resource_id !== undefined || data.project_team_member_id !== undefined) {
    const own = await resolveTeamAssignment(supabase, data.project_team_member_id, data.assigned_to, data.assigned_resource_id);
    updateData.assigned_to = own.assignedTo;
    updateData.assigned_resource_id = own.assignedResourceId;
    updateData.project_team_member_id = own.teamMemberId;
    updateData.assignment_type = await resolveAssignmentType(supabase, own.assignedTo, own.assignedResourceId);
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from("roadmap_tasks")
    .update(updateData)
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .select(TASK_CAPTURE_SELECT)
    .single();

  if (updateError || !updatedTask) {
    console.error("Failed to update roadmap task:", updateError);
    return { error: "unexpected" };
  }

  const taskSource = humanCaptureSource(org.userId);
  await captureProcessMiningEvents(buildTaskMutationEvents({
    before: taskCaptureSnapshotFromRow(currentTask, org.organizationId, data.projectId),
    after: taskCaptureSnapshotFromRow(updatedTask, org.organizationId, data.projectId),
    source: taskSource,
    note: data.blocker_reason,
  }));

  // Predecessors + required materials chosen in the form
  await syncTaskPlanning(supabase, org.organizationId, data.projectId, data.taskId, taskSource, {
    predecessorIds: data.predecessor_ids,
    materialIds: data.material_ids,
    newMaterials: data.new_materials,
  });

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "roadmap_tasks",
    entityId: data.taskId,
    metadata: { title: data.title, status: data.status, priority: data.priority },
  });

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");

  // Fire-and-forget: regenerate embedding after task update
  import("@/lib/embeddings/generate").then(({ generateAndStoreEmbedding }) => {
    generateAndStoreEmbedding("roadmap_tasks", data.taskId, {
      title: data.title,
      description: data.description || null,
      dependency_notes: data.dependency_notes || null,
      acceptance_criteria: data.acceptance_criteria || null,
      prompt_body: data.prompt_body || null,
      prompt_context: data.prompt_context || null,
      implementation_notes: data.implementation_notes || null,
      test_notes: data.test_notes || null,
      execution_notes: data.execution_notes || null,
      blocker_reason: data.blocker_reason || null,
    }).catch(() => { /* already logged inside */ });
  });

  // Recalculate parent milestone status (milestone_id may have changed)
  await recalculateMilestoneStatus(data.taskId, data.projectId, org.organizationId, supabase);

  return {};
}

// ── Update Task Status (already existed) ───────────────────────────────────────

const updateTaskStatusSchema = z.object({
  taskId: z.string().uuid("invalid_task_id"),
  status: z.enum(taskStatusValues, { message: "invalid_status" }),
  projectId: z.string().uuid("invalid_project_id"),
  note: z.string().max(5000).optional(),
});

// Statuses that mean a task has been started (or finished) — used for dependency gating
const STARTED_TASK_STATUSES = new Set<string>([
  "sent_to_ai", "in_progress", "implemented", "tested", "done",
]);

export async function updateTaskStatusAction(input: {
  taskId: string;
  status: string;
  projectId: string;
  note?: string;
}): Promise<{ error?: string; predecessorTitle?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = updateTaskStatusSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  // Fetch current status for audit before/after
  const { data: currentTask } = await supabase
    .from("roadmap_tasks")
    .select(`${TASK_CAPTURE_SELECT}, execution_notes`)
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .single();

  if (!currentTask) return { error: "unexpected" };

  const previousStatus = currentTask.status;
  const taskTitle = currentTask.title;

  // Skip if status unchanged
  if (previousStatus === data.status) return {};

  // Dependency gating: a task cannot start (or finish) while an ordering
  // predecessor is incomplete. finish_to_start requires the predecessor to be
  // done; start_to_start requires it to have started.
  if (STARTED_TASK_STATUSES.has(data.status)) {
    const { data: deps } = await supabase
      .from("task_dependencies")
      .select("predecessor_id, dependency_type")
      .eq("successor_id", data.taskId)
      .eq("organization_id", org.organizationId)
      .in("dependency_type", ["finish_to_start", "start_to_start"]);

    const predecessorIds = (deps ?? []).map((d) => d.predecessor_id);
    if (predecessorIds.length > 0) {
      const { data: predecessors } = await supabase
        .from("roadmap_tasks")
        .select("id, title, status")
        .in("id", predecessorIds)
        .is("deleted_at", null);

      const predById = new Map((predecessors ?? []).map((p) => [p.id, p]));
      for (const dep of deps ?? []) {
        const pred = predById.get(dep.predecessor_id);
        if (!pred) continue;
        const unmet =
          dep.dependency_type === "finish_to_start"
            ? pred.status !== "done"
            : !STARTED_TASK_STATUSES.has(pred.status);
        if (unmet) {
          return { error: "dependency_not_met", predecessorTitle: pred.title };
        }
      }
    }
  }

  // Build update payload — include note if provided
  const updatePayload: Record<string, unknown> = { status: data.status };

  if (data.note?.trim()) {
    const trimmedNote = data.note.trim();
    if (data.status === "done") {
      // Append to execution_notes for completed tasks
      const existingNotes = currentTask.execution_notes || "";
      updatePayload.execution_notes = existingNotes
        ? existingNotes + "\n\n" + trimmedNote
        : trimmedNote;
      updatePayload.completed_at = new Date().toISOString();
    } else if (data.status === "blocked") {
      updatePayload.blocker_reason = trimmedNote;
      updatePayload.is_blocked = true;
    } else {
      // Append to execution_notes for other status changes
      const existingNotes = currentTask.execution_notes || "";
      updatePayload.execution_notes = existingNotes
        ? existingNotes + "\n\n" + trimmedNote
        : trimmedNote;
    }
  }

  // Auto-set completed_at / is_blocked for status changes without note
  if (data.status === "done" && !updatePayload.completed_at) {
    updatePayload.completed_at = new Date().toISOString();
  }
  if (data.status === "blocked" && !updatePayload.is_blocked) {
    updatePayload.is_blocked = true;
  }
  if (previousStatus === "blocked" && data.status !== "blocked") {
    updatePayload.is_blocked = false;
    updatePayload.blocker_reason = null;
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from("roadmap_tasks")
    .update(updatePayload)
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .select(TASK_CAPTURE_SELECT)
    .single();

  if (updateError || !updatedTask) {
    console.error("Failed to update roadmap task status:", updateError);
    return { error: "unexpected" };
  }

  // Determine specific audit action
  const newStatus = data.status as string;
  let auditAction: AuditAction = "task_status_changed";
  if (newStatus === "blocked") auditAction = "task_blocked";
  else if (newStatus === "done") auditAction = "task_completed";
  else if (previousStatus === "blocked") auditAction = "task_unblocked";

  await logAudit({
    org,
    projectId: data.projectId,
    action: auditAction,
    entityType: "roadmap_tasks",
    entityId: data.taskId,
    metadata: {
      field: "status",
      previousStatus,
      newStatus: data.status,
      title: taskTitle,
      ...(data.note ? { note: data.note.trim() } : {}),
    },
  });

  const taskCapture = await captureProcessMiningEvents(buildTaskMutationEvents({
    before: taskCaptureSnapshotFromRow(currentTask, org.organizationId, data.projectId),
    after: taskCaptureSnapshotFromRow(updatedTask, org.organizationId, data.projectId),
    source: humanCaptureSource(org.userId),
    note: data.note,
  }));

  // Fire-and-forget: emit Living Graph event for task status change
  emitAndAutoLink({
    organizationId: org.organizationId,
    projectId: data.projectId,
    nodeType: "task_transition",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: data.taskId,
    title: taskTitle,
    metadata: {
      old_status: previousStatus,
      new_status: data.status,
      canonical_event_emitted: taskCapture.complete,
      ...(data.note ? { note: data.note.trim() } : {}),
    },
  });

  // Revalidate the project page so all tabs see fresh data
  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");

  // ── Recalculate parent milestone status ──────────────────────────────────
  // After a task status changes, recompute the parent milestone's computed
  // status and progress_percent so the UI stays consistent.
  await recalculateMilestoneStatus(data.taskId, data.projectId, org.organizationId, supabase);

  return {};
}

// ── Reorder Tasks (Workboard drag reorder — order_index only) ──────────────────
// Persists same-column drag reordering / cross-column drop position. This changes
// ONLY order_index — never status — so it never emits a (misleading) task status
// event. Scoped by org + project like every other task write. Audited as a plain
// "update" clearly tagged field=order_index (an order change, not a status change).

const reorderTasksSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  updates: z
    .array(
      z.object({
        taskId: z.string().uuid("invalid_task_id"),
        orderIndex: z.coerce.number().int().min(0),
      }),
    )
    .min(1, "no_updates")
    .max(500, "too_many_updates"),
});

export async function reorderTasksAction(input: {
  projectId: string;
  updates: { taskId: string; orderIndex: number }[];
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = reorderTasksSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  // Apply each order_index write, strictly scoped to this org + project so a
  // caller can never touch another project's or organization's tasks.
  const results = await Promise.all(
    data.updates.map((u) =>
      supabase
        .from("roadmap_tasks")
        .update({ order_index: u.orderIndex })
        .eq("id", u.taskId)
        .eq("organization_id", org.organizationId)
        .eq("project_id", data.projectId)
        .is("deleted_at", null),
    ),
  );

  if (results.some((r) => r.error)) {
    console.error("Failed to reorder roadmap tasks:", results.find((r) => r.error)?.error);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "roadmap_tasks",
    entityId: data.updates[0].taskId,
    metadata: { field: "order_index", count: data.updates.length },
  });

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");

  return {};
}

// ── Record Prompt Sent ──────────────────────────────────────────────────────────
// Called when the user copies a prompt. Optionally transitions status to sent_to_ai.

const recordPromptSentSchema = z.object({
  taskId: z.string().uuid("invalid_task_id"),
  projectId: z.string().uuid("invalid_project_id"),
  setStatusToSentToAi: z.boolean().default(false),
});

export async function recordPromptSentAction(input: {
  taskId: string;
  projectId: string;
  setStatusToSentToAi?: boolean;
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = recordPromptSentSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  const { data: currentTask, error: currentTaskError } = await supabase
    .from("roadmap_tasks")
    .select(TASK_CAPTURE_SELECT)
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .single();

  if (currentTaskError || !currentTask) {
    console.error("Failed to load task before recording prompt sent:", currentTaskError);
    return { error: "unexpected" };
  }

  const updateData: Record<string, unknown> = {
    last_prompt_sent_at: new Date().toISOString(),
  };

  if (data.setStatusToSentToAi) {
    updateData.status = "sent_to_ai";
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from("roadmap_tasks")
    .update(updateData)
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .select(TASK_CAPTURE_SELECT)
    .single();

  if (updateError || !updatedTask) {
    console.error("Failed to record prompt sent:", updateError);
    return { error: "unexpected" };
  }

  // Audit: specific action for prompt workflow
  const auditAction: AuditAction = data.setStatusToSentToAi ? "prompt_sent_to_ai" : "prompt_copied";
  await logAudit({
    org,
    projectId: data.projectId,
    action: auditAction,
    entityType: "roadmap_tasks",
    entityId: data.taskId,
    metadata: {
      field: "last_prompt_sent_at",
      setStatusToSentToAi: data.setStatusToSentToAi,
      // Note: we deliberately do NOT log prompt_body content here to avoid secrets exposure
    },
  });

  await captureProcessMiningEvents(buildTaskMutationEvents({
    before: taskCaptureSnapshotFromRow(currentTask, org.organizationId, data.projectId),
    after: taskCaptureSnapshotFromRow(updatedTask, org.organizationId, data.projectId),
    source: humanCaptureSource(org.userId),
  }));

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");

  return {};
}

// ── Get Task Audit Trail ──────────────────────────────────────────────────────
// Returns recent audit logs for a specific roadmap task.

const ROADMAP_AUDIT_ACTIONS: AuditAction[] = [
  "task_status_changed",
  "task_blocked",
  "task_completed",
  "task_unblocked",
  "prompt_copied",
  "prompt_sent_to_ai",
  "update",
];

export interface AuditTrailEntry {
  id: string;
  action: string;
  actor_user_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getTaskAuditTrailAction(input: {
  taskId: string;
  projectId: string;
  limit?: number;
}): Promise<{ error?: string; data?: AuditTrailEntry[] }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();
  const limit = input.limit ?? 10;

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, actor_user_id, metadata, created_at")
    .eq("organization_id", org.organizationId)
    .eq("project_id", input.projectId)
    .eq("entity_type", "roadmap_tasks")
    .eq("entity_id", input.taskId)
    .in("action", ROADMAP_AUDIT_ACTIONS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch audit trail:", error);
    return { error: "unexpected" };
  }

  return { data: (data as AuditTrailEntry[]) ?? [] };
}

// ── Milestone Status Recalculation ──────────────────────────────────────────────
// When a task's status changes, recalculate the parent milestone's computed
// status and progress_percent. This keeps milestone state in sync with tasks.
// Skipped if the milestone has status_override_enabled = true (manual pin).

async function recalculateMilestoneStatus(
  taskId: string,
  projectId: string,
  organizationId: string,
  supabase: ReturnType<typeof createAdminClient>,
  milestoneIdOverride?: string | null,
): Promise<void> {
  try {
    let milestoneId = milestoneIdOverride ?? null;
    if (!milestoneId) {
      const { data: task } = await supabase
        .from("roadmap_tasks")
        .select("milestone_id")
        .eq("id", taskId)
        .eq("organization_id", organizationId)
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .single();
      milestoneId = (task as { milestone_id: string | null } | null)?.milestone_id ?? null;
    }
    if (!milestoneId) return;

    // Fetch the milestone
    const { data: milestone } = await supabase
      .from("milestones")
      .select("id, title, status, progress_percent, status_override_enabled, status_override_value")
      .eq("id", milestoneId)
      .eq("organization_id", organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .single();

    if (!milestone) return;

    // Skip recalculation if manual override is enabled
    const m = milestone as { id: string; title: string; status: string; progress_percent: number; status_override_enabled: boolean; status_override_value: string | null };
    if (m.status_override_enabled) return;

    // Fetch all active tasks for this milestone
    const { data: milestoneTasks } = await supabase
      .from("roadmap_tasks")
      .select("id, status, milestone_id")
      .eq("milestone_id", milestoneId)
      .eq("organization_id", organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null);

    if (!milestoneTasks) return;

    // Compute derived status and progress
    const typedMilestone = {
      id: m.id,
      status: m.status,
      progress_percent: m.progress_percent,
      status_override_enabled: m.status_override_enabled,
      status_override_value: m.status_override_value,
    } as Milestone;

    const typedTasks = milestoneTasks as RoadmapTask[];
    const computedStatus = getComputedMilestoneStatus(typedMilestone, typedTasks);
    const computedProgress = computeMilestoneProgress(typedMilestone, typedTasks);

    // Only update if status or progress actually changed
    if (computedStatus !== m.status || computedProgress.progressPercent !== m.progress_percent) {
      const { error: updateError } = await supabase
        .from("milestones")
        .update({
          status: computedStatus,
          progress_percent: computedProgress.progressPercent,
        })
        .eq("id", milestoneId)
        .eq("organization_id", organizationId);
      if (!updateError && computedStatus !== m.status) {
        const statusEvent = buildMilestoneStatusTransitionEvent({
          milestone: {
            milestoneId,
            organizationId,
            projectId,
            title: m.title,
            status: computedStatus,
          },
          fromStatus: m.status,
          toStatus: computedStatus,
          source: {
            actorType: "system",
            sourceModule: "roadmap-rollup",
            captureMethod: "derived",
            provenance: { derivation_rule: "milestone_status_from_task_rollup" },
          },
        });
        if (statusEvent) await captureProcessMiningEvents([statusEvent]);
      }
    }
  } catch (err) {
    // Non-critical: log but don't fail the task status update
    console.error("Failed to recalculate milestone status:", err);
  }
}

// ── Archive Task (soft delete) ────────────────────────────────────────────────────

export async function archiveTaskAction(
  taskId: string,
  projectId: string,
): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();

  const { data: currentTask, error: currentTaskError } = await supabase
    .from("roadmap_tasks")
    .select(TASK_CAPTURE_SELECT)
    .eq("id", taskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (currentTaskError || !currentTask) {
    console.error("Failed to load task before archive:", currentTaskError);
    return { error: "unexpected" };
  }

  // Soft-delete the task
  const { error: deleteError } = await supabase
    .from("roadmap_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (deleteError) {
    console.error("Failed to archive task:", deleteError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId,
    action: "delete" as AuditAction,
    entityType: "roadmap_tasks",
    entityId: taskId,
    metadata: { soft_delete: true },
  });

  await captureProcessMiningEvents([buildTaskDeletedEvent({
    task: taskCaptureSnapshotFromRow(currentTask, org.organizationId, projectId),
    source: humanCaptureSource(org.userId),
  })]);

  if (currentTask.milestone_id) {
    await recalculateMilestoneStatus(
      taskId,
      projectId,
      org.organizationId,
      supabase,
      currentTask.milestone_id,
    );
  }

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");
  return {};
}

// ── Archive Milestone (soft delete, cascades to tasks) ────────────────────────────

export async function archiveMilestoneAction(
  milestoneId: string,
  projectId: string,
): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const supabase = createAdminClient();

  const [{ data: currentMilestone, error: milestoneFetchError }, { data: currentTasks, error: taskFetchError }] = await Promise.all([
    supabase
      .from("milestones")
      .select("id, title, status")
      .eq("id", milestoneId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("roadmap_tasks")
      .select(TASK_CAPTURE_SELECT)
      .eq("milestone_id", milestoneId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
  ]);

  if (milestoneFetchError || !currentMilestone || taskFetchError) {
    console.error("Failed to load milestone before archive:", milestoneFetchError ?? taskFetchError);
    return { error: "unexpected" };
  }

  const captureSource = humanCaptureSource(org.userId);

  // First, soft-delete all tasks belonging to this milestone
  const { error: taskDeleteError } = await supabase
    .from("roadmap_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("milestone_id", milestoneId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (taskDeleteError) {
    console.error("Failed to archive milestone tasks:", taskDeleteError);
    return { error: "unexpected" };
  }

  await captureProcessMiningEvents((currentTasks ?? []).map((task) => buildTaskDeletedEvent({
    task: taskCaptureSnapshotFromRow(task, org.organizationId, projectId),
    source: captureSource,
  })));

  // Then, soft-delete the milestone itself
  const { error: milestoneDeleteError } = await supabase
    .from("milestones")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (milestoneDeleteError) {
    console.error("Failed to archive milestone:", milestoneDeleteError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId,
    action: "delete" as AuditAction,
    entityType: "milestones",
    entityId: milestoneId,
    metadata: { soft_delete: true, cascaded_to_tasks: true },
  });

  await captureProcessMiningEvents([buildMilestoneDeletedEvent({
    milestone: {
      milestoneId: currentMilestone.id,
      organizationId: org.organizationId,
      projectId,
      title: currentMilestone.title,
      status: currentMilestone.status,
    },
    source: captureSource,
  })]);

  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");
  return {};
}
