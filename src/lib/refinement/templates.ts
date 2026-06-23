// ============================================================================
// ProjectOps360° — Work Refinement Center configuration (pure data)
// ============================================================================
// The same refinement engine across every delivery method, but the
// terminology, Definition of Ready, AI questions, estimation method and
// planning destinations change with the project's delivery method + type.
// Shared by server (AI + readiness) and client (3-panel UI). Bilingual.
// Mirrors the style of src/lib/delivery/config.ts.
// ============================================================================

import type { DeliveryMethod } from "@/lib/delivery/config";

export interface Opt { value: string; es: string; en: string; }
export interface BiText { es: string; en: string; }
export interface DorItem { key: string; es: string; en: string; }

export type Tone = "gray" | "blue" | "amber" | "green" | "red";
export type TemplateKey = "agile" | "traditional" | "construction" | "pmo" | "operations" | "consulting" | "hybrid";

// ── Work item types ───────────────────────────────────────────────────────────

export const WORK_ITEM_TYPES: Opt[] = [
  { value: "user_story", es: "Historia de usuario", en: "User Story" },
  { value: "feature", es: "Funcionalidad", en: "Feature" },
  { value: "bug", es: "Bug / Defecto", en: "Bug / Defect" },
  { value: "task", es: "Tarea", en: "Task" },
  { value: "work_package", es: "Paquete de trabajo", en: "Work Package" },
  { value: "change_request", es: "Solicitud de cambio", en: "Change Request" },
  { value: "risk_action", es: "Acción de riesgo", en: "Risk Action" },
  { value: "issue_action", es: "Acción de issue", en: "Issue Action" },
  { value: "rfi", es: "RFI", en: "RFI" },
  { value: "submittal", es: "Submittal", en: "Submittal" },
  { value: "procurement_item", es: "Ítem de adquisición", en: "Procurement Item" },
  { value: "milestone_work", es: "Trabajo de hito", en: "Milestone Work" },
  { value: "improvement", es: "Mejora", en: "Improvement" },
  { value: "decision_followup", es: "Seguimiento de decisión", en: "Decision Follow-up" },
  { value: "requirement", es: "Requisito", en: "Requirement" },
  { value: "deliverable", es: "Entregable", en: "Deliverable" },
  { value: "inspection_item", es: "Ítem de inspección", en: "Inspection Item" },
  { value: "permit_item", es: "Ítem de permiso", en: "Permit Item" },
];

// ── Refinement statuses ─────────────────────────────────────────────────────

export const REFINEMENT_STATUS_META: Record<string, { es: string; en: string; tone: Tone }> = {
  new: { es: "Nuevo", en: "New", tone: "gray" },
  needs_clarification: { es: "Necesita aclaración", en: "Needs Clarification", tone: "amber" },
  ready_for_refinement: { es: "Listo para refinar", en: "Ready for Refinement", tone: "blue" },
  in_refinement: { es: "En refinamiento", en: "In Refinement", tone: "blue" },
  split_required: { es: "Requiere división", en: "Split Required", tone: "amber" },
  refined: { es: "Refinado", en: "Refined", tone: "blue" },
  ready_for_planning: { es: "Listo para planear", en: "Ready for Planning", tone: "green" },
  planned: { es: "Planeado", en: "Planned", tone: "green" },
  in_execution: { es: "En ejecución", en: "In Execution", tone: "green" },
  done: { es: "Hecho", en: "Done", tone: "green" },
  rejected: { es: "Rechazado", en: "Rejected", tone: "red" },
  deferred: { es: "Diferido", en: "Deferred", tone: "gray" },
};

/** Statuses the PM can set during a refinement review (the rest are lifecycle). */
export const REFINABLE_STATUSES = [
  "needs_clarification", "split_required", "refined", "ready_for_planning",
] as const;

// ── Estimation methods ──────────────────────────────────────────────────────

export interface EstimationMethod {
  value: string;
  es: string; en: string;
  /** Discrete allowed values (story points, t-shirt, complexity). Empty = free numeric. */
  scale: string[];
  /** Three-point estimate (optimistic / most likely / pessimistic). */
  threePoint?: boolean;
  /** Free-text range (cost range). */
  range?: boolean;
  unitEs?: string; unitEn?: string;
  recEs: string; recEn: string;
}

export const ESTIMATION_METHODS: EstimationMethod[] = [
  { value: "story_points", es: "Story Points", en: "Story Points", scale: ["1", "2", "3", "5", "8", "13", "21"], recEs: "Ágil / Scrum", recEn: "Agile / Scrum" },
  { value: "tshirt", es: "Talla (T-shirt)", en: "T-shirt Size", scale: ["XS", "S", "M", "L", "XL"], recEs: "Operaciones, intake temprano, planeación de alto nivel", recEn: "Operations, early intake, high-level planning" },
  { value: "hours", es: "Horas", en: "Hours", scale: [], unitEs: "h", unitEn: "h", recEs: "Tareas de software/consultoría, trabajo operativo pequeño", recEn: "Software/consulting tasks, small operational work" },
  { value: "days", es: "Días", en: "Days", scale: [], unitEs: "d", unitEn: "d", recEs: "Proyectos tradicionales, consultoría, construcción, fases", recEn: "Traditional projects, consulting, construction, phase planning" },
  { value: "crew_hours", es: "Horas-cuadrilla", en: "Crew-hours", scale: [], unitEs: "h-cuadrilla", unitEn: "crew-h", recEs: "Paquetes de trabajo de construcción", recEn: "Construction work packages" },
  { value: "cost_range", es: "Rango de costo", en: "Cost Range", scale: [], range: true, recEs: "Construcción, adquisiciones, consultoría, PMO", recEn: "Construction, procurement, consulting, PMO governance" },
  { value: "complexity", es: "Complejidad (1-5)", en: "Complexity Score (1-5)", scale: ["1", "2", "3", "4", "5"], recEs: "Trabajo en etapa temprana", recEn: "Early-stage work" },
  { value: "risk_adjusted", es: "Esfuerzo ajustado por riesgo", en: "Risk-adjusted Effort", scale: [], unitEs: "pts", unitEn: "pts", recEs: "Considera incertidumbre, dependencias y riesgo de entrega", recEn: "Considers uncertainty, dependencies and delivery risk" },
  { value: "three_point", es: "Estimación de tres puntos", en: "Three-point Estimate", scale: [], threePoint: true, recEs: "Trabajo incierto o de alto riesgo", recEn: "Uncertain or high-risk work" },
];

export const PRIORITIES: Opt[] = [
  { value: "High", es: "Alta", en: "High" },
  { value: "Medium", es: "Media", en: "Medium" },
  { value: "Low", es: "Baja", en: "Low" },
];

export const RISK_LEVELS: Opt[] = [
  { value: "low", es: "Bajo", en: "Low" },
  { value: "medium", es: "Medio", en: "Medium" },
  { value: "high", es: "Alto", en: "High" },
  { value: "critical", es: "Crítico", en: "Critical" },
];

// ── Planning destinations ─────────────────────────────────────────────────────

export const PLANNING_DESTINATIONS: Opt[] = [
  { value: "sprint_planning", es: "Planificación de sprint", en: "Sprint Planning" },
  { value: "product_backlog", es: "Backlog de producto", en: "Product Backlog" },
  { value: "phase_planning", es: "Planificación por fases", en: "Phase Planning" },
  { value: "construction_lookahead", es: "Lookahead de construcción", en: "Construction Lookahead Plan" },
  { value: "procurement_plan", es: "Plan de adquisiciones", en: "Procurement Plan" },
  { value: "inspection_plan", es: "Plan de inspecciones", en: "Inspection Plan" },
  { value: "risk_response_plan", es: "Plan de respuesta a riesgos", en: "Risk Response Plan" },
  { value: "operations_board", es: "Tablero de operaciones", en: "Operations Board" },
  { value: "governance_review", es: "Revisión de gobernanza", en: "Governance Review" },
  { value: "execution_board", es: "Tablero de ejecución (Workboard)", en: "Execution Board (Workboard)" },
];

// ── Refinement templates by delivery method / project type ──────────────────

export interface RefinementTemplate {
  key: TemplateKey;
  secondaryLabel: BiText;
  terminology: BiText;
  requiredFields: BiText[];
  definitionOfReady: DorItem[];
  aiQuestions: BiText[];
  planningDestinations: string[]; // PLANNING_DESTINATIONS values, ordered by relevance
  defaultEstimationMethod: string;
}

export const REFINEMENT_TEMPLATES: Record<TemplateKey, RefinementTemplate> = {
  agile: {
    key: "agile",
    secondaryLabel: { es: "Refinamiento de backlog", en: "Backlog Refinement" },
    terminology: { es: "Historia de usuario · Criterios de aceptación · Story Points · Listo para sprint", en: "User Story · Acceptance Criteria · Story Points · Sprint Ready" },
    requiredFields: [
      { es: "Formato de historia de usuario", en: "User story format" },
      { es: "Criterios de aceptación", en: "Acceptance criteria" },
      { es: "Valor de negocio", en: "Business value" },
      { es: "Story points", en: "Story points" },
      { es: "Dependencias", en: "Dependencies" },
      { es: "Prioridad", en: "Priority" },
      { es: "Testabilidad", en: "Testability" },
      { es: "Cabe en un sprint", en: "Sprint fit" },
    ],
    definitionOfReady: [
      { key: "clear_desc", es: "La descripción es clara", en: "Description is clear" },
      { key: "acceptance", es: "Criterios de aceptación definidos", en: "Acceptance criteria are defined" },
      { key: "value", es: "Valor de negocio definido", en: "Business value is defined" },
      { key: "deps", es: "Dependencias identificadas", en: "Dependencies are identified" },
      { key: "sprint_size", es: "Suficientemente pequeño para un sprint", en: "Small enough for a sprint" },
      { key: "estimate", es: "Tiene una estimación", en: "Item has an estimate" },
      { key: "priority", es: "Tiene prioridad", en: "Item has priority" },
      { key: "no_blockers", es: "Sin bloqueadores críticos", en: "No critical blockers exist" },
      { key: "test_approach", es: "Enfoque de pruebas entendido", en: "Test approach is understood" },
    ],
    aiQuestions: [
      { es: "¿El rol del usuario es claro?", en: "Is the user role clear?" },
      { es: "¿El valor para el usuario es claro?", en: "Is the user value clear?" },
      { es: "¿Los criterios de aceptación son testeables?", en: "Are the acceptance criteria testable?" },
      { es: "¿Es demasiado grande y debe dividirse?", en: "Is the item too large and should it be split?" },
      { es: "¿Hay dependencias técnicas?", en: "Are there technical dependencies?" },
      { es: "¿Está listo para Sprint Planning?", en: "Is the story ready for Sprint Planning?" },
    ],
    planningDestinations: ["sprint_planning", "product_backlog", "execution_board"],
    defaultEstimationMethod: "story_points",
  },

  traditional: {
    key: "traditional",
    secondaryLabel: { es: "Refinamiento de requisitos", en: "Requirements Refinement" },
    terminology: { es: "Requisito · Tarea · Módulo · Entregable · Criterios de terminación", en: "Requirement · Task · Module · Deliverable · Completion Criteria" },
    requiredFields: [
      { es: "Descripción del requisito", en: "Requirement description" },
      { es: "Criterios funcionales", en: "Functional criteria" },
      { es: "Criterios técnicos", en: "Technical criteria" },
      { es: "Dependencias", en: "Dependencies" },
      { es: "Estimación en horas o días", en: "Estimate in hours or days" },
      { es: "Owner", en: "Owner" },
      { es: "Prioridad", en: "Priority" },
      { es: "Notas de pruebas", en: "Testing notes" },
    ],
    definitionOfReady: [
      { key: "documented", es: "Requisito documentado", en: "Requirement is documented" },
      { key: "tech_approach", es: "Enfoque técnico entendido", en: "Technical approach is understood" },
      { key: "deps", es: "Dependencias identificadas", en: "Dependencies are identified" },
      { key: "data_access", es: "Datos o accesos disponibles", en: "Required data or access is available" },
      { key: "completion", es: "Criterios de terminación definidos", en: "Completion criteria are defined" },
      { key: "testing", es: "Expectativas de pruebas claras", en: "Testing expectations are clear" },
      { key: "estimate", es: "Estimación provista", en: "Estimate is provided" },
      { key: "owner", es: "Owner asignado", en: "Owner is assigned" },
    ],
    aiQuestions: [
      { es: "¿Es funcional, técnico u operativo?", en: "Is this requirement functional, technical, or operational?" },
      { es: "¿Qué sistema o módulo se ve afectado?", en: "What system or module is affected?" },
      { es: "¿Hay dependencias de datos?", en: "Are there data dependencies?" },
      { es: "¿Hay riesgos de integración?", en: "Are there integration risks?" },
      { es: "¿Qué pruebas se necesitan?", en: "What testing is needed?" },
      { es: "¿Se requiere aprobación antes de desarrollar?", en: "Is approval required before development?" },
    ],
    planningDestinations: ["phase_planning", "execution_board", "product_backlog"],
    defaultEstimationMethod: "days",
  },

  construction: {
    key: "construction",
    secondaryLabel: { es: "Refinamiento de paquete de trabajo / Lookahead", en: "Work Package Refinement / Lookahead Readiness Review" },
    terminology: { es: "Paquete de trabajo · Lookahead · RFI · Submittal · Permiso · Inspección · Cuadrilla · Materiales", en: "Work Package · Lookahead · RFI · Submittal · Permit · Inspection · Crew · Materials" },
    requiredFields: [
      { es: "Descripción del paquete de trabajo", en: "Work package description" },
      { es: "Ubicación / área", en: "Location / area" },
      { es: "Referencia de planos", en: "Drawings reference" },
      { es: "Estado de materiales", en: "Material status" },
      { es: "Estado de permisos", en: "Permit status" },
      { es: "Requisito de inspección", en: "Inspection requirement" },
      { es: "Requisito de cuadrilla", en: "Crew requirement" },
      { es: "Requisitos de seguridad", en: "Safety requirements" },
      { es: "Dependencias", en: "Dependencies" },
      { es: "Estimación de duración", en: "Duration estimate" },
      { es: "Estimación de costo", en: "Cost estimate" },
      { es: "Nivel de riesgo", en: "Risk level" },
      { es: "Criterios de terminación", en: "Completion criteria" },
    ],
    definitionOfReady: [
      { key: "drawings", es: "Planos aprobados disponibles", en: "Approved drawings are available" },
      { key: "materials", es: "Materiales disponibles o fecha de entrega confirmada", en: "Materials available or delivery date confirmed" },
      { key: "permits", es: "Permisos listos si se requieren", en: "Permits are ready if required" },
      { key: "crew", es: "Cuadrilla asignada o identificada", en: "Crew is assigned or identified" },
      { key: "predecessor", es: "Trabajo predecesor completado", en: "Predecessor work is completed" },
      { key: "inspections", es: "Inspecciones requeridas identificadas", en: "Required inspections are identified" },
      { key: "safety", es: "Requisitos de seguridad revisados", en: "Safety requirements are reviewed" },
      { key: "area", es: "Área de trabajo disponible", en: "Work area is available" },
      { key: "duration", es: "Duración estimada", en: "Duration is estimated" },
      { key: "cost", es: "Costo estimado", en: "Cost is estimated" },
      { key: "no_blockers", es: "Bloqueadores mayores resueltos", en: "Major blockers are resolved" },
    ],
    aiQuestions: [
      { es: "¿Están disponibles los últimos planos aprobados?", en: "Are the latest approved drawings available?" },
      { es: "¿Hay un RFI abierto que afecte este trabajo?", en: "Is there an open RFI affecting this work?" },
      { es: "¿Los materiales están en sitio?", en: "Are materials available on site?" },
      { es: "¿El lead time de adquisición es un riesgo?", en: "Is procurement lead time a risk?" },
      { es: "¿Se requieren permisos o inspecciones?", en: "Are permits or inspections required?" },
      { es: "¿Qué oficio debe terminar antes de iniciar?", en: "What trade must finish before this work starts?" },
      { es: "¿Hay conflictos con otros oficios?", en: "Are there conflicts with other trades?" },
      { es: "¿El área de trabajo está lista?", en: "Is the work area ready?" },
      { es: "¿Hay riesgos de seguridad?", en: "Are there safety risks?" },
      { es: "¿Está listo para el plan de lookahead?", en: "Is this item ready for the lookahead plan?" },
    ],
    planningDestinations: ["construction_lookahead", "phase_planning", "procurement_plan", "inspection_plan", "execution_board"],
    defaultEstimationMethod: "crew_hours",
  },

  pmo: {
    key: "pmo",
    secondaryLabel: { es: "Refinamiento de iniciativa", en: "Initiative Refinement" },
    terminology: { es: "Iniciativa · Caso de negocio · Alineación estratégica · Aprobación de gobernanza · Prioridad de portafolio", en: "Initiative · Business Case · Strategic Alignment · Governance Approval · Portfolio Priority" },
    requiredFields: [
      { es: "Descripción de la iniciativa", en: "Initiative description" },
      { es: "Objetivo estratégico", en: "Strategic objective" },
      { es: "Valor de negocio", en: "Business value" },
      { es: "Impacto en stakeholders", en: "Stakeholder impact" },
      { es: "Estado de financiamiento", en: "Funding status" },
      { es: "Estado de aprobación de gobernanza", en: "Governance approval status" },
      { es: "Riesgos", en: "Risks" },
      { es: "Dependencias", en: "Dependencies" },
      { es: "Prioridad", en: "Priority" },
      { es: "Valor vs esfuerzo", en: "Value vs effort" },
      { es: "Decisión requerida", en: "Decision required" },
    ],
    definitionOfReady: [
      { key: "alignment", es: "Alineación estratégica definida", en: "Strategic alignment is defined" },
      { key: "value", es: "Valor de negocio documentado", en: "Business value is documented" },
      { key: "sponsor", es: "Patrocinador ejecutivo identificado", en: "Executive sponsor is identified" },
      { key: "funding", es: "Estado de financiamiento conocido", en: "Funding status is known" },
      { key: "governance", es: "Requisito de aprobación de gobernanza claro", en: "Governance approval requirement is clear" },
      { key: "deps", es: "Dependencias mayores identificadas", en: "Major dependencies are identified" },
      { key: "risks", es: "Riesgos revisados", en: "Risks are reviewed" },
      { key: "metrics", es: "Métricas de éxito definidas", en: "Success metrics are defined" },
      { key: "decision_owner", es: "Dueño de la decisión asignado", en: "Decision owner is assigned" },
    ],
    aiQuestions: [
      { es: "¿Qué objetivo estratégico soporta?", en: "What strategic objective does this support?" },
      { es: "¿Quién es el patrocinador ejecutivo?", en: "Who is the executive sponsor?" },
      { es: "¿Qué valor crea esta iniciativa?", en: "What value does this initiative create?" },
      { es: "¿El financiamiento está aprobado?", en: "Is funding approved?" },
      { es: "¿Qué decisión de gobernanza se requiere?", en: "What governance decision is required?" },
      { es: "¿Qué departamentos se ven impactados?", en: "What departments are impacted?" },
      { es: "¿Cuáles son los riesgos mayores?", en: "What are the major risks?" },
      { es: "¿Está listo para la revisión de portafolio?", en: "Is this ready for portfolio review?" },
    ],
    planningDestinations: ["governance_review", "phase_planning", "risk_response_plan", "execution_board"],
    defaultEstimationMethod: "cost_range",
  },

  operations: {
    key: "operations",
    secondaryLabel: { es: "Refinamiento de intake de trabajo", en: "Work Intake Refinement" },
    terminology: { es: "Intake · Solicitud · Incidente · Mejora · Tarea operativa", en: "Work Intake · Request · Incident · Improvement · Operational Task" },
    requiredFields: [
      { es: "Descripción de la solicitud", en: "Request description" },
      { es: "Impacto", en: "Impact" },
      { es: "Prioridad", en: "Priority" },
      { es: "Owner", en: "Owner" },
      { es: "Fecha límite", en: "Due date" },
      { es: "Estimación de esfuerzo", en: "Effort estimate" },
      { es: "Impacto en SLA", en: "SLA impact" },
      { es: "Dependencias", en: "Dependencies" },
      { es: "Criterios de terminación", en: "Completion criteria" },
    ],
    definitionOfReady: [
      { key: "clear", es: "La solicitud es clara", en: "Request is clear" },
      { key: "impact", es: "Impacto entendido", en: "Impact is understood" },
      { key: "priority", es: "Prioridad asignada", en: "Priority is assigned" },
      { key: "owner", es: "Owner asignado", en: "Owner is assigned" },
      { key: "due_sla", es: "Fecha límite o SLA definido", en: "Due date or SLA is defined" },
      { key: "deps", es: "Dependencias identificadas", en: "Dependencies are identified" },
      { key: "completion", es: "Criterios de terminación claros", en: "Completion criteria are clear" },
      { key: "estimate", es: "Estimación provista", en: "Estimate is provided" },
    ],
    aiQuestions: [
      { es: "¿Es urgente o rutinario?", en: "Is this request urgent or routine?" },
      { es: "¿Qué proceso de negocio se ve afectado?", en: "What business process is affected?" },
      { es: "¿Hay un SLA?", en: "Is there an SLA?" },
      { es: "¿Quién es dueño de la resolución?", en: "Who owns the resolution?" },
      { es: "¿Cuál es el impacto operativo?", en: "What is the operational impact?" },
      { es: "¿Se puede completar tal cual o necesita aclaración?", en: "Can this be completed as-is or does it need clarification?" },
      { es: "¿Debería ser un proyecto en vez de una tarea operativa?", en: "Should this become a project item instead of an operational task?" },
    ],
    planningDestinations: ["operations_board", "execution_board", "product_backlog"],
    defaultEstimationMethod: "tshirt",
  },

  consulting: {
    key: "consulting",
    secondaryLabel: { es: "Refinamiento de alcance", en: "Scope Refinement" },
    terminology: { es: "Ítem de alcance · Entregable · Workshop · Requisito de cliente · Tarea de engagement", en: "Scope Item · Deliverable · Workshop · Client Requirement · Engagement Task" },
    requiredFields: [
      { es: "Necesidad del cliente", en: "Client need" },
      { es: "Descripción del entregable", en: "Deliverable description" },
      { es: "Criterios de aceptación", en: "Acceptance criteria" },
      { es: "Supuestos", en: "Assumptions" },
      { es: "Dependencias", en: "Dependencies" },
      { es: "Consultor owner", en: "Consultant owner" },
      { es: "Horas o días estimados", en: "Estimated hours or days" },
      { es: "Requisito de aprobación del cliente", en: "Client approval requirement" },
      { es: "Criterios de terminación", en: "Completion criteria" },
    ],
    definitionOfReady: [
      { key: "client_need", es: "Necesidad del cliente documentada", en: "Client need is documented" },
      { key: "deliverable", es: "Entregable claramente definido", en: "Deliverable is clearly defined" },
      { key: "assumptions", es: "Supuestos documentados", en: "Assumptions are documented" },
      { key: "deps", es: "Dependencias conocidas", en: "Dependencies are known" },
      { key: "acceptance", es: "Criterios de aceptación claros", en: "Acceptance criteria are clear" },
      { key: "approval", es: "Requisito de aprobación del cliente definido", en: "Client approval requirement is defined" },
      { key: "estimate", es: "Estimación provista", en: "Estimate is provided" },
      { key: "owner", es: "Owner asignado", en: "Owner is assigned" },
    ],
    aiQuestions: [
      { es: "¿Qué resultado del cliente soporta?", en: "What client outcome does this support?" },
      { es: "¿Qué entregable se producirá?", en: "What deliverable will be produced?" },
      { es: "¿Qué supuestos se están haciendo?", en: "What assumptions are being made?" },
      { es: "¿Se requiere input del cliente?", en: "Is client input required?" },
      { es: "¿Se necesita aprobación antes de empezar?", en: "Is approval needed before work begins?" },
      { es: "¿Cuál es el esfuerzo de consultoría estimado?", en: "What is the estimated consulting effort?" },
      { es: "¿El alcance es claro para evitar retrabajo?", en: "Is the scope clear enough to avoid rework?" },
    ],
    planningDestinations: ["phase_planning", "execution_board", "product_backlog"],
    defaultEstimationMethod: "days",
  },

  hybrid: {
    key: "hybrid",
    secondaryLabel: { es: "Refinamiento de trabajo híbrido", en: "Hybrid Work Refinement" },
    terminology: { es: "Ítem de trabajo · Entregable · Hito · Sprint / Fase · Criterios de aceptación o terminación", en: "Work Item · Deliverable · Milestone · Sprint / Phase · Acceptance or Completion Criteria" },
    requiredFields: [
      { es: "Descripción del ítem de trabajo", en: "Work item description" },
      { es: "Método de entrega", en: "Delivery method" },
      { es: "Fase o sprint", en: "Phase or sprint" },
      { es: "Criterios de terminación", en: "Completion criteria" },
      { es: "Dependencias", en: "Dependencies" },
      { es: "Riesgos", en: "Risks" },
      { es: "Estimación", en: "Estimate" },
      { es: "Owner", en: "Owner" },
      { es: "Prioridad", en: "Priority" },
      { es: "Destino de planeación", en: "Planning destination" },
    ],
    definitionOfReady: [
      { key: "scope", es: "Alcance claro", en: "Scope is clear" },
      { key: "method", es: "Método de entrega seleccionado", en: "Delivery method is selected" },
      { key: "completion", es: "Criterios de terminación definidos", en: "Completion criteria are defined" },
      { key: "deps", es: "Dependencias identificadas", en: "Dependencies are identified" },
      { key: "risks", es: "Riesgos revisados", en: "Risks are reviewed" },
      { key: "estimate", es: "Estimación provista", en: "Estimate is provided" },
      { key: "owner", es: "Owner asignado", en: "Owner is assigned" },
      { key: "priority", es: "Prioridad clara", en: "Priority is clear" },
      { key: "destination", es: "Destino de planeación seleccionado", en: "Planning destination is selected" },
    ],
    aiQuestions: [
      { es: "¿Se planea en sprint, fase, hito o tablero de ejecución?", en: "Should this be planned in a sprint, phase, milestone, or execution board?" },
      { es: "¿Es ágil, predictivo o mixto?", en: "Is this item Agile, predictive, or mixed?" },
      { es: "¿Qué dependencias cruzan métodos de entrega?", en: "What dependencies exist across delivery methods?" },
      { es: "¿Necesita aprobación?", en: "Does this item need approval?" },
      { es: "¿Qué riesgos podrían afectar la ejecución?", en: "What risks could affect execution?" },
      { es: "¿El trabajo es lo suficientemente claro para avanzar?", en: "Is the work clear enough to move forward?" },
    ],
    planningDestinations: ["sprint_planning", "phase_planning", "execution_board", "governance_review"],
    defaultEstimationMethod: "story_points",
  },
};

// ── Resolver: delivery method + project type → template key ─────────────────

/**
 * Pick the refinement template for a project. The project's delivery method is
 * the primary driver; the framework project type refines it (construction and
 * governance-heavy types override the method).
 */
export function templateFor(
  method: DeliveryMethod | null | undefined,
  projectType: string | null | undefined,
): RefinementTemplate {
  const pt = projectType ?? "";
  if (pt === "construction") return REFINEMENT_TEMPLATES.construction;
  if (pt === "compliance") return REFINEMENT_TEMPLATES.pmo;
  if (pt === "operations") return REFINEMENT_TEMPLATES.operations;
  if (pt === "procurement") return REFINEMENT_TEMPLATES.operations;
  if (pt === "data_bi" || pt === "erp") return REFINEMENT_TEMPLATES.traditional;

  switch (method) {
    case "scrum":
    case "agile":
    case "xp":
      return REFINEMENT_TEMPLATES.agile;
    case "predictive":
      return REFINEMENT_TEMPLATES.traditional;
    case "kanban":
      return REFINEMENT_TEMPLATES.operations;
    case "hybrid":
      return REFINEMENT_TEMPLATES.hybrid;
    default:
      return REFINEMENT_TEMPLATES.hybrid;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const labelOf = (opts: Opt[], value: string | null | undefined, isEs: boolean): string => {
  const o = opts.find((x) => x.value === value);
  return o ? (isEs ? o.es : o.en) : (value ?? "—");
};

export interface ReadinessBand { key: string; es: string; en: string; tone: Tone; }

export const READINESS_BANDS: ReadinessBand[] = [
  { key: "not_ready", es: "No listo", en: "Not ready", tone: "red" },
  { key: "needs_clarification", es: "Necesita aclaración", en: "Needs clarification", tone: "amber" },
  { key: "almost_ready", es: "Casi listo", en: "Almost ready", tone: "blue" },
  { key: "ready", es: "Listo", en: "Ready", tone: "green" },
];

export function bandForScore(score: number): ReadinessBand {
  if (score >= 85) return READINESS_BANDS[3];
  if (score >= 70) return READINESS_BANDS[2];
  if (score >= 40) return READINESS_BANDS[1];
  return READINESS_BANDS[0];
}
