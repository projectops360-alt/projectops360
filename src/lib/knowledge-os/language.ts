// ============================================================================
// ProjectOps360° — Knowledge OS — Language Intelligence Layer
// ============================================================================
// Sits BEFORE retrieval. Responsibilities:
//   • Normalize project-management terminology (accent/case-insensitive).
//   • Expand bilingual EN/ES synonyms + acronyms so a query in one language can
//     match knowledge in either language (lexical recall booster).
// It does NOT translate, duplicate, or store anything. One Knowledge OS.
//
// Retrieval itself is made multilingual by searching the whole corpus (no
// single-language filter); this layer adds terminology/synonym recall on top.
//
// The dictionary is EXTENSIBLE: add a group to PM_SYNONYM_GROUPS. Each group is
// a set of equivalent terms across languages/abbreviations.
// ============================================================================

/** Equivalent project-management terms across EN/ES + common abbreviations. */
export const PM_SYNONYM_GROUPS: string[][] = [
  ["project manager", "pm", "gerente de proyecto", "jefe de proyecto", "project lead", "líder de proyecto", "director de proyecto"],
  ["pmo", "project management office", "oficina de gestión de proyectos", "oficina de proyectos"],
  ["portfolio manager", "gerente de portafolio", "director de portafolio"],
  ["team member", "contributor", "miembro del equipo", "colaborador", "contribuyente"],
  ["stakeholder", "stakeholders", "interesado", "parte interesada"],
  ["organization", "organización", "company", "empresa", "workspace", "espacio de trabajo"],
  ["permission", "permissions", "permiso", "permisos", "access", "acceso"],
  ["role", "roles", "rol", "roles"],
  ["risk", "riesgo", "riesgos"],
  ["issue", "incidencia", "incidencias"],
  ["problem", "problema", "problemas"],
  ["task", "tarea", "tareas", "actividad", "actividades"],
  ["milestone", "hito", "hitos"],
  ["wbs", "work breakdown structure", "edt", "estructura de desglose del trabajo"],
  ["schedule", "cronograma", "calendario"],
  ["budget", "presupuesto"],
  ["cost", "costo", "coste", "costos"],
  ["resource capacity", "capacidad de recursos", "capacity", "capacidad"],
  ["approval", "approvals", "aprobación", "aprobaciones"],
  ["deliverable", "entregable", "entregables"],
  ["scope", "alcance"],
  ["project", "proyecto", "proyectos"],
  ["view", "see", "ver", "visualizar", "consultar"],
  ["create", "crear", "add", "agregar", "añadir"],
  ["assign", "asignar", "assignment", "asignación"],
  ["restrict", "restringir", "limit", "limitar"],
];

// ── Conversation language detection ─────────────────────────────────────────
// Phase 1.2: the CONVERSATION language must follow the user's latest message,
// not the UI locale. A user may run the UI in English yet ask in Spanish (or
// vice versa) and Isabella must reply in the language they actually wrote.
//
// Lightweight, dependency-free heuristic: Spanish-only characters are a hard
// signal; otherwise we score high-frequency stopwords for each language. Short
// or ambiguous inputs return null so the caller keeps the current language.

const ES_STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "que",
  "qué", "cómo", "como", "por", "para", "con", "sin", "esta", "este", "esto",
  "esa", "ese", "eso", "pantalla", "puedo", "puede", "quiero", "necesito",
  "dónde", "donde", "cuándo", "cuando", "porqué", "porque", "es", "son", "está",
  "están", "hacer", "tengo", "mi", "tu", "su", "y", "o", "pero", "más", "muy",
  "ayuda", "ayúdame", "explícame", "explicame", "muéstrame", "muestrame",
  "usuario", "usuarios", "equipo", "proyecto", "permisos", "rol", "roles",
]);

const EN_STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "with", "without", "this",
  "that", "these", "those", "what", "how", "why", "where", "when", "who", "is",
  "are", "do", "does", "can", "could", "should", "would", "i", "you", "my",
  "your", "and", "or", "but", "more", "help", "explain", "show", "screen",
  "user", "users", "team", "project", "permission", "permissions", "role",
]);

/**
 * Detect whether a free-text message is Spanish or English. Returns the detected
 * `Locale` or `null` when there is not enough signal (too short / ambiguous) so
 * the caller can keep the conversation in its current language.
 */
export function detectLanguage(text: string): "en" | "es" | null {
  const raw = (text || "").trim();
  if (raw.length < 3) return null;

  // Hard signal: characters that only appear in Spanish.
  if (/[ñ¿¡]/.test(raw) || /[áéíóúü]/i.test(raw)) return "es";

  const words = normalizeTerm(raw).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return null;

  let es = 0;
  let en = 0;
  for (const w of words) {
    if (ES_STOPWORDS.has(w)) es++;
    if (EN_STOPWORDS.has(w)) en++;
  }

  if (es === en) return null; // ambiguous — keep current language
  return es > en ? "es" : "en";
}

/** Lowercase + strip diacritics for accent/case-insensitive matching. */
export function normalizeTerm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Precompute normalized groups once.
const NORMALIZED_GROUPS: { norm: string[]; original: string[] }[] = PM_SYNONYM_GROUPS.map(
  (group) => ({ norm: group.map(normalizeTerm), original: group }),
);

/**
 * Expand a query with PM synonyms/acronyms for LEXICAL search. For every group
 * with a term appearing in the query, append the group's other terms. Vector
 * search uses the RAW query (embeddings already capture cross-language meaning);
 * only the lexical half consumes this expansion.
 *
 * Because the lexical RPC now uses OR semantics, appended terms can only ADD
 * recall — they never over-constrain the match.
 */
export function expandQueryForLexical(query: string): string {
  const norm = normalizeTerm(query);
  const additions = new Set<string>();

  for (const group of NORMALIZED_GROUPS) {
    const hit = group.norm.some((term) => containsTerm(norm, term));
    if (!hit) continue;
    for (const original of group.original) {
      if (!containsTerm(norm, normalizeTerm(original))) additions.add(original);
    }
  }

  if (additions.size === 0) return query;
  return `${query} ${Array.from(additions).join(" ")}`;
}

/** Word-aware containment so short acronyms (PM) don't match inside words. */
function containsTerm(haystackNorm: string, termNorm: string): boolean {
  if (!termNorm) return false;
  if (termNorm.includes(" ")) return haystackNorm.includes(termNorm); // multi-word phrase
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(termNorm)}([^a-z0-9]|$)`).test(haystackNorm);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
