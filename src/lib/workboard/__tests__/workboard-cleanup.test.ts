// ============================================================================
// WORKBOARD-CLEANUP — delete no-milestone tasks & persistent backlog ordering
// ============================================================================
// Protects the Workboard Cleanup behavior (pre-Phase 4 reliability queue):
//   1. Safe delete exists ONLY for tasks WITHOUT a milestone; tasks with a
//      milestone never show the option; a confirmation dialog gates the action;
//      the delete goes through archiveTaskAction (org-scoped soft delete +
//      audit — RBAC path, never a raw client write).
//   2. Backlog drag order PERSISTS across refresh/navigation: the drag writes
//      order_index and the server-side re-sort (topologicalSortTasks — the
//      exact function the Workboard page runs) returns no-milestone tasks in
//      that persisted order. Reordering never changes status or milestone and
//      never duplicates/loses tasks (extends WORKBOARD-DND-MILESTONE-FILTER).
//   3. The Living Graph UX-008 tooltip uses the SAME persisted order: the
//      REG-018 census sorts taskList by (order_index, created_at, id) — a
//      deterministic fallback independent of the caller's fetch order.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyBoardDrag } from "@/lib/workboard/reorder";
import { topologicalSortTasks } from "@/lib/roadmap/topological-sort";
import { computeMilestoneTaskCensus } from "@/lib/roadmap/milestone-task-census";
import type { RoadmapTask, Milestone } from "@/types/database";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

// Minimal task fixture — only the fields the functions under test read.
function task(
  id: string,
  order_index: number,
  overrides: Partial<RoadmapTask> = {},
): RoadmapTask {
  return {
    id,
    order_index,
    status: "not_started",
    milestone_id: null,
    title: `Task ${id}`,
    is_blocked: false,
    created_at: `2026-01-0${(order_index % 8) + 1}T00:00:00.000Z`,
    ...overrides,
  } as RoadmapTask;
}

const ids = (arr: { id: string }[]) => arr.map((x) => x.id);

// ── 1. Backlog reorder persists through the server-side re-sort ──────────────

describe("backlog (no-milestone) drag order persists across refresh", () => {
  const backlog = [task("a", 0), task("b", 1), task("c", 2), task("d", 3)];

  it("dragging within Not Started + the page's topological re-sort returns the dragged order", () => {
    // 1. The user drags "a" below "c" on the board.
    const drag = applyBoardDrag({
      tasks: backlog,
      draggableId: "task-a",
      source: { droppableId: "not_started", index: 0 },
      destination: { droppableId: "not_started", index: 2 },
    })!;
    expect(drag.statusChanged).toBe(false);

    // 2. reorderTasksAction persists drag.orderUpdates → simulate the stored rows.
    const persisted = drag.tasks.map((t) => {
      const upd = drag.orderUpdates.find((u) => u.id === t.id);
      return upd ? { ...t, order_index: upd.order_index } : t;
    }) as RoadmapTask[];

    // 3. A refresh re-runs the page pipeline: DB order + topologicalSortTasks.
    const dbOrder = [...persisted].sort((x, y) => x.order_index - y.order_index);
    const { sorted } = topologicalSortTasks(dbOrder, [], []);
    expect(ids(sorted)).toEqual(["b", "c", "a", "d"]);
  });

  it("reordering changes neither status nor milestone and never loses/duplicates tasks", () => {
    const drag = applyBoardDrag({
      tasks: backlog,
      draggableId: "task-d",
      source: { droppableId: "not_started", index: 3 },
      destination: { droppableId: "not_started", index: 0 },
    })!;
    expect(drag.tasks).toHaveLength(backlog.length);
    expect(new Set(ids(drag.tasks)).size).toBe(backlog.length);
    for (const t of drag.tasks) {
      expect(t.status).toBe("not_started");
      expect((t as RoadmapTask).milestone_id).toBeNull();
    }
    // orderUpdates only carry id + order_index — no status/milestone writes.
    for (const u of drag.orderUpdates) {
      expect(Object.keys(u).sort()).toEqual(["id", "order_index"]);
    }
  });

  it("dependency order still wins over drag order (dependency-aware sorting preserved)", () => {
    // b depends on c: even if b was dragged above c, the refresh keeps c first.
    const persisted = [task("b", 0), task("c", 1)];
    const { sorted } = topologicalSortTasks(
      persisted,
      [{ id: "dep1", organization_id: "o", project_id: "p", predecessor_id: "c", successor_id: "b", dependency_type: "finish_to_start", lag_days: 0, created_at: "" }],
      [],
    );
    expect(ids(sorted)).toEqual(["c", "b"]);
  });
});

// ── 2. Census / UX-008 tooltip order is the persisted board order ─────────────

describe("REG-018 census taskList uses the persisted, deterministic order", () => {
  const M = "11111111-1111-4111-8111-111111111111";

  it("sorts taskList by order_index regardless of the caller's fetch order", () => {
    const shuffled = [
      task("x", 2, { milestone_id: M }),
      task("z", 0, { milestone_id: M }),
      task("y", 1, { milestone_id: M }),
    ];
    const census = computeMilestoneTaskCensus(shuffled).get(M)!;
    expect(ids(census.taskList)).toEqual(["z", "y", "x"]);
  });

  it("breaks order_index ties deterministically (created_at, then id)", () => {
    const tied = [
      task("b", 5, { milestone_id: M, created_at: "2026-02-02T00:00:00.000Z" }),
      task("a", 5, { milestone_id: M, created_at: "2026-02-01T00:00:00.000Z" }),
      task("d", 5, { milestone_id: M, created_at: "2026-02-03T00:00:00.000Z" }),
      task("c", 5, { milestone_id: M, created_at: "2026-02-03T00:00:00.000Z" }),
    ];
    const forward = computeMilestoneTaskCensus(tied).get(M)!;
    const reversed = computeMilestoneTaskCensus([...tied].reverse()).get(M)!;
    expect(ids(forward.taskList)).toEqual(["a", "b", "c", "d"]);
    expect(ids(reversed.taskList)).toEqual(ids(forward.taskList));
  });

  it("does not change census counts (REG-018 semantics intact)", () => {
    const tasks = [
      task("a", 1, { milestone_id: M, status: "done" }),
      task("b", 0, { milestone_id: M, status: "in_progress" }),
      task("c", 2, { milestone_id: M, status: "not_started" }),
    ];
    const census = computeMilestoneTaskCensus(tasks).get(M)!;
    expect(census.tasksTotal).toBe(3);
    expect(census.tasksDone).toBe(1);
    expect(census.tasksStarted).toBe(1);
  });

  it("board order and tooltip order agree for the same inputs (same truth)", () => {
    const tasks = [
      task("n2", 1, { milestone_id: M }),
      task("n1", 0, { milestone_id: M }),
      task("n3", 2, { milestone_id: M }),
    ];
    const { sorted } = topologicalSortTasks(tasks, [], [{ id: M, order_index: 0 } as Milestone]);
    const census = computeMilestoneTaskCensus(tasks).get(M)!;
    expect(ids(census.taskList)).toEqual(ids(sorted));
  });
});

// ── 3. Source guards: delete gated + confirmed + RBAC path ────────────────────

describe("workboard delete option (source guards)", () => {
  const boardSrc = read("src/app/[locale]/(app)/projects/[projectId]/workboard/workboard-client.tsx");

  it("renders the delete button ONLY for tasks without a milestone", () => {
    const gate = boardSrc.indexOf("{!task.milestone_id && (");
    const button = boardSrc.indexOf("workboard-delete-no-milestone");
    expect(gate).toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(gate); // the button lives inside the gate
  });

  it("requires an explicit confirmation dialog before deleting", () => {
    expect(boardSrc).toContain("pendingDelete");
    expect(boardSrc).toContain("workboard-delete-confirm");
    expect(boardSrc).toContain('role="alertdialog"');
    // The action fires only from the confirm handler, which re-checks the gate.
    expect(boardSrc).toContain("if (pendingDelete.milestone_id)");
    expect(boardSrc.match(/archiveTaskAction\(/g)?.length).toBe(1);
  });

  it("deletes through the audited server action (RBAC), never a raw write", () => {
    expect(boardSrc).toContain("archiveTaskAction(pendingDelete.id, projectId)");
    expect(boardSrc).not.toContain("@/lib/supabase");
    expect(boardSrc).not.toContain(".delete()");
  });

  it("uses i18n cleanup labels (no hardcoded single-language strings)", () => {
    expect(boardSrc).toContain("t.cleanup.confirmTitle");
    expect(boardSrc).toContain("t.cleanup.confirmDelete");
    expect(boardSrc).toContain("t.cleanup.cancel");
  });
});
