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
// ============================================================================

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, type OrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { emitProjectEventSafe } from "@/lib/events/ingestion";
import { authorizeTimeEntryAction, type TimeEntryAction } from "./permissions";
import { resolveEntryDuration, crossedEffortBudget, computeEffort } from "./effort";
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
  getSubtaskActualHours,
  refreshSubtaskActualHours,
  resolveUserNames,
} from "./service";
import type { TimeEntry, TimeEntryView } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

export interface TimeEntryResult {
  error?: string;
  entryId?: string;
  /** Refreshed total for the subtask, so the caller can update without refetch. */
  actualHours?: number;
}

export interface ListTimeEntriesResult {
  error?: string;
  entries?: TimeEntryView[];
  actualHours?: number;
}

interface SubtaskContext {
  id: string;
  task_id: string;
  owner_id: string | null;
  title: string;
  estimated_hours: number | null;
  task_assigned_to: string | null;
  task_title: string;
}

async function loadSubtaskContext(
  supabase: Admin,
  org: OrgContext,
  projectId: string,
  subtaskId: string,
): Promise<SubtaskContext | null> {
  const { data: subtask } = await supabase
    .from("task_subtasks")
    .select("id, task_id, owner_id, title, estimated_hours")
    .eq("id", subtaskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!subtask) return null;

  const { data: task } = await supabase
    .from("roadmap_tasks")
    .select("assigned_to, title")
    .eq("id", (subtask as { task_id: string }).task_id)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const s = subtask as { id: string; task_id: string; owner_id: string | null; title: string; estimated_hours: number | null };
  return {
    ...s,
    estimated_hours: s.estimated_hours == null ? null : Number(s.estimated_hours),
    task_assigned_to: (task as { assigned_to: string | null } | null)?.assigned_to ?? null,
    task_title: (task as { title: string } | null)?.title ?? "",
  };
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
  subtaskId: string,
  payload: Record<string, unknown>,
): void {
  emitProjectEventSafe({
    organizationId: org.organizationId,
    projectId,
    eventType,
    subjectId: subtaskId,
    actorType: "human",
    actorId: org.userId,
    sourceModule: "time_tracking",
    sourceEntityType: "task_subtasks",
    sourceEntityId: subtaskId,
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
  ctx: SubtaskContext,
  actualHours: number,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const effort = computeEffort(ctx.estimated_hours, actualHours);
    const over = effort.varianceHours ?? 0;
    await supabase.from("project_memory_items").insert({
      organization_id: org.organizationId,
      project_id: projectId,
      title: `Effort exceeded: ${ctx.title}`,
      content:
        `Subtask "${ctx.title}" (task "${ctx.task_title}") has passed its planned effort. ` +
        `Estimated ${ctx.estimated_hours}h, logged ${actualHours}h — ${over > 0 ? `+${over}` : over}h over ` +
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
  ctx: SubtaskContext,
  previousActual: number,
  newActual: number,
): Promise<void> {
  if (!crossedEffortBudget(ctx.estimated_hours, previousActual, newActual)) return;
  emit(org, projectId, "EffortBudgetExceeded", ctx.id, {
    task_id: ctx.task_id,
    estimated_hours: ctx.estimated_hours,
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

  const duration = resolveEntryDuration({
    startTime: data.startTime,
    endTime: data.endTime,
    durationHours: data.durationHours,
  });
  if (!duration.ok || duration.hours === null) return { error: duration.error ?? "invalid_duration" };

  const org = await getOrgContext();
  const supabase = createAdminClient();
  const ctx = await loadSubtaskContext(supabase, org, data.projectId, data.subtaskId);
  if (!ctx) return { error: "subtask_not_found" };

  const targetUserId = data.userId ?? org.userId;
  const denied = authorize(org, "log", {
    subtaskOwnerId: ctx.owner_id,
    taskAssignedTo: ctx.task_assigned_to,
    targetUserId,
  });
  if (denied) return { error: denied };

  const previousActual = await getSubtaskActualHours(supabase, org, data.projectId, data.subtaskId);

  const hasInterval = !!data.startTime && !!data.endTime;
  const { data: inserted, error } = await supabase
    .from("subtask_time_entries")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      task_id: ctx.task_id,
      subtask_id: ctx.id,
      user_id: targetUserId,
      work_date: data.workDate,
      start_time: hasInterval ? data.startTime : null,
      end_time: hasInterval ? data.endTime : null,
      duration_hours: duration.hours,
      comment: data.comment?.trim() || null,
      source: "manual",
      created_by: org.userId,
      updated_by: org.userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) return { error: error?.message ?? "insert_failed" };

  const entryId = (inserted as { id: string }).id;
  const actualHours = await refreshSubtaskActualHours(supabase, org, data.projectId, ctx.id);

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "subtask_time_entries",
    entityId: entryId,
    metadata: { subtask_id: ctx.id, task_id: ctx.task_id, hours: duration.hours, work_date: data.workDate, for_user: targetUserId },
  });

  emit(org, data.projectId, "TimeLogged", ctx.id, {
    task_id: ctx.task_id,
    subtask_id: ctx.id,
    entry_id: entryId,
    duration_hours: duration.hours,
    work_date: data.workDate,
    actual_hours: actualHours,
    estimated_hours: ctx.estimated_hours,
    title: ctx.title,
  });

  await alertIfBudgetCrossed(org, data.projectId, ctx, previousActual, actualHours);
  revalidate();
  return { entryId, actualHours };
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
    .select("id, task_id, subtask_id, user_id, created_by, work_date, start_time, end_time, duration_hours, comment")
    .eq("id", data.entryId)
    .eq("project_id", data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { error: "entry_not_found" };
  const entry = existing as TimeEntry;
  if (!entry.subtask_id) return { error: "entry_not_found" };

  const ctx = await loadSubtaskContext(supabase, org, data.projectId, entry.subtask_id);
  if (!ctx) return { error: "subtask_not_found" };

  const denied = authorize(org, "edit", {
    subtaskOwnerId: ctx.owner_id,
    taskAssignedTo: ctx.task_assigned_to,
    entryCreatedBy: entry.created_by,
    entryUserId: entry.user_id,
  });
  if (denied) return { error: denied };

  // Preserve-on-absent: only what was sent changes. Interval and duration are
  // resolved together so the stored pair can never contradict the total.
  const startTime = data.startTime !== undefined ? data.startTime : entry.start_time;
  const endTime = data.endTime !== undefined ? data.endTime : entry.end_time;
  const durationInput =
    data.durationHours !== undefined ? data.durationHours : Number(entry.duration_hours);
  const duration = resolveEntryDuration({ startTime, endTime, durationHours: durationInput });
  if (!duration.ok || duration.hours === null) return { error: duration.error ?? "invalid_duration" };

  const hasInterval = !!startTime && !!endTime;
  const previousActual = await getSubtaskActualHours(supabase, org, data.projectId, entry.subtask_id);

  const { error } = await supabase
    .from("subtask_time_entries")
    .update({
      work_date: data.workDate ?? entry.work_date,
      start_time: hasInterval ? startTime : null,
      end_time: hasInterval ? endTime : null,
      duration_hours: duration.hours,
      comment: data.comment !== undefined ? data.comment?.trim() || null : entry.comment,
      updated_by: org.userId,
    })
    .eq("id", data.entryId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);
  if (error) return { error: error.message };

  const actualHours = await refreshSubtaskActualHours(supabase, org, data.projectId, entry.subtask_id);

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "subtask_time_entries",
    entityId: data.entryId,
    metadata: { subtask_id: entry.subtask_id, old_hours: Number(entry.duration_hours), new_hours: duration.hours },
  });

  emit(org, data.projectId, "TimeEntryUpdated", entry.subtask_id, {
    task_id: entry.task_id,
    subtask_id: entry.subtask_id,
    entry_id: data.entryId,
    duration_hours: duration.hours,
    old_value: Number(entry.duration_hours),
    new_value: duration.hours,
    actual_hours: actualHours,
    title: ctx.title,
  });

  await alertIfBudgetCrossed(org, data.projectId, ctx, previousActual, actualHours);
  revalidate();
  return { entryId: data.entryId, actualHours };
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
  if (!entry.subtask_id) return { error: "entry_not_found" };

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

  const actualHours = await refreshSubtaskActualHours(supabase, org, data.projectId, entry.subtask_id);

  await logAudit({
    org,
    projectId: data.projectId,
    action: "delete",
    entityType: "subtask_time_entries",
    entityId: data.entryId,
    metadata: { subtask_id: entry.subtask_id, hours: Number(entry.duration_hours), work_date: entry.work_date },
  });

  emit(org, data.projectId, "TimeEntryDeleted", entry.subtask_id, {
    task_id: entry.task_id,
    subtask_id: entry.subtask_id,
    entry_id: data.entryId,
    duration_hours: Number(entry.duration_hours),
    actual_hours: actualHours,
  });

  revalidate();
  return { entryId: data.entryId, actualHours };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function listTimeEntriesAction(input: ListTimeEntriesInput): Promise<ListTimeEntriesResult> {
  const parsed = listTimeEntriesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const data = parsed.data;

  const org = await getOrgContext();
  const supabase = createAdminClient();
  const ctx = await loadSubtaskContext(supabase, org, data.projectId, data.subtaskId);
  if (!ctx) return { error: "subtask_not_found" };

  const entries = await listSubtaskTimeEntries(supabase, org, data.projectId, data.subtaskId);
  const names = await resolveUserNames(supabase, entries.map((e) => e.user_id));

  const views: TimeEntryView[] = entries.map((entry) => ({
    ...entry,
    user_name: names.get(entry.user_id) || "",
    can_edit: !authorize(org, "edit", {
      subtaskOwnerId: ctx.owner_id,
      taskAssignedTo: ctx.task_assigned_to,
      entryCreatedBy: entry.created_by,
      entryUserId: entry.user_id,
    }),
    can_delete: !authorize(org, "delete", { entryCreatedBy: entry.created_by, entryUserId: entry.user_id }),
  }));

  return { entries: views, actualHours: await getSubtaskActualHours(supabase, org, data.projectId, data.subtaskId) };
}

/** Whether the caller may log time on this subtask — drives button visibility. */
export async function canLogTimeAction(projectId: string, subtaskId: string): Promise<boolean> {
  try {
    const org = await getOrgContext();
    const supabase = createAdminClient();
    const ctx = await loadSubtaskContext(supabase, org, projectId, subtaskId);
    if (!ctx) return false;
    return !authorize(org, "log", {
      subtaskOwnerId: ctx.owner_id,
      taskAssignedTo: ctx.task_assigned_to,
      targetUserId: org.userId,
    });
  } catch {
    return false;
  }
}
