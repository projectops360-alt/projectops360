// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · static tool registry
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// STATIC allowlist. The LLM may only call a tool that appears here, with args
// validated by its Zod schema. No dynamic tools, no arbitrary tables/fields, no
// SQL. Each tool wraps an approved server layer (see executors.ts).
// ============================================================================

import { z } from "zod";
import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import type { ToolResult } from "./serializers";
import {
  getProjectSummaryArgsSchema,
  queryProjectDataArgsSchema,
  queryTasksArgsSchema,
  TOOL_LIMIT_MAX,
  type GetProjectSummaryArgs,
  type QueryProjectDataArgs,
  type QueryTasksArgs,
} from "./schemas";
import { executeGetProjectSummary, executeQueryProjectData, executeQueryTasks } from "./executors";

export interface IsabellaToolDef {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  maxLimit: number;
  /** Executes with ALREADY-VALIDATED args. Read-only. Never throws to the loop. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (org: OrgContext, scope: IsabellaProjectScope, args: any) => Promise<ToolResult>;
}

export const ISABELLA_TOOLS: Record<string, IsabellaToolDef> = {
  query_tasks: {
    name: "query_tasks",
    description:
      "Read-only report of the current project's tasks with filters (status, priority, has_milestone, overdue, without_owner, blocked, owner/assigned, search, due dates), sorting and a row limit. Use for 'which tasks', 'tasks without milestone', 'overdue tasks', 'tasks assigned to X'.",
    schema: queryTasksArgsSchema,
    maxLimit: TOOL_LIMIT_MAX,
    execute: (org, scope, args) => executeQueryTasks(org, scope, args as QueryTasksArgs),
  },
  query_project_data: {
    name: "query_project_data",
    description:
      "Generic read-only project-data query for the current project: entity (task supported now), catalog fields, generic filters/operators, sort, group_by + aggregation (list/count/grouped_list). Prefer query_tasks for simple task questions.",
    schema: queryProjectDataArgsSchema,
    maxLimit: TOOL_LIMIT_MAX,
    execute: (org, scope, args) => executeQueryProjectData(org, scope, args as QueryProjectDataArgs),
  },
  get_project_summary: {
    name: "get_project_summary",
    description:
      "Compact read-only summary of the current project (task/milestone counts, without-milestone/owner, blocked, overdue). Use for 'give me the project summary'.",
    schema: getProjectSummaryArgsSchema,
    maxLimit: 0,
    execute: (org, scope, args) => executeGetProjectSummary(org, scope, args as GetProjectSummaryArgs),
  },
};

export function getTool(name: string): IsabellaToolDef | null {
  return Object.prototype.hasOwnProperty.call(ISABELLA_TOOLS, name) ? ISABELLA_TOOLS[name] : null;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Tool specs (JSON-schema params) for the model. No executor exposed. */
export function listToolSpecs(): ToolSpec[] {
  return Object.values(ISABELLA_TOOLS).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: z.toJSONSchema(t.schema) as Record<string, unknown>,
  }));
}
