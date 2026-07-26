// ============================================================================
// PMO Portfolio Living Graph — deterministic graph intelligence (CAP-048)
// ============================================================================
// Pure graph algorithms, entirely separate from presentation so Isabella can
// call them later without dragging React along.
//
// Two invariants run through everything here:
//   1. A node reached by several paths is counted ONCE. Portfolio graphs are
//      dense; naive traversal inflates impact until the number is worthless.
//   2. Every traversal carries a visited set. Cycles exist in real dependency
//      data and must not hang the request.
// ============================================================================

import type { GraphEdge, GraphNode } from "./contracts";

export interface AdjacencyIndex {
  /** Node id → ids reachable following edge direction. */
  outgoing: Map<string, Set<string>>;
  /** Node id → ids that point at it. */
  incoming: Map<string, Set<string>>;
  /** Direction-agnostic, for impact analysis and communities. */
  undirected: Map<string, Set<string>>;
  edgesByPair: Map<string, GraphEdge[]>;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function push(map: Map<string, Set<string>>, key: string, value: string): void {
  const existing = map.get(key);
  if (existing) existing.add(value);
  else map.set(key, new Set([value]));
}

export function buildAdjacency(edges: readonly GraphEdge[]): AdjacencyIndex {
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  const undirected = new Map<string, Set<string>>();
  const edgesByPair = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    const { sourceNodeId: from, targetNodeId: to } = edge;
    push(outgoing, from, to);
    push(incoming, to, from);
    push(undirected, from, to);
    push(undirected, to, from);
    // Undirected edges are traversable both ways in directed queries too.
    if (edge.direction === "undirected") {
      push(outgoing, to, from);
      push(incoming, from, to);
    }
    const key = pairKey(from, to);
    const bucket = edgesByPair.get(key);
    if (bucket) bucket.push(edge);
    else edgesByPair.set(key, [edge]);
  }

  return { outgoing, incoming, undirected, edgesByPair };
}

export type NeighbourDirection = "outgoing" | "incoming" | "both";

export function getNeighbors(
  index: AdjacencyIndex,
  nodeId: string,
  direction: NeighbourDirection = "both",
): string[] {
  const source =
    direction === "outgoing"
      ? index.outgoing
      : direction === "incoming"
        ? index.incoming
        : index.undirected;
  return [...(source.get(nodeId) ?? [])];
}

export interface GraphPath {
  nodeIds: string[];
  edges: GraphEdge[];
  hops: number;
}

/**
 * Shortest path between two nodes, ignoring direction.
 *
 * Breadth-first, so the first path found is the shortest. Direction is ignored
 * on purpose: a PMO asking "how are these two connected?" cares that a link
 * exists, not which way the arrow points.
 */
export function findPath(
  index: AdjacencyIndex,
  fromNodeId: string,
  toNodeId: string,
): GraphPath | null {
  if (fromNodeId === toNodeId) {
    return { nodeIds: [fromNodeId], edges: [], hops: 0 };
  }

  const previous = new Map<string, string>();
  const visited = new Set<string>([fromNodeId]);
  const queue: string[] = [fromNodeId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of index.undirected.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      previous.set(next, current);
      if (next === toNodeId) {
        const nodeIds = [next];
        let cursor = current;
        while (cursor !== fromNodeId) {
          nodeIds.unshift(cursor);
          cursor = previous.get(cursor) as string;
        }
        nodeIds.unshift(fromNodeId);
        const edges: GraphEdge[] = [];
        for (let i = 0; i < nodeIds.length - 1; i += 1) {
          const candidates = index.edgesByPair.get(pairKey(nodeIds[i], nodeIds[i + 1]));
          if (candidates?.[0]) edges.push(candidates[0]);
        }
        return { nodeIds, edges, hops: nodeIds.length - 1 };
      }
      queue.push(next);
    }
  }

  return null;
}

export interface BlastRadius {
  originNodeId: string;
  /** Nodes grouped by hop distance. Each node appears at its SHORTEST distance only. */
  byHop: Map<number, string[]>;
  /** Every affected node, origin excluded. Deduplicated. */
  affectedNodeIds: string[];
  totalAffected: number;
  truncated: boolean;
}

/**
 * What else moves when this node moves, up to `maxHops`.
 *
 * A node reachable by two different paths lands in the ring of its *shortest*
 * distance and is counted once. Without that, a portfolio graph reports impact
 * numbers larger than the graph itself.
 */
export function getBlastRadius(
  index: AdjacencyIndex,
  originNodeId: string,
  maxHops = 3,
  nodeLimit = 2_000,
): BlastRadius {
  const byHop = new Map<number, string[]>();
  const seen = new Set<string>([originNodeId]);
  const affected: string[] = [];
  let frontier = [originNodeId];
  let truncated = false;

  for (let hop = 1; hop <= maxHops; hop += 1) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const neighbour of index.undirected.get(current) ?? []) {
        // `seen` is the double-count guard AND the cycle guard.
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        next.push(neighbour);
        affected.push(neighbour);
        if (affected.length >= nodeLimit) {
          truncated = true;
          break;
        }
      }
      if (truncated) break;
    }
    if (next.length > 0) byHop.set(hop, next);
    if (truncated || next.length === 0) break;
    frontier = next;
  }

  return {
    originNodeId,
    byHop,
    affectedNodeIds: affected,
    totalAffected: affected.length,
    truncated,
  };
}

/**
 * Degree centrality, normalised to 0–1 against the most connected node.
 *
 * Degree is the honest choice for Phase 1: it is explainable in one sentence
 * ("this node touches N others"), which betweenness is not, and an unexplainable
 * criticality score is one a PMO cannot act on.
 */
export function computeDegreeCentrality(
  index: AdjacencyIndex,
  nodeIds: readonly string[],
): Map<string, number> {
  const degrees = new Map<string, number>();
  let max = 0;
  for (const id of nodeIds) {
    const degree = index.undirected.get(id)?.size ?? 0;
    degrees.set(id, degree);
    if (degree > max) max = degree;
  }
  const normalised = new Map<string, number>();
  for (const [id, degree] of degrees) {
    normalised.set(id, max === 0 ? 0 : degree / max);
  }
  return normalised;
}

/** Nodes with no relationships at all — usually a data-entry gap worth surfacing. */
export function detectOrphanNodes(
  index: AdjacencyIndex,
  nodes: readonly GraphNode[],
): GraphNode[] {
  return nodes.filter((node) => (index.undirected.get(node.id)?.size ?? 0) === 0);
}

export interface CrossProjectDependency {
  edge: GraphEdge;
  sourceProjectId: string;
  targetProjectId: string;
}

/**
 * Edges whose endpoints live in different projects.
 *
 * These are the relationships a per-project dashboard cannot see by
 * construction, and the main reason this dashboard exists.
 */
export function detectCrossProjectDependencies(
  edges: readonly GraphEdge[],
  nodes: readonly GraphNode[],
): CrossProjectDependency[] {
  const projectOf = new Map(nodes.map((node) => [node.id, node.projectId]));
  const found: CrossProjectDependency[] = [];
  const seenPairs = new Set<string>();

  for (const edge of edges) {
    const source = projectOf.get(edge.sourceNodeId);
    const target = projectOf.get(edge.targetNodeId);
    if (!source || !target || source === target) continue;
    // One pair, one entry — regardless of how many edges join them.
    const key = `${edge.type}|${pairKey(source, target)}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    found.push({ edge, sourceProjectId: source, targetProjectId: target });
  }

  return found;
}

export interface CriticalNode {
  nodeId: string;
  label: string;
  score: number;
  /** Why this node is critical, in plain terms the UI shows verbatim. */
  reasons: string[];
}

/**
 * Critical nodes, each with its explanation.
 *
 * A score with no reason attached is not actionable, so a node only qualifies
 * when at least one concrete reason applies.
 */
export function identifyCriticalNodes(
  nodes: readonly GraphNode[],
  index: AdjacencyIndex,
  centrality: ReadonlyMap<string, number>,
  crossProject: readonly CrossProjectDependency[],
  threshold = 0.5,
): CriticalNode[] {
  const crossProjectNodeIds = new Set<string>();
  for (const dependency of crossProject) {
    crossProjectNodeIds.add(dependency.edge.sourceNodeId);
    crossProjectNodeIds.add(dependency.edge.targetNodeId);
  }

  const critical: CriticalNode[] = [];

  for (const node of nodes) {
    const reasons: string[] = [];
    const score = centrality.get(node.id) ?? 0;
    const degree = index.undirected.get(node.id)?.size ?? 0;

    if (score >= threshold) {
      reasons.push(`Connected to ${degree} other nodes — among the most connected in the portfolio`);
    }
    if (crossProjectNodeIds.has(node.id)) {
      reasons.push("Sits on a relationship that crosses project boundaries");
    }
    if (node.metrics.isCritical === 1) {
      reasons.push("Marked critical on the schedule critical path");
    }
    if (node.health === "critical") {
      reasons.push(`Status "${node.status ?? "unknown"}" puts it in a critical state`);
    }

    if (reasons.length === 0) continue;

    critical.push({
      nodeId: node.id,
      label: node.label,
      // Reason count lifts the score so a merely well-connected node ranks
      // below one that is well-connected AND blocked AND cross-project.
      score: Math.min(1, score + (reasons.length - 1) * 0.1),
      reasons,
    });
  }

  return critical.sort((a, b) => b.score - a.score);
}

/**
 * Operational communities via label propagation.
 *
 * Deterministic: nodes are processed in sorted order and ties break on the
 * lowest label, so the same graph always yields the same communities. A random
 * tiebreak would reshuffle the PMO's mental map on every refresh.
 */
export function detectCommunities(
  index: AdjacencyIndex,
  nodeIds: readonly string[],
  iterations = 5,
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const id of nodeIds) labels.set(id, id);
  const ordered = [...nodeIds].sort();

  for (let pass = 0; pass < iterations; pass += 1) {
    let changed = false;
    for (const id of ordered) {
      const neighbours = index.undirected.get(id);
      if (!neighbours || neighbours.size === 0) continue;

      const tally = new Map<string, number>();
      for (const neighbour of neighbours) {
        const label = labels.get(neighbour);
        if (label === undefined) continue;
        tally.set(label, (tally.get(label) ?? 0) + 1);
      }

      let best = labels.get(id) as string;
      let bestCount = -1;
      for (const [label, count] of [...tally].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (count > bestCount) {
          best = label;
          bestCount = count;
        }
      }
      if (best !== labels.get(id)) {
        labels.set(id, best);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return labels;
}
