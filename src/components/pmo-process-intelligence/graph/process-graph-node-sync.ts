import type {
  ProcessGraphFlowEdge,
  ProcessGraphFlowNode,
} from "./process-graph-flow-types";

/**
 * Reconciliation helpers for the Process Intelligence canvas.
 *
 * Both exist to keep two classes of state apart:
 *
 *  - **Structure** — which nodes exist, their content and their layout position.
 *  - **Interaction** — hover, dimming and selection.
 *
 * Rebuilding the whole node array on every pointer move (the naive approach)
 * breaks the canvas in two visible ways: React Flow loses each node's `measured`
 * dimensions and has to re-measure, which makes nodes and edges shudder; and the
 * freshly built node carries the auto-layout position, which snaps a node being
 * dragged back to where it started. Splitting the two, and merging rather than
 * replacing, fixes both.
 */

export const HOVERED_NODE_Z_INDEX = 1000;

/**
 * Merge the structural projection onto the live nodes.
 *
 * Preserves everything React Flow owns on the existing node (measured size,
 * drag state, selection) and keeps the current position untouched while a drag
 * is in flight.
 */
export function mergeStructuralNodes(
  current: readonly ProcessGraphFlowNode[],
  structural: readonly ProcessGraphFlowNode[],
  isDragging: boolean,
): ProcessGraphFlowNode[] {
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
        hovered: prior.data.hovered,
        dimmed: prior.data.dimmed,
      },
    };
  });
}

export interface NodeInteractionState {
  hoveredNodeId: string | null;
  relatedNodeIds: ReadonlySet<string>;
  selectedNodeIds: ReadonlySet<string>;
}

/**
 * Patch hover / dimming / selection in place.
 *
 * Nodes whose interaction state is unchanged are returned by reference, and the
 * original array is returned when nothing changed at all — so React Flow does
 * not re-measure or reposition anything on an idle pointer move.
 */
export function applyNodeInteraction(
  current: readonly ProcessGraphFlowNode[],
  { hoveredNodeId, relatedNodeIds, selectedNodeIds }: NodeInteractionState,
): ProcessGraphFlowNode[] {
  let changed = false;
  const next = current.map((node) => {
    const hovered = hoveredNodeId === node.id;
    const dimmed = relatedNodeIds.size > 0 && !relatedNodeIds.has(node.id);
    const selected = selectedNodeIds.has(node.id);
    if (
      node.data.hovered === hovered &&
      node.data.dimmed === dimmed &&
      (node.selected ?? false) === selected
    ) {
      return node;
    }
    changed = true;
    return {
      ...node,
      selected,
      // Lift the hovered node above its neighbours so the hover card is not
      // clipped behind adjacent nodes.
      zIndex: hovered ? HOVERED_NODE_Z_INDEX : undefined,
      data: { ...node.data, hovered, dimmed },
    };
  });
  return changed ? next : (current as ProcessGraphFlowNode[]);
}

export interface EdgeInteractionState {
  hoveredEdgeId: string | null;
  activeNodeId: string | null;
  selectedEdgeIds: readonly string[];
}

/** Edge counterpart of {@link applyNodeInteraction}. */
export function applyEdgeInteraction(
  current: readonly ProcessGraphFlowEdge[],
  { hoveredEdgeId, activeNodeId, selectedEdgeIds }: EdgeInteractionState,
): ProcessGraphFlowEdge[] {
  let changed = false;
  const next = current.map((edge) => {
    const hovered = hoveredEdgeId === edge.id;
    const dimmed =
      hoveredEdgeId != null
        ? hoveredEdgeId !== edge.id
        : activeNodeId != null &&
          edge.source !== activeNodeId &&
          edge.target !== activeNodeId;
    const selected = selectedEdgeIds.includes(edge.id);
    const data = edge.data;
    if (
      data == null ||
      (data.hovered === hovered &&
        data.dimmed === dimmed &&
        (edge.selected ?? false) === selected)
    ) {
      return edge;
    }
    changed = true;
    return { ...edge, selected, data: { ...data, hovered, dimmed } };
  });
  return changed ? next : (current as ProcessGraphFlowEdge[]);
}
