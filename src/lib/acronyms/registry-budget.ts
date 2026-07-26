// ============================================================================
// Acronym Intelligence — budget corpus (CAP-050)
// ============================================================================
// The distinction these entries protect is the one between the three budget
// layers: the performance measurement baseline (PMB) that EVM measures against,
// the contingency reserve inside it that the PM may spend, and the management
// reserve outside it that the PM may not. Conflating them is how a project
// reports "we still have reserve" using money it does not control.
// ============================================================================

import type { AcronymEntry } from "./contracts";

const V = "1.0.0";
const PMBOK = "PMBOK Guide 7th ed.";

export const BUDGET_ENTRIES: AcronymEntry[] = [
  {
    code: "PMB",
    category: "budget",
    fullName: { en: "Performance Measurement Baseline", es: "Línea Base para la Medición del Desempeño" },
    shortDefinition: {
      en: "The approved, time-phased budget that EVM measures against. Includes contingency, excludes management reserve.",
      es: "Presupuesto aprobado y distribuido en el tiempo contra el que mide EVM. Incluye la reserva de contingencia, excluye la de gestión.",
    },
    fullDefinition: {
      en: "The PMB is the scope, schedule and cost baseline combined into a time-phased budget curve. It is what PV is drawn from and therefore what every EVM comparison is made against. The PMB includes contingency reserve (for identified risks) but excludes management reserve (for unknown-unknowns) — which is why spending management reserve requires a baseline change, while spending contingency does not.",
      es: "La PMB es la combinación de las líneas base de alcance, cronograma y coste en una curva presupuestaria distribuida en el tiempo. Es de donde sale el PV y, por tanto, contra lo que se hace toda comparación de EVM. La PMB incluye la reserva de contingencia (para riesgos identificados) pero excluye la reserva de gestión (para lo desconocido-desconocido) — por eso gastar reserva de gestión exige un cambio de línea base y gastar contingencia no.",
    },
    unit: "currency",
    favorableDirection: "context_dependent",
    caveats: {
      en: ["A PMB that is re-baselined frequently destroys the comparability of every EVM figure computed against it."],
      es: ["Una PMB que se rebasa con frecuencia destruye la comparabilidad de toda cifra de EVM calculada contra ella."],
    },
    relatedTerms: ["BAC", "PV", "CB", "MR", "CR"],
    source: PMBOK,
    version: V,
  },
  {
    code: "CB",
    category: "budget",
    fullName: { en: "Cost Baseline", es: "Línea Base de Costes" },
    shortDefinition: {
      en: "The approved time-phased cost plan, contingency included, against which cost performance is judged.",
      es: "Plan de costes aprobado y distribuido en el tiempo, contingencia incluida, contra el que se juzga el desempeño en coste.",
    },
    fullDefinition: {
      en: "The cost baseline is the approved version of the time-phased budget, excluding management reserve. Actual costs are compared to it to determine variances. It changes only through formal change control — an unapproved adjustment to the cost baseline makes every variance reported against it meaningless.",
      es: "La línea base de costes es la versión aprobada del presupuesto distribuido en el tiempo, excluyendo la reserva de gestión. Los costes reales se comparan con ella para determinar variaciones. Cambia solo mediante control formal de cambios — un ajuste no aprobado de la línea base de costes hace que toda variación reportada contra ella carezca de sentido.",
    },
    unit: "currency",
    favorableDirection: "context_dependent",
    relatedTerms: ["PMB", "BAC", "CR", "MR"],
    source: PMBOK,
    version: V,
  },
  {
    code: "CR",
    category: "budget",
    fullName: { en: "Contingency Reserve", es: "Reserva de Contingencia" },
    shortDefinition: {
      en: "Budget set aside inside the baseline for identified risks. The project manager can spend it.",
      es: "Presupuesto reservado dentro de la línea base para riesgos identificados. El director del proyecto puede gastarla.",
    },
    fullDefinition: {
      en: "Contingency reserve is money held within the cost baseline to cover risks that have been identified and analysed — the 'known unknowns'. It is normally sized from risk analysis (see EMV). Because it sits inside the baseline, the project manager can draw on it when a covered risk materialises without a baseline change.",
      es: "La reserva de contingencia es dinero mantenido dentro de la línea base de costes para cubrir riesgos identificados y analizados — los «conocidos desconocidos». Normalmente se dimensiona a partir del análisis de riesgos (ver EMV). Como está dentro de la línea base, el director del proyecto puede recurrir a ella cuando se materializa un riesgo cubierto sin cambiar la línea base.",
    },
    unit: "currency",
    favorableDirection: "context_dependent",
    caveats: {
      en: [
        "Contingency covers identified risks only. Using it for scope growth hides a scope problem as a risk event.",
        "Contingency is not free budget. Consuming it early leaves the remaining identified risks uncovered.",
      ],
      es: [
        "La contingencia cubre solo riesgos identificados. Usarla para crecimiento de alcance disfraza un problema de alcance como un evento de riesgo.",
        "La contingencia no es presupuesto libre. Consumirla pronto deja sin cobertura los riesgos identificados restantes.",
      ],
    },
    relatedTerms: ["MR", "PMB", "CB", "EMV", "RE"],
    source: PMBOK,
    version: V,
  },
  {
    code: "MR",
    category: "budget",
    fullName: { en: "Management Reserve", es: "Reserva de Gestión" },
    shortDefinition: {
      en: "Budget held outside the baseline for unforeseen work. Requires management approval to use.",
      es: "Presupuesto mantenido fuera de la línea base para trabajo imprevisto. Requiere aprobación de la dirección para usarse.",
    },
    fullDefinition: {
      en: "Management reserve covers the 'unknown unknowns' — work that could not have been foreseen. It sits OUTSIDE the performance measurement baseline, which has two consequences: it is not included in EVM calculations, and releasing it requires management approval and a baseline change. BAC as used in EVM therefore excludes MR.",
      es: "La reserva de gestión cubre lo «desconocido desconocido» — trabajo que no podía preverse. Está FUERA de la línea base para la medición del desempeño, lo que tiene dos consecuencias: no se incluye en los cálculos de EVM, y liberarla requiere aprobación de la dirección y un cambio de línea base. Por tanto, el BAC usado en EVM excluye la MR.",
    },
    unit: "currency",
    favorableDirection: "context_dependent",
    caveats: {
      en: [
        "MR is outside the baseline and outside EVM. Counting it as available budget when reporting VAC overstates the project's position.",
        "The project manager does not control MR. Reporting it as cover for a forecast overrun assumes an approval that has not been given.",
      ],
      es: [
        "La MR está fuera de la línea base y fuera de EVM. Contarla como presupuesto disponible al reportar el VAC exagera la posición del proyecto.",
        "El director del proyecto no controla la MR. Reportarla como cobertura de un sobrecoste pronosticado asume una aprobación que no se ha dado.",
      ],
    },
    relatedTerms: ["CR", "PMB", "CB", "BAC"],
    source: PMBOK,
    version: V,
  },
  {
    code: "CapEx",
    category: "budget",
    fullName: { en: "Capital Expenditure", es: "Gasto de Capital" },
    shortDefinition: {
      en: "Spend on assets with a life beyond the current period, capitalised and depreciated rather than expensed.",
      es: "Gasto en activos con vida útil más allá del periodo actual, capitalizado y amortizado en vez de llevado a gasto.",
    },
    fullDefinition: {
      en: "CapEx is money spent acquiring or improving long-lived assets — equipment, buildings, major systems. Accounting treats it as creating an asset that depreciates over time rather than as a cost of the current period. The classification matters to a project because it determines which budget the money comes from and how it hits the financial statements, not because it changes the work.",
      es: "CapEx es dinero gastado en adquirir o mejorar activos de larga duración — equipos, edificios, sistemas mayores. La contabilidad lo trata como creación de un activo que se amortiza en el tiempo, no como coste del periodo actual. La clasificación importa al proyecto porque determina de qué presupuesto sale el dinero y cómo impacta los estados financieros, no porque cambie el trabajo.",
    },
    unit: "currency",
    favorableDirection: "context_dependent",
    caveats: {
      en: ["CapEx/OpEx classification is an accounting policy decision, not a project decision. Do not reclassify to make a budget fit."],
      es: ["La clasificación CapEx/OpEx es una decisión de política contable, no del proyecto. No reclasifiques para hacer encajar un presupuesto."],
    },
    relatedTerms: ["OpEx", "BAC", "ROI", "NPV"],
    source: PMBOK,
    version: V,
  },
  {
    code: "OpEx",
    category: "budget",
    fullName: { en: "Operating Expenditure", es: "Gasto Operativo" },
    shortDefinition: {
      en: "Ongoing running cost charged to the current period rather than capitalised.",
      es: "Coste corriente continuo imputado al periodo actual en vez de capitalizado.",
    },
    fullDefinition: {
      en: "OpEx is the day-to-day cost of running operations — salaries, subscriptions, maintenance, consumables. It is expensed in the period incurred. For a project, the OpEx/CapEx split affects funding source and approval route, and a delivery that shifts cost from CapEx to OpEx (for example moving from owned infrastructure to a subscription) changes the financial profile without changing the scope.",
      es: "OpEx es el coste diario de operar — salarios, suscripciones, mantenimiento, consumibles. Se lleva a gasto en el periodo en que se incurre. Para un proyecto, la división OpEx/CapEx afecta a la fuente de financiación y a la vía de aprobación, y una entrega que desplaza coste de CapEx a OpEx (por ejemplo, pasar de infraestructura propia a suscripción) cambia el perfil financiero sin cambiar el alcance.",
    },
    unit: "currency",
    favorableDirection: "context_dependent",
    relatedTerms: ["CapEx", "BAC", "ROI"],
    source: PMBOK,
    version: V,
  },
];
