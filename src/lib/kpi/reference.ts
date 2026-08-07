// ============================================================================
// KPI expression reference — what you can actually write
// ============================================================================
// The editor listed the allowed FUNCTIONS but never the FIELDS, so the only
// way to discover that `open_overdue_flag` exists was to read one of the
// built-in KPIs and copy from it. This is that list, kept beside the dataset
// it describes so the two cannot drift apart.
// ============================================================================

import type { KpiDataset } from "./index";

export type KpiFieldScope = "task" | "milestone" | "series";

export interface KpiFieldDoc {
  /** Must be a real key of KpiDataset — enforced by the type below. */
  field: keyof KpiDataset;
  scope: KpiFieldScope;
  es: string;
  en: string;
}

/**
 * Every variable an expression may reference.
 *
 * Typed as `keyof KpiDataset`, so adding a field to the dataset without
 * documenting it here, or documenting one that does not exist, fails the
 * build rather than silently leaving a gap in the editor.
 */
export const KPI_FIELDS: KpiFieldDoc[] = [
  // ── Per task ──────────────────────────────────────────────────────────────
  { field: "estimate_hours", scope: "task", es: "Horas estimadas de la tarea.", en: "Estimated hours for the task." },
  { field: "actual_hours", scope: "task", es: "Horas realmente registradas.", en: "Hours actually logged." },
  { field: "progress", scope: "task", es: "Porcentaje de avance registrado (0–100).", en: "Recorded progress percentage (0–100)." },
  { field: "duration_days", scope: "task", es: "Duración planificada en días.", en: "Planned duration in days." },
  { field: "completed_flag", scope: "task", es: "1 si la tarea está completada, 0 si no.", en: "1 when the task is complete, else 0." },
  { field: "blocked_flag", scope: "task", es: "1 si tiene un bloqueo activo. Una tarea terminada nunca cuenta (REG-010).", en: "1 when actively blocked. A finished task never counts (REG-010)." },
  { field: "open_overdue_flag", scope: "task", es: "1 si sigue abierta y ya pasó su fecha de fin.", en: "1 when still open and past its end date." },
  { field: "delayed_flag", scope: "task", es: "1 si se entregó tarde, o va tarde si aún está abierta.", en: "1 when delivered late, or running late while still open." },
  { field: "unassigned_flag", scope: "task", es: "1 si no tiene persona ni recurso asignado.", en: "1 when no person or resource is assigned." },
  { field: "critical_flag", scope: "task", es: "1 si está en la ruta crítica.", en: "1 when on the critical path." },
  { field: "task_cost", scope: "task", es: "Coste de la tarea: sus horas a la tarifa del recurso asignado. Sin dato si el recurso no tiene tarifa.", en: "Task cost: its hours at the assigned resource's rate. No value when the resource has no rate." },
  { field: "planned_value_hours", scope: "task", es: "PV — horas que la LÍNEA BASE decía que estarían hechas hoy. Sin dato si la tarea no tiene línea base.", en: "PV — hours the BASELINE said would be done by today. No value when the task has no baseline." },
  { field: "earned_value_hours", scope: "task", es: "EV — horas de presupuesto realmente ganadas (presupuesto × % completado).", en: "EV — budget hours actually earned (budget × % complete)." },
  { field: "actual_cost", scope: "task", es: "AC — dinero realmente gastado: horas registradas × tarifa. Nunca usa el estimado.", en: "AC — money actually spent: logged hours × rate. Never falls back to the estimate." },
  { field: "planned_value_cost", scope: "task", es: "PV en dinero.", en: "PV in money." },
  { field: "earned_value_cost", scope: "task", es: "EV en dinero.", en: "EV in money." },
  { field: "baseline_hours", scope: "task", es: "BAC — presupuesto de la tarea en horas, según la línea base.", en: "BAC — the task's budget in hours, per the baseline." },
  { field: "baseline_cost", scope: "task", es: "BAC en dinero.", en: "BAC in money." },
  { field: "priced_flag", scope: "task", es: "1 si la tarea sí se puede valorar. Úsalo para saber qué parte del coste mostrado es real.", en: "1 when the task can be priced. Use it to know how much of a cost figure is real." },
  // ── Per milestone ─────────────────────────────────────────────────────────
  { field: "milestone_completed_flag", scope: "milestone", es: "1 si el hito tiene fecha de finalización.", en: "1 when the milestone has a completion date." },
  { field: "milestone_delay_days", scope: "milestone", es: "Días de retraso al cerrar el hito (negativo = adelantado). Sólo hitos ya cerrados con fecha objetivo.", en: "Days late when the milestone closed (negative = early). Only closed milestones with a target date." },
  { field: "milestone_budget", scope: "milestone", es: "Presupuesto asignado al hito, de la línea de presupuesto que le corresponde. Sin dato si ninguna le corresponde.", en: "Budget assigned to the milestone, from its matching budget line. No value when none matches." },
  // ── Series over time ──────────────────────────────────────────────────────
  { field: "weekly_completed", scope: "series", es: "Serie semanal de tareas completadas. Es la entrada de TREND, MOVING_AVERAGE y FORECAST.", en: "Weekly series of completed tasks. This is what TREND, MOVING_AVERAGE and FORECAST read." },
];

export interface KpiFunctionDoc {
  name: string;
  signature: string;
  es: string;
  en: string;
}

/** The whole allow-list. Anything else is rejected before saving. */
export const KPI_FUNCTION_DOCS: KpiFunctionDoc[] = [
  { name: "SUM", signature: "SUM(campo)", es: "Suma todos los valores.", en: "Adds every value." },
  { name: "AVG", signature: "AVG(campo)", es: "Media aritmética.", en: "Arithmetic mean." },
  { name: "COUNT", signature: "COUNT(campo)", es: "Cuántos valores hay (no cuántos son 1).", en: "How many values there are (not how many equal 1)." },
  { name: "MEDIAN", signature: "MEDIAN(campo)", es: "Valor central; resiste los extremos mejor que la media.", en: "Middle value; resists outliers better than the mean." },
  { name: "PERCENTILE", signature: "PERCENTILE(campo, p)", es: "Percentil p (0–100). P. ej. 90 = el peor 10% queda fuera.", en: "The p-th percentile (0–100). e.g. 90 leaves out the worst 10%." },
  { name: "CORRELATION", signature: "CORRELATION(x, y)", es: "Correlación de Pearson entre dos campos (−1 a 1).", en: "Pearson correlation between two fields (−1 to 1)." },
  { name: "TREND", signature: "TREND(serie)", es: "Pendiente de la serie: cuánto cambia por periodo.", en: "Slope of the series: how much it changes per period." },
  { name: "MOVING_AVERAGE", signature: "MOVING_AVERAGE(serie, n)", es: "Media móvil de los últimos n periodos.", en: "Moving average over the last n periods." },
  { name: "FORECAST", signature: "FORECAST(serie, pasos)", es: "Proyección lineal a n periodos vista.", en: "Linear projection n periods ahead." },
  // These four are in the allow-list and were missing from the editor's list —
  // MAX is even used by the shipped "forecast" KPI, so the help text was
  // narrower than the engine it described.
  { name: "ABS", signature: "ABS(x)", es: "Valor absoluto.", en: "Absolute value." },
  { name: "ROUND", signature: "ROUND(x)", es: "Redondea al entero más cercano.", en: "Rounds to the nearest integer." },
  { name: "MIN", signature: "MIN(a, b)", es: "El menor de los valores.", en: "The smaller value." },
  { name: "MAX", signature: "MAX(a, b)", es: "El mayor de los valores. Útil para evitar negativos: MAX(0, …).", en: "The larger value. Handy to avoid negatives: MAX(0, …)." },
];

/** Worked examples, so the first custom KPI does not start from a blank line. */
export const KPI_EXAMPLES: { es: string; en: string; expression: string }[] = [
  {
    es: "Porcentaje de tareas vencidas",
    en: "Percentage of overdue tasks",
    expression: "100 * SUM(open_overdue_flag) / COUNT(completed_flag)",
  },
  {
    // NOT `SUM(critical_flag * estimate_hours)`: the sandbox has no element-wise
    // arithmetic, so multiplying two columns inside an aggregate throws
    // "Array values require an aggregate function". Aggregate first, then do
    // arithmetic on the numbers.
    es: "Qué parte del plan está en la ruta crítica",
    en: "How much of the plan is on the critical path",
    expression: "100 * SUM(critical_flag) / COUNT(critical_flag)",
  },
  {
    es: "Sobreesfuerzo: reales sobre estimadas",
    en: "Overrun: actual over estimated",
    expression: "100 * SUM(actual_hours) / SUM(estimate_hours)",
  },
  {
    // The MIN(1, COUNT(...)) guard is not decoration: SUM over an empty set is
    // 0, so without it a project where nothing has a rate would report a
    // confident "$0". Dividing by 0 instead makes the engine say "not
    // computable", which is the truth.
    es: "Coste de mano de obra (0 si nada tiene tarifa → no calculable)",
    en: "Labour cost (nothing priced → not computable, not zero)",
    expression: "SUM(task_cost) / MIN(1, COUNT(task_cost))",
  },
  {
    es: "Qué parte del coste mostrado es real",
    en: "How much of the shown cost is real",
    expression: "100 * SUM(priced_flag) / COUNT(priced_flag)",
  },
  {
    es: "Presupuesto consumido por el trabajo hecho",
    en: "Budget consumed by the work done",
    expression: "100 * SUM(task_cost) / SUM(milestone_budget)",
  },
  // ── Valor Ganado (EVM) ────────────────────────────────────────────────────
  // Las dos preguntas de todo comité: ¿vamos a tiempo? ¿vamos en presupuesto?
  {
    es: "SPI · ¿vamos a tiempo? (1,00 = según plan)",
    en: "SPI · are we on schedule? (1.00 = on plan)",
    expression: "SUM(earned_value_hours) / SUM(planned_value_hours)",
  },
  {
    es: "CPI · ¿vamos en presupuesto? (1,00 = según plan)",
    en: "CPI · are we on budget? (1.00 = on plan)",
    expression: "SUM(earned_value_cost) / SUM(actual_cost)",
  },
  {
    es: "Horas de atraso frente al plan comprometido",
    en: "Hours behind the committed plan",
    expression: "SUM(earned_value_hours) - SUM(planned_value_hours)",
  },
  {
    es: "% completado ponderado por esfuerzo",
    en: "% complete weighted by effort",
    expression: "100 * SUM(earned_value_hours) / SUM(baseline_hours)",
  },
];

/**
 * The formulas behind the two indices, in prose.
 *
 * Shown beside the expression editor because SPI and CPI are the KPIs most
 * often quoted and least often understood: a committee told "SPI 0.03" needs to
 * know it means three percent of the planned work is done, not that something
 * is 3% wrong. And each has a denominator that can legitimately be zero, which
 * is why the editor sometimes answers "not computable" instead of a number.
 */
export interface EvmExplainer {
  code: string;
  nameEs: string;
  nameEn: string;
  formula: string;
  meaningEs: string;
  meaningEn: string;
  readingEs: string;
  readingEn: string;
  needsEs: string;
  needsEn: string;
}

export const EVM_EXPLAINERS: EvmExplainer[] = [
  {
    code: "SPI",
    nameEs: "Índice de Desempeño del Cronograma",
    nameEn: "Schedule Performance Index",
    formula: "SPI = EV / PV",
    meaningEs:
      "Valor Ganado entre Valor Planificado. EV son las horas de presupuesto que ya se han ganado (presupuesto × % completado); PV son las horas que la línea base decía que estarían hechas hoy.",
    meaningEn:
      "Earned Value over Planned Value. EV is the budget hours already earned (budget × % complete); PV is the hours the baseline said would be done by today.",
    readingEs:
      "1,00 = exactamente según el plan. 0,80 = se ha hecho el 80% de lo que debería estar hecho. 1,20 = adelantado. Se mide en horas, así que no necesita tarifas.",
    readingEn:
      "1.00 = exactly on plan. 0.80 = 80% of what should be done is done. 1.20 = ahead. Measured in hours, so it needs no cost rates.",
    needsEs: "Requiere línea base. Sin PV (antes de que empiece el plan) no hay respuesta, no es 1,00.",
    needsEn: "Requires a baseline. With no PV (before the plan starts) there is no answer — it is not 1.00.",
  },
  {
    code: "CPI",
    nameEs: "Índice de Desempeño del Costo",
    nameEn: "Cost Performance Index",
    formula: "CPI = EV / AC",
    meaningEs:
      "Valor Ganado entre Costo Real. AC es lo realmente gastado: horas REGISTRADAS × tarifa del recurso. Nunca usa el estimado — el dinero no gastado no es un costo.",
    meaningEn:
      "Earned Value over Actual Cost. AC is what was really spent: LOGGED hours × the resource's rate. Never the estimate — money not spent is not a cost.",
    readingEs:
      "1,00 = cada unidad gastada compró una unidad de avance. 0,80 = compró 80 céntimos: sobrecosto. Un CPI muy alto suele significar que no se están registrando horas, no eficiencia.",
    readingEn:
      "1.00 = every unit spent bought a unit of progress. 0.80 = it bought 80 cents: overspend. A very high CPI usually means hours are not being logged, not efficiency.",
    needsEs: "Requiere tarifas y horas registradas. Sin AC no hay división posible: no es infinito, es «sin respuesta».",
    needsEn: "Requires rates and logged hours. With no AC there is nothing to divide: not infinity — no answer.",
  },
];
