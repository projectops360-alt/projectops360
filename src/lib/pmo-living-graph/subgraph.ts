// ============================================================================
// PMO Portfolio Living Graph — subgraph windowing (CAP-048)
// ============================================================================
// The client never receives the whole portfolio. What reaches the canvas is a
// window: the kinds legible at the current zoom, the projects the user chose to
// expand, and whatever the filters allow — capped, with the truncation stated
// out loud rather than hidden.
// ============================================================================

import {
  ZOOM_LEVEL_KINDS,
  type GraphEdge,
  type GraphFilters,
  type GraphNode,
  type GraphProjection,
  type GraphZoomLevel,
} from "./contracts";
import { pruneDanglingEdges } from "./edge-projection";

export interface WindowOptions {
  zoom: GraphZoomLevel;
  /** Projects whose internals are visible. Everything else stays collapsed. */
  expandedProjectIds: readonly string[];
  filters: GraphFilters;
  /** Hard ceiling on rendered nodes. */
  nodeLimit?: number;
  /** When set, only this node and its neighbourhood survive (Focus Mode). */
  focusNodeId?: string | null;
  focusNeighbourIds?: ReadonlySet<string> | null;
}

const DEFAULT_NODE_LIMIT = 600;

function matchesSearch(node: GraphNode, search: string): boolean {
  if (!search) return true;
  return node.label.toLowerCase().includes(search.toLowerCase());
}

/**
 * Build the renderable window.
 *
 * Nodes survive on merit, and the order matters: zoom decides what is legible,
 * collapse decides how much of a project you asked for, filters narrow it, and
 * only then does the cap apply — so the limit trims the least relevant nodes
 * rather than arbitrary ones.
 */
export function buildGraphWindow(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  options: WindowOptions,
): GraphProjection {
  const limit = options.nodeLimit ?? DEFAULT_NODE_LIMIT;
  const legibleKinds = new Set(ZOOM_LEVEL_KINDS[options.zoom]);
  const expanded = new Set(options.expandedProjectIds);
  const { filters } = options;
  const kindFilter = new Set(filters.nodeKinds);
  const projectFilter = new Set(filters.projectIds);

  const kept: GraphNode[] = [];

  for (const node of nodes) {
    if (!legibleKinds.has(node.kind)) continue;
    if (kindFilter.size > 0 && !kindFilter.has(node.kind)) continue;
    if (projectFilter.size > 0 && node.projectId && !projectFilter.has(node.projectId)) {
      continue;
    }
    if (!matchesSearch(node, filters.search)) continue;

    // Anything below project level only appears once its project is expanded —
    // this is what stops the default view rendering every task in the org.
    const isInsideProject =
      node.kind !== "organization" && node.kind !== "project" && node.projectId != null;
    if (isInsideProject && !expanded.has(node.projectId as string)) continue;

    if (options.focusNodeId && options.focusNeighbourIds) {
      if (node.id !== options.focusNodeId && !options.focusNeighbourIds.has(node.id)) {
        continue;
      }
    }

    kept.push(node);
  }

  // Anchors and the most connected survive the cap; leaves are what get cut.
  const ranked = [...kept].sort((a, b) => {
    const anchor = (node: GraphNode) =>
      node.kind === "organization" ? 2 : node.kind === "project" ? 1 : 0;
    const byAnchor = anchor(b) - anchor(a);
    if (byAnchor !== 0) return byAnchor;
    return b.criticality - a.criticality;
  });

  const truncated = ranked.length > limit;
  const finalNodes = truncated ? ranked.slice(0, limit) : ranked;
  const presentIds = new Set(finalNodes.map((node) => node.id));

  let finalEdges = pruneDanglingEdges(edges, presentIds);
  if (filters.edgeTypes.length > 0) {
    const allowed = new Set(filters.edgeTypes);
    finalEdges = finalEdges.filter((edge) => allowed.has(edge.type));
  }
  if (filters.minConfidence > 0) {
    finalEdges = finalEdges.filter((edge) => edge.confidence >= filters.minConfidence);
  }

  return {
    nodes: finalNodes,
    edges: finalEdges,
    truncated,
    totalNodeCount: kept.length,
  };
}

/** Filters that hide nothing — the honest starting point. */
export function defaultFilters(): GraphFilters {
  return {
    projectIds: [],
    nodeKinds: [],
    edgeTypes: [],
    search: "",
    minConfidence: 0,
  };
}

/**
 * Drop saved positions whose nodes no longer exist.
 *
 * Node ids outlive nothing: entities get deleted, and a stale position map
 * would otherwise grow forever and place ghosts on the canvas.
 *
 * PMO-LG-LAYOUT-PERSISTENCE — `liveNodeIds` MUST be the complete node set of
 * the graph, never the rendered window. The canvas shows one level at a time
 * and may be filtered on top of that, so `projection.nodes` is a small subset
 * of what exists; pruning against it deletes the user's arrangement for every
 * node that merely happens to be off screen. That was a real regression, and it
 * looked like "the graph forgets my layout when I drill into a project".
 */
export function pruneOrphanPositions(
  positions: Readonly<Record<string, { x: number; y: number }>>,
  liveNodeIds: ReadonlySet<string>,
): { positions: Record<string, { x: number; y: number }>; dropped: string[] } {
  const kept: Record<string, { x: number; y: number }> = {};
  const dropped: string[] = [];
  for (const [id, position] of Object.entries(positions)) {
    if (liveNodeIds.has(id)) kept[id] = position;
    else dropped.push(id);
  }
  return { positions: kept, dropped };
}
