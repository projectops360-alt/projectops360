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
