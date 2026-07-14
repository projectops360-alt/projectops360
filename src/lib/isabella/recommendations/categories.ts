// ============================================================================
// ProjectOps360° — Isabella Recommendation · category taxonomy (pure)
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE
//
// Maps a Task 4 root-cause finding (by constraint type + classification) to an
// advisory recommendation category. Unsupported / future constraint types map to
// `null` — NO recommendation is ever fabricated. Also holds each category's base
// impact / urgency / effort profile and bilingual labels. Pure data + predicates.
// ============================================================================

import type { ConstraintType } from "@/lib/isabella/root-cause/types";
import type { RootCauseFinding } from "@/lib/isabella/root-cause/types";
import type {
  RecommendationCategory,
  RecommendationEffort,
  RecommendationImpact,
  RecommendationLanguage,
  RecommendationUrgency,
} from "./types";
import { SUPPORTED_RECOMMENDATION_CATEGORIES } from "./types";

export interface CategoryProfile {
  expectedImpact: RecommendationImpact;
  urgency: RecommendationUrgency;
  effort: RecommendationEffort;
}

export const CATEGORY_PROFILE: Record<RecommendationCategory, CategoryProfile> = {
  resolve_explicit_blocker: { expectedImpact: "unblock_execution", urgency: "now", effort: "medium" },
  assign_owner: { expectedImpact: "improve_accountability", urgency: "today", effort: "low" },
  assign_milestone: { expectedImpact: "increase_clarity", urgency: "this_week", effort: "low" },
  recover_overdue_work: { expectedImpact: "reduce_risk", urgency: "today", effort: "medium" },
  validate_dependency: { expectedImpact: "restore_sequence", urgency: "today", effort: "medium" },
  investigate_evidence_gap: { expectedImpact: "reduce_uncertainty", urgency: "this_week", effort: "low" },
  stabilize_milestone: { expectedImpact: "reduce_risk", urgency: "today", effort: "medium" },
  clarify_scope: { expectedImpact: "increase_clarity", urgency: "this_week", effort: "low" },
  review_process_friction: { expectedImpact: "reduce_uncertainty", urgency: "today", effort: "low" },
  reduce_execution_uncertainty: { expectedImpact: "reduce_uncertainty", urgency: "this_week", effort: "low" },
};

const CATEGORY_LABEL: Record<RecommendationCategory, { en: string; es: string }> = {
  resolve_explicit_blocker: { en: "Resolve explicit blocker", es: "Resolver bloqueo explícito" },
  assign_owner: { en: "Assign owner", es: "Asignar responsable" },
  assign_milestone: { en: "Assign milestone", es: "Asignar hito" },
  recover_overdue_work: { en: "Recover overdue work", es: "Recuperar trabajo vencido" },
  validate_dependency: { en: "Validate dependency", es: "Validar dependencia" },
  investigate_evidence_gap: { en: "Investigate evidence gap", es: "Investigar gap de evidencia" },
  stabilize_milestone: { en: "Stabilize milestone", es: "Estabilizar hito" },
  clarify_scope: { en: "Clarify scope", es: "Aclarar alcance" },
  review_process_friction: { en: "Review process friction", es: "Revisar friccion del proceso" },
  reduce_execution_uncertainty: { en: "Reduce execution uncertainty", es: "Reducir incertidumbre de ejecución" },
};

export function categoryLabel(category: RecommendationCategory, language: RecommendationLanguage): string {
  return CATEGORY_LABEL[category][language === "es" ? "es" : "en"];
}

export function isSupportedRecommendationCategory(category: RecommendationCategory): boolean {
  return SUPPORTED_RECOMMENDATION_CATEGORIES.includes(category);
}

/**
 * Map a root-cause finding to an advisory category. Returns `null` when the
 * constraint has no safe, evidence-backed action today (never fabricated).
 * A `dependency_constraint` maps to `validate_dependency` ONLY when the finding
 * carries real dependency evidence — a synthetic milestone_chain never does.
 */
export function mapFindingToRecommendationCategory(finding: RootCauseFinding): RecommendationCategory | null {
  const type: ConstraintType = finding.constraintType;
  switch (type) {
    case "explicit_blocker":
      return "resolve_explicit_blocker";
    case "ownership_gap":
      return "assign_owner";
    case "milestone_assignment_gap":
      return "assign_milestone";
    case "overdue_constraint":
      return "recover_overdue_work";
    case "dependency_constraint":
      // Only when REAL dependency evidence exists (never synthetic milestone_chain).
      return finding.evidenceRefs.length > 0 ? "validate_dependency" : null;
    case "stalled_progress":
      // A symptom with no evidenced cause → collect evidence, do not prescribe a fix.
      return "reduce_execution_uncertainty";
    case "process_delay":
    case "rework_signal":
    case "bottleneck_signal":
      return "review_process_friction";
    default:
      // sequencing_gap / decision_delay / approval_delay / external_dependency /
      // capacity_signal / evidence_gap → no fabricated action here.
      return null;
  }
}
