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
    examples: [
      "where can I see dependencies?",
      "how do I open Subtask Map?",
      "¿dónde veo el mapa de subtareas?",
      // Knowledge / "how it works" questions — the conservative default; these
      // MUST reach the Knowledge OS, never Daily Diagnosis (ISABELLA-INTENT-
      // FALLBACK-TO-KNOWLEDGE).
      "how does the Living Graph work?",
      "¿cómo funciona el Living Graph?",
      "what is the Execution Map?",
      "¿qué es el Execution Map?",
      "¿para qué sirve el Workboard?",
    ],
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

// Root cause = a "why / por qué" (or explicit cause phrasing) about a PROBLEM
// (delay, blockage, stuck, at-risk). It must NOT swallow a generic knowledge
// question such as "why is it called Living Graph?" / "¿por qué se llama …?",
// which belongs to the Knowledge OS (navigation_or_how_to), not an engine.
const RE_ROOT_CAUSE =
  /(?:\bwhy\b|por qu[eé]).*(delayed?|blocked?|blockage|stuck|behind|slipp?|at risk|en riesgo|off track|retras|bloque|atasc|detenid|par[ao]d|estancad)|root cause|causa ra[ií]z|origen del (?:retraso|bloqueo)|caus(?:a|e|ing|ando)\b.*(delayed?|blocked?|blockage|stuck|retras|bloque|atasc)/i;
const RE_RECOMMEND = /\brecommend|recomien|next (action|step)|pr[oó]ximos pasos|qu[eé] (debo|deber[ií]a) (hacer|revisar|priorizar|atender|empezar|abordar)|what should i (do|review|check|look at)|revisar primero|review first|check first|d[oó]nde empiezo|where (do i|to) start/i;
const RE_DIAGNOSIS = /\bdiagnos|health (today|of)|focus (today|on)|enfocar(me)? hoy|salud (de hoy|del proyecto hoy)/i;
// Status = "how the project is doing / what is happening / what needs attention"
// (all route to Daily Diagnosis). Kept explicit because the conservative default
// is now the Knowledge OS, not this engine — genuine status asks must match here.
const RE_STATUS = /how is (this|the) project|c[oó]mo va|estado del proyecto|project status|qu[eé] (est[aá]|hay) bloque|what.*happen|qu[eé] .*(pasa|pasando)|\bwhat needs\b|qu[eé] necesita|needs? attention|necesita atenci[oó]n/i;
// Navigation / how-to / knowledge. Beyond "where/how do I …" this also covers
// "how it works" and "what is / what does … do / explain / para qué sirve"
// knowledge questions so they reach the Knowledge OS (RAG), never Daily
// Diagnosis. The negative lookaheads keep "what is happening/going" out (that is
// a status ask handled by RE_STATUS above). ISABELLA-INTENT-FALLBACK-TO-KNOWLEDGE.
const RE_NAV = /\bwhere\b|how do i|how does\b.*\bwork|c[oó]mo funciona|c[oó]mo se (usa|utiliza|hace)|d[oó]nde (veo|puedo|est[aá])|c[oó]mo (abro|accedo|veo|navego|agrego|agregar|a[nñ]ado|a[nñ]adir|creo|crear|hago|hacer|configuro|configurar|invito|invitar|asigno|asignar|edito|editar|elimino|eliminar)|para qu[eé] sirve|qu[eé] es\b|what is\b(?!\s+(?:happening|going))|qu[eé] hace\b|what does\b.*\bdo\b|\bexplica(?:me)?\b|\bexplain\b/i;

export interface IsabellaIntentClassification {
  category: IsabellaIntentCategory;
  /** Present ONLY for deterministic_project_report — the parsed sort request. */
  deterministic: TaskReportIntent | null;
}

/**
 * Deterministic, conservative intent classification. Order matters: a concrete
 * task-report request wins first (so the deterministic policy always fires),
 * then explicit reasoning intents, then navigation/knowledge, then status.
 *
 * The conservative DEFAULT is `navigation_or_how_to` (→ Knowledge OS / RAG), not
 * a status engine: an unclassified question ("how does the Living Graph work?")
 * must be answered from product knowledge, never routed to Daily Diagnosis.
 * ISABELLA-INTENT-FALLBACK-TO-KNOWLEDGE. Empty input → unsupported/missing context.
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

  return { category: "navigation_or_how_to", deterministic: null };
}

/**
 * The deterministic-project-data policy, encoded. When true, Isabella MUST use
 * approved deterministic retrieval — never generic LLM reasoning and never a
 * "no verified answer" fallback when the data exists.
 */
export function requiresDeterministicRetrieval(category: IsabellaIntentCategory): boolean {
  return category === "deterministic_project_report";
}
