// ============================================================================
// Isabella — Execution Intelligence knowledge (Earned Value, cost, baseline)
// ============================================================================
// The August 2026 wave gave the product answers it did not have: what a phase
// cost, whether it is on schedule against a plan it was actually committed to,
// and when the money leaves. Isabella is asked for SPI and CPI BY NAME in
// steering committees.
//
// The risk with these is not that she cannot compute them. It is that she
// quotes one without saying what it needs, or reads a refusal as a good score:
// "not computable" rendered as 1.00 tells a committee the project is on plan
// when the truth is that nobody ever set a baseline.
//
// Kept in its own module rather than appended to the Product Brain manifest so
// this body of knowledge can be reviewed, revised and re-indexed as a unit.
// ============================================================================

import type { ProductBrainPackage } from "./product-brain-knowledge";

const DOMAIN = "product_intelligence" as const;

export const EXECUTION_INTELLIGENCE_PACKAGES: ProductBrainPackage[] = [
  {
    slug: "pi-evm-spi-cpi",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/kpi/earned-value.ts → scheduleIndex/costIndex; CAP-046",
    authority: "product_decision",
    en: {
      title: "How does ProjectOps360 calculate SPI and CPI, and when does it refuse to?",
      body:
        "SPI = EV / PV and CPI = EV / AC. PV is what the BASELINE said would be done by today; EV is the budget actually earned (baseline budget × percent complete); AC is what was really spent — LOGGED hours × the assigned resource's rate, never the estimate. The schedule side is computed in hours, so a project with no cost rates still gets a real SPI; only CPI needs money. EV is valued at the baseline budget, never today's estimate, so re-estimating a task cannot enlarge the budget it is judged against. Four cases return no answer rather than a number, and each means something different: no baseline (nothing was committed to), PV = 0 (today precedes all planned work), AC = 0 (nothing spent — not infinite efficiency), no rates (CPI unavailable; SPI unaffected). Never read a refusal as 1.00. A very HIGH CPI usually means hours are not being logged, not that the team is efficient.\n" +
        "Source: src/lib/kpi/earned-value.ts; catalog slugs spi, cpi, schedule_variance_hours, cost_variance, eac.\n" +
        "Verify: Execution Map → KPIs; or right-click a milestone in the Living Graph or Gantt to pin SPI/CPI to that phase.",
    },
    es: {
      title: "¿Cómo calcula ProjectOps360 el SPI y el CPI, y cuándo se niega a hacerlo?",
      body:
        "SPI = EV / PV y CPI = EV / AC. El PV es lo que la LÍNEA BASE decía que estaría hecho hoy; el EV es el presupuesto realmente ganado (presupuesto base × porcentaje completado); el AC es lo realmente gastado — horas REGISTRADAS × la tarifa del recurso asignado, nunca el estimado. La parte de cronograma se calcula en horas, así que un proyecto sin tarifas igual obtiene un SPI real; solo el CPI necesita dinero. El EV se valora al presupuesto de la línea base, nunca al estimado de hoy, para que reestimar una tarea no agrande el presupuesto contra el que se la juzga. Cuatro casos devuelven «no calculable» en vez de un número, y cada uno significa algo distinto: sin línea base (nunca hubo compromiso), PV = 0 (hoy es anterior a todo el trabajo planificado), AC = 0 (no se ha gastado nada, no es eficiencia infinita) y sin tarifas (el CPI no está disponible; el SPI no se ve afectado). Nunca leas una negativa como 1,00. Un CPI muy ALTO suele significar que no se están registrando horas, no que el equipo sea eficiente.\n" +
        "Fuente: src/lib/kpi/earned-value.ts; slugs del catálogo spi, cpi, schedule_variance_hours, cost_variance, eac.\n" +
        "Verifica: Mapa de Ejecución → KPIs; o clic derecho sobre un hito en el Grafo Vivo o el Cronograma para fijarle SPI/CPI a esa fase.",
    },
  },
  {
    slug: "pi-kpi-milestone-dimension",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/kpi/build-dataset.ts → buildMilestoneDatasets; milestone_kpi_pins",
    authority: "product_decision",
    en: {
      title: "Can a KPI be asked of a single milestone, and how is one attached to a phase?",
      body:
        "Yes. The expression engine was project-wide by construction, so «how many hours went into this phase?» could not be written down at all. A per-milestone dataset now has the SAME shape as the project dataset — built from that milestone's tasks — so every existing expression works unchanged in the narrower scope. There is still ONE engine and one set of semantics (REG-010). Attaching a KPI to a phase is a right-click on the milestone, in either the Living Graph or the Gantt: both read and write the same milestone_kpi_pins row, so a KPI pinned in one appears in the other. The pin stores only the ASSIGNMENT; the value is always computed live from canonical tables, never cached, so there is no second source to drift. A milestone holds at most 8 KPIs. Three outcomes stay distinguishable on a card: the value, «not computable» with its reason, and «KPI deleted» for a pin whose custom definition was removed.\n" +
        "Source: src/lib/kpi/build-dataset.ts, src/lib/kpi/milestone-pins.ts, migration 20260905000000_milestone_kpi_pins.\n" +
        "Verify: Living Graph or Execution Map → Gantt → right-click a milestone → «Measure this milestone by»; hover the card to see the values.",
    },
    es: {
      title: "¿Se puede pedir un KPI de un solo hito y cómo se le asocia uno a una fase?",
      body:
        "Sí. El motor de expresiones era de proyecto entero por construcción, así que «¿cuántas horas lleva esta fase?» no se podía ni escribir. Ahora el dataset de un hito tiene LA MISMA forma que el del proyecto — construido con las tareas de ese hito — de modo que toda expresión existente funciona igual en el ámbito reducido. Sigue habiendo UN solo motor y una sola semántica (REG-010). Asociar un KPI a una fase es un clic derecho sobre el hito, en el Grafo Vivo o en el Cronograma: ambos leen y escriben la misma fila de milestone_kpi_pins, así que un KPI fijado en uno aparece en el otro. El pin guarda solo la ASIGNACIÓN; el valor se calcula siempre en vivo desde las tablas canónicas, nunca en caché, para que no exista una segunda fuente que se desvíe. Un hito admite como máximo 8 KPIs. Tres resultados se distinguen en la tarjeta: el valor, «no calculable» con su motivo, y «KPI eliminado» para un pin cuya definición personalizada se borró.\n" +
        "Fuente: src/lib/kpi/build-dataset.ts, src/lib/kpi/milestone-pins.ts, migración 20260905000000_milestone_kpi_pins.\n" +
        "Verifica: Grafo Vivo o Mapa de Ejecución → Cronograma → clic derecho en un hito → «Medir este hito por»; pasa el ratón por la tarjeta para ver los valores.",
    },
  },
  {
    slug: "pi-kpi-expression-rules",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/kpi/reference.ts; src/lib/kpi/parser.ts → allow-list",
    authority: "product_decision",
    en: {
      title: "What can a KPI expression contain, and what is the cost-of-zero trap?",
      body:
        "Expressions run in a sandbox over an allow-list of dataset variables and functions: SUM, AVG, COUNT, MEDIAN, PERCENTILE, CORRELATION, TREND, MOVING_AVERAGE, FORECAST, ABS, ROUND, MIN, MAX. The rule that catches everyone: AGGREGATE FIRST, then do arithmetic on the numbers. SUM(a) * SUM(b) is valid; SUM(a * b) is rejected — there is no element-wise arithmetic, so multiplying two columns inside an aggregate raises «Array values require an aggregate function». Cost variables exist because hours alone cannot answer money questions: task_cost (hours at the assigned resource's rate), actual_cost (LOGGED hours only), priced_flag (whether the task can be priced at all) and milestone_budget. The trap: SUM over an empty set is 0, so an unguarded cost KPI reports «$0» for a project where nothing has a rate — a confident zero that reads as «this was free». Built-in cost KPIs divide by MIN(1, COUNT(...)) so that zero priced tasks answers «not computable» instead.\n" +
        "Source: src/lib/kpi/reference.ts, src/lib/kpi/catalog.ts.\n" +
        "Verify: Execution Map → KPIs → expand «Available fields and functions».",
    },
    es: {
      title: "¿Qué puede contener una expresión de KPI y cuál es la trampa del coste cero?",
      body:
        "Las expresiones se ejecutan en un sandbox sobre una lista blanca de variables y funciones: SUM, AVG, COUNT, MEDIAN, PERCENTILE, CORRELATION, TREND, MOVING_AVERAGE, FORECAST, ABS, ROUND, MIN, MAX. La regla que sorprende a todos: AGREGA PRIMERO y opera después sobre los números. SUM(a) * SUM(b) es válido; SUM(a * b) se rechaza — no hay aritmética elemento a elemento, así que multiplicar dos columnas dentro de un agregado lanza «Array values require an aggregate function». Las variables de coste existen porque las horas solas no responden preguntas de dinero: task_cost (horas a la tarifa del recurso asignado), actual_cost (solo horas REGISTRADAS), priced_flag (si la tarea se puede valorar) y milestone_budget. La trampa: SUM sobre un conjunto vacío da 0, así que un KPI de coste sin protección reporta «$0» en un proyecto donde nada tiene tarifa — un cero confiado que se lee como «esto fue gratis». Los KPIs de coste integrados dividen entre MIN(1, COUNT(...)) para que cero tareas valoradas responda «no calculable».\n" +
        "Fuente: src/lib/kpi/reference.ts, src/lib/kpi/catalog.ts.\n" +
        "Verifica: Mapa de Ejecución → KPIs → despliega «Campos y funciones disponibles».",
    },
  },
  {
    slug: "pi-schedule-baseline",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "migration 20260906000000_schedule_baseline; Product Brain pi-variance-baseline",
    authority: "product_decision",
    en: {
      title: "What is the schedule baseline, and what does the product refuse to do without one?",
      body:
        "The baseline holds the dates the work was COMMITTED to: roadmap_tasks.baseline_start_date, baseline_end_date and baseline_estimate_hours, plus milestones.baseline_start_date and baseline_target_date. Ordinary rescheduling never touches them — that is exactly what makes slippage and Planned Value measurable. Provenance is mandatory: projects.baseline_source records where it came from ('import' = the plan as delivered in the source file, 'current_plan' = a snapshot of today's dates, 'manual'), alongside baseline_captured_at and baseline_captured_by. The product NEVER fabricates a baseline. baseline_captured_at IS NULL means NO baseline exists; it must never be read as zero variance, and SPI answers «no baseline» rather than 1.00. The Gantt draws the committed plan as a dashed ghost bar ONLY where the dates differ from today's, because a ghost under every bar is noise that teaches the eye to ignore the one that actually moved.\n" +
        "Source: migration 20260906000000_schedule_baseline; Product Brain pi-variance-baseline.\n" +
        "Verify: Execution Map → Gantt → the «Original plan» toggle and its drift count.",
    },
    es: {
      title: "¿Qué es la línea base del cronograma y qué se niega a hacer el producto sin ella?",
      body:
        "La línea base guarda las fechas a las que el trabajo se COMPROMETIÓ: roadmap_tasks.baseline_start_date, baseline_end_date y baseline_estimate_hours, más milestones.baseline_start_date y baseline_target_date. La reprogramación normal nunca las toca — eso es justo lo que hace medible el desvío y el Valor Planificado. La procedencia es obligatoria: projects.baseline_source registra de dónde vino ('import' = el plan tal como llegó en el archivo origen, 'current_plan' = una foto de las fechas de hoy, 'manual'), junto con baseline_captured_at y baseline_captured_by. El producto NUNCA fabrica una línea base. Si baseline_captured_at es NULL, NO existe línea base; jamás debe leerse como desviación cero, y el SPI responde «sin línea base» en vez de 1,00. El Cronograma dibuja el plan comprometido como una barra fantasma punteada SOLO donde las fechas difieren de las de hoy, porque un fantasma bajo cada barra es ruido que enseña al ojo a ignorar la que sí se movió.\n" +
        "Fuente: migración 20260906000000_schedule_baseline; Product Brain pi-variance-baseline.\n" +
        "Verifica: Mapa de Ejecución → Cronograma → el interruptor «Plan inicial» y su conteo de desviación.",
    },
  },
  {
    slug: "pi-milestone-cost-rollup",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/roadmap/milestone-cost-rollup.ts; src/lib/roadmap/cash-flow.ts",
    authority: "product_decision",
    en: {
      title: "How does the product answer «what did this phase cost» and «when does the money leave»?",
      body:
        "The per-milestone rollup adds effort (estimated, actual, signed variance), time (earliest task start to latest task end) and money. Labour is priced PER TASK at the rate of the RESOURCE assigned to it, not a blended project rate, because one blended rate flattens exactly the difference between an architect's hour and a junior's. Budget comes from the budget line matching the milestone: the budget_items.milestone_id foreign key first, falling back to matching by NAME, because no importer populates that FK — plans express the link by sharing a name. A figure the data cannot support is null, NEVER 0, and tasksWithoutRate reports how many tasks could not be priced so a partial figure is never mistaken for a total. Monthly cash flow spreads each task's cost across the months it is worked, weighted by calendar days in each — the only distribution this data supports; a resource-loaded S-curve would be invented. A month with no spend still appears with zeros, because dropping it would draw a curve implying spending through a pause that really happened.\n" +
        "Source: src/lib/roadmap/milestone-cost-rollup.ts, src/lib/roadmap/cash-flow.ts.\n" +
        "Verify: Execution Map → Gantt → the monthly cash-flow panel below the chart.",
    },
    es: {
      title: "¿Cómo responde el producto «cuánto costó esta fase» y «cuándo sale el dinero»?",
      body:
        "El rollup por hito suma esfuerzo (estimado, real, desviación con signo), tiempo (del inicio más temprano al fin más tardío de sus tareas) y dinero. La mano de obra se valora POR TAREA a la tarifa del RECURSO asignado, no con una tarifa mezclada del proyecto, porque una tarifa única aplana justo la diferencia entre la hora de un arquitecto y la de un junior. El presupuesto sale de la línea que corresponde al hito: primero la clave foránea budget_items.milestone_id y, si no, coincidencia por NOMBRE, porque ningún importador rellena esa clave — los planes expresan el vínculo compartiendo nombre. Una cifra que los datos no sostienen es nula, NUNCA 0, y tasksWithoutRate informa cuántas tareas no se pudieron valorar para que una cifra parcial no se confunda con un total. El flujo de caja mensual reparte el coste de cada tarea entre los meses en que se trabaja, ponderado por días de calendario en cada uno — la única distribución que estos datos sostienen; una curva S con carga de recursos sería inventada. Un mes sin gasto igual aparece con ceros, porque quitarlo dibujaría una curva que implica gasto continuo durante una pausa que sí ocurrió.\n" +
        "Fuente: src/lib/roadmap/milestone-cost-rollup.ts, src/lib/roadmap/cash-flow.ts.\n" +
        "Verifica: Mapa de Ejecución → Cronograma → el panel de flujo de caja mensual bajo el gráfico.",
    },
  },
  {
    slug: "pi-sap-activate-method",
    domain: DOMAIN,
    tier: "verified",
    sourceRef: "src/lib/delivery/config.ts → SAP_ACTIVATE_PHASES; src/lib/delivery/recommend.ts",
    authority: "product_decision",
    en: {
      title: "When does ProjectOps360 recommend SAP Activate, and when must it stay silent?",
      body:
        "SAP Activate is a selectable delivery method with six phases — Discover, Prepare, Explore, Realize, Deploy, Run — each closed by a numbered quality gate Q0 to Q5 with its own exit criteria. It is not «predictive with SAP words»: each phase runs iteratively inside and cannot close until its gate passes. The recommendation is keyed on the PLATFORM, never on the project type. project_type = 'erp' reads «ERP / System Implementation» and covers Oracle, Dynamics, Salesforce and Workday, so recommending SAP's methodology from the type alone would confidently tell an Oracle customer to follow SAP's process. The wizard asks for the platform on implementation-type projects, and an UNANSWERED platform recommends nothing vendor-specific — not knowing is not the same as knowing it is not SAP, and a governed ERP with no platform still gets hybrid. Governance raises confidence (84 → 92) rather than deciding the answer: a SAP implementation runs on SAP Activate whatever its ceremony level.\n" +
        "Source: src/lib/delivery/config.ts, src/lib/delivery/recommend.ts; migrations 20260904000000, 20260908000000.\n" +
        "Verify: Project → Delivery → wizard → project type ERP + platform SAP; the phases and gates render in the Delivery overview.",
    },
    es: {
      title: "¿Cuándo recomienda ProjectOps360 SAP Activate y cuándo debe callarse?",
      body:
        "SAP Activate es un método de entrega seleccionable con seis fases — Descubrimiento, Preparación, Exploración, Realización, Despliegue y Soporte a la operación — cada una cerrada por un quality gate numerado de Q0 a Q5 con sus propios criterios de salida. No es «predictivo con palabras de SAP»: cada fase se ejecuta por ciclos y no cierra hasta que su gate se aprueba. La recomendación se apoya en la PLATAFORMA, nunca en el tipo de proyecto. project_type = 'erp' significa «ERP / Implementación de sistemas» y cubre Oracle, Dynamics, Salesforce y Workday, así que recomendar la metodología de SAP solo por el tipo le diría con toda confianza a un cliente de Oracle que siga el proceso de SAP. El asistente pregunta la plataforma en proyectos de implementación, y una plataforma SIN RESPONDER no recomienda nada específico de proveedor — no saber no es lo mismo que saber que no es SAP, y un ERP con gobernanza alta sin plataforma sigue recibiendo híbrido. La gobernanza sube la confianza (84 → 92) en vez de decidir la respuesta: una implantación SAP se ejecuta con SAP Activate tenga la ceremonia que tenga.\n" +
        "Fuente: src/lib/delivery/config.ts, src/lib/delivery/recommend.ts; migraciones 20260904000000, 20260908000000.\n" +
        "Verifica: Proyecto → Delivery → asistente → tipo ERP + plataforma SAP; las fases y gates se muestran en el resumen de Delivery.",
    },
  },
];
