// ============================================================================
// ProjectOps360° — Isabella Daily Process Diagnosis · engine (Phase 5 · Task 3)
// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE
//
// The public API. `assembleDailyDiagnosis` is PURE (context → diagnosis) so it
// is fully unit-testable. `buildIsabellaDailyProcessDiagnosis` is the server
// entry: it uses a provided context or asks the approved Task 2 context builder
// (`buildIsabellaProcessContext`) — it NEVER queries raw project data itself.
// No root cause, no recommendations, no UI, no mutation.
// ============================================================================

import { buildIsabellaProcessContext } from "@/lib/isabella/process-context";
import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import { computeDiagnosisSignals } from "./metrics";
import { evaluateDailyHealth } from "./health";
import { collectDiagnosisEvidence, buildNextEngineHints } from "./evidence";
import {
  buildBlockersSection,
  buildExecutionGapsSection,
  buildMilestoneFocusSection,
  buildProgressSection,
  buildRisksOrAttentionSection,
  buildTodayFocusSection,
} from "./sections";
import type {
  DiagnosisLanguage,
  DiagnosisSection,
  IsabellaDailyProcessDiagnosis,
} from "./types";

function emptySection(title: string): DiagnosisSection {
  return { title, status: "unavailable", summary: "", items: [] };
}

function executiveSummary(context: IsabellaProcessContext, language: DiagnosisLanguage): string {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const level = evaluateDailyHealth(context, language).level;
  const bits: string[] = [];
  if (s.blockedTasks > 0) bits.push(es ? `${s.blockedTasks} tareas bloqueadas` : `${s.blockedTasks} tasks blocked`);
  if (s.overdueTasks > 0) bits.push(es ? `${s.overdueTasks} vencidas` : `${s.overdueTasks} overdue`);
  if (s.withoutOwnerTasks > 0) bits.push(es ? `${s.withoutOwnerTasks} sin responsable` : `${s.withoutOwnerTasks} without owner`);
  if (s.withoutMilestoneTasks > 0) bits.push(es ? `${s.withoutMilestoneTasks} sin hito` : `${s.withoutMilestoneTasks} without milestone`);
  const head = es
    ? `El proyecto está en estado ${level === "healthy" ? "saludable" : level === "watch" ? "observación" : level === "at_risk" ? "riesgo" : level === "blocked" ? "bloqueado" : "desconocido"}`
    : `The project is ${level.replace("_", " ")}`;
  if (bits.length === 0) {
    return es ? `${head}: ${s.doneTasks} tareas hechas, ${s.inProgressTasks} en progreso.` : `${head}: ${s.doneTasks} done, ${s.inProgressTasks} in progress.`;
  }
  return es ? `${head}: ${bits.join(", ")}.` : `${head}: ${bits.join(", ")}.`;
}

/** PURE: turn an authorized process context into a structured daily diagnosis. */
export function assembleDailyDiagnosis(context: IsabellaProcessContext, language: DiagnosisLanguage): IsabellaDailyProcessDiagnosis {
  const es = language === "es";
  const title = es ? "Diagnóstico diario del proyecto" : "Daily Project Diagnosis";
  const projectId = context.scope?.projectId ?? context.project?.projectId ?? null;
  const organizationId = context.scope?.organizationId ?? null;

  const emptyTitles = es
    ? ["Avance", "Bloqueos", "Señales de atención", "Enfoque por milestone", "Gaps de ejecución", "Foco de hoy"]
    : ["Progress", "Blockers", "Attention signals", "Milestone focus", "Execution gaps", "Today's focus"];
  const emptySections = {
    progress: emptySection(emptyTitles[0]),
    blockers: emptySection(emptyTitles[1]),
    risksOrAttention: emptySection(emptyTitles[2]),
    milestoneFocus: emptySection(emptyTitles[3]),
    executionGaps: emptySection(emptyTitles[4]),
    todayFocus: emptySection(emptyTitles[5]),
  };

  // Non-actionable states → honest message, unknown health, empty sections.
  if (context.status === "missing_context" || context.status === "unauthorized" || context.status === "unavailable" || context.status === "empty") {
    return {
      status: context.status,
      projectId,
      organizationId,
      snapshotAt: context.snapshotAt,
      title,
      executiveSummary: context.message ?? "",
      overallHealth: evaluateDailyHealth(context, language),
      sections: emptySections,
      metrics: {},
      evidenceRefs: [],
      citations: [],
      limitations: context.limitations,
      message: context.message,
    };
  }

  const s = computeDiagnosisSignals(context);
  const evidence = collectDiagnosisEvidence(context);

  return {
    status: context.status,
    projectId,
    organizationId,
    snapshotAt: context.snapshotAt,
    title,
    executiveSummary: executiveSummary(context, language),
    overallHealth: evaluateDailyHealth(context, language),
    sections: {
      progress: buildProgressSection(context, language),
      blockers: buildBlockersSection(context, language),
      risksOrAttention: buildRisksOrAttentionSection(context, language),
      milestoneFocus: buildMilestoneFocusSection(context, language),
      executionGaps: buildExecutionGapsSection(context, language),
      todayFocus: buildTodayFocusSection(context, language),
    },
    metrics: {
      totalTasks: s.totalTasks,
      doneTasks: s.doneTasks,
      inProgressTasks: s.inProgressTasks,
      notStartedTasks: s.notStartedTasks,
      blockedTasks: s.blockedTasks,
      overdueTasks: s.overdueTasks,
      withoutMilestoneTasks: s.withoutMilestoneTasks,
      withoutOwnerTasks: s.withoutOwnerTasks,
      milestonesTotal: s.milestonesTotal,
      processEventCount: s.processEventCount,
      processTransitionCount: s.processTransitionCount,
      delayFindingCount: s.delayFindingCount,
      reworkFindingCount: s.reworkFindingCount,
      bottleneckFindingCount: s.bottleneckFindingCount,
    },
    evidenceRefs: evidence.evidenceRefs,
    citations: evidence.citations,
    limitations: context.limitations,
    nextEngineHints: buildNextEngineHints(context, language),
  };
}

export interface DailyDiagnosisRequest {
  projectId?: string;
  organizationId?: string;
  userId?: string;
  locale?: string;
  timezone?: string;
  /** Optional pre-built context; otherwise the approved Task 2 builder is used. */
  context?: IsabellaProcessContext;
}

/**
 * Server entry: build (or reuse) the approved process context, then synthesize
 * the daily diagnosis. Never throws; never queries raw project data directly.
 */
export async function buildIsabellaDailyProcessDiagnosis(request: DailyDiagnosisRequest): Promise<IsabellaDailyProcessDiagnosis> {
  const language: DiagnosisLanguage = request.locale === "es" ? "es" : "en";
  const context =
    request.context ??
    (await buildIsabellaProcessContext({
      projectId: request.projectId,
      locale: language,
      include: ["project", "tasks", "milestones", "blockers", "process_mining_summary"],
    }));
  return assembleDailyDiagnosis(context, language);
}
