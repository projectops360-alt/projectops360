// ============================================================================
// ProjectOps360° — Lookahead Explanation Engine
// ============================================================================
// Deterministic, bilingual (EN/ES) narrative generator for lookahead insights.
// Mirrors the pattern in explanation.ts but is tailored to lookahead-specific
// concepts: readiness, blockers, critical path gaps, and weekly progression.
//
// No AI calls. Same inputs → same outputs.
// ============================================================================

import type { Locale, TradeTaxonomy } from "@/types/database";
import type { ReadinessLevel } from "@/types/database";
import type {
  LookaheadResult,
  LookaheadActivity,
  LookaheadBlocker,
} from "./lookahead";
import { getI18nValue } from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────────────────

export type LookaheadInsightKind =
  | "readiness_at_risk"
  | "readiness_not_ready"
  | "readiness_blocked"
  | "labor_shortage_in_window"
  | "vendor_unconfirmed_in_window"
  | "unmet_dependency_in_window";

export interface LookaheadInsight {
  kind: LookaheadInsightKind;
  values: Record<string, string | number>;
}

export interface LookaheadNarrative {
  overallReadiness: ReadinessLevel;
  summarySentence: string;
  keyInsights: LookaheadInsight[];
  topBlockers: LookaheadBlocker[];
}

// ── Readiness Labels ─────────────────────────────────────────────────────────────

const READINESS_LABELS: Record<ReadinessLevel, Record<Locale, string>> = {
  ready: { en: "Ready", es: "Lista" },
  at_risk: { en: "At Risk", es: "En Riesgo" },
  not_ready: { en: "Not Ready", es: "No Lista" },
  blocked: { en: "Blocked", es: "Bloqueada" },
};

// ── Blocker Labels ───────────────────────────────────────────────────────────────

const BLOCKER_TYPE_LABELS: Record<string, Record<Locale, string>> = {
  unmet_dependency: { en: "Unmet dependency", es: "Dependencia no cumplida" },
  labor_shortage: { en: "Labor shortage", es: "Déficit de mano de obra" },
  vendor_unconfirmed: { en: "Vendor unconfirmed", es: "Proveedor sin confirmar" },
  over_allocated: { en: "Over-allocated resource", es: "Recurso sobre-asignado" },
  blocked_status: { en: "Activity blocked", es: "Actividad bloqueada" },
  checklist_incomplete: { en: "Checklist incomplete", es: "Lista de verificación incompleta" },
};

// ── buildReadinessExplanation ────────────────────────────────────────────────────

/**
 * Generate a human-readable explanation for an activity's readiness level.
 */
export function buildReadinessExplanation(
  activity: LookaheadActivity,
  locale: Locale
): string {
  const label = READINESS_LABELS[activity.readiness][locale];

  if (activity.readiness === "ready") {
    return locale === "en"
      ? `"${activity.name}" is ready to execute. Resources are assigned and no blockers detected.`
      : `"${activity.name}" está lista para ejecutar. Recursos asignados y sin bloqueadores.`;
  }

  const blockers = activity.blockers;
  if (blockers.length === 0) {
    return locale === "en"
      ? `"${activity.name}" is ${label.toLowerCase()}.`
      : `"${activity.name}" está ${label.toLowerCase()}.`;
  }

  const blockerDescriptions = blockers
    .slice(0, 3)
    .map((b) => BLOCKER_TYPE_LABELS[b.blockerType]?.[locale] ?? b.blockerType);

  const blockerText =
    blockers.length <= 3
      ? blockerDescriptions.join(", ")
      : `${blockerDescriptions.join(", ")}, +${blockers.length - 3} more`;

  return locale === "en"
    ? `"${activity.name}" is ${label.toLowerCase()}: ${blockerText}.`
    : `"${activity.name}" está ${label.toLowerCase()}: ${blockerText}.`;
}

// ── buildLookaheadNarrative ──────────────────────────────────────────────────────

/**
 * Generate a full project-level narrative summary for the lookahead window.
 */
export function buildLookaheadNarrative(
  result: LookaheadResult,
  taxonomy: TradeTaxonomy[],
  locale: Locale
): LookaheadNarrative {
  const { allActivities, criticalPathGaps, blockers, overallReadiness, horizonWeeks } = result;

  const tradeLabelMap = new Map<string, string>();
  for (const tax of taxonomy) {
    tradeLabelMap.set(
      tax.trade_key,
      getI18nValue(tax.label_i18n, locale) || tax.trade_key
    );
  }

  // Count by readiness level
  const readyCount = allActivities.filter((a) => a.readiness === "ready").length;
  const atRiskCount = allActivities.filter(
    (a) => a.readiness === "at_risk"
  ).length;
  const notReadyCount = allActivities.filter(
    (a) => a.readiness === "not_ready"
  ).length;
  const blockedCount = allActivities.filter(
    (a) => a.readiness === "blocked"
  ).length;
  const totalCount = allActivities.length;

  // Collect key insights
  const keyInsights: LookaheadInsight[] = [];

  if (atRiskCount > 0) {
    keyInsights.push({
      kind: "readiness_at_risk",
      values: { count: atRiskCount, horizon: horizonWeeks },
    });
  }
  if (notReadyCount > 0) {
    keyInsights.push({
      kind: "readiness_not_ready",
      values: { count: notReadyCount, horizon: horizonWeeks },
    });
  }
  if (blockedCount > 0) {
    keyInsights.push({
      kind: "readiness_blocked",
      values: { count: blockedCount },
    });
  }

  // Labor shortage insights
  const shortageGaps = criticalPathGaps.filter(
    (g) => g.shortageRisk === "high" || g.shortageRisk === "critical"
  );
  if (shortageGaps.length > 0) {
    const mostAffectedTrade =
      shortageGaps.length > 0
        ? tradeLabelMap.get(shortageGaps[0].tradeKey) ?? shortageGaps[0].tradeKey
        : "";
    keyInsights.push({
      kind: "labor_shortage_in_window",
      values: {
        count: shortageGaps.length,
        trade: mostAffectedTrade,
        horizon: horizonWeeks,
      },
    });
  }

  // Vendor unconfirmed insights
  const vendorBlockers = blockers.filter(
    (b) => b.blockerType === "vendor_unconfirmed"
  );
  if (vendorBlockers.length > 0) {
    keyInsights.push({
      kind: "vendor_unconfirmed_in_window",
      values: { count: vendorBlockers.length },
    });
  }

  // Unmet dependency insights
  const depBlockers = blockers.filter(
    (b) => b.blockerType === "unmet_dependency"
  );
  if (depBlockers.length > 0) {
    keyInsights.push({
      kind: "unmet_dependency_in_window",
      values: { count: depBlockers.length },
    });
  }

  // Build summary sentence
  let summarySentence: string;
  if (overallReadiness === "ready") {
    summarySentence =
      locale === "en"
        ? `All ${totalCount} activities in the ${horizonWeeks}-week lookahead window are ready to execute.`
        : `Las ${totalCount} actividades en la ventana lookahead de ${horizonWeeks} semanas están listas para ejecutar.`;
  } else if (overallReadiness === "blocked") {
    summarySentence =
      locale === "en"
        ? `${blockedCount} of ${totalCount} activities are blocked, ${atRiskCount} at risk, and ${notReadyCount} not ready in the next ${horizonWeeks} weeks.`
        : `${blockedCount} de ${totalCount} actividades están bloqueadas, ${atRiskCount} en riesgo y ${notReadyCount} no listas en las próximas ${horizonWeeks} semanas.`;
  } else if (overallReadiness === "not_ready") {
    summarySentence =
      locale === "en"
        ? `${notReadyCount} of ${totalCount} activities are not ready, ${atRiskCount} at risk in the next ${horizonWeeks} weeks.`
        : `${notReadyCount} de ${totalCount} actividades no están listas, ${atRiskCount} en riesgo en las próximas ${horizonWeeks} semanas.`;
  } else {
    summarySentence =
      locale === "en"
        ? `${atRiskCount} of ${totalCount} activities are at risk in the next ${horizonWeeks} weeks. ${readyCount} are ready to proceed.`
        : `${atRiskCount} de ${totalCount} actividades están en riesgo en las próximas ${horizonWeeks} semanas. ${readyCount} están listas para proceder.`;
  }

  // Top blockers (by severity)
  const severityOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const topBlockers = [...blockers]
    .sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0))
    .slice(0, 5);

  return {
    overallReadiness,
    summarySentence,
    keyInsights,
    topBlockers,
  };
}

// ── formatWeekLabel ──────────────────────────────────────────────────────────────

/**
 * Format an ISO week label like "2026-W29" into a more readable form.
 */
export function formatWeekLabel(weekLabel: string, locale: Locale): string {
  // Keep ISO format for now — can be localized later
  return weekLabel;
}

// ── getReadinessLabel ────────────────────────────────────────────────────────────

/**
 * Get the localized label for a readiness level.
 */
export function getReadinessLabel(readiness: ReadinessLevel, locale: Locale): string {
  return READINESS_LABELS[readiness][locale];
}

// ── getBlockerTypeLabel ──────────────────────────────────────────────────────────

/**
 * Get the localized label for a blocker type.
 */
export function getBlockerTypeLabel(blockerType: string, locale: Locale): string {
  return BLOCKER_TYPE_LABELS[blockerType]?.[locale] ?? blockerType;
}