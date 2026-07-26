// ============================================================================
// Acronym Intelligence — risk corpus (CAP-050)
// ============================================================================
// The mandated caveat here is a units caveat and it applies to the whole
// category: monetary exposure, schedule exposure in days, and qualitative
// scores are THREE different scales, and none of them converts into another.
//
// This is not an abstract concern in this repo. `risk-exposure.ts` refuses to
// map a severity label onto dollars precisely because that mapping is, in its
// own words, "fiction with a decimal point". These definitions have to say the
// same thing the engine does.
// ============================================================================

import type { AcronymEntry } from "./contracts";

const V = "1.0.0";
const PMBOK = "PMBOK Guide 7th ed. / ISO 31000";

/** Repeated verbatim across the category — one mixing rule, stated identically. */
const MIXING_CAVEAT = {
  en: "Never mix scales. Monetary exposure (currency), schedule exposure (days) and qualitative scores (unitless) are three separate measures. A qualitative severity does not convert into an amount of money or a number of days.",
  es: "Nunca mezcles escalas. La exposición monetaria (moneda), la exposición en cronograma (días) y las puntuaciones cualitativas (sin unidad) son tres medidas distintas. Una severidad cualitativa no se convierte en un importe ni en un número de días.",
};

export const RISK_ENTRIES: AcronymEntry[] = [
  {
    code: "P",
    category: "risk",
    fullName: { en: "Probability", es: "Probabilidad" },
    shortDefinition: {
      en: "How likely a risk is to occur, as a percentage or a 0–1 value.",
      es: "Cuán probable es que ocurra un riesgo, como porcentaje o valor de 0 a 1.",
    },
    fullDefinition: {
      en: "Probability is the assessed likelihood that a risk event occurs within the period considered. It may be expressed quantitatively (0–1 or a percentage) or on a qualitative scale (very low to very high). The two are not interchangeable: a qualitative 'high' does not mean 0.8 unless the organisation has explicitly defined that mapping.",
      es: "La probabilidad es la verosimilitud evaluada de que un evento de riesgo ocurra en el periodo considerado. Puede expresarse cuantitativamente (0 a 1 o porcentaje) o en escala cualitativa (muy baja a muy alta). Ambas no son intercambiables: un «alto» cualitativo no significa 0,8 salvo que la organización haya definido explícitamente esa correspondencia.",
    },
    unit: "percent",
    favorableDirection: "lower",
    caveats: { en: [MIXING_CAVEAT.en], es: [MIXING_CAVEAT.es] },
    relatedTerms: ["I", "RE", "EMV", "RPN"],
    source: PMBOK,
    version: V,
  },
  {
    code: "I",
    category: "risk",
    fullName: { en: "Impact", es: "Impacto" },
    shortDefinition: {
      en: "The consequence if the risk occurs — in money, in days, or on a qualitative scale. Never all three at once.",
      es: "La consecuencia si el riesgo ocurre — en dinero, en días o en escala cualitativa. Nunca las tres a la vez.",
    },
    fullDefinition: {
      en: "Impact is the effect on project objectives should the risk materialise. It must be stated on ONE declared scale: a monetary amount, a schedule impact in days, or a qualitative rating. A risk can legitimately have both a cost impact and a schedule impact, but they are two separate figures and are never added together.",
      es: "El impacto es el efecto sobre los objetivos del proyecto si el riesgo se materializa. Debe expresarse en UNA escala declarada: un importe monetario, un impacto en cronograma en días, o una calificación cualitativa. Un riesgo puede tener legítimamente impacto en coste y en cronograma, pero son dos cifras separadas y nunca se suman.",
    },
    favorableDirection: "lower",
    caveats: {
      en: [
        MIXING_CAVEAT.en,
        "This product does not derive a cost impact from a severity label. Where a monetary impact was not supplied, it reports the value as unavailable rather than inventing one.",
      ],
      es: [
        MIXING_CAVEAT.es,
        "Este producto no deriva un impacto en coste a partir de una etiqueta de severidad. Cuando no se proporcionó un impacto monetario, reporta el valor como no disponible en vez de inventarlo.",
      ],
    },
    relatedTerms: ["P", "RE", "EMV", "RPN"],
    source: PMBOK,
    version: V,
  },
  {
    code: "RE",
    category: "risk",
    fullName: { en: "Risk Exposure", es: "Exposición al Riesgo" },
    shortDefinition: {
      en: "Probability multiplied by impact, kept in the impact's own unit.",
      es: "Probabilidad multiplicada por impacto, manteniendo la unidad propia del impacto.",
    },
    fullDefinition: {
      en: "Risk exposure weights a risk's consequence by how likely it is, giving a comparable figure across a risk register. Its unit is whatever the impact's unit was: a cost impact yields exposure in currency, a schedule impact yields exposure in days. Summing exposure across a register is only valid within one unit.",
      es: "La exposición al riesgo pondera la consecuencia de un riesgo por su verosimilitud, dando una cifra comparable a lo largo de un registro de riesgos. Su unidad es la que tuviera el impacto: un impacto en coste da exposición en moneda, un impacto en cronograma da exposición en días. Sumar exposiciones a lo largo de un registro solo es válido dentro de una misma unidad.",
    },
    formulas: [{ id: "re_standard", expression: "RE = P × I", isDefault: true }],
    formulaVariables: [
      { symbol: "P", meaning: { en: "Probability (0–1)", es: "Probabilidad (0 a 1)" }, code: "P" },
      { symbol: "I", meaning: { en: "Impact, in its declared unit", es: "Impacto, en su unidad declarada" }, code: "I" },
    ],
    favorableDirection: "lower",
    caveats: {
      en: [
        MIXING_CAVEAT.en,
        "Exposure is an expected value across many similar events. For a single one-off risk that either happens or does not, the exposure figure is a comparison aid, not a prediction of what you will actually spend.",
      ],
      es: [
        MIXING_CAVEAT.es,
        "La exposición es un valor esperado sobre muchos eventos similares. Para un riesgo único que ocurre o no ocurre, la cifra de exposición es una ayuda de comparación, no una predicción de lo que realmente gastarás.",
      ],
    },
    example: {
      en: "A risk with P = 30% and a cost impact of $200,000 has RE = $60,000. A separate schedule impact of 20 days gives RE = 6 days. Those are two figures, not one.",
      es: "Un riesgo con P = 30 % e impacto en coste de 200.000 $ tiene RE = 60.000 $. Un impacto en cronograma aparte de 20 días da RE = 6 días. Son dos cifras, no una.",
    },
    relatedTerms: ["P", "I", "EMV", "CR", "RPN"],
    source: PMBOK,
    version: V,
  },
  {
    code: "EMV",
    category: "risk",
    fullName: { en: "Expected Monetary Value", es: "Valor Monetario Esperado" },
    shortDefinition: {
      en: "Probability multiplied by monetary impact. Always currency — never days, never a score.",
      es: "Probabilidad multiplicada por impacto monetario. Siempre moneda — nunca días, nunca una puntuación.",
    },
    fullDefinition: {
      en: "EMV is risk exposure restricted to the monetary dimension. Summed across a risk register it is the standard basis for sizing contingency reserve. Threats give negative EMV and opportunities positive, so a register total nets the two — which is correct, but means a small total can hide large offsetting figures.",
      es: "El EMV es la exposición al riesgo restringida a la dimensión monetaria. Sumado a lo largo de un registro de riesgos es la base estándar para dimensionar la reserva de contingencia. Las amenazas dan EMV negativo y las oportunidades positivo, así que el total del registro compensa ambos — lo cual es correcto, pero implica que un total pequeño puede ocultar cifras grandes que se cancelan.",
    },
    formulas: [{ id: "emv_standard", expression: "EMV = P × Monetary Impact", isDefault: true }],
    formulaVariables: [
      { symbol: "P", meaning: { en: "Probability (0–1)", es: "Probabilidad (0 a 1)" }, code: "P" },
      {
        symbol: "Monetary Impact",
        meaning: { en: "Cost consequence if the risk occurs, in currency", es: "Consecuencia en coste si el riesgo ocurre, en moneda" },
      },
    ],
    unit: "currency",
    favorableDirection: "higher",
    interpretation: {
      en: "For threats, a more negative EMV is worse. A register total is the expected net cost of risk and is a normal input to sizing contingency reserve.",
      es: "Para amenazas, un EMV más negativo es peor. El total del registro es el coste neto esperado del riesgo y es una entrada normal para dimensionar la reserva de contingencia.",
    },
    caveats: {
      en: [
        MIXING_CAVEAT.en,
        "EMV requires a genuine monetary impact estimate. Where none exists, this product reports unavailable rather than converting a severity rating into money.",
      ],
      es: [
        MIXING_CAVEAT.es,
        "El EMV requiere una estimación monetaria real del impacto. Cuando no existe, este producto reporta no disponible en vez de convertir una calificación de severidad en dinero.",
      ],
    },
    relatedTerms: ["RE", "P", "I", "CR", "NPV"],
    source: PMBOK,
    version: V,
  },
  {
    code: "RPN",
    category: "risk",
    fullName: { en: "Risk Priority Number", es: "Número de Prioridad del Riesgo" },
    shortDefinition: {
      en: "An FMEA ranking score from severity, occurrence and detection. Unitless — not money, not days.",
      es: "Puntuación de ordenación de FMEA a partir de severidad, ocurrencia y detección. Sin unidad — no es dinero ni días.",
    },
    fullDefinition: {
      en: "RPN is the FMEA prioritisation score, the product of severity, occurrence and detection ratings (each typically 1–10). It exists to rank failure modes against each other, nothing more. An RPN of 240 is not twice as bad as 120 in any measurable sense, and it is not an amount of anything.",
      es: "El RPN es la puntuación de priorización de FMEA, producto de las calificaciones de severidad, ocurrencia y detección (típicamente de 1 a 10 cada una). Existe para ordenar modos de fallo entre sí, nada más. Un RPN de 240 no es el doble de malo que 120 en ningún sentido medible, y no es una cantidad de nada.",
    },
    formulas: [{ id: "rpn_standard", expression: "RPN = Severity × Occurrence × Detection", isDefault: true }],
    formulaVariables: [
      { symbol: "Severity", meaning: { en: "Consequence rating, typically 1–10", es: "Calificación de consecuencia, típicamente 1 a 10" } },
      { symbol: "Occurrence", meaning: { en: "Likelihood rating, typically 1–10", es: "Calificación de verosimilitud, típicamente 1 a 10" } },
      { symbol: "Detection", meaning: { en: "Rating of how hard the failure is to detect — higher means harder", es: "Calificación de cuán difícil es detectar el fallo — más alto significa más difícil" } },
    ],
    unit: "count",
    favorableDirection: "lower",
    caveats: {
      en: [
        MIXING_CAVEAT.en,
        "RPN is ordinal. Ratios and differences between RPN values are not meaningful, so averaging RPNs or summing them across a register produces a number with no interpretation.",
      ],
      es: [
        MIXING_CAVEAT.es,
        "El RPN es ordinal. Las razones y diferencias entre valores de RPN no son significativas, así que promediar RPNs o sumarlos a lo largo de un registro produce un número sin interpretación.",
      ],
    },
    relatedTerms: ["FMEA", "P", "I", "RE"],
    source: "IEC 60812 (FMEA)",
    version: V,
  },
  {
    code: "FMEA",
    category: "risk",
    fullName: { en: "Failure Mode and Effects Analysis", es: "Análisis de Modos de Fallo y Efectos" },
    shortDefinition: {
      en: "A structured method for finding how something can fail, what follows, and which failures to address first.",
      es: "Método estructurado para hallar cómo puede fallar algo, qué se deriva y qué fallos atender primero.",
    },
    fullDefinition: {
      en: "FMEA walks a process or design step by step, asking at each point what could fail, what the consequence would be, how likely it is and how easily it would be caught. Each failure mode is rated on severity, occurrence and detection, and the product of those (RPN) orders the list. Its value is the systematic enumeration; the score is only the sort key.",
      es: "El FMEA recorre un proceso o diseño paso a paso, preguntando en cada punto qué podría fallar, cuál sería la consecuencia, cuán probable es y con qué facilidad se detectaría. Cada modo de fallo se califica en severidad, ocurrencia y detección, y el producto de esas (RPN) ordena la lista. Su valor está en la enumeración sistemática; la puntuación es solo la clave de ordenación.",
    },
    caveats: {
      en: ["FMEA finds failure modes someone thought of. It offers no protection against the ones nobody raised."],
      es: ["El FMEA encuentra los modos de fallo que alguien pensó. No ofrece protección frente a los que nadie planteó."],
    },
    relatedTerms: ["RPN", "P", "I", "RAID"],
    source: "IEC 60812 (FMEA)",
    version: V,
  },
  {
    code: "RAID",
    category: "risk",
    fullName: { en: "Risks, Assumptions, Issues, Dependencies", es: "Riesgos, Supuestos, Incidencias y Dependencias" },
    shortDefinition: {
      en: "A four-part log. The key distinction: a risk might happen, an issue already has.",
      es: "Registro de cuatro partes. La distinción clave: un riesgo podría ocurrir, una incidencia ya ocurrió.",
    },
    fullDefinition: {
      en: "A RAID log tracks four things that are routinely confused. Risks are future events with a probability. Issues are risks that have already materialised, or problems that arose without warning — they have no probability, only an impact and an owner. Assumptions are things taken as true without proof, each of which is a risk if it turns out false. Dependencies are things the project needs from outside its own control. Filing an issue as a risk understates it; filing a risk as an issue inflates the register.",
      es: "Un registro RAID rastrea cuatro cosas que se confunden habitualmente. Los riesgos son eventos futuros con una probabilidad. Las incidencias son riesgos ya materializados, o problemas surgidos sin aviso — no tienen probabilidad, solo impacto y responsable. Los supuestos son cosas dadas por ciertas sin prueba, cada una de las cuales es un riesgo si resulta falsa. Las dependencias son cosas que el proyecto necesita de fuera de su control. Registrar una incidencia como riesgo la subestima; registrar un riesgo como incidencia infla el registro.",
    },
    caveats: {
      en: ["An issue has a probability of 1 by definition. Reporting expected exposure for an issue is a category error — it is a cost, not an exposure."],
      es: ["Una incidencia tiene probabilidad 1 por definición. Reportar exposición esperada para una incidencia es un error de categoría — es un coste, no una exposición."],
    },
    relatedTerms: ["P", "I", "RE", "FMEA"],
    source: PMBOK,
    version: V,
  },
];
