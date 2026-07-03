// ============================================================================
// ProjectOps360° — LGRE Phase 4 / Task 6
// LARGE GRAPH assessment + MAX DELTA SIZE guard (pure)
// ============================================================================
// Pure helpers that (a) classify how heavy a graph is so the UI can warn and
// guard a scoped Expand all, and (b) decide when an incoming delta exceeds the
// operation budget and must fall back to full_resync instead of an unsafe
// partial merge. No React, no side effects, no canonical mutation.
// ============================================================================

import type { LgrePerformanceBudget } from "./performance-budget";

export type GraphLoadLevel = "normal" | "heavy" | "large";

export interface GraphLoadAssessment {
  nodeCount: number;
  edgeCount: number;
  level: GraphLoadLevel;
  /** True at/above the "large" threshold — warn + guard Expand all. */
  isLarge: boolean;
  /** True at/above ~70% of a threshold — progressive rendering recommended. */
  warn: boolean;
}

/**
 * Classify graph load against the configured thresholds. "heavy" (≥70% of a
 * threshold) recommends progressive rendering; "large" (≥ threshold) additionally
 * requires confirmation before a scoped Expand all.
 */
export function assessGraphLoad(
  input: { nodeCount: number; edgeCount: number },
  budget: LgrePerformanceBudget,
): GraphLoadAssessment {
  const nodeCount = Math.max(0, Math.floor(input.nodeCount));
  const edgeCount = Math.max(0, Math.floor(input.edgeCount));

  const nodeRatio = nodeCount / budget.largeGraphNodeThreshold;
  const edgeRatio = edgeCount / budget.largeGraphEdgeThreshold;
  const ratio = Math.max(nodeRatio, edgeRatio);

  const isLarge = ratio >= 1;
  const warn = ratio >= 0.7;
  const level: GraphLoadLevel = isLarge ? "large" : warn ? "heavy" : "normal";

  return { nodeCount, edgeCount, level, isLarge, warn };
}

export interface DeltaSizeDecision {
  nodeOps: number;
  edgeOps: number;
  totalOps: number;
  /** True when the delta is within budget and may be applied incrementally. */
  withinBudget: boolean;
  /** True when the delta exceeds budget → caller must trigger full_resync. */
  requiresFullResync: boolean;
}

/**
 * Decide whether a delta (given its operation counts) may be applied
 * incrementally or must fall back to a full_resync. An oversized delta is NEVER
 * partial-merged — that could leave the graph in a torn, unsafe state.
 */
export function decideDeltaSize(
  input: { nodeOps: number; edgeOps: number },
  budget: LgrePerformanceBudget,
): DeltaSizeDecision {
  const nodeOps = Math.max(0, Math.floor(input.nodeOps));
  const edgeOps = Math.max(0, Math.floor(input.edgeOps));
  const totalOps = nodeOps + edgeOps;
  const withinBudget = totalOps <= budget.maxDeltaOperations;
  return {
    nodeOps,
    edgeOps,
    totalOps,
    withinBudget,
    requiresFullResync: !withinBudget,
  };
}
