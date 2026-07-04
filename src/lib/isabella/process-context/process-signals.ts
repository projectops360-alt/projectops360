// ============================================================================
// ProjectOps360° — Isabella Process Context · process signals
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL
//
// Record-backed active blockers (from task/subtask blocked flags) become blocker
// evidence packets. Advanced findings (delay/rework/bottleneck) are a FUTURE
// placeholder here — reported as unavailable with a limitation, never invented.
// Pure — the context builder passes already-retrieved rows.
// ============================================================================

import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";
import { buildIsabellaEvidencePacket, safeRef } from "./evidence-builder";
import type { IsabellaProjectScope, IsabellaProcessSignals, IsabellaTaskSummary } from "./types";

/**
 * Build process signals from already-retrieved task/subtask summaries. Active
 * blockers → blocker evidence (supports blocker_claim/status_summary). Advanced
 * findings are marked unavailable (future). Pure.
 */
export function buildProcessSignals(
  taskSummaries: IsabellaTaskSummary[],
  scope: IsabellaProjectScope,
): IsabellaProcessSignals {
  const es = scope.locale === "es";
  const blocked = taskSummaries.filter((t) => t.blockedReason && t.blockedReason.trim().length > 0);
  const packets: IsabellaEvidencePacket[] = blocked.map((t) =>
    buildIsabellaEvidencePacket({
      evidenceId: safeRef("blocker", t.taskId),
      evidenceType: "blocker",
      sourceKind: "risk_decision_approval_blocker",
      sourceId: t.citationRef,
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      title: t.title,
      summary: es ? `Bloqueada: ${t.blockedReason}` : `Blocked: ${t.blockedReason}`,
      citationLabel: es ? "Impedimento registrado" : "Recorded blocker",
      citationRef: t.citationRef,
      updatedAt: t.updatedAt ?? null,
      confidence: "high",
      allowedClaims: ["blocker_claim", "status_summary"],
      // A single blocker is not, on its own, a confirmed root cause.
      disallowedClaims: ["root_cause_claim"],
    }),
  );
  return {
    blockedCount: blocked.length,
    advancedFindingsAvailable: false,
    packets,
  };
}
