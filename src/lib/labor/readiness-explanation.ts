// ============================================================================
// ProjectOps360° — Workface Readiness Explanation Engine
// ============================================================================
// Deterministic, bilingual (EN/ES) explanation generator for activity readiness.
// For each not-ready activity, explains:
//   1. What is missing (which prerequisites)
//   2. Why it matters (impact of missing prerequisites)
//   3. What crew may be affected (assigned resources)
//   4. What downstream work is at risk (successor activities)
//   5. Recommended next action
//
// All descriptions use process language — "workface not ready",
// "prerequisite incomplete" — NEVER blaming the crew.
//
// No AI calls. Same inputs → same outputs.
// ============================================================================

import type {
  ActivityDependency,
  ConstructionActivity,
  I18nField,
  LaborResource,
  Locale,
  LookaheadBlockerType,
  ReadinessChecklistItem,
  ReadinessLevel,
} from "@/types/database";
import { getI18nValue } from "@/types/database";
import type { LookaheadActivity } from "./lookahead";
import type { CrewIdleRiskResult, RecommendedAction } from "./crew-idle-risk";
import { getMissingPrerequisites } from "./workface-readiness";

// ── Exported Types ──────────────────────────────────────────────────────────────

/** Structured explanation for a single activity's readiness status. */
export interface ReadinessExplanation {
  /** Activity key (e.g. "DCL-007"). */
  activityKey: string;
  /** Activity display name (e.g. "CRAH Installation"). */
  activityName: string;
  /** Overall readiness level. */
  readiness: ReadinessLevel;
  /** Readiness percentage (0-100). */
  readinessPct: number;
  /** One-sentence summary of the activity's readiness status. */
  summary: I18nField;
  /** What prerequisites are missing and why they matter. */
  whatIsMissing: I18nField;
  /** Why the missing prerequisites matter — impact on execution. */
  whyItMatters: I18nField;
  /** Which crews are affected by the workface not being ready. */
  crewAffected: I18nField;
  /** What downstream activities are at risk if this activity is delayed. */
  downstreamAtRisk: I18nField;
  /** Recommended action to resolve the readiness gap. */
  recommendedAction: I18nField;
  /** The incomplete required checklist items. */
  missingItems: ReadinessChecklistItem[];
  /** The blocker types affecting this activity. */
  blockerTypes: LookaheadBlockerType[];
}

// ── Internal Helpers ────────────────────────────────────────────────────────────

/** Join a list of strings with commas and "and" for the last item. */
function joinList(items: string[], locale: Locale): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  const connector = locale === "en" ? " and " : " y ";
  if (items.length === 2) return items.join(connector);
  const allButLast = items.slice(0, -1).join(", ");
  return `${allButLast}${connector}${items[items.length - 1]}`;
}

/** Readiness level to severity description. */
const READINESS_IMPACT: Record<ReadinessLevel, I18nField> = {
  ready: {
    en: "This activity is ready to proceed.",
    es: "Esta actividad está lista para proceder.",
  },
  at_risk: {
    en: "Some prerequisites are incomplete, which may delay the start.",
    es: "Algunos prerrequisitos están incompletos, lo que puede demorar el inicio.",
  },
  not_ready: {
    en: "Without these prerequisites, the assigned crew cannot begin work on schedule.",
    es: "Sin estos prerrequisitos, la cuadrilla asignada no puede comenzar el trabajo a tiempo.",
  },
  blocked: {
    en: "This activity cannot proceed until the blockage is resolved.",
    es: "Esta actividad no puede proceder hasta que se resuelva el bloqueo.",
  },
};

/** Trace successor activities via dependency graph (BFS). */
function traceSuccessorNames(
  activityId: string,
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[],
  maxNames: number = 3
): string[] {
  const visited = new Set<string>();
  const queue = [activityId];
  const activityById = new Map(allActivities.map((a) => [a.id, a]));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const successorDeps = dependencies.filter((d) => d.predecessor_id === current);
    for (const dep of successorDeps) {
      if (!visited.has(dep.successor_id)) {
        queue.push(dep.successor_id);
      }
    }
  }

  visited.delete(activityId);
  const names: string[] = [];
  for (const id of visited) {
    const activity = activityById.get(id);
    if (activity) {
      names.push(activity.name);
      if (names.length >= maxNames) break;
    }
  }
  return names;
}

/** Get names of resources assigned to an activity. */
function getAssignedResourceNames(
  assignedResourceKeys: string[],
  resources: LaborResource[],
  maxNames: number = 3
): string[] {
  const resourceMap = new Map(resources.map((r) => [r.resource_key, r.name]));
  return assignedResourceKeys
    .slice(0, maxNames)
    .map((key) => resourceMap.get(key) ?? key);
}

// ── buildReadinessExplanation ──────────────────────────────────────────────────

/**
 * Generate a deterministic, bilingual explanation for why an activity is not ready.
 * Covers: what is missing, why it matters, crew affected, downstream at risk,
 * and recommended action.
 *
 * Pure function: same inputs → same outputs. No AI calls.
 */
export function buildReadinessExplanation(
  activity: LookaheadActivity,
  idleRisk: CrewIdleRiskResult,
  resources: LaborResource[],
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[],
  locale: Locale
): ReadinessExplanation {
  const missingItems = getMissingPrerequisites(activity.readinessChecklist);
  const missingLabels = missingItems.map((item) =>
    getI18nValue(item.label_i18n, locale) ?? item.item_key
  );
  const blockerTypes = activity.blockers.map((b) => b.blockerType);

  // Find assigned resource names
  const assignedNames = getAssignedResourceNames(
    activity.assignedResourceKeys,
    resources
  );
  const requiredCount = activity.requiredCrewCount;

  // Find idle risk data for this activity
  let idleRiskForActivity: {
    worstIdleRisk: string;
    totalDaysAtRisk: number;
    recommendedAction: RecommendedAction | null;
  } | null = null;

  for (const entry of idleRisk.entries) {
    for (const risk of entry.assignedActivities) {
      if (risk.activityKey === activity.activityKey) {
        if (!idleRiskForActivity || risk.idleRiskSeverity === "high" || risk.idleRiskSeverity === "critical") {
          idleRiskForActivity = {
            worstIdleRisk: risk.idleRiskSeverity,
            totalDaysAtRisk: risk.daysAtRisk,
            recommendedAction: risk.recommendedAction,
          };
        }
      }
    }
  }

  // Find downstream successor names
  const activityMatch = allActivities.find((a) => a.activity_key === activity.activityKey);
  const downstreamNames = activityMatch
    ? traceSuccessorNames(activityMatch.id, dependencies, allActivities)
    : [];
  const totalDownstream = downstreamNames.length;

  // ── Summary ──────────────────────────────────────────────────────────────────

  let summary: I18nField;
  if (activity.readiness === "ready") {
    summary = {
      en: `"${activity.name}" is ready to proceed.`,
      es: `"${activity.name}" está lista para proceder.`,
    };
  } else if (missingLabels.length > 0) {
    const missingText = joinList(missingLabels, locale);
    summary = {
      en: `"${activity.name}" is ${activity.readiness === "blocked" ? "blocked" : activity.readiness === "not_ready" ? "not ready" : "at risk"}: ${missingText} ${missingLabels.length === 1 ? "is" : "are"} missing.`,
      es: `"${activity.name}" está ${activity.readiness === "blocked" ? "bloqueada" : activity.readiness === "not_ready" ? "no lista" : "en riesgo"}: falta ${missingText}.`,
    };
  } else {
    summary = {
      en: `"${activity.name}" is ${activity.readiness === "blocked" ? "blocked" : activity.readiness === "not_ready" ? "not ready" : "at risk"}.`,
      es: `"${activity.name}" está ${activity.readiness === "blocked" ? "bloqueada" : activity.readiness === "not_ready" ? "no lista" : "en riesgo"}.`,
    };
  }

  // ── What Is Missing ──────────────────────────────────────────────────────────

  let whatIsMissing: I18nField;
  if (missingLabels.length === 0) {
    whatIsMissing = {
      en: "No specific prerequisites are missing, but other readiness gates are preventing execution.",
      es: "No faltan prerrequisitos específicos, pero otras puertas de preparación impiden la ejecución.",
    };
  } else {
    const missingText = joinList(missingLabels, locale);
    const count = missingLabels.length;
    whatIsMissing = {
      en: `${count === 1 ? "One prerequisite is missing" : `${count} prerequisites are missing`}: ${missingText}.`,
      es: `${count === 1 ? "Un prerrequisito falta" : `${count} prerrequisitos faltan`}: ${missingText}.`,
    };
  }

  // ── Why It Matters ────────────────────────────────────────────────────────────

  const impactBase = READINESS_IMPACT[activity.readiness];
  let whyItMatters: I18nField;

  if (missingLabels.length > 0) {
    // Check for specific high-impact missing items
    const hasPermit = missingItems.some((item) => item.item_key === "permit_ready");
    const hasArea = missingItems.some((item) => item.item_key === "area_released");
    const hasMaterial = missingItems.some((item) => item.item_key === "material_onsite");

    if (hasPermit) {
      whyItMatters = {
        en: `Permit approval is required before work can begin. ${getI18nValue(impactBase, locale)}`,
        es: `Se requiere aprobación del permiso antes de que el trabajo pueda comenzar. ${getI18nValue(impactBase, "es")}`,
      };
    } else if (hasArea) {
      whyItMatters = {
        en: `The work area must be released before crews can mobilize. ${getI18nValue(impactBase, locale)}`,
        es: `El área de trabajo debe ser liberada antes de que las cuadrillas puedan movilizarse. ${getI18nValue(impactBase, "es")}`,
      };
    } else if (hasMaterial) {
      whyItMatters = {
        en: `Material must be onsite before installation can start. ${getI18nValue(impactBase, locale)}`,
        es: `El material debe estar en sitio antes de que la instalación pueda comenzar. ${getI18nValue(impactBase, "es")}`,
      };
    } else {
      whyItMatters = impactBase;
    }
  } else {
    whyItMatters = impactBase;
  }

  // ── Crew Affected ─────────────────────────────────────────────────────────────

  let crewAffected: I18nField;
  if (assignedNames.length === 0) {
    crewAffected = {
      en: "No crews are currently assigned to this activity.",
      es: "No hay cuadrillas asignadas a esta actividad actualmente.",
    };
  } else {
    const names = joinList(assignedNames, locale);
    const crewWord = locale === "en" ? "crew" : "cuadrilla";
    const crewsWord = locale === "en" ? "crews" : "cuadrillas";
    crewAffected = {
      en: `${assignedNames.length} ${assignedNames.length === 1 ? crewWord : crewsWord} assigned: ${names}${requiredCount > 0 ? ` (${assignedNames.length} of ${requiredCount} required)` : ""}.`,
      es: `${assignedNames.length} ${assignedNames.length === 1 ? crewWord : crewsWord} asignada${assignedNames.length > 1 ? "s" : ""}: ${names}${requiredCount > 0 ? ` (${assignedNames.length} de ${requiredCount} requerida${requiredCount > 1 ? "s" : ""})` : ""}.`,
    };
  }

  // ── Downstream At Risk ────────────────────────────────────────────────────────

  let downstreamAtRisk: I18nField;
  if (totalDownstream === 0) {
    downstreamAtRisk = {
      en: "No downstream activities are directly affected.",
      es: "Ninguna actividad aguas abajo está directamente afectada.",
    };
  } else if (totalDownstream <= 3) {
    const names = joinList(downstreamNames, locale);
    downstreamAtRisk = {
      en: `${totalDownstream} downstream ${totalDownstream === 1 ? "activity is" : "activities are"} at risk: ${names}.`,
      es: `${totalDownstream} actividad${totalDownstream === 1 ? "" : "es"} aguas abajo en riesgo: ${names}.`,
    };
  } else {
    const names = joinList(downstreamNames.slice(0, 3), locale);
    downstreamAtRisk = {
      en: `${totalDownstream} downstream activities are at risk, including: ${names}, and ${totalDownstream - 3} more.`,
      es: `${totalDownstream} actividades aguas abajo están en riesgo, incluyendo: ${names}, y ${totalDownstream - 3} más.`,
    };
  }

  // ── Recommended Action ────────────────────────────────────────────────────────

  let recommendedAction: I18nField;
  if (idleRiskForActivity?.recommendedAction) {
    // Use the action from the idle risk computation (already bilingual)
    recommendedAction = idleRiskForActivity.recommendedAction.description;
  } else if (activity.readiness === "blocked") {
    recommendedAction = {
      en: `Resolve blockers for "${activity.name}" before scheduling work.`,
      es: `Resolver bloqueadores para "${activity.name}" antes de programar el trabajo.`,
    };
  } else if (activity.readiness === "not_ready" && missingLabels.length > 0) {
    const firstMissing = missingLabels[0];
    recommendedAction = {
      en: `Expedite ${firstMissing.toLowerCase()} for "${activity.name}" — workface is not ready.`,
      es: `Acelerar ${firstMissing.toLowerCase()} para "${activity.name}" — frente de trabajo no listo.`,
    };
  } else if (activity.readiness === "at_risk") {
    recommendedAction = {
      en: `Monitor prerequisites for "${activity.name}" — workface is at risk but may proceed soon.`,
      es: `Monitorear prerrequisitos para "${activity.name}" — frente de trabajo en riesgo pero puede proceder pronto.`,
    };
  } else {
    recommendedAction = {
      en: "No action required — this activity is ready to proceed.",
      es: "Sin acción requerida — esta actividad está lista para proceder.",
    };
  }

  return {
    activityKey: activity.activityKey,
    activityName: activity.name,
    readiness: activity.readiness,
    readinessPct: activity.readinessPct,
    summary,
    whatIsMissing,
    whyItMatters,
    crewAffected,
    downstreamAtRisk,
    recommendedAction,
    missingItems,
    blockerTypes,
  };
}

// ── buildReadinessExplanationForActivity ────────────────────────────────────────

/**
 * Convenience function: build explanation for a single activity by key.
 * Finds the activity in the lookahead result and builds the explanation.
 * Returns null if the activity is ready (no explanation needed).
 */
export function buildReadinessExplanationForActivity(
  activityKey: string,
  lookaheadActivities: LookaheadActivity[],
  idleRisk: CrewIdleRiskResult,
  resources: LaborResource[],
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[],
  locale: Locale
): ReadinessExplanation | null {
  const activity = lookaheadActivities.find((a) => a.activityKey === activityKey);
  if (!activity || activity.readiness === "ready") return null;

  return buildReadinessExplanation(
    activity,
    idleRisk,
    resources,
    dependencies,
    allActivities,
    locale
  );
}

// ── buildShortExplanation ───────────────────────────────────────────────────────

/**
 * Generate a short one-line explanation suitable for graph node tooltips
 * and compact display. Bilingual.
 */
export function buildShortExplanation(
  activity: LookaheadActivity,
  locale: Locale
): I18nField {
  if (activity.readiness === "ready") {
    return {
      en: "Ready to proceed",
      es: "Lista para proceder",
    };
  }

  const missingItems = getMissingPrerequisites(activity.readinessChecklist);
  const missingLabels = missingItems.map((item) =>
    getI18nValue(item.label_i18n, locale) ?? item.item_key
  );

  if (missingLabels.length === 0) {
    return {
      en: `${activity.readiness === "blocked" ? "Blocked" : "Not ready"}`,
      es: `${activity.readiness === "blocked" ? "Bloqueada" : "No lista"}`,
    };
  }

  const missingText = joinList(missingLabels.slice(0, 2), locale);
  const more = missingLabels.length > 2 ? ` +${missingLabels.length - 2}` : "";

  return {
    en: `${activity.readiness === "blocked" ? "Blocked" : "Not ready"}: ${missingText}${more}`,
    es: `${activity.readiness === "blocked" ? "Bloqueada" : "No lista"}: ${missingText}${more}`,
  };
}