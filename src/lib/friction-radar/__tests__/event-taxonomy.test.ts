import { describe, expect, it } from "vitest";
import { FRICTION_EVENT_TAXONOMY, frictionEventSemantics } from "../event-taxonomy";

const AURORA_EVENT_TYPES = [
  "TaskAssigned", "TaskCreated", "TaskDependencyAdded", "TaskCompleted",
  "TimeLogged", "TimeEntryUpdated", "MilestoneCreated", "TaskStarted",
  "ParentTaskProgressRecalculated", "SubtaskCreated", "TaskImplemented",
  "MilestoneAchieved", "TaskTested", "SubtaskCompleted", "TaskStatusChanged",
  "MilestoneStarted", "SubtaskProgressChanged", "TaskMoved", "TaskReopened",
];

describe("Friction Radar production event taxonomy", () => {
  it("covers every event type observed in Aurora", () => {
    expect(AURORA_EVENT_TYPES.every((eventType) =>
      eventType in FRICTION_EVENT_TAXONOMY,
    )).toBe(true);
  });

  it("does not invent semantics for an unaudited event", () => {
    expect(frictionEventSemantics("ApprovalWaited")).toBeNull();
  });

  it("treats TimeEntryUpdated as restatement, never additional effort", () => {
    expect(frictionEventSemantics("TimeLogged")?.effort).toBe("contribution");
    expect(frictionEventSemantics("TimeEntryUpdated")?.effort).toBe("restatement");
  });
});
