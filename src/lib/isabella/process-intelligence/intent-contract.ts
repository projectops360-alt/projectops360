// ============================================================================
// ProjectOps360° — Isabella Process Intelligence · intent contract
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT
//
// Classifies WHAT the user is asking so the deterministic-project-data policy
// can fire BEFORE any generic LLM reasoning. The deterministic-report anchor
// REUSES the shipped `detectTaskReportIntent` (ISABELLA-TASK-REPORT-VERIFIED-
// PROJECT-DATA) — this contract never re-implements it. Pure + deterministic.
//
// NOTE: this classifier is a CONTRACT, not yet wired into the live Isabella
// flow — Phase 5 · Task 2 (retrieval layer) is where it gets consumed. The
// unimplemented categories (diagnosis/root-cause/recommendation) are declared
// here as placeholders; their ENGINES are explicitly NOT built in this task.
// ============================================================================

import { detectTaskReportIntent, type TaskReportIntent } from "@/lib/isabella/task-report";
import type { IsabellaIntentCategory } from "./types";

export interface IntentCategoryContract {
  category: IsabellaIntentCategory;
  examples: string[];
  behavior: string;
  /** Whether the behavior is implemented today or reserved for a later task. */
  implemented: boolean;
}

export const INTENT_CATEGORY_CONTRACT: Record<IsabellaIntentCategory, IntentCategoryContract> = {
  deterministic_project_report: {
    category: "deterministic_project_report",
    examples: [
      // The exact reported blocker (mixed Spanish, typo) MUST be represented.
      "isabell anecesito un reporte con todas la tareas por title ordenado por desc",
      "reporte con todas las tareas por title desc",
      "reporte de tareas",
      "list all blocked tasks",
      "show tasks by priority",
      "dame las tareas de Phase 5",
    ],
    behavior:
      "Retrieve deterministic authorized data; sort/filter deterministically; produce a VERIFIED report; never a generic 'no verified answer' when the data exists.",
    implemented: true, // via ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA
  },
  project_status_question: {
    category: "project_status_question",
    examples: ["how is this project doing?", "¿qué está bloqueando el proyecto?", "estado del proyecto"],
    behavior: "Use approved status/graph/context evidence; cite key facts; include uncertainty.",
    implemented: true, // partially, via the REG-013 deterministic briefing
  },
  process_diagnosis: {
    category: "process_diagnosis",
    examples: ["diagnose today's execution health", "¿en qué debo enfocarme hoy?", "what should I focus on today?"],
    behavior: "Future Daily Diagnosis Engine; must cite evidence and uncertainty.",
    implemented: false,
  },
  root_cause_analysis: {
    category: "root_cause_analysis",
    examples: ["why is this milestone delayed?", "¿por qué está retrasado este hito?", "what is causing the blockage?"],
    behavior: "Future Root Cause Engine; distinguish symptoms from causes; cite evidence + confidence.",
    implemented: false,
  },
  recommendation_request: {
    category: "recommendation_request",
    examples: ["what should I do next?", "recommend next actions", "¿cuáles son los próximos pasos?"],
    behavior: "Future Recommendation Engine; evidence-backed, prioritized actions.",
    implemented: false,
  },
  navigation_or_how_to: {
    category: "navigation_or_how_to",
    examples: ["where can I see dependencies?", "how do I open Subtask Map?", "¿dónde veo el mapa de subtareas?"],
    behavior: "Answer from product knowledge/docs; include current context when project-specific.",
    implemented: true, // via the existing Knowledge OS corpus
  },
  unsupported_or_missing_context: {
    category: "unsupported_or_missing_context",
    examples: ["(no project selected)", "(asks for an unavailable source)", "(unauthorized)"],
    behavior: "Ask for clarification or safely deny; never hallucinate.",
    implemented: true,
  },
};

const RE_ROOT_CAUSE = /\bwhy\b|por qu[eé]|\bcaus(a|e|ing|ando)\b|root cause|raíz|origen del (retraso|bloqueo)/i;
const RE_RECOMMEND = /\brecommend|recomien|next (action|step)|pr[oó]ximos pasos|qu[eé] (debo|deber[ií]a) hacer|what should i do/i;
const RE_DIAGNOSIS = /\bdiagnos|health (today|of)|focus (today|on)|enfocar(me)? hoy|salud (de hoy|del proyecto hoy)/i;
const RE_STATUS = /how is (this|the) project|c[oó]mo va|estado del proyecto|project status|qu[eé] (est[aá]|hay) bloque/i;
const RE_NAV = /\bwhere\b|how do i|d[oó]nde (veo|puedo|est[aá])|c[oó]mo (abro|accedo|veo|navego)/i;

export interface IsabellaIntentClassification {
  category: IsabellaIntentCategory;
  /** Present ONLY for deterministic_project_report — the parsed sort request. */
  deterministic: TaskReportIntent | null;
}

/**
 * Deterministic, conservative intent classification. Order matters: a concrete
 * task-report request wins first (so the deterministic policy always fires),
 * then explicit reasoning intents, then navigation, defaulting to a status
 * question. Empty input → unsupported/missing context.
 */
export function classifyIsabellaIntent(rawQuery: string): IsabellaIntentClassification {
  const q = (rawQuery ?? "").trim();
  if (!q) return { category: "unsupported_or_missing_context", deterministic: null };

  const report = detectTaskReportIntent(q);
  if (report) return { category: "deterministic_project_report", deterministic: report };

  if (RE_ROOT_CAUSE.test(q)) return { category: "root_cause_analysis", deterministic: null };
  if (RE_RECOMMEND.test(q)) return { category: "recommendation_request", deterministic: null };
  if (RE_DIAGNOSIS.test(q)) return { category: "process_diagnosis", deterministic: null };
  if (RE_NAV.test(q)) return { category: "navigation_or_how_to", deterministic: null };
  if (RE_STATUS.test(q)) return { category: "project_status_question", deterministic: null };

  return { category: "project_status_question", deterministic: null };
}

/**
 * The deterministic-project-data policy, encoded. When true, Isabella MUST use
 * approved deterministic retrieval — never generic LLM reasoning and never a
 * "no verified answer" fallback when the data exists.
 */
export function requiresDeterministicRetrieval(category: IsabellaIntentCategory): boolean {
  return category === "deterministic_project_report";
}
