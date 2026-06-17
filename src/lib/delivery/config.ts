// ============================================================================
// ProjectOps360° — Adaptive Delivery Framework configuration (pure data)
// ============================================================================
// Project-agnostic by default. Software terminology only appears for the
// software project type. Shared by server (recommendation) and client (wizard).
// ============================================================================

export type DeliveryMethod = "predictive" | "agile" | "scrum" | "kanban" | "hybrid" | "xp";

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
};

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
};

export const label = (opts: Opt[], value: string | null | undefined, isEs: boolean): string => {
  const o = opts.find((x) => x.value === value);
  return o ? (isEs ? o.es : o.en) : (value ?? "—");
};
