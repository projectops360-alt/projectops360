// ============================================================================
// Workboard reorder / cross-column move guards (WORKBOARD-DND-MILESTONE-FILTER)
// ============================================================================
// Protects same-column reordering (order persists, status unchanged, no loss/
// duplication), cross-column moves (status changes, destination order updates,
// empty/short columns accept the task), drop-outside no-ops, and filtered-view
// safety (hidden tasks keep their relative order — no corruption).
// ============================================================================

import { describe, it, expect } from "vitest";
import { applyBoardDrag, taskIdFromDraggableId, type BoardTaskLike } from "@/lib/workboard/reorder";

interface T extends BoardTaskLike {
  id: string;
  status: string;
  order_index: number;
  milestone_id?: string | null;
}

function t(id: string, status: string, order_index: number, milestone_id: string | null = null): T {
  return { id, status, order_index, milestone_id };
}

const ids = (arr: { id: string }[]) => arr.map((x) => x.id);
const col = (tasks: T[], status: string) => tasks.filter((x) => x.status === status);

describe("taskIdFromDraggableId", () => {
  it("strips the task- prefix, leaves raw ids", () => {
    expect(taskIdFromDraggableId("task-abc")).toBe("abc");
    expect(taskIdFromDraggableId("abc")).toBe("abc");
  });
});

describe("same-column reorder", () => {
  const tasks = [t("a", "todo", 0), t("b", "todo", 1), t("c", "todo", 2)];

  it("moves a task down and renumbers order_index", () => {
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-a",
      source: { droppableId: "todo", index: 0 },
      destination: { droppableId: "todo", index: 2 },
    })!;
    expect(res).not.toBeNull();
    expect(res.statusChanged).toBe(false);
    expect(ids(col(res.tasks, "todo"))).toEqual(["b", "c", "a"]);
    expect(res.orderUpdates).toEqual([
      { id: "b", order_index: 0 },
      { id: "c", order_index: 1 },
      { id: "a", order_index: 2 },
    ]);
  });

  it("does not change any task status", () => {
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-c",
      source: { droppableId: "todo", index: 2 },
      destination: { droppableId: "todo", index: 0 },
    })!;
    expect(res.tasks.every((x) => x.status === "todo")).toBe(true);
  });

  it("never loses or duplicates tasks", () => {
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-b",
      source: { droppableId: "todo", index: 1 },
      destination: { droppableId: "todo", index: 0 },
    })!;
    expect(res.tasks).toHaveLength(3);
    expect(new Set(ids(res.tasks)).size).toBe(3);
  });

  it("is a no-op when dropped at the same index", () => {
    expect(
      applyBoardDrag({
        tasks,
        draggableId: "task-b",
        source: { droppableId: "todo", index: 1 },
        destination: { droppableId: "todo", index: 1 },
      }),
    ).toBeNull();
  });

  it("returns null for an unknown draggable", () => {
    expect(
      applyBoardDrag({
        tasks,
        draggableId: "task-zzz",
        source: { droppableId: "todo", index: 0 },
        destination: { droppableId: "todo", index: 1 },
      }),
    ).toBeNull();
  });
});

describe("cross-column move", () => {
  const tasks = [
    t("a", "todo", 0),
    t("b", "todo", 1),
    t("c", "todo", 2),
    t("x", "doing", 0),
  ];

  it("changes status and inserts at the drop index in the destination", () => {
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-a",
      source: { droppableId: "todo", index: 0 },
      destination: { droppableId: "doing", index: 0 },
    })!;
    expect(res.statusChanged).toBe(true);
    expect(res.toStatus).toBe("doing");
    expect(res.tasks.find((x) => x.id === "a")!.status).toBe("doing");
    expect(ids(col(res.tasks, "doing"))).toEqual(["a", "x"]);
    // source column keeps its remaining tasks
    expect(ids(col(res.tasks, "todo"))).toEqual(["b", "c"]);
  });

  it("updates the destination column order_index", () => {
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-a",
      source: { droppableId: "todo", index: 0 },
      destination: { droppableId: "doing", index: 1 },
    })!;
    expect(ids(col(res.tasks, "doing"))).toEqual(["x", "a"]);
    expect(res.orderUpdates).toContainEqual({ id: "a", order_index: 1 });
  });

  it("accepts a drop into an EMPTY destination column at index 0", () => {
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-a",
      source: { droppableId: "todo", index: 0 },
      destination: { droppableId: "done", index: 0 },
    })!;
    expect(ids(col(res.tasks, "done"))).toEqual(["a"]);
    expect(res.tasks.find((x) => x.id === "a")!.status).toBe("done");
  });

  it("accepts a drop into a SHORT destination column below the last card", () => {
    // doing has 1 card; dropping at index 5 (beyond) still lands at the end.
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-a",
      source: { droppableId: "todo", index: 0 },
      destination: { droppableId: "doing", index: 5 },
    })!;
    expect(ids(col(res.tasks, "doing"))).toEqual(["x", "a"]);
  });

  it("never loses or duplicates tasks across a move", () => {
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-b",
      source: { droppableId: "todo", index: 1 },
      destination: { droppableId: "doing", index: 0 },
    })!;
    expect(res.tasks).toHaveLength(4);
    expect(new Set(ids(res.tasks)).size).toBe(4);
  });
});

describe("filtered view safety (hidden tasks keep their relative order)", () => {
  // Column order: a(mA, hidden), b(mB, visible), c(mA, hidden), d(mB, visible)
  const tasks = [
    t("a", "todo", 0, "mA"),
    t("b", "todo", 1, "mB"),
    t("c", "todo", 2, "mA"),
    t("d", "todo", 3, "mB"),
  ];
  const visibleMB = (x: T) => x.milestone_id === "mB";

  it("reorders visible tasks while preserving hidden tasks' relative order", () => {
    // Move d (visible index 1) above b (visible index 0).
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-d",
      source: { droppableId: "todo", index: 1 },
      destination: { droppableId: "todo", index: 0 },
      isVisible: visibleMB,
    })!;
    const order = ids(col(res.tasks, "todo"));
    // Visible subset now d before b:
    expect(order.filter((id) => id === "b" || id === "d")).toEqual(["d", "b"]);
    // Hidden tasks a and c keep their relative order (a before c):
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("c"));
  });

  it("does not drop or duplicate hidden tasks", () => {
    const res = applyBoardDrag({
      tasks,
      draggableId: "task-b",
      source: { droppableId: "todo", index: 0 },
      destination: { droppableId: "todo", index: 1 },
      isVisible: visibleMB,
    })!;
    expect(new Set(ids(res.tasks))).toEqual(new Set(["a", "b", "c", "d"]));
  });
});
