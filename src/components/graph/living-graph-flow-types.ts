// ============================================================================
// ProjectOps360° — Shared React Flow node/edge data contracts
// ============================================================================
// Type aliases (not interfaces) so they satisfy React Flow v12's
// `Record<string, unknown>` data constraint via implicit index signatures.
// ============================================================================

import type { Node, Edge } from "@xyflow/react";
import type { LivingGraphNode, LivingGraphEdge } from "@/types/living-graph";
import type { NodeMetrics, OverlayEmphasis } from "@/lib/graph/living-graph-analysis";

/** Visual state derived from timeline playback. */
export type TimelinePlaybackState =
  | "none" // playback inactive
  | "future" // node occurs after the playhead → heavily dimmed
  | "active" // node at the playhead → pulse
  | "past"; // node already occurred → completed tint

export type LivingNodeData = {
  node: LivingGraphNode;
  metrics: NodeMetrics | null;
  emphasis: OverlayEmphasis;
  playback: TimelinePlaybackState;
  isSearchHit: boolean;
  isSimulationImpact: boolean;
  isSimulationOrigin: boolean;
  isDownstreamHighlight: boolean;
  isPathMember: boolean;
  isFocusNode: boolean;
  /** True while another node is being dragged over this one (drop-to-connect). */
  isDropTarget: boolean;
  /** Cluster nodes aggregate several process events of one source entity. */
  clusterSize: number;
};

export type LivingFlowNode = Node<LivingNodeData, "living" | "milestoneCard">;

export type LivingEdgeData = {
  edge: LivingGraphEdge;
  emphasis: OverlayEmphasis;
  isCritical: boolean;
  isPathMember: boolean;
  playbackHidden: boolean;
};

export type LivingFlowEdge = Edge<LivingEdgeData, "living">;
