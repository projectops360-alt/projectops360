// ============================================================================
// PMO Portfolio Living Graph — layout & saved positions (CAP-048 §4)
// ============================================================================
// Dagre computes a hierarchical layout from the containment backbone; manual
// drags override it per node and persist in localStorage.
//
// Saved positions are PRESENTATION STATE ONLY. Nothing here is operational
// truth: losing this file loses a preferred arrangement, never a fact.
// ============================================================================

import dagre from "@dagrejs/dagre";
import type { GraphEdge, GraphNode } from "@/lib/pmo-living-graph/contracts";
import { pruneOrphanPositions } from "@/lib/pmo-living-graph/subgraph";
import { nodeFootprint } from "./graph-flow-types";

export interface SavedPosition {
  x: number;
  y: number;
}

/**
 * Edge types that define the hierarchy. Dagre ranks nodes along these only:
 * feeding it dependency and shared-resource edges as well produces a tangle,
 * because those cut across the tree rather than describing it.
 */
const LAYOUT_EDGE_TYPES = new Set(["contains", "belongs_to"]);

/** Auto-layout for the current window. Top-down mirrors org → project → work. */
export function computeGraphLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Map<string, SavedPosition> {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    ranksep: 120,
    nodesep: 60,
    edgesep: 24,
    marginx: 64,
    marginy: 64,
  });

  for (const node of nodes) {
    graph.setNode(node.id, nodeFootprint(node));
  }
  for (const edge of edges) {
    if (!LAYOUT_EDGE_TYPES.has(edge.type)) continue;
    if (graph.hasNode(edge.sourceNodeId) && graph.hasNode(edge.targetNodeId)) {
      graph.setEdge(edge.sourceNodeId, edge.targetNodeId);
    }
  }

  dagre.layout(graph);

  const positions = new Map<string, SavedPosition>();
  for (const node of nodes) {
    const point = graph.node(node.id) as
      | { x: number; y: number; width: number; height: number }
      | undefined;
    if (!point) continue;
    // Dagre reports centres; React Flow positions from the top-left corner.
    positions.set(node.id, {
      x: point.x - point.width / 2,
      y: point.y - point.height / 2,
    });
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1 as const;
const PREFIX = "po360.pmoLivingGraph.layout.";

interface StoredLayout {
  version: number;
  userId: string;
  organizationId: string;
  positions: Record<string, SavedPosition>;
  savedAt: string;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 160);
}

/**
 * Key scoped to organization AND user.
 *
 * Both are required: a person switching org must not inherit another
 * portfolio's arrangement, and a shared browser must not leak one user's
 * layout to the next.
 */
export function layoutStorageKey(organizationId: string, userId: string): string {
  return `${PREFIX}${safeSegment(userId)}.${safeSegment(organizationId)}`;
}

function storage(): Storage | null {
  try {
    // Private-mode browsers throw on access rather than returning null.
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isPosition(value: unknown): value is SavedPosition {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    typeof point.y === "number" &&
    Number.isFinite(point.y)
  );
}

/**
 * Read every saved position, unpruned.
 *
 * PMO-LG-LAYOUT-PERSISTENCE. Pruning does NOT happen here, and that is the
 * whole point. The caller's idea of "live" is the scope-filtered, level-scoped
 * set of nodes it happens to be rendering; pruning against it would delete the
 * positions of every node the current view does not include — which is most of
 * the portfolio the moment a filter is on or the user has drilled into a
 * project. Orphan pruning is a maintenance concern and belongs to the one
 * caller that can see the COMPLETE graph (`pruneAgainstFullGraph`).
 *
 * A corrupt or foreign payload yields an empty map rather than throwing — a bad
 * layout must never break the screen.
 */
export function loadSavedPositions(
  organizationId: string,
  userId: string,
): Record<string, SavedPosition> {
  const store = storage();
  if (!store) return {};

  let parsed: unknown;
  try {
    const raw = store.getItem(layoutStorageKey(organizationId, userId));
    if (!raw) return {};
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object") return {};
  const layout = parsed as Partial<StoredLayout>;
  if (layout.version !== SCHEMA_VERSION) return {};
  // Belt and braces: the key already scopes by tenant, but a stale payload from
  // a previous key scheme must never place another org's nodes.
  if (layout.organizationId !== organizationId || layout.userId !== userId) return {};
  if (!layout.positions || typeof layout.positions !== "object") return {};

  const clean: Record<string, SavedPosition> = {};
  for (const [id, point] of Object.entries(layout.positions)) {
    if (isPosition(point)) clean[id] = { x: point.x, y: point.y };
  }

  return clean;
}

/**
 * Drop positions for nodes the FULL graph no longer contains.
 *
 * Only ever called with the complete node set the server sent — never with the
 * rendered window. Kept separate from `loadSavedPositions` so that the
 * distinction is impossible to lose by accident: a function that takes
 * "liveNodeIds" invites being handed whatever ids are nearby, and the nearest
 * ids are always the visible ones.
 */
export function pruneAgainstFullGraph(
  positions: Readonly<Record<string, SavedPosition>>,
  fullGraphNodeIds: ReadonlySet<string>,
): Record<string, SavedPosition> {
  return pruneOrphanPositions(positions, fullGraphNodeIds).positions;
}

/**
 * How a write treats what is already in storage.
 *
 * `merge`   — default, and the right answer for every user gesture.
 * `replace` — the stored map becomes exactly what is passed. Pruning only.
 */
export type SaveMode = "merge" | "replace";

/**
 * Persist positions, MERGING over whatever is already stored.
 *
 * A blind overwrite loses every node outside the current view: the in-memory
 * map only ever holds positions for nodes this session has rendered, so writing
 * it wholesale would erase the arrangement of the projects the user is not
 * currently looking at. Merge-then-write is what makes drilling into a project,
 * rearranging it, and drilling back out non-destructive.
 */
export function saveSavedPositions(
  organizationId: string,
  userId: string,
  positions: Readonly<Record<string, SavedPosition>>,
  mode: SaveMode = "merge",
): void {
  const store = storage();
  if (!store) return;
  // "replace" exists for exactly one caller: orphan pruning, which has just
  // decided that certain ids must go. Merging there would read them straight
  // back out of storage and undo the prune.
  const next =
    mode === "replace"
      ? { ...positions }
      : { ...loadSavedPositions(organizationId, userId), ...positions };
  const payload: StoredLayout = {
    version: SCHEMA_VERSION,
    userId,
    organizationId,
    positions: next,
    savedAt: new Date().toISOString(),
  };
  try {
    store.setItem(layoutStorageKey(organizationId, userId), JSON.stringify(payload));
  } catch {
    // Quota exhausted or storage disabled. Losing a layout preference is not
    // worth interrupting the user over.
  }
}

export function clearSavedPositions(organizationId: string, userId: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(layoutStorageKey(organizationId, userId));
  } catch {
    // Same rationale as above.
  }
}
