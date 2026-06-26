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
  let best: ScreenDefinition | null = null;
  for (const def of SCREEN_REGISTRY) {
    if (path === def.match || path.startsWith(`${def.match}/`) || (def.match === "/projects" && path.startsWith("/projects"))) {
      if (!best || def.match.length > best.match.length) best = def;
    }
  }
  if (!best) return null;
  const k: "en" | "es" = locale === "es" ? "es" : "en";
  return {
    module: best.module,
    screen: best.screen,
    pageTitle: best.title[k],
    workflow: best.workflow[k],
    components: best.components[k],
    followups: best.followups[k],
  };
}

/**
 * Merge a resolved screen into a base GuideContext. Server-provided fields win
 * for identity (org/user/role/permissions); the screen fills in the
 * presentation-side awareness (title, workflow, components) when available.
 */
export function enrichContextWithScreen(base: GuideContext, resolved: ResolvedScreen | null, pathname: string): GuideContext {
  if (!resolved) return { ...base, pathname };
  return {
    ...base,
    pathname,
    module: base.module || resolved.module,
    screen: base.screen || resolved.screen,
    pageTitle: resolved.pageTitle,
    workflow: resolved.workflow,
    components: resolved.components,
  };
}
