// ============================================================================
// ProjectOps360° — Workface Readiness Checklist Model
// ============================================================================
// Pure functions that compute workface readiness for data center construction
// activities. Each activity supports 9 readiness criteria:
//   - RFI answered
//   - Submittal approved
//   - Drawing current
//   - Material onsite
//   - Area released
//   - Safety/permit ready
//   - Predecessor complete
//   - QA prerequisite complete
//   - Crew assigned
//
// Returns readiness percentage and list of missing prerequisites.
//
// No database calls — these operate on already-fetched data.
// Deterministic: same inputs → same outputs. No AI calls.
// ============================================================================

import type {
  ReadinessCriterion,
  ReadinessChecklistItem,
  ReadinessCriterionCategory,
  I18nField,
  Locale,
  LookaheadBlockerType,
} from "@/types/database";
import { getI18nValue } from "@/types/database";

// ── Criterion Definitions ───────────────────────────────────────────────────────

/** Category and bilingual label for each readiness criterion. */
export const READINESS_CRITERIA: Record<
  ReadinessCriterion,
  { category: ReadinessCriterionCategory; label_i18n: I18nField; defaultRequired: boolean }
> = {
  rfi_answered: {
    category: "prerequisite",
    label_i18n: { en: "RFI Answered", es: "RFI Respondida" },
    defaultRequired: true,
  },
  submittal_approved: {
    category: "prerequisite",
    label_i18n: { en: "Submittal Approved", es: "Submittal Aprobado" },
    defaultRequired: true,
  },
  drawing_current: {
    category: "prerequisite",
    label_i18n: { en: "Drawing Current", es: "Plano Vigente" },
    defaultRequired: true,
  },
  material_onsite: {
    category: "prerequisite",
    label_i18n: { en: "Material Onsite", es: "Material en Sitio" },
    defaultRequired: true,
  },
  area_released: {
    category: "prerequisite",
    label_i18n: { en: "Area Released", es: "Área Liberada" },
    defaultRequired: true,
  },
  permit_ready: {
    category: "prerequisite",
    label_i18n: { en: "Safety/Permit Ready", es: "Seguridad/Permiso Listo" },
    defaultRequired: true,
  },
  predecessor_complete: {
    category: "prerequisite",
    label_i18n: { en: "Predecessor Complete", es: "Predecesor Completo" },
    defaultRequired: true,
  },
  qa_prerequisite: {
    category: "prerequisite",
    label_i18n: { en: "QA Prerequisite Complete", es: "Requisito QA Completo" },
    defaultRequired: false,
  },
  crew_assigned: {
    category: "resource",
    label_i18n: { en: "Crew Assigned", es: "Cuadrilla Asignada" },
    defaultRequired: true,
  },
};

/** All readiness criteria in canonical order. */
export const ALL_CRITERIA: ReadinessCriterion[] = [
  "rfi_answered",
  "submittal_approved",
  "drawing_current",
  "material_onsite",
  "area_released",
  "permit_ready",
  "predecessor_complete",
  "qa_prerequisite",
  "crew_assigned",
];

/** Get the category for a criterion. */
export function getCriterionCategory(
  criterion: ReadinessCriterion
): ReadinessCriterionCategory {
  return READINESS_CRITERIA[criterion].category;
}

/** Get the localized label for a criterion. */
export function getCriterionLabel(
  criterion: ReadinessCriterion,
  locale: Locale
): string {
  return getI18nValue(READINESS_CRITERIA[criterion].label_i18n, locale);
}

// ── Output Types ─────────────────────────────────────────────────────────────────

/** Result of workface readiness computation for a single activity. */
export interface WorkfaceReadinessResult {
  /** The activity key this result is for. */
  activityKey: string;
  /** The checklist items with their current status. */
  checklist: ReadinessChecklistItem[];
  /** Percentage of required items that are completed (0-100). */
  readinessPct: number;
  /** Number of completed required items. */
  completedRequired: number;
  /** Total number of required items. */
  totalRequired: number;
  /** Number of completed items (including non-required). */
  completedTotal: number;
  /** Total number of items (including non-required). */
  totalItems: number;
  /** List of required items that are NOT completed. */
  missingPrerequisites: ReadinessChecklistItem[];
  /** Whether the activity is fully ready (all required items complete). */
  isReady: boolean;
}

// ── Parse Checklist ──────────────────────────────────────────────────────────────

/**
 * Safely parse a readiness checklist from untyped JSONB data.
 * Invalid entries are silently skipped (defensive against malformed data).
 * If the input is not an array, returns the default checklist.
 */
export function parseReadinessChecklist(
  raw: unknown
): ReadinessChecklistItem[] {
  if (!Array.isArray(raw)) return getDefaultChecklist();

  const result: ReadinessChecklistItem[] = [];
  const validKeys = new Set(ALL_CRITERIA);

  for (const entry of raw) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.item_key === "string" &&
      validKeys.has(entry.item_key as ReadinessCriterion) &&
      typeof entry.required === "boolean" &&
      typeof entry.completed === "boolean"
    ) {
      result.push({
        item_key: entry.item_key as ReadinessCriterion,
        label_i18n: entry.label_i18n ?? READINESS_CRITERIA[entry.item_key as ReadinessCriterion]?.label_i18n ?? { en: entry.item_key, es: entry.item_key },
        required: entry.required,
        completed: entry.completed,
        completed_at: typeof entry.completed_at === "string" ? entry.completed_at : null,
        notes: typeof entry.notes === "string" ? entry.notes : "",
      });
    }
  }

  return result.length > 0 ? result : getDefaultChecklist();
}

// ── getDefaultChecklist ──────────────────────────────────────────────────────────

/**
 * Generate a default readiness checklist with all 9 criteria,
 * all marked as not completed, using default required settings.
 */
export function getDefaultChecklist(): ReadinessChecklistItem[] {
  return ALL_CRITERIA.map((criterion) => ({
    item_key: criterion,
    label_i18n: READINESS_CRITERIA[criterion].label_i18n,
    required: READINESS_CRITERIA[criterion].defaultRequired,
    completed: false,
    completed_at: null,
    notes: "",
  }));
}

// ── computeWorkfaceReadiness ─────────────────────────────────────────────────────

/**
 * Compute workface readiness for a single activity.
 * Returns the readiness percentage, missing prerequisites, and full checklist status.
 *
 * Pure function: same inputs → same outputs. No database calls.
 */
export function computeWorkfaceReadiness(
  activityKey: string,
  rawChecklist: unknown
): WorkfaceReadinessResult {
  const checklist = parseReadinessChecklist(rawChecklist);

  const requiredItems = checklist.filter((item) => item.required);
  const completedRequired = requiredItems.filter((item) => item.completed).length;
  const totalRequired = requiredItems.length;

  const completedTotal = checklist.filter((item) => item.completed).length;
  const totalItems = checklist.length;

  const readinessPct =
    totalRequired > 0
      ? Math.round((completedRequired / totalRequired) * 100)
      : 100; // If no required items, consider it 100% ready

  const missingPrerequisites = requiredItems.filter((item) => !item.completed);

  return {
    activityKey,
    checklist,
    readinessPct,
    completedRequired,
    totalRequired,
    completedTotal,
    totalItems,
    missingPrerequisites,
    isReady: missingPrerequisites.length === 0,
  };
}

// ── computeReadinessPercentage ──────────────────────────────────────────────────

/**
 * Quick computation of readiness percentage from a raw checklist.
 * Returns 0-100 based on completed required items / total required items.
 */
export function computeReadinessPercentage(rawChecklist: unknown): number {
  const checklist = parseReadinessChecklist(rawChecklist);
  const requiredItems = checklist.filter((item) => item.required);
  const completedRequired = requiredItems.filter((item) => item.completed).length;
  const totalRequired = requiredItems.length;

  return totalRequired > 0
    ? Math.round((completedRequired / totalRequired) * 100)
    : 100;
}

// ── getMissingPrerequisites ──────────────────────────────────────────────────────

/**
 * Get the list of required checklist items that are NOT completed.
 * Returns an empty array if all required items are completed.
 */
export function getMissingPrerequisites(
  rawChecklist: unknown
): ReadinessChecklistItem[] {
  const checklist = parseReadinessChecklist(rawChecklist);
  return checklist.filter((item) => item.required && !item.completed);
}

// ── assessChecklistReadiness ─────────────────────────────────────────────────────

/**
 * Assess how the checklist status affects the overall readiness level.
 * This is the 5th gate for `assessActivityReadiness` in lookahead.ts.
 *
 * Returns a ReadinessLevel downgrade based on how many required items are incomplete:
 * - 0 incomplete required items → no downgrade (returns "ready")
 * - 1-2 incomplete required items → "at_risk" (but "crew_assigned" incomplete alone → "at_risk")
 * - ≥3 incomplete required items → "not_ready"
 * - "permit_ready" or "crew_assigned" incomplete → at minimum "at_risk"
 *
 * The caller should use `worseReadiness()` to combine this with other readiness factors.
 */
export function assessChecklistReadiness(
  rawChecklist: unknown
): "ready" | "at_risk" | "not_ready" {
  const checklist = parseReadinessChecklist(rawChecklist);
  const missingRequired = checklist.filter((item) => item.required && !item.completed);
  const incompleteCount = missingRequired.length;

  // All required items complete
  if (incompleteCount === 0) return "ready";

  // Safety/permit or crew assignment are essential — at minimum at_risk
  const permitMissing = missingRequired.some((item) => item.item_key === "permit_ready");
  const crewMissing = missingRequired.some((item) => item.item_key === "crew_assigned");

  // 3+ missing required items → not_ready
  if (incompleteCount >= 3) return "not_ready";

  // 1-2 missing required items → at_risk
  // (but already covered: permit and crew missing flags are implicit in the count)
  return "at_risk";
}

// ── generateChecklistBlockers ────────────────────────────────────────────────────

/**
 * Generate blocker entries for each incomplete required checklist item.
 * Used by `detectBlockers()` in lookahead.ts.
 */
export function generateChecklistBlockers(
  activityKey: string,
  activityName: string,
  rawChecklist: unknown,
  locale: Locale
): Array<{
  activityKey: string;
  blockerType: LookaheadBlockerType;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  sourceId: string | null;
}> {
  const checklist = parseReadinessChecklist(rawChecklist);
  const missingRequired = checklist.filter((item) => item.required && !item.completed);

  return missingRequired.map((item) => {
    const label = getI18nValue(item.label_i18n, locale) ?? item.item_key;

    // Safety/permit and crew assignment are high severity blockers
    const isHighSeverity =
      item.item_key === "permit_ready" || item.item_key === "crew_assigned" || item.item_key === "predecessor_complete";

    return {
      activityKey,
      blockerType: "checklist_incomplete" as const,
      description:
        locale === "en"
          ? `"${activityName}" missing: ${label}`
          : `"${activityName}" falta: ${label}`,
      severity: isHighSeverity ? "high" : "medium",
      sourceId: null,
    };
  });
}