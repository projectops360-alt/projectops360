// ============================================================================
// Acronym Intelligence — Earned Value Management corpus (CAP-050)
// ============================================================================
// EVM is where the misreadings are most expensive, so the caveats here are not
// decoration. Three in particular are mandated by the capability:
//
//   • SV is MONEY. Every quarter someone reads "SV = −$40,000" as "40 days
//     late". It is not a duration and cannot be converted into one; calendar
//     slip comes from the schedule engine (CPM/TF), never from EVM.
//   • BAC is the approved budget. Raising it does not move a single date — the
//     simulation engine encodes exactly this rule and refuses to shorten a
//     duration because money was added.
//   • EAC is a FORECAST, not an approved number. It has four standard variants
//     that disagree with each other, so it lists all four.
// ============================================================================

import type { AcronymEntry } from "./contracts";

const V = "1.0.0";
const PMBOK = "PMBOK Guide 7th ed. / Practice Standard for Earned Value Management";

export const EVM_ENTRIES: AcronymEntry[] = [
  {
    code: "EVM",
    category: "evm",
    fullName: { en: "Earned Value Management", es: "Gestión del Valor Ganado" },
    shortDefinition: {
      en: "A method that compares planned work, completed work and actual cost on one monetary scale.",
      es: "Método que compara trabajo planificado, trabajo completado y coste real en una única escala monetaria.",
    },
    fullDefinition: {
      en: "Earned Value Management measures progress by putting three quantities in the same currency: what you planned to have done by now (PV), what you have actually done expressed at its budgeted value (EV), and what you actually spent (AC). Cost and schedule performance both fall out of comparing those three. Because all three are monetary, EVM answers 'how much work is done and what did it cost', never 'which date will we finish' — that is the schedule engine's job.",
      es: "La Gestión del Valor Ganado mide el avance situando tres cantidades en la misma moneda: lo que se planificó tener hecho a la fecha (PV), lo que realmente se ha hecho valorado a su presupuesto (EV) y lo que realmente se gastó (AC). El rendimiento en coste y en cronograma se deriva de comparar esas tres. Como las tres son monetarias, EVM responde «cuánto trabajo está hecho y cuánto costó», nunca «en qué fecha terminaremos» — eso corresponde al motor de cronograma.",
    },
    caveats: {
      en: [
        "EVM is entirely monetary. It never produces a finish date or a number of days late.",
        "EVM describes what has happened. It does not establish why, and it does not establish causality.",
      ],
      es: [
        "EVM es enteramente monetario. Nunca produce una fecha de fin ni un número de días de retraso.",
        "EVM describe lo ocurrido. No establece la causa ni establece causalidad.",
      ],
    },
    relatedTerms: ["PV", "EV", "AC", "CV", "SV", "CPI", "SPI", "BAC", "EAC"],
    source: PMBOK,
    version: V,
  },
  {
    code: "BAC",
    category: "evm",
    fullName: { en: "Budget at Completion", es: "Presupuesto hasta la Conclusión" },
    shortDefinition: {
      en: "The total approved budget for the work. The baseline every EVM figure is measured against.",
      es: "Presupuesto total aprobado para el trabajo. La línea base contra la que se miden las cifras de EVM.",
    },
    fullDefinition: {
      en: "BAC is the sum of all approved budget for the scope in question — the authorised number, agreed and recorded. It is the denominator of the plan: PV accrues towards it, EV is expressed as a portion of it, and forecasts (EAC, VAC) are judged against it. BAC changes only through an approved change to the budget, never as a side effect of a calculation.",
      es: "BAC es la suma de todo el presupuesto aprobado para el alcance en cuestión — la cifra autorizada, acordada y registrada. Es el denominador del plan: el PV se acumula hacia él, el EV se expresa como una porción de él, y los pronósticos (EAC, VAC) se juzgan contra él. El BAC cambia solo mediante un cambio aprobado del presupuesto, nunca como efecto colateral de un cálculo.",
    },
    unit: "currency",
    favorableDirection: "context_dependent",
    interpretation: {
      en: "A higher BAC is neither good nor bad by itself — it is a decision, not a result. Read it alongside VAC, which carries the judgement.",
      es: "Un BAC más alto no es bueno ni malo por sí mismo — es una decisión, no un resultado. Léelo junto al VAC, que es el que lleva el juicio.",
    },
    caveats: {
      en: [
        "Raising BAC does NOT improve the schedule. More budget does not buy time: no crash-cost model or productivity curve links the two here, and the simulation engine will not shorten a single duration because money was added.",
        "Raising BAC does not improve CPI or SPI either. Those are computed from EV and AC, which are historical facts and unaffected by a future budget decision.",
      ],
      es: [
        "Subir el BAC NO mejora el cronograma. Más presupuesto no compra tiempo: aquí no existe modelo de compresión de costes ni curva de productividad que los vincule, y el motor de simulación no acortará ni una duración porque se haya añadido dinero.",
        "Subir el BAC tampoco mejora el CPI ni el SPI. Se calculan a partir de EV y AC, que son hechos históricos y no se ven afectados por una decisión presupuestaria futura.",
      ],
    },
    example: {
      en: "A programme with an approved budget of $2,000,000 has BAC = $2,000,000. Adding $200,000 makes BAC = $2,200,000 and moves no date.",
      es: "Un programa con presupuesto aprobado de 2.000.000 $ tiene BAC = 2.000.000 $. Añadir 200.000 $ deja el BAC en 2.200.000 $ y no mueve ninguna fecha.",
    },
    relatedTerms: ["EVM", "PV", "EAC", "VAC", "PMB"],
    source: PMBOK,
    version: V,
  },
  {
    code: "PV",
    category: "evm",
    fullName: { en: "Planned Value", es: "Valor Planificado" },
    shortDefinition: {
      en: "The budgeted value of the work that was scheduled to be complete by now.",
      es: "Valor presupuestado del trabajo que debía estar completado a la fecha.",
    },
    fullDefinition: {
      en: "PV is the authorised budget assigned to the work scheduled for completion up to a given date. It is the plan expressed in money: at the end of the project PV equals BAC. PV is what EV is compared against to judge schedule performance in monetary terms.",
      es: "PV es el presupuesto autorizado asignado al trabajo programado para completarse hasta una fecha dada. Es el plan expresado en dinero: al final del proyecto, PV es igual al BAC. El PV es contra lo que se compara el EV para juzgar el rendimiento del cronograma en términos monetarios.",
    },
    unit: "currency",
    favorableDirection: "context_dependent",
    caveats: {
      en: ["PV depends on the schedule baseline. If the baseline was never set or has drifted, PV — and therefore SV and SPI — is meaningless."],
      es: ["El PV depende de la línea base del cronograma. Si nunca se estableció o se ha desviado, el PV — y por tanto SV y SPI — carece de sentido."],
    },
    relatedTerms: ["EVM", "EV", "AC", "SV", "SPI", "BAC"],
    source: PMBOK,
    version: V,
  },
  {
    code: "EV",
    category: "evm",
    fullName: { en: "Earned Value", es: "Valor Ganado" },
    shortDefinition: {
      en: "The budgeted value of the work actually completed, regardless of what it cost.",
      es: "Valor presupuestado del trabajo realmente completado, con independencia de lo que costó.",
    },
    fullDefinition: {
      en: "EV is the completed work valued at its BUDGETED rate, not at what was actually spent on it. That distinction is the whole mechanism: by pricing real progress at plan rates, EV can be compared to PV (are we ahead of plan?) and to AC (did it cost what we said?) without the two questions contaminating each other.",
      es: "EV es el trabajo completado valorado a su tasa PRESUPUESTADA, no a lo que realmente se gastó en él. Esa distinción es todo el mecanismo: al valorar el avance real a tasas de plan, el EV puede compararse con el PV (¿vamos por delante del plan?) y con el AC (¿costó lo que dijimos?) sin que ambas preguntas se contaminen.",
    },
    unit: "currency",
    favorableDirection: "higher",
    caveats: {
      en: ["EV is only as good as the progress measurement behind it. If percent-complete is self-reported and optimistic, every EVM figure downstream inherits that optimism."],
      es: ["El EV vale lo que valga la medición de avance que hay detrás. Si el porcentaje completado es autoinformado y optimista, todas las cifras de EVM heredan ese optimismo."],
    },
    relatedTerms: ["EVM", "PV", "AC", "CV", "SV", "CPI", "SPI"],
    source: PMBOK,
    version: V,
  },
  {
    code: "AC",
    category: "evm",
    fullName: { en: "Actual Cost", es: "Coste Real" },
    shortDefinition: {
      en: "The cost actually incurred for the work completed to date.",
      es: "Coste realmente incurrido por el trabajo completado hasta la fecha.",
    },
    fullDefinition: {
      en: "AC is real money spent on the work that has been done — recorded, not estimated. Compared with EV it yields cost performance (CV, CPI). AC is a historical fact: no future decision, budget increase or intervention changes an AC that has already been incurred.",
      es: "AC es dinero real gastado en el trabajo realizado — registrado, no estimado. Comparado con el EV produce el rendimiento en coste (CV, CPI). El AC es un hecho histórico: ninguna decisión futura, aumento de presupuesto o intervención cambia un AC ya incurrido.",
    },
    unit: "currency",
    favorableDirection: "lower",
    caveats: {
      en: ["AC must cover the same scope and the same period as EV. Comparing an AC that includes committed-but-unspent costs against an EV that does not produces a fictitious CPI."],
      es: ["El AC debe cubrir el mismo alcance y el mismo periodo que el EV. Comparar un AC que incluye costes comprometidos pero no gastados contra un EV que no los incluye produce un CPI ficticio."],
    },
    relatedTerms: ["EVM", "EV", "CV", "CPI", "EAC", "ETC"],
    source: PMBOK,
    version: V,
  },
  {
    code: "CV",
    category: "evm",
    fullName: { en: "Cost Variance", es: "Variación del Coste" },
    shortDefinition: {
      en: "How much money ahead of or behind budget the completed work is. Positive is under budget.",
      es: "Cuánto dinero por encima o por debajo del presupuesto está el trabajo completado. Positivo es por debajo del presupuesto.",
    },
    fullDefinition: {
      en: "CV is the difference between the budgeted value of what has been done and what it actually cost. Positive means the work delivered so far cost less than budgeted; negative means it cost more. CV measures only work already completed — it says nothing about the cost of work still to come.",
      es: "CV es la diferencia entre el valor presupuestado de lo realizado y lo que realmente costó. Positivo significa que el trabajo entregado hasta ahora costó menos de lo presupuestado; negativo, que costó más. El CV mide solo trabajo ya completado — no dice nada sobre el coste del trabajo pendiente.",
    },
    formulas: [{ id: "cv_standard", expression: "CV = EV − AC", isDefault: true }],
    formulaVariables: [
      { symbol: "EV", meaning: { en: "Earned Value", es: "Valor Ganado" }, code: "EV" },
      { symbol: "AC", meaning: { en: "Actual Cost", es: "Coste Real" }, code: "AC" },
    ],
    unit: "currency",
    favorableDirection: "higher",
    interpretation: {
      en: "CV > 0 is under budget (favourable). CV = 0 is exactly on budget. CV < 0 is over budget (unfavourable).",
      es: "CV > 0 es por debajo del presupuesto (favorable). CV = 0 es exactamente en presupuesto. CV < 0 es sobrecoste (desfavorable).",
    },
    caveats: {
      en: ["CV is in money and covers only completed work. A healthy CV early in a project says little about the final outcome — use EAC and VAC for that."],
      es: ["El CV está en dinero y cubre solo el trabajo completado. Un CV saludable al principio del proyecto dice poco del resultado final — para eso usa EAC y VAC."],
    },
    example: {
      en: "EV = $500,000 and AC = $540,000 gives CV = −$40,000: the work done cost $40,000 more than budgeted.",
      es: "EV = 500.000 $ y AC = 540.000 $ da CV = −40.000 $: el trabajo hecho costó 40.000 $ más de lo presupuestado.",
    },
    relatedTerms: ["EV", "AC", "CPI", "SV", "VAC"],
    source: PMBOK,
    version: V,
  },
  {
    code: "SV",
    category: "evm",
    fullName: { en: "Schedule Variance", es: "Variación del Cronograma" },
    shortDefinition: {
      en: "How much budgeted work is ahead of or behind plan — expressed in MONEY, not in days.",
      es: "Cuánto trabajo presupuestado va por delante o por detrás del plan — expresado en DINERO, no en días.",
    },
    fullDefinition: {
      en: "SV is the difference between the budgeted value of work completed and the budgeted value of work that should have been completed by now. Despite the name, SV is a monetary quantity: it tells you how much work-value is missing from the plan, not how late the project is. A negative SV means less work has been earned than scheduled. Calendar delay is a different question, answered by the schedule network (see TF and CPM).",
      es: "SV es la diferencia entre el valor presupuestado del trabajo completado y el valor presupuestado del trabajo que debía estar completado a la fecha. Pese al nombre, SV es una cantidad monetaria: indica cuánto valor de trabajo falta respecto al plan, no cuán tarde va el proyecto. Un SV negativo significa que se ha ganado menos trabajo del programado. El retraso en calendario es otra pregunta, que responde la red del cronograma (ver TF y CPM).",
    },
    formulas: [{ id: "sv_standard", expression: "SV = EV − PV", isDefault: true }],
    formulaVariables: [
      { symbol: "EV", meaning: { en: "Earned Value", es: "Valor Ganado" }, code: "EV" },
      { symbol: "PV", meaning: { en: "Planned Value", es: "Valor Planificado" }, code: "PV" },
    ],
    unit: "currency",
    favorableDirection: "higher",
    interpretation: {
      en: "SV > 0 means more work-value earned than planned. SV = 0 is on plan. SV < 0 means work-value is behind plan.",
      es: "SV > 0 significa más valor de trabajo ganado del planificado. SV = 0 es conforme al plan. SV < 0 significa que el valor del trabajo va por detrás del plan.",
    },
    caveats: {
      en: [
        "SV is measured in MONEY, not in days. An SV of −$40,000 does not mean 40 days late, or any number of days. Never convert it.",
        "Calendar slip comes from the schedule: total float (TF) and the critical path (CPM). It never comes from EVM.",
        "SV always returns to zero at completion, because at the end EV = PV = BAC. A late project finishes with SV = 0, so SV is useless near the end.",
      ],
      es: [
        "El SV se mide en DINERO, no en días. Un SV de −40.000 $ no significa 40 días de retraso, ni ningún número de días. Nunca lo conviertas.",
        "El desfase en calendario proviene del cronograma: holgura total (TF) y camino crítico (CPM). Nunca proviene de EVM.",
        "El SV siempre vuelve a cero al completar, porque al final EV = PV = BAC. Un proyecto tardío termina con SV = 0, así que el SV es inútil cerca del final.",
      ],
    },
    example: {
      en: "EV = $460,000 and PV = $500,000 gives SV = −$40,000: $40,000 of budgeted work has not been earned yet. This says nothing about how many days late the project is.",
      es: "EV = 460.000 $ y PV = 500.000 $ da SV = −40.000 $: quedan 40.000 $ de trabajo presupuestado por ganar. Esto no dice nada sobre cuántos días de retraso lleva el proyecto.",
    },
    relatedTerms: ["EV", "PV", "SPI", "CV", "TF", "CPM"],
    source: PMBOK,
    version: V,
  },
  {
    code: "CPI",
    category: "evm",
    fullName: { en: "Cost Performance Index", es: "Índice de Rendimiento del Coste" },
    shortDefinition: {
      en: "Budgeted value earned per unit of cost spent. A ratio: 1.0 is exactly on budget.",
      es: "Valor presupuestado ganado por unidad de coste gastada. Un ratio: 1,0 es exactamente en presupuesto.",
    },
    fullDefinition: {
      en: "CPI expresses cost efficiency as a ratio rather than an amount, which makes it comparable across projects of different sizes. CPI = 0.90 means you are getting 90 cents of budgeted work for every dollar spent. Because it is built from EV and AC — both historical — CPI is a measure of past performance, and it is the basis of the most common EAC forecast.",
      es: "El CPI expresa la eficiencia en coste como ratio en vez de como importe, lo que lo hace comparable entre proyectos de distinto tamaño. CPI = 0,90 significa que se obtienen 90 céntimos de trabajo presupuestado por cada euro gastado. Al construirse a partir de EV y AC — ambos históricos — el CPI mide el rendimiento pasado, y es la base del pronóstico EAC más habitual.",
    },
    formulas: [{ id: "cpi_standard", expression: "CPI = EV / AC", isDefault: true }],
    formulaVariables: [
      { symbol: "EV", meaning: { en: "Earned Value", es: "Valor Ganado" }, code: "EV" },
      { symbol: "AC", meaning: { en: "Actual Cost", es: "Coste Real" }, code: "AC" },
    ],
    unit: "ratio",
    favorableDirection: "target_one",
    interpretation: {
      en: "CPI = 1 is on budget. CPI > 1 is generally favourable (earning more value than you spend). CPI < 1 is generally unfavourable (spending more than you earn).",
      es: "CPI = 1 es conforme al presupuesto. CPI > 1 es generalmente favorable (se gana más valor del que se gasta). CPI < 1 es generalmente desfavorable (se gasta más de lo que se gana).",
    },
    caveats: {
      en: [
        "'Generally' is deliberate. A CPI above 1 can also mean progress is being over-reported or that cheap work was front-loaded, not that the project is efficient.",
        "CPI is unaffected by a budget change. EV and AC are historical facts, so increasing BAC leaves CPI exactly where it was.",
        "CPI requires AC > 0. Before any cost is incurred it is undefined, not 1.",
      ],
      es: [
        "El «generalmente» es deliberado. Un CPI por encima de 1 también puede significar que se está sobrerreportando el avance o que se adelantó trabajo barato, no que el proyecto sea eficiente.",
        "El CPI no se ve afectado por un cambio de presupuesto. EV y AC son hechos históricos, así que aumentar el BAC deja el CPI exactamente donde estaba.",
        "El CPI requiere AC > 0. Antes de incurrir en coste alguno está indefinido, no vale 1.",
      ],
    },
    example: {
      en: "EV = $450,000 and AC = $500,000 gives CPI = 0.90 — 90 cents of budgeted work per dollar spent.",
      es: "EV = 450.000 $ y AC = 500.000 $ da CPI = 0,90 — 90 céntimos de trabajo presupuestado por cada dólar gastado.",
    },
    relatedTerms: ["EV", "AC", "CV", "SPI", "EAC", "TCPI"],
    source: PMBOK,
    version: V,
  },
  {
    code: "SPI",
    category: "evm",
    fullName: { en: "Schedule Performance Index", es: "Índice de Rendimiento del Cronograma" },
    shortDefinition: {
      en: "Work-value earned per unit of work-value planned. A ratio, not a rate of calendar progress.",
      es: "Valor de trabajo ganado por unidad de valor planificado. Un ratio, no una tasa de avance en calendario.",
    },
    fullDefinition: {
      en: "SPI expresses how much of the planned work-value has been earned, as a ratio. SPI = 0.92 means 92% of the value scheduled by now has been earned. Like SV, it is built from monetary quantities, so it describes work-value progress rather than calendar position — a project can have SPI < 1 while still finishing on time if the lagging work is off the critical path.",
      es: "El SPI expresa qué proporción del valor de trabajo planificado se ha ganado, como ratio. SPI = 0,92 significa que se ha ganado el 92 % del valor programado a la fecha. Como el SV, se construye con cantidades monetarias, así que describe el avance en valor de trabajo, no la posición en calendario — un proyecto puede tener SPI < 1 y aun así terminar a tiempo si el trabajo rezagado está fuera del camino crítico.",
    },
    formulas: [{ id: "spi_standard", expression: "SPI = EV / PV", isDefault: true }],
    formulaVariables: [
      { symbol: "EV", meaning: { en: "Earned Value", es: "Valor Ganado" }, code: "EV" },
      { symbol: "PV", meaning: { en: "Planned Value", es: "Valor Planificado" }, code: "PV" },
    ],
    unit: "ratio",
    favorableDirection: "target_one",
    interpretation: {
      en: "SPI = 1 is on plan. SPI > 1 is generally favourable. SPI < 1 is generally unfavourable.",
      es: "SPI = 1 es conforme al plan. SPI > 1 es generalmente favorable. SPI < 1 es generalmente desfavorable.",
    },
    caveats: {
      en: [
        "SPI is not calendar delay. It does not convert into days late, and a delay in days must come from the schedule network.",
        "SPI is blind to the critical path: non-critical work running late drags SPI down without threatening the finish date, and vice versa.",
        "SPI drifts to 1.0 at completion, so it loses all diagnostic power late in the project.",
      ],
      es: [
        "El SPI no es retraso en calendario. No se convierte en días de retraso, y un retraso en días debe salir de la red del cronograma.",
        "El SPI es ciego al camino crítico: trabajo no crítico atrasado hunde el SPI sin amenazar la fecha de fin, y viceversa.",
        "El SPI tiende a 1,0 al completar, así que pierde todo poder diagnóstico al final del proyecto.",
      ],
    },
    relatedTerms: ["EV", "PV", "SV", "CPI", "CPM", "TF"],
    source: PMBOK,
    version: V,
  },
];
