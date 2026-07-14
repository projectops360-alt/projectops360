// ============================================================================
// ProjectOps360° — Shared React Flow node/edge data contracts
// ============================================================================
// Type aliases (not interfaces) so they satisfy React Flow v12's
// `Record<string, unknown>` data constraint via implicit index signatures.
// ============================================================================

import type { Node, Edge } from "@xyflow/react";
import type {
  LivingGraphNode,
  LivingGraphEdge,
  LivingGraphCanonicalEvent,
  LivingGraphEventRelationship,
} from "@/types/living-graph";
import type { NodeMetrics, OverlayEmphasis } from "@/lib/graph/living-graph-analysis";
import type {
  ProcessActivityAggregate,
  ProcessTransitionAggregate,
} from "@/lib/graph/task-process-analysis";

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
  /** Toggle progressive subtask expansion for a task node (NotebookLM-style).
   *  Present only for task nodes that have subtasks; undefined otherwise. */
  onToggleSubtasks?: (taskId: string) => void;
  // ── Between-analysis highlighting (CAP-045 §C.2 / Part C) ─────────────────
  // Read-only visual signals set from `BetweenAnalysisResult`. They never feed
  // operational analyses — presentation only.
  isBetweenStart?: boolean;
  isBetweenEnd?: boolean;
  isBetweenPathMember?: boolean;
  isBetweenEventMember?: boolean;
};

export type LivingFlowNode = Node<LivingNodeData, "living" | "milestoneCard">;

// ── Canonical-event Relationships view (CAP-045 extension) ───────────────────
// A distinct node type so canonical-event nodes never collide with the
// operational "living"/"milestoneCard" nodes — the analyses and the
// milestones/activities views are isolated by construction.
export type CanonicalEventNodeData = {
  event: LivingGraphCanonicalEvent;
  /** True when this node is the current selection. */
  selected: boolean;
  // ── Between-analysis highlighting (CAP-045 §C.2 / Part C) ─────────────────
  isBetweenEventMember?: boolean;
  isBetweenStart?: boolean;
  isBetweenEnd?: boolean;
};

export type CanonicalEventFlowNode = Node<CanonicalEventNodeData, "canonicalEvent">;

/** Secondary object node (event↔object reference). Visually muted/smaller. */
export type CanonicalObjectNodeData = {
  objectType: string;
  objectId: string;
  label: string;
  selected: boolean;
};

export type CanonicalObjectFlowNode = Node<CanonicalObjectNodeData, "canonicalObject">;

export type CanonicalEventEdgeData = {
  relationship: LivingGraphEventRelationship;
  /** temporal | causal | compensation | object_reference — drives styling. */
  relationshipClass: LivingGraphEventRelationship["relationshipClass"];
};

export type CanonicalEventFlowEdge = Edge<CanonicalEventEdgeData, "canonicalEventEdge">;

export type LivingEdgeData = {
  edge: LivingGraphEdge;
  emphasis: OverlayEmphasis;
  isCritical: boolean;
  isPathMember: boolean;
  playbackHidden: boolean;
};

export type LivingFlowEdge = Edge<LivingEdgeData, "living">;

// ── Task-lifecycle Process Explorer (aggregate, order-only) ──

export type ProcessActivityNodeData = {
  activity: ProcessActivityAggregate;
  selected: boolean;
  locale: string;
};

export type ProcessActivityFlowNode = Node<ProcessActivityNodeData, "processActivity">;

export type ProcessTransitionEdgeData = {
  transition: ProcessTransitionAggregate;
  selected: boolean;
  locale: string;
};

export type ProcessTransitionFlowEdge = Edge<ProcessTransitionEdgeData, "processTransition">;
