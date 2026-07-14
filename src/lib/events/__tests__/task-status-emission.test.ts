// ============================================================================
// REALTIME-TASK-STATUS · Workboard emission → canonical event (guard)
// ============================================================================
// Protects the first link of the realtime chain: when the Workboard moves a
// task (updateTaskStatusAction → emitAndAutoLink task_transition), the dual-
// write bridge maps it to the approved canonical `TaskStatusChanged` event, and
// that event passes the append-only Event Ingestion Service validation. This is
// what lands in project_event_log for the LGRE to consume — proving the status
// change enters the Project Event Graph through the approved path (never an
// ad-hoc/untyped event, never a direct UI mutation).
// ============================================================================

import { describe, it, expect } from "vitest";
import { mapProcessNodeToEvent } from "@/lib/events/dual-write";
import { validateProjectEvent } from "@/lib/events/ingestion";
import { EVENT_REGISTRY } from "@/lib/events/registry";

describe("Workboard task move → canonical TaskStatusChanged event", () => {
  const nodeInput = {
    organizationId: "org-1",
    projectId: "proj-1",
    nodeType: "task_transition" as const,
    sourceEntityType: "roadmap_tasks" as const,
    sourceEntityId: "task-1",
    title: "Build realtime pipeline",
    metadata: { old_status: "in_progress", new_status: "done" },
  };

  it("maps a task status move to the registered TaskStatusChanged event", () => {
    const event = mapProcessNodeToEvent(nodeInput);
    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("TaskStatusChanged");
    expect(event!.subjectId).toBe("task-1");
    expect(event!.sourceModule).toBe("roadmap");
    expect(event!.toState).toBe("done"); // new status carried for LGRE mapping
    expect(EVENT_REGISTRY.TaskStatusChanged).toBeDefined();
  });

  it("the mapped event is append-only-valid (Event Ingestion Service accepts it)", () => {
    const event = mapProcessNodeToEvent(nodeInput)!;
    const { ok, errors } = validateProjectEvent(event);
    expect(ok, errors.join("; ")).toBe(true);
  });

  it("TaskStatusChanged carries the schedule invalidation scope (LGRE recalc trigger)", () => {
    expect(EVENT_REGISTRY.TaskStatusChanged.invalidationScopes).toContain("scope:schedule");
  });

  it("skips the generic dual-write when semantic capture already succeeded", () => {
    expect(mapProcessNodeToEvent({
      ...nodeInput,
      metadata: { ...nodeInput.metadata, canonical_event_emitted: true },
    })).toBeNull();
  });
});
