// ============================================================================
// ProjectOps360° — Subtasks · Zod schemas (pure, tested)
// ============================================================================

import { z } from "zod";
import { SUBTASK_STATUSES, SUBTASK_PRIORITIES } from "./types";

export const createSubtaskSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  taskId: z.string().uuid("invalid_task_id"),
  title: z.string().min(1, "titleRequired").max(300, "titleTooLong").transform((s) => s.trim()),
  description: z.string().max(20000, "descriptionTooLong").optional(),
  status: z.enum(SUBTASK_STATUSES).default("not_started"),
  priority: z.enum(SUBTASK_PRIORITIES).default("p2"),
  owner_id: z.string().uuid().nullable().optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  estimated_hours: z.coerce.number().min(0).max(9999.99).nullable().optional(),
  weight: z.coerce.number().min(0).max(9999.99).nullable().optional(),
  is_critical: z.boolean().default(false),
});

export const updateSubtaskSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  subtaskId: z.string().uuid("invalid_subtask_id"),
  title: z.string().min(1, "titleRequired").max(300, "titleTooLong").transform((s) => s.trim()).optional(),
  description: z.string().max(20000, "descriptionTooLong").optional(),
  status: z.enum(SUBTASK_STATUSES).optional(),
  priority: z.enum(SUBTASK_PRIORITIES).optional(),
  owner_id: z.string().uuid().nullable().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  estimated_hours: z.coerce.number().min(0).max(9999.99).nullable().optional(),
  actual_hours: z.coerce.number().min(0).max(9999.99).nullable().optional(),
  weight: z.coerce.number().min(0).max(9999.99).nullable().optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  is_critical: z.boolean().optional(),
});

/** Blocking ALWAYS requires a reason (auditable impediment). */
export const blockSubtaskSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  subtaskId: z.string().uuid("invalid_subtask_id"),
  reason: z.string().min(3, "blockReasonRequired").max(2000, "reasonTooLong").transform((s) => s.trim()),
});

export const unblockSubtaskSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  subtaskId: z.string().uuid("invalid_subtask_id"),
  note: z.string().max(2000).optional(),
});

export const reassignSubtaskSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  subtaskId: z.string().uuid("invalid_subtask_id"),
  owner_id: z.string().uuid().nullable(),
});

export const deleteSubtaskSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  subtaskId: z.string().uuid("invalid_subtask_id"),
});

/** Manual parent override ALWAYS requires a reason (audited). */
export const overrideParentProgressSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  taskId: z.string().uuid("invalid_task_id"),
  progress: z.coerce.number().int().min(0).max(100),
  reason: z.string().min(3, "overrideReasonRequired").max(2000, "reasonTooLong").transform((s) => s.trim()),
});

/** Closing a parent with incomplete active subtasks requires reason + authority. */
export const closeParentWithIncompleteSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  taskId: z.string().uuid("invalid_task_id"),
  reason: z.string().min(3, "closeReasonRequired").max(2000, "reasonTooLong").transform((s) => s.trim()),
});
