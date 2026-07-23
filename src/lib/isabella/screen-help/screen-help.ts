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
export type ScreenHelpArea = "resources" | "task" | "process_mining" | "financial" | "unknown" | "other";

/** A UI term the user might ask the meaning of. */
type ScreenHelpTerm =
  | "screen"
  | "unassigned"
  | "member"
  | "type"
  | "role"
  | "permission"
  | "access"
  | "task_cases"
  | "process_view"
  | "full_audit"
  | "transition"
  | "integrity"
  | "variant"
  | "root_cause"
  | "kpi"
  | "baseline"
  | "funding"
  | "commitment"
  | "actual"
  | "accrual"
  | "payment"
  | "reserve"
  | "forecast"
  | "approval_queue"
  | "quality"
  | "setup";

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
  // Explicit task surfaces first; the Execution Map itself is Process Mining.
  if (/\btask_detail\b|\bsubtask\b|task[_-]?detail|workboard|kanban|\bboard\b/.test(blob)) return "task";
  if (/process[_-]?mining|living[_-]?graph|milestone[_-]?flow|execution[_-]?map|\/variants\b|root[_-]?causes|\/kpis\b/.test(blob)) return "process_mining";
  if (/financial[_-]?control|financial[_-]?cockpit|budget[_-]?control|\/budget\b/.test(blob)) return "financial";
  // Resources / project participants (route /projects/{id}/team; module project_team).
  if (/project_participants|project_team|team_roles|\bparticipa|\bresource|people_permissions|team_directory|\/team\b|\bteam\b/.test(blob)) return "resources";
  return "other";
}

function detectTerm(question: string): ScreenHelpTerm {
  const q = norm(question);
  if (RE_EXPLAIN_SCREEN.test(question)) return "screen";
  if (/task\s+cases?|casos?\s+de\s+tarea/.test(q)) return "task_cases";
  if (/full\s+audit|auditoria\s+completa|\bauditoria\b/.test(q)) return "full_audit";
  if (/process\s+view|vista\s+de\s+proceso/.test(q)) return "process_view";
  if (/transition|transicion|milestone\s+flow|flujo\s+entre\s+hitos/.test(q)) return "transition";
  if (/integrity|integridad|data\s+quality|calidad\s+de\s+datos/.test(q)) return "integrity";
  if (/variant|variante/.test(q)) return "variant";
  if (/root\s+cause|causa\s+raiz/.test(q)) return "root_cause";
  if (/\bkpi\b|indicador/.test(q)) return "kpi";
  if (/baseline|linea\s+base/.test(q)) return "baseline";
  if (/funding|financiamiento|fondos?\s+autorizados?/.test(q)) return "funding";
  if (/commitment|compromiso/.test(q)) return "commitment";
  if (/\bactuals?\b|costo\s+real/.test(q)) return "actual";
  if (/accrual|devengado/.test(q)) return "accrual";
  if (/payment|pago/.test(q)) return "payment";
  if (/reserve|reserva|contingenc/.test(q)) return "reserve";
  if (/forecast|pronostico|proyeccion|\beac\b|\bp50\b|\bp80\b/.test(q)) return "forecast";
  if (/approval\s+queue|cola\s+de\s+(control|aprobacion)|pending\s+approval/.test(q)) return "approval_queue";
  if (/quality|calidad|reconciliation|reconciliacion/.test(q)) return "quality";
  if (/financial\s+setup|configuraci[oó]n financiera|rate card|tarifas?|planned hours?|horas? planificadas?|AACE|BOE|cadencia/.test(q)) return "setup";
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

function financialContent(term: ScreenHelpTerm, es: boolean, ctx?: ScreenHelpContext): string {
  const definitions: Partial<Record<ScreenHelpTerm, { en: string; es: string }>> = {
    setup: {
      en: "**Financial setup** is the PMO capture point for a project estimate: title, purpose, scope, currency, dates, AACE class, and cost lines. Each line can record a resource, rate basis (hour/day/week/month/unit/fixed), quantity, cadence (weekly/biweekly/monthly/one-time), periods, planned hours, and WBS/CBS/control-account references. SAP and software categories organize the estimate; they do not invent amounts. Save keeps a draft, Submit for review starts the control workflow, and an independent human approver activates the BOE and baseline.",
      es: "La **configuración financiera** es el punto de captura PMO del estimado del proyecto: título, propósito, alcance, moneda, fechas, clase AACE y líneas de costo. Cada línea puede registrar recurso, base de tarifa (hora/día/semana/mes/unidad/fijo), cantidad, cadencia (semanal/quincenal/mensual/una sola vez), periodos, horas planificadas y referencias WBS/CBS/cuenta de control. Las categorías SAP y software organizan el estimado; no inventan importes. Guardar conserva un borrador, Enviar a revisión inicia el control y un aprobador humano independiente activa el BOE y el baseline.",
    },
    baseline: {
      en: "The **current baseline** is the active, approved cost plan. The original budget remains immutable; approved posted changes create a new baseline version instead of rewriting history.",
      es: "El **baseline actual** es el plan de costo activo y aprobado. El presupuesto original permanece inmutable; los cambios aprobados y posteados crean una nueva versión sin reescribir la historia.",
    },
    funding: {
      en: "**Funding** shows authorized and released financing. It is separate from budget, commitments, actual cost, and cash payments; one value never substitutes for another.",
      es: "**Funding** muestra financiamiento autorizado y liberado. Está separado del presupuesto, compromisos, costo real y pagos de caja; un valor nunca sustituye a otro.",
    },
    commitment: {
      en: "A **commitment** is an approved contractual obligation, such as a purchase order. Current and outstanding commitment are not actual cost or cash paid.",
      es: "Un **compromiso** es una obligación contractual aprobada, como una orden de compra. El compromiso actual y pendiente no es costo real ni caja pagada.",
    },
    actual: {
      en: "**Actual cost** is posted cost recognized for the project. Controlled actuals are append-only and traceable; legacy unverified rows remain visibly flagged.",
      es: "El **costo real** es costo posteado y reconocido para el proyecto. Los actuals controlados son append-only y trazables; los registros heredados sin verificar permanecen señalados.",
    },
    accrual: {
      en: "An **accrual** recognizes cost incurred but not yet invoiced or paid. It contributes to cost exposure but remains separate from actual postings and payments.",
      es: "Un **accrual** reconoce costo incurrido todavía no facturado o pagado. Contribuye a la exposición de costo, pero permanece separado de actuals y pagos.",
    },
    payment: {
      en: "A **settled payment** is cash disbursed. Payments are displayed separately from cost recognition so cash flow is never confused with actual cost.",
      es: "Un **pago liquidado** es caja desembolsada. Los pagos se muestran separados del reconocimiento de costo para no confundir flujo de caja con costo real.",
    },
    reserve: {
      en: "**Remaining reserve** is governed contingency or management reserve still available. Reserve use requires the approved change and authorization path.",
      es: "La **reserva restante** es contingencia o reserva de gestión todavía disponible. Su uso requiere la ruta aprobada de cambio y autorización.",
    },
    forecast: {
      en: "**EAC** is the latest estimate at completion. P50 and P80 are probabilistic scenarios only when sufficient evidence exists; missing values are disclosed rather than invented.",
      es: "El **EAC** es el estimado más reciente al completar. P50 y P80 son escenarios probabilísticos solo cuando existe evidencia suficiente; los valores faltantes se muestran, no se inventan.",
    },
    approval_queue: {
      en: "The **control queue** counts submitted or validated financial records awaiting an authorized human decision. Isabella can explain and trace them, but cannot approve, post, release, reopen, or execute them.",
      es: "La **cola de control** cuenta registros financieros enviados o validados que esperan una decisión humana autorizada. Isabella puede explicarlos y rastrearlos, pero no aprobar, postear, liberar, reabrir ni ejecutarlos.",
    },
    quality: {
      en: "**Quality status** exposes missing baseline, unverified actuals, currency exclusions, and reconciliation exceptions. Missing evidence is never converted to zero or hidden.",
      es: "El **estado de calidad** expone baseline faltante, actuals sin verificar, exclusiones por moneda y excepciones de reconciliación. La evidencia faltante nunca se convierte en cero ni se oculta.",
    },
  };
  const explicitScreen = norm(ctx?.screen ?? "");
  const pathname = norm(ctx?.pathname ?? "");
  const isSetupScreen = explicitScreen.includes("financial_setup") || (!explicitScreen && /\/budget\b/.test(pathname));
  const resolvedTerm = term === "screen" && isSetupScreen ? "setup" : term;
  const definition = definitions[resolvedTerm];
  if (definition) return es ? definition.es : definition.en;
  return es
    ? [
        "Estás en **Control financiero**, una vista PMO integrada al Core de ProjectOps360°.",
        "",
        "- **Baseline y funding** conservan aprobación, versión y trazabilidad.",
        "- **Compromisos, actuals y accruals** muestran exposición de costo sin mezclarse.",
        "- **Pagos** representan caja y permanecen separados del costo reconocido.",
        "- **Reservas, forecast y CPI/SPI** usan proyecciones canónicas con calidad explícita.",
        "- **Cola de control** muestra decisiones humanas pendientes y segregación de funciones.",
        "",
        "El estimado de materiales existente sigue disponible debajo; esta vista no crea un segundo presupuesto ni otro Gantt. Isabella solo puede explicar, comparar y rastrear evidencia financiera.",
      ].join("\n")
    : [
        "You are in **Financial Control**, a PMO view integrated into the ProjectOps360° Core.",
        "",
        "- **Baseline and funding** preserve approval, version, and traceability.",
        "- **Commitments, actuals, and accruals** show cost exposure without mixing truths.",
        "- **Payments** represent cash and remain separate from recognized cost.",
        "- **Reserves, forecast, and CPI/SPI** use canonical projections with explicit quality.",
        "- **Control queue** shows pending human decisions and segregation of duties.",
        "- **Financial setup** lets the PMO capture estimate, rates, quantities, cadence, planned hours, and WBS/CBS references before review.",
        "",
        "The existing material estimate remains below; this view creates neither a second budget nor another Gantt. Isabella may only explain, compare, and trace financial evidence.",
      ].join("\n");
}

function processMiningContent(
  term: ScreenHelpTerm,
  es: boolean,
  ctx: ScreenHelpContext | undefined,
): string {
  const path = norm(ctx?.pathname ?? "");
  const selected = term === "screen"
    ? path.includes("/variants")
      ? "variant"
      : path.includes("/root-causes")
        ? "root_cause"
        : path.includes("/kpis")
          ? "kpi"
          : path.includes("/milestone-flow")
            ? "transition"
            : "screen"
    : term;

  if (selected === "task_cases") {
    return es
      ? "**Casos de tarea** organiza el historial por tarea: cada tarea es un caso (`case_id = task_id`). La cronologia muestra sus eventos, subtareas y evidencia disponible. Sirve para leer una tarea a la vez; el orden temporal no demuestra causalidad."
      : "**Task cases** groups history by task: each task is one case (`case_id = task_id`). Its chronology shows events, subtasks, and available evidence. Use it to inspect one task at a time; temporal order does not prove causality.";
  }
  if (selected === "process_view") {
    return es
      ? "La vista **Proceso** agrega actividades y conexiones observadas entre los casos. Los controles de cobertura reducen el mapa a los caminos mas frecuentes; las variantes muestran secuencias distintas. Una conexion significa sucesion observada, no causa confirmada."
      : "The **Process** view aggregates observed activities and connections across cases. Coverage controls narrow the map to the most frequent paths; variants show different sequences. A connection means observed succession, not confirmed causality.";
  }
  if (selected === "full_audit") {
    return es
      ? "**Auditoria completa** muestra la proyeccion de solo lectura del registro canonico de eventos. Conserva `occurred_at`, `recorded_at`, secuencia, actor, fuente, confianza y referencias de objeto. Solo una relacion `caused_by` registrada es causal; la cercania temporal nunca se convierte en causa."
      : "**Full audit** is the read-only projection of the canonical event ledger. It preserves `occurred_at`, `recorded_at`, sequence, actor, source, confidence, and object references. Only an explicitly recorded `caused_by` relationship is causal; temporal proximity is never promoted to cause.";
  }
  if (selected === "transition") {
    return es
      ? "**Flujo entre hitos** resume transiciones hito a hito con segmentos, duracion, salud, retrasos, retrabajo y candidatos a cuello de botella. El motor es determinista y de solo lectura. Los hallazgos son inteligencia derivada y deben corroborarse antes de afirmar una causa."
      : "**Milestone Flow** summarizes milestone-to-milestone transitions with segments, duration, health, delay, rework, and bottleneck candidates. The engine is deterministic and read-only. Findings are derived intelligence and require corroboration before asserting a cause.";
  }
  if (selected === "integrity") {
    return es
      ? "La **integridad del evento** valida alcance de organizacion/proyecto, secuencia unica y creciente, cadena de hashes, trazabilidad, caso minable y referencias OCEL. Los flags de calidad indican limites de evidencia; no se ocultan ni se convierten en hechos."
      : "**Event integrity** validates organization/project scope, unique monotonic sequence, hash linkage, traceability, mining case framing, and OCEL references. Data-quality flags disclose evidence limits; they are never hidden or converted into facts.";
  }
  if (selected === "variant") {
    return es
      ? "**Variantes** agrupa casos por la secuencia de actividades observada y muestra frecuencia, retrabajo y diferencias. La comparacion con una variante exitosa solo aparece cuando existen resultados suficientes; no se inventan benchmarks."
      : "**Variants** groups cases by observed activity sequence and shows frequency, rework, and differences. Comparison with a successful variant appears only when sufficient outcome data exists; benchmarks are never invented.";
  }
  if (selected === "root_cause") {
    return es
      ? "**Root Cause Miner** muestra asociaciones estadisticas entre dimensiones del trabajo y retraso, bloqueo o retrabajo. Influence Score, lift, muestra y confianza describen asociacion, no una causa confirmada ni una recomendacion automatica."
      : "**Root Cause Miner** shows statistical associations between work dimensions and delay, blockage, or rework. Influence Score, lift, sample size, and confidence describe association, not a confirmed cause or an automatic recommendation.";
  }
  if (selected === "kpi") {
    return es
      ? "La vista **KPI** evalua el catalogo y los KPIs personalizados con el mismo dataset y sandbox que usa Isabella. Cuando faltan datos muestra `no calculable`; nunca reemplaza ausencia de evidencia con cero."
      : "The **KPI** view evaluates the catalog and custom KPIs with the same dataset and sandbox Isabella uses. Missing data is shown as `not computable`; absence of evidence is never replaced with zero.";
  }

  return es
    ? [
        "Estas en la **Process Mining Layer** del Execution Map. Lee el trabajo desde tres niveles complementarios:",
        "",
        "- **Casos de tarea**: una cronologia por tarea.",
        "- **Proceso**: actividades, conexiones y variantes agregadas.",
        "- **Auditoria completa**: eventos canonicos y relaciones explicitas.",
        "",
        "El Living Graph es una proyeccion visual, no el propietario de los datos. Las transiciones y hallazgos derivados ayudan a localizar friccion, pero orden temporal no significa causalidad. Usa los flags de integridad y calidad para saber cuanto puede afirmarse.",
      ].join("\n")
    : [
        "You are in the Execution Map's **Process Mining Layer**. It reads execution through three complementary levels:",
        "",
        "- **Task cases**: one chronology per task.",
        "- **Process**: aggregated activities, connections, and variants.",
        "- **Full audit**: canonical events and explicit relationships.",
        "",
        "The Living Graph is a visual projection, not the data owner. Transitions and derived findings help locate friction, but temporal order is not causality. Integrity and data-quality flags define what can safely be claimed.",
      ].join("\n");
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
  if (area === "process_mining") return { answer: processMiningContent(term, es, ctx), area, term, confident: true };
  if (area === "financial") return { answer: financialContent(term, es, ctx), area, term, confident: true };

  // Unknown or a screen we do not have deterministic content for → never guess.
  return { answer: safetyClarification(es), area, term, confident: false };
}
