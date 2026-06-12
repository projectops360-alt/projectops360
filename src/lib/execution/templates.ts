// ============================================================================
// ProjectOps360° — Project Templates
// ============================================================================
// Typed template catalog. Templates are code (versionable, testable) and are
// instantiated into real milestones/tasks/dependencies/resources/budget/risk
// rows by template-service.ts. All generated records are marked
// origin='template' and AI-suggested plans additionally get needs_review.
// ============================================================================

import type { I18nField } from "@/types/database";
import type { ProjectType, BudgetCategory, ResourceType, RiskCategory } from "@/types/execution";

// ── Template types ──────────────────────────────────────────────────────────

export interface TemplateTask {
  /** Stable key within the template, used to wire dependencies. */
  key: string;
  title_i18n: I18nField;
  estimated_duration_days: number;
  estimated_labor_hours?: number;
  required_skills?: string[];
  trade_key?: string;
  discipline?: string;
  /** Keys of predecessor tasks (finish_to_start). */
  depends_on?: string[];
}

export interface TemplatePhase {
  key: string;
  title_i18n: I18nField;
  /** Milestone icon/color keys reuse the roadmap conventions. */
  icon_key?: string;
  tasks: TemplateTask[];
}

export interface TemplateResource {
  name: string;
  resource_type: ResourceType;
  trade_key?: string;
  skills?: string[];
}

export interface TemplateBudgetLine {
  name_i18n: I18nField;
  category: BudgetCategory;
}

export interface TemplateRisk {
  title_i18n: I18nField;
  category: RiskCategory;
  severity: "low" | "medium" | "high" | "critical";
}

export interface ProjectTemplate {
  project_type: ProjectType;
  name_i18n: I18nField;
  description_i18n: I18nField;
  phases: TemplatePhase[];
  resources: TemplateResource[];
  budget_lines: TemplateBudgetLine[];
  risks: TemplateRisk[];
}

// ── Software Development ────────────────────────────────────────────────────

const SOFTWARE_TEMPLATE: ProjectTemplate = {
  project_type: "software_development",
  name_i18n: { en: "Software Development Project", es: "Proyecto de Desarrollo de Software" },
  description_i18n: {
    en: "Discovery → Architecture → Design → Development → Testing → Deployment → Launch → Support",
    es: "Descubrimiento → Arquitectura → Diseño → Desarrollo → Pruebas → Despliegue → Lanzamiento → Soporte",
  },
  phases: [
    {
      key: "discovery",
      title_i18n: { en: "Discovery", es: "Descubrimiento" },
      icon_key: "notebook",
      tasks: [
        { key: "requirements", title_i18n: { en: "Gather requirements", es: "Levantar requerimientos" }, estimated_duration_days: 5, required_skills: ["product"] },
        { key: "scope", title_i18n: { en: "Define scope & success criteria", es: "Definir alcance y criterios de éxito" }, estimated_duration_days: 3, depends_on: ["requirements"] },
      ],
    },
    {
      key: "architecture",
      title_i18n: { en: "Architecture", es: "Arquitectura" },
      icon_key: "setup",
      tasks: [
        { key: "tech-stack", title_i18n: { en: "Select tech stack & cloud services", es: "Seleccionar stack tecnológico y servicios cloud" }, estimated_duration_days: 3, depends_on: ["scope"], required_skills: ["architecture"] },
        { key: "data-model", title_i18n: { en: "Design data model & API contracts", es: "Diseñar modelo de datos y contratos de API" }, estimated_duration_days: 5, depends_on: ["tech-stack"], required_skills: ["architecture", "backend"] },
      ],
    },
    {
      key: "design",
      title_i18n: { en: "Design", es: "Diseño" },
      icon_key: "sparkles",
      tasks: [
        { key: "ux-design", title_i18n: { en: "UX flows & wireframes", es: "Flujos UX y wireframes" }, estimated_duration_days: 5, depends_on: ["scope"], required_skills: ["design"] },
        { key: "ui-design", title_i18n: { en: "UI design system", es: "Sistema de diseño UI" }, estimated_duration_days: 5, depends_on: ["ux-design"], required_skills: ["design"] },
      ],
    },
    {
      key: "development",
      title_i18n: { en: "Development", es: "Desarrollo" },
      icon_key: "loop",
      tasks: [
        { key: "backend-api", title_i18n: { en: "Build backend API", es: "Construir API backend" }, estimated_duration_days: 15, depends_on: ["data-model"], required_skills: ["backend"], estimated_labor_hours: 120 },
        { key: "frontend-ui", title_i18n: { en: "Build frontend UI", es: "Construir UI frontend" }, estimated_duration_days: 15, depends_on: ["ui-design", "backend-api"], required_skills: ["frontend"], estimated_labor_hours: 120 },
        { key: "integrations", title_i18n: { en: "Third-party integrations & API keys", es: "Integraciones de terceros y claves de API" }, estimated_duration_days: 5, depends_on: ["backend-api"], required_skills: ["backend"] },
      ],
    },
    {
      key: "testing",
      title_i18n: { en: "Testing", es: "Pruebas" },
      icon_key: "shield_database",
      tasks: [
        { key: "qa-pass", title_i18n: { en: "QA test pass & bug fixing", es: "Ciclo de QA y corrección de bugs" }, estimated_duration_days: 8, depends_on: ["frontend-ui", "integrations"], required_skills: ["qa"] },
        { key: "perf-security", title_i18n: { en: "Performance & security review", es: "Revisión de rendimiento y seguridad" }, estimated_duration_days: 4, depends_on: ["qa-pass"], required_skills: ["qa", "security"] },
      ],
    },
    {
      key: "deployment",
      title_i18n: { en: "Deployment", es: "Despliegue" },
      icon_key: "rocket",
      tasks: [
        { key: "cicd", title_i18n: { en: "CI/CD pipeline & environments", es: "Pipeline CI/CD y ambientes" }, estimated_duration_days: 3, depends_on: ["backend-api"], required_skills: ["devops"] },
        { key: "prod-deploy", title_i18n: { en: "Production deployment", es: "Despliegue a producción" }, estimated_duration_days: 2, depends_on: ["perf-security", "cicd"], required_skills: ["devops"] },
      ],
    },
    {
      key: "launch",
      title_i18n: { en: "Launch & Support", es: "Lanzamiento y Soporte" },
      icon_key: "check_circle",
      tasks: [
        { key: "launch", title_i18n: { en: "Launch & monitoring", es: "Lanzamiento y monitoreo" }, estimated_duration_days: 2, depends_on: ["prod-deploy"] },
        { key: "stabilization", title_i18n: { en: "Post-launch stabilization", es: "Estabilización post-lanzamiento" }, estimated_duration_days: 10, depends_on: ["launch"] },
      ],
    },
  ],
  resources: [
    { name: "Senior Full-Stack Developer", resource_type: "person", skills: ["backend", "frontend"] },
    { name: "QA Engineer", resource_type: "person", skills: ["qa"] },
    { name: "Product Designer", resource_type: "person", skills: ["design"] },
    { name: "Cloud Hosting", resource_type: "cloud_service" },
    { name: "AI API Subscription", resource_type: "cloud_service" },
    { name: "IDE / Tooling Licenses", resource_type: "software_license" },
  ],
  budget_lines: [
    { name_i18n: { en: "Development labor", es: "Mano de obra de desarrollo" }, category: "labor" },
    { name_i18n: { en: "Cloud & infrastructure", es: "Cloud e infraestructura" }, category: "cloud" },
    { name_i18n: { en: "Licenses & subscriptions", es: "Licencias y suscripciones" }, category: "software" },
    { name_i18n: { en: "Contingency", es: "Contingencia" }, category: "contingency" },
  ],
  risks: [
    { title_i18n: { en: "Scope creep without budget adjustment", es: "Aumento de alcance sin ajuste de presupuesto" }, category: "scope", severity: "high" },
    { title_i18n: { en: "Third-party API dependency blocks release", es: "Dependencia de API de terceros bloquea el release" }, category: "technical", severity: "medium" },
    { title_i18n: { en: "Cloud cost increase impacts budget", es: "Incremento de costo cloud impacta el presupuesto" }, category: "budget", severity: "medium" },
  ],
};

// ── Data Center Construction ────────────────────────────────────────────────

const DATA_CENTER_TEMPLATE: ProjectTemplate = {
  project_type: "data_center_construction",
  name_i18n: { en: "Data Center Construction Project", es: "Proyecto de Construcción de Centro de Datos" },
  description_i18n: {
    en: "Planning → Site Prep → Civil/Structural → Electrical → Mechanical/Cooling → Network/Fiber → Security → Racks → Commissioning → Handover",
    es: "Planificación → Preparación de sitio → Civil/Estructural → Eléctrico → Mecánico/Enfriamiento → Red/Fibra → Seguridad → Racks → Commissioning → Entrega",
  },
  phases: [
    {
      key: "planning",
      title_i18n: { en: "Planning & Permitting", es: "Planificación y Permisos" },
      icon_key: "notebook",
      tasks: [
        { key: "permits", title_i18n: { en: "Obtain construction permits", es: "Obtener permisos de construcción" }, estimated_duration_days: 30, discipline: "Civil" },
        { key: "design-review", title_i18n: { en: "Design review & drawing approval", es: "Revisión de diseño y aprobación de planos" }, estimated_duration_days: 15 },
      ],
    },
    {
      key: "site-prep",
      title_i18n: { en: "Site Preparation", es: "Preparación de Sitio" },
      icon_key: "setup",
      tasks: [
        { key: "earthwork", title_i18n: { en: "Earthwork & grading", es: "Movimiento de tierras y nivelación" }, estimated_duration_days: 20, depends_on: ["permits"], trade_key: "civil", discipline: "Civil" },
      ],
    },
    {
      key: "civil-structural",
      title_i18n: { en: "Civil & Structural", es: "Civil y Estructural" },
      icon_key: "shield_database",
      tasks: [
        { key: "foundations", title_i18n: { en: "Foundations & slabs", es: "Cimentaciones y losas" }, estimated_duration_days: 30, depends_on: ["earthwork"], trade_key: "concrete", discipline: "Structural" },
        { key: "structure", title_i18n: { en: "Structural steel & envelope", es: "Estructura metálica y envolvente" }, estimated_duration_days: 45, depends_on: ["foundations"], trade_key: "structural", discipline: "Structural" },
      ],
    },
    {
      key: "electrical",
      title_i18n: { en: "Electrical Infrastructure", es: "Infraestructura Eléctrica" },
      icon_key: "sparkles",
      tasks: [
        { key: "switchgear", title_i18n: { en: "Switchgear & UPS installation", es: "Instalación de switchgear y UPS" }, estimated_duration_days: 25, depends_on: ["structure"], trade_key: "electrical", discipline: "Electrical", required_skills: ["electrical"] },
        { key: "generators", title_i18n: { en: "Generator installation", es: "Instalación de generadores" }, estimated_duration_days: 20, depends_on: ["structure"], trade_key: "electrical", discipline: "Electrical" },
        { key: "power-distribution", title_i18n: { en: "Power distribution & PDUs", es: "Distribución eléctrica y PDUs" }, estimated_duration_days: 20, depends_on: ["switchgear"], trade_key: "electrical", discipline: "Electrical" },
      ],
    },
    {
      key: "mechanical",
      title_i18n: { en: "Mechanical & Cooling", es: "Mecánico y Enfriamiento" },
      icon_key: "loop",
      tasks: [
        { key: "cooling-units", title_i18n: { en: "Cooling units & chillers", es: "Unidades de enfriamiento y chillers" }, estimated_duration_days: 25, depends_on: ["structure"], trade_key: "mechanical", discipline: "Mechanical" },
        { key: "fire-suppression", title_i18n: { en: "Fire suppression system", es: "Sistema de supresión de incendios" }, estimated_duration_days: 15, depends_on: ["structure"], trade_key: "fire_protection", discipline: "Mechanical" },
      ],
    },
    {
      key: "network",
      title_i18n: { en: "Network & Fiber", es: "Red y Fibra" },
      icon_key: "link",
      tasks: [
        { key: "cable-trays", title_i18n: { en: "Cable trays & pathways", es: "Bandejas portacables y rutas" }, estimated_duration_days: 15, depends_on: ["power-distribution"], trade_key: "low_voltage", discipline: "Low Voltage" },
        { key: "structured-cabling", title_i18n: { en: "Structured cabling & fiber", es: "Cableado estructurado y fibra" }, estimated_duration_days: 20, depends_on: ["cable-trays"], trade_key: "low_voltage", discipline: "Low Voltage" },
      ],
    },
    {
      key: "security",
      title_i18n: { en: "Security Systems", es: "Sistemas de Seguridad" },
      icon_key: "shield_database",
      tasks: [
        { key: "access-control", title_i18n: { en: "Access control & CCTV", es: "Control de acceso y CCTV" }, estimated_duration_days: 12, depends_on: ["structured-cabling"], trade_key: "security", discipline: "Low Voltage" },
      ],
    },
    {
      key: "racks",
      title_i18n: { en: "Rack Installation", es: "Instalación de Racks" },
      icon_key: "chart",
      tasks: [
        { key: "rack-install", title_i18n: { en: "Rack & PDU installation", es: "Instalación de racks y PDUs" }, estimated_duration_days: 15, depends_on: ["power-distribution", "cooling-units", "structured-cabling"], trade_key: "low_voltage" },
      ],
    },
    {
      key: "commissioning",
      title_i18n: { en: "Testing & Commissioning", es: "Pruebas y Commissioning" },
      icon_key: "check_circle",
      tasks: [
        { key: "l3-testing", title_i18n: { en: "L3 pre-functional testing", es: "Pruebas pre-funcionales L3" }, estimated_duration_days: 10, depends_on: ["rack-install", "generators", "fire-suppression"], trade_key: "commissioning" },
        { key: "l5-integrated", title_i18n: { en: "L5 integrated systems test", es: "Prueba de sistemas integrados L5" }, estimated_duration_days: 10, depends_on: ["l3-testing"], trade_key: "commissioning" },
      ],
    },
    {
      key: "handover",
      title_i18n: { en: "Handover", es: "Entrega" },
      icon_key: "rocket",
      tasks: [
        { key: "handover", title_i18n: { en: "Owner handover & documentation", es: "Entrega al propietario y documentación" }, estimated_duration_days: 5, depends_on: ["l5-integrated", "access-control"] },
      ],
    },
  ],
  resources: [
    { name: "Electrical Crew A", resource_type: "crew", trade_key: "electrical" },
    { name: "Mechanical Crew", resource_type: "crew", trade_key: "mechanical" },
    { name: "Low Voltage Crew", resource_type: "crew", trade_key: "low_voltage" },
    { name: "Commissioning Agent", resource_type: "person", trade_key: "commissioning" },
    { name: "UPS Units", resource_type: "material" },
    { name: "Generators", resource_type: "material" },
    { name: "Server Racks", resource_type: "material" },
    { name: "CAT6A Cable", resource_type: "material" },
    { name: "Cooling Units (CRAH)", resource_type: "material" },
    { name: "Crane", resource_type: "equipment" },
  ],
  budget_lines: [
    { name_i18n: { en: "Electrical labor & equipment", es: "Mano de obra y equipos eléctricos" }, category: "labor" },
    { name_i18n: { en: "Mechanical & cooling", es: "Mecánico y enfriamiento" }, category: "material" },
    { name_i18n: { en: "Network & fiber materials", es: "Materiales de red y fibra" }, category: "material" },
    { name_i18n: { en: "Subcontractors", es: "Subcontratistas" }, category: "subcontractor" },
    { name_i18n: { en: "Permits & inspections", es: "Permisos e inspecciones" }, category: "permit" },
    { name_i18n: { en: "Contingency", es: "Contingencia" }, category: "contingency" },
  ],
  risks: [
    { title_i18n: { en: "Long-lead equipment delay (UPS, generators, chillers)", es: "Retraso de equipos de largo plazo (UPS, generadores, chillers)" }, category: "material", severity: "critical" },
    { title_i18n: { en: "Specialized labor shortage (electricians, commissioning)", es: "Escasez de mano de obra especializada (electricistas, commissioning)" }, category: "labor", severity: "high" },
    { title_i18n: { en: "Utility power availability delay", es: "Retraso en disponibilidad de energía de la red" }, category: "external", severity: "high" },
  ],
};

// ── Residential Construction ────────────────────────────────────────────────

const RESIDENTIAL_TEMPLATE: ProjectTemplate = {
  project_type: "residential_construction",
  name_i18n: { en: "Residential House Construction", es: "Construcción de Vivienda Residencial" },
  description_i18n: {
    en: "Design/Permits → Site Prep → Foundation → Framing → Roofing → MEP Rough-In → Insulation/Drywall → Finishes → Exterior → Final Inspection",
    es: "Diseño/Permisos → Preparación → Cimentación → Estructura → Techado → MEP → Aislamiento/Drywall → Acabados → Exteriores → Inspección Final",
  },
  phases: [
    {
      key: "design-permits",
      title_i18n: { en: "Design and Permits", es: "Diseño y Permisos" },
      icon_key: "notebook",
      tasks: [
        { key: "house-permits", title_i18n: { en: "Building permit approval", es: "Aprobación del permiso de construcción" }, estimated_duration_days: 20 },
      ],
    },
    {
      key: "site-prep",
      title_i18n: { en: "Site Preparation", es: "Preparación del Sitio" },
      icon_key: "setup",
      tasks: [
        { key: "clearing", title_i18n: { en: "Site clearing & excavation", es: "Limpieza del terreno y excavación" }, estimated_duration_days: 5, depends_on: ["house-permits"], trade_key: "civil" },
      ],
    },
    {
      key: "foundation",
      title_i18n: { en: "Foundation", es: "Cimentación" },
      icon_key: "shield_database",
      tasks: [
        { key: "footings", title_i18n: { en: "Footings & foundation pour", es: "Zapatas y vaciado de cimentación" }, estimated_duration_days: 10, depends_on: ["clearing"], trade_key: "concrete" },
        { key: "foundation-inspection", title_i18n: { en: "Foundation inspection", es: "Inspección de cimentación" }, estimated_duration_days: 1, depends_on: ["footings"] },
      ],
    },
    {
      key: "framing",
      title_i18n: { en: "Framing", es: "Estructura" },
      icon_key: "chart",
      tasks: [
        { key: "framing", title_i18n: { en: "Wall & roof framing", es: "Estructura de muros y techo" }, estimated_duration_days: 15, depends_on: ["foundation-inspection"], trade_key: "framing" },
      ],
    },
    {
      key: "roofing",
      title_i18n: { en: "Roofing", es: "Techado" },
      icon_key: "setup",
      tasks: [
        { key: "roofing", title_i18n: { en: "Roofing & waterproofing", es: "Techado e impermeabilización" }, estimated_duration_days: 7, depends_on: ["framing"], trade_key: "roofing" },
      ],
    },
    {
      key: "mep",
      title_i18n: { en: "MEP Rough-In", es: "Instalaciones MEP" },
      icon_key: "loop",
      tasks: [
        { key: "plumbing-rough", title_i18n: { en: "Plumbing rough-in", es: "Instalación hidrosanitaria" }, estimated_duration_days: 7, depends_on: ["roofing"], trade_key: "plumbing" },
        { key: "electrical-rough", title_i18n: { en: "Electrical rough-in", es: "Instalación eléctrica" }, estimated_duration_days: 7, depends_on: ["roofing"], trade_key: "electrical" },
        { key: "hvac-rough", title_i18n: { en: "HVAC rough-in", es: "Instalación HVAC" }, estimated_duration_days: 7, depends_on: ["roofing"], trade_key: "mechanical" },
        { key: "mep-inspection", title_i18n: { en: "MEP inspection", es: "Inspección MEP" }, estimated_duration_days: 1, depends_on: ["plumbing-rough", "electrical-rough", "hvac-rough"] },
      ],
    },
    {
      key: "insulation-drywall",
      title_i18n: { en: "Insulation and Drywall", es: "Aislamiento y Drywall" },
      icon_key: "setup",
      tasks: [
        { key: "insulation", title_i18n: { en: "Insulation", es: "Aislamiento" }, estimated_duration_days: 4, depends_on: ["mep-inspection"], trade_key: "insulation" },
        { key: "drywall", title_i18n: { en: "Drywall & taping", es: "Drywall y encintado" }, estimated_duration_days: 10, depends_on: ["insulation"], trade_key: "drywall" },
      ],
    },
    {
      key: "finishes",
      title_i18n: { en: "Interior Finishes", es: "Acabados Interiores" },
      icon_key: "sparkles",
      tasks: [
        { key: "interior-finishes", title_i18n: { en: "Paint, flooring, trim, fixtures", es: "Pintura, pisos, molduras y accesorios" }, estimated_duration_days: 20, depends_on: ["drywall"], trade_key: "finishes" },
      ],
    },
    {
      key: "exterior",
      title_i18n: { en: "Exterior Works", es: "Obras Exteriores" },
      icon_key: "chart",
      tasks: [
        { key: "exterior", title_i18n: { en: "Siding, driveway, landscaping", es: "Fachada, acceso vehicular y paisajismo" }, estimated_duration_days: 12, depends_on: ["roofing"], trade_key: "civil" },
      ],
    },
    {
      key: "final",
      title_i18n: { en: "Final Inspection and Handover", es: "Inspección Final y Entrega" },
      icon_key: "check_circle",
      tasks: [
        { key: "final-inspection", title_i18n: { en: "Final inspection & certificate of occupancy", es: "Inspección final y certificado de ocupación" }, estimated_duration_days: 3, depends_on: ["interior-finishes", "exterior"] },
      ],
    },
  ],
  resources: [
    { name: "Framing Crew", resource_type: "crew", trade_key: "framing" },
    { name: "Electrician Crew", resource_type: "crew", trade_key: "electrical" },
    { name: "Plumbing Subcontractor", resource_type: "subcontractor", trade_key: "plumbing" },
    { name: "HVAC Contractor", resource_type: "subcontractor", trade_key: "mechanical" },
    { name: "Concrete", resource_type: "material" },
    { name: "Lumber", resource_type: "material" },
    { name: "Shingles", resource_type: "material" },
    { name: "Drywall Sheets", resource_type: "material" },
    { name: "HVAC Unit", resource_type: "material" },
    { name: "Excavator", resource_type: "equipment" },
  ],
  budget_lines: [
    { name_i18n: { en: "Foundation & structure", es: "Cimentación y estructura" }, category: "material" },
    { name_i18n: { en: "MEP systems", es: "Sistemas MEP" }, category: "subcontractor" },
    { name_i18n: { en: "Finishes", es: "Acabados" }, category: "material" },
    { name_i18n: { en: "Labor", es: "Mano de obra" }, category: "labor" },
    { name_i18n: { en: "Permits & inspections", es: "Permisos e inspecciones" }, category: "permit" },
    { name_i18n: { en: "Contingency", es: "Contingencia" }, category: "contingency" },
  ],
  risks: [
    { title_i18n: { en: "Permit approval delay", es: "Retraso en aprobación de permisos" }, category: "permit", severity: "high" },
    { title_i18n: { en: "Material price escalation (lumber, concrete)", es: "Escalada de precios de materiales (madera, concreto)" }, category: "budget", severity: "medium" },
    { title_i18n: { en: "Weather delays during framing/roofing", es: "Retrasos por clima durante estructura/techado" }, category: "external", severity: "medium" },
    { title_i18n: { en: "Failed inspection requiring rework", es: "Inspección fallida que requiere retrabajo" }, category: "quality", severity: "medium" },
  ],
};

// ── Catalog ─────────────────────────────────────────────────────────────────

export const PROJECT_TEMPLATES: Partial<Record<ProjectType, ProjectTemplate>> = {
  software_development: SOFTWARE_TEMPLATE,
  data_center_construction: DATA_CENTER_TEMPLATE,
  residential_construction: RESIDENTIAL_TEMPLATE,
};

export function getTemplateForType(type: ProjectType): ProjectTemplate | null {
  return PROJECT_TEMPLATES[type] ?? null;
}
