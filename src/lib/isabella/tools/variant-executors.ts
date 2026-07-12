// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · variant-analysis executor
// ============================================================================
// CAP-046 / PD-019 — Feature 1. Read-only wrapper over the Variant Analysis
// load adapter (which enforces org/RLS boundaries itself). Returns a COMPACT,
// sanitized text result — no raw event payloads, no raw DB ids (the formatter
// emits names + counts only). Never mutates, never emits events.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import type { Locale } from "@/types/database";
import { loadVariantAnalysis } from "@/lib/process-mining/variants/load-analysis";
import { formatVariantAnalysisForIsabella } from "@/lib/process-mining/variants/isabella-formatter";
import { toolFailure, type ToolResult } from "./serializers";
import type { GetProjectSummaryArgs } from "./schemas";

/** get_execution_variants → loadVariantAnalysis (read-only). */
export async function executeGetExecutionVariants(
  _org: OrgContext,
  scope: IsabellaProjectScope,
  _args: GetProjectSummaryArgs,
): Promise<ToolResult> {
  void _org;
  void _args;
  if (!scope.projectId) {
    return toolFailure(
      "missing_context",
      scope.locale === "es"
        ? "Abre un proyecto para analizar sus variantes de ejecución."
        : "Open a project to analyze its execution variants.",
    );
  }

  const lang: "en" | "es" = scope.locale === "es" ? "es" : "en";
  const result = await loadVariantAnalysis(scope.projectId, lang as Locale);

  if (result.status === "unauthorized") {
    return toolFailure("unauthorized", lang === "es" ? "Sin acceso a este proyecto." : "No access to this project.");
  }
  if (result.status === "error") {
    return toolFailure(
      "unavailable",
      lang === "es" ? "El análisis de variantes no está disponible ahora." : "Variant analysis is unavailable right now.",
    );
  }

  const limitations: string[] = [];
  if (result.truncated) {
    limitations.push(
      lang === "es"
        ? "La ventana de eventos se limitó; el historial más antiguo no está incluido."
        : "The event window was capped; older history is not included.",
    );
  }
  if (result.analysis.referenceVariantId === null) {
    limitations.push(
      lang === "es"
        ? "Sin variante de referencia: ningún proyecto comparado tiene desenlace decidido."
        : "No reference variant: no compared project has a decided outcome.",
    );
  }

  return {
    status: result.analysis.analyzedCases === 0 ? "empty" : "success",
    entity: "execution_variants",
    rowCount: result.analysis.variants.length,
    truncated: result.truncated,
    message: formatVariantAnalysisForIsabella(
      result.analysis,
      result.focusAssignment,
      result.projectTitle,
      lang,
    ),
    evidenceRefs: [`variant-analysis:${result.focusProjectId}`],
    limitations,
  };
}
