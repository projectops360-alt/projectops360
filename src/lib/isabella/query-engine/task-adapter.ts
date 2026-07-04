// ============================================================================
// ProjectOps360° — Isabella Query Engine · Task retrieval adapter (server-only)
// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE
//
// The ONLY approved execution path for a task query plan. Validates the plan,
// retrieves RBAC-scoped rows via the shared `retrieveTaskRows` (same org+project
// gate as the REG-013 briefing), then applies the plan's filters/sort/grouping
// DETERMINISTICALLY (the LLM never touches rows). Read-only: no mutation, no
// event log, no process graph. Never throws.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import { retrieveTaskRows } from "@/lib/isabella/task-report-service";
import { applyFilters, applyGrouping, applySort } from "./filter-engine";
import { buildQueryReportAnswer, buildClarificationAnswer, type QueryReportView } from "./formatter";
import { validateQueryPlan } from "./catalog";
import type { IsabellaProjectQueryPlan } from "./query-plan";
import type { GuideAnswer } from "@/lib/knowledge-os/types";

const DEFAULT_DISPLAY_LIMIT = 50;

export type TaskQueryOutcome =
  | { ok: true; view: QueryReportView }
  | { ok: false; reason: "no_project" | "not_authorized" | "unavailable" | "invalid_plan" | "unsupported_entity"; errors?: string[] };

export interface RunTaskQueryParams {
  org: OrgContext;
  projectId: string | undefined;
  plan: IsabellaProjectQueryPlan;
  /** Deterministic "now" for relative-date filters (overdue). */
  asOf?: string;
  displayLimit?: number;
}

/** Execute a validated task query plan against RBAC-scoped rows. */
export async function runTaskQuery(params: RunTaskQueryParams): Promise<TaskQueryOutcome> {
  const { org, projectId, plan } = params;

  if (plan.entity !== "task") return { ok: false, reason: "unsupported_entity" };
  const validation = validateQueryPlan(plan);
  if (!validation.ok) return { ok: false, reason: "invalid_plan", errors: validation.errors };

  const retrieved = await retrieveTaskRows({ org, projectId, language: plan.language });
  if (!retrieved.ok) return { ok: false, reason: retrieved.reason };

  const asOf = params.asOf ?? new Date().toISOString();
  const filtered = applyFilters(retrieved.rows, plan.filters, { asOf });
  const sorted = applySort(filtered, plan.sort);
  const limit = params.displayLimit ?? DEFAULT_DISPLAY_LIMIT;

  const view: QueryReportView = {
    projectName: retrieved.projectName,
    rows: sorted.slice(0, limit),
    total: sorted.length,
    displayed: Math.min(sorted.length, limit),
    truncated: sorted.length > limit,
    groups: plan.groupBy ? applyGrouping(sorted, plan.groupBy) : undefined,
  };
  return { ok: true, view };
}

interface ExpertInfo {
  key: string;
  displayName: string;
  title: string;
}

/**
 * Full deterministic path: a plan → an approved answer. Clarification plans ask;
 * failures map to honest states; success formats a VERIFIED report. This is what
 * `askLivingGuideAction` calls.
 */
export async function answerTaskQuery(
  params: RunTaskQueryParams & { expert: ExpertInfo },
): Promise<GuideAnswer> {
  const { plan, expert } = params;
  const es = plan.language === "es";

  if (plan.requiresClarification) return buildClarificationAnswer(plan, expert);

  const outcome = await runTaskQuery(params);
  if (outcome.ok) return buildQueryReportAnswer(plan, outcome.view, expert);

  // Honest non-success states — never a fabricated report, never "no verified answer".
  const message =
    outcome.reason === "no_project"
      ? es
        ? "Necesito que abras o selecciones un proyecto para generar ese reporte de tareas."
        : "I need you to open or select a project to generate that task report."
      : outcome.reason === "not_authorized"
        ? es
          ? "No tienes permiso para ver las tareas de este proyecto."
          : "You do not have permission to view this project's tasks."
        : outcome.reason === "unsupported_entity"
          ? es
            ? "Por ahora solo puedo generar reportes de tareas. Pronto añadiré más entidades."
            : "For now I can only report on tasks. More entities are coming soon."
          : outcome.reason === "invalid_plan"
            ? es
              ? "No pude interpretar ese reporte de forma segura. ¿Puedes reformularlo?"
              : "I couldn't interpret that report safely. Could you rephrase it?"
            : es
              ? "Encontré el proyecto, pero no pude cargar las tareas en este momento. Inténtalo de nuevo o abre el Workboard."
              : "I found the project but couldn't load the tasks right now. Please try again or open the Workboard.";

  return {
    answerId: null,
    grounded: false,
    answer: message,
    steps: [],
    followups: [],
    tier: "verified",
    confidenceScore: 1,
    language: plan.language,
    sources: [],
    expert,
  };
}
