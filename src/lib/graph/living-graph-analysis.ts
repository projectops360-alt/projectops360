// ============================================================================
// ProjectOps360° — Living Graph client-side analysis helpers
// ============================================================================
// Pure, deterministic graph analysis used by the Living Graph visualization:
// degrees, reachability, bottleneck/rework/traceability/risk scoring,
// critical-path approximation (longest path on the DAG portion), cycle and
// orphan detection, overlay emphasis and what-if delay simulation.
//
// Intentionally pragmatic — useful heuristics over academic graph theory.
// ============================================================================

import type {
  LivingGraphNode,
  LivingGraphEdge,
  LivingGraphRiskLevel,
  LivingGraphOverlay,
  LivingGraphSimulationScenario,
  LivingGraphSimulationState,
  LivingGraphInsight,
  GraphMetricSummary,
} from "@/types/living-graph";
import type { ExecutionStatus } from "@/lib/execution/status-engine";
import { resolveNodeExecutionStatus } from "./living-graph-status";

// ── Adjacency ──────────────────────────────────────────────────────────────────

export interface GraphAdjacency {
  /** nodeId → outgoing edges */
  out: Map<string, LivingGraphEdge[]>;
  /** nodeId → incoming edges */
  inc: Map<string, LivingGraphEdge[]>;
  nodeById: Map<string, LivingGraphNode>;
}

export function buildAdjacency(
  nodes: LivingGraphNode[],
  edges: LivingGraphEdge[],
): GraphAdjacency {
  const out = new Map<string, LivingGraphEdge[]>();
  const inc = new Map<string, LivingGraphEdge[]>();
  const nodeById = new Map<string, LivingGraphNode>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
    out.set(n.id, []);
    inc.set(n.id, []);
  }
  for (const e of edges) {
    // Skip edges pointing outside the loaded node set
    if (!nodeById.has(e.sourceNodeId) || !nodeById.has(e.targetNodeId)) continue;
    out.get(e.sourceNodeId)!.push(e);
    inc.get(e.targetNodeId)!.push(e);
  }
  return { out, inc, nodeById };
}

// ── Reachability ───────────────────────────────────────────────────────────────

/** BFS over outgoing (or incoming) edges. Excludes the start node itself. */
export function collectReachable(
  adjacency: GraphAdjacency,
  startId: string,
  direction: "downstream" | "upstream",
  maxDepth = Number.POSITIVE_INFINITY,
): Set<string> {
  const result = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];
  const seen = new Set<string>([startId]);
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const edges =
      direction === "downstream" ? adjacency.out.get(id) : adjacency.inc.get(id);
    for (const e of edges ?? []) {
      const next = direction === "downstream" ? e.targetNodeId : e.sourceNodeId;
      if (!seen.has(next)) {
        seen.add(next);
        result.add(next);
        queue.push({ id: next, depth: depth + 1 });
      }
    }
  }
  return result;
}

// ── Per-node metrics ───────────────────────────────────────────────────────────

export interface NodeMetrics {
  inDegree: number;
  outDegree: number;
  /** Degree-based centrality approximation, normalized 0–1. */
  centrality: number;
  downstreamCount: number;
  upstreamCount: number;
  /** 0–1 composite of degree, duration and blocker pressure. */
  bottleneckScore: number;
  /** True when the node participates in delayed/loop-like flow. */
  reworkSignal: boolean;
  /** 0–1; higher = bigger traceability gap (less evidence). */
  traceabilityGapScore: number;
  /** 0–1 composite risk. */
  riskScore: number;
  onCriticalPath: boolean;
  /** 0–1; completed, stable, well-evidenced repeated segments score high. */
  sopCandidateScore: number;
  /** 0–1 labor capacity risk score derived from metadata.laborRisk. */
  laborRiskScore: number;
  isOrphan: boolean;
  inCycle: boolean;
  /** Deterministic Execution Status (ADR-006) — single source for node state. */
  executionStatus: ExecutionStatus;
}

export interface GraphAnalysis {
  adjacency: GraphAdjacency;
  metrics: Map<string, NodeMetrics>;
  criticalPathIds: string[];
  criticalEdgeIds: Set<string>;
  cycles: string[][];
  summary: GraphMetricSummary;
}

const COMPLETED_STATUSES = new Set(["done", "completed", "tested"]);

function nodeDurationDays(node: LivingGraphNode): number {
  if (node.durationDays != null && node.durationDays > 0) return node.durationDays;
  if (node.startDate && node.endDate) {
    const ms = new Date(node.endDate).getTime() - new Date(node.startDate).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms / 86_400_000;
  }
  return 1;
}

/** Detect up to `maxCycles` simple cycles with bounded DFS (depth ≤ 8). */
export function detectCycles(
  adjacency: GraphAdjacency,
  maxCycles = 10,
): string[][] {
  const cycles: string[][] = [];
  const globallySeen = new Set<string>();

  for (const startId of adjacency.nodeById.keys()) {
    if (cycles.length >= maxCycles) break;
    if (globallySeen.has(startId)) continue;
    const stack: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }];
    let steps = 0;
    while (stack.length > 0 && steps < 2000) {
      steps++;
      const { id, path } = stack.pop()!;
      for (const e of adjacency.out.get(id) ?? []) {
        if (e.targetNodeId === startId) {
          cycles.push([...path, startId]);
          if (cycles.length >= maxCycles) break;
          continue;
        }
        if (path.length < 8 && !path.includes(e.targetNodeId)) {
          stack.push({ id: e.targetNodeId, path: [...path, e.targetNodeId] });
        }
      }
      if (cycles.length >= maxCycles) break;
    }
    globallySeen.add(startId);
  }
  return cycles;
}

/**
 * Longest-path approximation over the acyclic portion of the graph,
 * weighted by node duration. Edges that would close a cycle are skipped.
 * Used as the critical path when the backend does not provide one.
 */
export function computeLongestPath(
  adjacency: GraphAdjacency,
): { pathIds: string[]; edgeIds: Set<string> } {
  // Kahn's algorithm order; nodes left over belong to cycles and are appended.
  const inCount = new Map<string, number>();
  for (const id of adjacency.nodeById.keys()) {
    inCount.set(id, adjacency.inc.get(id)?.length ?? 0);
  }
  const order: string[] = [];
  const queue = [...adjacency.nodeById.keys()].filter((id) => inCount.get(id) === 0);
  const queued = new Set(queue);
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of adjacency.out.get(id) ?? []) {
      const c = (inCount.get(e.targetNodeId) ?? 0) - 1;
      inCount.set(e.targetNodeId, c);
      if (c === 0 && !queued.has(e.targetNodeId)) {
        queued.add(e.targetNodeId);
        queue.push(e.targetNodeId);
      }
    }
  }
  const inOrder = new Set(order);
  const orderIndex = new Map(order.map((id, i) => [id, i]));

  // DP over topological order
  const best = new Map<string, number>();
  const bestPrev = new Map<string, { nodeId: string; edgeId: string } | null>();
  for (const id of order) {
    const node = adjacency.nodeById.get(id)!;
    if (!best.has(id)) {
      best.set(id, nodeDurationDays(node));
      bestPrev.set(id, null);
    }
    for (const e of adjacency.out.get(id) ?? []) {
      const targetId = e.targetNodeId;
      // Skip edges into cycle members or backwards edges
      if (!inOrder.has(targetId)) continue;
      if ((orderIndex.get(targetId) ?? 0) <= (orderIndex.get(id) ?? 0)) continue;
      const target = adjacency.nodeById.get(targetId)!;
      const candidate =
        (best.get(id) ?? 0) + (e.lagDays ?? 0) + nodeDurationDays(target);
      if (candidate > (best.get(targetId) ?? Number.NEGATIVE_INFINITY)) {
        best.set(targetId, candidate);
        bestPrev.set(targetId, { nodeId: id, edgeId: e.id });
      }
    }
  }

  // Reconstruct from the best terminal node
  let endId: string | null = null;
  let max = Number.NEGATIVE_INFINITY;
  for (const [id, value] of best) {
    if (value > max) {
      max = value;
      endId = id;
    }
  }
  const pathIds: string[] = [];
  const edgeIds = new Set<string>();
  let cursor = endId;
  while (cursor) {
    pathIds.unshift(cursor);
    const prev = bestPrev.get(cursor);
    if (!prev) break;
    edgeIds.add(prev.edgeId);
    cursor = prev.nodeId;
  }
  // A path of one node is not a meaningful critical path
  if (pathIds.length < 2) return { pathIds: [], edgeIds: new Set() };
  return { pathIds, edgeIds };
}

const RISK_WEIGHT: Record<LivingGraphRiskLevel, number> = {
  low: 0.2,
  medium: 0.55,
  high: 1,
};

/** Full analysis pass. Call inside useMemo — O(V + E) plus bounded DFS. */
export function analyzeGraph(
  nodes: LivingGraphNode[],
  edges: LivingGraphEdge[],
): GraphAnalysis {
  const adjacency = buildAdjacency(nodes, edges);
  const cycles = detectCycles(adjacency);
  const cycleMembers = new Set(cycles.flat());
  const { pathIds: criticalPathIds, edgeIds: criticalEdgeIds } =
    computeLongestPath(adjacency);
  const criticalSet = new Set(criticalPathIds);

  const maxDegree = Math.max(
    1,
    ...nodes.map(
      (n) =>
        (adjacency.out.get(n.id)?.length ?? 0) +
        (adjacency.inc.get(n.id)?.length ?? 0),
    ),
  );

  const metrics = new Map<string, NodeMetrics>();
  let blockedCount = 0;
  let waitingCount = 0;
  let bottleneckCount = 0;
  let orphanCount = 0;

  for (const node of nodes) {
    const outEdges = adjacency.out.get(node.id) ?? [];
    const incEdges = adjacency.inc.get(node.id) ?? [];
    const inDegree = incEdges.length;
    const outDegree = outEdges.length;
    const degree = inDegree + outDegree;

    // Bounded BFS keeps worst-case dense graphs responsive
    const downstreamCount = collectReachable(adjacency, node.id, "downstream", 12).size;
    const upstreamCount = collectReachable(adjacency, node.id, "upstream", 12).size;

    const duration = nodeDurationDays(node);
    const blockedPressure =
      (node.isBlocked ? 0.35 : 0) +
      incEdges.filter((e) => e.edgeType === "blocked").length * 0.15;
    const bottleneckScore = Math.min(
      1,
      (degree / maxDegree) * 0.45 +
        Math.min(duration / 14, 1) * 0.25 +
        Math.min(downstreamCount / 10, 1) * 0.2 +
        blockedPressure,
    );

    const reworkSignal =
      cycleMembers.has(node.id) ||
      outEdges.some((e) => e.edgeType === "delayed") ||
      incEdges.some((e) => e.edgeType === "delayed");

    // Evidence = informational edges or attached document/decision neighbors
    const evidenceEdges =
      incEdges.filter((e) => e.edgeType === "informed").length +
      outEdges.filter((e) => e.edgeType === "informed").length;
    const hasDocNeighbor = [...incEdges, ...outEdges].some((e) => {
      const otherId = e.sourceNodeId === node.id ? e.targetNodeId : e.sourceNodeId;
      const other = adjacency.nodeById.get(otherId);
      return (
        other?.nodeType === "document_link" || other?.nodeType === "decision_cascade"
      );
    });
    const baseTrace =
      node.traceabilityScore ??
      Math.min(1, evidenceEdges * 0.35 + (hasDocNeighbor ? 0.4 : 0) + (node.description ? 0.2 : 0));
    const traceabilityGapScore = node.nodeType === "document_link" ? 0 : 1 - baseTrace;

    const riskScore = Math.min(
      1,
      (node.riskLevel ? RISK_WEIGHT[node.riskLevel] : 0) * 0.5 +
        (node.isBlocked ? 0.3 : 0) +
        Math.min(downstreamCount / 10, 1) * 0.2 +
        (reworkSignal ? 0.15 : 0),
    );

    const isCompleted =
      node.status != null && COMPLETED_STATUSES.has(node.status.toLowerCase());
    const sopCandidateScore =
      isCompleted && !reworkSignal && !node.isBlocked
        ? Math.min(1, 0.4 + (1 - traceabilityGapScore) * 0.35 + Math.min(degree / 6, 1) * 0.25)
        : 0;

    const isOrphan = degree === 0;
    if (isOrphan) orphanCount++;
    if (bottleneckScore >= 0.6) bottleneckCount++;

    // Deterministic execution status (ADR-006). Blocked requires an explicit
    // active impediment AND a non-terminal item — a completed task with a stale
    // is_blocked flag is NOT blocked (REG-008). Waiting on a predecessor is
    // counted separately, never as blocked.
    const executionStatus = resolveNodeExecutionStatus(node, adjacency);
    if (executionStatus === "blocked") blockedCount++;
    else if (executionStatus === "waiting_on_dependency") waitingCount++;

    // Labor risk score from metadata.laborRisk.shortageRisk
    const laborRiskScore = (() => {
      const lr = node.metadata?.laborRisk;
      if (!lr || typeof lr !== "object") return 0;
      const risk = (lr as { shortageRisk?: string }).shortageRisk;
      const riskMap: Record<string, number> = {
        none: 0,
        low: 0.15,
        medium: 0.4,
        high: 0.7,
        critical: 1,
      };
      return riskMap[risk ?? "none"] ?? 0;
    })();

    metrics.set(node.id, {
      inDegree,
      outDegree,
      centrality: degree / maxDegree,
      downstreamCount,
      upstreamCount,
      bottleneckScore,
      reworkSignal,
      traceabilityGapScore,
      riskScore,
      onCriticalPath: node.isCritical || criticalSet.has(node.id),
      sopCandidateScore,
      laborRiskScore,
      isOrphan,
      inCycle: cycleMembers.has(node.id),
      executionStatus,
    });
  }

  // Count labor risk nodes
  const laborRiskCount = [...metrics.values()].filter(
    (m) => m.laborRiskScore > 0,
  ).length;

  const summary: GraphMetricSummary = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    orphanCount,
    cycleCount: cycles.length,
    blockedCount,
    waitingCount,
    bottleneckCount,
    criticalPathLength: criticalPathIds.length,
    maxDepth: criticalPathIds.length > 0 ? criticalPathIds.length - 1 : 0,
    laborRiskCount,
  };

  return { adjacency, metrics, criticalPathIds, criticalEdgeIds, cycles, summary };
}

// ── Overlay emphasis ───────────────────────────────────────────────────────────

export type OverlayEmphasis = "highlight" | "normal" | "dimmed";

/** Resolve how a node should be emphasized under the active overlay. */
export function nodeOverlayEmphasis(
  overlay: LivingGraphOverlay,
  node: LivingGraphNode,
  metrics: NodeMetrics | undefined,
  analysis: GraphAnalysis,
): OverlayEmphasis {
  if (!metrics) return "normal";
  switch (overlay) {
    case "bottleneck":
      return metrics.bottleneckScore >= 0.6
        ? "highlight"
        : metrics.bottleneckScore >= 0.35
          ? "normal"
          : "dimmed";
    case "criticalPath":
      return metrics.onCriticalPath ? "highlight" : "dimmed";
    case "rework":
      return metrics.reworkSignal ? "highlight" : "dimmed";
    case "traceabilityGap":
      return metrics.traceabilityGapScore >= 0.6
        ? "highlight"
        : metrics.traceabilityGapScore >= 0.3
          ? "normal"
          : "dimmed";
    case "risk":
      return metrics.riskScore >= 0.5
        ? "highlight"
        : metrics.riskScore >= 0.25
          ? "normal"
          : "dimmed";
    case "sopCandidate":
      return metrics.sopCandidateScore >= 0.6
        ? "highlight"
        : metrics.sopCandidateScore > 0
          ? "normal"
          : "dimmed";
    case "blocker": {
      if (node.isBlocked || node.nodeType === "blocker_event") return "highlight";
      // Downstream of any blocked node → normal; everything else dimmed
      const blockedIds = [...analysis.adjacency.nodeById.values()]
        .filter((n) => n.isBlocked || n.nodeType === "blocker_event")
        .map((n) => n.id);
      for (const id of blockedIds) {
        if (collectReachable(analysis.adjacency, id, "downstream", 6).has(node.id)) {
          return "normal";
        }
      }
      return "dimmed";
    }
    case "laborCapacity":
      return metrics.laborRiskScore >= 0.5
        ? "highlight"
        : metrics.laborRiskScore >= 0.2
          ? "normal"
          : "dimmed";
    case "variance": {
      // Variance overlay: highlight nodes with major/critical variance or high schedule risk
      const varianceData = node.metadata?.variance as
        | import("@/types/living-graph").VarianceNodeData
        | undefined;
      if (!varianceData) return "dimmed";
      if (
        varianceData.scheduleRisk === "critical" ||
        varianceData.scheduleRisk === "high"
      )
        return "highlight";
      if (
        varianceData.varianceSeverity === "major" ||
        varianceData.varianceSeverity === "critical"
      )
        return "highlight";
      if (varianceData.varianceSeverity === "minor") return "normal";
      return "dimmed";
    }
    case "workforceCapacity": {
      // Curated workforce view: everything shown is relevant. Overloaded →
      // highlight; everyone else stays visible (normal). Only nodes with no
      // workforce data are dimmed.
      const wf = node.metadata?.workforce as
        | import("@/types/living-graph").WorkforceNodeData
        | undefined;
      if (!wf) return "dimmed";
      if (wf.status === "critical" || wf.status === "overallocated") return "highlight";
      return "normal";
    }
    default:
      return "normal";
  }
}

// ── What-if simulation ─────────────────────────────────────────────────────────

const SCENARIO_DELAY_DAYS: Record<LivingGraphSimulationScenario, number> = {
  delay1d: 1,
  delay3d: 3,
  delay1w: 7,
  markBlocked: 5, // assume a blocker holds ~5 days until resolved
  removeBlocker: -3, // unblocking recovers ~3 days
  increaseDuration: 0, // computed from the node's own duration
};

/**
 * Deterministic downstream-impact estimation. Propagates the scenario's delay
 * through outgoing edges, attenuating 15% per hop (parallel slack absorbs
 * part of the delay in practice).
 */
export function runSimulation(
  analysis: GraphAnalysis,
  nodeId: string,
  scenario: LivingGraphSimulationScenario,
): LivingGraphSimulationState | null {
  const node = analysis.adjacency.nodeById.get(nodeId);
  if (!node) return null;

  let baseDelay = SCENARIO_DELAY_DAYS[scenario];
  if (scenario === "increaseDuration") {
    baseDelay = nodeDurationDays(node) * 0.5;
  }

  const affected = collectReachable(analysis.adjacency, nodeId, "downstream", 12);
  const affectedNodeIds = [...affected];

  // Depth of each affected node for attenuation
  const depth = new Map<string, number>([[nodeId, 0]]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const e of analysis.adjacency.out.get(id) ?? []) {
      if (!depth.has(e.targetNodeId)) {
        depth.set(e.targetNodeId, (depth.get(id) ?? 0) + 1);
        queue.push(e.targetNodeId);
      }
    }
  }

  let maxPropagated = Math.abs(baseDelay);
  for (const id of affectedNodeIds) {
    const d = depth.get(id) ?? 1;
    const propagated = Math.abs(baseDelay) * Math.pow(0.85, Math.max(0, d - 1));
    maxPropagated = Math.max(maxPropagated, propagated);
  }
  const estimatedDelayDays =
    Math.round(Math.sign(baseDelay) * maxPropagated * 10) / 10;

  const criticalPathImpact = affectedNodeIds.filter(
    (id) => analysis.metrics.get(id)?.onCriticalPath,
  ).length;

  const affectedMilestoneLabels = affectedNodeIds
    .map((id) => analysis.adjacency.nodeById.get(id))
    .filter((n): n is LivingGraphNode => n?.nodeType === "milestone_gate")
    .map((n) => n.label)
    .slice(0, 3);

  // Strongest direct downstream dependency = highest weight outgoing edge
  let strongest: LivingGraphEdge | null = null;
  for (const e of analysis.adjacency.out.get(nodeId) ?? []) {
    if (!strongest || e.weight > strongest.weight) strongest = e;
  }
  const strongestDependencyLabel = strongest
    ? (analysis.adjacency.nodeById.get(strongest.targetNodeId)?.label ?? null)
    : null;

  const riskDelta: LivingGraphRiskLevel =
    scenario === "removeBlocker"
      ? "low"
      : criticalPathImpact > 0 || affectedNodeIds.length >= 5
        ? "high"
        : affectedNodeIds.length >= 2
          ? "medium"
          : "low";

  return {
    focusNodeId: nodeId,
    scenario,
    affectedNodeIds,
    estimatedDelayDays,
    criticalPathImpact,
    affectedMilestoneLabels,
    strongestDependencyLabel,
    riskDelta,
  };
}

// ── Entity clustering (large-graph mode) ───────────────────────────────────────

/**
 * Collapse all process events of the same source entity into a single cluster
 * node. Reduces node count drastically when entities emit many transitions.
 * Cluster size is stored in `metadata.clusterSize`.
 */
export function clusterByEntity(
  nodes: LivingGraphNode[],
  edges: LivingGraphEdge[],
): { nodes: LivingGraphNode[]; edges: LivingGraphEdge[] } {
  const clusterKey = (n: LivingGraphNode) =>
    `cluster:${n.sourceEntityType}:${n.sourceEntityId}`;

  const clusters = new Map<string, LivingGraphNode[]>();
  for (const node of nodes) {
    const key = clusterKey(node);
    const list = clusters.get(key) ?? [];
    list.push(node);
    clusters.set(key, list);
  }

  const memberToCluster = new Map<string, string>();
  const clusteredNodes: LivingGraphNode[] = [];

  for (const [key, members] of clusters) {
    // Latest event represents the entity's current state
    const sorted = [...members].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    const latest = sorted[sorted.length - 1];
    for (const m of members) memberToCluster.set(m.id, key);
    clusteredNodes.push({
      ...latest,
      id: key,
      occurredAt: sorted[0].occurredAt,
      isBlocked: members.some((m) => m.isBlocked),
      riskLevel:
        members.find((m) => m.riskLevel === "high")?.riskLevel ??
        members.find((m) => m.riskLevel === "medium")?.riskLevel ??
        latest.riskLevel,
      metadata: { ...latest.metadata, clusterSize: members.length },
    });
  }

  return {
    nodes: clusteredNodes,
    edges: aggregateEdges(edges, (nodeId) => memberToCluster.get(nodeId) ?? null, "cluster-edge"),
  };
}

/**
 * Re-point edges to group ids, dropping self-loops and summing weights of
 * merged parallel edges — the aggregated weight is the transition frequency
 * shown on the flow (process-explorer style).
 */
function aggregateEdges(
  edges: LivingGraphEdge[],
  groupOf: (nodeId: string) => string | null,
  idPrefix: string,
): LivingGraphEdge[] {
  const grouped = new Map<string, LivingGraphEdge>();
  for (const edge of edges) {
    const source = groupOf(edge.sourceNodeId);
    const target = groupOf(edge.targetNodeId);
    if (!source || !target || source === target) continue;
    const key = `${source}→${target}:${edge.edgeType}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.weight += edge.weight;
      existing.metadata = {
        ...existing.metadata,
        merged_count: ((existing.metadata.merged_count as number) ?? 1) + 1,
      };
    } else {
      grouped.set(key, {
        ...edge,
        id: `${idPrefix}:${key}`,
        sourceNodeId: source,
        targetNodeId: target,
        metadata: { ...edge.metadata, merged_count: 1 },
      });
    }
  }
  return [...grouped.values()];
}

// ── Milestone-level aggregation (flowchart view) ───────────────────────────────

const DONE_STATUSES = new Set(["done", "completed", "tested"]);

/**
 * Collapse the whole graph into one node per milestone — the high-level
 * flowchart view. Nodes without a milestone are omitted (noise at this level).
 *
 * For readability this level intentionally shows ONLY the sequential chain
 * (one clean flow line, roadmap style) — never the aggregated edge mesh.
 * Each chain edge carries the target milestone's task count and duration so
 * the UI can render an info callout between cards.
 *
 * Per-milestone node metadata: clusterSize (process events), tasksTotal and
 * tasksDone (distinct tasks observed in the graph).
 */
export function aggregateByMilestone(
  nodes: LivingGraphNode[],
  edges: LivingGraphEdge[],
): { nodes: LivingGraphNode[]; edges: LivingGraphEdge[] } {
  void edges; // real edges are deliberately not rendered at this level
  const groups = new Map<string, LivingGraphNode[]>();

  for (const node of nodes) {
    if (!node.milestoneId) continue;
    const key = `milestone:${node.milestoneId}`;
    const list = groups.get(key) ?? [];
    list.push(node);
    groups.set(key, list);
  }

  const milestoneNodes: LivingGraphNode[] = [];
  for (const [key, members] of groups) {
    const sorted = [...members].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    // The milestone_gate member carries the milestone's own status/progress
    const gate = members.find((m) => m.nodeType === "milestone_gate");
    const latest = sorted[sorted.length - 1];
    const representative = gate ?? latest;

    // Distinct tasks observed inside this milestone (and how many are done)
    const taskStatus = new Map<string, string | null>();
    for (const m of members) {
      if (m.sourceEntityType === "roadmap_tasks") {
        taskStatus.set(m.sourceEntityId, m.status);
      }
    }
    const tasksTotal = taskStatus.size;
    let tasksDone = 0;
    let tasksStarted = 0;
    for (const status of taskStatus.values()) {
      const s = status?.toLowerCase() ?? "";
      if (s && DONE_STATUSES.has(s)) tasksDone++;
      else if (s && s !== "not_started" && s !== "deferred") tasksStarted++;
    }

    // Living document: derive progress + status from the tasks in real time,
    // instead of the stored progress_percent/status which can be stale (0 / planned).
    const anyBlocked = members.some((m) => m.isBlocked);
    const computedProgress =
      tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : (representative.progress ?? 0);
    const computedStatus =
      tasksTotal === 0
        ? representative.status
        : tasksDone === tasksTotal
          ? "completed"
          : anyBlocked
            ? "blocked"
            : tasksDone > 0 || tasksStarted > 0
              ? "in_progress"
              : "planned";

    milestoneNodes.push({
      ...representative,
      id: key,
      nodeType: "milestone_gate",
      label: representative.milestoneLabel ?? representative.label,
      occurredAt: sorted[0].occurredAt,
      progress: computedProgress,
      status: computedStatus as typeof representative.status,
      isBlocked: anyBlocked,
      riskLevel:
        members.find((m) => m.riskLevel === "high")?.riskLevel ??
        members.find((m) => m.riskLevel === "medium")?.riskLevel ??
        representative.riskLevel,
      metadata: {
        ...representative.metadata,
        clusterSize: members.length,
        tasksTotal,
        tasksDone,
      },
    });
  }

  // Single sequential flow line through the milestones, following the
  // roadmap order (order_index) — never event order, which is meaningless
  // for projects whose events started flowing mid-execution.
  const ordered = [...milestoneNodes].sort((a, b) => {
    const orderA = a.milestoneOrder ?? Number.POSITIVE_INFINITY;
    const orderB = b.milestoneOrder ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    const startA = a.startDate ? new Date(a.startDate).getTime() : Number.POSITIVE_INFINITY;
    const startB = b.startDate ? new Date(b.startDate).getTime() : Number.POSITIVE_INFINITY;
    if (startA !== startB) return startA - startB;
    return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
  });
  const chainEdges: LivingGraphEdge[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    const durationDays =
      b.startDate && b.endDate
        ? Math.max(
            0,
            Math.round(
              (new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) /
                86_400_000,
            ),
          )
        : null;
    chainEdges.push({
      id: `milestone-chain:${a.id}→${b.id}`,
      projectId: a.projectId,
      sourceNodeId: a.id,
      targetNodeId: b.id,
      edgeType: "enabled",
      weight: 1,
      lagDays: null,
      isCritical: false,
      riskLevel: null,
      metadata: {
        synthetic: true,
        milestone_chain: true,
        tasks: (b.metadata.tasksTotal as number) ?? 0,
        duration_days: durationDays,
      },
    });
  }

  return { nodes: ordered, edges: chainEdges };
}

// ── Edge pruning (clarity mode) ────────────────────────────────────────────────

/**
 * Auto-linked process edges (temporal proximity) create an all-to-all mesh
 * that is unreadable. Keep, per target node and edge type, only the strongest
 * `maxIncoming` incoming edges by weight. Blocking edges are always kept —
 * they are signal, never noise.
 */
export function pruneEdgesForClarity(
  edges: LivingGraphEdge[],
  maxIncoming = 2,
): LivingGraphEdge[] {
  const byTargetAndType = new Map<string, LivingGraphEdge[]>();
  const kept: LivingGraphEdge[] = [];

  for (const edge of edges) {
    if (edge.edgeType === "blocked" || edge.edgeType === "labor_constrained") {
      kept.push(edge);
      continue;
    }
    const key = `${edge.targetNodeId}:${edge.edgeType}`;
    const list = byTargetAndType.get(key) ?? [];
    list.push(edge);
    byTargetAndType.set(key, list);
  }

  for (const list of byTargetAndType.values()) {
    list.sort((a, b) => b.weight - a.weight);
    kept.push(...list.slice(0, maxIncoming));
  }

  return kept;
}

// ── Executive health metrics (premium dashboard header) ────────────────────────

export interface GraphHealthMetrics {
  /** 0–100 composite process health. */
  healthScore: number;
  criticalPathRisk: LivingGraphRiskLevel;
  activeBottlenecks: number;
  traceabilityGaps: number;
  sopCandidates: number;
  reworkSignals: number;
  /** 0–100: how much signal the graph has to support its conclusions. */
  processConfidence: number;
}

/** Deterministic executive metrics derived from a full analysis pass. */
export function computeGraphHealth(analysis: GraphAnalysis): GraphHealthMetrics {
  let traceabilityGaps = 0;
  let sopCandidates = 0;
  let reworkSignals = 0;
  let traceSum = 0;
  let blockedOnCritical = 0;

  for (const [nodeId, m] of analysis.metrics) {
    if (m.traceabilityGapScore >= 0.6) traceabilityGaps++;
    if (m.sopCandidateScore >= 0.6) sopCandidates++;
    if (m.reworkSignal) reworkSignals++;
    traceSum += 1 - m.traceabilityGapScore;
    if (m.onCriticalPath && analysis.adjacency.nodeById.get(nodeId)?.isBlocked) {
      blockedOnCritical++;
    }
  }

  const { summary } = analysis;
  const nodeCount = Math.max(1, summary.nodeCount);

  const criticalPathRisk: LivingGraphRiskLevel =
    blockedOnCritical > 0
      ? "high"
      : summary.blockedCount > 0 || summary.cycleCount > 0
        ? "medium"
        : "low";

  const healthScore = Math.max(
    5,
    Math.min(
      100,
      Math.round(
        100 -
          summary.blockedCount * 8 -
          summary.bottleneckCount * 5 -
          reworkSignals * 3 -
          traceabilityGaps * 2 -
          summary.cycleCount * 5,
      ),
    ),
  );

  // Confidence = evidence density + graph size signal
  const processConfidence = Math.round(
    (traceSum / nodeCount) * 60 + Math.min(nodeCount / 50, 1) * 40,
  );

  return {
    healthScore,
    criticalPathRisk,
    activeBottlenecks: summary.bottleneckCount,
    traceabilityGaps,
    sopCandidates,
    reworkSignals,
    processConfidence,
  };
}

// ── Path narrative (deterministic; PI-008 upgrades this to AI) ─────────────────

export interface PathNarrative {
  steps: { id: string; label: string }[];
  /** Sum of node durations + edge lags along the path, in days. */
  totalDurationDays: number;
  /** Labels of blocked nodes on the path. */
  blockedLabels: string[];
  /** "A → B" segments whose connecting edge signals delay/rework. */
  delayedSegments: string[];
  /** Lowest-weight connection on the path (the weakest dependency). */
  weakestEdge: { sourceLabel: string; targetLabel: string; weight: number } | null;
}

/**
 * Deterministic summary of a found path: steps, accumulated duration,
 * blockers/delays along the way and the weakest connection. Pure data —
 * the UI renders it via i18n; PI-008 replaces the copy with AI narrative.
 */
export function buildPathNarrative(
  analysis: GraphAnalysis,
  pathIds: string[],
): PathNarrative | null {
  if (pathIds.length < 2) return null;

  const steps: { id: string; label: string }[] = [];
  const blockedLabels: string[] = [];
  let totalDurationDays = 0;

  for (const id of pathIds) {
    const node = analysis.adjacency.nodeById.get(id);
    if (!node) return null; // path no longer matches the displayed graph
    steps.push({ id, label: node.label });
    totalDurationDays += nodeDurationDays(node);
    if (node.isBlocked) blockedLabels.push(node.label);
  }

  const delayedSegments: string[] = [];
  let weakest: { sourceLabel: string; targetLabel: string; weight: number } | null =
    null;

  for (let i = 0; i < pathIds.length - 1; i++) {
    // Strongest edge connecting consecutive path nodes represents the segment
    let connecting: LivingGraphEdge | null = null;
    for (const e of analysis.adjacency.out.get(pathIds[i]) ?? []) {
      if (e.targetNodeId === pathIds[i + 1] && (!connecting || e.weight > connecting.weight)) {
        connecting = e;
      }
    }
    if (!connecting) continue;
    totalDurationDays += connecting.lagDays ?? 0;
    const sourceLabel = steps[i].label;
    const targetLabel = steps[i + 1].label;
    if (connecting.edgeType === "delayed" || connecting.edgeType === "blocked") {
      delayedSegments.push(`${sourceLabel} → ${targetLabel}`);
    }
    if (!weakest || connecting.weight < weakest.weight) {
      weakest = { sourceLabel, targetLabel, weight: connecting.weight };
    }
  }

  return {
    steps,
    totalDurationDays: Math.round(totalDurationDays * 10) / 10,
    blockedLabels,
    delayedSegments,
    weakestEdge: weakest,
  };
}

// ── Deterministic insight (AI placeholder) ─────────────────────────────────────

export function buildNodeInsight(
  node: LivingGraphNode,
  metrics: NodeMetrics | undefined,
): LivingGraphInsight {
  if (!metrics) return { kind: "healthy", values: {} };
  if (node.isBlocked || node.nodeType === "blocker_event") {
    return { kind: "blocker", values: { downstream: metrics.downstreamCount } };
  }
  if (metrics.bottleneckScore >= 0.6) {
    return {
      kind: "bottleneck",
      values: {
        inDegree: metrics.inDegree,
        outDegree: metrics.outDegree,
        downstream: metrics.downstreamCount,
      },
    };
  }
  if (metrics.reworkSignal) {
    return { kind: "rework", values: {} };
  }
  if (metrics.laborRiskScore >= 0.5 && node.metadata?.laborRisk) {
    const lr = node.metadata.laborRisk as {
      tradeKey?: string;
      weekLabel?: string;
      gapHeadcount?: number;
      requiredHeadcount?: number;
      availableHeadcount?: number;
      criticalPathImpact?: boolean;
    };
    return {
      kind: "laborCapacityGap",
      values: {
        trade: lr.tradeKey ?? "",
        week: lr.weekLabel ?? "",
        gap: Math.abs(lr.gapHeadcount ?? 0),
        requiredHC: lr.requiredHeadcount ?? 0,
        availableHC: lr.availableHeadcount ?? 0,
        downstream: metrics.downstreamCount,
        criticalPath: lr.criticalPathImpact ? 1 : 0,
      },
    };
  }
  if (metrics.riskScore >= 0.5) {
    return { kind: "risk", values: { downstream: metrics.downstreamCount } };
  }
  if (metrics.traceabilityGapScore >= 0.6) {
    return { kind: "traceabilityGap", values: {} };
  }
  if (metrics.sopCandidateScore >= 0.6) {
    return { kind: "sopCandidate", values: {} };
  }
  return { kind: "healthy", values: { downstream: metrics.downstreamCount } };
}
