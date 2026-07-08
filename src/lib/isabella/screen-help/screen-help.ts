// ============================================================================
// ProjectOps360° — Isabella · deterministic Screen-Context Help
// ============================================================================
// ISABELLA-SCREEN-CONTEXT-EXPLANATION (P0 routing fix)
//
// A question about the VISIBLE screen — its purpose, its table columns, its
// buttons, or a UI term such as "Unassigned", "Member", "Permission",
// "Access" — must be answered from SCREEN CONTEXT, never from the Daily
// Diagnosis / Root Cause / Recommendation engines. This module is the
// deterministic content source for those answers. Pure + bilingual; no server
// imports, no data access, never mutates.
//
// It also encodes the DOMAIN DISTINCTION that caused the reported bug:
//   • Resources participants screen → "Unassigned" = a project ROLE SLOT with
//     no person assigned yet ("Role missing assignment").
//   • Task detail / Workboard        → "Unassigned" = a TASK with no owner.
// These are never conflated.
// ============================================================================

/** Minimal screen-context shape (kept independent of the runtime types). */
export interface ScreenHelpContext {
  module?: string;
  screen?: string;
  pathname?: string;
  tab?: string;
}

/** The content areas we can explain deterministically today. */
export type ScreenHelpArea = "resources" | "task" | "unknown" | "other";

/** A UI term the user might ask the meaning of. */
type ScreenHelpTerm = "screen" | "unassigned" | "member" | "type" | "role" | "permission" | "access";

export interface ScreenHelpAnswer {
  answer: string;
  area: ScreenHelpArea;
  term: ScreenHelpTerm;
  /**
   * True only when the answer is grounded in a KNOWN screen (never generic).
   * When false the answer is a safety clarification and the caller MUST NOT
   * present it as "Verified 100%".
   */
  confident: boolean;
}

function norm(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").trim();
}

// ── Intent detection ─────────────────────────────────────────────────────────
// "Explain this screen" (the seeded button sends the literal token
// `explain_screen`), plus "what does X mean / qué significa X" for UI terms,
// plus "explain this field/column/button/badge".
const RE_EXPLAIN_SCREEN =
  /explain[_\s]+(this\s+)?(screen|page)|explain_screen|expl[ií]ca(me)?\s+(esta\s+)?pantalla|qu[eé]\s+(es|hace|muestra|veo\s+en)\s+esta\s+pantalla|what('?s| is)\s+this\s+(screen|page)/i;
const RE_TERM_MEANING =
  /what\s+does\s+.+\s+mean|what('?s| is)\s+the\s+meaning|meaning\s+of|qu[eé]\s+significa|significa\s+que|expl[ií]ca(me)?\s+qu[eé]\s+significa|expl[ií]ca(me)?\s+(este|esta|el|la|los|las)\s+(campo|columna|bot[oó]n|badge|insignia|permiso|acceso|t[eé]rmino|etiqueta)|explain\s+(this\s+)?(field|column|button|badge|term|label)/i;

/** Whether a question is asking about the visible screen / a UI label. */
export function isScreenExplanationIntent(question: string): boolean {
  const q = (question ?? "").trim();
  if (!q) return false;
  return RE_EXPLAIN_SCREEN.test(q) || RE_TERM_MEANING.test(q);
}

/** Resolve the deterministic content area from the (client-supplied) screen. */
export function resolveScreenArea(ctx: ScreenHelpContext | undefined): ScreenHelpArea {
  const blob = norm(`${ctx?.screen ?? ""} ${ctx?.module ?? ""} ${ctx?.pathname ?? ""} ${ctx?.tab ?? ""}`);
  if (!blob) return "unknown";
  // Task surfaces first (a task screen can live under /projects/.../workboard).
  if (/\btask_detail\b|\bsubtask\b|task[_-]?detail|workboard|kanban|\bboard\b|execution[_-]?map/.test(blob)) return "task";
  // Resources / project participants (route /projects/{id}/team; module project_team).
  if (/project_participants|project_team|team_roles|\bparticipa|\bresource|people_permissions|team_directory|\/team\b|\bteam\b/.test(blob)) return "resources";
  return "other";
}

function detectTerm(question: string): ScreenHelpTerm {
  const q = norm(question);
  if (RE_EXPLAIN_SCREEN.test(question)) return "screen";
  if (/unassigned|sin\s+asignar|missing\s+assignment|pendiente\s+de\s+asignar|owner\s+unassigned|sin\s+responsable|sin\s+due[nñ]o/.test(q)) return "unassigned";
  if (/\bmember\b|\bmiembro\b/.test(q)) return "member";
  if (/permission|permiso/.test(q)) return "permission";
  if (/\baccess\b|\bacceso(s)?\b/.test(q)) return "access";
  if (/\btype\b|\btipo\b/.test(q)) return "type";
  if (/\brole\b|\brol\b|delivery|entrega|governance|gobernanza/.test(q)) return "role";
  return "screen";
}

// ── Content (bilingual, deterministic) ───────────────────────────────────────

function resourcesContent(term: ScreenHelpTerm, es: boolean): string {
  switch (term) {
    case "unassigned":
      return es
        ? [
            "**Sin asignar (Unassigned)** en la tabla de participantes significa que **este rol del proyecto existe pero todavía no tiene una persona/usuario asignado**. Es un espacio de rol pendiente — por eso ves debajo “Rol pendiente de asignar persona”.",
            "",
            "Por ejemplo: *Project Manager*, *Business Analyst* o *QA Tester* pueden estar como espacios de rol que aún necesitan un miembro.",
            "",
            "Es **distinto** de una tarea sin responsable: aquí hablamos de un **rol de proyecto sin persona**, no de una tarea sin owner. Para asignar a alguien, edita la fila del rol y elige una persona del Directorio, Equipo de empresa o Contacto externo.",
          ].join("\n")
        : [
            "**Unassigned** in the participants table means **this project role exists but no person/user has been assigned to that role yet**. It is a pending role slot — that is why the row shows “Role missing assignment” underneath.",
            "",
            "For example: *Project Manager*, *Business Analyst* or *QA Tester* can appear as role slots that still need a member.",
            "",
            "This is **different** from a task with no owner: here we mean a **project role slot with no person**, not a task without a responsible person. To assign someone, edit the role row and pick a person from the Directory, Company team or External contact.",
          ].join("\n");
    case "member":
      return es
        ? "La columna **Miembro** muestra la persona asignada a ese rol del proyecto. Si aparece **Sin asignar**, el rol existe pero aún no tiene persona asignada."
        : "The **Member** column shows the person assigned to that project role. If it reads **Unassigned**, the role exists but no person has been assigned to it yet.";
    case "type":
      return es
        ? "La columna **Tipo** indica el origen del participante: usuario interno del Directorio, miembro de un Equipo de empresa, Contacto externo o invitado por correo."
        : "The **Type** column shows where the participant comes from: an internal Directory user, a Company team member, an External contact, or someone invited by email.";
    case "role":
      return es
        ? "La columna **Rol / Entrega / Gobernanza** captura los tres roles del participante: el rol de proyecto, su rol en la entrega y su rol de gobernanza (por ejemplo, aprobador)."
        : "The **Role / Delivery / Governance** column captures the participant's three roles: their project role, their delivery role, and their governance role (for example, approver).";
    case "permission":
      return es
        ? "La columna **Permiso** define el nivel de acceso del participante (qué puede ver y hacer en el proyecto). Cambiar el nivel aplica un conjunto de permisos predefinido."
        : "The **Permission** column sets the participant's access level (what they can see and do in the project). Changing the level applies a predefined permission preset.";
    case "access":
      return es
        ? "La columna **Accesos** muestra insignias con capacidades puntuales del participante — por ejemplo aprobar cambios, ver presupuesto, acceder a la Memoria o gestionar tareas."
        : "The **Access** column shows badges for specific capabilities — for example approve changes, view budget, access Memory, or manage tasks.";
    case "screen":
    default:
      return es
        ? [
            "Estás en **¿Quién participa en este proyecto?** (Equipo y Roles del proyecto). Aquí defines quién forma parte del proyecto, con qué rol y con qué acceso.",
            "",
            "**Cómo agregar un participante** — elige una fuente: **Directorio**, **Equipo de empresa**, **Contacto externo**, **Invitar por correo** o **Rol manual**; también puedes usar **Recomendar roles con IA**.",
            "",
            "**Columnas de la tabla:**",
            "- **Miembro** — la persona del rol (o **Sin asignar** si el rol aún no tiene persona).",
            "- **Tipo** — origen del participante (interno, equipo, contacto externo).",
            "- **Rol / Entrega / Gobernanza** — los tres roles del participante.",
            "- **Permiso** — nivel de acceso al proyecto.",
            "- **Accesos** — insignias de capacidades (aprobar, presupuesto, memoria, tareas).",
            "",
            "**Sin asignar** significa un rol sin persona asignada — no una tarea sin owner.",
          ].join("\n")
        : [
            "You're on **Who participates in this project?** (the project's Team & Roles). Here you define who is part of the project, in which role, and with what access.",
            "",
            "**Adding a participant** — pick a source: **Directory**, **Company team**, **External contact**, **Invite by email**, or **Manual role**; you can also use **AI role recommendation**.",
            "",
            "**Table columns:**",
            "- **Member** — the person in the role (or **Unassigned** when the role has no person yet).",
            "- **Type** — where the participant comes from (internal, team, external contact).",
            "- **Role / Delivery / Governance** — the participant's three roles.",
            "- **Permission** — their access level in the project.",
            "- **Access** — capability badges (approve, budget, memory, tasks).",
            "",
            "**Unassigned** means a role slot with no person assigned — not a task without an owner.",
          ].join("\n");
  }
}

function taskContent(term: ScreenHelpTerm, es: boolean): string {
  if (term === "unassigned") {
    return es
      ? "En una tarea, **sin responsable / unassigned** significa que **la tarea todavía no tiene owner (persona responsable)** asignado. Asigna a alguien para que quede claro quién la ejecuta. (Es distinto de un rol de proyecto sin persona en la pantalla de participantes.)"
      : "On a task, **unassigned** means **the task has no owner (responsible person)** assigned yet. Assign someone so it is clear who executes it. (This is different from a project role slot with no person on the participants screen.)";
  }
  return es
    ? "Esta pantalla muestra el detalle de la tarea y su ejecución. Puedo explicarte un campo específico — por ejemplo owner/responsable, estado, o bloqueos."
    : "This screen shows the task detail and its execution. I can explain a specific field — for example owner/responsible, status, or blockers.";
}

function safetyClarification(es: boolean): string {
  return es
    ? "Puede que no tenga el contexto de la pantalla actual. ¿Me preguntas por la tabla de participantes (Equipo y Roles) del proyecto?"
    : "I may not have the current screen context. Are you asking about the Resources participants table (project Team & Roles)?";
}

/**
 * Answer a screen-context / UI-label question deterministically. Never routes to
 * Daily Diagnosis. When the screen is unknown/ambiguous it returns a safety
 * clarification with `confident: false` (so the caller does NOT mark it verified).
 */
export function answerScreenHelp(
  question: string,
  ctx: ScreenHelpContext | undefined,
  language: "en" | "es",
): ScreenHelpAnswer {
  const es = language === "es";
  const area = resolveScreenArea(ctx);
  const term = detectTerm(question);

  if (area === "resources") return { answer: resourcesContent(term, es), area, term, confident: true };
  if (area === "task") return { answer: taskContent(term, es), area, term, confident: true };

  // Unknown or a screen we do not have deterministic content for → never guess.
  return { answer: safetyClarification(es), area, term, confident: false };
}
