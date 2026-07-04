// ============================================================================
// ProjectOps360° — Isabella Daily Diagnosis · evidence + handoff (pure)
// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE
//
// Collects the diagnosis-wide evidence refs + citations and builds STRUCTURED
// handoff hints for the FUTURE root-cause / recommendation engines. This engine
// never acts on the hints — it only flags "this may need deeper analysis". Pure.
// ============================================================================

import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import type { IsabellaCitation } from "@/lib/isabella/process-intelligence/types";
import { computeDiagnosisSignals } from "./metrics";
import type { NextEngineHint } from "./types";

export function collectDiagnosisEvidence(context: IsabellaProcessContext): {
  evidenceRefs: string[];
  citations: IsabellaCitation[];
} {
  const refs = new Set<string>();
  for (const p of context.evidencePackets) {
    const r = p.citationRef ?? p.evidenceId;
    if (r) refs.add(r);
  }
  return { evidenceRefs: [...refs], citations: context.citations.slice(0, 40) };
}

/** Structured handoff to Task 4/5 — symptoms only; never a conclusion or plan. */
export function buildNextEngineHints(context: IsabellaProcessContext, language: "en" | "es" = "en"): NextEngineHint[] {
  const es = language === "es";
  const s = computeDiagnosisSignals(context);
  const hints: NextEngineHint[] = [];
  const blockerRefs = context.evidencePackets.filter((p) => p.evidenceType === "blocker").map((p) => p.citationRef ?? p.evidenceId).filter(Boolean) as string[];

  if (s.blockedTasks > 0) {
    hints.push({
      engine: "root_cause",
      reason: es ? "Hay tareas bloqueadas; su causa raíz debe analizarse en el motor de causa raíz." : "Blocked tasks exist; their root cause should be analyzed by the root-cause engine.",
      evidenceRefs: blockerRefs,
    });
  }
  if (s.overdueTasks > 0) {
    hints.push({
      engine: "root_cause",
      reason: es ? "Hay tareas vencidas; el porqué del retraso corresponde al motor de causa raíz." : "Overdue tasks exist; the delay cause belongs to the root-cause engine.",
      evidenceRefs: [],
    });
  }
  if (s.withoutOwnerTasks > 0 || s.withoutMilestoneTasks > 0) {
    hints.push({
      engine: "recommendation",
      reason: es ? "Hay gaps de asignación (sin responsable/hito); las acciones priorizadas corresponden al motor de recomendaciones." : "Assignment gaps (no owner/milestone); prioritized actions belong to the recommendation engine.",
      evidenceRefs: [],
    });
  }
  return hints;
}
