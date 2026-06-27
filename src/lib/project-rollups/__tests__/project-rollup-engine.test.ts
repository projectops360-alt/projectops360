import { describe, it, expect } from "vitest";
import { computeProjectExecutionRollup } from "@/lib/project-rollups/project-rollup-engine";
import type { RoadmapTask, Milestone, TaskDependency } from "@/types/database";

const M = (id: string, over?: Partial<Milestone>): Milestone =>
  ({ id, status: "planned", status_override_enabled: false, status_override_value: null, order_index: 0, progress_percent: 0, title: id } as unknown as Milestone);

const T = (over: Partial<RoadmapTask>): RoadmapTask =>
  ({
    id: "t", project_id: "p", milestone_id: "m1", status: "in_progress", priority: "p2",
    is_blocked: false, assigned_to: "u1", assigned_resource_id: null, estimate_hours: 4,
    end_date: null, deleted_at: null, ...over,
  } as unknown as RoadmapTask);

describe("REG-010 — project rollup engine (Mobile App Design fixture)", () => {
  it("a Done task with a stale is_blocked flag does NOT inflate active blockers", () => {
    const tasks = [
      T({ id: "done-stale", status: "done", is_blocked: true }), // the real "Delivery Date Compliance Report"
      T({ id: "live-1", status: "in_progress" }),
    ];
    const r = computeProjectExecutionRollup({ tasks, milestones: [M("m1")] });
    expect(r.activeBlockers.value).toBe(0);
    expect(r.activeBlockers.evidenceIds).toEqual([]);
  });

  it("counts only explicit, non-terminal impediments as blockers", () => {
    const tasks = [
      T({ id: "b1", status: "blocked" }),
      T({ id: "b2", status: "in_progress", is_blocked: true }),
      T({ id: "ok", status: "in_progress" }),
      T({ id: "doneflag", status: "done", is_blocked: true }),
    ];
    const r = computeProjectExecutionRollup({ tasks, milestones: [M("m1")] });
    expect(r.activeBlockers.value).toBe(2);
    expect(r.activeBlockers.evidenceIds.sort()).toEqual(["b1", "b2"]);
  });

  it("priority mix excludes terminal tasks", () => {
    const tasks = [
      T({ id: "a", priority: "p1", status: "in_progress" }),
      T({ id: "b", priority: "p1", status: "done" }), // terminal → excluded
      T({ id: "c", priority: "p3", status: "not_started" }),
    ];
    const r = computeProjectExecutionRollup({ tasks, milestones: [M("m1")] });
    expect(r.priorityActive.p1.value).toBe(1);
    expect(r.priorityActive.p3.value).toBe(1);
  });

  it("waiting-on-dependency excludes blocked tasks and completed predecessors", () => {
    const tasks = [
      T({ id: "pred-open", status: "in_progress" }),
      T({ id: "pred-done", status: "done" }),
      T({ id: "succ-waiting", status: "not_started" }), // waits on pred-open (open)
      T({ id: "succ-ready", status: "not_started" }), // waits on pred-done (complete) → not waiting
      T({ id: "succ-blocked", status: "blocked" }), // blocked, reported separately
    ];
    const deps: TaskDependency[] = [
      { predecessor_id: "pred-open", successor_id: "succ-waiting" } as TaskDependency,
      { predecessor_id: "pred-done", successor_id: "succ-ready" } as TaskDependency,
      { predecessor_id: "pred-open", successor_id: "succ-blocked" } as TaskDependency,
    ];
    const r = computeProjectExecutionRollup({ tasks, milestones: [M("m1")], dependencies: deps });
    expect(r.waitingOnDependency.evidenceIds).toEqual(["succ-waiting"]);
    expect(r.activeBlockers.value).toBe(1); // succ-blocked
  });

  it("capacity warnings (no owner / no estimate) are separate from blockers", () => {
    const tasks = [
      T({ id: "noowner", assigned_to: null, assigned_resource_id: null }),
      T({ id: "noest", estimate_hours: null }),
      T({ id: "donenoowner", status: "done", assigned_to: null, assigned_resource_id: null }), // terminal → excluded
    ];
    const r = computeProjectExecutionRollup({ tasks, milestones: [M("m1")] });
    expect(r.unassignedActive.value).toBe(1);
    expect(r.missingEstimateActive.value).toBe(1);
    expect(r.activeBlockers.value).toBe(0);
  });

  it("counts reflect active vs completed scope", () => {
    const tasks = [
      T({ id: "a", status: "in_progress" }),
      T({ id: "b", status: "done" }),
      T({ id: "c", status: "tested" }),
    ];
    const r = computeProjectExecutionRollup({ tasks, milestones: [M("m1")] });
    expect(r.counts).toMatchObject({ totalTasks: 3, activeTasks: 1, completedTasks: 2 });
  });
});
