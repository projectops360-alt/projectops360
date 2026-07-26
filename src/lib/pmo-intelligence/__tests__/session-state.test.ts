// ============================================================================
// CAP-048 Phase 2 · Milestone 3 — coordinated session state
// Guards: PMO-IC-SESSION-RECONCILE, PMO-IC-SESSION-TRANSITIONS,
//         PMO-IC-SINGLE-SCOPE
// ============================================================================
// The state rules that keep every panel answering the same question. They live
// in a pure module rather than inside the hook precisely so they can be tested:
// the bug this guards against — narrowing the scope and leaving the side panel
// describing a node that is no longer on screen — is invisible in a unit test
// of a component that owns its own state.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY_SESSION,
  applyKpiIntentToSession,
  clearSelection,
  pickPathEndpoint,
  reconcileSession,
  scopeNarrowed,
  selectNode,
  toggleDrawer,
  type PmoSessionState,
} from "../session-state";
import { defaultScope } from "../scope";

const ORG = "org-1";
const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

function session(overrides: Partial<PmoSessionState> = {}): PmoSessionState {
  return { ...EMPTY_SESSION, ...overrides };
}

// ---------------------------------------------------------------------------
// PMO-IC-SESSION-RECONCILE
// ---------------------------------------------------------------------------

describe("scope changes invalidate stale selections (PMO-IC-SESSION-RECONCILE)", () => {
  it("drops selected nodes the new scope no longer shows", () => {
    const next = reconcileSession(
      session({ selectedNodeIds: ["a", "b", "c"] }),
      new Set(["a", "c"]),
    );
    expect(next.selectedNodeIds).toEqual(["a", "c"]);
  });

  it("clears a focused node that disappeared", () => {
    // Focus mode aimed at an invisible node leaves the canvas showing an empty
    // neighbourhood while the toolbar still claims focus is on.
    const next = reconcileSession(session({ focusedNodeId: "gone" }), new Set(["a"]));
    expect(next.focusedNodeId).toBeNull();
  });

  it("drops the far end of a path whose near end survived", () => {
    // Half a path is not a query. Keeping one endpoint would leave the toolbar
    // in "pick the second node" state with an invisible first pick.
    const next = reconcileSession(
      session({ pathSource: "a", pathTarget: "gone" }),
      new Set(["a"]),
    );
    expect(next.pathSource).toBe("a");
    expect(next.pathTarget).toBeNull();
  });

  it("drops both endpoints when the source disappeared", () => {
    const next = reconcileSession(
      session({ pathSource: "gone", pathTarget: "b" }),
      new Set(["b"]),
    );
    expect(next.pathSource).toBeNull();
    expect(next.pathTarget).toBeNull();
  });

  it("keeps an intact path", () => {
    const next = reconcileSession(
      session({ pathSource: "a", pathTarget: "b" }),
      new Set(["a", "b"]),
    );
    expect(next.pathSource).toBe("a");
    expect(next.pathTarget).toBe("b");
  });

  it("turns off impact analysis when nothing is selected any more", () => {
    // Blast radius is anchored on the selection; with no origin the depth
    // control must not stay lit as though a query were still running.
    const next = reconcileSession(
      session({ selectedNodeIds: ["gone"], impactDepth: 2 }),
      new Set(["a"]),
    );
    expect(next.selectedNodeIds).toEqual([]);
    expect(next.impactDepth).toBeNull();
  });

  it("returns the same object when nothing was invalidated", () => {
    // Identity is load-bearing: the hook uses it to skip a render when a scope
    // change did not strand anything.
    const current = session({ selectedNodeIds: ["a"], focusedNodeId: "a" });
    expect(reconcileSession(current, new Set(["a", "b"]))).toBe(current);
  });

  it("only treats narrowing as invalidating", () => {
    const base = defaultScope(ORG);
    const oneProject = { ...base, projectIds: ["p1"] };
    // All projects → one project narrows.
    expect(scopeNarrowed(base, oneProject)).toBe(true);
    // One project → all projects widens; nothing can be stranded.
    expect(scopeNarrowed(oneProject, base)).toBe(false);
    // Switching lens or searching changes no visibility at all.
    expect(scopeNarrowed(base, { ...base, activeLens: "risk" })).toBe(false);
    expect(scopeNarrowed(base, { ...base, search: "slab" })).toBe(false);
    // Swapping which project is in scope strands the previous one's nodes.
    expect(scopeNarrowed(oneProject, { ...base, projectIds: ["p2"] })).toBe(true);
    // Changing organization always invalidates.
    expect(scopeNarrowed(base, { ...base, organizationId: "org-2" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-SESSION-TRANSITIONS
// ---------------------------------------------------------------------------

describe("session transitions (PMO-IC-SESSION-TRANSITIONS)", () => {
  it("replaces the selection on a plain click", () => {
    const next = selectNode(session({ selectedNodeIds: ["a"] }), "b", false);
    expect(next.selectedNodeIds).toEqual(["b"]);
  });

  it("adds and removes on an additive click", () => {
    const added = selectNode(session({ selectedNodeIds: ["a"] }), "b", true);
    expect(added.selectedNodeIds).toEqual(["a", "b"]);
    expect(selectNode(added, "a", true).selectedNodeIds).toEqual(["b"]);
  });

  it("clears the selected edge when a node is picked", () => {
    // Node and edge selection drive the same side panel; both set at once
    // would leave the panel describing whichever the renderer checked first.
    const next = selectNode(session({ selectedEdgeId: "e1" }), "a", false);
    expect(next.selectedEdgeId).toBeNull();
  });

  it("starts a new path query on the third pick", () => {
    let current = pickPathEndpoint(session(), "a");
    expect([current.pathSource, current.pathTarget]).toEqual(["a", null]);
    current = pickPathEndpoint(current, "b");
    expect([current.pathSource, current.pathTarget]).toEqual(["a", "b"]);
    current = pickPathEndpoint(current, "c");
    expect([current.pathSource, current.pathTarget]).toEqual(["c", null]);
  });

  it("clears the canvas highlights without touching drawers", () => {
    const next = clearSelection(
      session({ selectedNodeIds: ["a"], focusedNodeId: "a", impactDepth: 3, drawerState: "evidence" }),
    );
    expect(next.selectedNodeIds).toEqual([]);
    expect(next.focusedNodeId).toBeNull();
    expect(next.impactDepth).toBeNull();
    expect(next.drawerState).toBe("evidence");
  });

  it("closes a drawer when it is requested again", () => {
    const opened = toggleDrawer(session(), "criticalPath");
    expect(opened.drawerState).toBe("criticalPath");
    expect(toggleDrawer(opened, "criticalPath").drawerState).toBe("none");
  });

  it("drops the evidence package when the evidence drawer closes", () => {
    // Reopening would otherwise flash the previous package before the new one
    // is resolved.
    const open = session({ drawerState: "evidence", evidenceId: "ev-1" });
    expect(toggleDrawer(open, "evidence").evidenceId).toBeNull();
    expect(toggleDrawer(open, "health").evidenceId).toBeNull();
  });

  it("applies a KPI intent as one gesture", () => {
    const next = applyKpiIntentToSession(session({ impactDepth: 2 }), {
      selectNodeIds: ["a", "b"],
      openPanel: "health",
      focus: true,
    });
    expect(next.selectedNodeIds).toEqual(["a", "b"]);
    expect(next.drawerState).toBe("health");
    // Focus needs a single anchor the camera can centre on.
    expect(next.focusedNodeId).toBe("a");
    // A previous impact query does not survive a new question.
    expect(next.impactDepth).toBeNull();
  });

  it("does not focus when the intent did not ask for it", () => {
    const next = applyKpiIntentToSession(session(), {
      selectNodeIds: ["a"],
      openPanel: null,
      focus: false,
    });
    expect(next.focusedNodeId).toBeNull();
    expect(next.drawerState).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-SINGLE-SCOPE
// ---------------------------------------------------------------------------

describe("one scope owns the dashboard (PMO-IC-SINGLE-SCOPE)", () => {
  const hook = source("src/components/pmo-intelligence/use-pmo-scope.ts");

  it("mirrors the scope to the URL with replace, never push", () => {
    // `push` would make the back button walk through every project the user
    // ticked instead of leaving the dashboard.
    expect(hook).toContain("router.replace");
    expect(hook).not.toContain("router.push");
  });

  it("only reloads for data-affecting changes", () => {
    // Switching lens or typing in search reprojects data already in memory;
    // refetching would cost a round trip per tab click.
    expect(hook).toContain("isDataAffecting");
  });

  it("guards against superseded responses", () => {
    // Without both an abort and a key check, a slow request for a scope the
    // user has left can resolve last and overwrite the current one.
    expect(hook).toContain("AbortController");
    expect(hook).toContain("scopeKey");
  });

  it("reconciles the session when the scope narrows", () => {
    expect(hook).toContain("reconcileSession");
    expect(hook).toContain("scopeNarrowed");
  });

  it("keeps the whole dashboard on one scope object", () => {
    // No panel may keep a private filter. If a second useState of a filter
    // shape appears here, that promise has been broken somewhere.
    const filters = source("src/components/pmo-intelligence/global-filters.tsx");
    expect(filters).not.toContain("useState");
  });
});
