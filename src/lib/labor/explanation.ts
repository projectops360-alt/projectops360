// ============================================================================
// ProjectOps360° — Labor Capacity Gap Explanation Generator
// ============================================================================
// Deterministic AI-style explanation generator for labor capacity gaps.
// Produces structured insights (kind + values) following the same pattern as
// buildNodeInsight / buildPathNarrative in living-graph-analysis.ts.
//
// No database calls, no AI calls, no randomness.
// Same inputs → same outputs. Fully deterministic.
//
// Process-centered vocabulary:
//   labor capacity gap, over-allocation risk, skill coverage risk,
//   vendor unconfirmed risk, partial availability risk,
//   downstream schedule impact, cascade risk
// ============================================================================

import type { ShortageRiskLevel, Locale } from "@/types/database";
import type {
  WeeklyCapacityGap,
  LaborCapacityResult,
  AvailabilityWindow,
} from "@/lib/labor/capacity";
import { parseAvailabilityWindows } from "@/lib/labor/capacity";
import { getI18nValue } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Kind of capacity insight (mirrors LivingGraphInsight.kind pattern). */
export type CapacityInsightKind =
  | "labor_capacity_gap" // shortage: required > available
  | "vendor_unconfirmed_risk" // vendor resource not confirmed
  | "over_allocation_risk" // resource serving multiple projects
  | "partial_availability_risk" // resource partially available
  | "skill_coverage_risk" // skill level mismatch
  | "healthy"; // no issue

/** Insight for a single weekly gap (kind + values for i18n interpolation). */
export interface CapacityGapInsight {
  kind: CapacityInsightKind;
  values: Record<string, string | number>;
}

/** Cascade risk: a gap that impacts multiple downstream milestones. */
export interface CascadeRisk {
  tradeKey: string;
  weekLabel: string;
  affectedMilestoneIds: string[];
  downstreamActivityCount: number;
}

/** Full narrative summary of the project's labor capacity situation. */
export interface CapacitySummaryNarrative {
  overallSeverity: ShortageRiskLevel;
  criticalGaps: CapacityGapInsight[];
  cascadeRisks: CascadeRisk[];
  summaryValues: Record<string, string | number>;
}

// ── Constraint type detection ──────────────────────────────────────────────────

/** Extract constraint type from a LaborResource's constraints JSONB. */
function getConstraintType(
  resource: { constraints: Record<string, unknown> }
): string {
  return (resource.constraints?.type as string) ?? "none";
}

/** Find resources matching a gap's affectedResourceKeys. */
function findAffectedResources(
  gap: WeeklyCapacityGap,
  resources: Array<{
    resource_key: string;
    constraints: Record<string, unknown>;
    skill_level: string;
    availability: Record<string, unknown>[];
  }>
) {
  return resources.filter((r) =>
    gap.affectedResourceKeys.includes(r.resource_key)
  );
}

/** Collect distinct constraint types from affected resources. */
function collectConstraintTypes(
  gap: WeeklyCapacityGap,
  resources: Array<{
    resource_key: string;
    constraints: Record<string, unknown>;
    skill_level: string;
    availability: Record<string, unknown>[];
  }>
): Set<string> {
  const types = new Set<string>();
  for (const r of findAffectedResources(gap, resources)) {
    types.add(getConstraintType(r));
  }
  return types;
}

// ── classifyGapInsight ──────────────────────────────────────────────────────────

const CONSTRAINT_PRIORITY: CapacityInsightKind[] = [
  "vendor_unconfirmed_risk",
  "over_allocation_risk",
  "partial_availability_risk",
  "labor_capacity_gap",
];

const CONSTRAINT_TO_KIND: Record<string, CapacityInsightKind> = {
  vendor_unconfirmed: "vendor_unconfirmed_risk",
  over_allocated: "over_allocation_risk",
  partial_availability: "partial_availability_risk",
  shortage: "labor_capacity_gap",
  none: "healthy",
};

/**
 * Classify a weekly gap's root-cause insight kind.
 * Priority: vendor_unconfirmed > over_allocated > partial > shortage > generic gap.
 * Returns "healthy" if shortage risk is "none".
 */
export function classifyGapInsight(
  gap: WeeklyCapacityGap,
  resources: Array<{
    resource_key: string;
    constraints: Record<string, unknown>;
    skill_level: string;
    availability: Record<string, unknown>[];
  }>
): CapacityGapInsight {
  // No gap → healthy
  if (gap.shortageRisk === "none") {
    return { kind: "healthy", values: { week: gap.weekLabel } };
  }

  // Check constraint types in priority order
  const constraintTypes = collectConstraintTypes(gap, resources);

  for (const priorityKind of CONSTRAINT_PRIORITY) {
    // Find the constraint type that maps to this kind
    for (const [constraintType, kind] of Object.entries(CONSTRAINT_TO_KIND)) {
      if (kind === priorityKind && constraintTypes.has(constraintType)) {
        return buildInsightValues(kind, gap, resources);
      }
    }
  }

  // Check skill coverage risk: if any affected resource is apprentice/journeyman
  // and the gap requires senior/master level work (commissioning activities)
  const affectedRes = findAffectedResources(gap, resources);
  const hasLowSkill = affectedRes.some(
    (r) => r.skill_level === "apprentice" || r.skill_level === "journeyman"
  );
  if (hasLowSkill && gap.criticalPathImpact) {
    return buildInsightValues("skill_coverage_risk", gap, resources);
  }

  // Default: generic labor capacity gap
  return buildInsightValues("labor_capacity_gap", gap, resources);
}

/** Build the values map for an insight. */
function buildInsightValues(
  kind: CapacityInsightKind,
  gap: WeeklyCapacityGap,
  resources: Array<{
    resource_key: string;
    constraints: Record<string, unknown>;
    skill_level: string;
    availability: Record<string, unknown>[];
  }>
): CapacityGapInsight {
  const values: Record<string, string | number> = {
    trade: gap.tradeKey,
    week: gap.weekLabel,
    gap: Math.abs(gap.gapHeadcount),
    requiredHC: gap.requiredHeadcount,
    availableHC: gap.availableHeadcount,
    utilizationPct: gap.utilizationPct ?? 0,
    zone: gap.locationZone ?? "",
  };

  // Activities list (comma-separated keys)
  values.activities = gap.affectedActivityKeys.join(", ");

  // Critical path flag
  values.criticalPath = gap.criticalPathImpact ? 1 : 0;

  // Constraint-specific values
  const affectedRes = findAffectedResources(gap, resources);
  if (affectedRes.length > 0) {
    const res = affectedRes[0]; // primary resource
    const constraintType = getConstraintType(res);
    values.constraintType = constraintType;
    values.skillLevel = res.skill_level;
    values.concurrentProjects =
      (res.constraints?.concurrent_projects as number) ?? 1;
    values.leadTime =
      (res.constraints?.lead_time_weeks as number) ?? 4;
    values.confirmed = (res.constraints?.confirmed as boolean) ? 1 : 0;
  }

  // If available is 0, note it
  if (gap.availableHeadcount === 0 && gap.requiredHeadcount > 0) {
    values.noCapacity = 1;
  }

  return { kind, values };
}

// ── buildGapExplanation ─────────────────────────────────────────────────────────

/**
 * Generate a deterministic explanation string for a single weekly gap.
 * Uses locale-aware templates without next-intl dependency
 * (pure function, receives locale as parameter).
 */
export function buildGapExplanation(
  gap: WeeklyCapacityGap,
  resources: Array<{
    resource_key: string;
    name: string;
    constraints: Record<string, unknown>;
    skill_level: string;
    availability: Record<string, unknown>[];
  }>,
  activities: Array<{ activity_key: string; name: string }>,
  milestones: Array<{ id: string; title: string }>,
  taxonomy: Array<{ trade_key: string; label_i18n: Record<string, string> }>,
  affectedMilestoneIds: string[],
  locale: Locale = "en"
): string {
  const insight = classifyGapInsight(gap, resources);
  const v = insight.values;

  // Resolve trade label
  const taxEntry = taxonomy.find((t) => t.trade_key === gap.tradeKey);
  const tradeLabel = taxEntry
    ? getI18nValue(taxEntry.label_i18n, locale)
    : gap.tradeKey;

  // Resolve activity names
  const activityNames = gap.affectedActivityKeys
    .map((key) => {
      const a = activities.find((act) => act.activity_key === key);
      return a?.name ?? key;
    })
    .join(", ");

  // Resolve affected milestone titles
  const affectedMilestoneTitles = affectedMilestoneIds
    .filter((id) =>
      // Only include milestones affected by THIS gap's trade
      gap.shortageRisk !== "none"
    )
    .map((id) => {
      const m = milestones.find((ms) => ms.id === id);
      return m?.title ?? id;
    });

  const isEn = locale === "en";
  const zoneClause = gap.locationZone
    ? isEn
      ? ` at ${gap.locationZone}`
      : ` en ${gap.locationZone}`
    : "";

  // Build explanation based on insight kind
  switch (insight.kind) {
    case "healthy":
      return isEn
        ? `Adequate capacity for ${tradeLabel} in week ${gap.weekLabel}.`
        : `Capacidad adecuada para ${tradeLabel} en la semana ${gap.weekLabel}.`;

    case "vendor_unconfirmed_risk": {
      const leadTime = (v.leadTime as number) || 4;
      return isEn
        ? `${tradeLabel} shows a vendor unconfirmed risk in week ${gap.weekLabel}${zoneClause}. ` +
            `Affected activities: ${activityNames}. ` +
            `Vendor availability is not yet confirmed, creating a labor capacity gap of ${v.gap} headcount. ` +
            `This creates a downstream schedule impact on commissioning milestones. ` +
            `Recommendation: confirm vendor scheduling at least ${leadTime} weeks in advance and prepare an alternative resource.`
        : `${tradeLabel} presenta un riesgo de proveedor no confirmado en la semana ${gap.weekLabel}${zoneClause}. ` +
            `Actividades afectadas: ${activityNames}. ` +
            `La disponibilidad del proveedor no está confirmada, generando una labor capacity gap de ${v.gap} headcount. ` +
            `Esto crea un downstream schedule impact en los hitos de comisionamiento. ` +
            `Recomendación: confirmar la programación del proveedor con al menos ${leadTime} semanas de anticipación y preparar un recurso alternativo.`;
    }

    case "over_allocation_risk": {
      const concurrent = (v.concurrentProjects as number) || 2;
      return isEn
        ? `${tradeLabel} shows an over-allocation risk in week ${gap.weekLabel}${zoneClause}. ` +
            `Affected activities: ${activityNames}. ` +
            `The resource is allocated to ${concurrent} concurrent projects, creating a labor capacity gap of ${v.gap} headcount. ` +
            `This over-allocation risk reduces effective capacity for critical activities. ` +
            `Recommendation: negotiate dedicated allocation or share workload with another same-trade resource.`
        : `${tradeLabel} presenta un riesgo de sobre-asignación en la semana ${gap.weekLabel}${zoneClause}. ` +
            `Actividades afectadas: ${activityNames}. ` +
            `El recurso está asignado a ${concurrent} proyectos concurrentes, generando una labor capacity gap de ${v.gap} headcount. ` +
            `Este over-allocation risk reduce la capacidad efectiva para actividades críticas. ` +
            `Recomendación: negociar asignación dedicada o compartir carga con otro recurso del mismo oficio.`;
    }

    case "partial_availability_risk":
      return isEn
        ? `${tradeLabel} shows a partial availability risk in week ${gap.weekLabel}${zoneClause}. ` +
            `Affected activities: ${activityNames}. ` +
            `The resource has reduced availability due to concurrent assignments, creating a labor capacity gap of ${v.gap} headcount. ` +
            `This partial availability risk limits throughput on the critical path. ` +
            `Recommendation: coordinate scheduling to maximize available hours on critical activities.`
        : `${tradeLabel} presenta un riesgo de disponibilidad parcial en la semana ${gap.weekLabel}${zoneClause}. ` +
            `Actividades afectadas: ${activityNames}. ` +
            `El recurso tiene disponibilidad reducida debido a asignaciones concurrentes, generando una labor capacity gap de ${v.gap} headcount. ` +
            `Este partial availability risk limita el rendimiento en la ruta crítica. ` +
            `Recomendación: coordinar la programación para maximizar las horas disponibles en las actividades críticas.`;

    case "skill_coverage_risk": {
      const skillLevel = (v.skillLevel as string) || "journeyman";
      return isEn
        ? `${tradeLabel} shows a skill coverage risk in week ${gap.weekLabel}${zoneClause}. ` +
            `Affected activities: ${activityNames}. ` +
            `Available skill level (${skillLevel}) may not fully meet the activity requirements, creating a labor capacity gap of ${v.gap} headcount. ` +
            `This skill coverage risk affects work quality on the critical path. ` +
            `Recommendation: ensure senior supervision or required certification is in place before activity start.`
        : `${tradeLabel} presenta un riesgo de cobertura de habilidades en la semana ${gap.weekLabel}${zoneClause}. ` +
            `Actividades afectadas: ${activityNames}. ` +
            `El nivel de habilidad disponible (${skillLevel}) puede no cubrir completamente los requisitos de la actividad, generando una labor capacity gap de ${v.gap} headcount. ` +
            `Este skill coverage risk afecta la calidad del trabajo en la ruta crítica. ` +
            `Recomendación: asegurar supervisión senior o certificación requerida antes del inicio de la actividad.`;
    }

    case "labor_capacity_gap":
    default: {
      const criticalClause = gap.criticalPathImpact
        ? isEn
          ? "This gap impacts the critical path, creating a downstream schedule impact on dependent activities. "
          : "Esta brecha impacta la ruta crítica, creando un downstream schedule impact en las actividades dependientes. "
        : "";
      const noCapClause =
        gap.availableHeadcount === 0
          ? isEn
            ? "No capacity is currently allocated for this trade in this week. "
            : "No hay capacidad asignada actualmente para este oficio en esta semana. "
          : "";
      return isEn
        ? `${tradeLabel} shows a labor capacity gap of ${v.gap} headcount in week ${gap.weekLabel}${zoneClause}. ` +
            `Affected activities: ${activityNames}. ` +
            noCapClause +
            criticalClause +
            `Recommendation: evaluate reallocating resources from adjacent trades or activate reinforcement hiring with adequate lead time.`
        : `${tradeLabel} presenta una labor capacity gap de ${v.gap} headcount en la semana ${gap.weekLabel}${zoneClause}. ` +
            `Actividades afectadas: ${activityNames}. ` +
            noCapClause +
            criticalClause +
            `Recomendación: evaluar la reasignación de recursos de oficios adyacentes o activar contratación de refuerzo con anticipación adecuada.`;
    }
  }
}

// ── buildCapacitySummary ────────────────────────────────────────────────────────

/**
 * Generate a deterministic narrative summary of the project's labor capacity situation.
 * Returns structured data (overallSeverity, criticalGaps, cascadeRisks, summaryValues)
 * that can be rendered as prose in the UI.
 */
export function buildCapacitySummary(
  result: LaborCapacityResult,
  resources: Array<{
    resource_key: string;
    name: string;
    constraints: Record<string, unknown>;
    skill_level: string;
    availability: Record<string, unknown>[];
  }>,
  activities: Array<{ activity_key: string; name: string }>,
  milestones: Array<{ id: string; title: string; order_index: number }>,
  taxonomy: Array<{ trade_key: string; label_i18n: Record<string, string> }>,
  locale: Locale = "en"
): CapacitySummaryNarrative {
  const isEn = locale === "en";
  const shortageGaps = result.weeklyGaps.filter(
    (g) => g.shortageRisk !== "none"
  );

  // Overall severity: highest risk level across all gaps
  const riskOrder: ShortageRiskLevel[] = [
    "critical",
    "high",
    "medium",
    "low",
    "none",
  ];
  let overallSeverity: ShortageRiskLevel = "none";
  for (const risk of riskOrder) {
    if (shortageGaps.some((g) => g.shortageRisk === risk)) {
      overallSeverity = risk;
      break;
    }
  }

  // Critical gaps (high/critical risk)
  const criticalGaps = shortageGaps
    .filter((g) => g.shortageRisk === "high" || g.shortageRisk === "critical")
    .map((g) => classifyGapInsight(g, resources));

  // Cascade risks: gaps that affect ≥2 milestones
  const cascadeRisks: CascadeRisk[] = [];
  for (const gap of shortageGaps) {
    if (result.affectedMilestoneIds.length >= 2 && gap.criticalPathImpact) {
      // This gap's trade is on the critical path and project has multi-milestone impact
      const relatedActivities = activities.filter((a) =>
        gap.affectedActivityKeys.includes(a.activity_key)
      );
      if (relatedActivities.length > 0) {
        cascadeRisks.push({
          tradeKey: gap.tradeKey,
          weekLabel: gap.weekLabel,
          affectedMilestoneIds: result.affectedMilestoneIds,
          downstreamActivityCount: relatedActivities.length,
        });
      }
    }
  }

  // Most affected trade (largest cumulative gap)
  const tradeGapMap = new Map<string, number>();
  for (const gap of shortageGaps) {
    const current = tradeGapMap.get(gap.tradeKey) ?? 0;
    tradeGapMap.set(gap.tradeKey, current + Math.abs(gap.gapHeadcount));
  }
  let mostCriticalTrade = "";
  let maxGap = 0;
  for (const [trade, gap] of tradeGapMap) {
    if (gap > maxGap) {
      maxGap = gap;
      mostCriticalTrade = trade;
    }
  }

  const mostCriticalLabel =
    taxonomy.find((t) => t.trade_key === mostCriticalTrade)
      ? getI18nValue(
          taxonomy.find((t) => t.trade_key === mostCriticalTrade)!.label_i18n,
          locale
        )
      : mostCriticalTrade;

  // Build summary values for i18n interpolation
  const severityLabels: Record<ShortageRiskLevel, Record<Locale, string>> = {
    none: { en: "no", es: "ningún" },
    low: { en: "low", es: "bajo" },
    medium: { en: "medium", es: "medio" },
    high: { en: "high", es: "alto" },
    critical: { en: "critical", es: "crítico" },
  };

  const summaryValues: Record<string, string | number> = {
    severity: severityLabels[overallSeverity][locale],
    tradeCount: new Set(shortageGaps.map((g) => g.tradeKey)).size,
    weekCount: new Set(shortageGaps.map((g) => g.weekLabel)).size,
    totalTrades: new Set(result.weeklyGaps.map((g) => g.tradeKey)).size,
    mostCriticalTrade: mostCriticalLabel,
    criticalGapCount: criticalGaps.length,
    cascadeRiskCount: cascadeRisks.length,
  };

  return {
    overallSeverity,
    criticalGaps,
    cascadeRisks,
    summaryValues,
  };
}