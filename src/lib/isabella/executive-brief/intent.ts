// ============================================================================
// ProjectOps360° — Isabella Executive Brief · intent detection (pure)
// ============================================================================
// REG-023 / ISABELLA-EXECUTIVE-BRIEF
//
// Detects PM-level, PROJECT-scoped goals in a question — bilingual, cue-based
// and multi-intent ("give me a project summary AND today's risks" → both).
// Same deterministic pattern as the query-engine parser and the PI router:
// generic linguistic cues, never per-phrase hardcoded answers.
//
// Deliberately NOT detected (existing owners keep them):
//   • task/entity reports ("resumen de tareas por estado") → query engine
//   • definitions/how-to ("qué es un riesgo") → knowledge corpus
//   • pure recommendation asks ("qué debería resolver primero") → PI engine
// ============================================================================

export interface ExecutiveIntents {
  projectSummary: boolean;
  riskOutlook: boolean;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").trim();
}

// Definition / how-to questions are knowledge questions, never data briefs.
// (Plural "what are the risks / cuáles son los riesgos" is a DATA ask and does
// not match these singular-definition shapes.)
const RE_DEFINITION =
  /\bque\s+es\b|\bwhat\s+is\b|\bque\s+significa\b|\bwhat\s+does\b.*\bmean\b|\bcomo\s+(se|funciona|puedo|hago|abro|creo|registro)\b|\bhow\s+(do|does|to|can)\b/;
// …except when "what is / cuál es" asks for the PROJECT's status/health/summary
// ("what is the project health?") — that is a DATA ask, not a definition.
const RE_STATUS_ASK_EXCEPTION =
  /\b(what\s+is|cual\s+es)\b[^.?!]{0,30}\b(salud|estado|status|health|resumen|summary|overview)\b[^.?!]{0,40}\b(proyecto|project)\b|\b(what\s+is|cual\s+es)\b[^.?!]{0,10}\b(the\s+)?(proyecto|project)('s)?\s+(salud|estado|status|health|resumen|summary|overview)\b/;

// ── Project summary / health / status (the PROJECT is the subject) ───────────
const RE_SUMMARY_PROJECT =
  /\b(resumen|summary|overview|brief(ing)?|estado|status|salud|health)\b[^.?!]{0,40}\b(proyecto|project)\b|\b(proyecto|project)\b[^.?!]{0,40}\b(resumen|summary|overview|status|estado|salud|health)\b/;
const RE_SUMMARY_HOW_GOING =
  /\bcomo\s+(esta|va|vamos|estamos|marcha)\b|\bhow\s+(is|are)\s+(the\s+)?(project|we)\b|\bhow('s|s)?\s+the\s+project\b|\bhow\s+are\s+we\s+doing\b/;
const RE_SUMMARY_ATTENTION =
  /\brequieren?\s+atencion\b|\bnecesitan?\s+atencion\b|\bneeds?\s+attention\b|\brequires?\s+attention\b/;
const RE_SUMMARY_RECENT_CHANGES =
  /\bque\s+cambio\b|\bque\s+ha\s+cambiado\b|\bcambios\s+recientes\b|\bwhat\s+(has\s+)?changed\b|\brecent\s+changes\b/;

// ── Risk outlook (registered risks + operational risk signals) ───────────────
const RE_RISK_NOUN = /\briesgos?\b|\brisks?\b/;
const RE_RISK_JEOPARDY =
  /\bque\s+puede\s+(impedir|salir\s+mal|fallar|atrasar|retrasar)\b|\bwhat\s+(could|can|might)\s+(go\s+wrong|prevent|stop|delay|jeopardi[sz]e)\b|\bjeopardi[sz]e\b/;
const RE_RISK_MISS =
  /\ben\s+riesgo\s+de\b|\bat\s+risk\s+of\b|\bincumplir\b[^.?!]{0,30}\b(milestone|hito|plazo|fecha|deadline)\b|\bmiss\b[^.?!]{0,20}\b(a|the|any)?\s*(milestone|deadline)\b/;
const RE_RISK_ON_TIME =
  /\bterminar\s+a\s+tiempo\b|\bacabar\s+a\s+tiempo\b|\bfinish\s+on\s+time\b|\bon\s+schedule\b|\ba\s+tiempo\s*\??\s*$/;

/**
 * Detect executive project-level goals. Empty/definition questions detect
 * nothing (the caller falls through to the existing pipeline unchanged).
 */
export function detectExecutiveIntents(text: string): ExecutiveIntents {
  const q = norm(text ?? "");
  const none: ExecutiveIntents = { projectSummary: false, riskOutlook: false };
  if (!q) return none;
  if (RE_DEFINITION.test(q) && !RE_STATUS_ASK_EXCEPTION.test(q)) return none;

  const projectSummary =
    RE_SUMMARY_PROJECT.test(q) ||
    RE_SUMMARY_HOW_GOING.test(q) ||
    RE_SUMMARY_ATTENTION.test(q) ||
    RE_SUMMARY_RECENT_CHANGES.test(q);

  const riskOutlook =
    RE_RISK_NOUN.test(q) || RE_RISK_JEOPARDY.test(q) || RE_RISK_MISS.test(q) || RE_RISK_ON_TIME.test(q);

  return { projectSummary, riskOutlook };
}

/** True when at least one executive goal was detected. */
export function hasExecutiveIntent(intents: ExecutiveIntents): boolean {
  return intents.projectSummary || intents.riskOutlook;
}

/** Structured goal list for observability/audit. */
export function intentGoals(intents: ExecutiveIntents): string[] {
  const goals: string[] = [];
  if (intents.projectSummary) goals.push("project_summary");
  if (intents.riskOutlook) goals.push("risk_outlook");
  return goals;
}
