// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · KPI engine executor
// ============================================================================
// CAP-046 / PD-019 — Feature 3. Read-only: loads the allow-listed KPI dataset
// (RLS, deny-by-default) and evaluates a catalog KPI or a SANDBOXED ad-hoc
// expression (validated allow-list, never eval). This is the NL-to-KPI path:
// the LLM translates the user's request into an expression constrained by the
// documented functions/variables; the engine validates before evaluating and
// returns precise errors on anything outside the allow-list.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import type { Locale } from "@/types/database";
import { loadKpiDataset } from "@/lib/kpi/load-dataset";
import { evaluateKpi, KPI_CATALOG } from "@/lib/kpi";
import { toolFailure, type ToolResult } from "./serializers";
import type { EvaluateKpiArgs } from "./schemas";

function catalogText(lang: "en" | "es"): string {
  const es = lang === "es";
  const header = es
    ? "KPIs disponibles (usa kpi_slug, o una expresión con SUM/AVG/COUNT/MEDIAN/PERCENTILE/CORRELATION/TREND/MOVING_AVERAGE/FORECAST sobre las variables del catálogo):"
    : "Available KPIs (use kpi_slug, or an expression with SUM/AVG/COUNT/MEDIAN/PERCENTILE/CORRELATION/TREND/MOVING_AVERAGE/FORECAST over catalog variables):";
  const rows = KPI_CATALOG.map(
    (definition) =>
      `- ${definition.slug}: ${es ? definition.nameEs : definition.nameEn} (${definition.unit}) — ${definition.expression}`,
  );
  return [header, ...rows].join("\n");
}

/** evaluate_kpi → loadKpiDataset + sandboxed evaluation (read-only). */
export async function executeEvaluateKpi(
  _org: OrgContext,
  scope: IsabellaProjectScope,
  args: EvaluateKpiArgs,
): Promise<ToolResult> {
  void _org;
  if (!scope.projectId) {
    return toolFailure(
      "missing_context",
      scope.locale === "es" ? "Abre un proyecto para calcular KPIs." : "Open a project to compute KPIs.",
    );
  }

  const lang: "en" | "es" = scope.locale === "es" ? "es" : "en";
  const load = await loadKpiDataset(scope.projectId, lang as Locale);
  if (load.status === "unauthorized") {
    return toolFailure("unauthorized", lang === "es" ? "Sin acceso a este proyecto." : "No access to this project.");
  }
  if (load.status === "error") {
    return toolFailure(
      "unavailable",
      lang === "es" ? "El motor de KPIs no está disponible ahora." : "The KPI engine is unavailable right now.",
    );
  }

  // No slug and no expression → return the catalog so the model can choose.
  if (!args.kpi_slug && !args.expression) {
    return {
      status: "success",
      entity: "kpi_catalog",
      rowCount: KPI_CATALOG.length,
      truncated: false,
      message: catalogText(lang),
    };
  }

  const result = evaluateKpi({ kpiSlug: args.kpi_slug, expression: args.expression }, load.dataset);

  if (result.status === "invalid") {
    return toolFailure("invalid_args", result.error);
  }
  if (result.status === "not_computable") {
    return {
      status: "empty",
      entity: "kpi",
      rowCount: 0,
      truncated: false,
      message:
        lang === "es"
          ? `KPI no calculable con los datos actuales de "${load.projectTitle}": ${result.reason}`
          : `KPI not computable with the current data of "${load.projectTitle}": ${result.reason}`,
      limitations: [result.reason],
    };
  }

  const definition = result.slug ? KPI_CATALOG.find((d) => d.slug === result.slug) : null;
  const name = definition ? (lang === "es" ? definition.nameEs : definition.nameEn) : result.expression;
  const unit = result.unit ? ` ${result.unit}` : "";
  return {
    status: "success",
    entity: "kpi",
    rowCount: 1,
    truncated: false,
    message:
      lang === "es"
        ? `${name} — "${load.projectTitle}": ${result.formatted}${unit}. (Expresión: ${result.expression}; ${load.taskCount} tareas, ${load.milestoneCount} hitos.)`
        : `${name} — "${load.projectTitle}": ${result.formatted}${unit}. (Expression: ${result.expression}; ${load.taskCount} tasks, ${load.milestoneCount} milestones.)`,
    evidenceRefs: [`kpi:${result.slug ?? "adhoc"}:${scope.projectId}`],
  };
}
