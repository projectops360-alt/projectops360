import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LAYOUT_SCHEMA_VERSION,
  buildLayoutKey,
  loadSavedLayout,
  saveLayout,
  clearSavedLayout,
  hasSavedLayout,
  applySavedPositions,
  isPartialApply,
  type SavedGraphLayout,
} from "@/lib/graph/graph-layout-storage";

// ── In-memory localStorage mock (jsdom provides one, but we control it here) ──
function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: makeStorage() } as unknown as Window);
});

function layout(over: Partial<SavedGraphLayout> = {}): SavedGraphLayout {
  return {
    version: LAYOUT_SCHEMA_VERSION,
    projectId: "p1",
    layoutKey: "milestones",
    level: "milestones",
    layoutMode: "hierarchical",
    nodes: { a: { x: 10, y: 20 }, b: { x: 30, y: 40 } },
    viewport: { x: 5, y: 6, zoom: 1.2 },
    savedAt: "2026-06-27T00:00:00Z",
    ...over,
  };
}

describe("buildLayoutKey", () => {
  it("milestones share one key regardless of layout mode", () => {
    expect(buildLayoutKey("milestones", "hierarchical")).toBe("milestones");
    expect(buildLayoutKey("milestones", "force")).toBe("milestones");
  });
  it("other levels key by level + layout mode", () => {
    expect(buildLayoutKey("activities", "hierarchical")).toBe("activities:hierarchical");
    expect(buildLayoutKey("activities", "force")).toBe("activities:force");
    expect(buildLayoutKey("events", "timeline")).toBe("events:timeline");
  });
});

describe("save / load / clear (TASK 4 + TASK 6)", () => {
  it("a saved layout restores after a reload (round-trip)", () => {
    expect(saveLayout(layout())).toBe(true);
    const loaded = loadSavedLayout("p1", "milestones");
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes.a).toEqual({ x: 10, y: 20 });
    expect(loaded!.viewport).toEqual({ x: 5, y: 6, zoom: 1.2 });
  });

  it("layouts are scoped by project and by context key (no cross-talk)", () => {
    saveLayout(layout({ projectId: "p1", layoutKey: "milestones" }));
    saveLayout(layout({ projectId: "p2", layoutKey: "milestones", nodes: { z: { x: 1, y: 1 } } }));
    saveLayout(layout({ projectId: "p1", layoutKey: "activities:force", nodes: { q: { x: 2, y: 2 } } }));

    expect(Object.keys(loadSavedLayout("p1", "milestones")!.nodes)).toEqual(["a", "b"]);
    expect(Object.keys(loadSavedLayout("p2", "milestones")!.nodes)).toEqual(["z"]);
    expect(Object.keys(loadSavedLayout("p1", "activities:force")!.nodes)).toEqual(["q"]);
    expect(loadSavedLayout("p1", "events:timeline")).toBeNull();
  });

  it("clearSavedLayout removes only that project/context layout", () => {
    saveLayout(layout({ projectId: "p1", layoutKey: "milestones" }));
    saveLayout(layout({ projectId: "p1", layoutKey: "activities:force" }));
    clearSavedLayout("p1", "milestones");
    expect(hasSavedLayout("p1", "milestones")).toBe(false);
    expect(hasSavedLayout("p1", "activities:force")).toBe(true);
  });
});

describe("invalid / unavailable storage (TASK 11 error handling)", () => {
  it("malformed JSON is treated as no layout, never throws", () => {
    window.localStorage.setItem("po360.livingGraph.layout.p1.milestones", "{not json");
    expect(loadSavedLayout("p1", "milestones")).toBeNull();
  });

  it("a payload from an incompatible schema version is ignored", () => {
    window.localStorage.setItem(
      "po360.livingGraph.layout.p1.milestones",
      JSON.stringify({ ...layout(), version: 999 }),
    );
    expect(loadSavedLayout("p1", "milestones")).toBeNull();
  });

  it("a node with non-finite coordinates invalidates the layout", () => {
    window.localStorage.setItem(
      "po360.livingGraph.layout.p1.milestones",
      JSON.stringify({ ...layout(), nodes: { a: { x: 1, y: Number.NaN } } }),
    );
    expect(loadSavedLayout("p1", "milestones")).toBeNull();
  });

  it("save returns false when storage is unavailable (no throw)", () => {
    vi.stubGlobal("window", undefined as unknown as Window);
    expect(saveLayout(layout())).toBe(false);
    expect(loadSavedLayout("p1", "milestones")).toBeNull();
  });
});

describe("applySavedPositions — graph change safety (TASK 7)", () => {
  it("applies saved positions only to nodes that still exist", () => {
    const r = applySavedPositions(layout(), ["a", "b", "c"]);
    expect(r.positions.get("a")).toEqual({ x: 10, y: 20 });
    expect(r.positions.has("c")).toBe(false); // new node → no saved position
    expect(r.matchedCount).toBe(2);
    expect(r.missingFromSaved).toBe(1); // "c" is new
    expect(r.droppedFromSaved).toBe(0);
  });

  it("ignores saved positions for deleted nodes without crashing", () => {
    const r = applySavedPositions(layout(), ["a"]); // "b" deleted
    expect(r.positions.has("b")).toBe(false);
    expect(r.droppedFromSaved).toBe(1);
    expect(r.matchedCount).toBe(1);
  });

  it("with no saved layout, every live node is unplaced (auto-layout)", () => {
    const r = applySavedPositions(null, ["a", "b"]);
    expect(r.positions.size).toBe(0);
    expect(r.missingFromSaved).toBe(2);
  });

  it("isPartialApply is false on an exact match, true when the graph changed", () => {
    expect(isPartialApply(applySavedPositions(layout(), ["a", "b"]))).toBe(false);
    expect(isPartialApply(applySavedPositions(layout(), ["a", "b", "c"]))).toBe(true); // new node
    expect(isPartialApply(applySavedPositions(layout(), ["a"]))).toBe(true); // deleted node
  });
});
