// ============================================================================
// ProjectOps360° — Crew Idle Risk Explanation Engine
// ============================================================================
// Deterministic, bilingual (EN/ES) narrative generator for crew idle risk
// insights. Produces human-readable explanations and recommended actions,
// all framed as workface readiness risk — never blaming the crew.
//
// No AI calls. Same inputs → same outputs.
// ============================================================================

import type { Locale, TradeTaxonomy } from "@/types/database";
import { getI18nValue } from "@/types/database";
import type { CrewIdleRiskResult, CrewIdleRiskEntry, AssignedActivityRisk } from "./crew-idle-risk";

// ── Idle Risk Labels ────────────────────────────────────────────────────────────

const IDLE_RISK_LABELS: Record<string, Record<Locale, string>> = {
  none: { en: "No Risk", es: "Sin Riesgo" },
  low: { en: "Low Risk", es: "Riesgo Bajo" },
  medium: { en: "Medium Risk", es: "Riesgo Medio" },
  high: { en: "High Risk", es: "Riesgo Alto" },
  critical: { en: "Critical Risk", es: "Riesgo Crítico" },
};

const ACTION_TYPE_LABELS: Record<string, Record<Locale, string>> = {
  reassign: { en: "Reassign", es: "Reasignar" },
  stagger: { en: "Stagger", es: "Escalonar" },
  expedite_prerequisite: { en: "Expedite Prerequisite", es: "Acelerar Prerrequisito" },
  confirm_vendor: { en: "Confirm Vendor", es: "Confirmar Proveedor" },
  monitor: { en: "Monitor", es: "Monitorear" },
};

const RESOURCE_TYPE_LABELS: Record<string, Record<Locale, string>> = {
  crew: { en: "Crew", es: "Cuadrilla" },
  specialist: { en: "Specialist", es: "Especialista" },
  inspector: { en: "Inspector", es: "Inspector" },
  vendor: { en: "Vendor", es: "Proveedor" },
  witness: { en: "Witness", es: "Testigo" },
};

const CONSTRAINT_TYPE_LABELS: Record<string, Record<Locale, string>> = {
  none: { en: "No constraint", es: "Sin restricción" },
  partial_availability: { en: "Partial availability", es: "Disponibilidad parcial" },
  over_allocated: { en: "Over-allocated", es: "Sobre-asignado" },
  vendor_unconfirmed: { en: "Vendor unconfirmed", es: "Proveedor sin confirmar" },
  shortage: { en: "Shortage", es: "Déficit" },
};

// ── getLabel helpers ────────────────────────────────────────────────────────────

export function getIdleRiskLabel(severity: string, locale: Locale): string {
  return IDLE_RISK_LABELS[severity]?.[locale] ?? severity;
}

export function getActionTypeLabel(actionType: string, locale: Locale): string {
  return ACTION_TYPE_LABELS[actionType]?.[locale] ?? actionType;
}

export function getResourceTypeLabel(resourceType: string, locale: Locale): string {
  return RESOURCE_TYPE_LABELS[resourceType]?.[locale] ?? resourceType;
}

export function getConstraintTypeLabel(constraintType: string, locale: Locale): string {
  return CONSTRAINT_TYPE_LABELS[constraintType]?.[locale] ?? constraintType;
}

// ── buildIdleRiskSummary ──────────────────────────────────────────────────────────

/**
 * Build a bilingual narrative summary for the idle risk result.
 * Used by the UI to display summary cards and narrative text.
 */
export function buildIdleRiskSummary(
  result: CrewIdleRiskResult,
  taxonomy: TradeTaxonomy[],
  locale: Locale
): IdleRiskSummaryUI {
  const { entries, crewsAtRisk, totalIdleDays, criticalPathIdleDays, summary } = result;

  // Build trade label map
  const tradeLabelMap = new Map<string, string>();
  for (const tax of taxonomy) {
    tradeLabelMap.set(tax.trade_key, getI18nValue(tax.label_i18n, locale) ?? tax.trade_key);
  }

  // Build per-entry explanations
  const entryExplanations = entries.map((entry) =>
    buildCrewIdleRiskExplanation(entry, tradeLabelMap, locale)
  );

  // Build severity breakdown
  const severityCounts = {
    critical: entries.filter((e) => e.worstIdleRisk === "critical").length,
    high: entries.filter((e) => e.worstIdleRisk === "high").length,
    medium: entries.filter((e) => e.worstIdleRisk === "medium").length,
    low: entries.filter((e) => e.worstIdleRisk === "low").length,
    none: entries.filter((e) => e.worstIdleRisk === "none").length,
  };

  return {
    overallSeverity: summary.overallSeverity,
    summarySentence: getI18nValue(summary.summarySentence, locale),
    crewsAtRisk,
    totalIdleDays,
    criticalPathIdleDays,
    severityCounts,
    entryExplanations,
    topActions: summary.topActions.map((action) => ({
      actionType: action.actionType,
      label: getActionTypeLabel(action.actionType, locale),
      description: getI18nValue(action.description, locale),
    })),
  };
}

// ── buildCrewIdleRiskExplanation ─────────────────────────────────────────────────

/**
 * Build a human-readable explanation for a single crew's idle risk.
 * Uses process framing: "workface not ready", NOT "crew idle".
 */
function buildCrewIdleRiskExplanation(
  entry: CrewIdleRiskEntry,
  tradeLabelMap: Map<string, string>,
  locale: Locale
): CrewIdleRiskExplanation {
  const tradeLabel = tradeLabelMap.get(entry.tradeKey) ?? entry.tradeKey;
  const resourceTypeLabel = getResourceTypeLabel(entry.resourceType, locale);
  const severityLabel = getIdleRiskLabel(entry.worstIdleRisk, locale);

  // Build explanation sentence
  let explanation: string;
  const activityCount = entry.assignedActivities.length;
  const activityNames = entry.assignedActivities
    .slice(0, 3)
    .map((a) => `"${a.activityName}"`)
    .join(", ");
  const moreCount = activityCount > 3 ? activityCount - 3 : 0;

  if (entry.worstIdleRisk === "none") {
    explanation = locale === "en"
      ? `${entry.resourceName} (${resourceTypeLabel}, ${tradeLabel}) — all assigned work is ready.`
      : `${entry.resourceName} (${resourceTypeLabel}, ${tradeLabel}) — todo el trabajo asignado está listo.`;
  } else if (entry.worstIdleRisk === "critical") {
    explanation = locale === "en"
      ? `${entry.resourceName} (${resourceTypeLabel}, ${tradeLabel}) faces critical workface readiness risk: ${activityNames}${moreCount > 0 ? ` +${moreCount} more` : ""} — workface is blocked or prerequisites are incomplete.`
      : `${entry.resourceName} (${resourceTypeLabel}, ${tradeLabel}) enfrenta riesgo crítico de preparación de frente de trabajo: ${activityNames}${moreCount > 0 ? ` +${moreCount} más` : ""} — frente de trabajo bloqueado o prerrequisitos incompletos.`;
  } else if (entry.worstIdleRisk === "high") {
    explanation = locale === "en"
      ? `${entry.resourceName} (${resourceTypeLabel}, ${tradeLabel}) faces high workface readiness risk on ${activityNames}${moreCount > 0 ? ` +${moreCount} more` : ""}.`
      : `${entry.resourceName} (${resourceTypeLabel}, ${tradeLabel}) enfrenta riesgo alto de preparación de frente de trabajo en ${activityNames}${moreCount > 0 ? ` +${moreCount} más` : ""}.`;
  } else {
    explanation = locale === "en"
      ? `${entry.resourceName} (${resourceTypeLabel}, ${tradeLabel}) faces ${severityLabel.toLowerCase()} workface readiness risk on ${activityNames}${moreCount > 0 ? ` +${moreCount} more` : ""}.`
      : `${entry.resourceName} (${resourceTypeLabel}, ${tradeLabel}) enfrenta riesgo ${severityLabel.toLowerCase()} de preparación de frente de trabajo en ${activityNames}${moreCount > 0 ? ` +${moreCount} más` : ""}.`;
  }

  return {
    resourceKey: entry.resourceKey,
    resourceName: entry.resourceName,
    tradeLabel,
    resourceTypeLabel,
    severityLabel,
    explanation,
    idleWeeks: entry.idleWeeks,
    totalIdleDays: entry.totalIdleDays,
    downstreamImpactCount: entry.downstreamImpactCount,
    recommendedAction: {
      actionType: entry.recommendedAction.actionType,
      label: getActionTypeLabel(entry.recommendedAction.actionType, locale),
      description: getI18nValue(entry.recommendedAction.description, locale),
    },
  };
}

// ── UI Types ─────────────────────────────────────────────────────────────────────

export interface IdleRiskSummaryUI {
  overallSeverity: string;
  summarySentence: string;
  crewsAtRisk: number;
  totalIdleDays: number;
  criticalPathIdleDays: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  entryExplanations: CrewIdleRiskExplanation[];
  topActions: {
    actionType: string;
    label: string;
    description: string;
  }[];
}

export interface CrewIdleRiskExplanation {
  resourceKey: string;
  resourceName: string;
  tradeLabel: string;
  resourceTypeLabel: string;
  severityLabel: string;
  explanation: string;
  idleWeeks: string[];
  totalIdleDays: number;
  downstreamImpactCount: number;
  recommendedAction: {
    actionType: string;
    label: string;
    description: string;
  };
}