// ============================================================================
// P2-T2 — Derived risk response trail (PD-018 §B.4; RISK-EVENT-CAPTURE)
// ============================================================================
// Explicit deterministic rule (PD-016 event #11: derivable ONLY with an
// explicit rule): when a LIVE task event enters the PEG and the task is the
// linked response of a risk (risks.linked_task_id), derive the corresponding
// risk response event:
//   TaskCreated                     → risk_response_action_created
//   TaskStatusChanged(→in_progress) → risk_response_started
//   TaskCompleted                   → risk_response_action_completed
// Every derived event carries capture_method=derived, reduced confidence, the
// `derived` quality flag, and causation to the source task event (recorded
// causality, never inferred). RI-09 holds by construction: this bridge NEVER
// emits a closure event and NEVER mutates the risk. Flag-gated per project.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { isRiskEventCaptureEnabled } from "./risk-capture-flag";
import type { EmitEventInput } from "./ingestion";

export const DERIVED_CONFIDENCE = 0.7;

export interface TaskEventForDerivation {
  eventId: string;
  eventType: string;
  organizationId: string;
  projectId: string;
  taskId: string | null;
  toState: string | null;
  occurredAt: string;
}

/** Pure mapping rule (unit-tested). Returns null when nothing derives. */
export function mapTaskEventToDerivedRiskInput(
  taskEvent: TaskEventForDerivation,
  riskId: string,
): EmitEventInput | null {
  if (!taskEvent.taskId || !riskId) return null;

  let derivedType: string | null = null;
  if (taskEvent.eventType === "TaskCreated") derivedType = "risk_response_action_created";
  else if (taskEvent.eventType === "TaskCompleted") derivedType = "risk_response_action_completed";
  else if (
    taskEvent.eventType === "TaskStarted" ||
    (taskEvent.eventType === "TaskStatusChanged" && taskEvent.toState === "in_progress")
  ) {
    derivedType = "risk_response_started";
  }
  if (!derivedType) return null;

  return {
    organizationId: taskEvent.organizationId,
    projectId: taskEvent.projectId,
    eventType: derivedType,
    subjectId: riskId,
    actorType: "system",
    occurredAt: taskEvent.occurredAt,
    sourceModule: "risk-derived-bridge",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: taskEvent.taskId,
    causedBy: [taskEvent.eventId],
    confidence: DERIVED_CONFIDENCE,
    lifecycleClassOverride: "DERIVED_EVENT",
    provenance: {
      capture_method: "derived",
      data_quality_flags: ["derived"],
      derivation_rule: `${taskEvent.eventType}${taskEvent.toState ? `(→${taskEvent.toState})` : ""} on risks.linked_task_id → ${derivedType}`,
      source_task_event_id: taskEvent.eventId,
    },
    payload: { task_id: taskEvent.taskId },
    objectRefs: [
      { objectType: "risk", objectId: riskId, role: "focal" },
      { objectType: "task", objectId: taskEvent.taskId, role: "response" },
    ],
  };
}

/**
 * Server-side derivation entry (called by the ingestion gateway after a live
 * task event is inserted). Looks up the linked risk and emits the derived
 * event through the SAME gateway (one pipeline). Never throws.
 */
export async function deriveRiskEventsForTaskEvent(
  taskEvent: TaskEventForDerivation,
): Promise<void> {
  try {
    if (!taskEvent.taskId) return;
    if (!isRiskEventCaptureEnabled(taskEvent.projectId)) return;

    const supabase = createAdminClient();
    const { data: risks } = await supabase
      .from("risks")
      .select("id")
      .eq("linked_task_id", taskEvent.taskId)
      .eq("project_id", taskEvent.projectId)
      .eq("organization_id", taskEvent.organizationId)
      .is("deleted_at", null);

    if (!risks || risks.length === 0) return;

    const { emitProjectEvent } = await import("./ingestion");
    for (const risk of risks) {
      const input = mapTaskEventToDerivedRiskInput(taskEvent, risk.id as string);
      if (!input) continue;
      const res = await emitProjectEvent(input);
      if (!res.ok) console.warn("[events] derived risk emit failed:", res.error, res.errors ?? "");
    }
  } catch (err) {
    console.error("[events] deriveRiskEventsForTaskEvent error:", err);
  }
}
