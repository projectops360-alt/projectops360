// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · statistical root-cause executor
// ============================================================================
// CAP-046 / PD-019 — Feature 2. Read-only wrapper over the Root Cause Miner
// load adapter. COMPLEMENTS get_root_cause_analysis (qualitative Phase 5
// engine) with statistical association evidence — it never replaces it and
// never emits recommendations. Compact sanitized text only.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import type { Locale } from "@/types/database";
import { loadRootCauseAnalysis } from "@/lib/process-mining/root-cause/load-analysis";
import { formatRootCauseMinerForIsabella } from "@/lib/process-mining/root-cause/isabella-formatter";
import { toolFailure, type ToolResult } from "./serializers";
import type { GetProjectSummaryArgs } from "./schemas";

/** get_statistical_root_causes → loadRootCauseAnalysis (read-only). */
export async function executeGetStatisticalRootCauses(
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
        ? "Abre un proyecto para minar causas estadísticas."
        : "Open a project to mine statistical root causes.",
    );
  }

  const lang: "en" | "es" = scope.locale === "es" ? "es" : "en";
  const result = await loadRootCauseAnalysis(scope.projectId, lang as Locale);

  if (result.status === "unauthorized") {
    return toolFailure("unauthorized", lang === "es" ? "Sin acceso a este proyecto." : "No access to this project.");
  }
  if (result.status === "error") {
    return toolFailure(
      "unavailable",
      lang === "es"
        ? "La minería de causas no está disponible ahora."
        : "Root-cause mining is unavailable right now.",
    );
  }

  return {
    status: result.result.findings.length === 0 ? "empty" : "success",
    entity: "statistical_root_causes",
    rowCount: result.result.findings.length,
    truncated: false,
    message: formatRootCauseMinerForIsabella(result.result, result.projectTitle, lang),
    evidenceRefs: result.result.findings.flatMap((finding) =>
      finding.evidence.exampleRefs.map((example) => example.ref),
    ),
    limitations: [
      ...result.result.limitations,
      lang === "es"
        ? "Evidencia de asociación estadística — no causas confirmadas ni recomendaciones."
        : "Statistical association evidence — not confirmed causes, not recommendations.",
    ],
  };
}
