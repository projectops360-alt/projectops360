"use server";

// ============================================================================
// ProjectOps360° — Subtasks · Server actions (RBAC + audit + events)
// ============================================================================
// Every mutation: trusted session (getOrgContext) → zod validation → RBAC
// (authorizeSubtaskAction, deny-by-default) → org/project-scoped write via
// the admin client → parent progress recalculation (pure engine) → audit log
// → canonical Project Event Graph events (emitProjectEventSafe) → revalidate.
// Tasks WITHOUT subtasks keep their manual progress (the engine returns null
// and we never touch roadmap_tasks.progress). Guarded by SUBTASK-PROGRESS.
// ============================================================================

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, type OrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { emitProjectEventSafe } from "@/lib/events/ingestion";
import {
  buildTaskStatusTransitionEvent,
  captureProcessMiningEvents,
  TASK_CAPTURE_SELECT,
  taskCaptureSnapshotFromRow,
  type TaskCaptureRow,
} from "@/lib/events/process-mining-capture";
import { buildSubtaskEvent, type SubtaskEventType } from "./subtask-events";
import { authorizeSubtaskAction, type SubtaskAction } from "./permissions";
import {
  createSubtaskSchema,
  updateSubtaskSchema,
  blockSubtaskSchema,
  unblockSubtaskSchema,
  reassignSubtaskSchema,
  deleteSubtaskSchema,
  overrideParentProgressSchema,
  closeParentWithIncompleteSchema,
} from "./schemas";
import { computeParentProgress, evaluateParentCloseGate } from "./progress";
import type { Subtask, SubtaskProgressMode } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

interface TaskRow extends TaskCaptureRow {
  progress: number;
  subtask_progress_mode: SubtaskProgressMode;
  progress_overridden: boolean;
}

async function loadTask(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
): Promise<TaskRow | null> {
  const { data } = await supabase
    .from("roadmap_tasks")
    .select(`${TASK_CAPTURE_SELECT}, progress, subtask_progress_mode, progress_overridden`)
    .eq("id", taskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as TaskRow | null) ?? null;
}

async function loadSubtask(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  subtaskId: string,
): Promise<Subtask | null> {
  const { data } = await supabase
    .from("task_subtasks")
    .select("*")
    .eq("id", subtaskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as Subtask | null) ?? null;
}

async function loadActiveSubtasks(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
): Promise<Subtask[]> {
  const { data } = await supabase
    .from("task_subtasks")
    .select("*")
    .eq("task_id", taskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as Subtask[] | null) ?? [];
}

function authorize(
  org: OrgContext,
  action: SubtaskAction,
  subtaskOwnerId?: string | null,
  taskAssignedTo?: string | null,
): string | null {
  const decision = authorizeSubtaskAction({
    role: org.role,
    userId: org.userId,
    action,
    subtaskOwnerId,
    taskAssignedTo,
  });
  return decision.allowed ? null : "forbidden";
}

function emit(
  org: OrgContext,
  projectId: string,
  taskId: string,
  subtaskId: string | null,
  eventType: SubtaskEventType,
  title: string,
  extra: { oldValue?: unknown; newValue?: unknown; reason?: string | null; metadata?: Record<string, unknown> } = {},
): void {
  emitProjectEventSafe(
    buildSubtaskEvent({
      eventType,
      organizationId: org.organizationId,
      projectId,
      taskId,
      subtaskId,
      actorId: org.userId,
      title,
      ...extra,
    }),
  );
}

/**
 * Recalculate the parent task's progress from its subtasks and persist it.
 * - No ACTIVE subtasks ⇒ engine returns null ⇒ manual progress preserved.
 * - progress_overridden ⇒ auto-recalc paused (the override is authoritative
 *   until cleared) — still audited via the override event that set it.
 */
async function recalculateParentProgress(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  task: TaskRow,
): Promise<void> {
  if (task.progress_overridden) return;
  const subtasks = await loadActiveSubtasks(supabase, org, projectId, task.id);
  const result = computeParentProgress(subtasks, task.subtask_progress_mode ?? "auto");
  if (!result) return; // no active subtasks → preserve manual behavior
  if (result.progress === task.progress) return;

  const { error } = await supabase
    .from("roadmap_tasks")
    .update({ progress: result.progress })
    .eq("id", task.id)
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (error) {
    console.error("[subtasks] parent progress update failed:", error.message);
    return;
  }
  emit(org, projectId, task.id, null, "ParentTaskProgressRecalculated", task.title, {
    oldValue: task.progress,
    newValue: result.progress,
    metadata: { mode_used: result.modeUsed, active_subtasks: result.activeCount, completed_subtasks: result.completedCount },
  });
}

function revalidate(): void {
  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createSubtaskAction(
  input: unknown,
): Promise<{ error?: string; subtaskId?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = createSubtaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  const supabase = createAdminClient();
  const task = await loadTask(supabase, org, data.projectId, data.taskId);
  if (!task) return { error: "task_not_found" };
  const denied = authorize(org, "create", null, task.assigned_to);
  if (denied) return { error: denied };

  const { data: maxRow } = await supabase
    .from("task_subtasks")
    .select("sort_order")
    .eq("task_id", data.taskId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("task_subtasks")
    .insert({
      task_id: data.taskId,
      project_id: data.projectId,
      organization_id: org.organizationId,
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      owner_id: data.owner_id ?? null,
      start_date: data.start_date || null,
      due_date: data.due_date || null,
      estimated_hours: data.estimated_hours ?? null,
      weight: data.weight ?? null,
      is_critical: data.is_critical,
      sort_order: sortOrder,
      created_by: org.userId,
      updated_by: org.userId,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[subtasks] create failed:", error?.message);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "task_subtasks",
    entityId: inserted.id,
    metadata: { title: data.title, task_id: data.taskId, status: data.status },
  });
  emit(org, data.projectId, data.taskId, inserted.id, "SubtaskCreated", data.title, {
    newValue: data.status,
  });
  await recalculateParentProgress(supabase, org, data.projectId, task);
  revalidate();
  return { subtaskId: inserted.id };
}

// ── Update (general edit; preserve-on-absent — only sent fields change) ───────

export async function updateSubtaskAction(input: unknown): Promise<{ error?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = updateSubtaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  const supabase = createAdminClient();
  const subtask = await loadSubtask(supabase, org, data.projectId, data.subtaskId);
  if (!subtask) return { error: "subtask_not_found" };
  const task = await loadTask(supabase, org, data.projectId, subtask.task_id);
  if (!task) return { error: "task_not_found" };
  const denied = authorize(org, "update", subtask.owner_id, task.assigned_to);
  if (denied) return { error: denied };

  // Preserve-on-absent (UX-014 pattern): write only fields the caller sent.
  const patch: Record<string, unknown> = { updated_by: org.userId };
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description || null;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.owner_id !== undefined) patch.owner_id = data.owner_id;
  if (data.start_date !== undefined) patch.start_date = data.start_date || null;
  if (data.due_date !== undefined) patch.due_date = data.due_date || null;
  if (data.estimated_hours !== undefined) patch.estimated_hours = data.estimated_hours;
  if (data.actual_hours !== undefined) patch.actual_hours = data.actual_hours;
  if (data.weight !== undefined) patch.weight = data.weight;
  if (data.progress !== undefined) patch.progress = data.progress;
  if (data.is_critical !== undefined) patch.is_critical = data.is_critical;
  if (data.status !== undefined) {
    patch.status = data.status;
    if (data.status === "completed") patch.completed_at = new Date().toISOString();
    if (subtask.status === "completed" && data.status !== "completed") patch.completed_at = null;
    if (data.status !== "blocked" && subtask.status === "blocked") {
      patch.blocked_reason = null;
      patch.blocked_at = null;
    }
  }

  const { error } = await supabase
    .from("task_subtasks")
    .update(patch)
    .eq("id", data.subtaskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);
  if (error) {
    console.error("[subtasks] update failed:", error.message);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "task_subtasks",
    entityId: data.subtaskId,
    metadata: { task_id: subtask.task_id, fields: Object.keys(patch) },
  });

  // Specific canonical events over generic ones where the change is meaningful.
  if (data.status !== undefined && data.status !== subtask.status) {
    const map: Partial<Record<string, SubtaskEventType>> = {
      in_progress: "SubtaskStarted",
      completed: "SubtaskCompleted",
    };
    const specific = map[data.status];
    emit(org, data.projectId, subtask.task_id, subtask.id, specific ?? "SubtaskUpdated", subtask.title, {
      oldValue: subtask.status,
      newValue: data.status,
    });
  } else {
    emit(org, data.projectId, subtask.task_id, subtask.id, "SubtaskUpdated", subtask.title, {});
  }
  if (data.progress !== undefined && data.progress !== subtask.progress) {
    emit(org, data.projectId, subtask.task_id, subtask.id, "SubtaskProgressChanged", subtask.title, {
      oldValue: subtask.progress,
      newValue: data.progress,
    });
  }
  if (data.due_date !== undefined && (data.due_date || null) !== subtask.due_date) {
    emit(org, data.projectId, subtask.task_id, subtask.id, "SubtaskDueDateChanged", subtask.title, {
      oldValue: subtask.due_date,
      newValue: data.due_date || null,
    });
  }
  if (data.estimated_hours !== undefined && data.estimated_hours !== subtask.estimated_hours) {
    emit(org, data.projectId, subtask.task_id, subtask.id, "SubtaskEstimateChanged", subtask.title, {
      oldValue: subtask.estimated_hours,
      newValue: data.estimated_hours,
    });
  }
  if (data.owner_id !== undefined && data.owner_id !== subtask.owner_id) {
    emit(org, data.projectId, subtask.task_id, subtask.id, "SubtaskReassigned", subtask.title, {
      oldValue: subtask.owner_id,
      newValue: data.owner_id,
    });
  }

  await recalculateParentProgress(supabase, org, data.projectId, task);
  revalidate();
  return {};
}

// ── Complete ──────────────────────────────────────────────────────────────────

export async function completeSubtaskAction(input: {
  projectId: string;
  subtaskId: string;
}): Promise<{ error?: string }> {
  return updateSubtaskAction({ ...input, status: "completed", progress: 100 });
}

// ── Block / Unblock (reason REQUIRED to block) ────────────────────────────────

export async function blockSubtaskAction(input: unknown): Promise<{ error?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = blockSubtaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  const supabase = createAdminClient();
  const subtask = await loadSubtask(supabase, org, data.projectId, data.subtaskId);
  if (!subtask) return { error: "subtask_not_found" };
  const task = await loadTask(supabase, org, data.projectId, subtask.task_id);
  if (!task) return { error: "task_not_found" };
  const denied = authorize(org, "block", subtask.owner_id, task.assigned_to);
  if (denied) return { error: denied };

  const { error } = await supabase
    .from("task_subtasks")
    .update({
      status: "blocked",
      blocked_reason: data.reason,
      blocked_at: new Date().toISOString(),
      updated_by: org.userId,
    })
    .eq("id", data.subtaskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);
  if (error) return { error: "unexpected" };

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "task_subtasks",
    entityId: data.subtaskId,
    metadata: { task_id: subtask.task_id, field: "status", newStatus: "blocked", reason: data.reason },
  });
  emit(org, data.projectId, subtask.task_id, subtask.id, "SubtaskBlocked", subtask.title, {
    oldValue: subtask.status,
    newValue: "blocked",
    reason: data.reason,
  });
  await recalculateParentProgress(supabase, org, data.projectId, task);
  revalidate();
  return {};
}

export async function unblockSubtaskAction(input: unknown): Promise<{ error?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = unblockSubtaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  const supabase = createAdminClient();
  const subtask = await loadSubtask(supabase, org, data.projectId, data.subtaskId);
  if (!subtask) return { error: "subtask_not_found" };
  if (subtask.status !== "blocked") return { error: "not_blocked" };
  const task = await loadTask(supabase, org, data.projectId, subtask.task_id);
  if (!task) return { error: "task_not_found" };
  const denied = authorize(org, "unblock", subtask.owner_id, task.assigned_to);
  if (denied) return { error: denied };

  const { error } = await supabase
    .from("task_subtasks")
    .update({
      status: "in_progress",
      blocked_reason: null,
      blocked_at: null,
      updated_by: org.userId,
    })
    .eq("id", data.subtaskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);
  if (error) return { error: "unexpected" };

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "task_subtasks",
    entityId: data.subtaskId,
    metadata: { task_id: subtask.task_id, field: "status", newStatus: "in_progress", previous: "blocked" },
  });
  emit(org, data.projectId, subtask.task_id, subtask.id, "SubtaskUnblocked", subtask.title, {
    oldValue: "blocked",
    newValue: "in_progress",
    reason: data.note ?? null,
  });
  await recalculateParentProgress(supabase, org, data.projectId, task);
  revalidate();
  return {};
}

// ── Reassign ──────────────────────────────────────────────────────────────────

export async function reassignSubtaskAction(input: unknown): Promise<{ error?: string }> {
  const parsed = reassignSubtaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  return updateSubtaskAction({
    projectId: parsed.data.projectId,
    subtaskId: parsed.data.subtaskId,
    owner_id: parsed.data.owner_id,
  });
}

// ── Delete (soft; restricted) ─────────────────────────────────────────────────

export async function deleteSubtaskAction(input: unknown): Promise<{ error?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = deleteSubtaskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  const supabase = createAdminClient();
  const subtask = await loadSubtask(supabase, org, data.projectId, data.subtaskId);
  if (!subtask) return { error: "subtask_not_found" };
  const task = await loadTask(supabase, org, data.projectId, subtask.task_id);
  if (!task) return { error: "task_not_found" };
  const denied = authorize(org, "delete", subtask.owner_id, task.assigned_to);
  if (denied) return { error: denied };

  const { error } = await supabase
    .from("task_subtasks")
    .update({ deleted_at: new Date().toISOString(), updated_by: org.userId })
    .eq("id", data.subtaskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);
  if (error) return { error: "unexpected" };

  await logAudit({
    org,
    projectId: data.projectId,
    action: "delete",
    entityType: "task_subtasks",
    entityId: data.subtaskId,
    metadata: { task_id: subtask.task_id, title: subtask.title },
  });
  emit(org, data.projectId, subtask.task_id, subtask.id, "SubtaskDeleted", subtask.title, {
    oldValue: subtask.status,
  });
  await recalculateParentProgress(supabase, org, data.projectId, task);
  revalidate();
  return {};
}

// ── Parent progress override (restricted; reason required; audited) ──────────

export async function overrideParentProgressAction(input: unknown): Promise<{ error?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = overrideParentProgressSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  const supabase = createAdminClient();
  const task = await loadTask(supabase, org, data.projectId, data.taskId);
  if (!task) return { error: "task_not_found" };
  const denied = authorize(org, "override_parent_progress");
  if (denied) return { error: denied };

  const { error } = await supabase
    .from("roadmap_tasks")
    .update({
      progress: data.progress,
      progress_overridden: true,
      progress_override_reason: data.reason,
    })
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);
  if (error) return { error: "unexpected" };

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "roadmap_tasks",
    entityId: data.taskId,
    metadata: { field: "progress_override", from: task.progress, to: data.progress, reason: data.reason },
  });
  emit(org, data.projectId, data.taskId, null, "ParentTaskProgressOverride", task.title, {
    oldValue: task.progress,
    newValue: data.progress,
    reason: data.reason,
  });
  revalidate();
  return {};
}

/** Clear a manual override and return to calculated progress (restricted). */
export async function clearParentProgressOverrideAction(input: {
  projectId: string;
  taskId: string;
}): Promise<{ error?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const supabase = createAdminClient();
  const task = await loadTask(supabase, org, input.projectId, input.taskId);
  if (!task) return { error: "task_not_found" };
  const denied = authorize(org, "override_parent_progress");
  if (denied) return { error: denied };

  const { error } = await supabase
    .from("roadmap_tasks")
    .update({ progress_overridden: false, progress_override_reason: null })
    .eq("id", input.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", input.projectId)
    .is("deleted_at", null);
  if (error) return { error: "unexpected" };

  await logAudit({
    org,
    projectId: input.projectId,
    action: "update",
    entityType: "roadmap_tasks",
    entityId: input.taskId,
    metadata: { field: "progress_override", cleared: true },
  });
  await recalculateParentProgress(supabase, org, input.projectId, { ...task, progress_overridden: false });
  revalidate();
  return {};
}

// ── Close parent with incomplete subtasks (restricted; reason required) ───────

export async function closeParentTaskWithIncompleteAction(
  input: unknown,
): Promise<{ error?: string }> {
  let org: OrgContext;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = closeParentWithIncompleteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "validation_error" };
  const data = parsed.data;

  const supabase = createAdminClient();
  const task = await loadTask(supabase, org, data.projectId, data.taskId);
  if (!task) return { error: "task_not_found" };

  const subtasks = await loadActiveSubtasks(supabase, org, data.projectId, data.taskId);
  const gate = evaluateParentCloseGate(subtasks);
  if (!gate.allowed) {
    const denied = authorize(org, "close_parent_with_incomplete");
    if (denied) return { error: denied };
  }

  const { data: updatedTask, error } = await supabase
    .from("roadmap_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null)
    .select(TASK_CAPTURE_SELECT)
    .single();
  if (error || !updatedTask) return { error: "unexpected" };

  await logAudit({
    org,
    projectId: data.projectId,
    action: "task_completed",
    entityType: "roadmap_tasks",
    entityId: data.taskId,
    metadata: {
      closed_with_incomplete_subtasks: !gate.allowed,
      incomplete_count: gate.incompleteCount,
      reason: data.reason,
    },
  });
  const completedEvent = buildTaskStatusTransitionEvent({
    task: taskCaptureSnapshotFromRow(updatedTask, org.organizationId, data.projectId),
    fromStatus: task.status,
    toStatus: updatedTask.status,
    source: {
      actorType: "human",
      actorId: org.userId,
      sourceModule: "subtasks",
      captureMethod: "direct",
      provenance: {
        closed_with_incomplete_subtasks: !gate.allowed,
        incomplete_subtask_count: gate.incompleteCount,
      },
    },
    note: data.reason,
  });
  if (completedEvent) await captureProcessMiningEvents([completedEvent]);
  revalidate();
  return {};
}
