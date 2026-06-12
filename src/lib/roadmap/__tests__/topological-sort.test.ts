// ============================================================================
// ProjectOps360° — Topological Sort Tests
// ============================================================================
import { describe, it, expect } from "vitest";
import {
  topologicalSortTasks,
  sortTasksByMilestoneAndDependency,
} from "../topological-sort";
import type { RoadmapTask, TaskDependency, Milestone } from "@/types/database";

// ── Factory helpers ────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<RoadmapTask> & { id: string; title: string }): RoadmapTask {
  const { id, title, ...rest } = overrides;
  return {
    organization_id: "org-1",
    project_id: "proj-1",
    milestone_id: null,
    title,
    description: null,
    status: "not_started",
    priority: "p2",
    order_index: 0,
    sprint_name: null,
    estimate_hours: null,
    actual_hours: null,
    dependency_notes: null,
    acceptance_criteria: null,
    external_key: null,
    prompt_body: null,
    prompt_context: null,
    ai_tool_target: null,
    implementation_notes: null,
    test_notes: null,
    execution_notes: null,
    blocker_reason: null,
    start_date: null,
    end_date: null,
    progress: null,
    duration_days: null,
    is_critical: false,
    slack_days: null,
    earliest_start: null,
    earliest_finish: null,
    latest_start: null,
    latest_finish: null,
    deleted_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    id,
    ...rest,
  } as RoadmapTask;
}

function makeDep(overrides: Partial<TaskDependency> & { predecessor_id: string; successor_id: string }): TaskDependency {
  return {
    id: `dep-${overrides.predecessor_id}-${overrides.successor_id}`,
    organization_id: "org-1",
    project_id: "proj-1",
    dependency_type: "finish_to_start",
    lag_days: 0,
    created_at: "2026-01-01",
    ...overrides,
  } as TaskDependency;
}

function makeMilestone(overrides: Partial<Milestone> & { id: string; title: string }): Milestone {
  const { id, title, ...rest } = overrides;
  return {
    organization_id: "org-1",
    project_id: "proj-1",
    title,
    description: null,
    status: "planned",
    progress_percent: 0,
    start_date: null,
    target_date: null,
    icon_key: "setup",
    order_index: 0,
    status_override_enabled: false,
    status_override_value: null,
    deleted_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    id,
    ...rest,
  } as Milestone;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("topologicalSortTasks", () => {
  it("returns empty array for empty input", () => {
    const result = topologicalSortTasks([], []);
    expect(result.sorted).toEqual([]);
    expect(result.cycleTaskIds.size).toBe(0);
  });

  it("preserves order_index order when no dependencies exist", () => {
    const tasks = [
      makeTask({ id: "t3", title: "Third", order_index: 2 }),
      makeTask({ id: "t1", title: "First", order_index: 0 }),
      makeTask({ id: "t2", title: "Second", order_index: 1 }),
    ];

    const result = topologicalSortTasks(tasks, []);
    expect(result.sorted.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(result.cycleTaskIds.size).toBe(0);
  });

  it("sorts a simple chain A→B→C", () => {
    const a = makeTask({ id: "a", title: "A", order_index: 2 });
    const b = makeTask({ id: "b", title: "B", order_index: 1 });
    const c = makeTask({ id: "c", title: "C", order_index: 0 });

    // B depends on A, C depends on B
    const deps = [
      makeDep({ predecessor_id: "a", successor_id: "b" }),
      makeDep({ predecessor_id: "b", successor_id: "c" }),
    ];

    const result = topologicalSortTasks([c, b, a], deps);
    expect(result.sorted.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts diamond dependency A→B, A→C, B→D, C→D", () => {
    const a = makeTask({ id: "a", title: "A", order_index: 0 });
    const b = makeTask({ id: "b", title: "B", order_index: 1 });
    const c = makeTask({ id: "c", title: "C", order_index: 2 });
    const d = makeTask({ id: "d", title: "D", order_index: 3 });

    const deps = [
      makeDep({ predecessor_id: "a", successor_id: "b" }),
      makeDep({ predecessor_id: "a", successor_id: "c" }),
      makeDep({ predecessor_id: "b", successor_id: "d" }),
      makeDep({ predecessor_id: "c", successor_id: "d" }),
    ];

    const result = topologicalSortTasks([d, c, b, a], deps);
    const ids = result.sorted.map((t) => t.id);

    // A must come first, D must come last
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("d"));
    expect(ids.indexOf("c")).toBeLessThan(ids.indexOf("d"));
    expect(ids[0]).toBe("a");
    expect(ids[ids.length - 1]).toBe("d");
  });

  it("handles cross-milestone dependencies", () => {
    const m1 = "milestone-1";
    const m2 = "milestone-2";

    // Task in milestone 2 depends on task in milestone 1
    const foundation = makeTask({ id: "foundation", title: "Foundation", milestone_id: m1, order_index: 0 });
    const pipeline = makeTask({ id: "pipeline", title: "Pipeline", milestone_id: m2, order_index: 0 });

    const deps = [
      makeDep({ predecessor_id: "foundation", successor_id: "pipeline" }),
    ];

    const result = topologicalSortTasks([pipeline, foundation], deps);
    // Foundation must come before Pipeline even though Pipeline has lower milestone order_index in its group
    expect(result.sorted[0].id).toBe("foundation");
    expect(result.sorted[1].id).toBe("pipeline");
  });

  it("detects cycles and places cycle members at end", () => {
    const a = makeTask({ id: "a", title: "A", order_index: 0 });
    const b = makeTask({ id: "b", title: "B", order_index: 1 });
    const c = makeTask({ id: "c", title: "C", order_index: 2 });

    // Cycle: a → b → c → a
    const deps = [
      makeDep({ predecessor_id: "a", successor_id: "b" }),
      makeDep({ predecessor_id: "b", successor_id: "c" }),
      makeDep({ predecessor_id: "c", successor_id: "a" }),
    ];

    const result = topologicalSortTasks([a, b, c], deps);
    // All three are in a cycle, so all go to cycle detection
    expect(result.sorted.length).toBe(3);
    expect(result.cycleTaskIds.size).toBe(3);
    expect(result.cycleTaskIds.has("a")).toBe(true);
    expect(result.cycleTaskIds.has("b")).toBe(true);
    expect(result.cycleTaskIds.has("c")).toBe(true);
  });

  it("handles partial cycle — non-cycle tasks sorted normally, cycle at end", () => {
    const a = makeTask({ id: "a", title: "A", order_index: 0 });
    const b = makeTask({ id: "b", title: "B", order_index: 1 });
    const c = makeTask({ id: "c", title: "C", order_index: 2 });
    const d = makeTask({ id: "d", title: "D", order_index: 3 });

    // A → B (normal), C → D → C (cycle)
    const deps = [
      makeDep({ predecessor_id: "a", successor_id: "b" }),
      makeDep({ predecessor_id: "c", successor_id: "d" }),
      makeDep({ predecessor_id: "d", successor_id: "c" }),
    ];

    const result = topologicalSortTasks([d, c, b, a], deps);
    const ids = result.sorted.map((t) => t.id);

    // A and B should come first in order
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    // C and D are in a cycle — should be at the end
    expect(result.cycleTaskIds.has("c")).toBe(true);
    expect(result.cycleTaskIds.has("d")).toBe(true);
    expect(result.cycleTaskIds.has("a")).toBe(false);
    expect(result.cycleTaskIds.has("b")).toBe(false);
  });

  it("only finish_to_start and start_to_start affect ordering", () => {
    const a = makeTask({ id: "a", title: "A", order_index: 0 });
    const b = makeTask({ id: "b", title: "B", order_index: 1 });

    // start_to_finish and finish_to_finish should NOT affect ordering
    const noOrderDeps = [
      makeDep({ predecessor_id: "a", successor_id: "b", dependency_type: "start_to_finish" }),
      makeDep({ predecessor_id: "a", successor_id: "b", dependency_type: "finish_to_finish" }),
    ];

    // With only non-ordering types, should fall back to order_index (A before B)
    const result = topologicalSortTasks([b, a], noOrderDeps);
    expect(result.sorted.map((t) => t.id)).toEqual(["a", "b"]);

    // But finish_to_start DOES affect ordering
    const orderDep = [
      makeDep({ predecessor_id: "a", successor_id: "b", dependency_type: "finish_to_start" }),
    ];
    const result2 = topologicalSortTasks([b, a], orderDep);
    expect(result2.sorted.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("ignores orphan edges referencing unknown task IDs", () => {
    const a = makeTask({ id: "a", title: "A", order_index: 0 });
    const b = makeTask({ id: "b", title: "B", order_index: 1 });

    const deps = [
      makeDep({ predecessor_id: "a", successor_id: "b" }),
      makeDep({ predecessor_id: "unknown", successor_id: "b" }), // orphan
      makeDep({ predecessor_id: "a", successor_id: "missing" }),  // orphan
    ];

    const result = topologicalSortTasks([b, a], deps);
    expect(result.sorted.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("uses milestone_id as primary sort key within same topological level", () => {
    const m1 = "m1";
    const m2 = "m2";

    // Two independent tasks in different milestones, same order_index
    const t1 = makeTask({ id: "t1", title: "Task 1", milestone_id: m1, order_index: 0 });
    const t2 = makeTask({ id: "t2", title: "Task 2", milestone_id: m2, order_index: 0 });

    // No dependencies — both at topological level 0
    const result = topologicalSortTasks([t2, t1], []);
    // milestone_id groups come first (nulls last) — but both have milestones
    // So they should be sorted by order_index (same), then by id
    expect(result.sorted[0].id).toBe("t1");
    expect(result.sorted[1].id).toBe("t2");
  });

  it("skips self-referencing edges", () => {
    const a = makeTask({ id: "a", title: "A", order_index: 0 });

    const deps = [
      makeDep({ predecessor_id: "a", successor_id: "a" }), // self-reference
    ];

    const result = topologicalSortTasks([a], deps);
    expect(result.sorted.map((t) => t.id)).toEqual(["a"]);
    expect(result.cycleTaskIds.size).toBe(0);
  });
});

describe("sortTasksByMilestoneAndDependency", () => {
  it("groups tasks by milestone in milestone order", () => {
    const m1 = makeMilestone({ id: "m1", title: "M1", order_index: 0 });
    const m2 = makeMilestone({ id: "m2", title: "M2", order_index: 1 });

    const t1 = makeTask({ id: "t1", title: "T1", milestone_id: "m2", order_index: 0 });
    const t2 = makeTask({ id: "t2", title: "T2", milestone_id: "m1", order_index: 0 });

    const result = sortTasksByMilestoneAndDependency([t1, t2], [], [m1, m2]);

    // Keys should be in milestone order
    expect(Object.keys(result)).toEqual(["m1", "m2", "__unassigned"]);
    expect(result["m1"].map((t) => t.id)).toEqual(["t2"]);
    expect(result["m2"].map((t) => t.id)).toEqual(["t1"]);
  });

  it("places unassigned tasks in __unassigned group", () => {
    const m1 = makeMilestone({ id: "m1", title: "M1", order_index: 0 });

    const t1 = makeTask({ id: "t1", title: "T1", milestone_id: "m1", order_index: 0 });
    const t2 = makeTask({ id: "t2", title: "T2", milestone_id: null, order_index: 0 });

    const result = sortTasksByMilestoneAndDependency([t1, t2], [], [m1]);

    expect(result["m1"].map((t) => t.id)).toEqual(["t1"]);
    expect(result["__unassigned"].map((t) => t.id)).toEqual(["t2"]);
  });

  it("respects dependency order within milestone groups", () => {
    const m1 = makeMilestone({ id: "m1", title: "M1", order_index: 0 });

    const foundation = makeTask({ id: "foundation", title: "Foundation", milestone_id: "m1", order_index: 1 });
    const pipeline = makeTask({ id: "pipeline", title: "Pipeline", milestone_id: "m1", order_index: 0 });

    const deps = [
      makeDep({ predecessor_id: "foundation", successor_id: "pipeline" }),
    ];

    const result = sortTasksByMilestoneAndDependency(
      [pipeline, foundation],
      deps,
      [m1],
    );

    // Foundation must come before Pipeline despite lower order_index
    expect(result["m1"].map((t) => t.id)).toEqual(["foundation", "pipeline"]);
  });
});