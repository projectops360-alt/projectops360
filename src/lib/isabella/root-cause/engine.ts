// ============================================================================
// ProjectOps360° — Isabella Root Cause & Constraint Analysis · engine (Task 4)
// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE
//
// `assembleRootCauseAnalysis` is PURE (context + diagnosis → analysis).
// `buildIsabellaRootCauseAnalysis` is the server entry: it reuses a provided
// context/diagnosis or asks the approved Task 2/Task 3 builders — it NEVER
// queries raw project data. No recommendations, no plans, no UI, no mutation.
// ============================================================================

import { buildIsabellaProcessContext } from "@/lib/isabella/process-context";
import type { IsabellaProcessContext, IsabellaTaskSummary } from "@/lib/isabella/process-context/types";
import { assembleDailyDiagnosis, computeDiagnosisSignals } from "@/lib/isabella/daily-diagnosis";
import type { IsabellaDailyProcessDiagnosis } from "@/lib/isabella/daily-diagnosis";
import { classifyConstraintSignals, extractRootCauseSymptoms } from "./signals";
import { buildEvidenceChains } from "./evidence-chain";
import { overallConfidence, scoreRootCauseConfidence } from "./confidence";
import type {
  AffectedEntity,
  ConstraintSignal,
  InvestigationGap,
  IsabellaRootCauseAnalysis,
  RecommendationHandoffHint,
  RootCauseAnalysisScope,
  RootCauseFinding,
  RootCauseLanguage,
} from "./types";

const TERMINAL = new Set(["done", "tested", "completed"]);
function tt(es: boolean, en: string, esT: string): string {
  return es ? esT : en;
}
function isOverdue(t: IsabellaTaskSummary, day: string): boolean {
  return !!t.dueDate && t.dueDate.slice(0, 10) < day && !TERMINAL.has(t.status);
}
function affected(context: IsabellaProcessContext, predicate: (t: IsabellaTaskSummary) => boolean, limit = 6): AffectedEntity[] {
  return (context.taskContext?.tasks ?? [])
    .filter(predicate)
    .slice(0, limit)
    .map((t) => ({ type: t.isSubtask ? "subtask" : "task", title: t.title, safeRef: t.citationRef }));
}

/** Classify constraint signals into conservative root-cause findings. */
export function classifyRootCauseFindings(
  context: IsabellaProcessContext,
  constraints: ConstraintSignal[],
  language: RootCauseLanguage,
): RootCauseFinding[] {
  const es = language === "es";
  const day = context.snapshotAt.slice(0, 10);
  const s = computeDiagnosisSignals(context);
  const hasOtherSignal = s.blockedTasks > 0 || s.overdueTasks > 0;
  const findings: RootCauseFinding[] = [];

  for (const c of constraints) {
    if (c.type === "evidence_gap") continue; // an investigation gap, not a finding
    let f: RootCauseFinding | null = null;

    if (c.type === "explicit_blocker") {
      f = {
        id: "f-blocker", label: c.label, classification: "confirmed_cause", constraintType: c.type,
        severity: "blocked", confidence: "high",
        explanation: tt(es, "Tasks are blocked by an explicit impediment record.", "Hay tareas bloqueadas por un impedimento explícito registrado."),
        affectedEntities: affected(context, (t) => !!t.blockedReason), evidenceRefs: c.evidenceRefs,
      };
    } else if (c.type === "overdue_constraint") {
      f = {
        id: "f-overdue", label: c.label, classification: "possible_cause", constraintType: c.type,
        severity: "at_risk", confidence: "low",
        explanation: tt(es, "Overdue tasks may be contributing to at-risk execution; the delay cause is not evidenced here.", "Las tareas vencidas pueden contribuir a la ejecución en riesgo; la causa del retraso no está evidenciada aquí."),
        affectedEntities: affected(context, (t) => isOverdue(t, day)), evidenceRefs: c.evidenceRefs,
        limitations: [tt(es, "The reason for the delay is not evidenced (needs deeper analysis).", "La razón del retraso no está evidenciada (requiere análisis más profundo).")],
      };
    } else if (c.type === "ownership_gap") {
      f = {
        id: "f-owner", label: c.label, classification: hasOtherSignal ? "likely_cause" : "possible_cause", constraintType: c.type,
        severity: "watch", confidence: hasOtherSignal ? "medium" : "low",
        explanation: tt(es, "Unassigned tasks may be contributing to stalled execution.", "Las tareas sin responsable pueden contribuir al avance detenido."),
        affectedEntities: affected(context, (t) => !t.ownerId), evidenceRefs: [],
        limitations: [tt(es, "No team-capacity evidence is available.", "No hay evidencia de capacidad del equipo.")],
      };
    } else if (c.type === "milestone_assignment_gap") {
      f = {
        id: "f-milestone", label: c.label, classification: "possible_cause", constraintType: c.type,
        severity: "watch", confidence: "low",
        explanation: tt(es, "Work outside the milestone structure may be under-tracked.", "El trabajo fuera de la estructura de hitos puede estar mal seguido."),
        affectedEntities: affected(context, (t) => !t.milestoneId), evidenceRefs: [],
      };
    }

    if (f) {
      f.confidence = scoreRootCauseConfidence(f, context);
      findings.push(f);
    }
  }

  // Symptom WITHOUT an evidenced cause → insufficient_evidence (never a guess).
  if (findings.length === 0 && s.notStartedTasks > 0) {
    const gap: RootCauseFinding = {
      id: "f-insufficient", label: tt(es, `${s.notStartedTasks} not-started task(s)`, `${s.notStartedTasks} tarea(s) sin iniciar`),
      classification: "insufficient_evidence", constraintType: "stalled_progress", severity: "watch", confidence: "unknown",
      explanation: tt(es, "Not-started work exists, but there is no evidenced cause (owner / dependency / timing).", "Hay trabajo sin iniciar, pero no hay una causa evidenciada (responsable / dependencia / tiempo)."),
      affectedEntities: affected(context, (t) => t.status === "not_started"), evidenceRefs: [],
      limitations: [tt(es, "No dependency/owner/timing evidence to explain the lack of progress.", "Sin evidencia de dependencia/responsable/tiempo que explique la falta de avance.")],
    };
    gap.confidence = scoreRootCauseConfidence(gap, context);
    findings.push(gap);
  }
  return findings;
}

/** Explicit investigation gaps — where missing evidence caps confidence. */
export function buildInvestigationGaps(context: IsabellaProcessContext, language: RootCauseLanguage): InvestigationGap[] {
  const es = language === "es";
  const gaps: InvestigationGap[] = [];
  if (!(context.processSignals?.advancedFindingsAvailable ?? false)) {
    gaps.push({
      label: tt(es, "Advanced delay/rework/bottleneck findings", "Hallazgos avanzados de delay/rework/bottleneck"),
      missingEvidenceType: "milestone_flow_findings",
      reason: tt(es, "Not available in this context yet.", "Aún no disponibles en este contexto."),
      blocksConfidenceAbove: "medium",
    });
  }
  for (const l of context.limitations.slice(0, 8)) {
    gaps.push({ label: l, missingEvidenceType: "context_limitation", reason: tt(es, "Source not wired into this layer yet.", "Fuente aún no conectada a esta capa."), blocksConfidenceAbove: "medium" });
  }
  return gaps;
}

/** Structured handoff to the Recommendation Engine (Task 5) — never a plan. */
export function buildRecommendationHandoffHints(findings: RootCauseFinding[], language: RootCauseLanguage): RecommendationHandoffHint[] {
  const es = language === "es";
  if (findings.length === 0) return [];
  return [
    {
      reason: tt(es, "These constraints require recommendation analysis in the next engine.", "Estas restricciones requieren análisis de recomendaciones en el siguiente motor."),
      findingIds: findings.map((f) => f.id),
      evidenceRefs: [...new Set(findings.flatMap((f) => f.evidenceRefs))],
      allowedForRecommendationEngine: true,
    },
  ];
}

/** PURE: turn an authorized context (+ optional diagnosis) into a root-cause analysis. */
export function assembleRootCauseAnalysis(
  context: IsabellaProcessContext,
  diagnosis: IsabellaDailyProcessDiagnosis | undefined,
  scope: { milestoneId?: string; taskId?: string } | undefined,
  language: RootCauseLanguage,
): IsabellaRootCauseAnalysis {
  const es = language === "es";
  const title = es ? "Análisis de causa raíz" : "Root Cause Analysis";
  const projectId = context.scope?.projectId ?? context.project?.projectId ?? null;
  const organizationId = context.scope?.organizationId ?? null;
  const analysisScope: RootCauseAnalysisScope = {
    projectId: projectId ?? undefined,
    milestoneId: scope?.milestoneId,
    taskId: scope?.taskId,
    source: diagnosis ? "daily_diagnosis" : scope?.taskId ? "task" : scope?.milestoneId ? "milestone" : "project",
  };

  if (context.status === "missing_context" || context.status === "unauthorized" || context.status === "unavailable" || context.status === "empty") {
    return {
      status: context.status, projectId, organizationId, snapshotAt: context.snapshotAt, title,
      summary: context.message ?? "", analysisScope, findings: [], constraints: [], symptoms: [],
      evidenceChains: [], investigationGaps: [], recommendationHandoffHints: [],
      confidence: "unavailable", evidenceRefs: [], citations: [], limitations: context.limitations, message: context.message,
    };
  }

  const symptoms = extractRootCauseSymptoms(context, language);
  const constraints = classifyConstraintSignals(context, language);
  const findings = classifyRootCauseFindings(context, constraints, language);
  const evidenceChains = buildEvidenceChains(findings, language);
  const investigationGaps = buildInvestigationGaps(context, language);
  const recommendationHandoffHints = buildRecommendationHandoffHints(findings, language);
  const confidence = overallConfidence(findings, context);
  const evidenceRefs = [...new Set([...findings.flatMap((f) => f.evidenceRefs), ...constraints.flatMap((c) => c.evidenceRefs)])];

  const top = findings[0];
  const summary =
    findings.length === 0
      ? tt(es, "No execution constraints are evidenced right now.", "No hay restricciones de ejecución evidenciadas en este momento.")
      : tt(
          es,
          `The most notable finding is ${top.classification.replace("_", " ")}: ${top.label} (${top.confidence}). ${findings.length} finding(s) in total. Recommendation generation belongs to the next engine.`,
          `El hallazgo más notable es ${top.classification.replace("_", " ")}: ${top.label} (${top.confidence}). ${findings.length} hallazgo(s) en total. La generación de recomendaciones corresponde al siguiente motor.`,
        );

  return {
    status: context.status, projectId, organizationId, snapshotAt: context.snapshotAt, title, summary, analysisScope,
    findings, constraints, symptoms, evidenceChains, investigationGaps, recommendationHandoffHints,
    confidence, evidenceRefs, citations: context.citations.slice(0, 40), limitations: context.limitations,
  };
}

export interface RootCauseRequest {
  projectId?: string;
  organizationId?: string;
  userId?: string;
  locale?: string;
  timezone?: string;
  scope?: { milestoneId?: string; taskId?: string };
  context?: IsabellaProcessContext;
  dailyDiagnosis?: IsabellaDailyProcessDiagnosis;
}

/** Server entry: reuse or build the approved context/diagnosis, then analyze. */
export async function buildIsabellaRootCauseAnalysis(request: RootCauseRequest): Promise<IsabellaRootCauseAnalysis> {
  const language: RootCauseLanguage = request.locale === "es" ? "es" : "en";
  const context =
    request.context ??
    (await buildIsabellaProcessContext({ projectId: request.projectId, locale: language, include: ["project", "tasks", "milestones", "blockers"] }));
  const diagnosis =
    request.dailyDiagnosis ??
    (context.status === "ready" || context.status === "partial" ? assembleDailyDiagnosis(context, language) : undefined);
  return assembleRootCauseAnalysis(context, diagnosis, request.scope, language);
}
