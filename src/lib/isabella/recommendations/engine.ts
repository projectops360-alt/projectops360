// ============================================================================
// ProjectOps360° — Isabella Recommendation & Next-Best-Action · engine (Task 5)
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE
//
// `assembleRecommendationPlan` is PURE (context + root-cause + diagnosis → plan).
// `buildIsabellaRecommendationPlan` is the server entry: it reuses provided
// context/diagnosis/analysis or asks the approved Task 2/3/4 builders — it NEVER
// queries raw project data, NEVER mutates, NEVER executes. Advisory only: every
// recommendation is human-approved and not executable by this engine.
// ============================================================================

import { buildIsabellaProcessContext } from "@/lib/isabella/process-context";
import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import { assembleDailyDiagnosis } from "@/lib/isabella/daily-diagnosis";
import type { IsabellaDailyProcessDiagnosis } from "@/lib/isabella/daily-diagnosis";
import { assembleRootCauseAnalysis } from "@/lib/isabella/root-cause";
import type { IsabellaRootCauseAnalysis } from "@/lib/isabella/root-cause/types";
import { generateRecommendationCandidates } from "./candidates";
import { filterEvidenceBacked } from "./evidence";
import { dedupeRecommendations, groupRecommendations, toRecommendation } from "./dedupe";
import { capRecommendationConfidence, rankRecommendations } from "./scoring";
import type {
  IsabellaRecommendation,
  IsabellaRecommendationPlan,
  RecommendationDecisionSupport,
  RecommendationLanguage,
} from "./types";

function tt(es: boolean, en: string, esT: string): string {
  return es ? esT : en;
}

/**
 * PURE: synthesize a ranked, evidence-backed recommendation plan from an
 * authorized context + its root-cause analysis (+ optional diagnosis).
 */
export function assembleRecommendationPlan(
  context: IsabellaProcessContext,
  rootCauseAnalysis: IsabellaRootCauseAnalysis,
  diagnosis: IsabellaDailyProcessDiagnosis | undefined,
  language: RecommendationLanguage,
): IsabellaRecommendationPlan {
  const es = language === "es";
  const title = es ? "Recomendaciones de siguiente mejor acción" : "Next-Best-Action Recommendations";
  const projectId = rootCauseAnalysis.projectId;
  const organizationId = rootCauseAnalysis.organizationId;

  const base = {
    projectId,
    organizationId,
    snapshotAt: rootCauseAnalysis.snapshotAt,
    title,
    citations: rootCauseAnalysis.citations,
    limitations: rootCauseAnalysis.limitations,
  };

  // Non-actionable context → honest empty plan (no generic advice).
  if (context.status === "missing_context" || context.status === "unauthorized" || context.status === "unavailable" || context.status === "empty") {
    return {
      ...base,
      status: context.status,
      summary: rootCauseAnalysis.message ?? rootCauseAnalysis.summary ?? "",
      recommendations: [],
      recommendationGroups: [],
      decisionSupport: { blockedByMissingEvidence: true },
      evidenceRefs: [],
      message: rootCauseAnalysis.message ?? context.message,
    };
  }

  // Candidate → validate → dedupe → rank → finalize.
  const candidates = generateRecommendationCandidates(rootCauseAnalysis, diagnosis, language);
  const backed = filterEvidenceBacked(candidates);
  const deduped = dedupeRecommendations(backed);
  const ranked = rankRecommendations(deduped);
  const recommendations: IsabellaRecommendation[] = ranked.map((c, i) => {
    const rec = toRecommendation(c, i);
    rec.confidence = capRecommendationConfidence(rec.confidence, context);
    return rec;
  });

  if (recommendations.length === 0) {
    return {
      ...base,
      status: "empty",
      summary: tt(es, "No recommendation can be generated from the current evidence.", "No se puede generar ninguna recomendación con la evidencia actual."),
      recommendations: [],
      recommendationGroups: [],
      decisionSupport: { blockedByMissingEvidence: true },
      evidenceRefs: [],
    };
  }

  const groups = groupRecommendations(recommendations, language);
  const evidenceRefs = [...new Set(recommendations.flatMap((r) => r.evidenceRefs))];
  const top = recommendations[0];
  const decisionSupport: RecommendationDecisionSupport = {
    topPriorityReason: top.rationale,
    tradeoffs: buildTradeoffs(recommendations, language),
    blockedByMissingEvidence: recommendations.every((r) => r.confidence === "unavailable" || r.confidence === "unknown"),
  };

  const focus = summarizeFocus(recommendations, language);
  const summary = tt(
    es,
    `${recommendations.length} recommendation(s). Top focus: ${focus}. Not executed automatically — human approval required.`,
    `${recommendations.length} recomendación(es). Foco principal: ${focus}. No se ejecutaron automáticamente — requieren aprobación humana.`,
  );

  return {
    ...base,
    status: context.status === "partial" ? "partial" : "ready",
    summary,
    recommendations,
    recommendationGroups: groups,
    decisionSupport,
    evidenceRefs,
  };
}

function summarizeFocus(recs: IsabellaRecommendation[], language: RecommendationLanguage): string {
  const es = language === "es";
  const impacts = [...new Set(recs.slice(0, 3).map((r) => r.expectedImpact))];
  const map: Record<string, { en: string; es: string }> = {
    unblock_execution: { en: "unblock execution", es: "desbloquear ejecución" },
    reduce_risk: { en: "reduce risk", es: "reducir riesgo" },
    improve_accountability: { en: "improve accountability", es: "mejorar accountability" },
    restore_sequence: { en: "restore sequence", es: "restaurar secuencia" },
    increase_clarity: { en: "increase clarity", es: "aumentar claridad" },
    reduce_uncertainty: { en: "reduce uncertainty", es: "reducir incertidumbre" },
    unknown: { en: "clarify next steps", es: "aclarar próximos pasos" },
  };
  return impacts.map((i) => map[i][es ? "es" : "en"]).join(", ");
}

function buildTradeoffs(recs: IsabellaRecommendation[], language: RecommendationLanguage): string[] {
  const es = language === "es";
  const out: string[] = [];
  if (recs.some((r) => r.confidence === "low" || r.confidence === "unknown" || r.confidence === "unavailable")) {
    out.push(tt(es, "Some recommendations rely on weak/missing evidence — validate before acting.", "Algunas recomendaciones dependen de evidencia débil/faltante — validar antes de actuar."));
  }
  if (recs.some((r) => r.category === "investigate_evidence_gap")) {
    out.push(tt(es, "Collecting missing evidence may change the priority order.", "Recolectar evidencia faltante puede cambiar el orden de prioridad."));
  }
  return out;
}

export interface RecommendationRequest {
  projectId?: string;
  organizationId?: string;
  userId?: string;
  locale?: string;
  timezone?: string;
  scope?: { milestoneId?: string; taskId?: string };
  context?: IsabellaProcessContext;
  dailyDiagnosis?: IsabellaDailyProcessDiagnosis;
  rootCauseAnalysis?: IsabellaRootCauseAnalysis;
}

/** Server entry: reuse or build the approved context/diagnosis/analysis, then plan. */
export async function buildIsabellaRecommendationPlan(request: RecommendationRequest): Promise<IsabellaRecommendationPlan> {
  const language: RecommendationLanguage = request.locale === "es" ? "es" : "en";
  const context =
    request.context ??
    (await buildIsabellaProcessContext({ projectId: request.projectId, locale: language, include: ["project", "tasks", "milestones", "blockers"] }));
  const actionable = context.status === "ready" || context.status === "partial";
  const diagnosis =
    request.dailyDiagnosis ?? (actionable ? assembleDailyDiagnosis(context, language) : undefined);
  const rootCauseAnalysis =
    request.rootCauseAnalysis ?? assembleRootCauseAnalysis(context, diagnosis, request.scope, language);
  return assembleRecommendationPlan(context, rootCauseAnalysis, diagnosis, language);
}
