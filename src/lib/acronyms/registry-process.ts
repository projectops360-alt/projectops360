// ============================================================================
// Acronym Intelligence — resource & process corpus (CAP-050)
// ============================================================================
// The recurring confusion in this category is capacity vs headcount. CAP-048 §5
// already forces the simulation to display which engine produced a figure
// because "hours" and "people" are not the same quantity; FTE is the term that
// sits exactly on that fault line, so its caveats carry the same rule.
//
// The flow terms (WIP, CT, LT, RT, STP) come from process mining, where the
// trap is different: they are measured over a window of completed cases, so a
// change in the mix of cases moves them without anything about the process
// having changed.
// ============================================================================

import type { AcronymEntry } from "./contracts";

const V = "1.0.0";

export const PROCESS_ENTRIES: AcronymEntry[] = [
  {
    code: "FTE",
    category: "resource",
    fullName: { en: "Full-Time Equivalent", es: "Equivalente a Tiempo Completo" },
    shortDefinition: {
      en: "Capacity expressed as full-time people. 0.5 FTE is half a person's time, not half a person.",
      es: "Capacidad expresada en personas a tiempo completo. 0,5 FTE es la mitad del tiempo de una persona, no media persona.",
    },
    fullDefinition: {
      en: "FTE converts working hours into a count of notional full-time people, so that part-time and shared allocations can be added up. Two people at 50% each are 1.0 FTE of capacity. It is a capacity measure, not a headcount: 1.0 FTE may be one person or four, and those two situations behave very differently in practice even though the number is identical.",
      es: "El FTE convierte horas de trabajo en un recuento de personas nocionales a tiempo completo, de modo que asignaciones parciales y compartidas puedan sumarse. Dos personas al 50 % cada una son 1,0 FTE de capacidad. Es una medida de capacidad, no de plantilla: 1,0 FTE puede ser una persona o cuatro, y esas dos situaciones se comportan muy distinto en la práctica aunque el número sea idéntico.",
    },
    unit: "count",
    favorableDirection: "context_dependent",
    caveats: {
      en: [
        "FTE is capacity, not headcount. Do not read an FTE figure as a number of people.",
        "Adding FTE does not proportionally shorten work. Coordination overhead, ramp-up and task dependencies all break the arithmetic — this product will not shorten a duration because capacity was added unless linked work actually exists.",
      ],
      es: [
        "El FTE es capacidad, no plantilla. No leas una cifra de FTE como un número de personas.",
        "Añadir FTE no acorta el trabajo proporcionalmente. La sobrecarga de coordinación, la curva de aprendizaje y las dependencias entre tareas rompen esa aritmética — este producto no acortará una duración porque se haya añadido capacidad salvo que exista trabajo vinculado real.",
      ],
    },
    example: {
      en: "Three people allocated at 40%, 60% and 100% total 2.0 FTE of capacity across three individuals.",
      es: "Tres personas asignadas al 40 %, 60 % y 100 % suman 2,0 FTE de capacidad repartidos entre tres individuos.",
    },
    relatedTerms: ["RCI", "WIP", "SLA"],
    source: "Internal — resource capacity model (ADR-003/009)",
    version: V,
  },
  {
    code: "RCI",
    category: "resource",
    fullName: { en: "Resource Capacity Index", es: "Índice de Capacidad de Recursos" },
    shortDefinition: {
      en: "Committed work against available capacity. Above 1 means more work is assigned than there is capacity for.",
      es: "Trabajo comprometido frente a capacidad disponible. Por encima de 1 hay más trabajo asignado que capacidad.",
    },
    fullDefinition: {
      en: "RCI is the ratio of assigned work to available capacity over a period. Below 1 there is slack; at 1 the resource is fully committed with no absorption for anything unplanned; above 1 the plan requires more hours than exist and something will slip. Because it is a ratio of two hour-based quantities it is unitless and comparable across teams of different sizes.",
      es: "El RCI es la razón entre trabajo asignado y capacidad disponible en un periodo. Por debajo de 1 hay margen; en 1 el recurso está plenamente comprometido sin capacidad de absorber imprevistos; por encima de 1 el plan exige más horas de las que existen y algo se desplazará. Al ser una razón entre dos cantidades en horas, es adimensional y comparable entre equipos de distinto tamaño.",
    },
    unit: "ratio",
    favorableDirection: "target_one",
    interpretation: {
      en: "Below 1 is spare capacity. At 1 the resource is fully loaded. Above 1 is over-allocation: the plan is not executable as written.",
      es: "Por debajo de 1 hay capacidad libre. En 1 el recurso está plenamente cargado. Por encima de 1 hay sobreasignación: el plan no es ejecutable tal como está escrito.",
    },
    caveats: {
      en: [
        "Sustained utilisation at exactly 1.0 is not a healthy target. A fully loaded system has no capacity to absorb variation, and queues grow sharply as utilisation approaches 100%.",
        "RCI averages over a period. A resource at 0.9 for a month can still be at 2.0 in one week of it.",
      ],
      es: [
        "Una utilización sostenida de exactamente 1,0 no es un objetivo saludable. Un sistema plenamente cargado no tiene capacidad para absorber variación, y las colas crecen abruptamente conforme la utilización se acerca al 100 %.",
        "El RCI promedia sobre un periodo. Un recurso a 0,9 durante un mes puede estar a 2,0 en una de sus semanas.",
      ],
    },
    relatedTerms: ["FTE", "WIP", "CT"],
    source: "Internal — resource capacity model (ADR-003/009)",
    version: V,
  },
  {
    code: "WIP",
    category: "resource",
    fullName: { en: "Work in Progress", es: "Trabajo en Curso" },
    shortDefinition: {
      en: "Items started but not finished. High WIP lengthens cycle time without adding throughput.",
      es: "Elementos empezados pero no terminados. Un WIP alto alarga el tiempo de ciclo sin aumentar el rendimiento.",
    },
    fullDefinition: {
      en: "WIP counts the items currently in flight. It matters because of Little's Law: average cycle time equals WIP divided by throughput. Starting more work without finishing more does not increase output — it only stretches how long each item takes, which is why limiting WIP shortens delivery times without anyone working faster.",
      es: "El WIP cuenta los elementos actualmente en curso. Importa por la Ley de Little: el tiempo de ciclo medio es igual al WIP dividido por el rendimiento. Empezar más trabajo sin terminar más no aumenta la producción — solo estira cuánto tarda cada elemento, y por eso limitar el WIP acorta los tiempos de entrega sin que nadie trabaje más rápido.",
    },
    formulas: [
      {
        id: "wip_littles_law",
        expression: "Cycle Time = WIP / Throughput",
        label: { en: "Little's Law", es: "Ley de Little" },
        isDefault: true,
      },
    ],
    formulaVariables: [
      { symbol: "WIP", meaning: { en: "Items currently in progress", es: "Elementos actualmente en curso" }, code: "WIP" },
      { symbol: "Throughput", meaning: { en: "Items completed per unit of time", es: "Elementos completados por unidad de tiempo" } },
    ],
    unit: "count",
    favorableDirection: "lower",
    caveats: {
      en: ["Little's Law holds for a stable system over a long enough window. Applied to a short window with a changing arrival rate it gives a misleading cycle time."],
      es: ["La Ley de Little se cumple en un sistema estable sobre una ventana suficientemente larga. Aplicada a una ventana corta con tasa de llegada cambiante, da un tiempo de ciclo engañoso."],
    },
    relatedTerms: ["CT", "LT", "RCI", "STP"],
    source: "Little's Law / Lean flow",
    version: V,
  },
  {
    code: "SLA",
    category: "resource",
    fullName: { en: "Service Level Agreement", es: "Acuerdo de Nivel de Servicio" },
    shortDefinition: {
      en: "A committed threshold for a service measure, such as resolving 95% of cases within five days.",
      es: "Umbral comprometido para una medida de servicio, como resolver el 95 % de los casos en cinco días.",
    },
    fullDefinition: {
      en: "An SLA is an agreed target for a measurable service property, usually a percentile of a duration rather than an average. Percentiles are used deliberately: an average response time of two days is compatible with a tail of thirty-day cases, and it is the tail that gets escalated.",
      es: "Un SLA es un objetivo acordado para una propiedad medible del servicio, normalmente un percentil de una duración en vez de una media. Los percentiles se usan deliberadamente: un tiempo medio de respuesta de dos días es compatible con una cola de casos de treinta días, y es la cola la que se escala.",
    },
    unit: "percent",
    favorableDirection: "higher",
    caveats: {
      en: ["An SLA measured on completed cases only can look healthy while the worst cases sit unfinished and uncounted."],
      es: ["Un SLA medido solo sobre casos completados puede parecer saludable mientras los peores casos siguen sin terminar y sin contarse."],
    },
    relatedTerms: ["CT", "LT", "RT", "P90"],
    source: "Service management practice",
    version: V,
  },
  {
    code: "CT",
    category: "resource",
    fullName: { en: "Cycle Time", es: "Tiempo de Ciclo" },
    shortDefinition: {
      en: "Elapsed time from starting work on an item to finishing it. Waiting time inside that window counts.",
      es: "Tiempo transcurrido desde que se empieza a trabajar en un elemento hasta terminarlo. El tiempo de espera dentro de esa ventana cuenta.",
    },
    fullDefinition: {
      en: "Cycle time is the elapsed duration from work starting on an item to it being complete. It is wall-clock time and includes every pause, handoff and wait that happens after the start — which is exactly why it usually far exceeds the hands-on effort. The gap between cycle time and touch time is where process improvement lives.",
      es: "El tiempo de ciclo es la duración transcurrida desde que empieza el trabajo en un elemento hasta que está completo. Es tiempo de reloj e incluye cada pausa, traspaso y espera posterior al inicio — precisamente por eso suele superar con creces el esfuerzo efectivo. La diferencia entre tiempo de ciclo y tiempo de trabajo real es donde vive la mejora de procesos.",
    },
    unit: "days",
    favorableDirection: "lower",
    caveats: {
      en: [
        "Cycle time is not effort. An item with 4 hours of work and a 3-week cycle time has a waiting problem, not a productivity problem.",
        "Averages hide the tail. Report a percentile (P50, P90) alongside any mean.",
      ],
      es: [
        "El tiempo de ciclo no es esfuerzo. Un elemento con 4 horas de trabajo y 3 semanas de tiempo de ciclo tiene un problema de espera, no de productividad.",
        "Las medias ocultan la cola. Reporta un percentil (P50, P90) junto a cualquier media.",
      ],
    },
    relatedTerms: ["LT", "RT", "WIP", "STP", "P50", "P90"],
    source: "Lean flow / process mining",
    version: V,
  },
  {
    code: "LT",
    category: "resource",
    fullName: { en: "Lead Time", es: "Tiempo de Entrega" },
    shortDefinition: {
      en: "Elapsed time from request to delivery. Always at least cycle time, because it includes the initial queue.",
      es: "Tiempo transcurrido desde la solicitud hasta la entrega. Siempre al menos el tiempo de ciclo, porque incluye la cola inicial.",
    },
    fullDefinition: {
      en: "Lead time measures the whole wait from the customer's point of view: from when the request arrives to when it is delivered. Cycle time starts later — when work actually begins. The difference between the two is the queue before work started, and a team can improve cycle time substantially while lead time stays flat because the backlog absorbed the gain.",
      es: "El tiempo de entrega mide toda la espera desde el punto de vista del cliente: desde que llega la solicitud hasta que se entrega. El tiempo de ciclo empieza más tarde — cuando el trabajo realmente comienza. La diferencia entre ambos es la cola previa al inicio, y un equipo puede mejorar sustancialmente el tiempo de ciclo mientras el tiempo de entrega se mantiene plano porque el backlog absorbió la ganancia.",
    },
    unit: "days",
    favorableDirection: "lower",
    caveats: {
      en: ["Lead time is what the requester experiences. Reporting only cycle time can show an improvement the customer never felt."],
      es: ["El tiempo de entrega es lo que experimenta el solicitante. Reportar solo el tiempo de ciclo puede mostrar una mejora que el cliente nunca sintió."],
    },
    relatedTerms: ["CT", "RT", "WIP", "SLA"],
    source: "Lean flow / process mining",
    version: V,
  },
  {
    code: "RT",
    category: "resource",
    fullName: { en: "Response Time", es: "Tiempo de Respuesta" },
    shortDefinition: {
      en: "Elapsed time from a request arriving to the first substantive action on it.",
      es: "Tiempo transcurrido desde que llega una solicitud hasta la primera acción sustantiva sobre ella.",
    },
    fullDefinition: {
      en: "Response time measures the front of the queue: how long a request sits before anyone engages with it. It is a distinct measure from lead time (request to delivery) and cycle time (start to finish), and it is frequently the one a requester actually judges the service on.",
      es: "El tiempo de respuesta mide el frente de la cola: cuánto espera una solicitud antes de que alguien la atienda. Es una medida distinta del tiempo de entrega (solicitud a entrega) y del tiempo de ciclo (inicio a fin), y a menudo es la que el solicitante realmente usa para juzgar el servicio.",
    },
    unit: "days",
    favorableDirection: "lower",
    caveats: {
      en: ["A fast response time with a slow lead time means requests are acknowledged promptly and then stall. Read the two together."],
      es: ["Un tiempo de respuesta rápido con un tiempo de entrega lento significa que las solicitudes se acusan pronto y luego se estancan. Léelos juntos."],
    },
    relatedTerms: ["CT", "LT", "SLA"],
    source: "Service management practice",
    version: V,
  },
  {
    code: "STP",
    category: "resource",
    fullName: { en: "Straight-Through Processing", es: "Procesamiento Directo" },
    shortDefinition: {
      en: "The share of cases that complete the happy path with no rework, exception or manual intervention.",
      es: "Proporción de casos que completan el camino ideal sin retrabajo, excepción ni intervención manual.",
    },
    fullDefinition: {
      en: "STP rate is the percentage of cases that pass through the process exactly as designed — no loops back, no exception handling, no manual override. It is a directness measure and one of the clearest signals process mining produces: a low STP rate quantifies how much of the real process is the exception path rather than the designed one.",
      es: "La tasa de STP es el porcentaje de casos que atraviesan el proceso exactamente como fue diseñado — sin bucles hacia atrás, sin gestión de excepciones, sin anulaciones manuales. Es una medida de rectitud y una de las señales más claras que produce la minería de procesos: una tasa de STP baja cuantifica cuánto del proceso real es el camino de excepción en vez del diseñado.",
    },
    unit: "percent",
    favorableDirection: "higher",
    caveats: {
      en: [
        "STP depends on how the happy path was defined. Widening the definition raises the rate without changing the process.",
        "STP is computed over completed cases in a window. A change in case mix moves it without any process change.",
      ],
      es: [
        "El STP depende de cómo se definió el camino ideal. Ampliar la definición sube la tasa sin cambiar el proceso.",
        "El STP se calcula sobre casos completados en una ventana. Un cambio en la mezcla de casos lo mueve sin ningún cambio de proceso.",
      ],
    },
    relatedTerms: ["CT", "LT", "WIP"],
    source: "Process mining practice",
    version: V,
  },
];
