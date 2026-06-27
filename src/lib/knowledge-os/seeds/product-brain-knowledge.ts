// ============================================================================
// ProjectOps360° — Dr. Isabella: curated Product Brain knowledge packages
// ============================================================================
// THE source of truth for what Isabella knows about how ProjectOps360° works.
// These are CURATED, authoritative knowledge packages distilled from the Product
// Brain (docs/product-brain/**) — Product Decisions, ADRs, the regression log,
// and module strategy — NOT a raw dump of every document (TASK 3/4/12).
//
// Each package body ends with two lines so every grounded answer naturally
// carries provenance and a verification path (TASK 7 + TASK 11 format):
//   Source: <product-brain doc> → <section>
//   Verify: <where to confirm it inside ProjectOps360°>
//
// The migration `*_knowledge_product_brain.sql` is GENERATED from this manifest
// (scripts/generate-knowledge-seed-sql.mjs) so DB seed and code never drift.
// Authority order (highest first): Product Decision → ADR → CAP → Regression →
// module strategy → sprint note. `tier` reflects that authority.
// ============================================================================

export type PbTier = "verified" | "best_practice" | "ai_suggestion";

/** A curated, bilingual Product Intelligence knowledge package for Isabella. */
export interface ProductBrainPackage {
  /** Stable slug (also the citation handle). */
  slug: string;
  /** Knowledge domain; all Product Brain packages share this domain. */
  domain: "product_intelligence";
  tier: PbTier;
  /** Product Brain doc/section + decision/regression id this distills (provenance). */
  sourceRef: string;
  /** Authority class for conflict resolution (TASK 12). */
  authority: "product_decision" | "adr" | "cap" | "regression" | "module_strategy" | "sprint_note";
  en: { title: string; body: string };
  es: { title: string; body: string };
}

export const DOMAIN = "product_intelligence" as const;

export const PRODUCT_BRAIN_PACKAGES: ProductBrainPackage[] = [
  // ── Living Graph + Critical Path ───────────────────────────────────────────
  {
    slug: "pi-living-graph-what-is",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "12-living-graph-strategy.md → Overview; 22-modules.md → Living Graph",
    authority: "module_strategy",
    en: {
      title: "What is the Living Graph?",
      body:
        "In ProjectOps360°, the Living Graph is the primary project-intelligence surface: an interactive process map of milestones, tasks, dependencies, people, and risk, rendered as a graph you can explore, filter, and focus. It is the protagonist of the Execution Map page — controls, filters, legends, and insights support the graph, they do not compete with it. It is where Critical Path, blockers, waiting work, overlays (risk, SOP candidates, variance, timeline, what-if, workforce capacity) and Focus Mode live.\n" +
        "Source: 12-living-graph-strategy.md → Overview.\n" +
        "Verify: open a project → Execution Map → Living Graph.",
    },
    es: {
      title: "¿Qué es el Living Graph?",
      body:
        "En ProjectOps360°, el Living Graph es la superficie principal de inteligencia del proyecto: un mapa de proceso interactivo de hitos, tareas, dependencias, personas y riesgo, mostrado como un grafo que puedes explorar, filtrar y enfocar. Es el protagonista de la página Execution Map — los controles, filtros, leyendas e indicadores apoyan al grafo, no compiten con él. Ahí viven la Ruta Crítica, los bloqueos, el trabajo en espera, los overlays (riesgo, candidatos a SOP, varianza, timeline, what-if, capacidad de fuerza laboral) y el Modo Enfoque.\n" +
        "Fuente: 12-living-graph-strategy.md → Overview.\n" +
        "Verifica: abre un proyecto → Execution Map → Living Graph.",
    },
  },
  {
    slug: "pi-critical-path-source-of-truth",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "Product Decision — Critical Path Source of Truth; 12-living-graph-strategy.md → Critical Path",
    authority: "product_decision",
    en: {
      title: "Where does Critical Path live?",
      body:
        "Critical Path lives inside the Living Graph. ProjectOps360° rule: the Roadmap must NOT maintain a separate Critical Path engine — it may route users to the Living Graph Critical Path view, but the single source of truth is the Living Graph. This avoids two engines disagreeing about which work is critical.\n" +
        "Source: Product Decision — Critical Path Source of Truth (Living Graph Strategy).\n" +
        "Verify: Project → Execution Map → Living Graph → Critical Path overlay.",
    },
    es: {
      title: "¿Dónde vive la Ruta Crítica?",
      body:
        "La Ruta Crítica vive dentro del Living Graph. Regla de ProjectOps360°: el Roadmap NO debe mantener un motor de Ruta Crítica separado — puede enviar al usuario a la vista de Ruta Crítica del Living Graph, pero la única fuente de verdad es el Living Graph. Así se evita que dos motores discrepen sobre qué trabajo es crítico.\n" +
        "Fuente: Decisión de Producto — Critical Path Source of Truth (Living Graph Strategy).\n" +
        "Verifica: Proyecto → Execution Map → Living Graph → overlay de Ruta Crítica.",
    },
  },
  {
    slug: "pi-focus-mode",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "27-sprint-02-living-graph-focus.md → Decisions; ADR-002",
    authority: "sprint_note",
    en: {
      title: "What does Focus Mode do?",
      body:
        "Focus Mode makes the Living Graph the protagonist by collapsing secondary UI: it hides the page title/subtitle, helper text, and legends, collapses Insights, and expands the canvas to the full viewport so the graph has maximum readable space. It is layout/interaction only — it changes nothing about node generation, status, blockers, or any engine. View preferences (overlay, layout, level, insights) persist locally.\n" +
        "Source: 27-sprint-02-living-graph-focus.md → Decisions.\n" +
        "Verify: Living Graph toolbar → \"Focus Graph\" button; exit with the same button.",
    },
    es: {
      title: "¿Qué hace el Modo Enfoque?",
      body:
        "El Modo Enfoque hace del Living Graph el protagonista colapsando la interfaz secundaria: oculta el título/subtítulo de la página, el texto de ayuda y las leyendas, colapsa los Indicadores y expande el lienzo a toda la ventana para que el grafo tenga el máximo espacio legible. Es solo de diseño/interacción — no cambia la generación de nodos, el estado, los bloqueos ni ningún motor. Las preferencias de vista (overlay, layout, nivel, indicadores) se recuerdan localmente.\n" +
        "Fuente: 27-sprint-02-living-graph-focus.md → Decisions.\n" +
        "Verifica: barra del Living Graph → botón \"Focus Graph\"; sal con el mismo botón.",
    },
  },

  // ── Execution truth: blocked vs waiting, completed never blocks ─────────────
  {
    slug: "pi-blocked-vs-waiting",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "18-execution-status-engine.md; ADR-006; REG-006",
    authority: "adr",
    en: {
      title: "What is the difference between blocked and waiting?",
      body:
        "In ProjectOps360°, Blocked and Waiting are different execution states. Blocked requires explicit, unresolved impediment evidence — a recorded blocker (status \"blocked\" or an is_blocked flag on a non-terminal task). Waiting on dependency means a predecessor/dependency is not yet satisfied; it is NOT a blocker and must never be shown as one. Blocked is never inferred from dependencies.\n" +
        "Source: ADR-006 / Execution Status Engine (18-execution-status-engine.md).\n" +
        "Verify: Living Graph header shows blocked and waiting as separate counts.",
    },
    es: {
      title: "¿Cuál es la diferencia entre bloqueado y en espera?",
      body:
        "En ProjectOps360°, Bloqueado y En espera son estados de ejecución distintos. Bloqueado requiere evidencia explícita de un impedimento sin resolver — un bloqueo registrado (estado \"blocked\" o el flag is_blocked en una tarea no terminal). En espera de dependencia significa que un predecesor/dependencia aún no está satisfecho; NO es un bloqueo y nunca debe mostrarse como tal. Bloqueado nunca se infiere de las dependencias.\n" +
        "Fuente: ADR-006 / Execution Status Engine (18-execution-status-engine.md).\n" +
        "Verifica: el header del Living Graph muestra bloqueados y en espera como conteos separados.",
    },
  },
  {
    slug: "pi-completed-not-blockers",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "ADR-006; REG-008; REG-010; src/lib/execution/task-activity.ts",
    authority: "adr",
    en: {
      title: "Can completed tasks count as blockers?",
      body:
        "No. In ProjectOps360°, a completed or terminal task (done, tested, implemented, deferred, cancelled) is NEVER an active blocker — even if it still carries a stale is_blocked flag. Blocked requires an explicit, unresolved impediment on active work. This rule is enforced by the canonical task-activity helper used by every rollup (health, Living Graph header, PMO Summary, capacity), so all surfaces agree.\n" +
        "Source: ADR-006; REG-008 and REG-010 (10-regression-log.md).\n" +
        "Verify: a Done task with a stale flag shows 0 active blockers across the Living Graph header and Executive Insights.",
    },
    es: {
      title: "¿Pueden las tareas completadas contar como bloqueos?",
      body:
        "No. En ProjectOps360°, una tarea completada o terminal (done, tested, implemented, deferred, cancelled) NUNCA es un bloqueo activo — aunque conserve un flag is_blocked obsoleto. Bloqueado exige un impedimento explícito y sin resolver sobre trabajo activo. Esta regla la aplica el helper canónico task-activity que usan todos los rollups (salud, header del Living Graph, Resumen PMO, capacidad), de modo que todas las superficies coinciden.\n" +
        "Fuente: ADR-006; REG-008 y REG-010 (10-regression-log.md).\n" +
        "Verifica: una tarea Done con flag obsoleto muestra 0 bloqueos activos en el header del Living Graph y en Executive Insights.",
    },
  },
  {
    slug: "pi-execution-status-engine",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "18-execution-status-engine.md; ADR-006",
    authority: "adr",
    en: {
      title: "What is the Execution Status Engine?",
      body:
        "The Execution Status Engine is ProjectOps360°'s deterministic source of truth for execution state. It separates independent dimensions — Execution Status, Dependency Status, Project Health, and Risk Status — so they are never conflated. It is a pure, rule-based engine (no AI guessing): Blocked requires explicit impediment, Waiting comes from unsatisfied predecessors, and completed work is terminal. Engines like this must not be overridden by AI.\n" +
        "Source: 18-execution-status-engine.md.\n" +
        "Verify: Living Graph node indicators and header counts derive from this engine.",
    },
    es: {
      title: "¿Qué es el Execution Status Engine?",
      body:
        "El Execution Status Engine es la fuente de verdad determinista de ProjectOps360° para el estado de ejecución. Separa dimensiones independientes — Estado de Ejecución, Estado de Dependencias, Salud del Proyecto y Estado de Riesgo — para que nunca se confundan. Es un motor puro basado en reglas (sin adivinanzas de IA): Bloqueado exige impedimento explícito, En espera viene de predecesores no satisfechos, y el trabajo completado es terminal. Motores así no deben ser sobreescritos por la IA.\n" +
        "Fuente: 18-execution-status-engine.md.\n" +
        "Verifica: los indicadores de nodo y los conteos del header del Living Graph derivan de este motor.",
    },
  },

  // ── Workboard ──────────────────────────────────────────────────────────────
  {
    slug: "pi-workboard-task-cards",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "Sprint #1 — Operational Clarity; 22-modules.md → Workboard",
    authority: "sprint_note",
    en: {
      title: "What should Workboard task cards show?",
      body:
        "In ProjectOps360°, a Workboard task card must show who owns the work: the assignee's avatar or initials, their name, and their role when available — or a clear \"Unassigned\" state when no one owns it. Owner names are resolved safely (RLS-aware), so a card never silently shows \"Unassigned\" for a task that actually has an owner.\n" +
        "Source: Sprint #1 — Operational Clarity (Workboard assignee visibility).\n" +
        "Verify: Project → Workboard — each card shows avatar/initials + name + role, or Unassigned.",
    },
    es: {
      title: "¿Qué deben mostrar las tarjetas del Workboard?",
      body:
        "En ProjectOps360°, una tarjeta de tarea del Workboard debe mostrar quién es responsable del trabajo: el avatar o las iniciales del asignado, su nombre y su rol cuando esté disponible — o un estado claro de \"Sin asignar\" cuando nadie es responsable. Los nombres de responsables se resuelven de forma segura (considerando RLS), de modo que una tarjeta nunca muestra \"Sin asignar\" en silencio para una tarea que sí tiene responsable.\n" +
        "Fuente: Sprint #1 — Operational Clarity (visibilidad de responsables en Workboard).\n" +
        "Verifica: Proyecto → Workboard — cada tarjeta muestra avatar/iniciales + nombre + rol, o Sin asignar.",
    },
  },

  // ── Project Memory + Scribe ────────────────────────────────────────────────
  {
    slug: "pi-project-memory",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "17-project-memory.md; 22-modules.md → Project Memory",
    authority: "module_strategy",
    en: {
      title: "What is Project Memory?",
      body:
        "Project Memory is ProjectOps360°'s permanent project evidence store: notes, transcripts, decisions, actions, risks, and follow-ups, with traceability back to their source. It is where captured knowledge lives durably so the project keeps an auditable record of what was decided and why. AI may classify and index entries, but it never invents them.\n" +
        "Source: 17-project-memory.md.\n" +
        "Verify: Project → Project Memory.",
    },
    es: {
      title: "¿Qué es la Memoria del Proyecto?",
      body:
        "La Memoria del Proyecto es el almacén permanente de evidencia de ProjectOps360°: notas, transcripciones, decisiones, acciones, riesgos y seguimientos, con trazabilidad hacia su origen. Es donde el conocimiento capturado vive de forma duradera para que el proyecto mantenga un registro auditable de qué se decidió y por qué. La IA puede clasificar e indexar entradas, pero nunca las inventa.\n" +
        "Fuente: 17-project-memory.md.\n" +
        "Verifica: Proyecto → Memoria del Proyecto.",
    },
  },
  {
    slug: "pi-projectops-scribe",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "REG-009; 17-project-memory.md → ProjectOps Scribe",
    authority: "module_strategy",
    en: {
      title: "What is ProjectOps Scribe?",
      body:
        "ProjectOps Scribe is the Project Memory capture assistant. You write, paste, or dictate a note (browser voice dictation); AI structures it into proposed actions, decisions, risks, and follow-ups, each with a verbatim source excerpt; you review and approve; approved items are saved into Project Memory and can create the corresponding entities. Nothing is created without human approval, and the original transcript is preserved as evidence.\n" +
        "Source: 17-project-memory.md → ProjectOps Scribe (restored in REG-009).\n" +
        "Verify: Project → Project Memory → ProjectOps Scribe → Dictate/Paste → Analyze → review → Save.",
    },
    es: {
      title: "¿Qué es ProjectOps Scribe?",
      body:
        "ProjectOps Scribe es el asistente de captura de la Memoria del Proyecto. Escribes, pegas o dictas una nota (dictado por voz del navegador); la IA la estructura en acciones, decisiones, riesgos y seguimientos propuestos, cada uno con un extracto textual de origen; tú revisas y apruebas; los elementos aprobados se guardan en la Memoria del Proyecto y pueden crear las entidades correspondientes. Nada se crea sin aprobación humana y la transcripción original se conserva como evidencia.\n" +
        "Fuente: 17-project-memory.md → ProjectOps Scribe (restaurado en REG-009).\n" +
        "Verifica: Proyecto → Memoria del Proyecto → ProjectOps Scribe → Dictar/Pegar → Analizar → revisar → Guardar.",
    },
  },

  // ── Overlays that require real data ────────────────────────────────────────
  {
    slug: "pi-variance-baseline",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "12-living-graph-strategy.md → Variance; overlay-metadata",
    authority: "module_strategy",
    en: {
      title: "What does Variance View require?",
      body:
        "The Variance overlay requires a real, approved baseline to compare against. Without an approved baseline there is nothing to measure variance from, so the overlay shows an honest empty state with a call to action to set up a baseline — it never fabricates a baseline or a variance number.\n" +
        "Source: 12-living-graph-strategy.md → Variance.\n" +
        "Verify: Living Graph → Variance overlay; if empty, follow the \"set up a baseline\" CTA.",
    },
    es: {
      title: "¿Qué requiere la vista de Varianza?",
      body:
        "El overlay de Varianza requiere una línea base real y aprobada contra la cual comparar. Sin una línea base aprobada no hay nada de qué medir varianza, así que el overlay muestra un estado vacío honesto con una llamada a la acción para configurar una línea base — nunca fabrica una línea base ni un número de varianza.\n" +
        "Fuente: 12-living-graph-strategy.md → Variance.\n" +
        "Verifica: Living Graph → overlay de Varianza; si está vacío, sigue la CTA de \"configurar línea base\".",
    },
  },
  {
    slug: "pi-timeline-playback",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "12-living-graph-strategy.md → Timeline; overlay-metadata (countDistinctEventDays)",
    authority: "module_strategy",
    en: {
      title: "What does Timeline Playback require?",
      body:
        "Timeline Playback requires real project history — events or snapshots spread across more than one day. If everything was imported in a single day there is no evolution to replay, so the overlay shows an honest empty/limited state instead of animating fake history.\n" +
        "Source: 12-living-graph-strategy.md → Timeline.\n" +
        "Verify: Living Graph → Timeline overlay; playback is meaningful only with multi-day history.",
    },
    es: {
      title: "¿Qué requiere la reproducción de Timeline?",
      body:
        "La reproducción de Timeline requiere historia real del proyecto — eventos o instantáneas repartidos en más de un día. Si todo se importó en un solo día no hay evolución que reproducir, así que el overlay muestra un estado vacío/limitado honesto en lugar de animar una historia falsa.\n" +
        "Fuente: 12-living-graph-strategy.md → Timeline.\n" +
        "Verifica: Living Graph → overlay de Timeline; la reproducción tiene sentido solo con historia de varios días.",
    },
  },
  {
    slug: "pi-whatif-sandbox",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "12-living-graph-strategy.md → What-if Simulation; PD What-if sandbox",
    authority: "product_decision",
    en: {
      title: "How does What-if Simulation work?",
      body:
        "What-if Simulation is sandbox-first. You select a node and run a scenario; the impact is computed deterministically and shown only in the sandbox. No real project data changes unless you explicitly choose to apply the scenario. This protects the plan from accidental edits while letting you explore trade-offs safely.\n" +
        "Source: 12-living-graph-strategy.md → What-if Simulation.\n" +
        "Verify: Living Graph → What-if overlay → select a node → run scenario (sandbox); apply only if you decide to.",
    },
    es: {
      title: "¿Cómo funciona la Simulación What-if?",
      body:
        "La Simulación What-if es primero un sandbox. Seleccionas un nodo y corres un escenario; el impacto se calcula de forma determinista y se muestra solo en el sandbox. Ningún dato real del proyecto cambia a menos que elijas explícitamente aplicar el escenario. Esto protege el plan de ediciones accidentales mientras exploras alternativas con seguridad.\n" +
        "Fuente: 12-living-graph-strategy.md → What-if Simulation.\n" +
        "Verifica: Living Graph → overlay What-if → selecciona un nodo → corre escenario (sandbox); aplica solo si decides hacerlo.",
    },
  },

  // ── Resource Capacity ──────────────────────────────────────────────────────
  {
    slug: "pi-resource-capacity",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "13-resource-capacity-intelligence.md → Capacity Risk vs Bottleneck; REG-010",
    authority: "module_strategy",
    en: {
      title: "What is Resource Capacity Intelligence (capacity risk vs bottleneck)?",
      body:
        "Resource Capacity Intelligence measures real workforce capacity: effective capacity = weekly hours × availability × (1 − overhead), with explainable utilization status. A capacity risk (a milestone at high or medium risk because of overload, no owner, or missing estimate) is distinct from a bottleneck (a critical/overallocated resource). They are different metrics and the same scope must be used everywhere — the \"At-risk Milestones\" card and the \"Capacity risks\" list both count high+medium so they agree (REG-010).\n" +
        "Source: 13-resource-capacity-intelligence.md → Capacity Risk vs Bottleneck.\n" +
        "Verify: Project → Resource Capacity — the at-risk card equals the capacity-risks list.",
    },
    es: {
      title: "¿Qué es Resource Capacity Intelligence (riesgo de capacidad vs cuello de botella)?",
      body:
        "Resource Capacity Intelligence mide la capacidad real de la fuerza laboral: capacidad efectiva = horas semanales × disponibilidad × (1 − overhead), con estado de utilización explicable. Un riesgo de capacidad (un hito en riesgo alto o medio por sobrecarga, falta de responsable o falta de estimación) es distinto de un cuello de botella (un recurso crítico/sobreasignado). Son métricas diferentes y debe usarse el mismo alcance en todas partes — la tarjeta \"Hitos en riesgo\" y la lista \"Riesgos de capacidad\" cuentan alto+medio para coincidir (REG-010).\n" +
        "Fuente: 13-resource-capacity-intelligence.md → Capacity Risk vs Bottleneck.\n" +
        "Verifica: Proyecto → Resource Capacity — la tarjeta de en riesgo coincide con la lista de riesgos de capacidad.",
    },
  },

  // ── Regressions (product-level facts) ──────────────────────────────────────
  {
    slug: "pi-reg-008",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "10-regression-log.md → REG-008",
    authority: "regression",
    en: {
      title: "What was REG-008?",
      body:
        "REG-008 was a false \"blocked\" state in the Living Graph: a completed task still carried a stale is_blocked flag, so it was wrongly counted as blocked. The fix made node state derive from the deterministic Execution Status Engine, so a completed task is never shown as blocked. Protection rule: the Living Graph must never compute Blocked ad hoc from a flag on a completed item.\n" +
        "Source: 10-regression-log.md → REG-008.\n" +
        "Verify: a Done task no longer appears blocked in the Living Graph.",
    },
    es: {
      title: "¿Qué fue REG-008?",
      body:
        "REG-008 fue un estado \"bloqueado\" falso en el Living Graph: una tarea completada aún conservaba un flag is_blocked obsoleto, por lo que se contaba erróneamente como bloqueada. La corrección hizo que el estado del nodo derive del Execution Status Engine determinista, de modo que una tarea completada nunca se muestra bloqueada. Regla de protección: el Living Graph nunca debe calcular Bloqueado ad hoc desde un flag en un elemento completado.\n" +
        "Fuente: 10-regression-log.md → REG-008.\n" +
        "Verifica: una tarea Done ya no aparece bloqueada en el Living Graph.",
    },
  },
  {
    slug: "pi-reg-009",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "10-regression-log.md → REG-009",
    authority: "regression",
    en: {
      title: "What was REG-009?",
      body:
        "REG-009 was the loss of ProjectOps Scribe — the voice-note → actions/decisions capture flow — which existed only on a divergent branch and was missing from master. It was restored: dictate/paste a note, AI extracts actions/decisions/risks/follow-ups for review, and approved items save into Project Memory with the transcript preserved.\n" +
        "Source: 10-regression-log.md → REG-009.\n" +
        "Verify: Project → Project Memory → ProjectOps Scribe.",
    },
    es: {
      title: "¿Qué fue REG-009?",
      body:
        "REG-009 fue la pérdida de ProjectOps Scribe — el flujo de captura nota de voz → acciones/decisiones — que existía solo en una rama divergente y faltaba en master. Se restauró: dictar/pegar una nota, la IA extrae acciones/decisiones/riesgos/seguimientos para revisión, y los elementos aprobados se guardan en la Memoria del Proyecto con la transcripción conservada.\n" +
        "Fuente: 10-regression-log.md → REG-009.\n" +
        "Verifica: Proyecto → Memoria del Proyecto → ProjectOps Scribe.",
    },
  },
  {
    slug: "pi-reg-010",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "10-regression-log.md → REG-010; src/lib/execution/task-activity.ts; src/lib/project-rollups/project-rollup-engine.ts",
    authority: "regression",
    en: {
      title: "What is REG-010?",
      body:
        "REG-010 was a cross-module metric rollup inconsistency: different surfaces disagreed for the same project because each re-derived blockers/waiting/capacity with divergent rules (a stale flag on a Done task inflated some counts). The fix established one status/rollup truth — a canonical task-activity helper and a project rollup engine — so blockers, waiting, capacity, priority and milestone counts agree everywhere, and every metric declares its scope. Completed tasks never count as active blockers, waiting, or capacity risks.\n" +
        "Source: 10-regression-log.md → REG-010.\n" +
        "Verify: for one project, the Living Graph header blockers equal Executive Insights and PMO Summary blockers.",
    },
    es: {
      title: "¿Qué es REG-010?",
      body:
        "REG-010 fue una inconsistencia de rollup de métricas entre módulos: distintas superficies discrepaban para el mismo proyecto porque cada una re-derivaba bloqueos/espera/capacidad con reglas divergentes (un flag obsoleto en una tarea Done inflaba algunos conteos). La corrección estableció una única verdad de estado/rollup — un helper canónico task-activity y un motor de rollup de proyecto — para que bloqueos, espera, capacidad, prioridad y conteos de hitos coincidan en todas partes, y cada métrica declare su alcance. Las tareas completadas nunca cuentan como bloqueos activos, espera ni riesgos de capacidad.\n" +
        "Fuente: 10-regression-log.md → REG-010.\n" +
        "Verifica: para un proyecto, los bloqueos del header del Living Graph igualan a los de Executive Insights y el Resumen PMO.",
    },
  },
  {
    slug: "pi-verify-false-blockers",
    domain: DOMAIN,
    tier: "best_practice",
    sourceRef: "10-regression-log.md → REG-008/REG-010 (verification)",
    authority: "regression",
    en: {
      title: "How do I verify Living Graph false blockers are fixed?",
      body:
        "Open the \"Mobile App Design\" project → Execution Map → Living Graph. With no active impediments the header should show 0 blocked, and any dependency waiting is shown separately as \"waiting\", not as blocked. Confirm a completed task that once had a stale flag is no longer counted as a blocker, and that Executive Insights and the PMO Summary report the same blocker count as the header.\n" +
        "Source: 10-regression-log.md → REG-008/REG-010 verification.\n" +
        "Verify: Mobile App Design → Execution Map → Living Graph header (0 blocked, waiting separate).",
    },
    es: {
      title: "¿Cómo verifico que los bloqueos falsos del Living Graph están corregidos?",
      body:
        "Abre el proyecto \"Mobile App Design\" → Execution Map → Living Graph. Sin impedimentos activos el header debe mostrar 0 bloqueados, y cualquier espera por dependencia se muestra por separado como \"en espera\", no como bloqueado. Confirma que una tarea completada que antes tenía un flag obsoleto ya no se cuenta como bloqueo, y que Executive Insights y el Resumen PMO reportan el mismo conteo de bloqueos que el header.\n" +
        "Fuente: 10-regression-log.md → verificación de REG-008/REG-010.\n" +
        "Verifica: Mobile App Design → Execution Map → Living Graph header (0 bloqueados, espera por separado).",
    },
  },

  // ── Meta: what Isabella does when Product Brain lacks an answer ─────────────
  {
    slug: "pi-product-brain-gap",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "31-dr-isabella-product-intelligence.md → Honesty & gaps",
    authority: "product_decision",
    en: {
      title: "What should Isabella do if Product Brain lacks an answer?",
      body:
        "If the Product Brain does not define something about ProjectOps360°, Isabella must say so plainly — she does not guess or present general project-management practice as a ProjectOps360° fact. She then offers a constructive next step: capture it as a Product Decision or an implementation note so the gap is recorded and can be answered authoritatively next time.\n" +
        "Source: 31-dr-isabella-product-intelligence.md → Honesty & gaps.\n" +
        "Verify: ask Isabella about an undefined feature — she states it is not in Product Brain and offers to record a decision.",
    },
    es: {
      title: "¿Qué debe hacer Isabella si el Product Brain no tiene la respuesta?",
      body:
        "Si el Product Brain no define algo sobre ProjectOps360°, Isabella debe decirlo con claridad — no adivina ni presenta una práctica general de gestión de proyectos como un hecho de ProjectOps360°. Luego ofrece un siguiente paso constructivo: registrarlo como una Decisión de Producto o una nota de implementación para que el vacío quede documentado y pueda responderse con autoridad la próxima vez.\n" +
        "Fuente: 31-dr-isabella-product-intelligence.md → Honestidad y vacíos.\n" +
        "Verifica: pregúntale a Isabella por una función no definida — dice que no está en Product Brain y ofrece registrar una decisión.",
    },
  },
];

/** Slugs every curated Product Brain package must include (used by tests). */
export const REQUIRED_PB_SLUGS = PRODUCT_BRAIN_PACKAGES.map((p) => p.slug);
