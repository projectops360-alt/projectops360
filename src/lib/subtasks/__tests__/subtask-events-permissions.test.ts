// ============================================================================
// TASK-EXECUTION-MAP — Events, schemas & RBAC guards
// ============================================================================
// Protects: every subtask lifecycle event is registered in the Canonical
// Event Taxonomy and built with actor/org/project/task/subtask/old/new/reason;
// blocking requires a reason; parent override requires a reason; RBAC is
// deny-by-default (viewer read-only, member own-work only, restricted ops for
// managers); events pass the ingestion registry validation.
// ============================================================================

import { describe, it, expect } from "vitest";
import { EVENT_REGISTRY } from "@/lib/events/registry";
import { validateProjectEvent } from "@/lib/events/ingestion";
import { buildSubtaskEvent, type SubtaskEventType } from "@/lib/subtasks/subtask-events";
import { blockSubtaskSchema, overrideParentProgressSchema, closeParentWithIncompleteSchema, createSubtaskSchema } from "@/lib/subtasks/schemas";
import { authorizeSubtaskAction } from "@/lib/subtasks/permissions";

const ALL_SUBTASK_EVENTS: SubtaskEventType[] = [
  "SubtaskCreated",
  "SubtaskUpdated",
  "SubtaskStarted",
  "SubtaskCompleted",
  "SubtaskBlocked",
  "SubtaskUnblocked",
  "SubtaskReassigned",
  "SubtaskDueDateChanged",
  "SubtaskEstimateChanged",
  "SubtaskProgressChanged",
  "SubtaskDeleted",
  "ParentTaskProgressRecalculated",
  "ParentTaskProgressOverride",
];

function build(eventType: SubtaskEventType, extra: Partial<Parameters<typeof buildSubtaskEvent>[0]> = {}) {
  return buildSubtaskEvent({
    eventType,
    organizationId: "org-1",
    projectId: "proj-1",
    taskId: "task-1",
    subtaskId: eventType.startsWith("ParentTask") ? null : "sub-1",
    actorId: "user-1",
    title: "Write E2E tests",
    oldValue: 40,
    newValue: 60,
    reason: eventType === "SubtaskBlocked" || eventType === "ParentTaskProgressOverride" ? "QA env down" : undefined,
    ...extra,
  });
}

describe("event registry coverage", () => {
  it("every subtask event type is registered in the Canonical Event Taxonomy", () => {
    for (const type of ALL_SUBTASK_EVENTS) {
      expect(EVENT_REGISTRY[type], `${type} missing from registry`).toBeDefined();
    }
  });

  it("every built event passes the Event Ingestion Service validation", () => {
    for (const type of ALL_SUBTASK_EVENTS) {
      const { ok, errors } = validateProjectEvent(build(type));
      expect(ok, `${type}: ${errors.join("; ")}`).toBe(true);
    }
  });
});

describe("event envelope content", () => {
  it("carries actor, org, project, task, subtask, old/new values and reason", () => {
    const event = build("SubtaskBlocked");
    expect(event.organizationId).toBe("org-1");
    expect(event.projectId).toBe("proj-1");
    expect(event.actorType).toBe("human");
    expect(event.actorId).toBe("user-1");
    expect(event.subjectId).toBe("sub-1");
    expect(event.sourceEntityType).toBe("task_subtasks");
    expect(event.payload).toMatchObject({
      task_id: "task-1",
      subtask_id: "sub-1",
      old_value: 40,
      new_value: 60,
      reason: "QA env down",
      impediment: "QA env down", // registry contract for blocked events
    });
  });

  it("parent-level events subject the TASK (not a subtask)", () => {
    const event = build("ParentTaskProgressRecalculated");
    expect(event.subjectId).toBe("task-1");
    expect(event.sourceEntityType).toBe("roadmap_tasks");
    expect(event.payload).not.toHaveProperty("subtask_id");
  });
});

describe("required reasons (auditable)", () => {
  it("blocking a subtask REQUIRES a reason", () => {
    const bad = blockSubtaskSchema.safeParse({
      projectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      subtaskId: "9b2b7c9e-3a4d-4c5e-8f6a-1b2c3d4e5f60",
      reason: "",
    });
    expect(bad.success).toBe(false);
    const good = blockSubtaskSchema.safeParse({
      projectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      subtaskId: "9b2b7c9e-3a4d-4c5e-8f6a-1b2c3d4e5f60",
      reason: "Waiting on vendor",
    });
    expect(good.success).toBe(true);
  });

  it("manual parent progress override REQUIRES a reason", () => {
    const bad = overrideParentProgressSchema.safeParse({
      projectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      taskId: "9b2b7c9e-3a4d-4c5e-8f6a-1b2c3d4e5f60",
      progress: 80,
    });
    expect(bad.success).toBe(false);
  });

  it("closing a parent with incomplete subtasks REQUIRES a reason", () => {
    const bad = closeParentWithIncompleteSchema.safeParse({
      projectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      taskId: "9b2b7c9e-3a4d-4c5e-8f6a-1b2c3d4e5f60",
      reason: "",
    });
    expect(bad.success).toBe(false);
  });

  it("creating a subtask requires a title", () => {
    const bad = createSubtaskSchema.safeParse({
      projectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      taskId: "9b2b7c9e-3a4d-4c5e-8f6a-1b2c3d4e5f60",
      title: "",
    });
    expect(bad.success).toBe(false);
  });
});

describe("RBAC (deny-by-default)", () => {
  it("owner/admin can do everything, including restricted ops", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(authorizeSubtaskAction({ role, userId: "u", action: "delete" }).allowed).toBe(true);
      expect(authorizeSubtaskAction({ role, userId: "u", action: "override_parent_progress" }).allowed).toBe(true);
      expect(authorizeSubtaskAction({ role, userId: "u", action: "close_parent_with_incomplete" }).allowed).toBe(true);
    }
  });

  it("viewer is read-only", () => {
    expect(authorizeSubtaskAction({ role: "viewer", userId: "u", action: "create" }).allowed).toBe(false);
    expect(authorizeSubtaskAction({ role: "viewer", userId: "u", action: "update" }).allowed).toBe(false);
  });

  it("member can create, and update only their OWN work (subtask owner or task assignee)", () => {
    expect(authorizeSubtaskAction({ role: "member", userId: "u1", action: "create" }).allowed).toBe(true);
    expect(
      authorizeSubtaskAction({ role: "member", userId: "u1", action: "update", subtaskOwnerId: "u1" }).allowed,
    ).toBe(true);
    expect(
      authorizeSubtaskAction({ role: "member", userId: "u1", action: "complete", taskAssignedTo: "u1" }).allowed,
    ).toBe(true);
    expect(
      authorizeSubtaskAction({ role: "member", userId: "u1", action: "update", subtaskOwnerId: "u2", taskAssignedTo: "u3" }).allowed,
    ).toBe(false);
  });

  it("restricted actions are NEVER allowed for members (even on own work)", () => {
    for (const action of ["delete", "override_parent_progress", "close_parent_with_incomplete"] as const) {
      expect(
        authorizeSubtaskAction({ role: "member", userId: "u1", action, subtaskOwnerId: "u1" }).allowed,
      ).toBe(false);
    }
  });
});

