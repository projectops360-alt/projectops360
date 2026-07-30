"use server";

// ============================================================================
// ProjectOps360° — Time Tracking Engine · Server actions
// ============================================================================
// Every mutation: trusted session (getOrgContext) → zod validation → duration
// resolution (pure) → RBAC (deny-by-default) → org/project-scoped write via the
// admin client → derived actual_hours cache refresh → audit log → canonical
// Project Event Graph event → effort-budget alert on the crossing → revalidate.
//
// Actual hours are NEVER written by a user. They are SUM(duration_hours) over
// the entries, recomputed after every change (SUBTASK-ACTUAL-HOURS-DERIVED).
//
// Time is anchored to a TASK always, and to a subtask when the work was
// decomposed. Both levels share this one table, so a task's actual hours are a
// single SUM over its task_id — direct entries and subtask entries together,
// each counted exactly once. Nothing here ever adds "task hours + subtask
// hours"; that sum is where double counting would come from.
// ============================================================================

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, type OrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { emitProjectEventSafe } from "@/lib/events/ingestion";
import { authorizeTimeEntryAction, type TimeEntryAction } from "./permissions";
import {
  resolveCrewEntry,
  crossedEffortBudget,
  computeEffort,
  consolidatedEstimatedHours,
  TASK_THRESHOLDS,
} from "./effort";
import {
  logTimeEntrySchema,
  updateTimeEntrySchema,
  deleteTimeEntrySchema,
  listTimeEntriesSchema,
  type LogTimeEntryInput,
  type UpdateTimeEntryInput,
  type DeleteTimeEntryInput,
  type ListTimeEntriesInput,
} from "./schemas";
import {
  listSubtaskTimeEntries,
  listTaskTimeEntries,
  getSubtaskActualHours,
  getTaskActualHours,
  getTaskEffortSummary,
  refreshSubtaskActualHours,
  refreshTaskActualHours,
  resolveUserNames,
} from "./service";
import type { EffortSummary, TimeEntry, TimeEntryView } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

export interface TimeEntryResult {
  error?: string;
  entryId?: string;
  /** Refreshed total for the work item the caller was looking at. */
  actualHours?: number;
  /** Refreshed CONSOLIDATED total for the parent task (own + all subtasks). */
  taskActualHours?: number;
}

export interface ListTimeEntriesResult {
  error?: string;
  entries?: TimeEntryView[];
  actualHours?: number;
}

/**
 * One work item that time can be logged against — a subtask, or a task itself.
 * Unifying them is what lets one set of actions, one dialog and one panel serve
 * both levels instead of a parallel implementation per level.
 */
interface WorkItemContext {
  taskId: string;
  /** Null = the time belongs to the task itself. */
  subtaskId: string | null;
  /** Who is responsible for THIS item: subtask owner, else the task assignee. */
  ownerId: string | null;
  taskAssignedTo: string | null;
  /** Label of the item the time is on (used in events and the overrun note). */
  title: string;
  taskTitle: string;
  /** The estimate the budget alert for this item is measured against. */
  estimatedHours: number | null;
}

async function loadSubtaskContext(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  subtaskId: string,
): Promise<WorkItemContext | null> {
  const { data: subtask } = await supabase
    .from("task_subtasks")
    .select("id, task_id, owner_id, title, estimated_hours")
    .eq("id", subtaskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!subtask) return null;

  const s = subtask as {
    id: string;
    task_id: string;
    owner_id: string | null;
    title: string;
    estimated_hours: number | null;
  };

  const { data: task } = await supabase
    .from("roadmap_tasks")
    .select("assigned_to, title")
    .eq("id", s.task_id)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    taskId: s.task_id,
    subtaskId: s.id,
    ownerId: s.owner_id,
    taskAssignedTo: (task as { assigned_to: string | null } | null)?.assigned_to ?? null,
    title: s.title,
    taskTitle: (task as { title: string } | null)?.title ?? "",
    estimatedHours: s.estimated_hours == null ? null : Number(s.estimated_hours),
  };
}

/**
 * Context for logging against the TASK itself. The estimate is the consolidated
 * one (subtasks when they exist, the task's own number otherwise) so the budget
 * alert measures against the same plan the dashboard and report show.
 */
async function loadTaskContext(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
): Promise<WorkItemContext | null> {
  const [{ data: task }, { data: subtasks }] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select("id, assigned_to, title, estimated_labor_hours, estimate_hours")
      .eq("id", taskId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("task_subtasks")
      .select("estimated_hours, status")
      .eq("task_id", taskId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
  ]);
  if (!task) return null;

  const t = task as {
    id: string;
    assigned_to: string | null;
    title: string;
    estimated_labor_hours: number | null;
    estimate_hours: number | null;
  };
  const active = ((subtasks ?? []) as { estimated_hours: number | null; status: string }[]).filter(
    (s) => s.status !== "cancelled",
  );

  return {
    taskId: t.id,
    subtaskId: null,
    ownerId: t.assigned_to,
    taskAssignedTo: t.assigned_to,
    title: t.title,
    taskTitle: t.title,
    estimatedHours: consolidatedEstimatedHours(
      t.estimated_labor_hours ?? t.estimate_hours ?? null,
      active.map((s) => s.estimated_hours),
    ),
  };
}

/** Resolve whichever level the caller addressed, validating it belongs together. */
async function loadWorkItem(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  taskId: string,
  subtaskId: string | null | undefined,
): Promise<WorkItemContext | null> {
  if (!subtaskId) return loadTaskContext(supabase, org, projectId, taskId);
  const ctx = await loadSubtaskContext(supabase, org, projectId, subtaskId);
  // A subtask must belong to the task it was submitted under, in the same
  // project and org — enforced here as well as by the schema's own scoping, so
  // a mismatched pair can never produce an entry filed under the wrong task.
  if (!ctx || ctx.taskId !== taskId) return null;
  return ctx;
}

/** Current total for the scope the caller is looking at. */
function scopedActualHours(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  ctx: WorkItemContext,
): Promise<number> {
  return ctx.subtaskId
    ? getSubtaskActualHours(supabase, org, projectId, ctx.subtaskId)
    : getTaskActualHours(supabase, org, projectId, ctx.taskId);
}

/**
 * Refresh both derived caches after any change.
 *
 * The task cache is refreshed even for subtask-level entries — that rollup is
 * the whole reason logged time now reaches the task, the report and the PM
 * dashboard instead of stopping at the subtask.
 */
async function refreshCaches(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  ctx: WorkItemContext,
): Promise<{ actualHours: number; taskActualHours: number }> {
  const subtaskTotal = ctx.subtaskId
    ? await refreshSubtaskActualHours(supabase, org, projectId, ctx.subtaskId)
    : null;
  const taskActualHours = await refreshTaskActualHours(supabase, org, projectId, ctx.taskId);
  return { actualHours: subtaskTotal ?? taskActualHours, taskActualHours };
}

function authorize(
  org: OrgContext,
  action: TimeEntryAction,
  ctx: {
    subtaskOwnerId?: string | null;
    taskAssignedTo?: string | null;
    entryCreatedBy?: string | null;
    entryUserId?: string | null;
    targetUserId?: string | null;
  },
): string | null {
  const decision = authorizeTimeEntryAction({ role: org.role, userId: org.userId, action, ...ctx });
  return decision.allowed ? null : "forbidden";
}

function revalidate(): void {
  revalidatePath("/[locale]/(app)/projects/[projectId]", "layout");
}

function emit(
  org: OrgContext,
  projectId: string,
  eventType: "TimeLogged" | "TimeEntryUpdated" | "TimeEntryDeleted" | "EffortBudgetExceeded",
  ctx: Pick<WorkItemContext, "taskId" | "subtaskId">,
  payload: Record<string, unknown>,
): void {
  // The subject is the item the time was logged on: the subtask when there is
  // one, the task itself otherwise.
  const subjectId = ctx.subtaskId ?? ctx.taskId;
  emitProjectEventSafe({
    organizationId: org.organizationId,
    projectId,
    eventType,
    subjectId,
    actorType: "human",
    actorId: org.userId,
    sourceModule: "time_tracking",
    sourceEntityType: ctx.subtaskId ? "task_subtasks" : "roadmap_tasks",
    sourceEntityId: subjectId,
    payload,
  });
}

/**
 * Record the overrun where Isabella and the PM will actually meet it: a project
 * memory item. Best-effort — a failed note must never fail the time entry.
 */
async function recordEffortOverrun(
  org: OrgContext,
  projectId: string,
  ctx: WorkItemContext,
  actualHours: number,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const effort = computeEffort(ctx.estimatedHours, actualHours);
    const over = effort.varianceHours ?? 0;
    const what = ctx.subtaskId
      ? `Subtask "${ctx.title}" (task "${ctx.taskTitle}")`
      : `Task "${ctx.title}"`;
    await supabase.from("project_memory_items").insert({
      organization_id: org.organizationId,
      project_id: projectId,
      title: `Effort exceeded: ${ctx.title}`,
      content:
        `${what} has passed its planned effort. ` +
        `Estimated ${ctx.estimatedHours}h, logged ${actualHours}h — ${over > 0 ? `+${over}` : over}h over ` +
        `(${effort.consumedPct}% of budget). Recorded automatically by the Time Tracking Engine when the ` +
        `total crossed the estimate.`,
      author_name: org.displayName ?? null,
      visibility: "project",
      ai_status: "skipped",
      index_status: "pending",
      importance_level: effort.severity === "critical" ? "high" : "medium",
      source_type: "system_event",
      source_system: "time_tracking",
      tags: ["effort_overrun", "time_tracking"],
      created_by: org.userId,
    });
  } catch {
    /* best-effort: the alert must never block the effort record */
  }
}

/** Fire the budget alert (event + memory) exactly once, on the crossing. */
async function alertIfBudgetCrossed(
  org: OrgContext,
  projectId: string,
  ctx: WorkItemContext,
  previousActual: number,
  newActual: number,
): Promise<void> {
  if (!crossedEffortBudget(ctx.estimatedHours, previousActual, newActual)) return;
  emit(org, projectId, "EffortBudgetExceeded", ctx, {
    task_id: ctx.taskId,
    subtask_id: ctx.subtaskId,
    estimated_hours: ctx.estimatedHours,
    actual_hours: newActual,
    title: ctx.title,
  });
  await recordEffortOverrun(org, projectId, ctx, newActual);
}

// ── Log ───────────────────────────────────────────────────────────────────────

export async function logTimeEntryAction(input: LogTimeEntryInput): Promise<TimeEntryResult> {
  const parsed = logTimeEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const data = parsed.data;

  // The stored total is DERIVED (hours per person × crew), never taken from the
  // client: a caller must not be able to file 200 man-hours as one person's day.
  const duration = resolveCrewEntry({
    startTime: data.startTime,
    endTime: data.endTime,
    hoursPerPerson: data.durationHours,
    crewSize: data.crewSize,
  });
  if (!duration.ok || duration.totalHours === null) return { error: duration.error ?? "invalid_duration" };

  const org = await getOrgContext();
  const supabase = createAdminClient();
  const ctx = await loadWorkItem(supabase, org, data.projectId, data.taskId, data.subtaskId);
  if (!ctx) return { error: data.subtaskId ? "subtask_not_found" : "task_not_found" };

  const targetUserId = data.userId ?? org.userId;
  const denied = authorize(org, "log", {
    subtaskOwnerId: ctx.ownerId,
    taskAssignedTo: ctx.taskAssignedTo,
    targetUserId,
  });
  if (denied) return { error: denied };

  const previousActual = await scopedActualHours(supabase, org, data.projectId, ctx);

  const hasInterval = !!data.startTime && !!data.endTime;
  const { data: inserted, error } = await supabase
    .from("subtask_time_entries")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      task_id: ctx.taskId,
      subtask_id: ctx.subtaskId,
      user_id: targetUserId,
      work_date: data.workDate,
      start_time: hasInterval ? data.startTime : null,
      end_time: hasInterval ? data.endTime : null,
      duration_hours: duration.totalHours,
      crew_size: duration.crewSize,
      hours_per_person: duration.hoursPerPerson,
      comment: data.comment?.trim() || null,
      source: "manual",
      created_by: org.userId,
      updated_by: org.userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) return { error: error?.message ?? "insert_failed" };

  const entryId = (inserted as { id: string }).id;
  const { actualHours, taskActualHours } = await refreshCaches(supabase, org, data.projectId, ctx);

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "subtask_time_entries",
    entityId: entryId,
    metadata: {
      subtask_id: ctx.subtaskId,
      task_id: ctx.taskId,
      hours: duration.totalHours,
      hours_per_person: duration.hoursPerPerson,
      crew_size: duration.crewSize,
      work_date: data.workDate,
      for_user: targetUserId,
    },
  });

  emit(org, data.projectId, "TimeLogged", ctx, {
    task_id: ctx.taskId,
    subtask_id: ctx.subtaskId,
    entry_id: entryId,
    duration_hours: duration.totalHours,
    hours_per_person: duration.hoursPerPerson,
    crew_size: duration.crewSize,
    work_date: data.workDate,
    actual_hours: actualHours,
    task_actual_hours: taskActualHours,
    estimated_hours: ctx.estimatedHours,
    title: ctx.title,
  });

  await alertIfBudgetCrossed(org, data.projectId, ctx, previousActual, actualHours);
  revalidate();
  return { entryId, actualHours, taskActualHours };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateTimeEntryAction(input: UpdateTimeEntryInput): Promise<TimeEntryResult> {
  const parsed = updateTimeEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const data = parsed.data;

  const org = await getOrgContext();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("subtask_time_entries")
    .select("id, task_id, subtask_id, user_id, created_by, work_date, start_time, end_time, duration_hours, crew_size, hours_per_person, comment")
    .eq("id", data.entryId)
    .eq("project_id", data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { error: "entry_not_found" };
  const entry = existing as TimeEntry;

  const ctx = await loadWorkItem(supabase, org, data.projectId, entry.task_id, entry.subtask_id);
  if (!ctx) return { error: entry.subtask_id ? "subtask_not_found" : "task_not_found" };

  const denied = authorize(org, "edit", {
    subtaskOwnerId: ctx.ownerId,
    taskAssignedTo: ctx.taskAssignedTo,
    entryCreatedBy: entry.created_by,
    entryUserId: entry.user_id,
  });
  if (denied) return { error: denied };

  // Re-attributing whose effort this is carries the same weight as logging on
  // someone's behalf, so it goes through the same manager-only gate.
  let nextUserId = entry.user_id;
  if (data.userId && data.userId !== entry.user_id) {
    const deniedReassign = authorize(org, "log", {
      subtaskOwnerId: ctx.ownerId,
      taskAssignedTo: ctx.taskAssignedTo,
      targetUserId: data.userId,
    });
    if (deniedReassign) return { error: deniedReassign };
    nextUserId = data.userId;
  }

  // Preserve-on-absent: only what was sent changes. Interval, per-person hours
  // and crew are resolved TOGETHER so the stored trio can never contradict
  // itself — editing the crew alone still recomputes the total.
  const startTime = data.startTime !== undefined ? data.startTime : entry.start_time;
  const endTime = data.endTime !== undefined ? data.endTime : entry.end_time;
  const crewSize = data.crewSize !== undefined && data.crewSize !== null
    ? data.crewSize
    : (entry.crew_size ?? 1);
  // Falls back to hours_per_person, not to duration_hours: on a crew row the
  // total is the crew's, and re-feeding it as one person's hours would multiply
  // the entry by the crew size again on every edit.
  const perPersonFallback = entry.hours_per_person != null
    ? Number(entry.hours_per_person)
    : Number(entry.duration_hours) / (entry.crew_size ?? 1);
  const durationInput =
    data.durationHours !== undefined ? data.durationHours : perPersonFallback;
  const duration = resolveCrewEntry({
    startTime,
    endTime,
    hoursPerPerson: durationInput,
    crewSize,
  });
  if (!duration.ok || duration.totalHours === null) return { error: duration.error ?? "invalid_duration" };

  const hasInterval = !!startTime && !!endTime;
  const previousActual = await scopedActualHours(supabase, org, data.projectId, ctx);

  const { error } = await supabase
    .from("subtask_time_entries")
    .update({
      work_date: data.workDate ?? entry.work_date,
      start_time: hasInterval ? startTime : null,
      end_time: hasInterval ? endTime : null,
      duration_hours: duration.totalHours,
      crew_size: duration.crewSize,
      hours_per_person: duration.hoursPerPerson,
      comment: data.comment !== undefined ? data.comment?.trim() || null : entry.comment,
      user_id: nextUserId,
      updated_by: org.userId,
    })
    .eq("id", data.entryId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);
  if (error) return { error: error.message };

  const { actualHours, taskActualHours } = await refreshCaches(supabase, org, data.projectId, ctx);

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "subtask_time_entries",
    entityId: data.entryId,
    metadata: {
      subtask_id: entry.subtask_id,
      task_id: entry.task_id,
      old_hours: Number(entry.duration_hours),
      new_hours: duration.totalHours,
      crew_size: duration.crewSize,
    },
  });

  emit(org, data.projectId, "TimeEntryUpdated", ctx, {
    task_id: entry.task_id,
    subtask_id: entry.subtask_id,
    entry_id: data.entryId,
    duration_hours: duration.totalHours,
    hours_per_person: duration.hoursPerPerson,
    crew_size: duration.crewSize,
    old_value: Number(entry.duration_hours),
    new_value: duration.totalHours,
    actual_hours: actualHours,
    task_actual_hours: taskActualHours,
    title: ctx.title,
  });

  await alertIfBudgetCrossed(org, data.projectId, ctx, previousActual, actualHours);
  revalidate();
  return { entryId: data.entryId, actualHours, taskActualHours };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteTimeEntryAction(input: DeleteTimeEntryInput): Promise<TimeEntryResult> {
  const parsed = deleteTimeEntrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const data = parsed.data;

  const org = await getOrgContext();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("subtask_time_entries")
    .select("id, task_id, subtask_id, user_id, created_by, duration_hours, work_date")
    .eq("id", data.entryId)
    .eq("project_id", data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { error: "entry_not_found" };
  const entry = existing as TimeEntry;

  const ctx = await loadWorkItem(supabase, org, data.projectId, entry.task_id, entry.subtask_id);
  if (!ctx) return { error: entry.subtask_id ? "subtask_not_found" : "task_not_found" };

  const denied = authorize(org, "delete", { entryCreatedBy: entry.created_by, entryUserId: entry.user_id });
  if (denied) return { error: denied };

  // Soft delete: Actual Cost history stays auditable.
  const { error } = await supabase
    .from("subtask_time_entries")
    .update({ deleted_at: new Date().toISOString(), updated_by: org.userId })
    .eq("id", data.entryId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);
  if (error) return { error: error.message };

  const { actualHours, taskActualHours } = await refreshCaches(supabase, org, data.projectId, ctx);

  await logAudit({
    org,
    projectId: data.projectId,
    action: "delete",
    entityType: "subtask_time_entries",
    entityId: data.entryId,
    metadata: {
      subtask_id: entry.subtask_id,
      task_id: entry.task_id,
      hours: Number(entry.duration_hours),
      work_date: entry.work_date,
    },
  });

  emit(org, data.projectId, "TimeEntryDeleted", ctx, {
    task_id: entry.task_id,
    subtask_id: entry.subtask_id,
    entry_id: data.entryId,
    duration_hours: Number(entry.duration_hours),
    actual_hours: actualHours,
    task_actual_hours: taskActualHours,
  });

  revalidate();
  return { entryId: data.entryId, actualHours, taskActualHours };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function listTimeEntriesAction(input: ListTimeEntriesInput): Promise<ListTimeEntriesResult> {
  const parsed = listTimeEntriesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const data = parsed.data;

  const org = await getOrgContext();
  const supabase = createAdminClient();
  const ctx = await loadWorkItem(supabase, org, data.projectId, data.taskId, data.subtaskId);
  if (!ctx) return { error: data.subtaskId ? "subtask_not_found" : "task_not_found" };

  // Subtask scope → that subtask's log. Task scope → the CONSOLIDATED log, which
  // is the same set of rows the task's actual hours are summed from, so the
  // history a PM reads always adds up to the total shown above it.
  const entries = ctx.subtaskId
    ? await listSubtaskTimeEntries(supabase, org, data.projectId, ctx.subtaskId)
    : await listTaskTimeEntries(supabase, org, data.projectId, ctx.taskId);
  const names = await resolveUserNames(supabase, entries.map((e) => e.user_id));

  const views: TimeEntryView[] = entries.map((entry) => ({
    ...entry,
    user_name: names.get(entry.user_id) || "",
    can_edit: !authorize(org, "edit", {
      subtaskOwnerId: ctx.ownerId,
      taskAssignedTo: ctx.taskAssignedTo,
      entryCreatedBy: entry.created_by,
      entryUserId: entry.user_id,
    }),
    can_delete: !authorize(org, "delete", { entryCreatedBy: entry.created_by, entryUserId: entry.user_id }),
  }));

  return {
    entries: views,
    actualHours: await scopedActualHours(supabase, org, data.projectId, ctx),
  };
}

/**
 * Effort standing for one task, straight from the canonical engine.
 *
 * The client cannot compute this: the consolidated estimate depends on whether
 * the task has subtasks and on their estimates. Reading it here keeps the modal
 * showing the same numbers as the report and the dashboard, by construction.
 */
export async function getTaskEffortAction(
  projectId: string,
  taskId: string,
): Promise<{ error?: string; effort?: EffortSummary }> {
  try {
    const org = await getOrgContext();
    const supabase = createAdminClient();
    const ctx = await loadTaskContext(supabase, org, projectId, taskId);
    if (!ctx) return { error: "task_not_found" };
    return {
      effort: await getTaskEffortSummary(supabase, org, projectId, taskId, TASK_THRESHOLDS),
    };
  } catch {
    return { error: "unexpected" };
  }
}

/**
 * Whether the caller may log time on this work item — drives button visibility.
 * Omit `subtaskId` to ask about the task itself.
 */
export async function canLogTimeAction(
  projectId: string,
  taskId: string,
  subtaskId?: string | null,
): Promise<boolean> {
  try {
    const org = await getOrgContext();
    const supabase = createAdminClient();
    const ctx = await loadWorkItem(supabase, org, projectId, taskId, subtaskId);
    if (!ctx) return false;
    return !authorize(org, "log", {
      subtaskOwnerId: ctx.ownerId,
      taskAssignedTo: ctx.taskAssignedTo,
      targetUserId: org.userId,
    });
  } catch {
    return false;
  }
}

/**
 * Whether the caller may log time in SOMEONE ELSE's name (manager-only), which
 * is what decides if the dialog offers the person picker at all.
 */
export async function canLogTimeForOthersAction(projectId: string, taskId: string): Promise<boolean> {
  try {
    const org = await getOrgContext();
    const supabase = createAdminClient();
    const ctx = await loadWorkItem(supabase, org, projectId, taskId, null);
    if (!ctx) return false;
    // Probing with a target that is deliberately not the caller: only a manager
    // clears this gate, which is exactly the rule the picker must follow.
    return !authorize(org, "log", {
      subtaskOwnerId: ctx.ownerId,
      taskAssignedTo: ctx.taskAssignedTo,
      targetUserId: "00000000-0000-0000-0000-000000000000",
    });
  } catch {
    return false;
  }
}
