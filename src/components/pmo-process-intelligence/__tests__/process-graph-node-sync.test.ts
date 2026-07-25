import { describe, expect, it } from "vitest";
import {
  applyEdgeInteraction,
  applyNodeInteraction,
  HOVERED_NODE_Z_INDEX,
  mergeStructuralNodes,
} from "../graph/process-graph-node-sync";
import type {
  ProcessGraphFlowEdge,
  ProcessGraphFlowNode,
} from "../graph/process-graph-flow-types";

// ---------------------------------------------------------------------------
// Regression guard: PROCESS-GRAPH-HOVER-STABILITY
//
// Hovering a node used to rebuild the whole React Flow node array. That dropped
// each node's `measured` dimensions (nodes and edges visibly shuddered) and
// re-applied the auto-layout position mid-drag (nodes snapped back and could not
// be moved). These tests fail if either behaviour returns.
// ---------------------------------------------------------------------------

function node(
  id: string,
  overrides: Partial<ProcessGraphFlowNode> = {},
): ProcessGraphFlowNode {
  return {
    id,
    type: "project",
    position: { x: 0, y: 0 },
    draggable: true,
    focusable: true,
    data: {
      entity: { id, label: id } as ProcessGraphFlowNode["data"]["entity"],
      semanticZoom: "intermediate",
      layer: "process",
      expanded: false,
      hovered: false,
      dimmed: false,
      locale: "en",
      onToggleExpanded: () => {},
    },
    ...overrides,
  } as ProcessGraphFlowNode;
}

function edge(
  id: string,
  source: string,
  target: string,
  overrides: Partial<ProcessGraphFlowEdge> = {},
): ProcessGraphFlowEdge {
  return {
    id,
    source,
    target,
    type: "processGraph",
    focusable: true,
    data: {
      connection: { id, source, target } as NonNullable<
        ProcessGraphFlowEdge["data"]
      >["connection"],
      hovered: false,
      dimmed: false,
      locale: "en",
    },
    ...overrides,
  } as ProcessGraphFlowEdge;
}

describe("mergeStructuralNodes", () => {
  it("preserves React Flow measured dimensions instead of recreating nodes", () => {
    const live = [
      { ...node("a"), measured: { width: 250, height: 170 } },
    ] as ProcessGraphFlowNode[];
    const structural = [node("a")];

    const merged = mergeStructuralNodes(live, structural, false);

    expect(
      (merged[0] as ProcessGraphFlowNode & { measured?: unknown }).measured,
    ).toEqual({ width: 250, height: 170 });
  });

  it("keeps the live position while a drag is in flight", () => {
    const live = [node("a", { position: { x: 420, y: 88 } })];
    const structural = [node("a", { position: { x: 0, y: 0 } })];

    const merged = mergeStructuralNodes(live, structural, true);

    expect(merged[0].position).toEqual({ x: 420, y: 88 });
  });

  it("adopts the layout position once the drag has ended", () => {
    const live = [node("a", { position: { x: 420, y: 88 } })];
    const structural = [node("a", { position: { x: 12, y: 34 } })];

    const merged = mergeStructuralNodes(live, structural, false);

    expect(merged[0].position).toEqual({ x: 12, y: 34 });
  });

  it("carries interaction flags over from the live node", () => {
    const live = [node("a")];
    live[0].data.hovered = true;
    live[0].data.dimmed = true;

    const merged = mergeStructuralNodes(live, [node("a")], false);

    expect(merged[0].data.hovered).toBe(true);
    expect(merged[0].data.dimmed).toBe(true);
  });

  it("adds nodes that are not on the canvas yet", () => {
    const merged = mergeStructuralNodes([node("a")], [node("a"), node("b")], false);

    expect(merged.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("drops nodes that left the projection", () => {
    const merged = mergeStructuralNodes([node("a"), node("b")], [node("a")], false);

    expect(merged.map((entry) => entry.id)).toEqual(["a"]);
  });
});

describe("applyNodeInteraction", () => {
  const idle = {
    hoveredNodeId: null,
    relatedNodeIds: new Set<string>(),
    selectedNodeIds: new Set<string>(),
  };

  it("returns the very same array when nothing changed", () => {
    const current = [node("a"), node("b")];

    expect(applyNodeInteraction(current, idle)).toBe(current);
  });

  it("keeps untouched nodes referentially identical", () => {
    const current = [node("a"), node("b")];

    const next = applyNodeInteraction(current, {
      hoveredNodeId: "a",
      relatedNodeIds: new Set(["a", "b"]),
      selectedNodeIds: new Set(),
    });

    expect(next[0]).not.toBe(current[0]);
    expect(next[1]).toBe(current[1]);
  });

  it("never rewrites positions", () => {
    const current = [node("a", { position: { x: 300, y: 150 } })];

    const next = applyNodeInteraction(current, {
      hoveredNodeId: "a",
      relatedNodeIds: new Set(["a"]),
      selectedNodeIds: new Set(),
    });

    expect(next[0].position).toEqual({ x: 300, y: 150 });
  });

  it("lifts the hovered node so its hover card is not clipped", () => {
    const next = applyNodeInteraction([node("a"), node("b")], {
      hoveredNodeId: "a",
      relatedNodeIds: new Set(["a"]),
      selectedNodeIds: new Set(),
    });

    expect(next[0].zIndex).toBe(HOVERED_NODE_Z_INDEX);
    expect(next[1].zIndex).toBeUndefined();
  });

  it("dims only the nodes outside the related set", () => {
    const next = applyNodeInteraction([node("a"), node("b"), node("c")], {
      hoveredNodeId: "a",
      relatedNodeIds: new Set(["a", "b"]),
      selectedNodeIds: new Set(),
    });

    expect(next.map((entry) => entry.data.dimmed)).toEqual([false, false, true]);
  });

  it("dims nothing when there is no focus", () => {
    const next = applyNodeInteraction([node("a"), node("b")], idle);

    expect(next.every((entry) => entry.data.dimmed === false)).toBe(true);
  });

  it("mirrors selection onto the React Flow node", () => {
    const next = applyNodeInteraction([node("a"), node("b")], {
      hoveredNodeId: null,
      relatedNodeIds: new Set<string>(),
      selectedNodeIds: new Set(["b"]),
    });

    expect(next[0].selected).toBeFalsy();
    expect(next[1].selected).toBe(true);
  });
});

describe("applyEdgeInteraction", () => {
  const idle = {
    hoveredEdgeId: null,
    activeNodeId: null,
    selectedEdgeIds: [] as string[],
  };

  it("returns the very same array when nothing changed", () => {
    const current = [edge("a->b", "a", "b")];

    expect(applyEdgeInteraction(current, idle)).toBe(current);
  });

  it("dims every edge that does not touch the active node", () => {
    const next = applyEdgeInteraction(
      [edge("a->b", "a", "b"), edge("c->d", "c", "d")],
      { ...idle, activeNodeId: "a" },
    );

    expect(next[0].data?.dimmed).toBe(false);
    expect(next[1].data?.dimmed).toBe(true);
  });

  it("a hovered edge wins over node-driven dimming", () => {
    const next = applyEdgeInteraction(
      [edge("a->b", "a", "b"), edge("c->d", "c", "d")],
      { ...idle, hoveredEdgeId: "c->d", activeNodeId: "a" },
    );

    expect(next[0].data?.dimmed).toBe(true);
    expect(next[1].data?.hovered).toBe(true);
    expect(next[1].data?.dimmed).toBe(false);
  });
});
