// ============================================================================
// Acronym Intelligence — schedule corpus (CAP-050)
// ============================================================================
// This is the half of the vocabulary that actually answers "how late are we".
// The EVM entries repeatedly redirect here (SV and SPI both say calendar slip
// comes from TF and CPM, not from them), so these entries carry the load of
// being the place that redirection lands.
//
// Units matter as much as they do in EVM, in the opposite direction: everything
// here is DAYS, and none of it converts into money.
// ============================================================================

import type { AcronymEntry } from "./contracts";

const V = "1.0.0";
const PMBOK = "PMBOK Guide 7th ed. / Practice Standard for Scheduling";

export const SCHEDULE_ENTRIES: AcronymEntry[] = [
  {
    code: "CPM",
    category: "schedule",
    fullName: { en: "Critical Path Method", es: "Método del Camino Crítico" },
    shortDefinition: {
      en: "Schedule technique that computes earliest and latest dates from the dependency network to find the longest path.",
      es: "Técnica de cronograma que calcula fechas tempranas y tardías a partir de la red de dependencias para hallar el camino más largo.",
    },
    fullDefinition: {
      en: "CPM computes, for every activity, the earliest it can start and finish (a forward pass) and the latest it can start and finish without delaying the project (a backward pass). The difference is float. Activities with no float form the critical path — the sequence that determines the project duration. CPM is the ONLY source of a defensible finish date in this product; a date derived any other way is an assertion, not a calculation.",
      es: "El CPM calcula, para cada actividad, lo más pronto que puede empezar y terminar (pasada hacia adelante) y lo más tarde que puede empezar y terminar sin retrasar el proyecto (pasada hacia atrás). La diferencia es la holgura. Las actividades sin holgura forman el camino crítico — la secuencia que determina la duración del proyecto. El CPM es la ÚNICA fuente de una fecha de fin defendible en este producto; una fecha obtenida de otro modo es una afirmación, no un cálculo.",
    },
    unit: "days",
    caveats: {
      en: [
        "CPM is only as good as the dependency network. Missing links produce a critical path that is shorter than reality.",
        "CPM propagates delay through real dependencies only. This product will not decide that task B moved because task A moved unless an actual dependency edge says so.",
      ],
      es: [
        "El CPM vale lo que valga la red de dependencias. Enlaces ausentes producen un camino crítico más corto que la realidad.",
        "El CPM propaga el retraso solo a través de dependencias reales. Este producto no decidirá que la tarea B se movió porque se movió la A salvo que exista una arista de dependencia real que lo diga.",
      ],
    },
    relatedTerms: ["CP", "ES", "EF", "LS", "LF", "TF", "FF", "PERT"],
    source: PMBOK,
    version: V,
  },
  {
    code: "CP",
    category: "schedule",
    fullName: { en: "Critical Path", es: "Camino Crítico" },
    shortDefinition: {
      en: "The longest dependency chain through the project. Its length is the project duration; its tasks have zero float.",
      es: "La cadena de dependencias más larga del proyecto. Su longitud es la duración del proyecto; sus tareas tienen holgura cero.",
    },
    fullDefinition: {
      en: "The critical path is the sequence of activities that determines the shortest possible project duration. Every activity on it has zero total float, so a one-day delay to any of them delays the whole project by a day. Work off the critical path can slip by up to its float without moving the finish date — which is why 'we are behind on several tasks' and 'we will finish late' are different statements.",
      es: "El camino crítico es la secuencia de actividades que determina la duración mínima posible del proyecto. Cada actividad en él tiene holgura total cero, así que un día de retraso en cualquiera retrasa todo el proyecto un día. El trabajo fuera del camino crítico puede desfasarse hasta el límite de su holgura sin mover la fecha de fin — por eso «vamos atrasados en varias tareas» y «terminaremos tarde» son afirmaciones distintas.",
    },
    unit: "days",
    favorableDirection: "lower",
    caveats: {
      en: [
        "A project can have several critical paths at once. Fixing one does not shorten the project if another is equally long.",
        "The critical path moves as work progresses. Yesterday's critical path is not evidence about today's.",
      ],
      es: [
        "Un proyecto puede tener varios caminos críticos a la vez. Arreglar uno no acorta el proyecto si otro es igual de largo.",
        "El camino crítico se mueve conforme avanza el trabajo. El camino crítico de ayer no es evidencia sobre el de hoy.",
      ],
    },
    relatedTerms: ["CPM", "TF", "ES", "LF"],
    source: PMBOK,
    version: V,
  },
  {
    code: "ES",
    category: "schedule",
    fullName: { en: "Early Start", es: "Inicio Temprano" },
    shortDefinition: {
      en: "The earliest an activity can begin given its predecessors. From the CPM forward pass.",
      es: "Lo más pronto que una actividad puede comenzar dadas sus predecesoras. De la pasada hacia adelante del CPM.",
    },
    fullDefinition: {
      en: "Early Start is the earliest date an activity can start without violating any dependency — the result of the forward pass through the network. It is a constraint-derived date, not a plan: an activity may be scheduled later than its ES for resource reasons without any of that being a delay.",
      es: "El Inicio Temprano es la fecha más temprana en que una actividad puede comenzar sin violar ninguna dependencia — resultado de la pasada hacia adelante por la red. Es una fecha derivada de restricciones, no un plan: una actividad puede programarse más tarde que su ES por motivos de recursos sin que nada de eso sea un retraso.",
    },
    unit: "days",
    relatedTerms: ["CPM", "EF", "LS", "LF", "TF"],
    source: PMBOK,
    version: V,
  },
  {
    code: "EF",
    category: "schedule",
    fullName: { en: "Early Finish", es: "Fin Temprano" },
    shortDefinition: {
      en: "The earliest an activity can end, given its early start and duration.",
      es: "Lo más pronto que una actividad puede terminar, dados su inicio temprano y su duración.",
    },
    fullDefinition: {
      en: "Early Finish is Early Start plus the activity duration — the earliest the activity can complete if it starts as soon as its predecessors allow. Together ES and EF define the earliest window the activity can occupy.",
      es: "El Fin Temprano es el Inicio Temprano más la duración de la actividad — lo más pronto que puede completarse si empieza en cuanto sus predecesoras lo permiten. Juntos, ES y EF definen la ventana más temprana que la actividad puede ocupar.",
    },
    unit: "days",
    relatedTerms: ["CPM", "ES", "LF", "TF", "FF"],
    source: PMBOK,
    version: V,
  },
  {
    code: "LS",
    category: "schedule",
    fullName: { en: "Late Start", es: "Inicio Tardío" },
    shortDefinition: {
      en: "The latest an activity can begin without delaying the project. From the CPM backward pass.",
      es: "Lo más tarde que una actividad puede comenzar sin retrasar el proyecto. De la pasada hacia atrás del CPM.",
    },
    fullDefinition: {
      en: "Late Start is the latest date an activity can begin without pushing the project finish date. It comes from the backward pass. The gap between LS and ES is the activity's total float — the slack it genuinely has.",
      es: "El Inicio Tardío es la fecha más tardía en que una actividad puede comenzar sin empujar la fecha de fin del proyecto. Proviene de la pasada hacia atrás. La diferencia entre LS y ES es la holgura total de la actividad — el margen que realmente tiene.",
    },
    unit: "days",
    relatedTerms: ["CPM", "LF", "ES", "TF"],
    source: PMBOK,
    version: V,
  },
  {
    code: "LF",
    category: "schedule",
    fullName: { en: "Late Finish", es: "Fin Tardío" },
    shortDefinition: {
      en: "The latest an activity can end without delaying the project.",
      es: "Lo más tarde que una actividad puede terminar sin retrasar el proyecto.",
    },
    fullDefinition: {
      en: "Late Finish is the latest date an activity can complete without delaying any successor beyond its own late dates, and therefore without moving the project finish. LF minus EF is the activity's total float.",
      es: "El Fin Tardío es la fecha más tardía en que una actividad puede completarse sin retrasar ninguna sucesora más allá de sus propias fechas tardías y, por tanto, sin mover el fin del proyecto. LF menos EF es la holgura total de la actividad.",
    },
    unit: "days",
    relatedTerms: ["CPM", "LS", "EF", "TF"],
    source: PMBOK,
    version: V,
  },
  {
    code: "TF",
    category: "schedule",
    fullName: { en: "Total Float", es: "Holgura Total" },
    shortDefinition: {
      en: "How many days an activity can slip before the project finish date moves. Zero float means critical.",
      es: "Cuántos días puede desfasarse una actividad antes de que se mueva la fecha de fin del proyecto. Holgura cero significa crítica.",
    },
    fullDefinition: {
      en: "Total float is the amount of time an activity can be delayed from its early dates without delaying the project completion. It is the single most useful number for triage: an activity with 15 days of float that is 3 days late is not a problem, and an activity with zero float that is 1 day late is. This — not SV or SPI — is where calendar delay lives.",
      es: "La holgura total es el tiempo que una actividad puede retrasarse respecto a sus fechas tempranas sin retrasar la finalización del proyecto. Es la cifra más útil para priorizar: una actividad con 15 días de holgura que va 3 días tarde no es un problema, y una con holgura cero que va 1 día tarde sí lo es. Aquí — no en el SV ni el SPI — es donde vive el retraso en calendario.",
    },
    formulas: [
      { id: "tf_start", expression: "TF = LS − ES", isDefault: true },
      {
        id: "tf_finish",
        expression: "TF = LF − EF",
        label: {
          en: "Equivalent form. Both give the same value for a well-formed network.",
          es: "Forma equivalente. Ambas dan el mismo valor en una red bien formada.",
        },
      },
    ],
    formulaVariables: [
      { symbol: "LS", meaning: { en: "Late Start", es: "Inicio Tardío" }, code: "LS" },
      { symbol: "ES", meaning: { en: "Early Start", es: "Inicio Temprano" }, code: "ES" },
      { symbol: "LF", meaning: { en: "Late Finish", es: "Fin Tardío" }, code: "LF" },
      { symbol: "EF", meaning: { en: "Early Finish", es: "Fin Temprano" }, code: "EF" },
    ],
    unit: "days",
    favorableDirection: "higher",
    interpretation: {
      en: "TF = 0 means the activity is critical: any slip delays the project. TF > 0 is the slack available. TF < 0 means the schedule is already infeasible against a constraint.",
      es: "TF = 0 significa que la actividad es crítica: cualquier desfase retrasa el proyecto. TF > 0 es el margen disponible. TF < 0 significa que el cronograma ya es inviable frente a una restricción.",
    },
    caveats: {
      en: [
        "Total float is shared along a chain. Two activities each showing 10 days of float may be sharing the same 10 days, not holding 20 between them.",
        "Float is measured in days and never converts into money. Do not read it against SV or CV.",
      ],
      es: [
        "La holgura total es compartida a lo largo de una cadena. Dos actividades que muestran 10 días de holgura cada una pueden estar compartiendo los mismos 10 días, no acumulando 20 entre ambas.",
        "La holgura se mide en días y nunca se convierte en dinero. No la leas contra el SV ni el CV.",
      ],
    },
    example: {
      en: "An activity with ES = day 10 and LS = day 25 has TF = 15 days: it can start up to 15 days late before the project finish moves.",
      es: "Una actividad con ES = día 10 y LS = día 25 tiene TF = 15 días: puede empezar hasta 15 días tarde antes de que se mueva el fin del proyecto.",
    },
    relatedTerms: ["CPM", "CP", "FF", "LS", "ES", "SV", "SPI"],
    source: PMBOK,
    version: V,
  },
  {
    code: "FF",
    category: "schedule",
    fullName: { en: "Free Float", es: "Holgura Libre" },
    shortDefinition: {
      en: "How many days an activity can slip without delaying any immediate successor. Never more than total float.",
      es: "Cuántos días puede desfasarse una actividad sin retrasar a ninguna sucesora inmediata. Nunca mayor que la holgura total.",
    },
    fullDefinition: {
      en: "Free float is the delay an activity can absorb without pushing the early start of any of its successors. It is the float the activity owns outright, as opposed to total float which may be shared along the chain. Free float is always less than or equal to total float.",
      es: "La holgura libre es el retraso que una actividad puede absorber sin empujar el inicio temprano de ninguna de sus sucesoras. Es la holgura que la actividad posee en exclusiva, a diferencia de la holgura total, que puede compartirse a lo largo de la cadena. La holgura libre es siempre menor o igual que la total.",
    },
    unit: "days",
    favorableDirection: "higher",
    caveats: {
      en: ["Consuming free float is invisible at project level but real to the next team in the chain."],
      es: ["Consumir la holgura libre es invisible a nivel de proyecto pero real para el siguiente equipo de la cadena."],
    },
    relatedTerms: ["TF", "CPM", "EF", "ES"],
    source: PMBOK,
    version: V,
  },
  {
    code: "PERT",
    category: "schedule",
    fullName: { en: "Program Evaluation and Review Technique", es: "Técnica de Revisión y Evaluación de Programas" },
    shortDefinition: {
      en: "Three-point estimate that weights the most likely case four times against optimistic and pessimistic.",
      es: "Estimación de tres puntos que pondera el caso más probable cuatro veces frente al optimista y el pesimista.",
    },
    fullDefinition: {
      en: "PERT produces an expected duration from three estimates — optimistic, most likely and pessimistic — weighting the most likely case four times as heavily as the extremes. It exists because a single-point estimate hides the shape of the uncertainty: two activities can both be estimated at 10 days while one ranges 9–11 and the other 5–30.",
      es: "PERT produce una duración esperada a partir de tres estimaciones — optimista, más probable y pesimista — ponderando el caso más probable cuatro veces más que los extremos. Existe porque una estimación de un solo punto oculta la forma de la incertidumbre: dos actividades pueden estimarse ambas en 10 días mientras una varía entre 9 y 11 y la otra entre 5 y 30.",
    },
    formulas: [{ id: "pert_beta", expression: "PERT = (O + 4M + P) / 6", isDefault: true }],
    formulaVariables: [
      { symbol: "O", meaning: { en: "Optimistic duration", es: "Duración optimista" } },
      { symbol: "M", meaning: { en: "Most likely duration", es: "Duración más probable" } },
      { symbol: "P", meaning: { en: "Pessimistic duration", es: "Duración pesimista" } },
    ],
    unit: "days",
    caveats: {
      en: [
        "PERT gives a single expected value. It does not give a probability of meeting a date — that needs a Monte Carlo simulation across the whole network.",
        "Summing PERT estimates along a path understates risk, because the pessimistic cases do not all occur together.",
      ],
      es: [
        "PERT da un único valor esperado. No da una probabilidad de cumplir una fecha — para eso hace falta una simulación de Monte Carlo sobre toda la red.",
        "Sumar estimaciones PERT a lo largo de un camino subestima el riesgo, porque los casos pesimistas no ocurren todos a la vez.",
      ],
    },
    example: {
      en: "O = 4 days, M = 6 days, P = 14 days gives PERT = (4 + 24 + 14) / 6 = 7 days.",
      es: "O = 4 días, M = 6 días, P = 14 días da PERT = (4 + 24 + 14) / 6 = 7 días.",
    },
    relatedTerms: ["CPM", "MCS", "P50", "P80"],
    source: PMBOK,
    version: V,
  },
];
