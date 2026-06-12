// ============================================================================
// ProjectOps360° — Productivity Variance Analytics Engine
// ============================================================================
// Pure functions that extend the labor variance engine with trade-level,
// location-level, activity-type, trend, and schedule risk analytics.
//
// No database calls — these operate on already-fetched data.
// Deterministic: same inputs → same outputs. No AI calls.
// ============================================================================

import type {
  ConstructionActivity,
  I18nField,
  Locale,
  TradeTaxonomy,
  ActivityDependency,
} from "@/types/database";
import { getI18nValue } from "@/types/database";
import {
  computeLaborVariance,
  classifyVarianceSeverity,
  assessProductivity,
  DEFAULT_VARIANCE_THRESHOLDS,
} from "./labor-variance";
import type {
  ActivityVarianceMetrics,
  VarianceSeverity,
  VarianceThresholds,
  ProductivityAssessment,
  LaborVarianceResult,
} from "./labor-variance";
import { isOnCriticalPath } from "./capacity";

// ── Activity Type Classification ──────────────────────────────────────────────

/** Activity type category derived from commissioning level and trade context. */
export type ActivityTypeCategory =
  | "installation"
  | "commissioning"
  | "testing"
  | "quality_assurance"
  | "handover";

/** Human-readable labels for activity type categories (bilingual). */
export const ACTIVITY_TYPE_LABELS: Record<ActivityTypeCategory, I18nField> = {
  installation: { en: "Installation", es: "Instalación" },
  commissioning: { en: "Commissioning", es: "Comisionamiento" },
  testing: { en: "Testing", es: "Pruebas" },
  quality_assurance: { en: "Quality Assurance", es: "Aseguramiento de Calidad" },
  handover: { en: "Handover", es: "Entrega" },
};

/**
 * Classify an activity's type based on commissioning level and trade context.
 *
 * Logic:
 *  - L5/L6 → "handover"
 *  - L3/L4 → "commissioning"
 *  - L2 → "testing"
 *  - null commissioning_level → heuristic from trade label
 */
export function classifyActivityType(
  activity: ConstructionActivity,
  taxonomy: TradeTaxonomy[]
): ActivityTypeCategory {
  const level = activity.commissioning_level;

  if (level === "L5" || level === "L6") return "handover";
  if (level === "L3" || level === "L4") return "commissioning";
  if (level === "L2") return "testing";

  // No commissioning level — classify by trade
  const trade = taxonomy.find((t) => t.trade_key === activity.required_trade_key);
  if (trade) {
    const labelEn = (getI18nValue(trade.label_i18n, "en") ?? "").toLowerCase();
    const labelEs = (getI18nValue(trade.label_i18n, "es") ?? "").toLowerCase();
    const qaPattern = /qa|quality|inspect|calidad|inspec/i;
    if (qaPattern.test(labelEn) || qaPattern.test(labelEs)) {
      return "quality_assurance";
    }
  }

  return "installation";
}

// ── Variance Trend ───────────────────────────────────────────────────────────

/** Trend direction for an activity relative to its trade peers. */
export type VarianceTrendDirection =
  | "improving"
  | "worsening"
  | "stable"
  | "insufficient_data";

/** Human-readable labels for variance trend directions (bilingual). */
export const VARIANCE_TREND_LABELS: Record<VarianceTrendDirection, I18nField> = {
  improving: { en: "Improving", es: "Mejorando" },
  worsening: { en: "Worsening", es: "Empeorando" },
  stable: { en: "Stable", es: "Estable" },
  insufficient_data: {
    en: "Insufficient Data",
    es: "Datos Insuficientes",
  },
};

/** Trend comparison for a single activity against its trade peers. */
export interface VarianceTrend {
  /** Activity key. */
  activityKey: string;
  /** Trade key of this activity. */
  tradeKey: string;
  /** This activity's variance percentage. NULL if not tracked. */
  variancePct: number | null;
  /** The average variancePct for the same trade. NULL if insufficient data. */
  tradeAvgVariancePct: number | null;
  /** Difference: activity variance minus trade average. NULL if insufficient data. */
  deviationFromTradeAvg: number | null;
  /** Whether the activity's variance is improving/worsening/stable/insufficient_data. */
  direction: VarianceTrendDirection;
  /** Number of tracked activities in the same trade (used for false positive gating). */
  peerCount: number;
  /** Bilingual label describing the trend. */
  trendLabel: I18nField;
}

// ── Schedule Risk ────────────────────────────────────────────────────────────

/** Risk level for schedule impact based on variance data. */
export type ScheduleRiskLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

/** Types of contributing factors to schedule risk. */
export type ScheduleRiskFactorType =
  | "hours_overrun"
  | "critical_path"
  | "rework"
  | "below_plan_production"
  | "crew_exceeded";

/** A single contributing factor to schedule risk. */
export interface ScheduleRiskFactor {
  factor: ScheduleRiskFactorType;
  /** Weight this factor contributed to the total risk score. */
  weight: number;
  /** Bilingual description of this factor. */
  description: I18nField;
}

/** Risk assessment for a single activity's schedule impact. */
export interface ActivityScheduleRisk {
  /** Activity key. */
  activityKey: string;
  /** Whether the activity is on the critical path. */
  onCriticalPath: boolean;
  /** Schedule risk level. */
  riskLevel: ScheduleRiskLevel;
  /** Numeric risk score (0-100) used for ranking and thresholds. */
  riskScore: number;
  /** Factor breakdown explaining why this risk level was assigned. */
  riskFactors: ScheduleRiskFactor[];
  /** Bilingual summary sentence. */
  summarySentence: I18nField;
}

// ── Aggregation Types ───────────────────────────────────────────────────────

/** Variance metrics aggregated across all activities sharing a trade. */
export interface TradeVarianceSummary {
  /** The trade key (e.g. "electrical", "hvac"). */
  tradeKey: string;
  /** Bilingual label for the trade (resolved from taxonomy). */
  tradeLabel: I18nField;
  /** Activity type category for this trade's primary classification. */
  primaryActivityType: ActivityTypeCategory;
  /** Total number of activities in this trade group. */
  activityCount: number;
  /** Number of tracked activities (actual_hours not null). */
  trackedCount: number;
  /** Total estimated hours across all activities in this trade. */
  totalEstimatedHours: number;
  /** Total actual hours across tracked activities. */
  totalActualHours: number;
  /** Total hours variance (actual - estimated) for tracked activities. */
  totalHoursVariance: number;
  /** Variance percentage at trade level. NULL if no tracked activities. */
  tradeVariancePct: number | null;
  /** Worst variance severity among activities in this trade. */
  worstVarianceSeverity: VarianceSeverity | null;
  /** Count of activities with major or critical variance severity. */
  majorVarianceCount: number;
  /** Count of activities with rework. */
  reworkCount: number;
  /** Average production rate ratio across tracked activities. NULL if none. */
  avgProductionRateRatio: number | null;
  /** Activity keys with major/critical variance, sorted worst-first. */
  majorVarianceActivityKeys: string[];
  /** Bilingual summary sentence for this trade. */
  summarySentence: I18nField;
}

/** Variance metrics aggregated across all activities sharing a location zone. */
export interface LocationVarianceSummary {
  /** Location zone name (e.g. "Electrical Room A", "Server Room 2"). */
  locationZone: string;
  /** Number of activities in this zone. */
  activityCount: number;
  /** Number of tracked activities. */
  trackedCount: number;
  /** Total estimated hours. */
  totalEstimatedHours: number;
  /** Total actual hours. */
  totalActualHours: number;
  /** Total hours variance. */
  totalHoursVariance: number;
  /** Variance percentage at zone level. NULL if no tracked activities. */
  zoneVariancePct: number | null;
  /** Worst variance severity in this zone. */
  worstVarianceSeverity: VarianceSeverity | null;
  /** Count of major/critical variance activities. */
  majorVarianceCount: number;
  /** Count of activities with rework. */
  reworkCount: number;
  /** Activity keys with major/critical variance, sorted worst-first. */
  majorVarianceActivityKeys: string[];
  /** Bilingual summary sentence. */
  summarySentence: I18nField;
}

/** Variance metrics aggregated across all activities sharing an activity type. */
export interface ActivityTypeVarianceSummary {
  /** The activity type category. */
  activityType: ActivityTypeCategory;
  /** Bilingual label. */
  activityTypeLabel: I18nField;
  /** Number of activities. */
  activityCount: number;
  /** Number of tracked activities. */
  trackedCount: number;
  /** Total estimated hours. */
  totalEstimatedHours: number;
  /** Total actual hours. */
  totalActualHours: number;
  /** Total hours variance. */
  totalHoursVariance: number;
  /** Variance percentage. NULL if no tracked activities. */
  typeVariancePct: number | null;
  /** Worst variance severity. */
  worstVarianceSeverity: VarianceSeverity | null;
  /** Count of major/critical variance activities. */
  majorVarianceCount: number;
  /** Activity keys with major/critical variance. */
  majorVarianceActivityKeys: string[];
  /** Bilingual summary sentence. */
  summarySentence: I18nField;
}

/** Full result of productivity variance computation. */
export interface ProductivityVarianceResult {
  /** Per-activity variance trend. */
  trends: VarianceTrend[];
  /** Per-trade variance summaries, sorted by worstVarianceSeverity descending. */
  byTrade: TradeVarianceSummary[];
  /** Per-location variance summaries, sorted by worstVarianceSeverity descending. */
  byLocation: LocationVarianceSummary[];
  /** Per-activity-type variance summaries, sorted by worstVarianceSeverity descending. */
  byActivityType: ActivityTypeVarianceSummary[];
  /** Per-activity schedule risk, sorted by riskScore descending. */
  scheduleRisks: ActivityScheduleRisk[];
  /** Overall project schedule risk level. */
  overallScheduleRisk: ScheduleRiskLevel;
  /** Count of activities with schedule risk > "none". */
  activitiesAtRisk: number;
  /** ISO timestamp of computation. */
  computedAt: string;
}

// ── Schedule Risk Styles (for UI) ────────────────────────────────────────────

/** CSS classes for schedule risk badges, following the project design system. */
export const SCHEDULE_RISK_STYLES: Record<
  ScheduleRiskLevel,
  { bg: string; text: string; border: string }
> = {
  none: {
    bg: "bg-gray-50 dark:bg-gray-950/30",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-800",
  },
  low: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  medium: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  high: {
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

/** Human-readable labels for schedule risk levels (bilingual). */
export const SCHEDULE_RISK_LABELS: Record<ScheduleRiskLevel, I18nField> = {
  none: { en: "No Risk", es: "Sin Riesgo" },
  low: { en: "Low Risk", es: "Riesgo Bajo" },
  medium: { en: "Medium Risk", es: "Riesgo Medio" },
  high: { en: "High Risk", es: "Riesgo Alto" },
  critical: { en: "Critical Risk", es: "Riesgo Crítico" },
};

// ── Helper Functions ─────────────────────────────────────────────────────────

/** Round a number to `decimals` decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Severity ranking order for sorting. */
const SEVERITY_ORDER: VarianceSeverity[] = [
  "on_track",
  "minor",
  "major",
  "critical",
];

/** Return the worse of two severities. */
function worseSeverity(
  a: VarianceSeverity | null,
  b: VarianceSeverity | null
): VarianceSeverity | null {
  if (a === null) return b;
  if (b === null) return a;
  return SEVERITY_ORDER.indexOf(b) > SEVERITY_ORDER.indexOf(a) ? b : a;
}

/** Risk level ranking order for sorting. */
const RISK_ORDER: ScheduleRiskLevel[] = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
];

/** Map a numeric risk score to a ScheduleRiskLevel. */
function scoreToRiskLevel(score: number): ScheduleRiskLevel {
  if (score <= 15) return "none";
  if (score <= 35) return "low";
  if (score <= 55) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

/** Build a bilingual summary sentence for a trade aggregation. */
function buildTradeSummarySentence(
  tradeKey: string,
  tradeLabel: I18nField,
  trackedCount: number,
  activityCount: number,
  majorCount: number,
  variancePct: number | null,
  majorKeys: string[]
): I18nField {
  if (trackedCount === 0) {
    return {
      en: `No tracked data for trade "${tradeKey}" (${activityCount} activities pending).`,
      es: `Sin datos registrados para oficio "${tradeKey}" (${activityCount} actividades pendientes).`,
    };
  }
  if (majorCount === 0) {
    return {
      en: `${trackedCount} of ${activityCount} activities tracked in ${tradeKey}, all within acceptable variance.`,
      es: `${trackedCount} de ${activityCount} actividades con seguimiento en ${tradeKey}, todas dentro de varianza aceptable.`,
    };
  }
  return {
    en: `${trackedCount} of ${activityCount} activities in ${tradeKey}, ${majorCount} with major/critical variance (${majorKeys.join(", ")}).`,
    es: `${trackedCount} de ${activityCount} actividades en ${tradeKey}, ${majorCount} con varianza mayor/crítica (${majorKeys.join(", ")}).`,
  };
}

/** Build a bilingual summary sentence for a location aggregation. */
function buildLocationSummarySentence(
  zone: string,
  trackedCount: number,
  activityCount: number,
  majorCount: number,
  majorKeys: string[]
): I18nField {
  if (trackedCount === 0) {
    return {
      en: `No tracked data in zone "${zone}" (${activityCount} activities pending).`,
      es: `Sin datos registrados en zona "${zone}" (${activityCount} actividades pendientes).`,
    };
  }
  if (majorCount === 0) {
    return {
      en: `${trackedCount} of ${activityCount} activities tracked in ${zone}, all within acceptable variance.`,
      es: `${trackedCount} de ${activityCount} actividades con seguimiento en ${zone}, todas dentro de varianza aceptable.`,
    };
  }
  return {
    en: `${trackedCount} of ${activityCount} activities in ${zone}, ${majorCount} with major/critical variance (${majorKeys.join(", ")}).`,
    es: `${trackedCount} de ${activityCount} actividades en ${zone}, ${majorCount} con varianza mayor/crítica (${majorKeys.join(", ")}).`,
  };
}

/** Build a bilingual summary sentence for an activity type aggregation. */
function buildActivityTypeSummarySentence(
  activityType: ActivityTypeCategory,
  trackedCount: number,
  activityCount: number,
  majorCount: number,
  majorKeys: string[]
): I18nField {
  const labelEn = ACTIVITY_TYPE_LABELS[activityType].en;
  const labelEs = ACTIVITY_TYPE_LABELS[activityType].es;

  if (trackedCount === 0) {
    return {
      en: `No tracked data for ${labelEn} activities (${activityCount} pending).`,
      es: `Sin datos registrados para actividades de ${labelEs} (${activityCount} pendientes).`,
    };
  }
  if (majorCount === 0) {
    return {
      en: `${trackedCount} of ${activityCount} ${labelEn} activities tracked, all within acceptable variance.`,
      es: `${trackedCount} de ${activityCount} actividades de ${labelEs} con seguimiento, todas dentro de varianza aceptable.`,
    };
  }
  return {
    en: `${trackedCount} of ${activityCount} ${labelEn} activities, ${majorCount} with major/critical variance (${majorKeys.join(", ")}).`,
    es: `${trackedCount} de ${activityCount} actividades de ${labelEs}, ${majorCount} con varianza mayor/crítica (${majorKeys.join(", ")}).`,
  };
}

/** Build a bilingual trend label. */
function buildTrendLabel(
  direction: VarianceTrendDirection,
  variancePct: number | null,
  deviation: number | null
): I18nField {
  switch (direction) {
    case "insufficient_data":
      return {
        en: "Insufficient data for trend comparison.",
        es: "Datos insuficientes para comparación de tendencia.",
      };
    case "stable":
      return {
        en: `Variance (${roundTo(variancePct ?? 0, 1)}%) is stable relative to trade peers.`,
        es: `Varianza (${roundTo(variancePct ?? 0, 1)}%) es estable respecto a pares de oficio.`,
      };
    case "improving":
      return {
        en: `Variance (${roundTo(variancePct ?? 0, 1)}%) is improving — ${roundTo(Math.abs(deviation ?? 0), 1)}pp better than trade average.`,
        es: `Varianza (${roundTo(variancePct ?? 0, 1)}%) está mejorando — ${roundTo(Math.abs(deviation ?? 0), 1)}pp mejor que el promedio del oficio.`,
      };
    case "worsening":
      return {
        en: `Variance (${roundTo(variancePct ?? 0, 1)}%) is worsening — ${roundTo(Math.abs(deviation ?? 0), 1)}pp worse than trade average.`,
        es: `Varianza (${roundTo(variancePct ?? 0, 1)}%) está empeorando — ${roundTo(Math.abs(deviation ?? 0), 1)}pp peor que el promedio del oficio.`,
      };
  }
}

/** Build a bilingual schedule risk summary sentence. */
function buildRiskSummarySentence(
  activityKey: string,
  riskLevel: ScheduleRiskLevel,
  riskScore: number,
  riskFactors: ScheduleRiskFactor[],
  isInsufficientData: boolean
): I18nField {
  if (isInsufficientData) {
    return {
      en: `Insufficient data for schedule risk assessment on "${activityKey}".`,
      es: `Datos insuficientes para evaluación de riesgo de cronograma en "${activityKey}".`,
    };
  }

  const levelLabel = SCHEDULE_RISK_LABELS[riskLevel];
  const factorCount = riskFactors.length;

  if (factorCount === 0) {
    return {
      en: `"${activityKey}" — ${levelLabel.en} (score: ${riskScore}).`,
      es: `"${activityKey}" — ${levelLabel.es} (puntuación: ${riskScore}).`,
    };
  }

  const factorDescsEn = riskFactors.map((f) => f.description.en).join(", ");
  const factorDescsEs = riskFactors.map((f) => f.description.es).join(", ");

  return {
    en: `"${activityKey}" — ${levelLabel.en} (score: ${riskScore}). Factors: ${factorDescsEn}.`,
    es: `"${activityKey}" — ${levelLabel.es} (puntuación: ${riskScore}). Factores: ${factorDescsEs}.`,
  };
}

// ── Computation Helpers ──────────────────────────────────────────────────────

/** Compute trade-level variance summaries. */
function computeTradeVarianceSummaries(
  metrics: ActivityVarianceMetrics[],
  activities: ConstructionActivity[],
  taxonomy: TradeTaxonomy[]
): TradeVarianceSummary[] {
  // Build lookup: activityKey → activity
  const activityMap = new Map<string, ConstructionActivity>();
  for (const a of activities) {
    activityMap.set(a.activity_key, a);
  }

  // Build lookup: tradeKey → trade label
  const tradeLabelMap = new Map<string, I18nField>();
  for (const t of taxonomy) {
    tradeLabelMap.set(t.trade_key, t.label_i18n);
  }

  // Group metrics by trade
  const tradeGroups = new Map<
    string,
    {
      metrics: ActivityVarianceMetrics[];
      activities: ConstructionActivity[];
    }
  >();

  for (const m of metrics) {
    const activity = activityMap.get(m.activityKey);
    if (!activity) continue;

    const tradeKey = activity.required_trade_key;
    if (!tradeGroups.has(tradeKey)) {
      tradeGroups.set(tradeKey, { metrics: [], activities: [] });
    }
    tradeGroups.get(tradeKey)!.metrics.push(m);
    tradeGroups.get(tradeKey)!.activities.push(activity);
  }

  const summaries: TradeVarianceSummary[] = [];

  for (const [tradeKey, group] of tradeGroups) {
    const tracked = group.metrics.filter((m) => m.isTracked);
    const majorVariance = group.metrics.filter(
      (m) =>
        m.varianceSeverity === "major" || m.varianceSeverity === "critical"
    );

    const totalEstimatedHours = roundTo(
      group.metrics.reduce((sum, m) => sum + m.estimatedHours, 0),
      2
    );
    const totalActualHours = roundTo(
      tracked.reduce((sum, m) => sum + (m.actualHours ?? 0), 0),
      2
    );
    const totalHoursVariance = roundTo(
      tracked.reduce((sum, m) => sum + (m.hoursVariance ?? 0), 0),
      2
    );

    const tradeVariancePct =
      totalEstimatedHours > 0 && tracked.length > 0
        ? roundTo((totalHoursVariance / totalEstimatedHours) * 100, 1)
        : null;

    // Worst severity in this trade
    let worst: VarianceSeverity | null = null;
    for (const m of group.metrics) {
      worst = worseSeverity(worst, m.varianceSeverity);
    }

    // Average production rate ratio
    const ratiosWithRates = group.metrics.filter(
      (m) => m.productionRateRatio !== null
    );
    const avgProductionRateRatio =
      ratiosWithRates.length > 0
        ? roundTo(
            ratiosWithRates.reduce(
              (sum, m) => sum + m.productionRateRatio!,
              0
            ) / ratiosWithRates.length,
            2
          )
        : null;

    // Primary activity type (most common)
    const typeCounts = new Map<ActivityTypeCategory, number>();
    for (const a of group.activities) {
      const t = classifyActivityType(a, taxonomy);
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
    const primaryType = [...typeCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? "installation";

    const majorVarianceActivityKeys = majorVariance
      .sort((a, b) => (b.absVariancePct ?? 0) - (a.absVariancePct ?? 0))
      .map((m) => m.activityKey);

    const tradeLabel =
      tradeLabelMap.get(tradeKey) ?? ({ en: tradeKey, es: tradeKey } as I18nField);

    const summarySentence = buildTradeSummarySentence(
      tradeKey,
      tradeLabel,
      tracked.length,
      group.metrics.length,
      majorVariance.length,
      tradeVariancePct,
      majorVarianceActivityKeys
    );

    summaries.push({
      tradeKey,
      tradeLabel,
      primaryActivityType: primaryType,
      activityCount: group.metrics.length,
      trackedCount: tracked.length,
      totalEstimatedHours,
      totalActualHours,
      totalHoursVariance,
      tradeVariancePct,
      worstVarianceSeverity: worst,
      majorVarianceCount: majorVariance.length,
      reworkCount: group.metrics.filter((m) => m.hasRework).length,
      avgProductionRateRatio,
      majorVarianceActivityKeys,
      summarySentence,
    });
  }

  // Sort by worst severity descending (critical first)
  summaries.sort((a, b) => {
    const aIdx = a.worstVarianceSeverity
      ? SEVERITY_ORDER.indexOf(a.worstVarianceSeverity)
      : -1;
    const bIdx = b.worstVarianceSeverity
      ? SEVERITY_ORDER.indexOf(b.worstVarianceSeverity)
      : -1;
    return bIdx - aIdx;
  });

  return summaries;
}

/** Compute location-level variance summaries. */
function computeLocationVarianceSummaries(
  metrics: ActivityVarianceMetrics[],
  activities: ConstructionActivity[]
): LocationVarianceSummary[] {
  // Build lookup: activityKey → activity
  const activityMap = new Map<string, ConstructionActivity>();
  for (const a of activities) {
    activityMap.set(a.activity_key, a);
  }

  // Group metrics by location zone
  const zoneGroups = new Map<string, ActivityVarianceMetrics[]>();

  for (const m of metrics) {
    const activity = activityMap.get(m.activityKey);
    if (!activity) continue;

    const zone = activity.location_zone || "(unzoned)";
    if (!zoneGroups.has(zone)) {
      zoneGroups.set(zone, []);
    }
    zoneGroups.get(zone)!.push(m);
  }

  const summaries: LocationVarianceSummary[] = [];

  for (const [zone, groupMetrics] of zoneGroups) {
    const tracked = groupMetrics.filter((m) => m.isTracked);
    const majorVariance = groupMetrics.filter(
      (m) =>
        m.varianceSeverity === "major" || m.varianceSeverity === "critical"
    );

    const totalEstimatedHours = roundTo(
      groupMetrics.reduce((sum, m) => sum + m.estimatedHours, 0),
      2
    );
    const totalActualHours = roundTo(
      tracked.reduce((sum, m) => sum + (m.actualHours ?? 0), 0),
      2
    );
    const totalHoursVariance = roundTo(
      tracked.reduce((sum, m) => sum + (m.hoursVariance ?? 0), 0),
      2
    );

    const zoneVariancePct =
      totalEstimatedHours > 0 && tracked.length > 0
        ? roundTo((totalHoursVariance / totalEstimatedHours) * 100, 1)
        : null;

    let worst: VarianceSeverity | null = null;
    for (const m of groupMetrics) {
      worst = worseSeverity(worst, m.varianceSeverity);
    }

    const majorVarianceActivityKeys = majorVariance
      .sort((a, b) => (b.absVariancePct ?? 0) - (a.absVariancePct ?? 0))
      .map((m) => m.activityKey);

    const summarySentence = buildLocationSummarySentence(
      zone,
      tracked.length,
      groupMetrics.length,
      majorVariance.length,
      majorVarianceActivityKeys
    );

    summaries.push({
      locationZone: zone,
      activityCount: groupMetrics.length,
      trackedCount: tracked.length,
      totalEstimatedHours,
      totalActualHours,
      totalHoursVariance,
      zoneVariancePct,
      worstVarianceSeverity: worst,
      majorVarianceCount: majorVariance.length,
      reworkCount: groupMetrics.filter((m) => m.hasRework).length,
      majorVarianceActivityKeys,
      summarySentence,
    });
  }

  // Sort by worst severity descending
  summaries.sort((a, b) => {
    const aIdx = a.worstVarianceSeverity
      ? SEVERITY_ORDER.indexOf(a.worstVarianceSeverity)
      : -1;
    const bIdx = b.worstVarianceSeverity
      ? SEVERITY_ORDER.indexOf(b.worstVarianceSeverity)
      : -1;
    return bIdx - aIdx;
  });

  return summaries;
}

/** Compute activity-type-level variance summaries. */
function computeActivityTypeVarianceSummaries(
  metrics: ActivityVarianceMetrics[],
  activities: ConstructionActivity[],
  taxonomy: TradeTaxonomy[]
): ActivityTypeVarianceSummary[] {
  // Build lookup: activityKey → activity
  const activityMap = new Map<string, ConstructionActivity>();
  for (const a of activities) {
    activityMap.set(a.activity_key, a);
  }

  // Group metrics by activity type
  const typeGroups = new Map<ActivityTypeCategory, ActivityVarianceMetrics[]>();

  for (const m of metrics) {
    const activity = activityMap.get(m.activityKey);
    if (!activity) continue;

    const type = classifyActivityType(activity, taxonomy);
    if (!typeGroups.has(type)) {
      typeGroups.set(type, []);
    }
    typeGroups.get(type)!.push(m);
  }

  const summaries: ActivityTypeVarianceSummary[] = [];

  for (const [activityType, groupMetrics] of typeGroups) {
    const tracked = groupMetrics.filter((m) => m.isTracked);
    const majorVariance = groupMetrics.filter(
      (m) =>
        m.varianceSeverity === "major" || m.varianceSeverity === "critical"
    );

    const totalEstimatedHours = roundTo(
      groupMetrics.reduce((sum, m) => sum + m.estimatedHours, 0),
      2
    );
    const totalActualHours = roundTo(
      tracked.reduce((sum, m) => sum + (m.actualHours ?? 0), 0),
      2
    );
    const totalHoursVariance = roundTo(
      tracked.reduce((sum, m) => sum + (m.hoursVariance ?? 0), 0),
      2
    );

    const typeVariancePct =
      totalEstimatedHours > 0 && tracked.length > 0
        ? roundTo((totalHoursVariance / totalEstimatedHours) * 100, 1)
        : null;

    let worst: VarianceSeverity | null = null;
    for (const m of groupMetrics) {
      worst = worseSeverity(worst, m.varianceSeverity);
    }

    const majorVarianceActivityKeys = majorVariance
      .sort((a, b) => (b.absVariancePct ?? 0) - (a.absVariancePct ?? 0))
      .map((m) => m.activityKey);

    const summarySentence = buildActivityTypeSummarySentence(
      activityType,
      tracked.length,
      groupMetrics.length,
      majorVariance.length,
      majorVarianceActivityKeys
    );

    summaries.push({
      activityType,
      activityTypeLabel: ACTIVITY_TYPE_LABELS[activityType],
      activityCount: groupMetrics.length,
      trackedCount: tracked.length,
      totalEstimatedHours,
      totalActualHours,
      totalHoursVariance,
      typeVariancePct,
      worstVarianceSeverity: worst,
      majorVarianceCount: majorVariance.length,
      majorVarianceActivityKeys,
      summarySentence,
    });
  }

  // Sort by worst severity descending
  summaries.sort((a, b) => {
    const aIdx = a.worstVarianceSeverity
      ? SEVERITY_ORDER.indexOf(a.worstVarianceSeverity)
      : -1;
    const bIdx = b.worstVarianceSeverity
      ? SEVERITY_ORDER.indexOf(b.worstVarianceSeverity)
      : -1;
    return bIdx - aIdx;
  });

  return summaries;
}

/** Compute variance trends by comparing each activity to its trade peers. */
function computeVarianceTrends(
  metrics: ActivityVarianceMetrics[],
  activities: ConstructionActivity[]
): VarianceTrend[] {
  // Build lookup: activityKey → activity
  const activityMap = new Map<string, ConstructionActivity>();
  for (const a of activities) {
    activityMap.set(a.activity_key, a);
  }

  // Group tracked metrics by trade
  const tradeMetrics = new Map<string, ActivityVarianceMetrics[]>();
  for (const m of metrics) {
    const activity = activityMap.get(m.activityKey);
    if (!activity) continue;

    const tradeKey = activity.required_trade_key;
    if (!tradeMetrics.has(tradeKey)) {
      tradeMetrics.set(tradeKey, []);
    }
    tradeMetrics.get(tradeKey)!.push(m);
  }

  // Compute trends
  const trends: VarianceTrend[] = [];

  for (const m of metrics) {
    const activity = activityMap.get(m.activityKey);
    if (!activity) continue;

    const tradeKey = activity.required_trade_key;
    const peers = tradeMetrics.get(tradeKey) ?? [];

    // Only consider tracked peers for the average
    const trackedPeers = peers.filter((p) => p.isTracked && p.variancePct !== null);
    const peerCount = trackedPeers.length;

    // False positive protection: need at least 2 tracked activities for trend
    if (!m.isTracked || peerCount < 2) {
      trends.push({
        activityKey: m.activityKey,
        tradeKey,
        variancePct: m.variancePct,
        tradeAvgVariancePct: null,
        deviationFromTradeAvg: null,
        direction: "insufficient_data",
        peerCount,
        trendLabel: buildTrendLabel("insufficient_data", null, null),
      });
      continue;
    }

    const tradeAvg = roundTo(
      trackedPeers.reduce((sum, p) => sum + (p.variancePct ?? 0), 0) / peerCount,
      1
    );

    const deviation = roundTo((m.variancePct ?? 0) - tradeAvg, 1);

    let direction: VarianceTrendDirection;
    if (Math.abs(deviation) <= 5) {
      direction = "stable";
    } else if (deviation < -5) {
      direction = "improving";
    } else {
      direction = "worsening";
    }

    trends.push({
      activityKey: m.activityKey,
      tradeKey,
      variancePct: m.variancePct,
      tradeAvgVariancePct: tradeAvg,
      deviationFromTradeAvg: deviation,
      direction,
      peerCount,
      trendLabel: buildTrendLabel(direction, m.variancePct, deviation),
    });
  }

  return trends;
}

/** Compute schedule risk for a single activity. */
function computeActivityScheduleRisk(
  metric: ActivityVarianceMetrics,
  activity: ConstructionActivity,
  dependencies: ActivityDependency[]
): ActivityScheduleRisk {
  // False positive protection: only compute for tracked, non-not_started activities
  if (!metric.isTracked || activity.status === "not_started") {
    return {
      activityKey: metric.activityKey,
      onCriticalPath: false,
      riskLevel: "none",
      riskScore: 0,
      riskFactors: [],
      summarySentence: buildRiskSummarySentence(
        metric.activityKey,
        "none",
        0,
        [],
        true
      ),
    };
  }

  const riskFactors: ScheduleRiskFactor[] = [];
  let riskScore = 0;

  // Factor 1: Hours overrun (weight: 35)
  const hoursOverrunWeight = 35;
  let hoursOverrunPoints = 0;
  if (metric.varianceSeverity === "critical") hoursOverrunPoints = 35;
  else if (metric.varianceSeverity === "major") hoursOverrunPoints = 25;
  else if (metric.varianceSeverity === "minor") hoursOverrunPoints = 10;
  else hoursOverrunPoints = 0;

  if (hoursOverrunPoints > 0) {
    riskScore += hoursOverrunPoints;
    const pctLabel =
      metric.variancePct !== null ? ` (${roundTo(metric.variancePct, 1)}%)` : "";
    riskFactors.push({
      factor: "hours_overrun",
      weight: hoursOverrunPoints,
      description: {
        en: `Hours overrun: ${metric.varianceSeverity!.replace("_", " ")}${pctLabel}`,
        es: `Exceso de horas: ${metric.varianceSeverity === "on_track" ? "en curso" : metric.varianceSeverity === "minor" ? "menor" : metric.varianceSeverity === "major" ? "mayor" : "crítica"}${pctLabel}`,
      },
    });
  }

  // Factor 2: Critical path (weight: 25)
  const onCriticalPath = isOnCriticalPath(activity.id, dependencies);
  if (onCriticalPath) {
    riskScore += 25;
    riskFactors.push({
      factor: "critical_path",
      weight: 25,
      description: {
        en: "Activity is on the critical path",
        es: "Actividad está en la ruta crítica",
      },
    });
  }

  // Factor 3: Rework (weight: 15)
  if (metric.reworkCount >= 3) {
    riskScore += 15;
    riskFactors.push({
      factor: "rework",
      weight: 15,
      description: {
        en: `High rework: ${metric.reworkCount} cycles`,
        es: `Alto retrabajo: ${metric.reworkCount} ciclos`,
      },
    });
  } else if (metric.reworkCount >= 1) {
    riskScore += 10;
    riskFactors.push({
      factor: "rework",
      weight: 10,
      description: {
        en: `Rework: ${metric.reworkCount} cycle${metric.reworkCount > 1 ? "s" : ""}`,
        es: `Retrabajo: ${metric.reworkCount} ciclo${metric.reworkCount > 1 ? "s" : ""}`,
      },
    });
  }

  // Factor 4: Below plan production (weight: 15)
  const productionPoints = (() => {
    switch (metric.productivityAssessment) {
      case "stalled":
        return 15;
      case "below_plan":
        return 10;
      case "on_target":
        return 5;
      case "exceeds_plan":
        return 0;
      case "not_measured":
        return 0;
    }
  })();

  if (productionPoints > 0) {
    riskScore += productionPoints;
    riskFactors.push({
      factor: "below_plan_production",
      weight: productionPoints,
      description: {
        en: `Production: ${metric.productivityAssessment.replace("_", " ")}`,
        es: `Producción: ${metric.productivityAssessment === "stalled" ? "detenida" : metric.productivityAssessment === "below_plan" ? "debajo del plan" : metric.productivityAssessment === "on_target" ? "en objetivo" : "no medida"}`,
      },
    });
  }

  // Factor 5: Crew exceeded (weight: 10)
  if (metric.crewExceeded === true) {
    riskScore += 10;
    riskFactors.push({
      factor: "crew_exceeded",
      weight: 10,
      description: {
        en: `Crew exceeded plan: ${metric.actualCrewSize} vs ${metric.plannedCrewCount} planned`,
        es: `Cuadrilla excedió el plan: ${metric.actualCrewSize} vs ${metric.plannedCrewCount} planificado`,
      },
    });
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  const riskLevel = scoreToRiskLevel(riskScore);

  return {
    activityKey: metric.activityKey,
    onCriticalPath,
    riskLevel,
    riskScore,
    riskFactors,
    summarySentence: buildRiskSummarySentence(
      metric.activityKey,
      riskLevel,
      riskScore,
      riskFactors,
      false
    ),
  };
}

/** Compute schedule risks for all activities. */
function computeScheduleRisks(
  metrics: ActivityVarianceMetrics[],
  activities: ConstructionActivity[],
  dependencies: ActivityDependency[]
): ActivityScheduleRisk[] {
  // Build lookup: activityKey → activity
  const activityMap = new Map<string, ConstructionActivity>();
  for (const a of activities) {
    activityMap.set(a.activity_key, a);
  }

  const risks: ActivityScheduleRisk[] = [];

  for (const m of metrics) {
    const activity = activityMap.get(m.activityKey);
    if (!activity) continue;

    risks.push(computeActivityScheduleRisk(m, activity, dependencies));
  }

  // Sort by risk score descending
  risks.sort((a, b) => b.riskScore - a.riskScore);

  return risks;
}

// ── Main Computation ──────────────────────────────────────────────────────────

/**
 * Compute productivity variance analytics for all construction activities.
 * This is the main entry point — call from the server page and pass
 * the result down to components.
 *
 * Pure function: same inputs → same outputs. No database calls.
 *
 * @param activities - All construction activities for the project
 * @param dependencies - Activity dependencies for critical path checks
 * @param taxonomy - Trade taxonomy for trade label resolution
 * @param thresholds - Optional variance severity thresholds (defaults to industry norms)
 */
export function computeProductivityVariance(
  activities: ConstructionActivity[],
  dependencies: ActivityDependency[],
  taxonomy: TradeTaxonomy[],
  thresholds: VarianceThresholds = DEFAULT_VARIANCE_THRESHOLDS
): ProductivityVarianceResult {
  // Step 1: Compute base per-activity variance metrics
  const varianceResult: LaborVarianceResult = computeLaborVariance(
    activities,
    thresholds
  );
  const activityMetrics = varianceResult.activities;

  // Step 2: Compute aggregations
  const byTrade = computeTradeVarianceSummaries(
    activityMetrics,
    activities,
    taxonomy
  );
  const byLocation = computeLocationVarianceSummaries(
    activityMetrics,
    activities
  );
  const byActivityType = computeActivityTypeVarianceSummaries(
    activityMetrics,
    activities,
    taxonomy
  );

  // Step 3: Compute trends
  const trends = computeVarianceTrends(activityMetrics, activities);

  // Step 4: Compute schedule risks
  const scheduleRisks = computeScheduleRisks(
    activityMetrics,
    activities,
    dependencies
  );

  // Step 5: Compute overall schedule risk
  const activitiesAtRisk = scheduleRisks.filter(
    (r) => r.riskLevel !== "none"
  ).length;

  let overallScheduleRisk: ScheduleRiskLevel = "none";
  for (const r of scheduleRisks) {
    if (RISK_ORDER.indexOf(r.riskLevel) > RISK_ORDER.indexOf(overallScheduleRisk)) {
      overallScheduleRisk = r.riskLevel;
    }
  }

  return {
    trends,
    byTrade,
    byLocation,
    byActivityType,
    scheduleRisks,
    overallScheduleRisk,
    activitiesAtRisk,
    computedAt: new Date().toISOString(),
  };
}