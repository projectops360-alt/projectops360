import { describe, it, expect } from "vitest";
import {
  hasActiveBlocker,
  effectiveIsBlocked,
  isActiveStatus,
  isTerminalStatus,
  isCompletedStatus,
  isUnassigned,
} from "@/lib/execution/task-activity";
import type { RoadmapTask } from "@/types/database";

describe("REG-010 — canonical blocker semantics", () => {
  it("a Done task with a stale is_blocked flag is NOT a blocker", () => {
    const t = { status: "done", is_blocked: true } as RoadmapTask;
    expect(hasActiveBlocker(t)).toBe(false);
    expect(effectiveIsBlocked(t)).toBe(false);
  });

  it("a Tested/Implemented/Deferred/Cancelled task is never blocked", () => {
    for (const status of ["tested", "implemented", "deferred", "cancelled"]) {
      expect(hasActiveBlocker({ status, is_blocked: true } as unknown as RoadmapTask)).toBe(false);
    }
  });

  it("an in-progress task with is_blocked is a blocker", () => {
    expect(hasActiveBlocker({ status: "in_progress", is_blocked: true } as RoadmapTask)).toBe(true);
  });

  it("status === 'blocked' counts as a blocker", () => {
    expect(hasActiveBlocker({ status: "blocked", is_blocked: false } as RoadmapTask)).toBe(true);
  });

  it("a normal active task is not a blocker", () => {
    expect(hasActiveBlocker({ status: "in_progress", is_blocked: false } as RoadmapTask)).toBe(false);
  });

  it("terminal/active/completed classification", () => {
    expect(isTerminalStatus("done")).toBe(true);
    expect(isCompletedStatus("done")).toBe(true);
    expect(isTerminalStatus("deferred")).toBe(true);
    expect(isCompletedStatus("deferred")).toBe(false); // terminal but not "completed work"
    expect(isActiveStatus("in_progress")).toBe(true);
    expect(isActiveStatus("done")).toBe(false);
  });

  it("isUnassigned is independent of blocker logic", () => {
    expect(isUnassigned({ assigned_to: null, assigned_resource_id: null } as RoadmapTask)).toBe(true);
    expect(isUnassigned({ assigned_to: "u1", assigned_resource_id: null } as RoadmapTask)).toBe(false);
    expect(isUnassigned({ assigned_to: null, assigned_resource_id: "r1" } as RoadmapTask)).toBe(false);
  });
});
