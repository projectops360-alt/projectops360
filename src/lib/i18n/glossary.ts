// ============================================================================
// ProjectOps360° — Canonical i18n glossary (UX-012, client-safe)
// ============================================================================
// The single source of truth for approved EN/ES terminology and for the names
// that are intentionally NOT translated. Tests assert the message dictionaries
// agree with this glossary, so a label can never silently drift back into the
// wrong language ("No Spanglish"). See docs/product-brain/32-product-ux-contracts.md → UX-012.
// ============================================================================

/** Approved EN ⇄ ES terms. ES values are the CANONICAL Spanish wording. */
export interface GlossaryTerm {
  en: string;
  es: string;
}

export const CANONICAL_GLOSSARY: Record<string, GlossaryTerm> = {
  command_center: { en: "Command Center", es: "Centro de Mando" },
  planning: { en: "Planning", es: "Planificación" },
  execution: { en: "Execution", es: "Ejecución" },
  resources: { en: "Resources", es: "Recursos" },
  intelligence: { en: "Intelligence", es: "Inteligencia" },
  technical_bim: { en: "Technical / BIM", es: "Técnico / BIM" },
  workboard: { en: "Workboard", es: "Tablero de Trabajo" },
  execution_map: { en: "Execution Map", es: "Mapa de Ejecución" },
  project_memory: { en: "Project Memory", es: "Memoria del Proyecto" },
  closeout_report: { en: "Closeout Report", es: "Reporte de Cierre" },
  team_and_roles: { en: "Team & Roles", es: "Equipo y Roles" },
  // Canonical choice: keep "Stakeholders" — standard in PM Spanish (UX-012 / TASK 4).
  stakeholders: { en: "Stakeholders", es: "Stakeholders" },
  owner: { en: "Owner", es: "Responsable" },
  planned_start: { en: "Planned Start", es: "Inicio planificado" },
  planned_finish: { en: "Planned Finish", es: "Fin planificado" },
  blocked: { en: "Blocked", es: "Bloqueado" },
  waiting: { en: "Waiting", es: "En espera" },
  in_progress: { en: "In Progress", es: "En progreso" },
  completed: { en: "Completed", es: "Completado" },
};

/**
 * Product names that are CANONICAL and intentionally identical in every locale —
 * an EN value === ES value for these is correct, never Spanglish.
 */
export const CANONICAL_PRODUCT_NAMES = [
  "ProjectOps360°",
  "ProjectOps360",
  "Isabella",
  "Rythm",
  "Rhythm Center",
  "Product Brain",
  "Product Intelligence",
  "Living Graph",
  "ProjectOps Scribe",
  "Scribe",
  "Knowledge OS",
  "Workboard",
  "Roadmap",
  "Sprint",
  // Canonical term kept verbatim in Spanish (standard in PM Spanish — UX-012).
  "Stakeholders",
] as const;

/** Technical acronyms allowed verbatim in any language. */
export const ALLOWED_ACRONYMS = [
  "PMO", "BIM", "RACI", "KPI", "PDF", "API", "RFI", "WBS", "CPM", "SOP", "BIM",
  "AI", "IA", "URL", "ID", "CSV", "XLSX", "ZIP",
] as const;

/**
 * The reviewer-flagged, high-visibility labels that MUST stay correctly
 * translated. Keyed by their message-dictionary path so the regression test can
 * assert messages/en.json and messages/es.json agree with the glossary. If any
 * of these is reverted to the wrong language, the test fails (UX-012).
 */
export const PROTECTED_MESSAGE_LABELS: Record<string, GlossaryTerm> = {
  "projectTabs.workboard": CANONICAL_GLOSSARY.workboard,
  "projectTabs.projectMemory": CANONICAL_GLOSSARY.project_memory,
  "nav.commandCenter": CANONICAL_GLOSSARY.command_center,
  "nav.executionMap": CANONICAL_GLOSSARY.execution_map,
  "projectTabs.executionMap": CANONICAL_GLOSSARY.execution_map,
  "livingGraph.backToExecutionMap": CANONICAL_GLOSSARY.execution_map,
  "roadmap.status.blocked": CANONICAL_GLOSSARY.blocked,
  "roadmap.status.in_progress": CANONICAL_GLOSSARY.in_progress,
};

/** True when an identical EN/ES value is legitimate (product name or acronym). */
export function isCanonicalUntranslatable(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if ((CANONICAL_PRODUCT_NAMES as readonly string[]).some((n) => v === n)) return true;
  if ((ALLOWED_ACRONYMS as readonly string[]).includes(v)) return true;
  // Pure acronym/symbol/number strings (e.g. "PDF", "API", "{count}") are fine.
  if (/^[A-Z0-9%#@.\-\/{}\s]+$/.test(v)) return true;
  return false;
}
