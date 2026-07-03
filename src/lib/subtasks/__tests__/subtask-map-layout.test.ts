// ============================================================================
// SUBTASK-MAP-LAYOUT — saved-layout guards (presentation-only)
// ============================================================================
// Protects the Subtask Map saved-layout contract: coordinates persist per
// project + task + layout; a saved layout is reconciled against the live node
// set (stale positions dropped, new nodes reported for the auto-layout); load
// is SSR/exception-safe and version-gated; storage keys are scoped so two
// tasks / two layouts never collide. Coordinates only — never subtask data.
// ============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildSubtaskLayoutKey,
  loadSubtaskLayout,
  saveSubtaskLayout,
  clearSubtaskLayout,
  applySavedSubtaskPositions,
  isSubtaskLayoutPartial,
  SUBTASK_LAYOUT_SCHEMA_VERSION,
  type SavedSubtaskLayout,
} from "@/lib/subtasks/subtask-map-layout";

// jsdom-free: provide a minimal in-memory localStorage on globalThis.window.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  const storage = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: storage } as unknown as Window);
});

function layout(overrides: Partial<SavedSubtaskLayout> = {}): SavedSubtaskLayout {
  return {
    version: SUBTASK_LAYOUT_SCHEMA_VERSION,
    projectId: "proj-1",
    taskId: "task-1",
    layout: "left_to_right",
    nodes: { "task:task-1": { x: 0, y: 0 }, "subtask:s1": { x: 300, y: -60 } },
    savedAt: "2026-07-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("scoping", () => {
  it("keys by task + layout so two contexts never collide", () => {
    expect(buildSubtaskLayoutKey("t1", "radial")).toBe("t1:radial");
    expect(buildSubtaskLayoutKey("t1", "radial")).not.toBe(buildSubtaskLayoutKey("t1", "left_to_right"));
    expect(buildSubtaskLayoutKey("t1", "radial")).not.toBe(buildSubtaskLayoutKey("t2", "radial"));
  });

  it("save → load round-trips only within the same project + task + layout", () => {
    expect(saveSubtaskLayout(layout())).toBe(true);
    expect(loadSubtaskLayout("proj-1", "task-1", "left_to_right")).not.toBeNull();
    // Different layout / task / project → nothing.
    expect(loadSubtaskLayout("proj-1", "task-1", "radial")).toBeNull();
    expect(loadSubtaskLayout("proj-1", "task-2", "left_to_right")).toBeNull();
    expect(loadSubtaskLayout("proj-2", "task-1", "left_to_right")).toBeNull();
  });

  it("clear removes the saved layout", () => {
    saveSubtaskLayout(layout());
    clearSubtaskLayout("proj-1", "task-1", "left_to_right");
    expect(loadSubtaskLayout("proj-1", "task-1", "left_to_right")).toBeNull();
  });
});

describe("version gating + safety", () => {
  it("ignores a payload from an incompatible schema version", () => {
    saveSubtaskLayout(layout({ version: 999 as never }));
    expect(loadSubtaskLayout("proj-1", "task-1", "left_to_right")).toBeNull();
  });

  it("load is null (never throws) when storage is unavailable", () => {
    vi.stubGlobal("window", undefined as unknown as Window);
    expect(loadSubtaskLayout("proj-1", "task-1", "left_to_right")).toBeNull();
    expect(saveSubtaskLayout(layout())).toBe(false);
  });

  it("rejects malformed node coordinates", () => {
    (window.localStorage as Storage).setItem(
      "projectops.graph.subtaskLayout.proj-1.task-1:left_to_right",
      JSON.stringify({ version: SUBTASK_LAYOUT_SCHEMA_VERSION, nodes: { x: { x: "nope", y: 0 } } }),
    );
    expect(loadSubtaskLayout("proj-1", "task-1", "left_to_right")).toBeNull();
  });
});

describe("reconciliation (pure, presentation-only)", () => {
  it("applies saved positions only to nodes that still exist", () => {
    const result = applySavedSubtaskPositions(layout(), ["task:task-1", "subtask:s1", "subtask:new"]);
    expect(result.positions.get("task:task-1")).toEqual({ x: 0, y: 0 });
    expect(result.positions.get("subtask:s1")).toEqual({ x: 300, y: -60 });
    expect(result.positions.has("subtask:new")).toBe(false); // new node → auto-layout
    expect(result.matchedCount).toBe(2);
    expect(result.missingFromSaved).toBe(1);
    expect(result.droppedFromSaved).toBe(0);
  });

  it("drops saved positions whose node no longer exists (deleted subtask)", () => {
    const result = applySavedSubtaskPositions(layout(), ["task:task-1"]); // s1 gone
    expect(result.positions.has("subtask:s1")).toBe(false);
    expect(result.droppedFromSaved).toBe(1);
    expect(isSubtaskLayoutPartial(result)).toBe(true);
  });

  it("null saved layout → empty positions, everything reported missing", () => {
    const result = applySavedSubtaskPositions(null, ["a", "b"]);
    expect(result.positions.size).toBe(0);
    expect(result.missingFromSaved).toBe(2);
    expect(result.droppedFromSaved).toBe(0);
    // The UI only asks about "partial" when a saved layout exists; the raw
    // reconciliation reports missing nodes, so it is technically partial here.
    expect(isSubtaskLayoutPartial(result)).toBe(true);
  });

  it("a fully-matching layout is not partial", () => {
    const result = applySavedSubtaskPositions(layout(), ["task:task-1", "subtask:s1"]);
    expect(isSubtaskLayoutPartial(result)).toBe(false);
  });
});

describe("presentation-only guarantee", () => {
  it("persists ONLY coordinates + viewport — no subtask/business fields", () => {
    saveSubtaskLayout(layout({ viewport: { x: 10, y: 20, zoom: 1.2 } }));
    const raw = (window.localStorage as Storage).getItem(
      "projectops.graph.subtaskLayout.proj-1.task-1:left_to_right",
    )!;
    const parsed = JSON.parse(raw);
    expect(Object.keys(parsed).sort()).toEqual(
      ["layout", "nodes", "projectId", "savedAt", "taskId", "version", "viewport"].sort(),
    );
    // node entries are pure {x,y}.
    for (const pos of Object.values(parsed.nodes as Record<string, unknown>)) {
      expect(Object.keys(pos as object).sort()).toEqual(["x", "y"]);
    }
  });
});
