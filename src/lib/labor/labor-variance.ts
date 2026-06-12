// ============================================================================
// ProjectOps360° — Labor Variance Computation Engine
// ============================================================================
// Pure functions that compute estimated vs. actual labor variance metrics
// for construction activities. Calculates hours variance, production rate
// ratio, crew efficiency, and rework impact.
//
// No database calls — these operate on already-fetched data.
// Deterministic: same inputs → same outputs. No AI calls.
// ============================================================================

import type {
  ConstructionActivity,
  I18nField,
  Locale,
} from "@/types/database";
import { getI18nValue, getDelayReason } from "@/types/database";

// ── Variance Severity ──────────────────────────────────────────────────────────

/** Classification of how far actual results deviate from the estimate. */
export type VarianceSeverity = "on_track" | "minor" | "major" | "critical";

/** Thresholds for classifying variance severity.
 *  Values are percentages (e.g., 0.10 = 10%). */
export interface VarianceThresholds {
  /** Threshold for "minor" severity (default: 10%) */
  minor: number;
  /** Threshold for "major" severity (default: 25%) */
  major: number;
  /** Threshold for "critical" severity (default: 50%) */
  critical: number;
}

/** Default variance thresholds matching construction industry norms. */
export const DEFAULT_VARIANCE_THRESHOLDS: VarianceThresholds = {
  minor: 0.10,
  major: 0.25,
  critical: 0.50,
};

// ── Production Rate Assessment ─────────────────────────────────────────────────

/** Assessment of actual vs. planned production rate. */
export type ProductivityAssessment =
  | "exceeds_plan"
  | "on_target"
  | "below_plan"
  | "stalled"
  | "not_measured";

// ── Output Types ───────────────────────────────────────────────────────────────

/** Variance metrics for a single construction activity. */
export interface ActivityVarianceMetrics {
  /** Activity key for reference (e.g. "switchgear-install"). */
  activityKey: string;
  /** Activity display name. */
  activityName: string;
  /** Location zone (e.g. "Electrical Room"). */
  locationZone: string;
  /** Current status. */
  status: string;
  /** Current progress percentage (0-100). */
  progress: number;

  // ── Hours Variance ──
  /** Estimated labor hours (from estimated_hours column). */
  estimatedHours: number;
  /** Actual labor hours spent (NULL if not yet tracked). */
  actualHours: number | null;
  /** Hours variance: actual_hours - estimated_hours. NULL if actual_hours is NULL. */
  hoursVariance: number | null;
  /** Variance percentage: (actual - estimated) / estimated * 100. NULL if not measurable. */
  variancePct: number | null;
  /** Absolute value of variancePct for sorting/filtering. */
  absVariancePct: number | null;
  /** Severity classification based on variancePct. NULL if actual_hours is NULL. */
  varianceSeverity: VarianceSeverity | null;

  // ── Production Rate ──
  /** Planned production rate (units/hour). NULL if not set. */
  plannedProductionRate: number | null;
  /** Actual production rate achieved (units/hour). NULL if not measured. */
  actualProductionRate: number | null;
  /** Production rate ratio: actual / planned. >1 = exceeds plan, <1 = below plan. NULL if either is missing. */
  productionRateRatio: number | null;
  /** Qualitative assessment of productivity. */
  productivityAssessment: ProductivityAssessment;

  // ── Crew Efficiency ──
  /** Planned minimum crew count (from required_crew_count column). */
  plannedCrewCount: number;
  /** Actual crew size deployed. NULL if not tracked. */
  actualCrewSize: number | null;
  /** Crew ratio: actual / planned. NULL if actual not tracked. */
  crewRatio: number | null;
  /** Whether actual crew exceeded planned minimum. NULL if not tracked. */
  crewExceeded: boolean | null;

  // ── Rework Impact ──
  /** Number of rework cycles. 0 = no rework. */
  reworkCount: number;
  /** Whether the activity has had rework. */
  hasRework: boolean;

  // ── Delay ──
  /** Bilingual delay reason extracted from metadata. NULL if no delay reason. */
  delayReason: I18nField | null;

  // ── Derived Flags ──
  /** Whether this activity has any actual tracking data. */
  isTracked: boolean;
  /** Whether this activity is completed (status = 'completed'). */
  isCompleted: boolean;
}

/** Summary statistics across all activities with variance data. */
export interface LaborVarianceSummary {
  /** Count of activities with actual_hours tracked. */
  trackedCount: number;
  /** Count of activities completed. */
  completedCount: number;
  /** Count of activities with major or critical variance. */
  majorVarianceCount: number;
  /** Count of activities with any rework. */
  reworkCount: number;
  /** Total estimated hours across all activities. */
  totalEstimatedHours: number;
  /** Total actual hours across tracked activities. */
  totalActualHours: number;
  /** Total hours variance (sum of actual - estimated for tracked activities). */
  totalHoursVariance: number;
  /** Overall project variance percentage. NULL if no tracked activities. */
  overallVariancePct: number | null;
  /** Average production rate ratio across activities with both rates. NULL if none. */
  avgProductionRateRatio: number | null;
  /** Count of activities where actual crew exceeded planned. */
  crewExceededCount: number;
  /** Most severe variance severity across all activities. */
  worstVarianceSeverity: VarianceSeverity;
  /** Bilingual summary sentence. */
  summarySentence: I18nField;
  /** Activity keys with major or critical variance, sorted by absVariancePct descending. */
  majorVarianceActivityKeys: string[];
}

/** Full result of labor variance computation. */
export interface LaborVarianceResult {
  /** Per-activity variance metrics. */
  activities: ActivityVarianceMetrics[];
  /** Project-level summary. */
  summary: LaborVarianceSummary;
  /** ISO timestamp of computation. */
  computedAt: string;
}

// ── Helper Functions ───────────────────────────────────────────────────────────

/** Round a number to `decimals` decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Classify variance severity based on absolute variance percentage. */
export function classifyVarianceSeverity(
  variancePct: number | null,
  thresholds: VarianceThresholds = DEFAULT_VARIANCE_THRESHOLDS
): VarianceSeverity | null {
  if (variancePct === null) return null;
  const absPct = Math.abs(variancePct);
  if (absPct <= thresholds.minor * 100) return "on_track";
  if (absPct <= thresholds.major * 100) return "minor";
  if (absPct <= thresholds.critical * 100) return "major";
  return "critical";
}

/** Assess productivity based on production rate ratio. */
export function assessProductivity(
  ratio: number | null,
  plannedRate: number | null,
  actualRate: number | null
): ProductivityAssessment {
  if (plannedRate === null || actualRate === null) return "not_measured";
  if (actualRate === 0) return "stalled";
  if (ratio === null) return "not_measured";
  if (ratio >= 1.0) return "exceeds_plan";
  if (ratio >= 0.85) return "on_target";
  return "below_plan";
}

// ── Main Computation ────────────────────────────────────────────────────────────

/**
 * Compute labor variance metrics for all construction activities.
 * This is the main entry point — call from the server page and pass
 * the result down to components.
 *
 * Pure function: same inputs → same outputs. No database calls.
 */
export function computeLaborVariance(
  activities: ConstructionActivity[],
  thresholds: VarianceThresholds = DEFAULT_VARIANCE_THRESHOLDS
): LaborVarianceResult {
  // Compute per-activity metrics
  const activityMetrics: ActivityVarianceMetrics[] = activities.map((a) => {
    const actualHours = a.actual_hours;
    const estimatedHours = a.estimated_hours;
    const plannedRate = a.planned_production_rate;
    const actualRate = a.actual_production_rate;
    const actualCrewSize = a.crew_size;

    // Hours variance
    const hoursVariance =
      actualHours !== null ? roundTo(actualHours - estimatedHours, 2) : null;
    const variancePct =
      actualHours !== null && estimatedHours > 0
        ? roundTo(((actualHours - estimatedHours) / estimatedHours) * 100, 1)
        : null;
    const absVariancePct = variancePct !== null ? Math.abs(variancePct) : null;
    const varianceSeverity = classifyVarianceSeverity(variancePct, thresholds);

    // Production rate ratio
    const productionRateRatio =
      plannedRate !== null && actualRate !== null && plannedRate > 0
        ? roundTo(actualRate / plannedRate, 2)
        : null;

    const productivityAssessment = assessProductivity(
      productionRateRatio,
      plannedRate,
      actualRate
    );

    // Crew efficiency
    const crewRatio =
      actualCrewSize !== null && a.required_crew_count > 0
        ? roundTo(actualCrewSize / a.required_crew_count, 2)
        : null;
    const crewExceeded =
      actualCrewSize !== null ? actualCrewSize > a.required_crew_count : null;

    // Rework
    const hasRework = a.rework_count > 0;

    // Delay reason
    const delayReason = getDelayReason(a.metadata);

    // Tracking status
    const isTracked = actualHours !== null;
    const isCompleted = a.status === "completed";

    return {
      activityKey: a.activity_key,
      activityName: a.name,
      locationZone: a.location_zone,
      status: a.status,
      progress: a.progress,

      estimatedHours,
      actualHours,
      hoursVariance,
      variancePct,
      absVariancePct,
      varianceSeverity,

      plannedProductionRate: plannedRate,
      actualProductionRate: actualRate,
      productionRateRatio,
      productivityAssessment,

      plannedCrewCount: a.required_crew_count,
      actualCrewSize,
      crewRatio,
      crewExceeded,

      reworkCount: a.rework_count,
      hasRework,

      delayReason,

      isTracked,
      isCompleted,
    };
  });

  // Compute summary statistics
  const trackedActivities = activityMetrics.filter((m) => m.isTracked);
  const completedActivities = activityMetrics.filter((m) => m.isCompleted);
  const majorVarianceActivities = activityMetrics.filter(
    (m) => m.varianceSeverity === "major" || m.varianceSeverity === "critical"
  );

  const totalEstimatedHours = roundTo(
    activityMetrics.reduce((sum, m) => sum + m.estimatedHours, 0),
    2
  );
  const totalActualHours = roundTo(
    trackedActivities.reduce((sum, m) => sum + (m.actualHours ?? 0), 0),
    2
  );
  const totalHoursVariance = roundTo(
    trackedActivities.reduce((sum, m) => sum + (m.hoursVariance ?? 0), 0),
    2
  );

  const overallVariancePct =
    totalEstimatedHours > 0 && trackedActivities.length > 0
      ? roundTo((totalHoursVariance / totalEstimatedHours) * 100, 1)
      : null;

  const ratiosWithRates = activityMetrics.filter(
    (m) => m.productionRateRatio !== null
  );
  const avgProductionRateRatio =
    ratiosWithRates.length > 0
      ? roundTo(
          ratiosWithRates.reduce((sum, m) => sum + m.productionRateRatio!, 0) /
            ratiosWithRates.length,
          2
        )
      : null;

  const crewExceededCount = activityMetrics.filter(
    (m) => m.crewExceeded === true
  ).length;

  // Worst variance severity
  const severityOrder: VarianceSeverity[] = [
    "on_track",
    "minor",
    "major",
    "critical",
  ];
  let worstSeverity: VarianceSeverity = "on_track";
  for (const m of activityMetrics) {
    if (m.varianceSeverity !== null) {
      const currentIdx = severityOrder.indexOf(worstSeverity);
      const mIdx = severityOrder.indexOf(m.varianceSeverity);
      if (mIdx > currentIdx) worstSeverity = m.varianceSeverity;
    }
  }

  // Major variance activity keys sorted by absVariancePct descending
  const majorVarianceActivityKeys = majorVarianceActivities
    .sort((a, b) => (b.absVariancePct ?? 0) - (a.absVariancePct ?? 0))
    .map((m) => m.activityKey);

  // Summary sentence (bilingual)
  let summarySentence: I18nField;
  const trackedN = trackedActivities.length;
  const totalN = activityMetrics.length;
  const majorN = majorVarianceActivities.length;

  if (trackedN === 0) {
    summarySentence = {
      en: `No activities have actual labor data tracked yet (${totalN} activities pending).`,
      es: `Ninguna actividad tiene datos laborales reales registrados aún (${totalN} actividades pendientes).`,
    };
  } else if (majorN === 0) {
    summarySentence = {
      en: `${trackedN} of ${totalN} activities tracked, all within acceptable variance range.`,
      es: `${trackedN} de ${totalN} actividades con seguimiento, todas dentro del rango de varianza aceptable.`,
    };
  } else {
    summarySentence = {
      en: `${trackedN} of ${totalN} activities tracked, ${majorN} with major or critical variance (${majorVarianceActivityKeys.join(", ")}).`,
      es: `${trackedN} de ${totalN} actividades con seguimiento, ${majorN} con varianza mayor o crítica (${majorVarianceActivityKeys.join(", ")}).`,
    };
  }

  const summary: LaborVarianceSummary = {
    trackedCount: trackedN,
    completedCount: completedActivities.length,
    majorVarianceCount: majorN,
    reworkCount: activityMetrics.filter((m) => m.hasRework).length,
    totalEstimatedHours,
    totalActualHours,
    totalHoursVariance,
    overallVariancePct,
    avgProductionRateRatio,
    crewExceededCount,
    worstVarianceSeverity: worstSeverity,
    summarySentence,
    majorVarianceActivityKeys,
  };

  return {
    activities: activityMetrics,
    summary,
    computedAt: new Date().toISOString(),
  };
}

// ── Variance Severity Styles (for UI) ─────────────────────────────────────────

/** CSS classes for variance severity badges, following the project design system. */
export const VARIANCE_SEVERITY_STYLES: Record<
  VarianceSeverity,
  { bg: string; text: string; border: string }
> = {
  on_track: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  minor: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  major: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
  },
  critical: {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
};

/** Human-readable labels for variance severity (bilingual). */
export const VARIANCE_SEVERITY_LABELS: Record<
  VarianceSeverity,
  I18nField
> = {
  on_track: { en: "On Track", es: "En Curso" },
  minor: { en: "Minor Variance", es: "Varianza Menor" },
  major: { en: "Major Variance", es: "Varianza Mayor" },
  critical: { en: "Critical Variance", es: "Varianza Crítica" },
};

/** Human-readable labels for productivity assessment (bilingual). */
export const PRODUCTIVITY_LABELS: Record<
  ProductivityAssessment,
  I18nField
> = {
  exceeds_plan: { en: "Exceeds Plan", es: "Supera el Plan" },
  on_target: { en: "On Target", es: "En Objetivo" },
  below_plan: { en: "Below Plan", es: "Debajo del Plan" },
  stalled: { en: "Stalled", es: "Detenida" },
  not_measured: { en: "Not Measured", es: "No Medido" },
};