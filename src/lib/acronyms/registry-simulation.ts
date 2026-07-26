// ============================================================================
// Acronym Intelligence — simulation & portfolio corpus (CAP-050)
// ============================================================================
// The percentile entries (P10/P50/P80/P90) exist because a confidence level is
// routinely read as a forecast: "P80 = $1.4M" gets reported as "it will cost
// $1.4M". It means there is an 80% modelled chance of coming in at or under
// that figure — a different claim, and one that is only as good as the input
// distributions.
//
// The portfolio entries carry the same discipline: ROI, NPV and IRR are all
// investment measures with known failure modes (ignoring time, assuming a
// discount rate, assuming reinvestment), and each says so.
// ============================================================================

import type { AcronymEntry } from "./contracts";

const V = "1.0.0";

/** Shared by the percentile entries — one definition of what a percentile claims. */
const PERCENTILE_CAVEAT = {
  en: "A percentile is a confidence level, not a prediction. It is only as valid as the input distributions and the model's assumptions about how variables correlate.",
  es: "Un percentil es un nivel de confianza, no una predicción. Solo es tan válido como las distribuciones de entrada y los supuestos del modelo sobre cómo se correlacionan las variables.",
};

function percentile(code: string, level: number, en: string, es: string): import("./contracts").AcronymEntry {
  return {
    code,
    category: "simulation",
    fullName: {
      en: `${level}th Percentile Confidence Level`,
      es: `Nivel de Confianza del Percentil ${level}`,
    },
    shortDefinition: {
      en: `The value with a modelled ${level}% chance of the actual outcome landing at or below it.`,
      es: `Valor con una probabilidad modelada del ${level} % de que el resultado real quede en él o por debajo.`,
    },
    fullDefinition: { en, es },
    favorableDirection: "context_dependent",
    caveats: {
      en: [
        PERCENTILE_CAVEAT.en,
        "Percentiles do not add. The P80 of a portfolio is not the sum of the P80s of its projects, because not every project hits its bad case at once.",
      ],
      es: [
        PERCENTILE_CAVEAT.es,
        "Los percentiles no se suman. El P80 de un portafolio no es la suma de los P80 de sus proyectos, porque no todos los proyectos alcanzan su caso malo a la vez.",
      ],
    },
    relatedTerms: ["MCS", "P50", "PERT"].filter((c) => c !== code),
    source: "Monte Carlo practice",
    version: V,
  };
}

export const SIMULATION_ENTRIES: import("./contracts").AcronymEntry[] = [
  {
    code: "MCS",
    category: "simulation",
    fullName: { en: "Monte Carlo Simulation", es: "Simulación de Monte Carlo" },
    shortDefinition: {
      en: "Runs a model thousands of times with sampled inputs to produce a distribution of outcomes instead of one number.",
      es: "Ejecuta un modelo miles de veces con entradas muestreadas para producir una distribución de resultados en vez de un único número.",
    },
    fullDefinition: {
      en: "Monte Carlo simulation samples each uncertain input from its own distribution, runs the model, and repeats — building a distribution of possible outcomes rather than a single point estimate. Its output is read as percentiles (P50, P80) rather than as an answer. The technique's value is that it accounts for how uncertainties combine across a network, which no single-point estimate can.",
      es: "La simulación de Monte Carlo muestrea cada entrada incierta de su propia distribución, ejecuta el modelo y repite — construyendo una distribución de resultados posibles en vez de una estimación puntual. Su salida se lee como percentiles (P50, P80), no como una respuesta. El valor de la técnica es que tiene en cuenta cómo se combinan las incertidumbres a lo largo de una red, cosa que ninguna estimación puntual puede hacer.",
    },
    caveats: {
      en: [
        "Monte Carlo output is only as good as its input distributions. Precise-looking percentiles from guessed ranges are guesses with more decimal places.",
        "Ignoring correlation between inputs understates the spread, usually badly. Real risks tend to arrive together.",
        "A deterministic what-if scenario is not a Monte Carlo simulation. It computes one outcome from one set of assumptions and carries no probability.",
      ],
      es: [
        "La salida de Monte Carlo vale lo que valgan sus distribuciones de entrada. Percentiles de apariencia precisa a partir de rangos adivinados son adivinanzas con más decimales.",
        "Ignorar la correlación entre entradas subestima la dispersión, normalmente mucho. Los riesgos reales tienden a llegar juntos.",
        "Un escenario what-if determinista no es una simulación de Monte Carlo. Calcula un resultado a partir de un conjunto de supuestos y no lleva probabilidad asociada.",
      ],
    },
    relatedTerms: ["P10", "P50", "P80", "P90", "PERT"],
    source: "Monte Carlo practice",
    version: V,
  },
  percentile(
    "P10",
    10,
    "The optimistic end of a modelled distribution: a 10% chance the outcome lands at or below this value. Reporting P10 as the plan is how a forecast becomes a target nobody can hit.",
    "El extremo optimista de una distribución modelada: un 10 % de probabilidad de que el resultado quede en este valor o por debajo. Reportar el P10 como el plan es como un pronóstico se convierte en un objetivo inalcanzable.",
  ),
  percentile(
    "P50",
    50,
    "The median of a modelled distribution — the outcome is equally likely to fall above or below it. P50 is not the average, and for a skewed distribution (which cost and duration usually are) the mean sits above it.",
    "La mediana de una distribución modelada — el resultado tiene la misma probabilidad de quedar por encima o por debajo. El P50 no es la media, y en una distribución asimétrica (como suelen ser coste y duración) la media queda por encima.",
  ),
  percentile(
    "P80",
    80,
    "A commonly used commitment level: an 80% modelled chance of landing at or below this value. It is chosen as a balance between a plan that is credible and one padded to the point of being uncompetitive.",
    "Nivel de compromiso de uso habitual: un 80 % de probabilidad modelada de quedar en este valor o por debajo. Se elige como equilibrio entre un plan creíble y uno tan acolchado que resulta poco competitivo.",
  ),
  percentile(
    "P90",
    90,
    "A conservative confidence level: a 90% modelled chance of landing at or below this value. Used where overrun is costly, at the price of a plan that will usually look expensive against the median.",
    "Nivel de confianza conservador: un 90 % de probabilidad modelada de quedar en este valor o por debajo. Se usa donde el sobrecoste es caro, al precio de un plan que normalmente parecerá caro frente a la mediana.",
  ),
  {
    code: "Δ",
    category: "simulation",
    fullName: { en: "Delta (change)", es: "Delta (variación)" },
    shortDefinition: {
      en: "The difference between the simulated value and the baseline, always in the metric's own unit.",
      es: "Diferencia entre el valor simulado y la línea base, siempre en la unidad propia de la métrica.",
    },
    fullDefinition: {
      en: "Delta is simply simulated minus baseline. It carries the unit of the metric it belongs to and is never computed between two metrics of different units — a delta that mixed dollars with days would be the most dangerous number a simulator could produce, so no code path builds one. Whether a positive delta is good news depends entirely on the metric: more budget is neutral, more float is good, more cost is bad.",
      es: "El delta es simplemente simulado menos línea base. Lleva la unidad de la métrica a la que pertenece y nunca se calcula entre dos métricas de unidades distintas — un delta que mezclara dólares con días sería el número más peligroso que un simulador pudiera producir, así que ninguna ruta de código construye uno. Que un delta positivo sea buena noticia depende enteramente de la métrica: más presupuesto es neutro, más holgura es bueno, más coste es malo.",
    },
    formulas: [{ id: "delta_standard", expression: "Δ = Simulated − Baseline", isDefault: true }],
    favorableDirection: "context_dependent",
    caveats: {
      en: [
        "A delta is only meaningful between two values sharing a unit and a baseline. Results captured against different baselines are not comparable.",
        "The sign does not imply good or bad on its own. Read it against the metric's own favourable direction.",
      ],
      es: [
        "Un delta solo es significativo entre dos valores que comparten unidad y línea base. Resultados capturados contra líneas base distintas no son comparables.",
        "El signo no implica bueno o malo por sí mismo. Léelo contra la dirección favorable propia de la métrica.",
      ],
    },
    relatedTerms: ["MCS", "VAC", "CV", "SV"],
    source: "Internal — CAP-049 simulation contracts",
    version: V,
  },
];

export const PORTFOLIO_ENTRIES: import("./contracts").AcronymEntry[] = [
  {
    code: "PMO",
    category: "portfolio",
    fullName: { en: "Project Management Office", es: "Oficina de Gestión de Proyectos" },
    shortDefinition: {
      en: "The function that sets delivery standards and holds the portfolio-level view across projects.",
      es: "Función que establece los estándares de entrega y mantiene la visión de portafolio entre proyectos.",
    },
    fullDefinition: {
      en: "A PMO is the organisational function responsible for project management standards, governance and portfolio oversight. Its mandate ranges from supportive (templates and coaching) through controlling (compliance) to directive (owning delivery), and the level of authority determines what portfolio numbers actually mean — a supportive PMO reports figures it cannot act on.",
      es: "Una PMO es la función organizativa responsable de los estándares de gestión de proyectos, la gobernanza y la supervisión del portafolio. Su mandato va desde el apoyo (plantillas y acompañamiento) al control (cumplimiento) y la dirección (propiedad de la entrega), y el nivel de autoridad determina qué significan realmente las cifras del portafolio — una PMO de apoyo reporta cifras sobre las que no puede actuar.",
    },
    relatedTerms: ["KPI", "RAG", "WBS"],
    source: "PMBOK Guide 7th ed.",
    version: V,
  },
  {
    code: "KPI",
    category: "portfolio",
    fullName: { en: "Key Performance Indicator", es: "Indicador Clave de Desempeño" },
    shortDefinition: {
      en: "A measure chosen to track progress against an objective. Few and meaningful, or it stops being 'key'.",
      es: "Medida elegida para seguir el avance hacia un objetivo. Pocos y significativos, o deja de ser «clave».",
    },
    fullDefinition: {
      en: "A KPI is a metric deliberately selected as a signal for an objective, with a target and a review cadence. The discipline is in the selection: a dashboard with forty KPIs has no key indicators, and any measure that becomes a target is subject to being optimised directly rather than through the outcome it was meant to represent.",
      es: "Un KPI es una métrica seleccionada deliberadamente como señal de un objetivo, con un objetivo numérico y una cadencia de revisión. La disciplina está en la selección: un cuadro de mando con cuarenta KPIs no tiene indicadores clave, y cualquier medida que se convierte en objetivo queda expuesta a optimizarse directamente en vez de a través del resultado que pretendía representar.",
    },
    caveats: {
      en: ["A KPI without a target and an owner is a number on a screen, not an indicator."],
      es: ["Un KPI sin objetivo ni responsable es un número en una pantalla, no un indicador."],
    },
    relatedTerms: ["OKR", "PMO", "RAG"],
    source: "PMBOK Guide 7th ed.",
    version: V,
  },
  {
    code: "OKR",
    category: "portfolio",
    fullName: { en: "Objectives and Key Results", es: "Objetivos y Resultados Clave" },
    shortDefinition: {
      en: "A goal-setting frame: one qualitative objective with a few measurable results that prove it.",
      es: "Marco de fijación de metas: un objetivo cualitativo con unos pocos resultados medibles que lo demuestran.",
    },
    fullDefinition: {
      en: "An OKR pairs a qualitative objective (where we are going) with a small number of key results that measure whether it was achieved. Key results describe outcomes, not activities — 'ship the migration' is a task, 'cut median page load to under one second' is a key result. OKRs are typically set for a quarter and deliberately ambitious.",
      es: "Un OKR empareja un objetivo cualitativo (a dónde vamos) con un número reducido de resultados clave que miden si se logró. Los resultados clave describen resultados, no actividades — «entregar la migración» es una tarea, «reducir la carga mediana de página por debajo de un segundo» es un resultado clave. Los OKR se fijan típicamente por trimestre y son deliberadamente ambiciosos.",
    },
    caveats: {
      en: ["OKRs set as stretch goals should not double as performance commitments. Doing both at once guarantees conservative targets."],
      es: ["Los OKR fijados como metas ambiciosas no deberían servir a la vez como compromisos de desempeño. Hacer ambas cosas garantiza objetivos conservadores."],
    },
    relatedTerms: ["KPI", "PMO"],
    source: "Objectives and Key Results practice",
    version: V,
  },
  {
    code: "ROI",
    category: "portfolio",
    fullName: { en: "Return on Investment", es: "Retorno de la Inversión" },
    shortDefinition: {
      en: "Net gain as a percentage of what was invested. Ignores when the money moves.",
      es: "Ganancia neta como porcentaje de lo invertido. Ignora cuándo se mueve el dinero.",
    },
    fullDefinition: {
      en: "ROI expresses net benefit as a proportion of the investment that produced it, which makes returns comparable across investments of different sizes. Its limitation is that it is time-blind: a 40% return over one year and a 40% return over eight years produce the same ROI, and only the first is a good investment. Use NPV or IRR when timing matters.",
      es: "El ROI expresa el beneficio neto como proporción de la inversión que lo produjo, lo que hace comparables retornos de inversiones de distinto tamaño. Su limitación es que es ciego al tiempo: un retorno del 40 % en un año y un 40 % en ocho años dan el mismo ROI, y solo el primero es una buena inversión. Usa NPV o IRR cuando el momento importa.",
    },
    formulas: [
      {
        id: "roi_standard",
        expression: "ROI = (Benefit − Investment) / Investment × 100",
        isDefault: true,
      },
    ],
    formulaVariables: [
      { symbol: "Benefit", meaning: { en: "Total gain attributable to the investment", es: "Ganancia total atribuible a la inversión" } },
      { symbol: "Investment", meaning: { en: "Total amount invested", es: "Importe total invertido" } },
    ],
    unit: "percent",
    favorableDirection: "higher",
    interpretation: {
      en: "ROI > 0 means the investment returned more than it cost. ROI = 0 breaks even. ROI < 0 is a loss.",
      es: "ROI > 0 significa que la inversión devolvió más de lo que costó. ROI = 0 es punto de equilibrio. ROI < 0 es pérdida.",
    },
    caveats: {
      en: [
        "ROI ignores the time value of money and the period involved. It cannot rank investments with different horizons.",
        "ROI is only as credible as the benefit figure, which is usually the estimated half of the calculation.",
      ],
      es: [
        "El ROI ignora el valor temporal del dinero y el periodo implicado. No puede ordenar inversiones con horizontes distintos.",
        "El ROI vale lo que valga la cifra de beneficio, que suele ser la mitad estimada del cálculo.",
      ],
    },
    example: {
      en: "A $200,000 investment returning $260,000 of benefit gives ROI = (260,000 − 200,000) / 200,000 × 100 = 30%.",
      es: "Una inversión de 200.000 $ que devuelve 260.000 $ de beneficio da ROI = (260.000 − 200.000) / 200.000 × 100 = 30 %.",
    },
    relatedTerms: ["NPV", "IRR", "CapEx", "OpEx"],
    source: "Financial appraisal practice",
    version: V,
  },
  {
    code: "NPV",
    category: "portfolio",
    fullName: { en: "Net Present Value", es: "Valor Actual Neto" },
    shortDefinition: {
      en: "All future cash flows discounted to today's money, minus the investment. Positive means value created.",
      es: "Todos los flujos de caja futuros descontados a dinero de hoy, menos la inversión. Positivo significa valor creado.",
    },
    fullDefinition: {
      en: "NPV discounts every expected future cash flow back to present value at a chosen rate and subtracts the investment. Unlike ROI it accounts for timing, so money arriving in year one counts for more than the same money in year five. A positive NPV means the investment creates value at that discount rate — the qualifier matters, because the rate is an assumption and the answer moves with it.",
      es: "El NPV descuenta cada flujo de caja futuro esperado a valor presente a una tasa elegida y resta la inversión. A diferencia del ROI tiene en cuenta el momento, así que el dinero que llega en el año uno cuenta más que el mismo dinero en el año cinco. Un NPV positivo significa que la inversión crea valor a esa tasa de descuento — la matización importa, porque la tasa es un supuesto y la respuesta se mueve con ella.",
    },
    formulas: [
      {
        id: "npv_standard",
        expression: "NPV = Σ [ Cash Flow_t / (1 + r)^t ] − Initial Investment",
        isDefault: true,
      },
    ],
    formulaVariables: [
      { symbol: "Cash Flow_t", meaning: { en: "Net cash flow in period t", es: "Flujo de caja neto en el periodo t" } },
      { symbol: "r", meaning: { en: "Discount rate per period", es: "Tasa de descuento por periodo" } },
      { symbol: "t", meaning: { en: "Period index", es: "Índice del periodo" } },
    ],
    unit: "currency",
    favorableDirection: "higher",
    interpretation: {
      en: "NPV > 0 creates value at the chosen discount rate. NPV = 0 exactly meets it. NPV < 0 destroys value.",
      es: "NPV > 0 crea valor a la tasa de descuento elegida. NPV = 0 la cumple exactamente. NPV < 0 destruye valor.",
    },
    caveats: {
      en: ["NPV is highly sensitive to the discount rate, which is an assumption. Always state the rate alongside the figure."],
      es: ["El NPV es muy sensible a la tasa de descuento, que es un supuesto. Indica siempre la tasa junto a la cifra."],
    },
    relatedTerms: ["ROI", "IRR", "EMV"],
    source: "Financial appraisal practice",
    version: V,
  },
  {
    code: "IRR",
    category: "portfolio",
    fullName: { en: "Internal Rate of Return", es: "Tasa Interna de Retorno" },
    shortDefinition: {
      en: "The discount rate at which an investment's NPV is zero. Compared against the cost of capital.",
      es: "Tasa de descuento a la que el NPV de una inversión es cero. Se compara con el coste del capital.",
    },
    fullDefinition: {
      en: "IRR is the discount rate that makes the NPV of a set of cash flows exactly zero — effectively the investment's own rate of return. It is compared against the organisation's cost of capital or hurdle rate: above it, the investment clears the bar. IRR is popular because it is a single comparable percentage, but it assumes interim cash flows are reinvested at the IRR itself, which is often unrealistic.",
      es: "La IRR es la tasa de descuento que hace que el NPV de un conjunto de flujos de caja sea exactamente cero — en la práctica, la tasa de retorno propia de la inversión. Se compara con el coste de capital o tasa mínima de la organización: por encima, la inversión supera el umbral. La IRR es popular por ser un único porcentaje comparable, pero asume que los flujos intermedios se reinvierten a la propia IRR, lo que suele ser irreal.",
    },
    unit: "percent",
    favorableDirection: "higher",
    interpretation: {
      en: "IRR above the hurdle rate clears the investment bar; below it, the investment does not.",
      es: "Una IRR por encima de la tasa mínima supera el umbral de inversión; por debajo, no lo supera.",
    },
    caveats: {
      en: [
        "IRR assumes interim cash flows are reinvested at the IRR, which overstates returns for high-IRR projects.",
        "Cash flows that change sign more than once can produce multiple valid IRRs. NPV does not have this problem.",
      ],
      es: [
        "La IRR asume que los flujos intermedios se reinvierten a la propia IRR, lo que exagera los retornos en proyectos de IRR alta.",
        "Flujos de caja que cambian de signo más de una vez pueden producir varias IRR válidas. El NPV no tiene este problema.",
      ],
    },
    relatedTerms: ["NPV", "ROI"],
    source: "Financial appraisal practice",
    version: V,
  },
  {
    code: "WBS",
    category: "portfolio",
    fullName: { en: "Work Breakdown Structure", es: "Estructura de Desglose del Trabajo" },
    shortDefinition: {
      en: "Hierarchical decomposition of the total scope into deliverables. Anything outside it is out of scope.",
      es: "Descomposición jerárquica del alcance total en entregables. Lo que quede fuera está fuera del alcance.",
    },
    fullDefinition: {
      en: "The WBS decomposes the whole project scope into progressively smaller deliverables, down to work packages that can be estimated and assigned. Two properties give it its power: it is deliverable-oriented rather than activity-oriented, and it is exhaustive — the 100% rule says the children of any node sum to exactly that node, so work absent from the WBS is by definition out of scope.",
      es: "La WBS descompone todo el alcance del proyecto en entregables progresivamente menores, hasta paquetes de trabajo que puedan estimarse y asignarse. Dos propiedades le dan su fuerza: está orientada a entregables y no a actividades, y es exhaustiva — la regla del 100 % dice que los hijos de cualquier nodo suman exactamente ese nodo, así que el trabajo ausente de la WBS está por definición fuera del alcance.",
    },
    caveats: {
      en: ["A WBS listing activities rather than deliverables loses the 100% rule, and with it the ability to prove the scope is complete."],
      es: ["Una WBS que lista actividades en vez de entregables pierde la regla del 100 %, y con ella la capacidad de demostrar que el alcance está completo."],
    },
    relatedTerms: ["CPM", "BAC", "PMB", "PMO"],
    source: "PMBOK Guide 7th ed.",
    version: V,
  },
  {
    code: "RAG",
    category: "portfolio",
    fullName: { en: "Red / Amber / Green status", es: "Estado Rojo / Ámbar / Verde" },
    shortDefinition: {
      en: "A three-level status rating. Only meaningful when the thresholds behind it are defined.",
      es: "Calificación de estado en tres niveles. Solo significativa cuando los umbrales que la sustentan están definidos.",
    },
    fullDefinition: {
      en: "RAG summarises status as green (on track), amber (at risk) and red (off track). It is fast to scan and easy to corrupt: without defined, mechanically applied thresholds it records the reporter's confidence rather than the project's condition. 'Watermelon' reporting — green on the outside, red inside — is the standard failure mode, and it is prevented by deriving the rating from measured criteria rather than judgement.",
      es: "El RAG resume el estado en verde (según el plan), ámbar (en riesgo) y rojo (fuera de plan). Es rápido de escanear y fácil de corromper: sin umbrales definidos y aplicados mecánicamente, registra la confianza de quien reporta y no la condición del proyecto. El reporte «sandía» — verde por fuera, rojo por dentro — es el modo de fallo estándar, y se previene derivando la calificación de criterios medidos en vez de del juicio.",
    },
    caveats: {
      en: ["A RAG rating without published thresholds is an opinion. Ask what measured criteria produced it before acting on it."],
      es: ["Una calificación RAG sin umbrales publicados es una opinión. Pregunta qué criterios medidos la produjeron antes de actuar sobre ella."],
    },
    relatedTerms: ["KPI", "PMO", "CPI", "SPI"],
    source: "Portfolio reporting practice",
    version: V,
  },
];
