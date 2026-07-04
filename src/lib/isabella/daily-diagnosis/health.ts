// ============================================================================
// ProjectOps360° — Isabella Daily Diagnosis · health scoring (pure)
// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE
//
// Conservative, EVIDENCE-DERIVED health classification — never invented by the
// LLM. Rules over the deterministic signals; rationale + evidenceRefs always
// included; confidence follows evidence availability. Pure.
// ============================================================================

import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import type { IsabellaConfidence } from "@/lib/isabella/process-intelligence/types";
import { computeDiagnosisSignals } from "./metrics";
import { DIAGNOSIS_BLOCKED_THRESHOLD, type DiagnosisOverallHealth, type DiagnosisLanguage } from "./types";

function confidenceForStatus(status: IsabellaProcessContext["status"]): IsabellaConfidence {
  switch (status) {
    case "ready":
      return "verified"; // deterministic counts, complete sources
    case "partial":
      return "medium";
    case "empty":
      return "high"; // "no data" is itself verified, but health is unknown
    default:
      return "unavailable";
  }
}

/**
 * Classify today's execution health from the context. Deny/empty/unavailable
 * states map to `unknown`. Otherwise: blocked (≥ threshold blockers) > at_risk
 * (overdue or any blocker or ≥2 attention signals) > watch (some attention or
 * partial context) > healthy (progressing, no gaps) > unknown (too little data).
 */
export function evaluateDailyHealth(context: IsabellaProcessContext, language: DiagnosisLanguage = "en"): DiagnosisOverallHealth {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const refs: string[] = context.evidencePackets.slice(0, 12).map((p) => p.citationRef ?? p.evidenceId).filter(Boolean) as string[];

  if (context.status === "missing_context" || context.status === "unauthorized" || context.status === "unavailable") {
    return {
      level: "unknown",
      confidence: "unavailable",
      rationale: es ? "No hay contexto de proyecto autorizado para diagnosticar." : "No authorized project context to diagnose.",
      evidenceRefs: [],
    };
  }
  if (!s.hasTaskData) {
    return {
      level: "unknown",
      confidence: confidenceForStatus(context.status),
      rationale: es ? "No hay tareas visibles suficientes para clasificar la salud." : "Not enough visible tasks to classify health.",
      evidenceRefs: refs,
    };
  }

  const confidence = confidenceForStatus(context.status);
  const parts: string[] = [];
  const push = (en: string, esT: string) => parts.push(es ? esT : en);

  let level: DiagnosisOverallHealth["level"];
  if (s.blockedTasks >= DIAGNOSIS_BLOCKED_THRESHOLD) {
    level = "blocked";
    push(`${s.blockedTasks} blocked tasks (≥ ${DIAGNOSIS_BLOCKED_THRESHOLD}).`, `${s.blockedTasks} tareas bloqueadas (≥ ${DIAGNOSIS_BLOCKED_THRESHOLD}).`);
  } else if (s.overdueTasks > 0 || s.blockedTasks > 0 || s.attentionSignalCount >= 2) {
    level = "at_risk";
    if (s.overdueTasks > 0) push(`${s.overdueTasks} overdue`, `${s.overdueTasks} vencidas`);
    if (s.blockedTasks > 0) push(`${s.blockedTasks} blocked`, `${s.blockedTasks} bloqueadas`);
    if (s.attentionSignalCount >= 2) push(`${s.attentionSignalCount} attention signals`, `${s.attentionSignalCount} señales de atención`);
  } else if (s.attentionSignalCount >= 1 || context.status === "partial") {
    level = "watch";
    if (s.withoutOwnerTasks > 0) push(`${s.withoutOwnerTasks} without owner`, `${s.withoutOwnerTasks} sin responsable`);
    if (s.withoutMilestoneTasks > 0) push(`${s.withoutMilestoneTasks} without milestone`, `${s.withoutMilestoneTasks} sin hito`);
    if (context.status === "partial") push("some evidence sources unavailable", "algunas fuentes de evidencia no disponibles");
  } else if (s.doneTasks + s.inProgressTasks > 0) {
    level = "healthy";
    push(`${s.doneTasks} done, ${s.inProgressTasks} in progress, no blockers/overdue/gaps`, `${s.doneTasks} hechas, ${s.inProgressTasks} en progreso, sin bloqueos/vencidas/gaps`);
  } else {
    level = "unknown";
    push("no execution movement evidenced", "no hay evidencia de avance");
  }

  return {
    level,
    confidence,
    rationale: (es ? "Basado en: " : "Based on: ") + parts.join(", ") + ".",
    evidenceRefs: refs,
  };
}
