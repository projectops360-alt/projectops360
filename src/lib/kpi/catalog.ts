// ============================================================================
// ProjectOps360° — KPI Calculation Engine · built-in catalog (CAP-046 F3)
// ============================================================================
// Single-definition KPI layer: every KPI is defined ONCE here (expression over
// allow-listed dataset variables) and reused identically by the UI, Isabella
// and reports — the anti-"metric drift" rule of PD-019. Semantics follow the
// existing KPI dictionary (src/lib/reports/kpi-dictionary.ts) and REG-010
// (blocked/overdue flags come from the canonical helpers, never recomputed).
// ============================================================================

/** Dataset variables the loader provides (the expression allow-list). */
export const KPI_DATASET_VARIABLES = [
  // Per-task aligned arrays
  "estimate_hours",
  "actual_hours",
  "progress",
  "completed_flag",
  "blocked_flag",
  "open_overdue_flag",
  "delayed_flag",
  "unassigned_flag",
  "critical_flag",
  "duration_days",
  // What a task cost: its hours priced at the rate of the resource assigned to
  // it. NaN when it cannot be priced, so a partial answer stays partial —
  // `priced_flag` says how much of the scope the figure actually covers.
  "task_cost",
  "priced_flag",
  // Earned Value, precomputed per task (the sandbox has no element-wise math).
  "planned_value_hours",
  "earned_value_hours",
  "planned_value_cost",
  "earned_value_cost",
  "actual_cost",
  "baseline_hours",
  "baseline_cost",
  // Per-milestone aligned arrays
  "milestone_completed_flag",
  "milestone_delay_days",
  "milestone_budget",
  // Ordered weekly series (completions per ISO week, oldest → newest)
  "weekly_completed",
] as const;

export type KpiDatasetVariable = (typeof KPI_DATASET_VARIABLES)[number];

export interface KpiCatalogDefinition {
  slug: string;
  /** Bilingual names/descriptions (UX-012 — no single-language strings). */
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  expression: string;
  unit: "%" | "tasks" | "days" | "hours" | "ratio" | "tasks/week" | "currency";
  /** Decimal places for display. */
  precision: number;
  version: number;
}

export const KPI_CATALOG: KpiCatalogDefinition[] = [
  {
    slug: "overall_progress",
    nameEs: "Progreso general",
    nameEn: "Overall progress",
    descriptionEs: "Tareas completadas sobre el total.",
    descriptionEn: "Completed tasks over total tasks.",
    expression: "100 * SUM(completed_flag) / COUNT(completed_flag)",
    unit: "%",
    precision: 1,
    version: 1,
  },
  {
    slug: "blocked_tasks",
    nameEs: "Tareas bloqueadas",
    nameEn: "Blocked tasks",
    descriptionEs: "Tareas con bloqueador activo (semántica REG-010).",
    descriptionEn: "Tasks with an active blocker (REG-010 semantics).",
    expression: "SUM(blocked_flag)",
    unit: "tasks",
    precision: 0,
    version: 1,
  },
  {
    slug: "overdue_tasks",
    nameEs: "Tareas vencidas",
    nameEn: "Overdue tasks",
    descriptionEs: "Tareas abiertas con fecha de fin planificada superada.",
    descriptionEn: "Open tasks past their planned finish date.",
    expression: "SUM(open_overdue_flag)",
    unit: "tasks",
    precision: 0,
    version: 1,
  },
  {
    slug: "unassigned_tasks",
    nameEs: "Tareas sin asignar",
    nameEn: "Unassigned tasks",
    descriptionEs: "Tareas sin persona ni recurso asignado (señal de capacidad, no bloqueo).",
    descriptionEn: "Tasks without a person or resource assigned (capacity signal, not a blocker).",
    expression: "SUM(unassigned_flag)",
    unit: "tasks",
    precision: 0,
    version: 1,
  },
  {
    slug: "avg_task_progress",
    nameEs: "Progreso medio por tarea",
    nameEn: "Average task progress",
    descriptionEs: "Media del avance registrado en las tareas.",
    descriptionEn: "Mean of the recorded task progress.",
    expression: "AVG(progress)",
    unit: "%",
    precision: 1,
    version: 1,
  },
  {
    slug: "median_task_duration",
    nameEs: "Duración mediana de tarea",
    nameEn: "Median task duration",
    descriptionEs: "Mediana de la duración planificada de las tareas (días).",
    descriptionEn: "Median planned task duration (days).",
    expression: "MEDIAN(duration_days)",
    unit: "days",
    precision: 1,
    version: 1,
  },
  {
    slug: "effort_ratio",
    nameEs: "Horas reales vs estimadas",
    nameEn: "Actual vs estimated hours",
    descriptionEs: "Total de horas reales sobre horas estimadas (>100% = sobreesfuerzo).",
    descriptionEn: "Total actual hours over estimated hours (>100% = over effort).",
    expression: "100 * SUM(actual_hours) / SUM(estimate_hours)",
    unit: "%",
    precision: 1,
    version: 1,
  },
  {
    slug: "estimate_correlation",
    nameEs: "Correlación estimado-real",
    nameEn: "Estimate-actual correlation",
    descriptionEs: "Correlación de Pearson entre horas estimadas y reales (−1 a 1).",
    descriptionEn: "Pearson correlation between estimated and actual hours (−1 to 1).",
    expression: "CORRELATION(estimate_hours, actual_hours)",
    unit: "ratio",
    precision: 2,
    version: 1,
  },
  {
    slug: "milestone_delay_p90",
    nameEs: "Retraso de hitos (p90)",
    nameEn: "Milestone delay (p90)",
    descriptionEs: "Percentil 90 del retraso de hitos completados (días; negativo = adelanto).",
    descriptionEn: "90th percentile of completed-milestone delay (days; negative = early).",
    expression: "PERCENTILE(milestone_delay_days, 90)",
    unit: "days",
    precision: 1,
    version: 1,
  },
  {
    slug: "completion_trend",
    nameEs: "Tendencia de cierre semanal",
    nameEn: "Weekly completion trend",
    descriptionEs: "Pendiente de la serie de tareas completadas por semana (cambio por semana).",
    descriptionEn: "Slope of the tasks-completed-per-week series (change per week).",
    expression: "TREND(weekly_completed)",
    unit: "tasks/week",
    precision: 2,
    version: 1,
  },
  {
    slug: "completion_momentum",
    nameEs: "Ritmo de cierre (media móvil 3 sem.)",
    nameEn: "Completion momentum (3-week moving avg.)",
    descriptionEs: "Media móvil de 3 semanas de tareas completadas por semana.",
    descriptionEn: "3-week trailing moving average of tasks completed per week.",
    expression: "MOVING_AVERAGE(weekly_completed, 3)",
    unit: "tasks/week",
    precision: 1,
    version: 1,
  },
  {
    slug: "forecast_completions_next_week",
    nameEs: "Pronóstico de cierres (próxima semana)",
    nameEn: "Forecast completions (next week)",
    descriptionEs: "Proyección lineal de tareas a completar la próxima semana.",
    descriptionEn: "Linear projection of tasks to be completed next week.",
    expression: "MAX(0, FORECAST(weekly_completed, 1))",
    unit: "tasks/week",
    precision: 1,
    version: 1,
  },
  // ── Cost ──────────────────────────────────────────────────────────────────
  // These read the same whether the scope is the whole project or one
  // milestone — that is the entire point of the milestone dimension.
  //
  // The `/ MIN(1, COUNT(...))` guard is load-bearing, not noise: SUM over an
  // empty set is 0, so an unguarded cost KPI would report "$0" for a project
  // where NOTHING has a rate — the confident zero that reads as "this was
  // free". With the guard, zero priced tasks divides 0 by 0 and the engine
  // answers "not computable", which is the truth.
  {
    slug: "labour_cost",
    nameEs: "Coste de mano de obra",
    nameEn: "Labour cost",
    descriptionEs:
      "Horas de cada tarea valoradas a la tarifa del recurso asignado. No calculable si ningún recurso tiene tarifa.",
    descriptionEn:
      "Each task's hours priced at the rate of its assigned resource. Not computable when no resource has a rate.",
    expression: "SUM(task_cost) / MIN(1, COUNT(task_cost))",
    unit: "currency",
    precision: 0,
    version: 1,
  },
  {
    slug: "budget_amount",
    nameEs: "Presupuesto asignado",
    nameEn: "Assigned budget",
    descriptionEs: "Presupuesto de la línea que corresponde a este alcance.",
    descriptionEn: "Budget of the line matching this scope.",
    expression: "SUM(milestone_budget) / MIN(1, COUNT(milestone_budget))",
    unit: "currency",
    precision: 0,
    version: 1,
  },
  {
    slug: "budget_consumed_pct",
    nameEs: "Presupuesto consumido",
    nameEn: "Budget consumed",
    descriptionEs: "Coste de mano de obra sobre el presupuesto asignado.",
    descriptionEn: "Labour cost over the assigned budget.",
    expression: "100 * SUM(task_cost) / SUM(milestone_budget)",
    unit: "%",
    precision: 1,
    version: 1,
  },
  {
    slug: "cost_coverage_pct",
    nameEs: "Cobertura de costes",
    nameEn: "Cost coverage",
    descriptionEs:
      "Porcentaje de tareas que sí se pueden valorar. Dice cuánto del coste mostrado es el coste real.",
    descriptionEn:
      "Percentage of tasks that can actually be priced. Says how much of the shown cost is the real cost.",
    expression: "100 * SUM(priced_flag) / COUNT(priced_flag)",
    unit: "%",
    precision: 0,
    version: 1,
  },
  {
    slug: "effort_consumed_pct",
    nameEs: "Esfuerzo consumido",
    nameEn: "Effort consumed",
    descriptionEs: "Horas reales sobre horas estimadas.",
    descriptionEn: "Actual hours over estimated hours.",
    expression: "100 * SUM(actual_hours) / SUM(estimate_hours)",
    unit: "%",
    precision: 1,
    version: 1,
  },
  {
    slug: "hours_variance",
    nameEs: "Desviación de horas",
    nameEn: "Hours variance",
    descriptionEs: "Horas reales menos estimadas. Positivo = tardó más de lo previsto.",
    descriptionEn: "Actual minus estimated hours. Positive means it took longer than planned.",
    expression: "SUM(actual_hours) - SUM(estimate_hours)",
    unit: "hours",
    precision: 0,
    version: 1,
  },
  // ── Earned Value (EVM) ────────────────────────────────────────────────────
  // The two indices every steering committee asks for. 1.00 = on plan.
  //
  // Each is a division whose denominator can legitimately be zero, and the
  // engine turning that into "not computable" is the point: SPI would
  // otherwise read 1.00 for a project that has not started, and CPI would read
  // infinity for one that has spent nothing. Both are lies a committee acts on.
  {
    slug: "spi",
    nameEs: "SPI — Índice de Desempeño del Cronograma",
    nameEn: "SPI — Schedule Performance Index",
    descriptionEs:
      "Valor ganado sobre valor planificado, en horas. 1,00 = según el plan; 0,80 = se ha hecho el 80% de lo que debería estar hecho. No necesita tarifas. Requiere línea base.",
    descriptionEn:
      "Earned value over planned value, in hours. 1.00 = on plan; 0.80 = 80% of what should be done is done. Needs no cost rates. Requires a baseline.",
    expression: "SUM(earned_value_hours) / SUM(planned_value_hours)",
    unit: "ratio",
    precision: 2,
    version: 1,
  },
  {
    slug: "cpi",
    nameEs: "CPI — Índice de Desempeño del Costo",
    nameEn: "CPI — Cost Performance Index",
    descriptionEs:
      "Valor ganado sobre costo real. 1,00 = cada peso gastado compró un peso de avance; 0,80 = compró 80 céntimos. Requiere tarifas y horas registradas.",
    descriptionEn:
      "Earned value over actual cost. 1.00 = every unit spent bought a unit of progress; 0.80 = it bought 80 cents. Requires rates and logged hours.",
    expression: "SUM(earned_value_cost) / SUM(actual_cost)",
    unit: "ratio",
    precision: 2,
    version: 1,
  },
  {
    slug: "schedule_variance_hours",
    nameEs: "SV — Desviación del cronograma",
    nameEn: "SV — Schedule Variance",
    descriptionEs: "Valor ganado menos planificado, en horas. Negativo = atrasado.",
    descriptionEn: "Earned minus planned value, in hours. Negative = behind.",
    expression: "SUM(earned_value_hours) - SUM(planned_value_hours)",
    unit: "hours",
    precision: 0,
    version: 1,
  },
  {
    slug: "cost_variance",
    nameEs: "CV — Desviación del costo",
    nameEn: "CV — Cost Variance",
    descriptionEs: "Valor ganado menos costo real. Negativo = sobrecosto.",
    descriptionEn: "Earned value minus actual cost. Negative = over budget.",
    expression: "SUM(earned_value_cost) - SUM(actual_cost)",
    unit: "currency",
    precision: 0,
    version: 1,
  },
  {
    slug: "eac",
    nameEs: "EAC — Estimación al terminar",
    nameEn: "EAC — Estimate At Completion",
    descriptionEs:
      "Lo que costará el total si se mantiene la eficiencia mostrada hasta hoy: presupuesto entre CPI.",
    descriptionEn:
      "What the whole job will cost if today's efficiency holds: budget divided by CPI.",
    expression: "SUM(baseline_cost) * SUM(actual_cost) / SUM(earned_value_cost)",
    unit: "currency",
    precision: 0,
    version: 1,
  },
  {
    slug: "percent_complete_evm",
    nameEs: "% completado (por valor ganado)",
    nameEn: "% complete (earned value)",
    descriptionEs:
      "Valor ganado sobre presupuesto total, en horas. Pondera por esfuerzo: cerrar tareas baratas no infla el avance.",
    descriptionEn:
      "Earned value over total budget, in hours. Weighted by effort, so closing cheap tasks cannot inflate progress.",
    expression: "100 * SUM(earned_value_hours) / SUM(baseline_hours)",
    unit: "%",
    precision: 1,
    version: 1,
  },
];

export function findKpiDefinition(slug: string): KpiCatalogDefinition | null {
  return KPI_CATALOG.find((definition) => definition.slug === slug) ?? null;
}
