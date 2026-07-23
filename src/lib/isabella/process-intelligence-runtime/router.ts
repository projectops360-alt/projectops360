// ============================================================================
// ProjectOps360° — Isabella Process Intelligence Runtime · deterministic router
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION (Phase 5 · Task 6)
//
// Decides WHICH engine answers a question — deterministically and testably. It
// REUSES `classifyIsabellaIntent` (Task 1 evidence contract) so we never fork the
// intent vocabulary, and adds `mixed` detection + safe node scoping. The LLM
// never decides data truth; this router does the routing. Pure.
// ============================================================================

import { classifyIsabellaIntent } from "@/lib/isabella/process-intelligence/intent-contract";
import { isScreenExplanationIntent, resolveScreenArea } from "@/lib/isabella/screen-help";
import type { IsabellaRoute, IsabellaScreenContext, IsabellaSelectedNode } from "./types";

// A recommendation ask combined with a status/attention/why ask → `mixed`.
const RE_WANTS_RECOMMENDATION = /\brecommend|recomien|next (action|step)|pr[oó]ximos pasos|qu[eé] (debo|deber[ií]a) (hacer|revisar|priorizar|atender|empezar|abordar)|what should i (do|review|check|look at)|revisar primero|review first|check first/i;
const RE_WANTS_STATUS_OR_CAUSE = /what.*happen|qu[eé] .*(pasa|pasando|atenci[oó]n)|needs? attention|necesita atenci[oó]n|\bwhy\b|por qu[eé]|\bcaus/i;

const RE_PROCESS_MINING_SUBJECT = /process mining|min(?:er[ií]a|ado) de procesos|capa de procesos|canonical events?|eventos? can[oó]nicos?|event history|historial de eventos|milestone (?:process )?flow|flujo de hitos|task cases?|casos? de tarea/i;
const RE_PROCESS_MINING_FACT = /\bsummary|resumen|status|estado|how many|cu[aá]nt|count|conteo|events?|eventos?|cases?|casos?|transitions?|transiciones?|integrity|integridad|history|historial|findings?|hallazgos?|delay|retraso|rework|retrabajo|bottleneck|cuello de botella/i;

const RE_FINANCIAL_SETUP_ASK = /configuraci[oó]n financiera|financial setup|financial control|control financiero|rate cards?|tarifas?|cost model|modelo de costos?|cost plan|plan de costos?|planned hours?|horas? planificadas?|horas? por periodo|AACE|BOE|estimado financiero|financial estimate|budget lines?|l[ií]neas? de (presupuesto|costo)|cadencia|quincenal|biweekly|monthly cost|costo mensual|costo semanal|costo por persona|cost per (user|person|hour)|SAP project financial|finanzas? del proyecto/i;

export interface IsabellaRouteDecision {
  route: IsabellaRoute;
  scope: { milestoneId?: string; taskId?: string };
  /** True when the route needs a project/entity scope we cannot safely infer. */
  needsClarification: boolean;
  reason?: string;
}

/** Resolve a display-safe engine scope from the selected node (never coordinates). */
export function resolveNodeScope(node: IsabellaSelectedNode | undefined): { milestoneId?: string; taskId?: string } {
  if (!node) return {};
  if (node.type === "milestone") return { milestoneId: node.id };
  if (node.type === "task" || node.type === "subtask") return { taskId: node.id };
  return {}; // project / risk / decision / approval → project-level scope
}

/**
 * Deterministic routing. `hasProject` = a project scope is available (current
 * project or a selected node). When an engine route is chosen but no scope can be
 * inferred, we ask for clarification instead of guessing.
 */
export function routeIsabellaQuestion(
  question: string,
  opts: { hasProject: boolean; selectedNode?: IsabellaSelectedNode; screenContext?: IsabellaScreenContext },
): IsabellaRouteDecision {
  const q = (question ?? "").trim();
  const scope = resolveNodeScope(opts.selectedNode);
  const hasScope = opts.hasProject || !!opts.selectedNode;

  // ── HIGHEST PRIORITY: screen / UI-label questions ─────────────────────────
  // "Explain this screen", "what does Unassigned/Member/Permission/Access mean",
  // "qué significa …", "explain this column/field/button" are about the VISIBLE
  // screen — they MUST be answered from screen context, NEVER from the diagnosis /
  // root-cause / recommendation engines nor the factual fallback. This runs before
  // `mixed` and before intent classification so a UI-meaning ask can never leak
  // into Daily Diagnosis (the reported P0). ISABELLA-SCREEN-CONTEXT-EXPLANATION.
  if (isScreenExplanationIntent(q)) {
    const area = resolveScreenArea(opts.screenContext);
    // We have deterministic content for Resources/participants and task surfaces;
    // unknown/ambiguous screens still route here so the runtime can ask a safe
    // clarification instead of guessing another screen.
    if (area === "resources" || area === "task" || area === "process_mining" || area === "financial" || area === "unknown") {
      return { route: "screen_context_explanation", scope, needsClarification: false };
    }
    // A known-but-uncovered screen → RAG (product knowledge), never an engine.
    return { route: "product_help", scope, needsClarification: false };
  }

  // The PMO financial setup is a deterministic project-data answer, not a
  // generic project briefing. Keep explicit setup questions on the canonical
  // financial context so Isabella can describe rates, cadence, hours, BOE and
  // baseline state from the project package.
  if (RE_FINANCIAL_SETUP_ASK.test(q)) {
    return decide("financial_summary", scope, hasScope);
  }

  // Current-project Process Mining facts are deterministic aggregates from the
  // authorized Project Event Graph + Milestone Process Flow adapters. Keep
  // conceptual questions ("what is Process Mining?") in Product Brain/RAG by
  // requiring both a mining subject and an explicit data/status noun.
  if (RE_PROCESS_MINING_SUBJECT.test(q) && RE_PROCESS_MINING_FACT.test(q)) {
    return decide("process_mining_summary", scope, hasScope);
  }

  // `mixed`: a recommendation ask joined with a status/attention/why ask.
  if (RE_WANTS_RECOMMENDATION.test(q) && RE_WANTS_STATUS_OR_CAUSE.test(q)) {
    return decide("mixed", scope, hasScope);
  }

  const { category } = classifyIsabellaIntent(q);
  switch (category) {
    case "deterministic_project_report":
      return decide("factual_project_data", scope, hasScope);
    case "process_diagnosis":
    case "project_status_question":
      return decide("daily_diagnosis", scope, hasScope);
    case "root_cause_analysis":
      return decide("root_cause", scope, hasScope);
    case "recommendation_request":
      return decide("recommendation", scope, hasScope);
    case "navigation_or_how_to":
      return { route: "product_help", scope, needsClarification: false };
    case "unsupported_or_missing_context":
    default:
      // Empty/ambiguous with no scope → clarify; otherwise treat as help.
      if (!q) return { route: "product_help", scope, needsClarification: !hasScope, reason: "empty_question" };
      return { route: "product_help", scope, needsClarification: false };
  }
}

/** Engine routes require a scope; when missing, ask for clarification safely. */
function decide(route: IsabellaRoute, scope: { milestoneId?: string; taskId?: string }, hasScope: boolean): IsabellaRouteDecision {
  const needsClarification = !hasScope;
  return { route, scope, needsClarification, reason: needsClarification ? "no_project_scope" : undefined };
}

/** Whether a route uses a process-intelligence engine (vs RAG / factual query). */
export function isEngineRoute(route: IsabellaRoute): boolean {
  return route === "daily_diagnosis" || route === "root_cause" || route === "recommendation" || route === "mixed";
}
