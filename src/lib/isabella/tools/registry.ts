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
  executiveBriefArgsSchema,
  getProjectSummaryArgsSchema,
  processIntelligenceArgsSchema,
  queryProjectDataArgsSchema,
  queryTasksArgsSchema,
  TOOL_LIMIT_MAX,
  type ExecutiveBriefArgs,
  type GetProjectSummaryArgs,
  type ProcessIntelligenceArgs,
  type QueryProjectDataArgs,
  type QueryTasksArgs,
} from "./schemas";
import { executeGetProjectSummary, executeQueryProjectData, executeQueryTasks } from "./executors";
import { executeGetProjectExecutiveBrief, executeGetProjectRiskOutlook } from "./executive-executors";
import { executeGetDailyDiagnosis, executeGetRecommendationPlan, executeGetRootCauseAnalysis } from "./intelligence-executors";
import { isIsabellaProcessIntelligenceEnabled } from "@/lib/isabella/process-intelligence-runtime/flag";

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
  // ── REG-023 composite, decision-oriented tools ─────────────────────────────
  get_project_executive_brief: {
    name: "get_project_executive_brief",
    description:
      "Read-only EXECUTIVE brief of the current project: health band, progress, blockers, at-risk milestones, overdue/unassigned work, open risk counts, recent decisions, next milestone, honest data gaps. Use for 'project summary / how is the project / project health / what changed / what needs attention'.",
    schema: executiveBriefArgsSchema,
    maxLimit: 0,
    execute: (org, scope, args) => executeGetProjectExecutiveBrief(org, scope, args as ExecutiveBriefArgs),
  },
  get_project_risk_outlook: {
    name: "get_project_risk_outlook",
    description:
      "Read-only RISK outlook of the current project. Returns registeredRisks (formal risk records) STRICTLY SEPARATED from detectedRiskSignals (blockers, overdue, at-risk milestones, unowned work) and dataGaps. Use for 'what are the risks / what could go wrong / are we at risk of missing a milestone / can we finish on time'. Present registered records and detected signals separately; never merge them.",
    schema: executiveBriefArgsSchema,
    maxLimit: 0,
    execute: (org, scope, args) => executeGetProjectRiskOutlook(org, scope, args as ExecutiveBriefArgs),
  },
};

/**
 * Process-intelligence tools (Phase 5 · Task 6). Read-only wrappers over the
 * accepted Task 3/4/5 engines. Active ONLY when ISABELLA_PROCESS_INTELLIGENCE is
 * enabled — otherwise never registered/offered to the LLM.
 */
export const ISABELLA_INTELLIGENCE_TOOLS: Record<string, IsabellaToolDef> = {
  get_daily_diagnosis: {
    name: "get_daily_diagnosis",
    description:
      "Read-only daily process diagnosis of the current project (what is happening, what needs attention today) with evidence + confidence. Use for 'what is happening / what needs attention'. Optional milestone_id/task_id to scope.",
    schema: processIntelligenceArgsSchema,
    maxLimit: 0,
    execute: (org, scope, args) => executeGetDailyDiagnosis(org, scope, args as ProcessIntelligenceArgs),
  },
  get_root_cause_analysis: {
    name: "get_root_cause_analysis",
    description:
      "Read-only root-cause & constraint analysis (why execution problems appear) with evidence chains + confidence. Use for 'why is this blocked / delayed / at risk'. Optional milestone_id/task_id to scope. Never invents causes.",
    schema: processIntelligenceArgsSchema,
    maxLimit: 0,
    execute: (org, scope, args) => executeGetRootCauseAnalysis(org, scope, args as ProcessIntelligenceArgs),
  },
  get_recommendation_plan: {
    name: "get_recommendation_plan",
    description:
      "Read-only, evidence-backed next-best-action recommendations. Use for 'what should I do next / recommend'. Advisory only: every recommendation requires human approval and is NOT executed automatically. Optional milestone_id/task_id to scope.",
    schema: processIntelligenceArgsSchema,
    maxLimit: 0,
    execute: (org, scope, args) => executeGetRecommendationPlan(org, scope, args as ProcessIntelligenceArgs),
  },
};

/** The active tool set — process-intelligence tools only when the flag is on. */
export function activeTools(): Record<string, IsabellaToolDef> {
  return isIsabellaProcessIntelligenceEnabled()
    ? { ...ISABELLA_TOOLS, ...ISABELLA_INTELLIGENCE_TOOLS }
    : ISABELLA_TOOLS;
}

export function getTool(name: string): IsabellaToolDef | null {
  const tools = activeTools();
  return Object.prototype.hasOwnProperty.call(tools, name) ? tools[name] : null;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Tool specs (JSON-schema params) for the model. No executor exposed. */
export function listToolSpecs(): ToolSpec[] {
  return Object.values(activeTools()).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: z.toJSONSchema(t.schema) as Record<string, unknown>,
  }));
}
