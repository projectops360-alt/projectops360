import { describe, it, expect } from "vitest";
import {
  edgeTaskStatusKey,
  normalizeEdgeTasks,
  limitTasks,
  type EdgeTaskRaw,
} from "../edge-task-tooltip";

// UX-008 — Living Graph edge task tooltip. Deterministic status + safe parsing.

describe("UX-008 — edgeTaskStatusKey (canonical, REG-008/010 aware)", () => {
  it("a completed task with a stale is_blocked flag is Done, not Blocked", () => {
    expect(edgeTaskStatusKey({ status: "done", isBlocked: true })).toBe("done");
    expect(edgeTaskStatusKey({ status: "tested", isBlocked: true })).toBe("done");
  });

  it("an active blocked task is Blocked", () => {
    expect(edgeTaskStatusKey({ status: "blocked", isBlocked: false })).toBe("blocked");
    expect(edgeTaskStatusKey({ status: "in_progress", isBlocked: true })).toBe("blocked");
  });

  it("distinguishes Waiting from Blocked", () => {
    expect(edgeTaskStatusKey({ status: "not_started", isBlocked: false, isWaiting: true })).toBe("waiting");
    expect(edgeTaskStatusKey({ status: "blocked", isBlocked: false, isWaiting: true })).toBe("blocked"); // blocked wins
  });

  it("maps in-progress and pending statuses", () => {
    expect(edgeTaskStatusKey({ status: "in_progress", isBlocked: false })).toBe("in_progress");
    expect(edgeTaskStatusKey({ status: "not_started", isBlocked: false })).toBe("pending");
    expect(edgeTaskStatusKey({ status: null, isBlocked: false })).toBe("pending");
  });

  it("maps deferred and cancelled", () => {
    expect(edgeTaskStatusKey({ status: "deferred", isBlocked: false })).toBe("deferred");
    expect(edgeTaskStatusKey({ status: "cancelled", isBlocked: false })).toBe("cancelled");
  });
});

describe("UX-008 — normalizeEdgeTasks (no invention)", () => {
  it("reads a valid task list", () => {
    const raw = [{ id: "t1", title: "Configure credentials", status: "in_progress", isBlocked: false }];
    const out = normalizeEdgeTasks(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "t1", title: "Configure credentials", status: "in_progress" });
  });

  it("drops items without an id or title (never invents an empty task)", () => {
    const raw = [{ id: "", title: "X" }, { id: "t2", title: "" }, { id: "t3", title: "   " }, { foo: 1 }];
    expect(normalizeEdgeTasks(raw)).toHaveLength(0);
  });

  it("returns [] for non-array / missing input (safe fallback)", () => {
    expect(normalizeEdgeTasks(undefined)).toEqual([]);
    expect(normalizeEdgeTasks(null)).toEqual([]);
    expect(normalizeEdgeTasks("nope")).toEqual([]);
  });

  it("omits missing optional owner/priority/dueDate (null, not invented)", () => {
    const out = normalizeEdgeTasks([{ id: "t1", title: "A", status: "done", isBlocked: false }]);
    expect(out[0].ownerName).toBeNull();
    expect(out[0].priority).toBeNull();
    expect(out[0].dueDate).toBeNull();
  });
});

describe("UX-008 — limitTasks (+N more)", () => {
  const tasks: EdgeTaskRaw[] = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`, title: `Task ${i}`, status: "not_started", isBlocked: false,
  }));

  it("shows all when under the limit", () => {
    const { shown, moreCount } = limitTasks(tasks.slice(0, 5), 7);
    expect(shown).toHaveLength(5);
    expect(moreCount).toBe(0);
  });

  it("truncates and reports the remainder", () => {
    const { shown, moreCount } = limitTasks(tasks, 7);
    expect(shown).toHaveLength(7);
    expect(moreCount).toBe(3);
  });
});
