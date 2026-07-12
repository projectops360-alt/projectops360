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
  // Per-milestone aligned arrays
  "milestone_completed_flag",
  "milestone_delay_days",
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
  unit: "%" | "tasks" | "days" | "hours" | "ratio" | "tasks/week";
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
];

export function findKpiDefinition(slug: string): KpiCatalogDefinition | null {
  return KPI_CATALOG.find((definition) => definition.slug === slug) ?? null;
}
