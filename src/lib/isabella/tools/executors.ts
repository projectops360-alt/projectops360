// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · tool executors (server-only)
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// Each executor WRAPS an already-approved ProjectOps360° server layer — it never
// queries the DB directly and never duplicates filter/sort/RBAC logic:
//   query_tasks / query_project_data → executeDeterministicProjectDataRequest
//                                       (Generic Query Engine, Task 1B)
//   get_project_summary              → buildIsabellaProcessContext (Task 2)
// Results are sanitized + truncated. Read-only. Never throws to the loop.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import { executeDeterministicProjectDataRequest } from "@/lib/isabella/process-context/query-executor";
import { buildIsabellaProcessContext } from "@/lib/isabella/process-context/context-builder";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import type { IsabellaProjectQueryPlan, QueryFilter, QuerySort } from "@/lib/isabella/query-engine/query-plan";
import { ENTITY_CATALOG } from "@/lib/isabella/query-engine/catalog";
import { sanitizeGroups, sanitizeTaskRows, toolFailure, type ToolResult } from "./serializers";
import {
  TOOL_LIMIT_DEFAULT_GENERIC,
  TOOL_LIMIT_DEFAULT_TASKS,
  TOOL_LIMIT_MAX,
  type GetProjectSummaryArgs,
  type QueryProjectDataArgs,
  type QueryTasksArgs,
} from "./schemas";

function lang(scope: IsabellaProjectScope): "en" | "es" {
  return scope.locale === "es" ? "es" : "en";
}
function clampLimit(n: number | undefined, dflt: number): number {
  if (!n || n <= 0) return dflt;
  return Math.min(n, TOOL_LIMIT_MAX);
}

function basePlan(scope: IsabellaProjectScope, limit: number): IsabellaProjectQueryPlan {
  return {
    intent: "deterministic_project_report",
    entity: "task",
    selectedFields: [...ENTITY_CATALOG.task.defaultFields],
    filters: [],
    sort: [...ENTITY_CATALOG.task.defaultSort],
    groupBy: null,
    aggregation: "list",
    limit,
    language: lang(scope),
    requiresClarification: false,
    clarificationQuestion: null,
  };
}

function mapReason(reason: string): ToolResult["status"] {
  switch (reason) {
    case "no_project":
    case "not_authorized":
      return "unauthorized";
    case "invalid_plan":
      return "invalid_args";
    case "unsupported_entity":
      return "unsupported_entity";
    default:
      return "unavailable";
  }
}

async function runPlan(org: OrgContext, scope: IsabellaProjectScope, plan: IsabellaProjectQueryPlan, limit: number): Promise<ToolResult> {
  const res = await executeDeterministicProjectDataRequest(org, scope, plan);
  if (!res.ok) return toolFailure(mapReason(res.reason), res.reason, plan.entity);

  const { rows, truncated } = sanitizeTaskRows(res.view.rows, limit);
  const appliedFilters: Record<string, unknown> = {};
  for (const f of plan.filters) appliedFilters[f.field] = f.value === undefined ? f.operator : { op: f.operator, value: f.value };

  return {
    status: res.view.total === 0 ? "empty" : "success",
    entity: plan.entity,
    rows,
    rowCount: res.view.total,
    truncated: truncated || res.view.truncated,
    appliedFilters,
    appliedSort: plan.sort.map((s) => ({ field: s.field, direction: s.direction })),
    grouping: plan.groupBy && res.view.groups ? sanitizeGroups(plan.groupBy, res.view.groups) : null,
    evidenceRefs: res.packets.map((p) => p.citationRef ?? p.evidenceId).filter(Boolean) as string[],
    citations: res.citations.slice(0, 50).map((c) => ({ label: c.sourceLabel, entityType: c.entityType, title: c.entityTitle, ref: c.safeRef ?? null })),
  };
}

// ── query_tasks ──────────────────────────────────────────────────────────────

const ORDER_FIELD_MAP: Record<string, string> = {
  due_date: "dueDate", priority: "priority", status: "status", title: "title", created_at: "createdAt", updated_at: "updatedAt",
};

export async function executeQueryTasks(org: OrgContext, scope: IsabellaProjectScope, args: QueryTasksArgs): Promise<ToolResult> {
  const limit = clampLimit(args.limit, TOOL_LIMIT_DEFAULT_TASKS);
  const plan = basePlan(scope, limit);
  const filters: QueryFilter[] = [];

  if (args.has_milestone === true) filters.push({ field: "milestone", operator: "is_not_null" });
  if (args.has_milestone === false) filters.push({ field: "milestone", operator: "is_null" });
  if (args.without_owner) filters.push({ field: "owner", operator: "is_null" });
  if (args.without_due_date) filters.push({ field: "dueDate", operator: "is_null" });
  if (args.overdue) filters.push({ field: "dueDate", operator: "before", value: "today" });
  if (args.blocked === true) filters.push({ field: "blocked", operator: "equals", value: true });
  if (args.blocked === false) filters.push({ field: "blocked", operator: "equals", value: false });
  if (args.status && args.status.length) filters.push({ field: "status", operator: "in", value: args.status });
  if (args.priority && args.priority.length) filters.push({ field: "priority", operator: "in", value: args.priority });
  const ownerName = args.owner ?? args.assigned_to;
  if (ownerName) filters.push({ field: "owner", operator: "contains", value: ownerName });
  if (args.search) filters.push({ field: "title", operator: "contains", value: args.search });
  if (args.due_before) filters.push({ field: "dueDate", operator: "before", value: args.due_before });
  if (args.due_after) filters.push({ field: "dueDate", operator: "after", value: args.due_after });

  plan.filters = filters;
  if (args.order_by) {
    plan.sort = [{ field: ORDER_FIELD_MAP[args.order_by] ?? "title", direction: args.order_direction ?? "asc" } as QuerySort];
  }

  const result = await runPlan(org, scope, plan, limit);
  if (args.milestone_id) {
    result.limitations = [
      ...(result.limitations ?? []),
      scope.locale === "es" ? "Filtro por milestone_id no soportado aún; usa has_milestone." : "Filtering by milestone_id is not supported yet; use has_milestone.",
    ];
  }
  return result;
}

// ── query_project_data (generic) ─────────────────────────────────────────────

export async function executeQueryProjectData(org: OrgContext, scope: IsabellaProjectScope, args: QueryProjectDataArgs): Promise<ToolResult> {
  if (args.entity !== "task") {
    // Only `task` is wired; others are honestly unsupported (not invented).
    return toolFailure(
      "unsupported_entity",
      scope.locale === "es" ? `La entidad "${args.entity}" aún no está disponible.` : `Entity "${args.entity}" is not available yet.`,
      args.entity,
    );
  }
  const limit = clampLimit(args.limit, TOOL_LIMIT_DEFAULT_GENERIC);
  const plan = basePlan(scope, limit);
  if (args.selected_fields?.length) plan.selectedFields = args.selected_fields;
  if (args.filters?.length) plan.filters = args.filters as QueryFilter[];
  if (args.sort?.length) plan.sort = args.sort as QuerySort[];
  plan.groupBy = args.group_by?.[0] ?? null;
  plan.aggregation = args.aggregation ?? (plan.groupBy ? "grouped_list" : "list");
  return runPlan(org, scope, plan, limit);
}

// ── get_project_summary ──────────────────────────────────────────────────────

const CTX_STATUS_MAP: Record<string, ToolResult["status"]> = {
  ready: "success", partial: "success", empty: "empty",
  unauthorized: "unauthorized", missing_context: "missing_context", unavailable: "unavailable",
};

export async function executeGetProjectSummary(_org: OrgContext, scope: IsabellaProjectScope, _args: GetProjectSummaryArgs): Promise<ToolResult> {
  void _org;
  void _args;
  const ctx = await buildIsabellaProcessContext({
    projectId: scope.projectId,
    locale: lang(scope),
    include: ["project", "tasks", "milestones", "blockers"],
  });
  const status = CTX_STATUS_MAP[ctx.status] ?? "unavailable";
  if (status !== "success" && status !== "empty") {
    return toolFailure(status, ctx.message ?? "unavailable");
  }
  const es = scope.locale === "es";
  const tc = ctx.taskContext;
  const mc = ctx.milestoneContext;
  const parts = [
    ctx.project ? `${es ? "Proyecto" : "Project"}: ${ctx.project.name}` : null,
    tc ? `${tc.totalVisibleTasks} ${es ? "tareas" : "tasks"}` : null,
    tc ? `${es ? "sin hito" : "no milestone"}: ${tc.withoutMilestoneCount}` : null,
    tc ? `${es ? "sin responsable" : "no owner"}: ${tc.withoutOwnerCount}` : null,
    tc?.blockedCount != null ? `${es ? "bloqueadas" : "blocked"}: ${tc.blockedCount}` : null,
    tc?.overdueCount != null ? `${es ? "vencidas" : "overdue"}: ${tc.overdueCount}` : null,
    mc ? `${mc.totalVisibleMilestones} ${es ? "hitos" : "milestones"}` : null,
  ].filter(Boolean);

  return {
    status,
    entity: "project",
    rowCount: tc?.totalVisibleTasks ?? 0,
    truncated: false,
    message: parts.join("; "),
    citations: ctx.citations.slice(0, 20).map((c) => ({ label: c.sourceLabel, entityType: c.entityType, title: c.entityTitle, ref: c.safeRef ?? null })),
    limitations: ctx.limitations,
  };
}
