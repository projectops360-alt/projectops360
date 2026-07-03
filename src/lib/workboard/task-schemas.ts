// ============================================================================
// ProjectOps360° — Task create/update validation schemas (Workboard editor)
// ============================================================================
// Extracted from the roadmap server actions so the persistence rules are
// directly unit-testable ("use server" files can only export async functions).
//
// PRESERVE-ON-ABSENT (UX-014 pattern, generalized to EVERY optional field):
// on UPDATE, a field the caller did not send stays `undefined` and the action
// skips it — the stored value is preserved. An explicit "" clears the field.
// This is why `updateTaskSchema` has NO `.default("")` / `.default(0)` on
// optional fields: a default would turn an absent field into an empty write
// and silently wipe stored content (long prompts, notes, dates, progress).
// CREATE keeps defaults — there is no stored value to preserve.
// ============================================================================

import { z } from "zod";

export const taskStatusValues = [
  "not_started", "prompt_ready", "sent_to_ai", "in_progress",
  "implemented", "tested", "done", "blocked", "deferred",
] as const;
export const taskPriorityValues = ["p1", "p2", "p3"] as const;

export const createTaskSchema = z.object({
  title: z.string().min(1, "titleRequired").max(200, "titleTooLong").transform((s) => s.trim()),
  description: z.string().max(20000, "descriptionTooLong").transform((s) => s.trim()).optional().default(""),
  milestone_id: z.string().uuid("invalid_milestone_id").optional().default(""),
  status: z.enum(taskStatusValues).default("not_started"),
  priority: z.enum(taskPriorityValues).default("p2"),
  sprint_name: z.string().max(100, "sprintTooLong").transform((s) => s.trim()).optional().default(""),
  estimate_hours: z.coerce.number().min(0).max(9999.99).optional().nullable(),
  actual_hours: z.coerce.number().min(0).max(9999.99).optional().nullable(),
  dependency_notes: z.string().max(20000, "dependencyTooLong").transform((s) => s.trim()).optional().default(""),
  acceptance_criteria: z.string().max(20000, "acceptanceTooLong").transform((s) => s.trim()).optional().default(""),
  order_index: z.coerce.number().int().min(0).default(0),
  prompt_body: z.string().max(500000, "promptTooLong").transform((s) => s.trim()).optional().default(""),
  prompt_context: z.string().max(100000, "promptContextTooLong").transform((s) => s.trim()).optional().default(""),
  ai_tool_target: z.string().max(100, "aiToolTooLong").transform((s) => s.trim()).optional().default(""),
  implementation_notes: z.string().max(100000, "implementationNotesTooLong").transform((s) => s.trim()).optional().default(""),
  test_notes: z.string().max(100000, "testNotesTooLong").transform((s) => s.trim()).optional().default(""),
  execution_notes: z.string().max(100000, "executionNotesTooLong").transform((s) => s.trim()).optional().default(""),
  blocker_reason: z.string().max(2000, "blockerReasonTooLong").transform((s) => s.trim()).optional().default(""),
  start_date: z.string().optional().default(""),
  end_date: z.string().optional().default(""),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  assigned_to: z.string().uuid("invalid_assignee").nullable().optional(),
  assigned_resource_id: z.string().uuid("invalid_assignee_resource").nullable().optional(),
  project_team_member_id: z.string().uuid("invalid_team_member").nullable().optional(),
  predecessor_ids: z.array(z.string().uuid()).max(50).optional().default([]),
  material_ids: z.array(z.string().uuid()).max(200).optional().default([]),
  new_materials: z.array(z.string().min(1).max(200).transform((s) => s.trim())).max(50).optional().default([]),
  projectId: z.string().uuid("invalid_project_id"),
});

export const updateTaskSchema = z.object({
  taskId: z.string().uuid("invalid_task_id"),
  title: z.string().min(1, "titleRequired").max(200, "titleTooLong").transform((s) => s.trim()),
  // Preserve-on-absent: NO `.default("")` on any optional field below — absent
  // stays `undefined` so the update action skips the column entirely.
  description: z.string().max(20000, "descriptionTooLong").transform((s) => s.trim()).optional(),
  milestone_id: z.string().uuid("invalid_milestone_id").optional().nullable(),
  status: z.enum(taskStatusValues),
  priority: z.enum(taskPriorityValues),
  sprint_name: z.string().max(100, "sprintTooLong").transform((s) => s.trim()).optional(),
  estimate_hours: z.coerce.number().min(0).max(9999.99).optional().nullable(),
  actual_hours: z.coerce.number().min(0).max(9999.99).optional().nullable(),
  dependency_notes: z.string().max(20000, "dependencyTooLong").transform((s) => s.trim()).optional(),
  acceptance_criteria: z.string().max(20000, "acceptanceTooLong").transform((s) => s.trim()).optional(),
  order_index: z.coerce.number().int().min(0).optional(),
  // UX-014 — internal AI metadata. NO `.default("")`: when the form omits these
  // (it does for non-AI project types), they stay `undefined` so the update
  // PRESERVES the stored value instead of wiping it (preserve-on-absent).
  prompt_body: z.string().max(500000, "promptTooLong").transform((s) => s.trim()).optional(),
  prompt_context: z.string().max(100000, "promptContextTooLong").transform((s) => s.trim()).optional(),
  ai_tool_target: z.string().max(100, "aiToolTooLong").transform((s) => s.trim()).optional(),
  implementation_notes: z.string().max(100000, "implementationNotesTooLong").transform((s) => s.trim()).optional(),
  test_notes: z.string().max(100000, "testNotesTooLong").transform((s) => s.trim()).optional(),
  execution_notes: z.string().max(100000, "executionNotesTooLong").transform((s) => s.trim()).optional(),
  blocker_reason: z.string().max(2000, "blockerReasonTooLong").transform((s) => s.trim()).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  assigned_to: z.string().uuid("invalid_assignee").nullable().optional(),
  assigned_resource_id: z.string().uuid("invalid_assignee_resource").nullable().optional(),
  project_team_member_id: z.string().uuid("invalid_team_member").nullable().optional(),
  predecessor_ids: z.array(z.string().uuid()).max(50).optional(),
  material_ids: z.array(z.string().uuid()).max(200).optional(),
  new_materials: z.array(z.string().min(1).max(200).transform((s) => s.trim())).max(50).optional(),
  projectId: z.string().uuid("invalid_project_id"),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Build the roadmap_tasks column patch for an update. PURE and preserve-on-
 * absent for every optional field: only columns the caller explicitly sent are
 * written; `""` clears (→ null), `undefined` preserves the stored value.
 * Assignment/order columns are handled separately by the action (they need
 * DB resolution).
 */
export function buildTaskUpdatePatch(data: UpdateTaskInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    title: data.title,
    status: data.status,
    priority: data.priority,
  };
  if (data.description !== undefined) patch.description = data.description || null;
  if (data.milestone_id !== undefined) patch.milestone_id = data.milestone_id ?? null;
  if (data.sprint_name !== undefined) patch.sprint_name = data.sprint_name || null;
  if (data.estimate_hours !== undefined) patch.estimate_hours = data.estimate_hours;
  if (data.actual_hours !== undefined) patch.actual_hours = data.actual_hours;
  if (data.dependency_notes !== undefined) patch.dependency_notes = data.dependency_notes || null;
  if (data.acceptance_criteria !== undefined) patch.acceptance_criteria = data.acceptance_criteria || null;
  if (data.prompt_body !== undefined) patch.prompt_body = data.prompt_body || null;
  if (data.prompt_context !== undefined) patch.prompt_context = data.prompt_context || null;
  if (data.ai_tool_target !== undefined) patch.ai_tool_target = data.ai_tool_target || null;
  if (data.implementation_notes !== undefined) patch.implementation_notes = data.implementation_notes || null;
  if (data.test_notes !== undefined) patch.test_notes = data.test_notes || null;
  if (data.execution_notes !== undefined) patch.execution_notes = data.execution_notes || null;
  if (data.blocker_reason !== undefined) patch.blocker_reason = data.blocker_reason || null;
  if (data.start_date !== undefined) patch.start_date = data.start_date || null;
  if (data.end_date !== undefined) patch.end_date = data.end_date || null;
  if (data.progress !== undefined) patch.progress = data.progress;
  if (data.order_index !== undefined) patch.order_index = data.order_index;
  return patch;
}
