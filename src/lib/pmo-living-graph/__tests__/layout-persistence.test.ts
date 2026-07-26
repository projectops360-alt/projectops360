// ============================================================================
// CAP-048 — saved layout persistence
// Guard: PMO-LG-LAYOUT-PERSISTENCE
// ============================================================================
// Reported defect: "I move nodes in the graph and the arrangement is not kept.
// It used to work."
//
// Two independent causes, and both are the kind that regress silently, so both
// get executable guards rather than a comment.
//
//   1. A DRAG WAS NEVER WRITTEN TO STORAGE. `onNodeDragStop` only updated React
//      state; the write happened exclusively behind the "Save layout" button.
//      Anyone who dragged a node and reloaded lost the work, which is precisely
//      the report.
//
//   2. PRUNING RAN AGAINST THE VISIBLE WINDOW. Positions were loaded with
//      `liveNodeIds` = the nodes being rendered. But this canvas shows ONE
//      LEVEL at a time (portfolio → project → milestone) and filters on top of
//      that, so the rendered window is a small subset of the graph. Pruning
//      against it deleted the stored position of every node that merely
//      happened to be off screen — and then a save wrote the truncated map
//      back, making the loss permanent. Drilling into a project was enough to
//      destroy the portfolio-level arrangement.
//
// The fix has three parts, each pinned below: loading never prunes, pruning
// only ever takes the FULL node set, and writing merges instead of replacing.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pruneOrphanPositions } from "../subgraph";
import {
  clearSavedPositions,
  layoutStorageKey,
  loadSavedPositions,
  pruneAgainstFullGraph,
  saveSavedPositions,
} from "@/components/pmo-living-graph/graph-layout";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const ORG = "org-1";
const USER = "user-1";

/** Minimal in-memory Storage, enough for the module's get/set/remove usage. */
function installStorage(): Map<string, string> {
  const backing = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (key: string) => backing.get(key) ?? null,
    key: (index: number) => [...backing.keys()][index] ?? null,
    removeItem: (key: string) => void backing.delete(key),
    setItem: (key: string, value: string) => void backing.set(key, value),
  };
  (globalThis as { window?: unknown }).window = { localStorage: stub };
  return backing;
}

describe("saved layout survives (PMO-LG-LAYOUT-PERSISTENCE)", () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  // -------------------------------------------------------------------------
  // The core promise: drag, reload, still there.
  // -------------------------------------------------------------------------

  it("round-trips a position through storage", () => {
    saveSavedPositions(ORG, USER, { "node:a": { x: 120, y: 340 } });
    expect(loadSavedPositions(ORG, USER)).toEqual({ "node:a": { x: 120, y: 340 } });
  });

  it("keeps positions for nodes that are NOT in the current view", () => {
    // The regression in one test. The user arranges the portfolio, drills into
    // one project, and the session's in-memory map now only knows that
    // project's nodes. Saving from there must not erase the rest.
    saveSavedPositions(ORG, USER, {
      "project:alpha": { x: 0, y: 0 },
      "project:bravo": { x: 100, y: 0 },
      "project:charlie": { x: 200, y: 0 },
    });

    // Inside project alpha: only its milestone is on screen and gets dragged.
    saveSavedPositions(ORG, USER, { "milestone:a1": { x: 50, y: 400 } });

    const stored = loadSavedPositions(ORG, USER);
    expect(stored).toEqual({
      "project:alpha": { x: 0, y: 0 },
      "project:bravo": { x: 100, y: 0 },
      "project:charlie": { x: 200, y: 0 },
      "milestone:a1": { x: 50, y: 400 },
    });
  });

  it("lets a later drag move a node without disturbing its neighbours", () => {
    saveSavedPositions(ORG, USER, {
      "project:alpha": { x: 0, y: 0 },
      "project:bravo": { x: 100, y: 0 },
    });
    saveSavedPositions(ORG, USER, { "project:alpha": { x: 999, y: 999 } });

    expect(loadSavedPositions(ORG, USER)).toEqual({
      "project:alpha": { x: 999, y: 999 },
      "project:bravo": { x: 100, y: 0 },
    });
  });

  // -------------------------------------------------------------------------
  // Loading must not prune. This is cause #2.
  // -------------------------------------------------------------------------

  it("loads every stored position regardless of what is on screen", () => {
    saveSavedPositions(ORG, USER, {
      "project:alpha": { x: 1, y: 1 },
      "task:deep": { x: 2, y: 2 },
    });

    // `loadSavedPositions` takes no node set at all — the signature itself is
    // the guarantee. A future refactor that reintroduces a `liveNodeIds`
    // parameter here fails this test by failing to compile the call below.
    const loaded = loadSavedPositions(ORG, USER);
    expect(Object.keys(loaded).sort()).toEqual(["project:alpha", "task:deep"]);
  });

  it("survives navigating to a level that renders none of the saved nodes", () => {
    saveSavedPositions(ORG, USER, { "project:alpha": { x: 7, y: 7 } });
    // Simulates a drill-down whose window contains a disjoint set of ids.
    // Nothing about rendering may touch storage.
    expect(loadSavedPositions(ORG, USER)["project:alpha"]).toEqual({ x: 7, y: 7 });
  });

  // -------------------------------------------------------------------------
  // Pruning: only ever against the full graph, and only it may drop entries.
  // -------------------------------------------------------------------------

  it("prunes only against the FULL node set", () => {
    const positions = {
      "project:alpha": { x: 1, y: 1 },
      "project:bravo": { x: 2, y: 2 },
      "project:ghost": { x: 3, y: 3 },
    };
    const fullGraph = new Set(["project:alpha", "project:bravo"]);

    expect(pruneAgainstFullGraph(positions, fullGraph)).toEqual({
      "project:alpha": { x: 1, y: 1 },
      "project:bravo": { x: 2, y: 2 },
    });
  });

  it("would destroy the layout if pruned against a visible window — so it never is", () => {
    // Documents the destructive behaviour that made the bug, proving the
    // helper is dangerous when misused and therefore that its single caller
    // matters. The shell-source assertions below pin that caller.
    const positions = {
      "project:alpha": { x: 1, y: 1 },
      "project:bravo": { x: 2, y: 2 },
    };
    const visibleWindow = new Set(["project:alpha"]);
    const { positions: pruned, dropped } = pruneOrphanPositions(positions, visibleWindow);

    expect(Object.keys(pruned)).toEqual(["project:alpha"]);
    expect(dropped).toEqual(["project:bravo"]);
  });

  it("replace mode is what makes a prune stick", () => {
    saveSavedPositions(ORG, USER, {
      "project:alpha": { x: 1, y: 1 },
      "project:ghost": { x: 3, y: 3 },
    });
    const pruned = pruneAgainstFullGraph(loadSavedPositions(ORG, USER), new Set(["project:alpha"]));

    // Merging here would read the ghost straight back out of storage.
    saveSavedPositions(ORG, USER, pruned, "replace");
    expect(loadSavedPositions(ORG, USER)).toEqual({ "project:alpha": { x: 1, y: 1 } });
  });

  // -------------------------------------------------------------------------
  // The key must be stable. A key that varies per view is unreachable storage.
  // -------------------------------------------------------------------------

  it("keys on organization and user ONLY — never on view state", () => {
    const key = layoutStorageKey(ORG, USER);
    expect(layoutStorageKey(ORG, USER)).toBe(key);

    // Lens, navigation level, filters and selection must not appear. A key that
    // moved with the view would make every saved layout unreachable the moment
    // the user changed anything.
    for (const volatile of ["lens", "flow", "risk", "finance", "milestone", "portfolio", "filter"]) {
      expect(key).not.toContain(volatile);
    }
  });

  it("scopes storage so one org or user cannot read another's layout", () => {
    saveSavedPositions(ORG, USER, { "project:alpha": { x: 5, y: 5 } });
    expect(loadSavedPositions("org-2", USER)).toEqual({});
    expect(loadSavedPositions(ORG, "user-2")).toEqual({});
  });

  it("rejects a payload whose embedded tenant does not match the key", () => {
    const backing = installStorage();
    backing.set(
      layoutStorageKey(ORG, USER),
      JSON.stringify({
        version: 1,
        userId: "someone-else",
        organizationId: ORG,
        positions: { "project:alpha": { x: 1, y: 1 } },
        savedAt: new Date().toISOString(),
      }),
    );
    expect(loadSavedPositions(ORG, USER)).toEqual({});
  });

  it("never throws on a corrupt payload", () => {
    const backing = installStorage();
    backing.set(layoutStorageKey(ORG, USER), "{not json");
    expect(loadSavedPositions(ORG, USER)).toEqual({});
  });

  it("drops non-finite coordinates rather than placing NaN on the canvas", () => {
    const backing = installStorage();
    backing.set(
      layoutStorageKey(ORG, USER),
      JSON.stringify({
        version: 1,
        userId: USER,
        organizationId: ORG,
        positions: {
          "project:good": { x: 1, y: 2 },
          "project:nan": { x: Number.NaN, y: 0 },
          "project:bad": { x: "3", y: 4 },
        },
        savedAt: new Date().toISOString(),
      }),
    );
    expect(loadSavedPositions(ORG, USER)).toEqual({ "project:good": { x: 1, y: 2 } });
  });

  it("reset clears the stored layout", () => {
    saveSavedPositions(ORG, USER, { "project:alpha": { x: 1, y: 1 } });
    clearSavedPositions(ORG, USER);
    expect(loadSavedPositions(ORG, USER)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Wiring guards. The functions above can be perfect and the feature still
// broken if the shell does not call them — which is exactly what happened.
// ---------------------------------------------------------------------------

describe("the shell is wired to persist drags (PMO-LG-LAYOUT-PERSISTENCE)", () => {
  const shell = () => source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");

  it("writes to storage on drag stop, not only behind the Save button", () => {
    const onDragStop = shell().split("const onNodeDragStop")[1]?.split("const onEdgeClick")[0] ?? "";
    expect(onDragStop).toContain("setManualPositions");
    // The actual regression: state was updated and storage was not.
    expect(onDragStop).toContain("saveSavedPositions");
  });

  it("keeps the drag handler attached to the canvas", () => {
    expect(shell()).toContain("onNodeDragStop={onNodeDragStop}");
  });

  it("restores positions on mount without a node set", () => {
    // `loadSavedPositions(organizationId, userId)` — no third argument. Passing
    // the rendered nodes is the mistake this pins shut.
    expect(shell()).toContain("loadSavedPositions(organizationId, userId)");
  });

  it("prunes against the full graph, never against the projection", () => {
    const body = shell();
    expect(body).toContain("pruneAgainstFullGraph(current, fullGraphNodeIds)");
    // `fullGraphNodeIds` must be derived from the `nodes` prop (the whole graph
    // the server sent) and not from `projection.nodes` (one filtered level).
    expect(body).toMatch(
      /const fullGraphNodeIds = useMemo\(\s*\(\) => new Set\(nodes\.map\(\(node\) => node\.id\)\)/,
    );
    expect(body).not.toContain("pruneAgainstFullGraph(current, visibleNodeIds)");
    expect(body).not.toContain("pruneOrphanPositions(");
  });

  it("saves the layout under the same scope it reads", () => {
    const body = shell();
    // Both sides of the round trip name organizationId and userId in that order;
    // a mismatch here writes to a key the next mount will not look in.
    expect(body).toContain("saveSavedPositions(organizationId, userId, manualPositions)");
    expect(body).toContain("clearSavedPositions(organizationId, userId)");
  });
});
