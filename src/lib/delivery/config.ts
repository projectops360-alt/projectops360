// ============================================================================
// ProjectOps360° — Adaptive Delivery Framework configuration (pure data)
// ============================================================================
// Project-agnostic by default. Software terminology only appears for the
// software project type. Shared by server (recommendation) and client (wizard).
// ============================================================================

export type DeliveryMethod =
  | "predictive"
  | "agile"
  | "scrum"
  | "kanban"
  | "hybrid"
  | "xp"
  /**
   * SAP Activate. Not "predictive with SAP words": it is phase-gated like a
   * predictive plan, but each phase runs iteratively (fit-to-standard
   * workshops, build sprints, test cycles) and cannot close until its quality
   * gate is passed. Neither `predictive` nor `hybrid` carries the gates, so a
   * plan imported from a real SAP programme had nowhere to say what governs it.
   */
  | "sap_activate";

export interface Opt { value: string; es: string; en: string; }
export interface BiText { es: string; en: string; }

export const PROJECT_TYPES: Opt[] = [
  { value: "software", es: "Software / Desarrollo de producto", en: "Software / Product Development" },
  { value: "data_bi", es: "Datos / BI / Analítica", en: "Data / BI / Analytics" },
  { value: "erp", es: "ERP / Implementación de sistemas", en: "ERP / System Implementation" },
  { value: "construction", es: "Construcción / Ejecución en campo", en: "Construction / Field Execution" },
  { value: "operations", es: "Operaciones / Capacitación", en: "Operations / Training" },
  { value: "process", es: "Mejora de procesos", en: "Process Improvement" },
  { value: "procurement", es: "Proveedores / Adquisiciones", en: "Vendor / Procurement" },
  { value: "marketing", es: "Marketing / Lanzamiento", en: "Marketing / Launch" },
  { value: "compliance", es: "Cumplimiento / Regulatorio", en: "Compliance / Regulatory" },
  { value: "general", es: "Proyecto de negocio general", en: "General Business Project" },
];

/**
 * The product an implementation runs on.
 *
 * Asked ONLY for implementation-type projects, and only because a methodology
 * can belong to a vendor: SAP Activate is SAP's. Without this the engine would
 * have to infer the vendor from "ERP / System Implementation", which is exactly
 * how an Oracle customer gets told to follow SAP's methodology.
 *
 * "" (unanswered) is a first-class value: not knowing must stay distinguishable
 * from knowing it is not SAP.
 */
export const PLATFORMS: Opt[] = [
  { value: "sap", es: "SAP", en: "SAP" },
  { value: "oracle", es: "Oracle", en: "Oracle" },
  { value: "dynamics", es: "Microsoft Dynamics", en: "Microsoft Dynamics" },
  { value: "salesforce", es: "Salesforce", en: "Salesforce" },
  { value: "workday", es: "Workday", en: "Workday" },
  { value: "other", es: "Otra / A medida", en: "Other / Custom" },
];

/** Project types where asking which platform is meaningful. */
export const PLATFORM_RELEVANT_TYPES = ["erp", "data_bi"];

export const UNCERTAINTY: Opt[] = [
  { value: "low", es: "Baja: alcance claro y estable", en: "Low: scope is clear and stable" },
  { value: "medium", es: "Media: se esperan algunos cambios", en: "Medium: some changes are expected" },
  { value: "high", es: "Alta: los requisitos evolucionarán mucho", en: "High: requirements will evolve significantly" },
];

export const GOVERNANCE: Opt[] = [
  { value: "light", es: "Ligera", en: "Light" },
  { value: "moderate", es: "Moderada", en: "Moderate" },
  { value: "high", es: "Alta", en: "High" },
  { value: "regulatory", es: "Regulatoria / cumplimiento intenso", en: "Regulatory / Compliance-heavy" },
];

export const CADENCE: Opt[] = [
  { value: "continuous", es: "Flujo continuo", en: "Continuous flow" },
  { value: "weekly", es: "Ciclos semanales", en: "Weekly cycles" },
  { value: "biweekly", es: "Ciclos de dos semanas", en: "Two-week cycles" },
  { value: "monthly", es: "Ciclos mensuales", en: "Monthly cycles" },
  { value: "phase", es: "Entrega por fases", en: "Phase-based delivery" },
  { value: "custom", es: "Personalizado", en: "Custom" },
];

export const FEEDBACK_FREQ: Opt[] = [
  { value: "continuous", es: "Continua", en: "Continuous" },
  { value: "weekly", es: "Semanal", en: "Weekly" },
  { value: "every_cycle", es: "Cada ciclo", en: "Every cycle" },
  { value: "monthly", es: "Mensual", en: "Monthly" },
  { value: "milestones", es: "En hitos principales", en: "At major milestones" },
  { value: "close", es: "Solo al cierre", en: "At project close only" },
];

export const DOCUMENTATION: Opt[] = [
  { value: "light", es: "Documentación ligera", en: "Light documentation" },
  { value: "moderate", es: "Documentación moderada", en: "Moderate documentation" },
  { value: "comprehensive", es: "Documentación exhaustiva", en: "Comprehensive documentation" },
  { value: "regulatory", es: "Documentación regulatoria requerida", en: "Regulatory documentation required" },
];

export const CHANGE_CONTROL: Opt[] = [
  { value: "none", es: "No requerido", en: "Not required" },
  { value: "recommended", es: "Recomendado", en: "Recommended" },
  { value: "major", es: "Requerido para cambios mayores", en: "Required for major changes" },
  { value: "all", es: "Requerido para todo cambio de alcance/presupuesto/cronograma", en: "Required for all scope, budget, or schedule changes" },
];

export const VENDOR_DEP: Opt[] = [
  { value: "none", es: "Ninguna", en: "None" },
  { value: "low", es: "Baja", en: "Low" },
  { value: "medium", es: "Media", en: "Medium" },
  { value: "high", es: "Alta", en: "High" },
];

// ── Delivery methods ────────────────────────────────────────────────────────

export const DELIVERY_METHODS: Record<DeliveryMethod, { es: string; en: string; descEs: string; descEn: string }> = {
  predictive: { es: "Predictivo / Cascada", en: "Predictive / Waterfall", descEs: "Alcance claro, fases definidas, entregas formales, documentación fuerte y control de cambios.", descEn: "Clear scope, defined phases, formal handoffs, strong documentation and change control." },
  agile: { es: "Ágil / Adaptativo", en: "Agile / Adaptive", descEs: "Alcance incierto, retroalimentación frecuente, mejora iterativa y entregables que evolucionan.", descEn: "Uncertain scope, frequent feedback, iterative improvement and evolving deliverables." },
  scrum: { es: "Estilo Scrum", en: "Scrum-style Execution", descEs: "Equipos en ciclos fijos, planificación por backlog, revisiones y lecciones aprendidas regulares.", descEn: "Teams in fixed cycles, backlog planning, regular reviews and lessons-learned." },
  kanban: { es: "Flujo Kanban", en: "Kanban Flow", descEs: "Trabajo continuo, colas de solicitudes, control de WIP y priorización continua.", descEn: "Continuous work, request queues, WIP control and continuous prioritization." },
  hybrid: { es: "Híbrido Adaptativo", en: "Hybrid Adaptive", descEs: "Gobernanza y control formal con ejecución adaptativa por ciclos. Ideal para proyectos complejos.", descEn: "Formal governance and control with adaptive cycle-based execution. Ideal for complex projects." },
  xp: { es: "Prácticas técnicas (XP)", en: "XP-inspired Practices", descEs: "Prácticas técnicas para software/datos: pruebas primero, integración continua, refactorización.", descEn: "Technical practices for software/data: test-first, continuous integration, refactoring." },
  sap_activate: { es: "SAP Activate", en: "SAP Activate", descEs: "Implementación SAP por fases con quality gates: preparación, exploración (fit-to-standard), realización por ciclos, despliegue, salida en vivo y soporte. Cada fase cierra con un gate formal.", descEn: "Phase-gated SAP implementation: prepare, explore (fit-to-standard), iterative realize, deploy, go-live and run. Each phase closes with a formal quality gate." },
};

// ── SAP Activate phases and quality gates ───────────────────────────────────
// The methodology's own structure, kept as pure data so the engine, the UI and
// the importer all read the same definition rather than three near-copies.

export interface SapActivatePhase {
  key: string;
  es: string;
  en: string;
  /** What the phase must produce before its gate can be assessed. */
  exitCriteriaEs: string;
  exitCriteriaEn: string;
  /** The gate that closes the phase. Q-Gates are SAP's own naming. */
  gate: { key: string; es: string; en: string };
}

export const SAP_ACTIVATE_PHASES: SapActivatePhase[] = [
  {
    key: "discover",
    es: "Descubrimiento",
    en: "Discover",
    exitCriteriaEs: "Caso de negocio, alcance preliminar y estrategia de adopción acordados.",
    exitCriteriaEn: "Business case, preliminary scope and adoption strategy agreed.",
    gate: { key: "q0", es: "Q0 — Decisión de inversión", en: "Q0 — Investment decision" },
  },
  {
    key: "prepare",
    es: "Preparación",
    en: "Prepare",
    exitCriteriaEs: "Gobierno, equipo, plan base, entornos y estándares de entregables aprobados.",
    exitCriteriaEn: "Governance, team, baseline plan, environments and deliverable standards approved.",
    gate: { key: "q1", es: "Q1 — Cierre de preparación", en: "Q1 — Prepare gate" },
  },
  {
    key: "explore",
    es: "Exploración",
    en: "Explore",
    exitCriteriaEs: "Fit-to-standard completado; brechas identificadas, valoradas y decididas; backlog de configuración aprobado.",
    exitCriteriaEn: "Fit-to-standard complete; gaps identified, sized and decided; configuration backlog approved.",
    gate: { key: "q2", es: "Q2 — Cierre de exploración", en: "Q2 — Explore gate" },
  },
  {
    key: "realize",
    es: "Realización",
    en: "Realize",
    exitCriteriaEs: "Configuración y desarrollos construidos y probados; migración de datos ensayada; pruebas integrales firmadas.",
    exitCriteriaEn: "Configuration and developments built and tested; data migration rehearsed; integration testing signed off.",
    gate: { key: "q3", es: "Q3 — Cierre de realización", en: "Q3 — Realize gate" },
  },
  {
    key: "deploy",
    es: "Despliegue",
    en: "Deploy",
    exitCriteriaEs: "Cutover ensayado, criterios de salida en vivo verificados, soporte y plan de reversión listos.",
    exitCriteriaEn: "Cutover rehearsed, go-live criteria verified, support and rollback plan ready.",
    gate: { key: "q4", es: "Q4 — Autorización de salida en vivo", en: "Q4 — Go-live authorisation" },
  },
  {
    key: "run",
    es: "Soporte a la operación",
    en: "Run",
    exitCriteriaEs: "Hypercare cerrado, incidencias estabilizadas y operación transferida.",
    exitCriteriaEn: "Hypercare closed, incidents stabilised and operations handed over.",
    gate: { key: "q5", es: "Q5 — Transición a operación", en: "Q5 — Transition to operations" },
  },
];

// ── Board templates by framework / project type ─────────────────────────────

export const BOARD_TEMPLATES: Record<string, string[]> = {
  generic: ["Backlog", "Ready", "In Progress", "In Review", "Blocked", "Done", "Accepted"],
  hybrid: ["Proposed", "Approved", "Ready", "In Progress", "In Validation", "Stakeholder Review", "Done", "Closed"],
  data_bi: ["Requested", "Requirements", "Data Exploration", "Development", "Validation", "UAT", "Published", "Closed"],
  construction: ["Planned", "Ready for Field", "In Progress", "Inspection Required", "Rework Required", "Approved", "Closed"],
  erp: ["Requirement", "Configuration", "Testing", "UAT", "Training", "Go-Live Ready", "Completed"],
  kanban: ["Requested", "Triage", "Ready", "In Progress", "Blocked", "Done"],
};

/** Pick the best board template id for a method + project type. */
export function boardTemplateFor(method: DeliveryMethod, projectType: string): string {
  if (method === "kanban") return "kanban";
  if (projectType === "data_bi") return "data_bi";
  if (projectType === "construction") return "construction";
  if (projectType === "erp") return "erp";
  if (method === "hybrid") return "hybrid";
  return "generic";
}

export const CYCLE_TYPES: Opt[] = [
  { value: "sprint", es: "Sprint", en: "Sprint" },
  { value: "iteration", es: "Iteración", en: "Iteration" },
  { value: "weekly", es: "Ciclo semanal", en: "Weekly Cycle" },
  { value: "field", es: "Ciclo de campo", en: "Field Cycle" },
  { value: "training", es: "Ciclo de capacitación", en: "Training Cycle" },
  { value: "review", es: "Ciclo de revisión", en: "Review Cycle" },
  { value: "phase", es: "Fase de implementación", en: "Implementation Phase" },
  { value: "validation", es: "Ciclo de validación", en: "Validation Cycle" },
  { value: "custom", es: "Personalizado", en: "Custom" },
];

export const BACKLOG_ITEM_TYPES = [
  "Feature", "Task", "Deliverable", "Requirement", "Issue", "Improvement", "Risk Response",
  "Change Request", "Training Item", "Inspection Item", "Vendor Item", "Data Request",
  "Report Request", "Process Improvement", "Compliance Item", "Documentation Item",
  "Decision Item", "Research Item", "Testing Item", "Validation Item",
];

export const FRAMEWORK_STATUS_META: Record<string, { es: string; en: string; tone: "gray" | "blue" | "amber" | "green" | "red" }> = {
  draft: { es: "Borrador", en: "Draft", tone: "gray" },
  recommended: { es: "Recomendado", en: "Recommended", tone: "blue" },
  configured: { es: "Configurado", en: "Configured", tone: "blue" },
  active: { es: "Activo", en: "Active", tone: "green" },
  needs_review: { es: "Requiere revisión", en: "Needs Review", tone: "amber" },
  changed: { es: "Cambiado", en: "Changed", tone: "amber" },
  archived: { es: "Archivado", en: "Archived", tone: "gray" },
};

/** Suggested meeting rhythm per delivery method (bilingual labels). */
export const MEETING_RHYTHM: Record<DeliveryMethod, BiText[]> = {
  predictive: [{ es: "Revisión de fase (phase gate)", en: "Phase gate review" }, { es: "Actualización de estado", en: "Status update" }, { es: "Revisión de riesgos", en: "Risk review" }, { es: "Comité de control de cambios", en: "Change control board" }, { es: "Aceptación de hitos", en: "Milestone acceptance review" }],
  agile: [{ es: "Planificación de ciclo", en: "Cycle planning" }, { es: "Check-in periódico", en: "Periodic check-in" }, { es: "Revisión con stakeholders", en: "Stakeholder review" }, { es: "Revisión de lecciones aprendidas", en: "Lessons learned review" }],
  scrum: [{ es: "Planificación de ciclo", en: "Cycle planning" }, { es: "Check-in diario", en: "Daily check-in" }, { es: "Revisión con stakeholders", en: "Stakeholder review" }, { es: "Revisión de lecciones aprendidas", en: "Lessons learned review" }],
  kanban: [{ es: "Reunión de reabastecimiento", en: "Replenishment meeting" }, { es: "Revisión de flujo", en: "Flow review" }, { es: "Revisión de bloqueos", en: "Blocker review" }, { es: "Revisión de entrega de servicio", en: "Service delivery review" }],
  hybrid: [{ es: "Planificación de ciclo", en: "Cycle planning" }, { es: "Estado semanal", en: "Weekly status update" }, { es: "Revisión mensual con stakeholders", en: "Monthly stakeholder review" }, { es: "Revisión de cambios", en: "Change review" }, { es: "Revisión de riesgos", en: "Risk review" }, { es: "Lecciones aprendidas", en: "Lessons learned review" }],
  xp: [{ es: "Planificación de ciclo", en: "Cycle planning" }, { es: "Check-in diario", en: "Daily check-in" }, { es: "Revisión técnica", en: "Technical review" }, { es: "Pequeñas entregas", en: "Small releases review" }],
  // Gate reviews and cutover checkpoints are the ceremonies that distinguish
  // SAP Activate from a generic hybrid; the rest of the rhythm is shared.
  sap_activate: [
    { es: "Revisión de quality gate (Q-Gate)", en: "Quality gate review (Q-Gate)" },
    { es: "Taller fit-to-standard", en: "Fit-to-standard workshop" },
    { es: "Comité directivo", en: "Steering committee" },
    { es: "Estado semanal del proyecto", en: "Weekly project status" },
    { es: "Revisión de defectos y ciclos de prueba", en: "Defect and test cycle review" },
    { es: "Punto de control de cutover", en: "Cutover checkpoint" },
    { es: "Comité de control de cambios", en: "Change control board" },
    { es: "Lecciones aprendidas", en: "Lessons learned review" },
  ],
};

export const label = (opts: Opt[], value: string | null | undefined, isEs: boolean): string => {
  const o = opts.find((x) => x.value === value);
  return o ? (isEs ? o.es : o.en) : (value ?? "—");
};

// ── Workboard column labels adapted to the framework ────────────────────────
// The single Workboard keeps operating on TaskStatus; only the column LABELS
// are relabeled to the method/project-type terminology (drag&drop and
// dependencies stay intact). Keyed by TaskStatus string.

type StatusLabels = Record<string, { es: string; en: string }>;

const COLUMN_PROFILES: Record<string, StatusLabels> = {
  construction: {
    not_started: { es: "Planificado", en: "Planned" },
    prompt_ready: { es: "Listo para campo", en: "Ready for Field" },
    sent_to_ai: { es: "Asignado", en: "Assigned" },
    in_progress: { es: "En progreso", en: "In Progress" },
    implemented: { es: "Inspección requerida", en: "Inspection Required" },
    tested: { es: "Aprobado", en: "Approved" },
    done: { es: "Cerrado", en: "Closed" },
    blocked: { es: "Retrabajo requerido", en: "Rework Required" },
  },
  data_bi: {
    not_started: { es: "Solicitado", en: "Requested" },
    prompt_ready: { es: "Requisitos", en: "Requirements" },
    sent_to_ai: { es: "Exploración de datos", en: "Data Exploration" },
    in_progress: { es: "Desarrollo", en: "Development" },
    implemented: { es: "Validación", en: "Validation" },
    tested: { es: "UAT", en: "UAT" },
    done: { es: "Publicado", en: "Published" },
  },
  erp: {
    not_started: { es: "Requisito", en: "Requirement" },
    prompt_ready: { es: "Configuración", en: "Configuration" },
    sent_to_ai: { es: "En configuración", en: "Configuring" },
    in_progress: { es: "Pruebas", en: "Testing" },
    implemented: { es: "UAT", en: "UAT" },
    tested: { es: "Capacitación", en: "Training" },
    done: { es: "Completado", en: "Completed" },
  },
  kanban: {
    not_started: { es: "Solicitado", en: "Requested" },
    prompt_ready: { es: "Triage", en: "Triage" },
    sent_to_ai: { es: "Listo", en: "Ready" },
    in_progress: { es: "En progreso", en: "In Progress" },
    implemented: { es: "En revisión", en: "In Review" },
    tested: { es: "Validación", en: "Validation" },
    done: { es: "Hecho", en: "Done" },
  },
  hybrid: {
    not_started: { es: "Propuesto", en: "Proposed" },
    prompt_ready: { es: "Aprobado", en: "Approved" },
    sent_to_ai: { es: "Listo", en: "Ready" },
    in_progress: { es: "En progreso", en: "In Progress" },
    implemented: { es: "En validación", en: "In Validation" },
    tested: { es: "Revisión de stakeholders", en: "Stakeholder Review" },
    done: { es: "Hecho", en: "Done" },
  },
};

/** Profile id for the workboard column relabeling, given method + project type. */
function columnProfileFor(method: DeliveryMethod | null, projectType: string | null): string | null {
  if (projectType === "construction") return "construction";
  if (projectType === "data_bi") return "data_bi";
  if (projectType === "erp") return "erp";
  if (method === "kanban") return "kanban";
  if (method === "hybrid") return "hybrid";
  return null; // generic → keep default workboard labels
}

/** Returns TaskStatus→label overrides for the Workboard (empty = keep defaults). */
export function workboardColumnLabels(
  method: DeliveryMethod | null, projectType: string | null, isEs: boolean,
): Record<string, string> {
  const profile = columnProfileFor(method, projectType);
  if (!profile) return {};
  const map = COLUMN_PROFILES[profile];
  const out: Record<string, string> = {};
  for (const [status, v] of Object.entries(map)) out[status] = isEs ? v.es : v.en;
  return out;
}
