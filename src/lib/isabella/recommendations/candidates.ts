// ============================================================================
// ProjectOps360° — Isabella Recommendation · candidate generation (pure)
// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE
//
// Turns Task 4 findings + investigation gaps into advisory recommendation
// candidates. EVERY candidate traces back to a finding / evidence chain / gap —
// no generic advice, nothing fabricated. Candidates whose finding is NOT allowed
// by `recommendationHandoffHints` are skipped (the hints are consumed here).
// Pure.
// ============================================================================

import type { IsabellaRootCauseAnalysis, RootCauseFinding } from "@/lib/isabella/root-cause/types";
import type { IsabellaDailyProcessDiagnosis } from "@/lib/isabella/daily-diagnosis";
import { CATEGORY_PROFILE, mapFindingToRecommendationCategory } from "./categories";
import { derivePriority } from "./scoring";
import type { RecommendationCandidate, RecommendationLanguage } from "./types";

type CandidateWithSeverity = RecommendationCandidate & { severity: string };

function tt(es: boolean, en: string, esT: string): string {
  return es ? esT : en;
}

const RATIONALE: Record<string, { en: string; es: string }> = {
  review_process_friction: { en: "the Process Mining Layer found evidenced delay, rework, or bottleneck friction that still needs human validation", es: "la capa de Process Mining detecto friccion de retraso, retrabajo o cuello de botella que aun requiere validacion humana" },
  resolve_explicit_blocker: { en: "an explicit blocker is recorded on the affected work", es: "hay un bloqueo explícito registrado en el trabajo afectado" },
  assign_owner: { en: "the analysis found an ownership gap on active tasks", es: "el análisis detectó una brecha de responsable en tareas activas" },
  assign_milestone: { en: "tasks sit outside the milestone/execution structure", es: "hay tareas fuera de la estructura de hitos/ejecución" },
  recover_overdue_work: { en: "overdue work was detected and needs validation", es: "se detectó trabajo vencido que requiere validación" },
  validate_dependency: { en: "a real dependency constraint was evidenced", es: "se evidenció una restricción de dependencia real" },
  reduce_execution_uncertainty: { en: "work is not progressing but no cause is evidenced yet", es: "el trabajo no avanza pero aún no hay una causa evidenciada" },
  investigate_evidence_gap: { en: "a required evidence source is unavailable", es: "una fuente de evidencia requerida no está disponible" },
  stabilize_milestone: { en: "several attention signals converge on the current scope", es: "varias señales de atención convergen en el alcance actual" },
};

const OUTCOME: Record<string, { en: string; es: string }> = {
  review_process_friction: { en: "Expected impact: confirm the affected flow and evidence before selecting a corrective action.", es: "Impacto esperado: confirmar el flujo afectado y su evidencia antes de elegir una accion correctiva." },
  resolve_explicit_blocker: { en: "Expected impact: unblock execution once the impediment is cleared.", es: "Impacto esperado: desbloquear la ejecución al resolver el impedimento." },
  assign_owner: { en: "Expected impact: improve accountability so the work can move.", es: "Impacto esperado: mejorar la accountability para que el trabajo avance." },
  assign_milestone: { en: "Expected impact: increase clarity on where the work belongs.", es: "Impacto esperado: aumentar la claridad sobre dónde pertenece el trabajo." },
  recover_overdue_work: { en: "Expected impact: reduce schedule risk after confirming status/dates.", es: "Impacto esperado: reducir el riesgo de cronograma tras confirmar estado/fechas." },
  validate_dependency: { en: "Expected impact: restore the correct execution sequence.", es: "Impacto esperado: restaurar la secuencia de ejecución correcta." },
  reduce_execution_uncertainty: { en: "Expected impact: reduce uncertainty before planning a fix.", es: "Impacto esperado: reducir la incertidumbre antes de planear una solución." },
  investigate_evidence_gap: { en: "Expected impact: reduce uncertainty by confirming the missing source.", es: "Impacto esperado: reducir la incertidumbre confirmando la fuente faltante." },
  stabilize_milestone: { en: "Expected impact: reduce risk by focusing on the most-affected scope.", es: "Impacto esperado: reducir el riesgo enfocando el alcance más afectado." },
};

const VERB: Record<string, { en: string; es: string }> = {
  review_process_friction: { en: "Review the evidenced process friction for", es: "Revisar la friccion de proceso evidenciada de" },
  resolve_explicit_blocker: { en: "Review and resolve the active blocker on", es: "Revisar y resolver el bloqueo activo en" },
  assign_owner: { en: "Assign or confirm an accountable owner for", es: "Asignar o confirmar un responsable para" },
  assign_milestone: { en: "Attach to the correct milestone or confirm out-of-scope for", es: "Asociar al hito correcto o confirmar fuera de alcance para" },
  recover_overdue_work: { en: "Review overdue status/dates for", es: "Revisar estado/fechas de vencimiento de" },
  validate_dependency: { en: "Validate the predecessor dependency for", es: "Validar la dependencia predecesora de" },
  reduce_execution_uncertainty: { en: "Collect missing execution evidence for", es: "Recolectar evidencia de ejecución faltante de" },
  stabilize_milestone: { en: "Prioritize review of", es: "Priorizar la revisión de" },
};

function findingCandidate(finding: RootCauseFinding, language: RecommendationLanguage): CandidateWithSeverity | null {
  const category = mapFindingToRecommendationCategory(finding);
  if (!category) return null;
  const es = language === "es";
  const profile = CATEGORY_PROFILE[category];
  const count = finding.affectedEntities.length;
  const example = finding.affectedEntities[0]?.title;
  const subject = count > 1
    ? tt(es, `${count} tasks`, `${count} tareas`)
    : example
      ? `"${example}"`
      : tt(es, "the affected work", "el trabajo afectado");
  const title = `${VERB[category][es ? "es" : "en"]} ${subject}`;

  return {
    dedupeKey: `${category}`,
    category,
    title,
    rationale: tt(es, `Why this matters: ${RATIONALE[category].en}.`, `Por qué importa: ${RATIONALE[category].es}.`),
    expectedOutcome: OUTCOME[category][es ? "es" : "en"],
    expectedImpact: profile.expectedImpact,
    priority: derivePriority(finding),
    urgency: profile.urgency,
    effort: profile.effort,
    confidence: finding.confidence,
    affectedEntities: finding.affectedEntities.slice(0, 6),
    sourceFindingIds: [finding.id],
    sourceConstraintIds: [`c-${finding.constraintType}`],
    sourceEvidenceChainIds: [`chain-${finding.id}`],
    evidenceRefs: [...finding.evidenceRefs],
    preconditions: [tt(es, "Requires human review and approval before acting.", "Requiere revisión y aprobación humana antes de actuar.")],
    missingEvidence: finding.limitations && finding.limitations.length > 0 ? [...finding.limitations] : undefined,
    severity: finding.severity,
  };
}

/**
 * Generate advisory candidates from an accepted root-cause analysis (+ optional
 * diagnosis). Consumes `recommendationHandoffHints`: when present, only findings
 * explicitly handed off are eligible.
 */
export function generateRecommendationCandidates(
  analysis: IsabellaRootCauseAnalysis,
  _diagnosis: IsabellaDailyProcessDiagnosis | undefined,
  language: RecommendationLanguage,
): CandidateWithSeverity[] {
  const es = language === "es";
  const out: CandidateWithSeverity[] = [];

  const handoffIds = analysis.recommendationHandoffHints.length
    ? new Set(analysis.recommendationHandoffHints.flatMap((h) => h.findingIds))
    : null;
  const eligible = analysis.findings.filter((f) => !handoffIds || handoffIds.has(f.id));

  for (const f of eligible) {
    const c = findingCandidate(f, language);
    if (c) out.push(c);
  }

  // Investigation gaps → advisory "investigate evidence" candidates (evidence gap
  // still deserves a *validation* action, never a fabricated fix).
  for (const g of analysis.investigationGaps) {
    out.push({
      dedupeKey: "investigate_evidence_gap",
      category: "investigate_evidence_gap",
      title: tt(es, `Confirm the status of: ${g.label}`, `Confirmar el estado de: ${g.label}`),
      rationale: tt(es, `Why this matters: ${RATIONALE.investigate_evidence_gap.en}.`, `Por qué importa: ${RATIONALE.investigate_evidence_gap.es}.`),
      expectedOutcome: OUTCOME.investigate_evidence_gap[es ? "es" : "en"],
      expectedImpact: "reduce_uncertainty",
      priority: "low",
      urgency: "this_week",
      effort: "low",
      confidence: "unavailable",
      affectedEntities: [],
      sourceFindingIds: [],
      sourceConstraintIds: ["c-evidence_gap"],
      sourceEvidenceChainIds: [],
      evidenceRefs: [],
      preconditions: [tt(es, "Requires human review and approval before acting.", "Requiere revisión y aprobación humana antes de actuar.")],
      missingEvidence: [g.reason],
      severity: "info",
    });
  }

  // Stabilize the current scope when ≥2 distinct attention findings converge.
  const attentionFindings = eligible.filter((f) => f.severity === "blocked" || f.severity === "at_risk" || f.severity === "watch");
  if (attentionFindings.length >= 2) {
    const refs = [...new Set(attentionFindings.flatMap((f) => f.evidenceRefs))];
    out.push({
      dedupeKey: "stabilize_milestone",
      category: "stabilize_milestone",
      title: tt(es, `Prioritize review of the current scope (${attentionFindings.length} converging signals)`, `Priorizar la revisión del alcance actual (${attentionFindings.length} señales convergentes)`),
      rationale: tt(es, `Why this matters: ${RATIONALE.stabilize_milestone.en}.`, `Por qué importa: ${RATIONALE.stabilize_milestone.es}.`),
      expectedOutcome: OUTCOME.stabilize_milestone[es ? "es" : "en"],
      expectedImpact: "reduce_risk",
      priority: attentionFindings.some((f) => f.severity === "blocked") ? "high" : "medium",
      urgency: "today",
      effort: "medium",
      confidence: "medium",
      affectedEntities: [],
      sourceFindingIds: attentionFindings.map((f) => f.id),
      sourceConstraintIds: attentionFindings.map((f) => `c-${f.constraintType}`),
      sourceEvidenceChainIds: attentionFindings.map((f) => `chain-${f.id}`),
      evidenceRefs: refs,
      preconditions: [tt(es, "Requires human review and approval before acting.", "Requiere revisión y aprobación humana antes de actuar.")],
      severity: "at_risk",
    });
  }

  return out;
}
