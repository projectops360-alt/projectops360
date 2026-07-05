// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · argument schemas (Zod)
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// Runtime validation for EVERY tool argument. The LLM may only choose approved
// tools and typed args — never raw SQL, never arbitrary tables/fields. Invalid
// args are rejected before any execution. Pure schemas; no DB, no side effects.
// ============================================================================

import { z } from "zod";

export const TOOL_LIMIT_MAX = 200;
export const TOOL_LIMIT_DEFAULT_TASKS = 50;
export const TOOL_LIMIT_DEFAULT_GENERIC = 100;

const orderDirection = z.enum(["asc", "desc"]);

// ── query_tasks ──────────────────────────────────────────────────────────────

export const queryTasksArgsSchema = z
  .object({
    project_id: z.string().uuid().optional(),
    status: z.array(z.string()).max(20).optional(),
    priority: z.array(z.enum(["p1", "p2", "p3"])).max(3).optional(),
    assigned_to: z.string().max(120).optional(),
    owner: z.string().max(120).optional(),
    milestone_id: z.string().uuid().nullable().optional(),
    has_milestone: z.boolean().optional(),
    due_before: z.string().max(40).optional(),
    due_after: z.string().max(40).optional(),
    overdue: z.boolean().optional(),
    search: z.string().max(200).optional(),
    blocked: z.boolean().optional(),
    without_owner: z.boolean().optional(),
    without_due_date: z.boolean().optional(),
    limit: z.number().int().positive().max(TOOL_LIMIT_MAX).optional(),
    order_by: z.enum(["due_date", "priority", "status", "title", "created_at", "updated_at"]).optional(),
    order_direction: orderDirection.optional(),
  })
  .strict();

export type QueryTasksArgs = z.infer<typeof queryTasksArgsSchema>;

// ── query_project_data (generic) ─────────────────────────────────────────────

const filterSchema = z
  .object({
    field: z.string().min(1).max(40),
    operator: z.enum([
      "equals", "not_equals", "is_null", "is_not_null", "contains", "not_contains",
      "in", "not_in", "before", "after", "on_or_before", "on_or_after", "greater_than", "less_than",
    ]),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional(),
  })
  .strict();

export const queryProjectDataArgsSchema = z
  .object({
    entity: z.enum(["task", "subtask", "milestone", "risk", "decision", "approval", "budget", "project"]),
    project_id: z.string().uuid().optional(),
    selected_fields: z.array(z.string().max(40)).max(20).optional(),
    filters: z.array(filterSchema).max(20).optional(),
    sort: z.array(z.object({ field: z.string().max(40), direction: orderDirection }).strict()).max(5).optional(),
    group_by: z.array(z.string().max(40)).max(3).optional(),
    aggregation: z.enum(["list", "count", "grouped_list"]).optional(),
    limit: z.number().int().positive().max(TOOL_LIMIT_MAX).optional(),
  })
  .strict();

export type QueryProjectDataArgs = z.infer<typeof queryProjectDataArgsSchema>;

// ── get_project_summary ──────────────────────────────────────────────────────

export const getProjectSummaryArgsSchema = z
  .object({
    project_id: z.string().uuid().optional(),
  })
  .strict();

export type GetProjectSummaryArgs = z.infer<typeof getProjectSummaryArgsSchema>;

// ── process-intelligence tools (diagnosis / root cause / recommendation) ───────
// Read-only wrappers over the accepted Task 3/4/5 engines. Optional scope narrows
// the analysis to a milestone or task (never coordinates, never a raw id leak).

export const processIntelligenceArgsSchema = z
  .object({
    project_id: z.string().uuid().optional(),
    milestone_id: z.string().uuid().optional(),
    task_id: z.string().uuid().optional(),
  })
  .strict();

export type ProcessIntelligenceArgs = z.infer<typeof processIntelligenceArgsSchema>;
