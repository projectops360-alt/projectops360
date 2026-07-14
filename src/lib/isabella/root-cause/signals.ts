// ============================================================================
// ProjectOps360° — Isabella Root Cause · symptom + constraint extraction (pure)
// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE
//
// Extracts SYMPTOMS (observed) and CONSTRAINT SIGNALS (categorized) from the
// Task 2 context + Task 3 diagnosis. Only constraints with real evidence are
// produced; unavailable categories (dependency/decision/approval/capacity/…)
// become EVIDENCE GAPS — never fabricated. Reuses Task 3 deterministic signals.
// ============================================================================

import type { IsabellaProcessContext, IsabellaTaskSummary } from "@/lib/isabella/process-context/types";
import { computeDiagnosisSignals } from "@/lib/isabella/daily-diagnosis";
import type { ConstraintSignal, RootCauseLanguage, SymptomSignal } from "./types";

const TERMINAL = new Set(["done", "tested", "completed"]);

function tt(es: boolean, en: string, esT: string): string {
  return es ? esT : en;
}
function isOverdue(t: IsabellaTaskSummary, day: string): boolean {
  return !!t.dueDate && t.dueDate.slice(0, 10) < day && !TERMINAL.has(t.status);
}
function blockerRefs(context: IsabellaProcessContext): string[] {
  return (context.processSignals?.packets ?? []).map((p) => p.citationRef ?? p.evidenceId).filter(Boolean) as string[];
}
function processPacketRefs(context: IsabellaProcessContext, type: "delay_finding" | "rework_finding" | "bottleneck_finding"): string[] {
  return context.evidencePackets
    .filter((packet) => packet.evidenceType === type)
    .map((packet) => packet.citationRef ?? packet.evidenceId)
    .filter(Boolean) as string[];
}

/** Observed symptoms (facts) — the "what", not yet the "why". */
export function extractRootCauseSymptoms(context: IsabellaProcessContext, language: RootCauseLanguage): SymptomSignal[] {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const out: SymptomSignal[] = [];
  if (s.blockedTasks > 0) out.push({ id: "sym-blocked", type: "blocked_task", label: tt(es, `${s.blockedTasks} blocked task(s)`, `${s.blockedTasks} tarea(s) bloqueada(s)`), evidenceRefs: blockerRefs(context) });
  if (s.overdueTasks > 0) out.push({ id: "sym-overdue", type: "overdue_task", label: tt(es, `${s.overdueTasks} overdue task(s)`, `${s.overdueTasks} tarea(s) vencida(s)`), evidenceRefs: [] });
  if (s.withoutOwnerTasks > 0) out.push({ id: "sym-owner", type: "missing_owner", label: tt(es, `${s.withoutOwnerTasks} task(s) without owner`, `${s.withoutOwnerTasks} tarea(s) sin responsable`), evidenceRefs: [] });
  if (s.withoutMilestoneTasks > 0) out.push({ id: "sym-milestone", type: "missing_milestone", label: tt(es, `${s.withoutMilestoneTasks} task(s) without milestone`, `${s.withoutMilestoneTasks} tarea(s) sin hito`), evidenceRefs: [] });
  if (context.status === "partial") out.push({ id: "sym-partial", type: "partial_context", label: tt(es, "Some evidence sources are unavailable", "Algunas fuentes de evidencia no están disponibles"), evidenceRefs: [] });
  if (s.delayFindingCount > 0) out.push({ id: "sym-process-delay", type: "process_delay", label: tt(es, `${s.delayFindingCount} process delay finding(s)`, `${s.delayFindingCount} hallazgo(s) de retraso de proceso`), evidenceRefs: processPacketRefs(context, "delay_finding") });
  if (s.reworkFindingCount > 0) out.push({ id: "sym-rework", type: "rework", label: tt(es, `${s.reworkFindingCount} rework finding(s)`, `${s.reworkFindingCount} hallazgo(s) de retrabajo`), evidenceRefs: processPacketRefs(context, "rework_finding") });
  if (s.bottleneckFindingCount > 0) out.push({ id: "sym-bottleneck", type: "bottleneck", label: tt(es, `${s.bottleneckFindingCount} bottleneck candidate(s)`, `${s.bottleneckFindingCount} candidato(s) a cuello de botella`), evidenceRefs: processPacketRefs(context, "bottleneck_finding") });
  return out;
}

/** Constraint signals — categorized, evidence-backed. Unavailable → evidence_gap. */
export function classifyConstraintSignals(context: IsabellaProcessContext, language: RootCauseLanguage): ConstraintSignal[] {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const day = context.snapshotAt.slice(0, 10);
  const conf = context.status === "ready" ? "verified" : "medium";
  const out: ConstraintSignal[] = [];

  // explicit_blocker — direct blocker records (highest-evidence constraint).
  const blockers = context.processSignals?.packets ?? [];
  if (blockers.length > 0) {
    out.push({
      id: "c-blocker",
      type: "explicit_blocker",
      label: tt(es, `${blockers.length} explicit blocker(s)`, `${blockers.length} bloqueo(s) explícito(s)`),
      severity: "blocked",
      confidence: "high",
      evidenceRefs: blockers.map((p) => p.citationRef ?? p.evidenceId).filter(Boolean) as string[],
      affectedEntityRefs: blockers.map((p) => p.sourceId).filter(Boolean),
    });
  }

  // overdue_constraint — verified count; the CAUSE of the delay stays unknown.
  if (s.overdueTasks > 0) {
    const overdueRefs = (context.taskContext?.tasks ?? []).filter((t) => isOverdue(t, day)).map((t) => t.citationRef);
    out.push({ id: "c-overdue", type: "overdue_constraint", label: tt(es, `${s.overdueTasks} overdue task(s)`, `${s.overdueTasks} tarea(s) vencida(s)`), severity: "at_risk", confidence: conf, evidenceRefs: overdueRefs, affectedEntityRefs: overdueRefs });
  }

  // ownership_gap
  if (s.withoutOwnerTasks > 0) {
    out.push({ id: "c-owner", type: "ownership_gap", label: tt(es, `${s.withoutOwnerTasks} task(s) without owner`, `${s.withoutOwnerTasks} tarea(s) sin responsable`), severity: "watch", confidence: conf, evidenceRefs: [], affectedEntityRefs: [] });
  }

  // milestone_assignment_gap
  if (s.withoutMilestoneTasks > 0) {
    out.push({ id: "c-milestone", type: "milestone_assignment_gap", label: tt(es, `${s.withoutMilestoneTasks} task(s) without milestone`, `${s.withoutMilestoneTasks} tarea(s) sin hito`), severity: "watch", confidence: conf, evidenceRefs: [], affectedEntityRefs: [] });
  }

  const delayRefs = processPacketRefs(context, "delay_finding");
  if (delayRefs.length > 0) {
    out.push({ id: "c-process-delay", type: "process_delay", label: tt(es, `${delayRefs.length} evidenced process delay(s)`, `${delayRefs.length} retraso(s) de proceso con evidencia`), severity: "at_risk", confidence: "medium", evidenceRefs: delayRefs, affectedEntityRefs: delayRefs });
  }
  const reworkRefs = processPacketRefs(context, "rework_finding");
  if (reworkRefs.length > 0) {
    out.push({ id: "c-rework", type: "rework_signal", label: tt(es, `${reworkRefs.length} rework pattern(s)`, `${reworkRefs.length} patrón(es) de retrabajo`), severity: "at_risk", confidence: "medium", evidenceRefs: reworkRefs, affectedEntityRefs: reworkRefs });
  }
  const bottleneckRefs = processPacketRefs(context, "bottleneck_finding");
  if (bottleneckRefs.length > 0) {
    out.push({ id: "c-bottleneck", type: "bottleneck_signal", label: tt(es, `${bottleneckRefs.length} bottleneck candidate(s)`, `${bottleneckRefs.length} candidato(s) a cuello de botella`), severity: "watch", confidence: "medium", evidenceRefs: bottleneckRefs, affectedEntityRefs: bottleneckRefs });
  }

  // evidence_gap — advanced findings / risk / decision / approval not available.
  if (!s.advancedFindingsAvailable) {
    out.push({ id: "c-gap-advanced", type: "evidence_gap", label: tt(es, "Advanced delay/rework/bottleneck findings unavailable", "Hallazgos avanzados de delay/rework/bottleneck no disponibles"), severity: "info", confidence: "unavailable", evidenceRefs: [], affectedEntityRefs: [] });
  }
  return out;
}
