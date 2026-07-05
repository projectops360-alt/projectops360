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
import type { IsabellaRoute, IsabellaSelectedNode } from "./types";

// A recommendation ask combined with a status/attention/why ask → `mixed`.
const RE_WANTS_RECOMMENDATION = /\brecommend|recomien|next (action|step)|pr[oó]ximos pasos|qu[eé] (debo|deber[ií]a) hacer|what should i do/i;
const RE_WANTS_STATUS_OR_CAUSE = /what.*happen|qu[eé] .*(pasa|pasando|atenci[oó]n)|needs? attention|necesita atenci[oó]n|\bwhy\b|por qu[eé]|\bcaus/i;

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
  opts: { hasProject: boolean; selectedNode?: IsabellaSelectedNode },
): IsabellaRouteDecision {
  const q = (question ?? "").trim();
  const scope = resolveNodeScope(opts.selectedNode);
  const hasScope = opts.hasProject || !!opts.selectedNode;

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
