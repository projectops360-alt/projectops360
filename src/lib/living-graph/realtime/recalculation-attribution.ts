// ============================================================================
// ProjectOps360° — LGRE · Recalculation Attribution Planner (Phase 4, Task 3)
// ============================================================================
// Pure, deterministic attribution: accepted change notices + the read-only
// snapshot index → WHICH nodes/edges/overlays are affected and WHY. Replaces
// the Task 1 conservative always-full-rebuild with selective planning, while
// keeping full rebuild as the SAFE fallback for anything the planner cannot
// attribute honestly (unknown subjects, oversized affected area).
//
// The planner interprets nothing about the domain: it matches the deterministic
// invalidation-tag grammar (generateProjectionInvalidationTags) against the
// index's subject refs and walks index edges for schedule propagation. Status,
// counts, and health stay with the existing engines.
// ============================================================================

import { LGRE_DEFAULT_PERFORMANCE_BUDGET } from "./constants";
import type {
  LivingGraphChangeNotice,
  LivingGraphRealtimeProjectScope,
  LivingGraphRecalcReason,
  LivingGraphRecalcTarget,
  GraphRecalculationPlan,
} from "./types";
import type {
  LivingGraphSnapshotIndex,
  LivingGraphAttributionDetail,
} from "./recalculation-types";

// ── Tag grammar (mirrors generateProjectionInvalidationTags, read-only) ───────

/** Canonical subject refs a notice speaks about (`task:t1`, `milestone:m1`, …). */
export function subjectRefsFromNotice(notice: LivingGraphChangeNotice): string[] {
  const refs = new Set<string>();
  for (const tag of notice.invalidationTags) {
    const subject = /^subject:([^:]+):(.+)$/.exec(tag);
    if (subject) refs.add(`${subject[1]}:${subject[2]}`);
    const milestone = /^milestone:(.+)$/.exec(tag);
    if (milestone) refs.add(`milestone:${milestone[1]}`);
  }
  return [...refs];
}

function hasTag(notice: LivingGraphChangeNotice, tag: string): boolean {
  return notice.invalidationTags.includes(tag);
}

function targetsForSubjectRef(ref: string): LivingGraphRecalcTarget[] {
  if (ref.startsWith("task:")) return ["node_status", "edge_evidence", "summary_counts"];
  if (ref.startsWith("milestone:") || ref.startsWith("phase:")) {
    return ["milestone_flow_layer", "edge_evidence", "summary_counts"];
  }
  if (ref.startsWith("risk:")) return ["overlay", "summary_counts"];
  if (ref.startsWith("resource:") || ref.startsWith("allocation:")) return ["workforce_layer"];
  return ["summary_counts"];
}

// ── Attribution ───────────────────────────────────────────────────────────────

export interface AttributeGraphRecalculationInput {
  scope: LivingGraphRealtimeProjectScope;
  /** Already accepted (scope-checked) notices — the caller filtered them. */
  acceptedNotices: readonly LivingGraphChangeNotice[];
  rejectedNoticeCount: number;
  index: LivingGraphSnapshotIndex;
  planId: string;
  now: () => Date;
}

/**
 * Deterministic selective attribution. Falls back to a full-rebuild plan
 * (disclosed, never hidden) when:
 * - a notice's subjects match nothing in the index and no milestone anchor
 *   exists (`unattributable_change` — could be a brand-new graph area);
 * - the affected area exceeds the partial budget (`partial_budget_exceeded`).
 */
export function attributeGraphRecalculation(
  input: AttributeGraphRecalculationInput,
): LivingGraphAttributionDetail {
  const { index, acceptedNotices } = input;

  const affectedNodes = new Set<string>();
  const affectedEdges = new Set<string>();
  const targets = new Set<LivingGraphRecalcTarget>();
  const overlays = new Set<string>();
  const reasons = new Set<LivingGraphRecalcReason>();
  const warnings: string[] = [];
  const nodeSources = new Map<string, Set<string>>();
  const edgeSources = new Map<string, Set<string>>();
  const noticeEventIds: Record<string, string | null> = {};
  const propagatedNodeIds = new Set<string>();
  let fullRebuild = false;

  const addNodeSource = (nodeId: string, noticeId: string) => {
    affectedNodes.add(nodeId);
    if (!nodeSources.has(nodeId)) nodeSources.set(nodeId, new Set());
    nodeSources.get(nodeId)!.add(noticeId);
  };
  const addEdgeSource = (edgeId: string, noticeId: string) => {
    affectedEdges.add(edgeId);
    if (!edgeSources.has(edgeId)) edgeSources.set(edgeId, new Set());
    edgeSources.get(edgeId)!.add(noticeId);
  };

  for (const notice of acceptedNotices) {
    noticeEventIds[notice.noticeId] = notice.eventId;
    reasons.add(notice.source === "project_event_graph" ? "event_appended" : "upstream_projection_refreshed");
    if (notice.source === "manual_refresh") reasons.add("manual_refresh_requested");

    const refs = subjectRefsFromNotice(notice);
    let matchedSomething = false;

    for (const ref of refs) {
      for (const target of targetsForSubjectRef(ref)) targets.add(target);
      for (const node of index.nodes) {
        if (node.subjectRefs.includes(ref)) {
          addNodeSource(node.nodeId, notice.noticeId);
          matchedSomething = true;
        }
      }
      for (const edge of index.edges) {
        if (edge.subjectRefs.includes(ref)) {
          addEdgeSource(edge.edgeId, notice.noticeId);
          matchedSomething = true;
        }
      }
    }
    if (refs.length > 0) reasons.add("invalidation_tag_matched");

    // Overlay-only scope tags are attributable without naming entities.
    if (hasTag(notice, "scope:risk")) {
      targets.add("overlay");
      overlays.add("risk");
      matchedSomething = true;
    }

    // Schedule changes propagate downstream along the KNOWN index edges.
    if (hasTag(notice, "scope:schedule")) {
      targets.add("overlay");
      overlays.add("criticalPath");
      const frontier = [...affectedNodes].filter((nodeId) =>
        nodeSources.get(nodeId)?.has(notice.noticeId),
      );
      if (frontier.length > 0) {
        reasons.add("dependency_path_propagation");
        const queue = [...frontier];
        const visited = new Set(frontier);
        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const edge of index.edges) {
            if (edge.sourceNodeId !== current) continue;
            addEdgeSource(edge.edgeId, notice.noticeId);
            if (!visited.has(edge.targetNodeId)) {
              visited.add(edge.targetNodeId);
              addNodeSource(edge.targetNodeId, notice.noticeId);
              propagatedNodeIds.add(edge.targetNodeId);
              queue.push(edge.targetNodeId);
            }
          }
        }
        targets.add("node_status");
        matchedSomething = true;
      }
    }

    if (!matchedSomething) {
      // Honest safety: an unattributable change may be a NEW graph area (e.g.
      // a created entity not yet materialized) — never guess, rebuild.
      fullRebuild = true;
      reasons.add("unattributable_change");
      warnings.push(
        `Notice ${notice.noticeId} could not be attributed to any indexed entity; falling back to a full rebuild.`,
      );
    }
  }

  // Partial budget: beyond this share of the graph, full rebuild is safer.
  const totalNodes = index.nodes.length;
  if (
    !fullRebuild &&
    totalNodes > 0 &&
    affectedNodes.size / totalNodes > LGRE_DEFAULT_PERFORMANCE_BUDGET.partialRebuildNodeRatio
  ) {
    fullRebuild = true;
    reasons.add("partial_budget_exceeded");
    warnings.push(
      `Affected area (${affectedNodes.size}/${totalNodes} nodes) exceeds the partial budget; falling back to a full rebuild.`,
    );
  }

  if (input.rejectedNoticeCount > 0) {
    warnings.push(`${input.rejectedNoticeCount} change notice(s) rejected (wrong scope or malformed).`);
  }

  const sortedNodeIds = [...affectedNodes].sort();
  const sortedEdgeIds = [...affectedEdges].sort();

  const plan: GraphRecalculationPlan = {
    planId: input.planId,
    scope: input.scope,
    targets: fullRebuild ? ["full_graph"] : [...targets].sort(),
    affectedNodeIds: sortedNodeIds,
    affectedEdgeIds: sortedEdgeIds,
    affectedOverlays: [...overlays].sort(),
    fullRebuild,
    reasons: [...reasons].sort(),
    coalescedNoticeCount: acceptedNotices.length,
    rejectedNoticeCount: input.rejectedNoticeCount,
    warnings,
    generatedAt: input.now().toISOString(),
  };

  const toRecord = (map: Map<string, Set<string>>): Record<string, readonly string[]> => {
    const record: Record<string, readonly string[]> = {};
    for (const [id, sources] of map) record[id] = [...sources].sort();
    return record;
  };

  return {
    plan,
    nodeSources: toRecord(nodeSources),
    edgeSources: toRecord(edgeSources),
    noticeEventIds,
    propagatedNodeIds: [...propagatedNodeIds].sort(),
  };
}
