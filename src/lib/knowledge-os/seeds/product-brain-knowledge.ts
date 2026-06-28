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

  {
    slug: "pi-living-graph-saved-layouts",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "Product Decision PD-008 (UX-007); 12-living-graph-strategy.md → Manual workspace organization",
    authority: "product_decision",
    en: {
      title: "How do I save the Living Graph layout?",
      body:
        "In ProjectOps360°, you can manually arrange nodes in the Living Graph and click Save Layout. The saved layout is visual only — it does NOT change tasks, dependencies, blockers, edges, execution status, capacity, or project data; it stores node positions and the viewport. It is saved for the current project and graph context (view level + layout mode) and is personal to you. Switching layout mode or level loads that context's saved layout rather than destroying your arrangement. You can reset to auto-layout, reset to your saved layout, or clear it at any time. When the graph changes, existing nodes with saved positions are restored and new nodes are placed automatically (a notice tells you the layout was partially applied); deleted nodes are ignored. Saving never changes graph edges or relationships — node position is presentation state only.\n" +
        "Source: Product Decision PD-008 (UX-007) / 12-living-graph-strategy.md → Manual workspace organization.\n" +
        "Verify: Execution Map → Living Graph → drag nodes → Save Layout (top-center); refresh and the arrangement returns. Use the layout menu to reset to auto-layout or clear.",
    },
    es: {
      title: "¿Cómo guardo el diseño del Living Graph?",
      body:
        "En ProjectOps360°, puedes acomodar manualmente los nodos del Living Graph y hacer clic en Guardar diseño. El diseño guardado es solo visual — NO cambia tareas, dependencias, bloqueos, aristas, estado de ejecución, capacidad ni datos del proyecto; almacena las posiciones de los nodos y el viewport. Se guarda para el proyecto y el contexto de grafo actual (nivel de vista + modo de diseño) y es personal tuyo. Cambiar de modo de diseño o de nivel carga el diseño guardado de ese contexto en lugar de destruir tu disposición. Puedes restaurar el diseño automático, restaurar tu diseño guardado o borrarlo cuando quieras. Cuando el grafo cambia, los nodos existentes con posición guardada se restauran y los nodos nuevos se colocan automáticamente (un aviso indica que el diseño se aplicó parcialmente); los nodos eliminados se ignoran. Guardar nunca cambia las aristas ni las relaciones del grafo — la posición del nodo es solo estado de presentación.\n" +
        "Fuente: Decisión de Producto PD-008 (UX-007) / 12-living-graph-strategy.md → Manual workspace organization.\n" +
        "Verifica: Execution Map → Living Graph → arrastra nodos → Guardar diseño (arriba al centro); recarga y la disposición vuelve. Usa el menú de diseño para restaurar el automático o borrar.",
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

  // ── Isabella Project Health Briefing (REG-013) ─────────────────────────────
  {
    slug: "pi-isabella-project-briefing",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "16-isabella-ai-workforce.md → Project Health Briefing; 10-regression-log.md → REG-013",
    authority: "regression",
    en: {
      title: "Why does Isabella show a briefing when I open her inside a project?",
      body:
        "Because Isabella is project-aware. When opened inside a project she does not wait passively — she checks deterministic project status data and gives a grounded Project Health Briefing about health, blockers (separate from waiting-on-dependency), overdue work, capacity warnings, open risks, recent decisions, and the top recommended next actions, with links to verify each finding (Workboard, Living Graph, Resource Capacity, Project Memory, Status Report). The briefing is built from the canonical rollup and roadmap engines — there is no AI call on open. Opened OUTSIDE a project she keeps the generic guide prompt. Use Refresh briefing to re-run it; Dismiss hides it for the current session only.\n" +
        "Source: 16-isabella-ai-workforce.md → Project Health Briefing (REG-013).\n" +
        "Verify: open any project → Isabella → a Project Briefing appears on load; open Isabella outside a project → only the generic guide prompt.",
    },
    es: {
      title: "¿Por qué Isabella muestra un briefing cuando la abro dentro de un proyecto?",
      body:
        "Porque Isabella es consciente del proyecto. Al abrirse dentro de un proyecto no espera pasivamente — revisa datos deterministas de estado y entrega un Briefing de Salud del Proyecto fundamentado sobre la salud, los bloqueos (separados de la espera por dependencia), el trabajo vencido, las advertencias de capacidad, los riesgos abiertos, las decisiones recientes y las principales acciones recomendadas, con enlaces para verificar cada hallazgo (Workboard, Living Graph, Capacidad de Recursos, Memoria del Proyecto, Reporte de Estado). El briefing se construye con los motores canónicos de rollup y roadmap — no hay llamada de IA al abrir. Abierta FUERA de un proyecto mantiene el prompt genérico de guía. Usa Actualizar briefing para volver a generarlo; Ocultar lo esconde solo durante la sesión actual.\n" +
        "Fuente: 16-isabella-ai-workforce.md → Project Health Briefing (REG-013).\n" +
        "Verifica: abre cualquier proyecto → Isabella → aparece un Briefing del Proyecto al cargar; abre Isabella fuera de un proyecto → solo el prompt genérico de guía.",
    },
  },
  {
    slug: "pi-isabella-briefing-no-invention",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "16-isabella-ai-workforce.md → Project Health Briefing; 10-regression-log.md → REG-013",
    authority: "regression",
    en: {
      title: "Does Isabella invent project issues in the briefing?",
      body:
        "No. Isabella only reports issues supported by project data — rollups, Project Memory, risks, capacity, and execution status. She never invents blockers, risks, owners, dates, overdue status, capacity values, critical-path impact, or recommendations. Blocked and Waiting on Dependency are reported separately, and completed/terminal tasks are NEVER counted as active blockers (REG-008/010). If data is missing she says \"I don't have enough data to evaluate X yet\"; if nothing is wrong she says the project looks stable. You can refresh the briefing with Refresh briefing.\n" +
        "Source: 16-isabella-ai-workforce.md → Project Health Briefing; REG-013 no-hallucination rules.\n" +
        "Verify: a project with 0 blockers shows \"No active blockers detected\"; a stale flag on a completed task never appears as a blocker.",
    },
    es: {
      title: "¿Isabella inventa problemas del proyecto en el briefing?",
      body:
        "No. Isabella solo reporta problemas respaldados por datos del proyecto — rollups, Memoria del Proyecto, riesgos, capacidad y estado de ejecución. Nunca inventa bloqueos, riesgos, responsables, fechas, estado de vencimiento, valores de capacidad, impacto en la ruta crítica ni recomendaciones. Bloqueado y En espera por dependencia se reportan por separado, y las tareas completadas/terminales NUNCA cuentan como bloqueos activos (REG-008/010). Si faltan datos dice \"Aún no tengo datos suficientes para evaluar X\"; si no hay problemas dice que el proyecto se ve estable. Puedes regenerar el briefing con Actualizar briefing.\n" +
        "Fuente: 16-isabella-ai-workforce.md → Project Health Briefing; reglas anti-alucinación de REG-013.\n" +
        "Verifica: un proyecto con 0 bloqueos muestra \"No se detectan bloqueos activos\"; un flag obsoleto en una tarea completada nunca aparece como bloqueo.",
    },
  },
  {
    slug: "pi-isabella-portfolio-briefing",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "16-isabella-ai-workforce.md → Portfolio Health Briefing (PMO); 10-regression-log.md → REG-013",
    authority: "regression",
    en: {
      title: "Does Isabella give the PMO a portfolio briefing too?",
      body:
        "Yes. The PM gets a project briefing inside a project; the PMO gets the same help one level up. When Isabella opens OUTSIDE a project for an owner/admin (PMO), she proactively shows a deterministic Portfolio Briefing across all projects: overall health, what looks good, what needs attention (blocked critical-path work, active blockers, at-risk milestones, high-impact risks, overdue, unassigned, pending decisions), the projects that need attention most (ranked, each with a drill-in link), the top recommended actions, and verify links (Command Center, Reports, Projects). It uses the same canonical rules as the Command Center (task-activity + roadmap progress), so the numbers agree — there is no AI call on open and nothing is invented. Members and viewers do not receive the portfolio briefing.\n" +
        "Source: 16-isabella-ai-workforce.md → Portfolio Health Briefing (PMO).\n" +
        "Verify: as a PMO (owner/admin) open Isabella on the Command Center/home → a Portfolio Briefing appears; as a non-PMO outside a project → only the generic prompt.",
    },
    es: {
      title: "¿Isabella también le da al PMO un briefing del portafolio?",
      body:
        "Sí. El PM recibe un briefing del proyecto dentro de un proyecto; el PMO recibe la misma ayuda un nivel más arriba. Cuando Isabella se abre FUERA de un proyecto para un owner/admin (PMO), muestra proactivamente un Briefing del Portafolio determinista sobre todos los proyectos: salud general, lo que va bien, lo que requiere atención (trabajo bloqueado de ruta crítica, bloqueos activos, hitos en riesgo, riesgos de alto impacto, vencidos, sin responsable, decisiones pendientes), los proyectos que más requieren atención (priorizados, cada uno con enlace para entrar), las principales acciones recomendadas, y enlaces de verificación (Command Center, Reportes, Proyectos). Usa las mismas reglas canónicas que el Command Center (task-activity + roadmap), así que los números coinciden — no hay llamada de IA al abrir y no inventa nada. Los miembros y viewers no reciben el briefing del portafolio.\n" +
        "Fuente: 16-isabella-ai-workforce.md → Portfolio Health Briefing (PMO).\n" +
        "Verifica: como PMO (owner/admin) abre Isabella en el Command Center/home → aparece un Briefing del Portafolio; como no-PMO fuera de un proyecto → solo el prompt genérico.",
    },
  },
  {
    slug: "pi-living-graph-edge-tooltip",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "32-product-ux-contracts.md → UX-008; 12-living-graph-strategy.md → Edges are evidence",
    authority: "product_decision",
    en: {
      title: "What happens when I hover over a Living Graph connection?",
      body:
        "When you hover over a connection (edge) or its task-count label in the Living Graph, ProjectOps360° shows a read-only tooltip listing the tasks that connection represents and their current statuses — so you can understand what work links two milestones or phases without opening other panels. On touch devices, tap the task-count badge to open it. An edge that says \"3 tasks\" represents three tasks connecting the source and target milestone; hover it to see the list. The tooltip is read-only: it explains the tasks but does NOT change dependencies, tasks, milestones, blockers, or rollups, and it makes no database or AI call. Statuses use the same deterministic rules as the rest of the product — a completed task with a stale flag is shown as Done, not Blocked, and Waiting is distinct from Blocked (REG-008/010).\n" +
        "Source: 32-product-ux-contracts.md → UX-008 (Living Graph Edge Task Tooltip).\n" +
        "Verify: Execution Map → Living Graph (Milestones level) → hover an edge or its \"N tasks\" badge → the task list with statuses appears.",
    },
    es: {
      title: "¿Qué pasa cuando paso el cursor sobre una conexión del Living Graph?",
      body:
        "Cuando pasas el cursor sobre una conexión (edge) o sobre su etiqueta de cantidad de tareas en el Living Graph, ProjectOps360° muestra un tooltip de solo lectura con las tareas que representa esa conexión y su estado actual — así entiendes qué trabajo une dos hitos o fases sin abrir otros paneles. En dispositivos táctiles, toca la insignia de cantidad para abrirlo. Un edge que dice \"3 tareas\" representa tres tareas que conectan el hito origen y el destino; pásale el cursor para ver la lista. El tooltip es de solo lectura: explica las tareas pero NO cambia dependencias, tareas, hitos, bloqueos ni rollups, y no hace ninguna consulta a la base de datos ni llamada de IA. Los estados usan las mismas reglas deterministas que el resto del producto — una tarea completada con un flag obsoleto se muestra como Hecha, no Bloqueada, y En espera es distinto de Bloqueada (REG-008/010).\n" +
        "Fuente: 32-product-ux-contracts.md → UX-008 (Tooltip de Tareas en Edges del Living Graph).\n" +
        "Verifica: Execution Map → Living Graph (nivel Hitos) → pasa el cursor sobre un edge o su insignia \"N tareas\" → aparece la lista de tareas con estados.",
    },
  },
  {
    slug: "pi-closeout-report-process",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "32-product-ux-contracts.md → UX-010; docs/user-manual.md → Project Closeout",
    authority: "product_decision",
    en: {
      title: "How do I generate the Closeout Report?",
      body:
        "Open Command Center → Closeout Report. The page guides you through the process: (1) check closeout readiness, (2) resolve pending requirements (each one links to where you fix it — e.g. open tasks → Workboard, decisions → Decisions, budget → Budget), (3) run the Closing Project meeting in Project Memory → Rhythm Center, (4) once that meeting is completed, generate the AI Executive Summary, (5) review the report, (6) Download PDF. The Closing Project meeting runs in the Rhythm Center; the AI narrative is generated only after that meeting is completed — Download PDF exports the report, it does NOT generate the narrative. A Closeout Report is pending when one or more closeout requirements are incomplete (unresolved risks, decisions, follow-ups, open tasks, or missing budget data). Generating the summary requires PM/PMO/member permission (not viewers).\n" +
        "Source: 32-product-ux-contracts.md → UX-010 (Closeout Report process).\n" +
        "Verify: open a project → Closeout Report → the guided workflow + a state-appropriate primary button (Create/Open Closing Project Meeting · Generate Executive Summary · Download PDF).",
    },
    es: {
      title: "¿Cómo genero el Reporte de Cierre?",
      body:
        "Abre Command Center → Reporte de Cierre. La página te guía por el proceso: (1) revisar la preparación de cierre, (2) resolver los requisitos pendientes (cada uno enlaza a dónde se resuelve — p. ej. tareas abiertas → Workboard, decisiones → Decisiones, presupuesto → Presupuesto), (3) ejecutar la reunión de Cierre del Proyecto en Project Memory → Rhythm Center, (4) una vez completada esa reunión, generar el Resumen Ejecutivo con IA, (5) revisar el reporte, (6) Descargar PDF. La reunión de Cierre del Proyecto se ejecuta en el Rhythm Center; la narrativa con IA se genera solo después de completar esa reunión — Descargar PDF exporta el reporte, NO genera la narrativa. Un Reporte de Cierre está pendiente cuando hay requisitos de cierre incompletos (riesgos, decisiones o seguimientos sin resolver, tareas abiertas, o falta de datos de presupuesto). Generar el resumen requiere permiso de PM/PMO/miembro (no visores).\n" +
        "Fuente: 32-product-ux-contracts.md → UX-010 (proceso del Reporte de Cierre).\n" +
        "Verifica: abre un proyecto → Reporte de Cierre → el flujo guiado + un botón principal según el estado (Crear/Abrir reunión de Cierre · Generar Resumen Ejecutivo · Descargar PDF).",
    },
  },

  // ── Project Export & Blueprint (CAP — Project Export) ──────────────────────
  {
    slug: "pi-project-export-modes",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "PD-011 — Project Export & Blueprint Generator; 22-modules.md → Project Export",
    authority: "product_decision",
    en: {
      title: "What is the difference between Full Project Archive and Starter Blueprint?",
      body:
        "ProjectOps360° can export a project in two modes from Command Center → Export Project. Full Project Archive preserves the project AS EXECUTED — evidence, decisions, Project Memory, reports, risks, tasks, milestones, traceability and the Closeout Report — for audits, closeout and documentation. Starter Blueprint resets the project into a clean reusable template: it keeps the structure (phases, tasks, dependencies, roles, risk templates, document checklist) but resets statuses to planned, blanks actual dates, converts owners to role placeholders, and removes raw Project Memory, transcripts, actual costs and audit history. Export is READ-ONLY — it never changes your tasks, risks, memory, reports or project status. Every export package includes an export-manifest.json and is recorded in the audit log.\n" +
        "Source: PD-011 — Project Export & Blueprint Generator.\n" +
        "Verify: open a project → Command Center → Reports & Executive Outputs → Export Project.",
    },
    es: {
      title: "¿Cuál es la diferencia entre Archivo Completo y Plantilla (Blueprint)?",
      body:
        "ProjectOps360° puede exportar un proyecto en dos modos desde Command Center → Exportar Proyecto. El Archivo Completo preserva el proyecto TAL COMO SE EJECUTÓ — evidencia, decisiones, Memoria del Proyecto, reportes, riesgos, tareas, hitos, trazabilidad y el Reporte de Cierre — para auditorías, cierre y documentación. La Plantilla (Starter Blueprint) reinicia el proyecto en una plantilla limpia y reutilizable: mantiene la estructura (fases, tareas, dependencias, roles, plantillas de riesgo, checklist de documentos) pero reinicia estados a planificado, borra fechas reales, convierte responsables en marcadores de rol y elimina la Memoria del Proyecto en bruto, transcripciones, costos reales e historial de auditoría. La exportación es de SOLO LECTURA — no cambia tus tareas, riesgos, memoria, reportes ni el estado del proyecto. Cada paquete incluye un export-manifest.json y queda registrado en la auditoría.\n" +
        "Fuente: PD-011 — Project Export & Blueprint Generator.\n" +
        "Verifica: abre un proyecto → Command Center → Reportes y Salidas Ejecutivas → Exportar Proyecto.",
    },
  },
  {
    slug: "pi-project-export-blueprint-reuse",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "PD-011 — Project Export & Blueprint Generator (privacy + reuse)",
    authority: "product_decision",
    en: {
      title: "Does Starter Blueprint include Project Memory, and can I start a similar project from it?",
      body:
        "Not by default. A Starter Blueprint may include an optional lessons-learned summary, but raw Project Memory historical evidence and transcripts are removed unless explicitly selected — and even then, blueprints never carry private transcripts. Use Starter Blueprint to start a similar project faster: it preserves the phase/milestone structure, task templates, dependency patterns, roles and risk templates while resetting execution data (statuses → planned, dates blank, owners → role placeholders). The blueprint.json is import-ready for a future \"Create project from blueprint\", a simulation sandbox, or comparing two similar projects. Full Archive is restricted to PMO/Admin/Owner; Starter Blueprint is also available to the PM. Viewers cannot export.\n" +
        "Source: PD-011 — Project Export & Blueprint Generator.\n" +
        "Verify: Command Center → Export Project → Starter Blueprint → review the included/excluded list before exporting.",
    },
    es: {
      title: "¿La Plantilla incluye la Memoria del Proyecto y puedo iniciar un proyecto similar con ella?",
      body:
        "No por defecto. Una Plantilla puede incluir un resumen opcional de lecciones aprendidas, pero la evidencia histórica de la Memoria del Proyecto y las transcripciones se eliminan salvo que se seleccionen explícitamente — y aun así, las plantillas nunca llevan transcripciones privadas. Usa la Plantilla para iniciar un proyecto similar más rápido: conserva la estructura de fases/hitos, plantillas de tareas, patrones de dependencias, roles y plantillas de riesgo, mientras reinicia los datos de ejecución (estados → planificado, fechas en blanco, responsables → marcadores de rol). El blueprint.json está listo para un futuro \"Crear proyecto desde plantilla\", un entorno de simulación, o comparar dos proyectos similares. El Archivo Completo está restringido a PMO/Admin/Owner; la Plantilla también está disponible para el PM. Los visores no pueden exportar.\n" +
        "Fuente: PD-011 — Project Export & Blueprint Generator.\n" +
        "Verifica: Command Center → Exportar Proyecto → Plantilla → revisa la lista de incluido/excluido antes de exportar.",
    },
  },
];

/** Slugs every curated Product Brain package must include (used by tests). */
export const REQUIRED_PB_SLUGS = PRODUCT_BRAIN_PACKAGES.map((p) => p.slug);
