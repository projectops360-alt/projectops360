// ============================================================================
// ProjectOps360° — Crew Idle Risk Detection Engine
// ============================================================================
// Pure functions that detect crews assigned to work that is not ready.
// When a crew is assigned to an activity with incomplete readiness criteria,
// that crew faces "workface readiness risk" — allocated but unable to execute.
//
// All descriptions use process language: "workface not ready",
// "prerequisite incomplete", "vendor unconfirmed" — NEVER "crew idle" or
// "crew not productive". The crew is ready; the workface is not.
//
// No database calls — operates on already-fetched data.
// Deterministic: same inputs → same outputs. No AI calls.
// ============================================================================

import type {
  ActivityDependency,
  ConstructionActivity,
  LaborResource,
  LaborResourceType,
  I18nField,
  ReadinessChecklistItem,
  ReadinessLevel,
  IdleRiskSeverity,
  RecommendedActionType,
  ShortageRiskLevel,
} from "@/types/database";
import { getI18nValue } from "@/types/database";
import {
  computeWorkfaceReadiness,
  getMissingPrerequisites,
  assessChecklistReadiness,
} from "./workface-readiness";
import { isOnCriticalPath } from "./capacity";

// ── Exported Types ──────────────────────────────────────────────────────────────

/** A recommended action to mitigate workface readiness risk. */
export interface RecommendedAction {
  actionType: RecommendedActionType;
  /** Bilingual description of the recommended action. */
  description: I18nField;
  /** The prerequisite activity to expedite (for expedite_prerequisite). */
  targetActivityKey?: string;
  /** The vendor resource to confirm (for confirm_vendor). */
  targetResourceKey?: string;
}

/** Idle risk for a single resource-activity assignment. */
export interface AssignedActivityRisk {
  activityKey: string;
  activityName: string;
  readiness: ReadinessLevel;
  readinessPct: number;
  missingPrerequisites: ReadinessChecklistItem[];
  idleRiskSeverity: IdleRiskSeverity;
  /** Estimated business days within the lookahead window where the crew cannot work. */
  daysAtRisk: number;
  /** Successor activity keys affected by delay (downstream impact). */
  downstreamActivityKeys: string[];
  recommendedAction: RecommendedAction;
}

/** Idle risk entry for a single resource (crew/specialist/vendor). */
export interface CrewIdleRiskEntry {
  resourceKey: string;
  resourceName: string;
  tradeKey: string;
  resourceType: LaborResourceType;
  /** Constraint type from the resource's constraints field. */
  constraintType: string;
  assignedActivities: AssignedActivityRisk[];
  /** ISO week labels where the crew has NO ready activity. */
  idleWeeks: string[];
  /** Total estimated idle business days across all not-ready assignments. */
  totalIdleDays: number;
  worstIdleRisk: IdleRiskSeverity;
  /** How many downstream activities are affected. */
  downstreamImpactCount: number;
  recommendedAction: RecommendedAction;
}

/** Summary of idle risk across the project. */
export interface IdleRiskSummary {
  overallSeverity: IdleRiskSeverity;
  /** Bilingual sentence summarizing the idle risk situation. */
  summarySentence: I18nField;
  topActions: RecommendedAction[];
}

/** Full result of crew idle risk computation. */
export interface CrewIdleRiskResult {
  /** ISO date of the reference date used as anchor. */
  referenceDate: string;
  horizonWeeks: 3 | 6;
  entries: CrewIdleRiskEntry[];
  /** Count of crews with idle risk > "none". */
  crewsAtRisk: number;
  /** Total idle days across all entries. */
  totalIdleDays: number;
  /** Idle days on critical path activities only. */
  criticalPathIdleDays: number;
  summary: IdleRiskSummary;
}

// ── Internal Types ──────────────────────────────────────────────────────────────

interface WeekDefinition {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
}

// ── Severity Rankings ───────────────────────────────────────────────────────────

const IDLE_RISK_SEVERITY: Record<IdleRiskSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const READINESS_SEVERITY: Record<ReadinessLevel, number> = {
  ready: 0,
  at_risk: 1,
  not_ready: 2,
  blocked: 3,
};

function worseIdleRisk(a: IdleRiskSeverity, b: IdleRiskSeverity): IdleRiskSeverity {
  return IDLE_RISK_SEVERITY[a] >= IDLE_RISK_SEVERITY[b] ? a : b;
}

// ── Date Helpers ─────────────────────────────────────────────────────────────────

function formatDateStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) return new Date(NaN);
  if (dateInput instanceof Date) {
    return new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()));
  }
  const isoMatch = (dateInput as string).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(Date.UTC(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]));
  }
  return new Date(NaN);
}

/** Count business days (Mon-Fri) between two dates (inclusive). */
function countBusinessDays(start: Date, end: Date): number {
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

function dateRangesOverlap(
  startA: string, endA: string,
  startB: string | null, endB: string | null
): boolean {
  if (!startB || !endB) return false;
  const aStart = parseDate(startA).getTime();
  const aEnd = parseDate(endA).getTime();
  const bStart = parseDate(startB).getTime();
  const bEnd = parseDate(endB).getTime();
  if (isNaN(aStart) || isNaN(aEnd) || isNaN(bStart) || isNaN(bEnd)) return false;
  return aStart <= bEnd && aEnd >= bStart;
}

// ── generateLookaheadWeeks (reused from lookahead.ts logic) ─────────────────────

function generateLookaheadWeeks(referenceDate: Date, horizon: 3 | 6): WeekDefinition[] {
  const weeks: WeekDefinition[] = [];
  const dayOfWeek = referenceDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(referenceDate);
  monday.setUTCDate(referenceDate.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < horizon; i++) {
    const weekStart = new Date(monday);
    weekStart.setUTCDate(monday.getUTCDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 4);

    const thursday = new Date(weekStart);
    thursday.setUTCDate(weekStart.getUTCDate() + 3);
    const thursdayYear = thursday.getUTCFullYear();
    const jan1Thu = new Date(Date.UTC(thursdayYear, 0, 1));
    const isoWeek = Math.ceil(((thursday.getTime() - jan1Thu.getTime()) / (24 * 60 * 60 * 1000) + 1) / 7);
    const weekLabel = `${thursdayYear}-W${String(isoWeek).padStart(2, "0")}`;

    weeks.push({
      weekLabel,
      weekStart: formatDateStr(weekStart),
      weekEnd: formatDateStr(weekEnd),
    });
  }
  return weeks;
}

// ── Downstream Successor Tracing ────────────────────────────────────────────────

/**
 * Trace all downstream successors of an activity via the dependency graph.
 * Returns activity keys of all activities that would be delayed.
 */
function traceSuccessors(
  activityId: string,
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[]
): string[] {
  const visited = new Set<string>();
  const queue = [activityId];
  const activityById = new Map(allActivities.map((a) => [a.id, a]));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all dependencies where current is the predecessor
    const successorDeps = dependencies.filter((d) => d.predecessor_id === current);
    for (const dep of successorDeps) {
      if (!visited.has(dep.successor_id)) {
        queue.push(dep.successor_id);
      }
    }
  }

  // Remove the activity itself, return activity keys
  visited.delete(activityId);
  return Array.from(visited)
    .map((id) => {
      const activity = activityById.get(id);
      return activity?.activity_key;
    })
    .filter((key): key is string => key !== undefined);
}

// ── readActivityReadiness ────────────────────────────────────────────────────────

/**
 * Get the readiness level for an activity, reusing the checklist computation.
 * Returns "ready" if the checklist is fully complete and status allows.
 */
function getActivityReadiness(
  activity: ConstructionActivity,
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[]
): ReadinessLevel {
  // Blocked status
  if (activity.status === "blocked") return "blocked";

  // Check predecessor dependencies
  const activityById = new Map(allActivities.map((a) => [a.id, a]));
  const predecessorDeps = dependencies.filter((d) => d.successor_id === activity.id);

  for (const dep of predecessorDeps) {
    const pred = activityById.get(dep.predecessor_id);
    if (pred && pred.status === "blocked") return "blocked";
  }

  // Use workface checklist
  const checklistReadiness = assessChecklistReadiness(activity.readiness_checklist);

  // Check if predecessor not completed
  let readiness: ReadinessLevel = "ready";
  for (const dep of predecessorDeps) {
    const pred = activityById.get(dep.predecessor_id);
    if (pred && pred.status !== "completed") {
      readiness = "at_risk";
      break;
    }
  }

  // Check resource assignment
  const assignedCount = activity.assigned_resource_keys?.length ?? 0;
  if (activity.required_crew_count > 0 && assignedCount === 0) {
    readiness = worseReadiness(readiness, "not_ready");
  } else if (activity.required_crew_count > 0 && assignedCount < activity.required_crew_count) {
    readiness = worseReadiness(readiness, "at_risk");
  }

  // Combine with checklist readiness
  readiness = worseReadiness(readiness, checklistReadiness);

  return readiness;
}

function worseReadiness(a: ReadinessLevel, b: ReadinessLevel): ReadinessLevel {
  return READINESS_SEVERITY[a] >= READINESS_SEVERITY[b] ? a : b;
}

// ── computeDaysAtRisk ────────────────────────────────────────────────────────────

/**
 * Compute estimated idle business days for a crew assigned to a not-ready activity.
 *
 * - blocked → full overlap (crew can't start at all)
 * - not_ready → full overlap
 * - at_risk → partial delay based on missing prerequisites:
 *   1 missing → 2-3 business days
 *   2 missing → 5 business days
 *   3+ missing → full overlap
 */
function computeDaysAtRisk(
  activity: ConstructionActivity,
  readiness: ReadinessLevel,
  weeks: WeekDefinition[]
): number {
  if (readiness === "ready") return 0;

  // Calculate overlap between activity dates and horizon weeks
  const horizonStart = parseDate(weeks[0].weekStart);
  const horizonEnd = parseDate(weeks[weeks.length - 1].weekEnd);

  const activityStart = parseDate(activity.planned_start_date);
  const activityEnd = parseDate(activity.planned_end_date);

  if (isNaN(activityStart.getTime()) || isNaN(activityEnd.getTime())) return 0;

  // Find overlap range
  const overlapStart = new Date(Math.max(activityStart.getTime(), horizonStart.getTime()));
  const overlapEnd = new Date(Math.min(activityEnd.getTime(), horizonEnd.getTime()));

  if (overlapStart > overlapEnd) return 0;

  const fullOverlapDays = countBusinessDays(overlapStart, overlapEnd);

  if (readiness === "blocked" || readiness === "not_ready") {
    return fullOverlapDays;
  }

  // at_risk: partial delay based on missing prerequisites count
  const missing = getMissingPrerequisites(activity.readiness_checklist);
  const missingCount = missing.length;

  if (missingCount >= 3) return fullOverlapDays;
  if (missingCount === 2) return Math.min(5, fullOverlapDays);
  if (missingCount === 1) return Math.min(3, fullOverlapDays);

  return 0;
}

// ── recommendAction ──────────────────────────────────────────────────────────────

/**
 * Recommend a mitigation action for a crew assigned to not-ready work.
 * All descriptions use process framing — NEVER blaming the crew.
 */
function recommendAction(
  activity: ConstructionActivity,
  resource: LaborResource,
  readiness: ReadinessLevel,
  missingPrerequisites: ReadinessChecklistItem[],
  daysAtRisk: number,
  hasOtherReadyActivities: boolean
): RecommendedAction {
  const constraintType = (resource.constraints as Record<string, unknown>)?.type as string ?? "none";
  const activityName = activity.name;

  // 1. Vendor unconfirmed → confirm_vendor
  if (constraintType === "vendor_unconfirmed") {
    return {
      actionType: "confirm_vendor",
      description: {
        en: `Confirm vendor scheduling for "${activityName}"`,
        es: `Confirmar programación de proveedor para "${activityName}"`,
      },
      targetResourceKey: resource.resource_key,
    };
  }

  // 2. Blocked → expedite_prerequisite (find blocking predecessor)
  if (readiness === "blocked") {
    return {
      actionType: "expedite_prerequisite",
      description: {
        en: `Expedite prerequisites for "${activityName}" — workface is blocked`,
        es: `Acelerar prerrequisitos para "${activityName}" — frente de trabajo bloqueado`,
      },
      targetActivityKey: activity.activity_key,
    };
  }

  // 3. not_ready with permit/area → expedite_prerequisite
  if (readiness === "not_ready") {
    const hasPermitOrArea = missingPrerequisites.some(
      (item) => item.item_key === "permit_ready" || item.item_key === "area_released"
    );

    if (hasPermitOrArea) {
      const item = missingPrerequisites.find(
        (item) => item.item_key === "permit_ready" || item.item_key === "area_released"
      )!;
      const labelEn = getI18nValue(item.label_i18n, "en") ?? item.item_key;
      const labelEs = getI18nValue(item.label_i18n, "es") ?? item.item_key;
      return {
        actionType: "expedite_prerequisite",
        description: {
          en: `Expedite ${labelEn} for "${activityName}" — workface not ready`,
          es: `Acelerar ${labelEs} para "${activityName}" — frente de trabajo no listo`,
        },
        targetActivityKey: activity.activity_key,
      };
    }

    // 4. not_ready with alternative ready work → reassign
    if (hasOtherReadyActivities) {
      return {
        actionType: "reassign",
        description: {
          en: `Reassign ${resource.name} to ready work during "${activityName}" wait period`,
          es: `Reasignar ${resource.name} a trabajo listo durante período de espera de "${activityName}"`,
        },
      };
    }
  }

  // 5. at_risk with low days at risk → monitor
  if (readiness === "at_risk" && daysAtRisk < 5) {
    return {
      actionType: "monitor",
      description: {
        en: `Monitor prerequisites for "${activityName}" — workface at risk but delay expected < 5 days`,
        es: `Monitorear prerrequisitos para "${activityName}" — frente de trabajo en riesgo pero demora esperada < 5 días`,
      },
    };
  }

  // 6. Default → stagger
  return {
    actionType: "stagger",
    description: {
      en: `Stagger "${activityName}" start to avoid workface readiness gap for ${resource.name}`,
      es: `Escalonar inicio de "${activityName}" para evitar brecha de preparación de frente de trabajo para ${resource.name}`,
    },
  };
}

// ── computeCrewIdleRisk ──────────────────────────────────────────────────────────

/**
 * Detect crews assigned to work that is not ready. When a crew is assigned
 * to an activity with missing readiness criteria, flag the workface readiness
 * risk — never blaming the crew.
 *
 * This is the main entry point. Call from the server page and pass the
 * result down to components.
 *
 * Pure function: same inputs → same outputs. No database calls.
 */
export function computeCrewIdleRisk(
  resources: LaborResource[],
  activities: ConstructionActivity[],
  dependencies: ActivityDependency[],
  horizon: 3 | 6,
  referenceDate?: Date
): CrewIdleRiskResult {
  const refDate = referenceDate ?? new Date();
  const refISO = formatDateStr(refDate);
  const weeks = generateLookaheadWeeks(refDate, horizon);

  if (weeks.length === 0 || resources.length === 0 || activities.length === 0) {
    return {
      referenceDate: refISO,
      horizonWeeks: horizon,
      entries: [],
      crewsAtRisk: 0,
      totalIdleDays: 0,
      criticalPathIdleDays: 0,
      summary: {
        overallSeverity: "none",
        summarySentence: {
          en: "No labor resources or activities in the lookahead window.",
          es: "Sin recursos laborales ni actividades en la ventana lookahead.",
        },
        topActions: [],
      },
    };
  }

  // Filter activities to the lookahead horizon
  const horizonStart = parseDate(weeks[0].weekStart);
  const horizonEnd = parseDate(weeks[weeks.length - 1].weekEnd);

  const horizonActivities = activities.filter((a) => {
    if (!a.planned_start_date || !a.planned_end_date) return false;
    const start = parseDate(a.planned_start_date);
    const end = parseDate(a.planned_end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    return start <= horizonEnd && end >= horizonStart;
  });

  // Build activity lookup by key
  const activityByKey = new Map(horizonActivities.map((a) => [a.activity_key, a]));

  // Pre-compute readiness for each activity
  const readinessMap = new Map<string, ReadinessLevel>();
  for (const activity of horizonActivities) {
    readinessMap.set(
      activity.activity_key,
      getActivityReadiness(activity, dependencies, activities)
    );
  }

  // Pre-compute workface readiness results
  const workfaceMap = new Map<string, { readinessPct: number; missingPrerequisites: ReadinessChecklistItem[] }>();
  for (const activity of horizonActivities) {
    const result = computeWorkfaceReadiness(activity.activity_key, activity.readiness_checklist);
    workfaceMap.set(activity.activity_key, {
      readinessPct: result.readinessPct,
      missingPrerequisites: result.missingPrerequisites,
    });
  }

  // Map each resource to its assigned activities
  const entries: CrewIdleRiskEntry[] = [];

  for (const resource of resources) {
    // Find all activities this resource is assigned to
    const assignedActivities = horizonActivities.filter((a) =>
      a.assigned_resource_keys?.includes(resource.resource_key)
    );

    if (assignedActivities.length === 0) continue; // Not assigned to any activity in the window

    const constraintType = (resource.constraints as Record<string, unknown>)?.type as string ?? "none";

    // Compute idle risk for each assigned activity
    const activityRisks: AssignedActivityRisk[] = [];

    for (const activity of assignedActivities) {
      const readiness = readinessMap.get(activity.activity_key) ?? "ready";
      const workface = workfaceMap.get(activity.activity_key);
      const readinessPct = workface?.readinessPct ?? 100;
      const missingPrerequisites = workface?.missingPrerequisites ?? [];
      const daysAtRisk = computeDaysAtRisk(activity, readiness, weeks);
      const downstreamKeys = traceSuccessors(activity.id, dependencies, activities);

      // Determine idle risk severity based on readiness
      let idleRiskSeverity: IdleRiskSeverity;
      if (readiness === "ready") {
        idleRiskSeverity = "none";
      } else if (readiness === "blocked") {
        idleRiskSeverity = "critical";
      } else if (readiness === "not_ready") {
        idleRiskSeverity = "high";
      } else {
        // at_risk
        idleRiskSeverity = missingPrerequisites.length >= 3 ? "high" : "medium";
      }

      // Check if there are other ready activities for this resource's trade
      const otherReadyActivities = assignedActivities.filter(
        (other) =>
          other.activity_key !== activity.activity_key &&
          readinessMap.get(other.activity_key) === "ready"
      );

      const recommendedAction = recommendAction(
        activity,
        resource,
        readiness,
        missingPrerequisites,
        daysAtRisk,
        otherReadyActivities.length > 0
      );

      activityRisks.push({
        activityKey: activity.activity_key,
        activityName: activity.name,
        readiness,
        readinessPct,
        missingPrerequisites,
        idleRiskSeverity,
        daysAtRisk,
        downstreamActivityKeys: downstreamKeys,
        recommendedAction,
      });
    }

    // Only include entries where there's actual idle risk
    const riskyActivities = activityRisks.filter((r) => r.idleRiskSeverity !== "none");
    if (riskyActivities.length === 0) continue;

    // Compute idle weeks: weeks where the resource has NO ready activity
    const idleWeeks: string[] = [];
    for (const week of weeks) {
      const hasReadyActivity = assignedActivities.some((a) => {
        const readiness = readinessMap.get(a.activity_key) ?? "ready";
        return (
          readiness === "ready" &&
          dateRangesOverlap(
            a.planned_start_date,
            a.planned_end_date,
            week.weekStart,
            week.weekEnd
          )
        );
      });
      if (!hasReadyActivity) {
        idleWeeks.push(week.weekLabel);
      }
    }

    // Compute worst idle risk
    let worstIdleRisk: IdleRiskSeverity = "none";
    for (const risk of activityRisks) {
      worstIdleRisk = worseIdleRisk(worstIdleRisk, risk.idleRiskSeverity);
    }

    // Total idle days
    const totalIdleDays = activityRisks.reduce((sum, r) => sum + r.daysAtRisk, 0);

    // Downstream impact count (unique downstream activities)
    const allDownstreamKeys = new Set(riskyActivities.flatMap((r) => r.downstreamActivityKeys));

    // Best recommended action for this crew (pick the one with highest severity)
    const bestAction = riskyActivities.length > 0
      ? riskyActivities.reduce((best, r) =>
          IDLE_RISK_SEVERITY[r.idleRiskSeverity] > IDLE_RISK_SEVERITY[best.idleRiskSeverity]
            ? r
            : best
        ).recommendedAction
      : {
          actionType: "monitor" as RecommendedActionType,
          description: { en: "No action needed", es: "Sin acción requerida" },
        };

    entries.push({
      resourceKey: resource.resource_key,
      resourceName: resource.name,
      tradeKey: resource.trade_key,
      resourceType: resource.resource_type,
      constraintType,
      assignedActivities: riskyActivities,
      idleWeeks,
      totalIdleDays,
      worstIdleRisk,
      downstreamImpactCount: allDownstreamKeys.size,
      recommendedAction: bestAction,
    });
  }

  // Sort entries by worst idle risk (descending), then total idle days (descending)
  entries.sort((a, b) => {
    const riskDiff = IDLE_RISK_SEVERITY[b.worstIdleRisk] - IDLE_RISK_SEVERITY[a.worstIdleRisk];
    if (riskDiff !== 0) return riskDiff;
    return b.totalIdleDays - a.totalIdleDays;
  });

  // Compute summary
  const crewsAtRisk = entries.filter((e) => e.worstIdleRisk !== "none").length;
  const totalIdleDays = entries.reduce((sum, e) => sum + e.totalIdleDays, 0);

  // Critical path idle days: sum idle days for activities on the critical path
  let criticalPathIdleDays = 0;
  for (const entry of entries) {
    for (const risk of entry.assignedActivities) {
      const activity = activityByKey.get(risk.activityKey);
      if (activity && isOnCriticalPath(activity.id, dependencies)) {
        criticalPathIdleDays += risk.daysAtRisk;
      }
    }
  }

  // Determine overall severity
  let overallSeverity: IdleRiskSeverity = "none";
  for (const entry of entries) {
    overallSeverity = worseIdleRisk(overallSeverity, entry.worstIdleRisk);
  }

  // Build summary sentence
  let summarySentence: I18nField;
  if (crewsAtRisk === 0) {
    summarySentence = {
      en: "All crews are assigned to ready work — no workface readiness risk detected.",
      es: "Todas las cuadrillas están asignadas a trabajo listo — sin riesgo de preparación de frente de trabajo detectado.",
    };
  } else if (overallSeverity === "critical") {
    summarySentence = {
      en: `${crewsAtRisk} crew${crewsAtRisk > 1 ? "s are" : " is"} assigned to blocked work — workface readiness risk is critical.`,
      es: `${crewsAtRisk} cuadrilla${crewsAtRisk > 1 ? "s están" : " está"} asignada(s) a trabajo bloqueado — el riesgo de preparación de frente de trabajo es crítico.`,
    };
  } else if (overallSeverity === "high") {
    summarySentence = {
      en: `${crewsAtRisk} crew${crewsAtRisk > 1 ? "s face" : " faces"} workface readiness risk — prerequisites incomplete for assigned activities.`,
      es: `${crewsAtRisk} cuadrilla${crewsAtRisk > 1 ? "s enfrentan" : " enfrenta"} riesgo de preparación de frente de trabajo — prerrequisitos incompletos para actividades asignadas.`,
    };
  } else {
    summarySentence = {
      en: `${crewsAtRisk} crew${crewsAtRisk > 1 ? "s have" : " has"} minor workface readiness risk — monitor prerequisites.`,
      es: `${crewsAtRisk} cuadrilla${crewsAtRisk > 1 ? "s tienen" : " tiene"} riesgo menor de preparación de frente de trabajo — monitorear prerrequisitos.`,
    };
  }

  // Collect top recommended actions (deduplicated, up to 5)
  const seenActionTypes = new Set<string>();
  const topActions: RecommendedAction[] = [];
  for (const entry of entries) {
    for (const risk of entry.assignedActivities) {
      const actionKey = `${risk.recommendedAction.actionType}:${risk.activityKey}`;
      if (!seenActionTypes.has(actionKey) && topActions.length < 5) {
        seenActionTypes.add(actionKey);
        topActions.push(risk.recommendedAction);
      }
    }
  }

  return {
    referenceDate: refISO,
    horizonWeeks: horizon,
    entries,
    crewsAtRisk,
    totalIdleDays,
    criticalPathIdleDays,
    summary: {
      overallSeverity,
      summarySentence,
      topActions,
    },
  };
}