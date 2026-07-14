// ============================================================================
// ProjectOps360° — Isabella Root Cause · constraint taxonomy (pure)
// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE
//
// The constraint vocabulary + which categories the available evidence can
// support today. Unsupported categories are represented as evidence gaps —
// never fabricated. Pure data + predicates.
// ============================================================================

import type { ConstraintType, RootCauseLanguage } from "./types";
import { SUPPORTED_CONSTRAINT_TYPES } from "./types";

const LABELS: Record<ConstraintType, { en: string; es: string }> = {
  explicit_blocker: { en: "Explicit blocker", es: "Bloqueo explícito" },
  dependency_constraint: { en: "Dependency constraint", es: "Restricción de dependencia" },
  ownership_gap: { en: "Ownership gap", es: "Brecha de ownership" },
  milestone_assignment_gap: { en: "Milestone assignment gap", es: "Brecha de asignación de hito" },
  sequencing_gap: { en: "Sequencing gap", es: "Brecha de secuencia" },
  overdue_constraint: { en: "Overdue constraint", es: "Restricción por vencimiento" },
  stalled_progress: { en: "Stalled progress", es: "Avance detenido" },
  decision_delay: { en: "Decision delay", es: "Retraso de decisión" },
  approval_delay: { en: "Approval delay", es: "Retraso de aprobación" },
  external_dependency: { en: "External dependency", es: "Dependencia externa" },
  capacity_signal: { en: "Capacity signal", es: "Señal de capacidad" },
  process_delay: { en: "Process delay", es: "Retraso de proceso" },
  rework_signal: { en: "Rework signal", es: "Señal de retrabajo" },
  bottleneck_signal: { en: "Bottleneck candidate", es: "Candidato a cuello de botella" },
  evidence_gap: { en: "Evidence gap", es: "Gap de evidencia" },
};

export function constraintLabel(type: ConstraintType, language: RootCauseLanguage): string {
  return LABELS[type][language === "es" ? "es" : "en"];
}

/** Whether the available evidence can support this constraint today. */
export function isSupportedConstraint(type: ConstraintType): boolean {
  return SUPPORTED_CONSTRAINT_TYPES.includes(type);
}
