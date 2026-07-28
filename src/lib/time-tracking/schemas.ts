// ============================================================================
// ProjectOps360° — Time Tracking Engine · Zod schemas
// ============================================================================

import { z } from "zod";

/** HH:MM or HH:MM:SS, matching what <input type="time"> emits. */
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, "invalid_time")
  .transform((s) => s.slice(0, 5));

/** YYYY-MM-DD. */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date");

export const logTimeEntrySchema = z
  .object({
    projectId: z.string().uuid("invalid_project_id"),
    subtaskId: z.string().uuid("invalid_subtask_id"),
    workDate: dateString,
    startTime: timeString.nullable().optional(),
    endTime: timeString.nullable().optional(),
    durationHours: z.coerce.number().positive("invalid_duration").max(24, "exceeds_day").nullable().optional(),
    comment: z.string().max(2000, "comment_too_long").nullable().optional(),
    /** Whose effort this is. Defaults to the caller; only managers may differ. */
    userId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (v) => (!!v.startTime && !!v.endTime) || v.durationHours != null,
    { message: "duration_required", path: ["durationHours"] },
  );

export const updateTimeEntrySchema = z
  .object({
    projectId: z.string().uuid("invalid_project_id"),
    entryId: z.string().uuid("invalid_entry_id"),
    workDate: dateString.optional(),
    startTime: timeString.nullable().optional(),
    endTime: timeString.nullable().optional(),
    durationHours: z.coerce.number().positive("invalid_duration").max(24, "exceeds_day").nullable().optional(),
    comment: z.string().max(2000, "comment_too_long").nullable().optional(),
  });

export const deleteTimeEntrySchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  entryId: z.string().uuid("invalid_entry_id"),
});

export const listTimeEntriesSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  subtaskId: z.string().uuid("invalid_subtask_id"),
});

export type LogTimeEntryInput = z.input<typeof logTimeEntrySchema>;
export type UpdateTimeEntryInput = z.input<typeof updateTimeEntrySchema>;
export type DeleteTimeEntryInput = z.input<typeof deleteTimeEntrySchema>;
export type ListTimeEntriesInput = z.input<typeof listTimeEntriesSchema>;
