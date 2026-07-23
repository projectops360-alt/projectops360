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
      include: ["project", "tasks", "milestones", "blockers", "process_mining_summary", "financial_summary"],
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
  if (route === "financial_summary") {
    return synthesizeFinancialSummary(context, language, audit, started);
  }

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

function financialValue(value: number | string | null | undefined, currency: string, language: RuntimeLanguage): string {
  if (value == null) return language === "es" ? "no disponible" : "not available";
  if (typeof value === "number") {
    return `${currency} ${new Intl.NumberFormat(language === "es" ? "es-ES" : "en-US", { maximumFractionDigits: 2 }).format(value)}`;
  }
  return value;
}

function financialStatus(status: string, language: RuntimeLanguage): string {
  const labels: Record<string, { es: string; en: string }> = {
    not_configured: { es: "no configurado", en: "not configured" },
    draft: { es: "borrador", en: "draft" },
    submitted: { es: "enviado a revisión", en: "submitted for review" },
    active: { es: "activo", en: "active" },
  };
  return labels[status]?.[language] ?? status;
}

function financialCadence(value: string, language: RuntimeLanguage): string {
  const labels: Record<string, { es: string; en: string }> = {
    week: { es: "semanal", en: "weekly" },
    biweek: { es: "quincenal", en: "biweekly" },
    month: { es: "mensual", en: "monthly" },
    one_time: { es: "una sola vez", en: "one-time" },
  };
  return labels[value]?.[language] ?? value;
}

function synthesizeFinancialSummary(
  context: IsabellaProcessContext,
  language: RuntimeLanguage,
  audit: (over: Partial<IsabellaProcessIntelligenceAudit>) => IsabellaProcessIntelligenceAudit,
  started: number,
): IsabellaProcessIntelligenceResult {
  const es = language === "es";
  const financial = context.financialContext;
  if (!financial) {
    return {
      status: "unavailable",
      route: "financial_summary",
      answer: es
        ? "No tengo disponible el contexto financiero autorizado para este proyecto. Verifica que Control financiero esté habilitado para la organización."
        : "The authorized financial context is not available for this project. Verify that Financial Control is enabled for the organization.",
      limitations: context.limitations,
      audit: audit({ route: "financial_summary", resultStatus: "unavailable", limitationsCount: context.limitations.length, executionMs: Date.now() - started }),
    };
  }

  const setup = financial.setup ?? {
    status: "not_configured" as const,
    estimateId: null,
    title: null,
    purpose: null,
    currency: "USD",
    estimateClass: null,
    totalAmount: null,
    totalPlannedHours: null,
    lineCount: 0,
    boeStatus: null,
    baselineStatuses: {},
    lines: [],
  };
  const facts = new Map(financial.facts.map((fact) => [fact.key, fact.value]));
  const refs = context.evidencePackets
    .filter((packet) => packet.title === "Financial control summary" || packet.title === "Financial setup and rate model")
    .map((packet) => packet.citationRef ?? packet.evidenceId);
  const lines = setup?.lines ?? [];
  const setupConfigured = setup && setup.status !== "not_configured";
  const answerLines = es
    ? [
        "**Configuración financiera PMO**",
        `- Estado del paquete: **${financialStatus(setup?.status ?? "not_configured", language)}**.`,
        setupConfigured
          ? `- Estimado: **${setup.title}** · clase AACE **${setup.estimateClass ?? "no especificada"}** · moneda **${setup.currency}** · total **${financialValue(setup.totalAmount, setup.currency, language)}**.`
          : "- Este proyecto todavía no tiene un paquete de configuración financiera capturado desde Control financiero.",
        setupConfigured
          ? `- Estructura: **${setup.lineCount}** líneas de costo · horas planificadas **${setup.totalPlannedHours ?? "no capturadas"}** · BOE **${setup.boeStatus ?? "no disponible"}**.`
          : "- Para empezar, abre **Proyecto → Control financiero → Configuración financiera**.",
        setupConfigured && lines.length > 0 ? "- Líneas y modelo de costo:" : "",
        ...lines.slice(0, 12).map((line) => `  - **${line.name}** (${line.costType}${line.resourceName ? ` · ${line.resourceName}` : ""}): ${financialValue(line.amount, setup.currency, language)} · tarifa ${financialValue(line.rate, setup.currency, language)}/${line.rateUnit} · ${financialCadence(line.periodBasis, language)} × ${line.periodCount} · horas ${line.plannedHours ?? "n/a"}${line.wbsRef || line.cbsCode || line.controlAccountRef ? ` · trazabilidad ${line.wbsRef ?? ""}${line.cbsCode ? ` / ${line.cbsCode}` : ""}${line.controlAccountRef ? ` / ${line.controlAccountRef}` : ""}` : ""}.`),
        setupConfigured ? `- Baselines: ${Object.entries(setup.baselineStatuses).map(([type, status]) => `${type}=${status}`).join(", ") || "no disponibles"}.` : "",
        `- Cockpit actual: baseline ${financialValue(facts.get("current_baseline") as number | string | null, setup?.currency ?? "USD", language)} · compromiso ${financialValue(facts.get("current_commitment") as number | string | null, setup?.currency ?? "USD", language)} · costo real ${financialValue(facts.get("actual_cost") as number | string | null, setup?.currency ?? "USD", language)}.`,
        "- Flujo: PMO captura y guarda el borrador; luego lo envía a revisión; un aprobador humano independiente activa el BOE/baseline. Isabella solo explica, compara y rastrea; no aprueba, postea ni ejecuta.",
      ]
    : [
        "**PMO financial setup**",
        `- Package status: **${financialStatus(setup?.status ?? "not_configured", language)}**.`,
        setupConfigured
          ? `- Estimate: **${setup.title}** · AACE class **${setup.estimateClass ?? "not specified"}** · currency **${setup.currency}** · total **${financialValue(setup.totalAmount, setup.currency, language)}**.`
          : "- This project does not yet have a financial setup package captured from Financial Control.",
        setupConfigured
          ? `- Structure: **${setup.lineCount}** cost lines · planned hours **${setup.totalPlannedHours ?? "not entered"}** · BOE **${setup.boeStatus ?? "not available"}**.`
          : "- To start, open **Project → Financial Control → Financial setup**.",
        setupConfigured && lines.length > 0 ? "- Lines and cost model:" : "",
        ...lines.slice(0, 12).map((line) => `  - **${line.name}** (${line.costType}${line.resourceName ? ` · ${line.resourceName}` : ""}): ${financialValue(line.amount, setup.currency, language)} · rate ${financialValue(line.rate, setup.currency, language)}/${line.rateUnit} · ${financialCadence(line.periodBasis, language)} × ${line.periodCount} · hours ${line.plannedHours ?? "n/a"}${line.wbsRef || line.cbsCode || line.controlAccountRef ? ` · trace ${line.wbsRef ?? ""}${line.cbsCode ? ` / ${line.cbsCode}` : ""}${line.controlAccountRef ? ` / ${line.controlAccountRef}` : ""}` : ""}.`),
        setupConfigured ? `- Baselines: ${Object.entries(setup.baselineStatuses).map(([type, status]) => `${type}=${status}`).join(", ") || "not available"}.` : "",
        `- Current cockpit: baseline ${financialValue(facts.get("current_baseline") as number | string | null, setup?.currency ?? "USD", language)} · commitment ${financialValue(facts.get("current_commitment") as number | string | null, setup?.currency ?? "USD", language)} · actual cost ${financialValue(facts.get("actual_cost") as number | string | null, setup?.currency ?? "USD", language)}.`,
        "- Workflow: PMO captures and saves the draft; submits it for review; an independent human approver activates the BOE/baseline. Isabella only explains, compares, and traces; she cannot approve, post, or execute.",
      ];
  const answer = answerLines.filter(Boolean).join("\n");
  return {
    status: "answered",
    route: "financial_summary",
    answer,
    structuredResult: { setup, facts: Object.fromEntries(financial.facts.map((fact) => [fact.key, fact.value])) },
    evidenceRefs: [...new Set(refs)],
    citations: context.citations.filter((citation) => citation.sourceLabel === "PMO financial setup" || citation.sourceLabel === "Canonical financial projections"),
    limitations: financial.limitations,
    audit: audit({
      route: "financial_summary",
      enginesUsed: ["financial_summary"],
      resultStatus: "answered",
      confidence: "verified",
      evidenceRefCount: new Set(refs).size,
      citationCount: context.citations.length,
      limitationsCount: financial.limitations.length,
      executionMs: Date.now() - started,
    }),
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
