// ============================================================================
// ProjectOps360° — Isabella Process Intelligence Runtime · server orchestrator
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION (Phase 5 · Task 6)
//
// `runIsabellaProcessIntelligence` routes a question and calls the accepted
// Task 3/4/5 engines through the approved Task 2 context builder — read-only,
// evidence-backed, RBAC-safe, node-scoped, bilingual. It NEVER queries raw data,
// NEVER mutates, NEVER executes recommendations. When the route is RAG /
// factual-data it returns `fallback` so the caller keeps the existing path.
// ============================================================================

import { buildIsabellaProcessContext } from "@/lib/isabella/process-context";
import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import { assembleDailyDiagnosis, formatDailyDiagnosisForIsabella } from "@/lib/isabella/daily-diagnosis";
import { assembleRootCauseAnalysis, formatRootCauseAnalysisForIsabella } from "@/lib/isabella/root-cause";
import { assembleRecommendationPlan, formatRecommendationPlanForIsabella } from "@/lib/isabella/recommendations";
import { answerScreenHelp } from "@/lib/isabella/screen-help";
import {
  buildIsabellaReasoningTrace,
  governRecommendationPlan,
  governRootCauseAnalysis,
} from "@/lib/isabella/reasoning-pipeline";
import { routeIsabellaQuestion } from "./router";
import type {
  IsabellaProcessIntelligenceAudit,
  IsabellaProcessIntelligenceRequest,
  IsabellaProcessIntelligenceResult,
  IsabellaRoute,
  IsabellaRuntimeStatus,
  RuntimeLanguage,
} from "./types";

const PROCESS_MINING_SOURCE_KINDS = new Set(["project_event_graph", "milestone_process_flow"]);

function runtimeStatusFromContext(status: string): IsabellaRuntimeStatus {
  switch (status) {
    case "ready":
    case "partial":
    case "empty":
      return "answered";
    case "unauthorized":
      return "unauthorized";
    case "missing_context":
      return "missing_context";
    default:
      return "unavailable";
  }
}

function scopeType(node: IsabellaProcessIntelligenceRequest["selectedNode"]): IsabellaProcessIntelligenceAudit["selectedScope"]["type"] {
  if (!node) return "unknown";
  if (node.type === "milestone") return "milestone";
  if (node.type === "task") return "task";
  if (node.type === "subtask") return "subtask";
  return "project";
}

/** Orchestrate a process-intelligence answer. Read-only; never mutates/executes. */
export async function runIsabellaProcessIntelligence(
  request: IsabellaProcessIntelligenceRequest,
  deps?: { buildContext?: typeof buildIsabellaProcessContext },
): Promise<IsabellaProcessIntelligenceResult> {
  const started = Date.now();
  const language: RuntimeLanguage = request.locale === "es" ? "es" : "en";
  const hasProject = !!request.projectId || !!request.selectedNode;
  const decision = routeIsabellaQuestion(request.question, {
    hasProject,
    selectedNode: request.selectedNode,
    screenContext: request.screenContext,
  });

  const audit = (over: Partial<IsabellaProcessIntelligenceAudit>): IsabellaProcessIntelligenceAudit => ({
    processIntelligenceEnabled: true,
    route: decision.route,
    enginesUsed: [],
    resultStatus: "unavailable",
    evidenceRefCount: 0,
    citationCount: 0,
    limitationsCount: 0,
    selectedScope: { type: scopeType(request.selectedNode), id: request.selectedNode ? "selected" : hasProject ? "current_project" : "none" },
    executionMs: Date.now() - started,
    ...over,
  });

  // Screen / UI-label explanation — deterministic, from screen context. Never an
  // engine, never Daily Diagnosis. When the screen is unknown/ambiguous it returns
  // a safe clarification (confident=false) so we do NOT mark it "Verified 100%".
  if (decision.route === "screen_context_explanation") {
    const help = answerScreenHelp(request.question, request.screenContext, language);
    return {
      status: help.confident ? "answered" : "needs_clarification",
      route: "screen_context_explanation",
      answer: help.answer,
      audit: audit({
        route: "screen_context_explanation",
        resultStatus: help.confident ? "answered" : "needs_clarification",
        confidence: help.confident ? "high" : "unavailable",
        selectedScope: { type: scopeType(request.selectedNode), id: help.area },
      }),
    };
  }

  // RAG / factual-data are handled by the existing pipeline — fall back cleanly.
  if (decision.route === "product_help" || decision.route === "factual_project_data") {
    return { status: "fallback", route: decision.route, answer: "", audit: audit({ resultStatus: "fallback" }) };
  }

  // Engine route with no inferable scope → clarify (never guess).
  if (decision.needsClarification) {
    return {
      status: "needs_clarification",
      route: decision.route,
      answer: language === "es" ? "¿Sobre qué proyecto o elemento quieres el análisis?" : "Which project or item should I analyze?",
      audit: audit({ resultStatus: "needs_clarification" }),
    };
  }

  // Build the approved, RBAC-scoped context ONCE (never raw data).
  const build = deps?.buildContext ?? buildIsabellaProcessContext;
  let context: IsabellaProcessContext;
  try {
    context = await build({
      projectId: request.projectId,
      locale: language,
      include: ["project", "tasks", "milestones", "blockers", "process_mining_summary"],
      focus: decision.scope.taskId ? { taskId: decision.scope.taskId } : decision.scope.milestoneId ? { milestoneId: decision.scope.milestoneId } : undefined,
    });
  } catch {
    return { status: "unavailable", route: decision.route, answer: safeUnavailable(language), audit: audit({ resultStatus: "unavailable" }) };
  }

  const rtStatus = runtimeStatusFromContext(context.status);
  if (rtStatus !== "answered") {
    return {
      status: rtStatus,
      route: decision.route,
      answer: context.message ?? safeUnavailable(language),
      limitations: context.limitations,
      audit: audit({ resultStatus: context.status, limitationsCount: context.limitations.length }),
    };
  }

  return synthesize(decision.route, context, decision.scope, language, audit, started);
}

function synthesize(
  route: IsabellaRoute,
  context: IsabellaProcessContext,
  scope: { milestoneId?: string; taskId?: string },
  language: RuntimeLanguage,
  audit: (over: Partial<IsabellaProcessIntelligenceAudit>) => IsabellaProcessIntelligenceAudit,
  started: number,
): IsabellaProcessIntelligenceResult {
  if (route === "process_mining_summary") {
    return synthesizeProcessMiningSummary(context, language, audit, started);
  }

  const diagnosis = assembleDailyDiagnosis(context, language);

  if (route === "daily_diagnosis") {
    const reasoningTrace = buildIsabellaReasoningTrace(context, route, { diagnosis });
    return {
      status: "answered", route,
      answer: formatDailyDiagnosisForIsabella(diagnosis, language),
      structuredResult: diagnosis,
      evidenceRefs: diagnosis.evidenceRefs, citations: diagnosis.citations, limitations: diagnosis.limitations,
      reasoningTrace,
      audit: audit({ enginesUsed: ["daily_diagnosis"], resultStatus: diagnosis.status, confidence: diagnosis.overallHealth.confidence, evidenceRefCount: diagnosis.evidenceRefs.length, citationCount: diagnosis.citations.length, limitationsCount: diagnosis.limitations.length, executionMs: Date.now() - started }),
    };
  }

  const rawAnalysis = assembleRootCauseAnalysis(context, diagnosis, scope, language);
  const analysisTrace = buildIsabellaReasoningTrace(context, "root_cause", { diagnosis, analysis: rawAnalysis });
  const analysis = governRootCauseAnalysis(rawAnalysis, analysisTrace, language);
  if (route === "root_cause") {
    return {
      status: "answered", route,
      answer: formatRootCauseAnalysisForIsabella(analysis, language),
      structuredResult: analysis,
      evidenceRefs: analysis.evidenceRefs, citations: analysis.citations, limitations: analysis.limitations,
      reasoningTrace: analysisTrace,
      audit: audit({ enginesUsed: ["daily_diagnosis", "root_cause"], resultStatus: analysis.status, confidence: analysis.confidence, evidenceRefCount: analysis.evidenceRefs.length, citationCount: analysis.citations.length, limitationsCount: analysis.limitations.length, executionMs: Date.now() - started }),
    };
  }

  const rawPlan = assembleRecommendationPlan(context, analysis, diagnosis, language);
  const planTrace = buildIsabellaReasoningTrace(context, route, { diagnosis, analysis, plan: rawPlan });
  const plan = governRecommendationPlan(rawPlan, planTrace, language);
  if (route === "recommendation") {
    return {
      status: "answered", route,
      answer: formatRecommendationPlanForIsabella(plan, language),
      structuredResult: plan,
      evidenceRefs: plan.evidenceRefs, citations: plan.citations, limitations: plan.limitations,
      reasoningTrace: planTrace,
      audit: audit({ enginesUsed: ["daily_diagnosis", "root_cause", "recommendations"], resultStatus: plan.status, confidence: plan.recommendations[0]?.confidence ?? "unavailable", evidenceRefCount: plan.evidenceRefs.length, citationCount: plan.citations.length, limitationsCount: plan.limitations.length, executionMs: Date.now() - started }),
    };
  }

  // mixed → concise diagnosis + root cause + recommendation (no long duplication).
  const es = language === "es";
  const answer = [
    `**${es ? "Qué está pasando" : "What is happening"}**`,
    diagnosis.executiveSummary,
    "",
    `**${es ? "Por qué" : "Why"}**`,
    analysis.summary,
    "",
    `**${es ? "Qué hacer ahora" : "What to do next"}**`,
    formatRecommendationPlanForIsabella(plan, language),
  ].join("\n");
  const evidenceRefs = [...new Set([...diagnosis.evidenceRefs, ...analysis.evidenceRefs, ...plan.evidenceRefs])];
  return {
    status: "answered", route: "mixed",
    answer,
    structuredResult: { diagnosis, analysis, plan },
    evidenceRefs, citations: plan.citations, limitations: plan.limitations,
    reasoningTrace: planTrace,
    audit: audit({ enginesUsed: ["daily_diagnosis", "root_cause", "recommendations"], resultStatus: plan.status, confidence: analysis.confidence, evidenceRefCount: evidenceRefs.length, citationCount: plan.citations.length, limitationsCount: plan.limitations.length, executionMs: Date.now() - started }),
  };
}

function synthesizeProcessMiningSummary(
  context: IsabellaProcessContext,
  language: RuntimeLanguage,
  audit: (over: Partial<IsabellaProcessIntelligenceAudit>) => IsabellaProcessIntelligenceAudit,
  started: number,
): IsabellaProcessIntelligenceResult {
  const es = language === "es";
  const mining = context.processMiningContext;
  if (!mining || mining.status === "unavailable") {
    return {
      status: "unavailable",
      route: "process_mining_summary",
      answer: es
        ? "La capa de Process Mining no está disponible para este proyecto en este momento."
        : "The Process Mining Layer is not available for this project right now.",
      limitations: context.limitations,
      audit: audit({
        resultStatus: mining?.status ?? "unavailable",
        confidence: "unavailable",
        limitationsCount: context.limitations.length,
        executionMs: Date.now() - started,
      }),
    };
  }

  const processPackets = context.evidencePackets.filter((packet) => PROCESS_MINING_SOURCE_KINDS.has(packet.sourceKind));
  const processRefs = [...new Set(
    processPackets.map((packet) => packet.citationRef ?? packet.evidenceId).filter(Boolean),
  )] as string[];
  const safeRefs = new Set(processRefs);
  const citations = context.citations.filter((citation) => citation.safeRef && safeRefs.has(citation.safeRef));
  const integrity = mining.integrityValid == null
    ? (es ? "no evaluada" : "not evaluated")
    : mining.integrityValid
      ? (es ? "válida" : "valid")
      : es
        ? `${mining.integrityIssueCount} incidencia(s)`
        : `${mining.integrityIssueCount} issue(s)`;
  const window = mining.firstOccurredAt && mining.lastOccurredAt
    ? `${mining.firstOccurredAt} → ${mining.lastOccurredAt}`
    : (es ? "sin eventos observados" : "no observed events");
  const reasoningTrace = buildIsabellaReasoningTrace(context, "process_mining_summary", {});
  const answer = es
    ? [
        "**Process Mining Layer — resumen verificado**",
        `- Eventos canónicos minables: **${mining.eventCount}** (tareas ${mining.taskEventCount}, hitos ${mining.milestoneEventCount}, dependencias ${mining.dependencyEventCount}).`,
        `- Casos: **${mining.caseCount}**. Transiciones observadas: **${mining.transitionCount}**.`,
        `- Descubrimiento: **${mining.directFollowCount ?? 0}** relaciones direct-follow, **${mining.variantCount ?? 0}** variantes y **${mining.temporallyMeasuredCaseCount ?? 0}** casos con tiempo de ciclo medible.`,
        `- Actividades fuera de la taxonomía conocida: **${mining.unknownActivityCount ?? 0}**.`,
        `- Integridad de la ventana canónica: **${integrity}**.`,
        `- Hallazgos derivados: retrasos ${mining.delayFindingCount}, bloqueos ${mining.blockerFindingCount}, retrabajo ${mining.reworkFindingCount}, cuellos de botella ${mining.bottleneckFindingCount}.`,
        `- Ventana observada: ${window}.`,
        "La sucesión temporal muestra qué ocurrió después; no demuestra causalidad. Los hallazgos derivados requieren corroboración antes de afirmar una causa.",
      ].join("\n")
    : [
        "**Process Mining Layer — verified summary**",
        `- Mineable canonical events: **${mining.eventCount}** (tasks ${mining.taskEventCount}, milestones ${mining.milestoneEventCount}, dependencies ${mining.dependencyEventCount}).`,
        `- Cases: **${mining.caseCount}**. Observed transitions: **${mining.transitionCount}**.`,
        `- Discovery: **${mining.directFollowCount ?? 0}** direct-follow relations, **${mining.variantCount ?? 0}** variants and **${mining.temporallyMeasuredCaseCount ?? 0}** cases with measurable cycle time.`,
        `- Activities outside the known taxonomy: **${mining.unknownActivityCount ?? 0}**.`,
        `- Canonical-window integrity: **${integrity}**.`,
        `- Derived findings: delays ${mining.delayFindingCount}, blockers ${mining.blockerFindingCount}, rework ${mining.reworkFindingCount}, bottlenecks ${mining.bottleneckFindingCount}.`,
        `- Observed window: ${window}.`,
        "Temporal succession shows what happened next; it does not prove causality. Derived findings require corroboration before asserting a cause.",
      ].join("\n");

  return {
    status: "answered",
    route: "process_mining_summary",
    answer,
    structuredResult: mining,
    evidenceRefs: processRefs,
    citations,
    limitations: context.limitations,
    reasoningTrace,
    audit: audit({
      enginesUsed: ["process_mining_summary"],
      resultStatus: mining.status,
      confidence: mining.integrityValid === true && mining.status === "ready" ? "verified" : "medium",
      evidenceRefCount: processRefs.length,
      citationCount: citations.length,
      limitationsCount: context.limitations.length,
      executionMs: Date.now() - started,
    }),
  };
}

function safeUnavailable(language: RuntimeLanguage): string {
  return language === "es"
    ? "No puedo analizar el proyecto ahora mismo. Intenta de nuevo o selecciona un proyecto."
    : "I can't analyze the project right now. Try again or select a project.";
}
