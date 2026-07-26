// ============================================================================
// Acronym Intelligence — EVM forecasting corpus (CAP-050)
// ============================================================================
// EAC is the reason `formulas` is an array.
//
// `src/lib/financial/calculations.ts` → `computeDeterministicForecasts` returns
// FIVE EAC variants (bottomUpEac, cpiEac, cpiSpiEac, pmEac, plus the ETCs), and
// the simulation's finance stage picks `cpiEac`, recording that choice as the
// assumption `evm_forecast_uses_cpi_based_eac`. So the honest answer to "what is
// the EAC formula" is "there are several, and here is the one that produced the
// number you are looking at" — which is what `formulaId` in `AcronymContext`
// carries and what `resolveFormula` reads. Asserting a single formula would put
// the glossary in direct contradiction with the engine.
// ============================================================================

import type { AcronymEntry } from "./contracts";

const V = "1.0.0";
const PMBOK = "PMBOK Guide 7th ed. / Practice Standard for Earned Value Management";

/**
 * Formula ids that match the variants `computeDeterministicForecasts` returns.
 * Keeping these aligned by name is what lets a caller pass the engine's own
 * choice straight through as `AcronymContext.formulaId`.
 */
export const EAC_FORMULA_IDS = {
  cpiEac: "eac_cpi",
  cpiSpiEac: "eac_cpi_spi",
  bottomUpEac: "eac_bottom_up",
  pmEac: "eac_pm_etc",
  simple: "eac_simple",
} as const;

export const FORECAST_ENTRIES: AcronymEntry[] = [
  {
    code: "EAC",
    category: "evm",
    fullName: { en: "Estimate at Completion", es: "Estimación a la Conclusión" },
    shortDefinition: {
      en: "Forecast of what the work will cost in total when finished. A projection, not an approved budget.",
      es: "Pronóstico de lo que costará el trabajo en total al terminar. Una proyección, no un presupuesto aprobado.",
    },
    fullDefinition: {
      en: "EAC is the expected total cost of the work at completion, given performance so far. There is no single EAC formula: the standard offers several, and they give materially different answers because each makes a different assumption about how the remaining work will behave. The CPI-based variant assumes past cost efficiency continues; the CPI×SPI variant assumes both cost and schedule pressure persist and is the most pessimistic; the bottom-up variant discards past efficiency and uses a fresh estimate of the remaining work. Which variant is right is a judgement about the project, not a mathematical fact — so this product records which one it used rather than presenting one as canonical.",
      es: "EAC es el coste total esperado del trabajo al completarse, dado el rendimiento hasta la fecha. No existe una única fórmula de EAC: el estándar ofrece varias, y dan respuestas materialmente distintas porque cada una asume algo diferente sobre cómo se comportará el trabajo restante. La variante basada en CPI asume que la eficiencia en coste pasada continúa; la variante CPI×SPI asume que persisten tanto la presión de coste como la de cronograma y es la más pesimista; la variante de abajo hacia arriba descarta la eficiencia pasada y usa una estimación nueva del trabajo restante. Cuál es la correcta es un juicio sobre el proyecto, no un hecho matemático — por eso este producto registra cuál usó en lugar de presentar una como canónica.",
    },
    formulas: [
      {
        id: EAC_FORMULA_IDS.cpiEac,
        expression: "EAC = AC + (BAC − EV) / CPI",
        label: {
          en: "CPI-based — assumes current cost efficiency continues. Equivalent to BAC / CPI when there is no cost variance from non-typical work.",
          es: "Basada en CPI — asume que la eficiencia en coste actual continúa. Equivale a BAC / CPI cuando no hay variación de coste por trabajo atípico.",
        },
        isDefault: true,
      },
      {
        id: "eac_bac_over_cpi",
        expression: "EAC = BAC / CPI",
        label: {
          en: "The compact form of the CPI-based forecast, used when all remaining work is assumed to behave like the work done so far.",
          es: "Forma compacta del pronóstico basado en CPI, usada cuando se asume que todo el trabajo restante se comporta como el ya realizado.",
        },
      },
      {
        id: EAC_FORMULA_IDS.simple,
        expression: "EAC = AC + (BAC − EV)",
        label: {
          en: "Assumes the remaining work will be done exactly at budget — past cost overruns are treated as one-off and not repeated.",
          es: "Asume que el trabajo restante se hará exactamente a presupuesto — los sobrecostes pasados se tratan como puntuales y no se repiten.",
        },
      },
      {
        id: EAC_FORMULA_IDS.cpiSpiEac,
        expression: "EAC = AC + (BAC − EV) / (CPI × SPI)",
        label: {
          en: "Assumes both cost and schedule performance continue to apply. The most pessimistic standard variant.",
          es: "Asume que tanto el rendimiento en coste como el de cronograma siguen aplicando. La variante estándar más pesimista.",
        },
      },
      {
        id: EAC_FORMULA_IDS.bottomUpEac,
        expression: "EAC = AC + ETC",
        label: {
          en: "Bottom-up — past efficiency is discarded and the remaining work is re-estimated from scratch.",
          es: "De abajo hacia arriba — se descarta la eficiencia pasada y se reestima el trabajo restante desde cero.",
        },
      },
    ],
    formulaVariables: [
      { symbol: "AC", meaning: { en: "Actual Cost to date", es: "Coste Real a la fecha" }, code: "AC" },
      { symbol: "BAC", meaning: { en: "Budget at Completion", es: "Presupuesto hasta la Conclusión" }, code: "BAC" },
      { symbol: "EV", meaning: { en: "Earned Value", es: "Valor Ganado" }, code: "EV" },
      { symbol: "CPI", meaning: { en: "Cost Performance Index", es: "Índice de Rendimiento del Coste" }, code: "CPI" },
      { symbol: "SPI", meaning: { en: "Schedule Performance Index", es: "Índice de Rendimiento del Cronograma" }, code: "SPI" },
      { symbol: "ETC", meaning: { en: "Estimate to Complete", es: "Estimación hasta la Conclusión" }, code: "ETC" },
    ],
    unit: "currency",
    favorableDirection: "lower",
    interpretation: {
      en: "Compare EAC against BAC. EAC above BAC forecasts an overrun; EAC below BAC forecasts an underrun. The size of the gap is VAC.",
      es: "Compara el EAC con el BAC. Un EAC por encima del BAC pronostica sobrecoste; por debajo, ahorro. El tamaño de la diferencia es el VAC.",
    },
    caveats: {
      en: [
        "EAC is a FORECAST of final cost, not an approved budget. It confers no spending authority and does not replace BAC.",
        "There is no single EAC formula. Different variants can differ by a wide margin on the same project, so always check which one produced the figure.",
        "Every variant extrapolates from past performance. Early in a project, when EV and AC are small, EAC is extremely unstable.",
      ],
      es: [
        "El EAC es un PRONÓSTICO del coste final, no un presupuesto aprobado. No confiere autoridad de gasto ni sustituye al BAC.",
        "No existe una única fórmula de EAC. Distintas variantes pueden diferir ampliamente en el mismo proyecto, así que comprueba siempre cuál produjo la cifra.",
        "Todas las variantes extrapolan del rendimiento pasado. Al inicio del proyecto, con EV y AC pequeños, el EAC es extremadamente inestable.",
      ],
    },
    example: {
      en: "BAC = $1,000,000, EV = $400,000, AC = $500,000 gives CPI = 0.80. The CPI-based EAC is $500,000 + ($1,000,000 − $400,000) / 0.80 = $1,250,000. The simple variant would give $1,100,000 — a $150,000 difference from the same inputs.",
      es: "BAC = 1.000.000 $, EV = 400.000 $, AC = 500.000 $ da CPI = 0,80. El EAC basado en CPI es 500.000 $ + (1.000.000 $ − 400.000 $) / 0,80 = 1.250.000 $. La variante simple daría 1.100.000 $ — una diferencia de 150.000 $ con los mismos datos.",
    },
    relatedTerms: ["BAC", "AC", "EV", "CPI", "SPI", "ETC", "VAC", "TCPI"],
    source: PMBOK,
    version: V,
  },
  {
    code: "ETC",
    category: "evm",
    fullName: { en: "Estimate to Complete", es: "Estimación hasta la Conclusión" },
    shortDefinition: {
      en: "Forecast cost of the work still remaining, from today to completion.",
      es: "Coste pronosticado del trabajo que queda, desde hoy hasta la conclusión.",
    },
    fullDefinition: {
      en: "ETC is the expected cost of finishing the remaining work. It can be derived from an EAC (ETC = EAC − AC) or built bottom-up by re-estimating the outstanding work directly — the latter is more effort but does not inherit assumptions about past efficiency continuing. ETC is the forward-looking half of the forecast; AC is the backward-looking half, and together they make EAC.",
      es: "ETC es el coste esperado de terminar el trabajo restante. Puede derivarse de un EAC (ETC = EAC − AC) o construirse de abajo hacia arriba reestimando directamente el trabajo pendiente — esto último cuesta más esfuerzo pero no hereda supuestos sobre la continuidad de la eficiencia pasada. El ETC es la mitad prospectiva del pronóstico; el AC es la retrospectiva, y juntos forman el EAC.",
    },
    formulas: [
      { id: "etc_from_eac", expression: "ETC = EAC − AC", isDefault: true },
      {
        id: "etc_cpi",
        expression: "ETC = (BAC − EV) / CPI",
        label: {
          en: "Assumes remaining work continues at the current cost efficiency.",
          es: "Asume que el trabajo restante continúa a la eficiencia en coste actual.",
        },
      },
    ],
    formulaVariables: [
      { symbol: "EAC", meaning: { en: "Estimate at Completion", es: "Estimación a la Conclusión" }, code: "EAC" },
      { symbol: "AC", meaning: { en: "Actual Cost", es: "Coste Real" }, code: "AC" },
      { symbol: "BAC", meaning: { en: "Budget at Completion", es: "Presupuesto hasta la Conclusión" }, code: "BAC" },
      { symbol: "EV", meaning: { en: "Earned Value", es: "Valor Ganado" }, code: "EV" },
      { symbol: "CPI", meaning: { en: "Cost Performance Index", es: "Índice de Rendimiento del Coste" }, code: "CPI" },
    ],
    unit: "currency",
    favorableDirection: "lower",
    caveats: {
      en: ["An ETC derived from EAC inherits whichever assumption that EAC variant made. A bottom-up ETC is independent of it."],
      es: ["Un ETC derivado del EAC hereda el supuesto que hiciera esa variante de EAC. Un ETC de abajo hacia arriba es independiente de él."],
    },
    relatedTerms: ["EAC", "AC", "BAC", "EV", "CPI"],
    source: PMBOK,
    version: V,
  },
  {
    code: "VAC",
    category: "evm",
    fullName: { en: "Variance at Completion", es: "Variación a la Conclusión" },
    shortDefinition: {
      en: "Forecast difference between the approved budget and the expected final cost. Positive is favourable.",
      es: "Diferencia pronosticada entre el presupuesto aprobado y el coste final esperado. Positivo es favorable.",
    },
    fullDefinition: {
      en: "VAC is the amount by which the work is forecast to come in under or over its approved budget. It converts the EAC forecast into the number a sponsor actually asks for: how much more, or less, than we approved. Because it depends entirely on EAC, VAC carries whichever EAC variant assumption was used.",
      es: "VAC es el importe en el que se pronostica que el trabajo quedará por debajo o por encima de su presupuesto aprobado. Convierte el pronóstico del EAC en la cifra que un patrocinador realmente pide: cuánto más, o menos, de lo aprobado. Como depende enteramente del EAC, el VAC arrastra el supuesto de la variante de EAC utilizada.",
    },
    formulas: [{ id: "vac_standard", expression: "VAC = BAC − EAC", isDefault: true }],
    formulaVariables: [
      { symbol: "BAC", meaning: { en: "Budget at Completion", es: "Presupuesto hasta la Conclusión" }, code: "BAC" },
      { symbol: "EAC", meaning: { en: "Estimate at Completion", es: "Estimación a la Conclusión" }, code: "EAC" },
    ],
    unit: "currency",
    favorableDirection: "higher",
    interpretation: {
      en: "VAC positive = favourable, the work is forecast to finish under budget. VAC negative = an expected cost overrun. VAC = 0 forecasts finishing exactly on budget.",
      es: "VAC positivo = favorable, se pronostica terminar por debajo del presupuesto. VAC negativo = sobrecoste esperado. VAC = 0 pronostica terminar exactamente en presupuesto.",
    },
    caveats: {
      en: [
        "VAC is a forecast, not a result. It moves whenever EAC moves.",
        "Raising BAC mechanically improves VAC without anything about the project improving. Read the two together.",
      ],
      es: [
        "El VAC es un pronóstico, no un resultado. Se mueve cada vez que se mueve el EAC.",
        "Subir el BAC mejora el VAC mecánicamente sin que nada del proyecto haya mejorado. Léelos juntos.",
      ],
    },
    example: {
      en: "BAC = $1,000,000 and EAC = $1,250,000 gives VAC = −$250,000: a forecast overrun of $250,000.",
      es: "BAC = 1.000.000 $ y EAC = 1.250.000 $ da VAC = −250.000 $: un sobrecoste pronosticado de 250.000 $.",
    },
    relatedTerms: ["BAC", "EAC", "CV", "ETC"],
    source: PMBOK,
    version: V,
  },
  {
    code: "TCPI",
    category: "evm",
    fullName: { en: "To-Complete Performance Index", es: "Índice de Rendimiento del Trabajo por Completar" },
    shortDefinition: {
      en: "The cost efficiency the remaining work must achieve to hit a cost target. A ratio.",
      es: "La eficiencia en coste que debe alcanzar el trabajo restante para cumplir un objetivo de coste. Un ratio.",
    },
    fullDefinition: {
      en: "TCPI answers the recovery question: given what has been spent and earned, how efficiently must the rest of the work be delivered to still finish at the target cost? Comparing TCPI against the CPI actually being achieved is the honest test of whether a recovery plan is realistic — if TCPI is 1.35 and the team has never exceeded 0.90, the plan is not a plan.",
      es: "El TCPI responde la pregunta de recuperación: dado lo gastado y lo ganado, ¿con qué eficiencia debe entregarse el resto del trabajo para terminar aún en el coste objetivo? Comparar el TCPI con el CPI que realmente se está logrando es la prueba honesta de si un plan de recuperación es realista — si el TCPI es 1,35 y el equipo nunca ha superado 0,90, el plan no es un plan.",
    },
    formulas: [
      {
        id: "tcpi_bac",
        expression: "TCPI = (BAC − EV) / (BAC − AC)",
        label: {
          en: "Against the approved budget — the target is still BAC.",
          es: "Contra el presupuesto aprobado — el objetivo sigue siendo el BAC.",
        },
        isDefault: true,
      },
      {
        id: "tcpi_eac",
        expression: "TCPI = (BAC − EV) / (EAC − AC)",
        label: {
          en: "Against a revised target — used once BAC is accepted as unreachable.",
          es: "Contra un objetivo revisado — se usa cuando se acepta que el BAC es inalcanzable.",
        },
      },
    ],
    formulaVariables: [
      { symbol: "BAC", meaning: { en: "Budget at Completion", es: "Presupuesto hasta la Conclusión" }, code: "BAC" },
      { symbol: "EV", meaning: { en: "Earned Value", es: "Valor Ganado" }, code: "EV" },
      { symbol: "AC", meaning: { en: "Actual Cost", es: "Coste Real" }, code: "AC" },
      { symbol: "EAC", meaning: { en: "Estimate at Completion", es: "Estimación a la Conclusión" }, code: "EAC" },
    ],
    unit: "ratio",
    favorableDirection: "lower",
    interpretation: {
      en: "TCPI ≤ 1 means the target is reachable at current or easier efficiency. TCPI > 1 means the remaining work must be delivered more efficiently than the budget assumed — and the further above the current CPI it sits, the less credible it is.",
      es: "TCPI ≤ 1 significa que el objetivo es alcanzable con la eficiencia actual o menor. TCPI > 1 significa que el trabajo restante debe entregarse con más eficiencia de la presupuestada — y cuanto más por encima del CPI actual esté, menos creíble es.",
    },
    caveats: {
      en: ["TCPI is undefined when the denominator is zero or negative — that is, once AC has already reached the target. The product reports that as unavailable rather than as a number."],
      es: ["El TCPI está indefinido cuando el denominador es cero o negativo — es decir, cuando el AC ya alcanzó el objetivo. El producto lo reporta como no disponible en vez de como un número."],
    },
    relatedTerms: ["BAC", "EV", "AC", "EAC", "CPI"],
    source: PMBOK,
    version: V,
  },
];
