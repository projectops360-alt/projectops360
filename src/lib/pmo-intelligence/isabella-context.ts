// ============================================================================
// PMO Intelligence Center — Isabella context (CAP-048 Phase 2, M6)
// ============================================================================
// What "Ask Isabella" sends when it is pressed from Dashboard 3.
//
// CAP-048 §6 and ADR-012 risk 4 state the binding rule: send a MINIMAL
// SUBGRAPH, never the whole graph. This module is that rule, made executable.
//
// The reason is not cost. A portfolio graph is hundreds of nodes of which two
// are relevant; handing Isabella all of them buries the question in context and
// makes her answer about the portfolio when she was asked about one blocked
// task. Truncating is not a compromise here — it is what makes the answer
// correct.
//
// Pure, so the cap can be tested rather than trusted.
// ============================================================================

import type { GraphEdge, GraphNode } from "@/lib/pmo-living-graph/contracts";
import type { PmoLens } from "./scope";

/**
 * Hard ceiling on nodes sent to Isabella.
 *
 * Chosen to cover a selection plus one hop of its neighbourhood, which is the
 * context a question about a node actually needs. Above that the extra nodes
 * are noise for every question a PMO asks from this screen.
 */
export const ISABELLA_SUBGRAPH_NODE_CAP = 24;
export const ISABELLA_SUBGRAPH_EDGE_CAP = 40;

export interface IsabellaSubgraph {
  nodes: { id: string; kind: string; label: string; status: string | null; health: string }[];
  edges: { from: string; to: string; type: string }[];
  /** True when the cap dropped nodes. Stated, never silent. */
  truncated: boolean;
  totalNodeCount: number;
}

export interface IsabellaContext {
  lens: PmoLens;
  scopeLabel: string;
  selectedNodeIds: string[];
  subgraph: IsabellaSubgraph;
  /** Highlighted path, when the user has one on screen. */
  highlightedPath: string[];
  /** Id of the evidence package currently open, if any. */
  openEvidenceId: string | null;
}

/**
 * Build the subgraph around a selection.
 *
 * Selection first, then one hop out, then stop. Breadth-first from the
 * selection rather than "the first N nodes in the array": an arbitrary slice
 * would send unrelated nodes and drop the neighbours that explain the selected
 * one, which is the opposite of the intent.
 *
 * With nothing selected, the anchors fall back to whatever the caller passes as
 * `fallbackNodeIds` (in practice: the projects the lens highlighted). If that
 * is empty too, the subgraph is empty and the question goes to Isabella without
 * graph context — which is honest, and better than attaching a random slice.
 */
export function buildIsabellaSubgraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  anchorNodeIds: readonly string[],
  nodeCap: number = ISABELLA_SUBGRAPH_NODE_CAP,
): IsabellaSubgraph {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const included = new Set<string>();

  // Pass 1: the anchors themselves. They are the question.
  for (const id of anchorNodeIds) {
    if (included.size >= nodeCap) break;
    if (byId.has(id)) included.add(id);
  }

  // Pass 2: one hop. Neighbours are what make an anchor explainable — a task
  // with no visible blocker is a fact without a reason.
  if (included.size < nodeCap) {
    const anchors = [...included];
    for (const edge of edges) {
      if (included.size >= nodeCap) break;
      const touchesSource = anchors.includes(edge.sourceNodeId);
      const touchesTarget = anchors.includes(edge.targetNodeId);
      if (!touchesSource && !touchesTarget) continue;
      const neighbour = touchesSource ? edge.targetNodeId : edge.sourceNodeId;
      if (byId.has(neighbour)) included.add(neighbour);
    }
  }

  const selectedNodes = [...included]
    .map((id) => byId.get(id))
    .filter((node): node is GraphNode => node != null)
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      status: node.status,
      health: node.health,
    }));

  const selectedEdges = edges
    .filter((edge) => included.has(edge.sourceNodeId) && included.has(edge.targetNodeId))
    .slice(0, ISABELLA_SUBGRAPH_EDGE_CAP)
    .map((edge) => ({ from: edge.sourceNodeId, to: edge.targetNodeId, type: edge.type }));

  return {
    nodes: selectedNodes,
    edges: selectedEdges,
    // Truncated when anchors alone exceeded the cap, or when the graph has more
    // nodes than were sent AND the cap is what stopped it.
    truncated: nodes.length > selectedNodes.length && selectedNodes.length >= nodeCap,
    totalNodeCount: nodes.length,
  };
}

/**
 * The entity descriptor passed to `askIsabella({ query, entity })`.
 *
 * `askIsabella` takes ONE entity, not a graph, so the subgraph travels in the
 * query text where Isabella's retrieval can actually read it. The entity points
 * at the primary selection — the thing the question is about.
 */
export function buildIsabellaAsk(
  context: IsabellaContext,
  question: string,
): { query: string; entity: { type: string; id: string; title?: string } | undefined } {
  const primary = context.subgraph.nodes.find((node) =>
    context.selectedNodeIds.includes(node.id),
  );

  const lines: string[] = [question];
  lines.push(`Scope: ${context.scopeLabel}. Active lens: ${context.lens}.`);

  if (context.subgraph.nodes.length > 0) {
    lines.push(
      `Context subgraph (${context.subgraph.nodes.length} of ${context.subgraph.totalNodeCount} nodes${
        context.subgraph.truncated ? ", truncated" : ""
      }):`,
    );
    for (const node of context.subgraph.nodes) {
      lines.push(`- ${node.kind}: ${node.label} [status=${node.status ?? "n/a"}, health=${node.health}]`);
    }
    for (const edge of context.subgraph.edges) {
      lines.push(`- edge ${edge.type}: ${edge.from} → ${edge.to}`);
    }
  }

  if (context.highlightedPath.length > 0) {
    lines.push(`Highlighted path: ${context.highlightedPath.join(" → ")}`);
  }
  if (context.openEvidenceId) {
    lines.push(`Open evidence package: ${context.openEvidenceId}`);
  }

  return {
    query: lines.join("\n"),
    entity: primary ? { type: primary.kind, id: primary.id, title: primary.label } : undefined,
  };
}
