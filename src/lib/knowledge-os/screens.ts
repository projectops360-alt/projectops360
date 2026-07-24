// ============================================================================
// ProjectOps360° — Knowledge OS — Screen Intelligence registry (client-safe)
// ============================================================================
// Phase 1.2. Maps the current route to a human description of the screen the
// user is actually looking at: module, title, primary workflow, the UI
// components that are visible, and screen-specific follow-up questions.
//
// This is what lets Isabella answer "Explain this screen" about the ACTUAL page
// instead of generic documentation, name the visible buttons/cards/tables, and
// suggest contextual next questions.
//
// Pure data + pure functions. No server imports, no business knowledge — only a
// description of the UI surface. Extend by adding an entry; matching is by the
// longest route prefix, so specific routes win over general ones.
// ============================================================================

import type { Locale } from "@/types/database";
import type { GuideContext } from "./types";

type Bi = { en: string; es: string };
type BiList = { en: string[]; es: string[] };

export interface ScreenDefinition {
  /** Route prefix this screen matches (locale already stripped). */
  match: string;
  /**
   * When set, this screen matches a project sub-route — the segment AFTER the
   * projectId, e.g. `/projects/{id}/closeout` → "closeout". This is how
   * per-project screens (which all share the `/projects/{id}` prefix) get a
   * specific identity instead of collapsing to the generic Projects screen.
   */
  projectSubroute?: string;
  module: string;
  screen: string;
  title: Bi;
  workflow: Bi;
  /** Visible UI components — used for component awareness in explanations. */
  components: BiList;
  /** Screen-specific suggested follow-up questions. */
  followups: BiList;
}

/**
 * Registry of known screens. Order does not matter — `resolveScreen` picks the
 * longest matching prefix. Keep titles short and human; keep components to what
 * is actually rendered so Isabella never invents UI.
 */
export const SCREEN_REGISTRY: ScreenDefinition[] = [
  {
    match: "/projects",
    projectSubroute: "budget",
    module: "financial_control",
    screen: "financial_setup",
    title: { en: "Financial Setup", es: "Configuración financiera" },
    workflow: {
      en: "Build the PMO cost estimate, assign reusable resource rates, planned hours and cadence, then submit the draft for governed review and baseline approval.",
      es: "Construir el estimado de costos PMO, asignar tarifas reutilizables de recursos, horas planificadas y cadencia, y enviar el borrador a revisión y aprobación del baseline.",
    },
    components: {
      en: [
        "Estimate title, purpose, currency, AACE class, base date and cutoff date",
        "Cost-plan lines with type, resource/rate, quantity, rate basis, periods, cadence, unit and planned hours",
        "Control-account, CBS and WBS traceability references",
        "Manage rates, SAP/software categories, add line, save draft and submit for review actions",
      ],
      es: [
        "Título, propósito, moneda, clase AACE, fecha base y fecha de corte del estimado",
        "Líneas del plan de costos con tipo, recurso/tarifa, cantidad, base de tarifa, periodos, cadencia, unidad y horas planificadas",
        "Referencias de trazabilidad de cuenta de control, CBS y WBS",
        "Acciones Gestionar tarifas, categorías SAP/software, agregar línea, guardar borrador y enviar a revisión",
      ],
    },
    followups: {
      en: ["How do I create a labor cost line?", "Where do I manage a person's rate?", "What happens after I submit the estimate for review?"],
      es: ["¿Cómo creo una línea de costo de mano de obra?", "¿Dónde gestiono la tarifa de una persona?", "¿Qué ocurre después de enviar el estimado a revisión?"],
    },
  },
  {
    match: "/process-intelligence",
    module: "process_mining",
    screen: "process_intelligence_canvas",
    title: {
      en: "PMO Process Intelligence Canvas",
      es: "Canvas PMO de Process Intelligence",
    },
    workflow: {
      en: "Navigate the authorized organization process from five executive stages into projects, milestones and activities while preserving filters, evidence and analytical layers.",
      es: "Navegar el proceso autorizado de la organización desde cinco etapas ejecutivas hasta proyectos, hitos y actividades, conservando filtros, evidencia y capas analíticas.",
    },
    components: {
      en: [
        "Interactive React Flow canvas with pan, zoom, drag, selection and semantic zoom",
        "Initiate, Plan, Execute, Control and Close process supernodes",
        "Process, Finance, Risk, Resources, Dependencies, Benefits and What-if layers",
        "Search and focus, breadcrumbs, minimap, fit view and saved layouts",
        "Node and connection evidence drawers with Isabella screen context",
      ],
      es: [
        "Canvas interactivo React Flow con pan, zoom, arrastre, selección y zoom semántico",
        "Supernodos Iniciar, Planificar, Ejecutar, Controlar y Cerrar",
        "Capas Proceso, Finanzas, Riesgos, Recursos, Dependencias, Beneficios y What-if",
        "Búsqueda y enfoque, breadcrumbs, minimapa, fit view y layouts guardados",
        "Drawers de evidencia para nodos y conexiones con contexto de Isabella",
      ],
    },
    followups: {
      en: [
        "How many nodes are visible?",
        "Which visible node is performing worst?",
        "Explain the node I am pointing to.",
      ],
      es: [
        "¿Cuántos nodos hay visibles?",
        "¿Cuál nodo visible está peor?",
        "Explícame el nodo que estoy señalando.",
      ],
    },
  },
  {
    match: "/projects",
    projectSubroute: "execution-map",
    module: "process_mining",
    screen: "process_mining_layer",
    title: { en: "Execution Map - Process Mining Layer", es: "Mapa de Ejecucion - Capa de Process Mining" },
    workflow: {
      en: "Read execution from canonical task and milestone cases, aggregated process paths, milestone transitions, variants, statistical associations, and governed KPIs without turning visual layout into truth.",
      es: "Leer la ejecucion desde casos canonicos de tareas e hitos, rutas agregadas, transiciones entre hitos, variantes, asociaciones estadisticas y KPIs gobernados sin convertir el diseno visual en verdad.",
    },
    components: {
      en: [
        "Living Graph views: Task cases, Process, Full audit",
        "Search, level, overlay, layout, filters, simplified edges, focus and Insights controls",
        "Milestone Flow transition health, delay, rework and bottleneck findings",
        "Execution Variants with frequency, coverage and outcome-aware comparison",
        "Statistical Root Cause Miner with influence, lift, sample size and confidence",
        "KPI catalog and sandboxed custom KPI evaluation",
      ],
      es: [
        "Vistas del Living Graph: Casos de tarea, Proceso y Auditoria completa",
        "Busqueda, nivel, overlay, layout, filtros, conexiones simplificadas, foco e Insights",
        "Flujo entre hitos con salud de transicion, retrasos, retrabajo y cuellos de botella",
        "Variantes de ejecucion con frecuencia, cobertura y comparacion basada en resultados",
        "Root Cause Miner estadistico con influencia, lift, muestra y confianza",
        "Catalogo KPI y evaluacion segura de KPIs personalizados",
      ],
    },
    followups: {
      en: ["What is the difference between Task cases, Process and Full audit?", "Show the milestone-to-milestone flow", "Which findings are derived rather than canonical?"],
      es: ["Cual es la diferencia entre Casos de tarea, Proceso y Auditoria?", "Muestrame el flujo de hito a hito", "Cuales hallazgos son derivados y no canonicos?"],
    },
  },
  {
    match: "/team",
    module: "people_permissions",
    screen: "team_directory",
    title: { en: "People & Team", es: "Personas y Equipo" },
    workflow: {
      en: "Manage who is in this workspace, their roles and access, and the people/crews available to projects.",
      es: "Gestionar quién está en este espacio de trabajo, sus roles y acceso, y las personas/cuadrillas disponibles para los proyectos.",
    },
    components: {
      en: ["Workspace users cards", "\"Manage user\" button", "\"Create login\" dialog", "Resources/crew list", "Role and seat badges"],
      es: ["Tarjetas de usuarios del workspace", "Botón \"Gestionar usuario\"", "Diálogo \"Crear acceso\"", "Lista de recursos/cuadrillas", "Insignias de rol y asiento"],
    },
    followups: {
      en: ["How do I add a new member?", "What can each role do here?", "How do I reset someone's password?"],
      es: ["¿Cómo agrego un nuevo miembro?", "¿Qué puede hacer cada rol aquí?", "¿Cómo restablezco la contraseña de alguien?"],
    },
  },
  {
    match: "/organization/members",
    module: "people_permissions",
    screen: "organization_members",
    title: { en: "Organization Members", es: "Miembros de la organización" },
    workflow: {
      en: "Invite, edit and remove organization members and set their workspace role and billing seat.",
      es: "Invitar, editar y quitar miembros de la organización y definir su rol de workspace y asiento de facturación.",
    },
    components: {
      en: ["Members table", "Role selector", "Seat type selector", "Status filter", "Invite/Create member action"],
      es: ["Tabla de miembros", "Selector de rol", "Selector de tipo de asiento", "Filtro de estado", "Acción Invitar/Crear miembro"],
    },
    followups: {
      en: ["What is the difference between a seat and a role?", "How do I change someone's permissions?"],
      es: ["¿Cuál es la diferencia entre asiento y rol?", "¿Cómo cambio los permisos de alguien?"],
    },
  },
  {
    match: "/organization/teams",
    module: "teams",
    screen: "company_teams",
    title: { en: "Company Teams", es: "Equipos de la empresa" },
    workflow: {
      en: "Group people into reusable company teams you can assign to projects.",
      es: "Agrupar personas en equipos reutilizables que puedes asignar a proyectos.",
    },
    components: {
      en: ["Team cards", "Add team button", "Team member chips"],
      es: ["Tarjetas de equipo", "Botón Agregar equipo", "Etiquetas de miembros del equipo"],
    },
    followups: {
      en: ["How do teams relate to project roles?", "Can one person be on several teams?"],
      es: ["¿Cómo se relacionan los equipos con los roles de proyecto?", "¿Una persona puede estar en varios equipos?"],
    },
  },
  {
    match: "/organization/billing",
    module: "billing",
    screen: "billing",
    title: { en: "Billing & Plan", es: "Facturación y plan" },
    workflow: {
      en: "Review the plan, seats in use, and entitlements for this organization.",
      es: "Revisar el plan, los asientos en uso y los beneficios de esta organización.",
    },
    components: {
      en: ["Plan summary", "Seat usage", "Entitlements list", "Upgrade action"],
      es: ["Resumen del plan", "Uso de asientos", "Lista de beneficios", "Acción de mejora de plan"],
    },
    followups: {
      en: ["What happens if I run out of seats?", "How are seats counted?"],
      es: ["¿Qué pasa si me quedo sin asientos?", "¿Cómo se cuentan los asientos?"],
    },
  },
  {
    match: "/projects",
    module: "projects",
    screen: "projects_list",
    title: { en: "Projects", es: "Proyectos" },
    workflow: {
      en: "Browse, open and create the projects in this workspace.",
      es: "Explorar, abrir y crear los proyectos de este espacio de trabajo.",
    },
    components: {
      en: ["Project cards", "Create project button", "Status and health badges"],
      es: ["Tarjetas de proyecto", "Botón Crear proyecto", "Insignias de estado y salud"],
    },
    followups: {
      en: ["How do I start a new project?", "What does project health mean?"],
      es: ["¿Cómo inicio un nuevo proyecto?", "¿Qué significa la salud del proyecto?"],
    },
  },
  {
    // ISABELLA-SCREEN-CONTEXT-EXPLANATION — the project participants screen
    // (Resources / "Who participates in this project?"). Without this entry the
    // route `/projects/{id}/team` fell through to the generic Projects list, so
    // "Explain this screen" wrongly described "Open Projects" (P0 regression).
    match: "/projects",
    projectSubroute: "team",
    module: "project_team",
    screen: "project_participants",
    title: { en: "Team & Roles — Who participates", es: "Equipo y Roles — Quién participa" },
    workflow: {
      en: "Define who participates in this project, in which role, with what permission and access — from the Directory, a Company team, an External contact, an email invite, or a manual role.",
      es: "Definir quién participa en este proyecto, con qué rol, permiso y acceso — desde el Directorio, un Equipo de empresa, un Contacto externo, una invitación por correo o un rol manual.",
    },
    components: {
      en: [
        "\"Who participates in this project?\" panel",
        "Add participant source tabs: Directory, Company team, External contact, Invite by email, Manual role",
        "AI role recommendation button",
        "Members table — columns: Member, Type, Role / Delivery / Governance, Permission, Access",
        "\"Unassigned\" member = role slot with no person assigned yet (\"Role missing assignment\")",
        "RACI matrix and Stakeholder access sections",
      ],
      es: [
        "Panel \"¿Quién participa en este proyecto?\"",
        "Pestañas de origen: Directorio, Equipo de empresa, Contacto externo, Invitar por correo, Rol manual",
        "Botón Recomendar roles con IA",
        "Tabla de miembros — columnas: Miembro, Tipo, Rol / Entrega / Gobernanza, Permiso, Accesos",
        "\"Sin asignar\" en Miembro = rol sin persona asignada aún (\"Rol pendiente de asignar persona\")",
        "Secciones de matriz RACI y acceso de stakeholders",
      ],
    },
    followups: {
      en: ["What does \"Unassigned\" mean here?", "How do I add a participant?", "What is the difference between Permission and Access?"],
      es: ["¿Qué significa \"Sin asignar\" aquí?", "¿Cómo agrego un participante?", "¿Cuál es la diferencia entre Permiso y Accesos?"],
    },
  },
  {
    // REG-016/REG-017 — Isabella must understand the Closeout Report screen and
    // its record-backed readiness, especially the "Risks resolved" blocker.
    match: "/projects",
    projectSubroute: "closeout",
    module: "closeout",
    screen: "closeout_report",
    title: { en: "Closeout Report", es: "Reporte de Cierre" },
    workflow: {
      en: "Verify closeout readiness, resolve blocking requirements (open risks, open tasks, blockers), run the Closing Project meeting, generate the AI executive summary, and export the report.",
      es: "Verificar la preparación para el cierre, resolver requisitos bloqueantes (riesgos abiertos, tareas abiertas, bloqueos), ejecutar la reunión de Cierre del Proyecto, generar el resumen ejecutivo con IA y exportar el reporte.",
    },
    components: {
      en: ["Closeout process / step rail", "Readiness gate with per-requirement checks", "\"Risks resolved\" row with inline open-risk list (View risks)", "Live metric cards", "Generate Executive Summary / Download PDF actions"],
      es: ["Proceso de cierre / barra de pasos", "Compuerta de preparación con verificaciones por requisito", "Fila \"Riesgos resueltos\" con lista de riesgos abiertos inline (Ver riesgos)", "Tarjetas de métricas en vivo", "Acciones Generar resumen ejecutivo / Descargar PDF"],
    },
    followups: {
      en: ["Which requirements are blocking closeout?", "Show me the open risks blocking closeout", "Why is the report not ready yet?"],
      es: ["¿Qué requisitos están bloqueando el cierre?", "Muéstrame los riesgos abiertos que bloquean el cierre", "¿Por qué el reporte aún no está listo?"],
    },
  },
  {
    match: "/import",
    module: "import",
    screen: "project_import",
    title: { en: "Project Import", es: "Importar proyecto" },
    workflow: {
      en: "Bring an existing plan into ProjectOps360 from a spreadsheet or document and review what was extracted.",
      es: "Traer un plan existente a ProjectOps360 desde una hoja de cálculo o documento y revisar lo extraído.",
    },
    components: {
      en: ["File uploader", "Extraction preview", "Mapping step", "Confirm/rollback action"],
      es: ["Cargador de archivos", "Vista previa de extracción", "Paso de mapeo", "Acción Confirmar/revertir"],
    },
    followups: {
      en: ["Which file formats are supported?", "Can I undo an import?"],
      es: ["¿Qué formatos de archivo se admiten?", "¿Puedo deshacer una importación?"],
    },
  },
  {
    match: "/settings",
    module: "settings",
    screen: "settings",
    title: { en: "Settings", es: "Configuración" },
    workflow: {
      en: "Adjust your account and workspace preferences.",
      es: "Ajustar tus preferencias de cuenta y de espacio de trabajo.",
    },
    components: {
      en: ["Settings sections", "Preference toggles", "Save action"],
      es: ["Secciones de configuración", "Interruptores de preferencias", "Acción Guardar"],
    },
    followups: {
      en: ["How do I change the workspace language?", "Where do I manage notifications?"],
      es: ["¿Cómo cambio el idioma del espacio de trabajo?", "¿Dónde gestiono las notificaciones?"],
    },
  },
];

export interface ResolvedScreen {
  module: string;
  screen: string;
  pageTitle: string;
  workflow: string;
  components: string[];
  followups: string[];
}

/**
 * Extract the projectId from a route when the user is inside a project, e.g.
 * `/projects/{id}/workboard` or `/es/projects/{id}`. Returns null otherwise.
 * This is what lets Isabella detect she is inside a project context (REG-013)
 * so she can open with a proactive Project Health Briefing.
 */
export function extractProjectId(pathname: string): string | null {
  const path = stripLocale(pathname);
  const m = /^\/projects\/([^/]+)(?:\/|$)/.exec(path);
  const id = m?.[1];
  if (!id || id === "new") return null;
  return id;
}

/**
 * The project sub-route segment (after the projectId), e.g.
 * `/projects/{id}/closeout` → "closeout", `/projects/{id}` → null.
 */
export function projectSubroute(pathname: string): string | null {
  const path = stripLocale(pathname);
  const m = /^\/projects\/[^/]+\/([^/]+)/.exec(path);
  return m?.[1] ?? null;
}

/** Strip the optional `/{locale}` prefix and trailing slash from a pathname. */
function stripLocale(pathname: string): string {
  let p = pathname.replace(/^\/(en|es)(?=\/|$)/, "");
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/**
 * Resolve a route into a localized screen description. Picks the longest
 * matching prefix; returns `null` when no entry matches (the caller then keeps
 * whatever server-provided context it already has).
 */
export function resolveScreen(pathname: string, locale: Locale): ResolvedScreen | null {
  const path = stripLocale(pathname);

  // A project sub-route screen (e.g. closeout) wins over the generic Projects
  // entry so Isabella gets the specific screen identity (REG-016/REG-017).
  const sub = projectSubroute(pathname);
  if (sub) {
    const subDef = SCREEN_REGISTRY.find((d) => d.projectSubroute === sub);
    if (subDef) return localizeScreen(subDef, locale);
  }

  let best: ScreenDefinition | null = null;
  for (const def of SCREEN_REGISTRY) {
    if (def.projectSubroute) continue; // sub-route entries are matched above only
    if (path === def.match || path.startsWith(`${def.match}/`) || (def.match === "/projects" && path.startsWith("/projects"))) {
      if (!best || def.match.length > best.match.length) best = def;
    }
  }
  if (!best) return null;
  return localizeScreen(best, locale);
}

function localizeScreen(def: ScreenDefinition, locale: Locale): ResolvedScreen {
  const k: "en" | "es" = locale === "es" ? "es" : "en";
  return {
    module: def.module,
    screen: def.screen,
    pageTitle: def.title[k],
    workflow: def.workflow[k],
    components: def.components[k],
    followups: def.followups[k],
  };
}

/**
 * Merge a resolved screen into a base GuideContext. Server-provided fields win
 * for identity (org/user/role/permissions); the screen fills in the
 * presentation-side awareness (title, workflow, components) when available.
 */
export function enrichContextWithScreen(base: GuideContext, resolved: ResolvedScreen | null, pathname: string): GuideContext {
  // Always derive the project context from the route so Isabella knows when she
  // is inside a project (REG-013) — the server-provided base context does not
  // carry the projectId.
  const projectId = base.projectId || extractProjectId(pathname) || undefined;
  if (!resolved) return { ...base, pathname, projectId };
  return {
    ...base,
    pathname,
    projectId,
    module: base.module || resolved.module,
    screen: base.screen || resolved.screen,
    pageTitle: resolved.pageTitle,
    workflow: resolved.workflow,
    components: resolved.components,
  };
}
