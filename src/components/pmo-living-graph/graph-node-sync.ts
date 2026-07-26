// ============================================================================
// PMO Portfolio Living Graph — canvas reconciliation (CAP-048)
// ============================================================================
// Same lesson already learned on the Process Intelligence canvas, applied here:
// hover must NEVER rebuild the node array.
//
// Rebuilding on every pointer move costs two visible bugs. React Flow loses the
// `measured` dimensions it owns and has to re-measure, so nodes and edges
// shudder; and each freshly built node carries the auto-layout position, which
// yanks a node being dragged back to where it started.
//
// The fix is structural: structure and interaction are separate passes, and
// both MERGE onto the live array instead of replacing it. Nodes whose
// interaction state did not change are returned by reference, and when nothing
// changed at all the original array comes back — so an idle pointer move causes
// no React Flow work whatsoever.
// ============================================================================

import type { GraphFlowEdge, GraphFlowNode } from "./graph-flow-types";

/** Lift a hovered node above its neighbours so its chrome is not clipped. */
export const HOVERED_NODE_Z_INDEX = 1000;

/**
 * Merge the structural projection onto the live nodes.
 *
 * Everything React Flow owns on the existing node — measured size, drag state,
 * selection — survives, and the current position is left alone while a drag is
 * in flight.
 */
export function mergeStructuralNodes(
  current: readonly GraphFlowNode[],
  structural: readonly GraphFlowNode[],
  isDragging: boolean,
): GraphFlowNode[] {
  const previous = new Map(current.map((node) => [node.id, node]));
  return structural.map((node) => {
    const prior = previous.get(node.id);
    if (!prior) return node;
    return {
      ...prior,
      type: node.type,
      position: isDragging ? prior.position : node.position,
      data: {
        ...node.data,
        // Interaction state belongs to the live node, not to the projection.
        hovered: prior.data.hovered,
        dimmed: prior.data.dimmed,
        onPath: prior.data.onPath,
        blastHop: prior.data.blastHop,
        lensEmphasis: prior.data.lensEmphasis,
      },
    };
  });
}

export interface NodeInteractionState {
  hoveredNodeId: string | null;
  /** When non-empty, everything outside it dims. */
  relatedNodeIds: ReadonlySet<string>;
  selectedNodeIds: ReadonlySet<string>;
  pathNodeIds: ReadonlySet<string>;
  /** Node id → hop distance from the blast-radius origin. */
  blastHops: ReadonlyMap<string, number>;
  /**
   * Nodes the active lens is about, and nodes it wants pushed back
   * (CAP-048 Phase 2, M4). Both empty ⇒ the lens has no opinion and the canvas
   * renders exactly as it did before lenses existed.
   */
  lensHighlightedIds?: ReadonlySet<string>;
  lensMutedIds?: ReadonlySet<string>;
}

/** Patch hover / dim / selection / path / blast / lens state in place. */
export function applyNodeInteraction(
  current: readonly GraphFlowNode[],
  {
    hoveredNodeId,
    relatedNodeIds,
    selectedNodeIds,
    pathNodeIds,
    blastHops,
    lensHighlightedIds,
    lensMutedIds,
  }: NodeInteractionState,
): GraphFlowNode[] {
  let changed = false;
  const next = current.map((node) => {
    const hovered = hoveredNodeId === node.id;
    const dimmed = relatedNodeIds.size > 0 && !relatedNodeIds.has(node.id);
    const selected = selectedNodeIds.has(node.id);
    const onPath = pathNodeIds.has(node.id);
    const blastHop = blastHops.get(node.id) ?? null;
    // Highlight wins over mute: a node the lens is explicitly about must not be
    // pushed back because it also fell into the complement set.
    const lensEmphasis: GraphFlowNode["data"]["lensEmphasis"] =
      lensHighlightedIds?.has(node.id)
        ? "highlighted"
        : lensMutedIds?.has(node.id)
          ? "muted"
          : "none";
    if (
      node.data.hovered === hovered &&
      node.data.dimmed === dimmed &&
      node.data.onPath === onPath &&
      node.data.blastHop === blastHop &&
      node.data.lensEmphasis === lensEmphasis &&
      (node.selected ?? false) === selected
    ) {
      return node;
    }
    changed = true;
    return {
      ...node,
      selected,
      zIndex: hovered ? HOVERED_NODE_Z_INDEX : undefined,
      data: { ...node.data, hovered, dimmed, onPath, blastHop, lensEmphasis },
    };
  });
  return changed ? next : (current as GraphFlowNode[]);
}

export interface EdgeInteractionState {
  hoveredEdgeId: string | null;
  /** The node under the pointer or selected; its edges stay lit. */
  activeNodeId: string | null;
  selectedEdgeIds: readonly string[];
  pathEdgeIds: ReadonlySet<string>;
  /** Edges the active lens is about (e.g. dependency chains). */
  lensHighlightedEdgeIds?: ReadonlySet<string>;
}

/** Edge counterpart of {@link applyNodeInteraction}. */
export function applyEdgeInteraction(
  current: readonly GraphFlowEdge[],
  {
    hoveredEdgeId,
    activeNodeId,
    selectedEdgeIds,
    pathEdgeIds,
    lensHighlightedEdgeIds,
  }: EdgeInteractionState,
): GraphFlowEdge[] {
  let changed = false;
  const next = current.map((edge) => {
    const hovered = hoveredEdgeId === edge.id;
    const onPath = pathEdgeIds.has(edge.id);
    const dimmed =
      hoveredEdgeId != null
        ? hoveredEdgeId !== edge.id
        : activeNodeId != null &&
          edge.source !== activeNodeId &&
          edge.target !== activeNodeId;
    const selected = selectedEdgeIds.includes(edge.id);
    const lensEmphasis: "highlighted" | "none" = lensHighlightedEdgeIds?.has(edge.id)
      ? "highlighted"
      : "none";
    const data = edge.data;
    if (
      data == null ||
      (data.hovered === hovered &&
        data.dimmed === dimmed &&
        data.onPath === onPath &&
        data.lensEmphasis === lensEmphasis &&
        (edge.selected ?? false) === selected)
    ) {
      return edge;
    }
    changed = true;
    return { ...edge, selected, data: { ...data, hovered, dimmed, onPath, lensEmphasis } };
  });
  return changed ? next : (current as GraphFlowEdge[]);
}
