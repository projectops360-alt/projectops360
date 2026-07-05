// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · process-intelligence executors
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION (Phase 5 · Task 6)
//
// Read-only tool executors that WRAP the accepted Task 3/4/5 engines through the
// approved Task 2 context builder — never the DB directly, never a mutation. They
// return a COMPACT, sanitized text result (no raw payloads, no raw ids). The
// recommendation tool result carries humanApprovalRequired/executableNow so the
// LLM can never claim it executed anything.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import { buildIsabellaProcessContext } from "@/lib/isabella/process-context/context-builder";
import type { IsabellaProcessContext, IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import { assembleDailyDiagnosis, formatDailyDiagnosisForIsabella } from "@/lib/isabella/daily-diagnosis";
import { assembleRootCauseAnalysis, formatRootCauseAnalysisForIsabella } from "@/lib/isabella/root-cause";
import { assembleRecommendationPlan, formatRecommendationPlanForIsabella } from "@/lib/isabella/recommendations";
import { toolFailure, type ToolResult } from "./serializers";
import type { ProcessIntelligenceArgs } from "./schemas";

function lang(scope: IsabellaProjectScope): "en" | "es" {
  return scope.locale === "es" ? "es" : "en";
}

const CTX_STATUS_MAP: Record<string, ToolResult["status"]> = {
  ready: "success", partial: "success", empty: "empty",
  unauthorized: "unauthorized", missing_context: "missing_context", unavailable: "unavailable",
};

async function loadContext(scope: IsabellaProjectScope, args: ProcessIntelligenceArgs): Promise<IsabellaProcessContext> {
  return buildIsabellaProcessContext({
    projectId: scope.projectId,
    locale: lang(scope),
    include: ["project", "tasks", "milestones", "blockers"],
    focus: args.task_id ? { taskId: args.task_id } : args.milestone_id ? { milestoneId: args.milestone_id } : undefined,
  });
}

function gate(ctx: IsabellaProcessContext): ToolResult | null {
  const status = CTX_STATUS_MAP[ctx.status] ?? "unavailable";
  if (status !== "success" && status !== "empty") return toolFailure(status, ctx.message ?? "unavailable");
  return null;
}

/** get_daily_diagnosis → buildIsabellaDailyProcessDiagnosis (read-only). */
export async function executeGetDailyDiagnosis(_org: OrgContext, scope: IsabellaProjectScope, args: ProcessIntelligenceArgs): Promise<ToolResult> {
  void _org;
  const ctx = await loadContext(scope, args);
  const bad = gate(ctx);
  if (bad) return bad;
  const d = assembleDailyDiagnosis(ctx, lang(scope));
  return {
    status: "success", entity: "diagnosis", rowCount: d.evidenceRefs.length, truncated: false,
    message: formatDailyDiagnosisForIsabella(d, lang(scope)),
    evidenceRefs: d.evidenceRefs,
    citations: d.citations.slice(0, 20).map((c) => ({ label: c.sourceLabel, entityType: c.entityType, title: c.entityTitle, ref: c.safeRef ?? null })),
    limitations: d.limitations,
  };
}

/** get_root_cause_analysis → buildIsabellaRootCauseAnalysis (read-only). */
export async function executeGetRootCauseAnalysis(_org: OrgContext, scope: IsabellaProjectScope, args: ProcessIntelligenceArgs): Promise<ToolResult> {
  void _org;
  const ctx = await loadContext(scope, args);
  const bad = gate(ctx);
  if (bad) return bad;
  const l = lang(scope);
  const d = assembleDailyDiagnosis(ctx, l);
  const a = assembleRootCauseAnalysis(ctx, d, { milestoneId: args.milestone_id, taskId: args.task_id }, l);
  return {
    status: "success", entity: "root_cause", rowCount: a.findings.length, truncated: false,
    message: formatRootCauseAnalysisForIsabella(a, l),
    evidenceRefs: a.evidenceRefs,
    citations: a.citations.slice(0, 20).map((c) => ({ label: c.sourceLabel, entityType: c.entityType, title: c.entityTitle, ref: c.safeRef ?? null })),
    limitations: a.limitations,
  };
}

/** get_recommendation_plan → buildIsabellaRecommendationPlan (read-only, advisory). */
export async function executeGetRecommendationPlan(_org: OrgContext, scope: IsabellaProjectScope, args: ProcessIntelligenceArgs): Promise<ToolResult> {
  void _org;
  const ctx = await loadContext(scope, args);
  const bad = gate(ctx);
  if (bad) return bad;
  const l = lang(scope);
  const d = assembleDailyDiagnosis(ctx, l);
  const a = assembleRootCauseAnalysis(ctx, d, { milestoneId: args.milestone_id, taskId: args.task_id }, l);
  const plan = assembleRecommendationPlan(ctx, a, d, l);
  return {
    status: plan.recommendations.length === 0 ? "empty" : "success",
    entity: "recommendation", rowCount: plan.recommendations.length, truncated: false,
    message: formatRecommendationPlanForIsabella(plan, l),
    evidenceRefs: plan.evidenceRefs,
    citations: plan.citations.slice(0, 20).map((c) => ({ label: c.sourceLabel, entityType: c.entityType, title: c.entityTitle, ref: c.safeRef ?? null })),
    // Advisory safety surfaced to the LLM — it can never claim execution.
    limitations: [
      ...plan.limitations,
      scope.locale === "es" ? "Requiere aprobación humana. No ejecutado automáticamente." : "Requires human approval. Not executed automatically.",
    ],
  };
}
