// ============================================================================
// ProjectOps360° — Event Log dual-write bridge (Phase 2)
// ============================================================================
// Best-effort bridge: when the existing Living Graph pipeline emits a
// process_node (emit-event.ts), ALSO record the corresponding canonical event
// in project_event_log via the Event Ingestion Service. Fire-and-forget: a
// failure here never affects existing behavior (process_nodes/process_edges are
// untouched). This is the adoption path (dual-write) toward the Project Event
// Graph — no existing behavior is removed. See the Product Constitution §16.
// ============================================================================

import { emitProjectEventSafe, type EmitEventInput } from "./ingestion";
import type { EmitNodeInput } from "@/lib/graph/emit-event";

/** Map a legacy process-node emission to a canonical event, or null if unmapped. */
export function mapProcessNodeToEvent(input: EmitNodeInput): EmitEventInput | null {
  const base = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    actorType: "system" as const,
    occurredAt: input.occurredAt,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    provenance: { via: "dual-write", node_type: input.nodeType },
  };
  const meta = input.metadata ?? {};
  if (meta.canonical_event_emitted === true) return null;
  const toState = typeof meta.new_status === "string" ? meta.new_status : undefined;

  switch (input.nodeType) {
    case "task_transition":
      return { ...base, eventType: "TaskStatusChanged", subjectId: input.sourceEntityId,
        sourceModule: "roadmap", toState };
    case "milestone_gate":
      return { ...base, eventType: "MilestoneStarted", subjectId: input.sourceEntityId,
        sourceModule: "roadmap", toState };
    case "decision_cascade":
      return { ...base, eventType: "DecisionProposed", subjectId: input.sourceEntityId,
        sourceModule: "decisions" };
    case "communication_flow":
      return { ...base, eventType: "CommunicationSent", subjectId: input.sourceEntityId,
        sourceModule: input.sourceEntityType === "meetings" ? "rhythm" : "communications" };
    default:
      return null; // synthetic / not-yet-mapped node types are skipped
  }
}

/** Fire-and-forget dual-write. Never throws; never blocks the caller. */
export function dualWriteProcessNodeEvent(input: EmitNodeInput): void {
  try {
    const event = mapProcessNodeToEvent(input);
    if (event) emitProjectEventSafe(event);
  } catch (err) {
    console.error("[events] dual-write bridge error:", err);
  }
}
