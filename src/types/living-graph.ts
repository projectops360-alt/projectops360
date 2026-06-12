// ============================================================================
// ProjectOps360° — Living Graph visualization data contract (PI-005)
// ============================================================================
// Normalized, camelCase view-model types consumed by the Living Graph
// visualization. The server page maps raw `process_nodes` / `process_edges`
// rows (see types/database.ts) into these shapes, enriching them with
// roadmap task / milestone data when the source entity is available.
// ============================================================================

import type {
  ProcessNodeType,
  ProcessEdgeType,
  ProcessNodeSourceType,
  ShortageRiskLevel,
} from "./database";

import type { CapacityInsightKind } from "@/lib/labor/explanation";

export type LivingGraphRiskLevel = "low" | "medium" | "high";

/** Normalized process node, enriched from its source entity when possible. */
export interface LivingGraphNode {
  id: string;
  projectId: string;
  nodeType: ProcessNodeType;
  sourceEntityType: ProcessNodeSourceType;
  sourceEntityId: string;
  label: string;
  description: string | null;
  /** Status of the source entity (task/milestone status) if resolvable. */
  status: string | null;
  /** 0–100 progress of the source entity if resolvable. */
  progress: number | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  riskLevel: LivingGraphRiskLevel | null;
  isBlocked: boolean;
  /** Backend-computed critical flag (roadmap_tasks.is_critical). */
  isCritical: boolean;
  /** Milestone this activity belongs to (drill-down grouping). */
  milestoneId: string | null;
  milestoneLabel: string | null;
  /** Roadmap order of that milestone (drives the flowchart sequence). */
  milestoneOrder: number | null;
  /** 0–1 heuristic; null when not computable. */
  traceabilityScore: number | null;
  metadata: Record<string, unknown>;
}

/** Normalized process edge. */
export interface LivingGraphEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: ProcessEdgeType;
  weight: number;
  lagDays: number | null;
  /** Whether both endpoints are on the computed critical path. */
  isCritical: boolean;
  riskLevel: LivingGraphRiskLevel | null;
  metadata: Record<string, unknown>;
}

/** Chronological process event used by timeline playback. */
export interface LivingGraphEvent {
  id: string;
  projectId: string;
  eventType: ProcessNodeType;
  entityType: ProcessNodeSourceType;
  entityId: string;
  /** The process node this event materialized as. */
  nodeId: string;
  label: string;
  occurredAt: string;
  inDegree: number;
  outDegree: number;
  metadata: Record<string, unknown>;
}

/** Full payload passed from the server page to the client view. */
export interface LivingGraphData {
  nodes: LivingGraphNode[];
  edges: LivingGraphEdge[];
  events: LivingGraphEvent[];
  generatedAt: string;
}

export type LivingGraphOverlay =
  | "normal"
  | "bottleneck"
  | "criticalPath"
  | "rework"
  | "traceabilityGap"
  | "risk"
  | "sopCandidate"
  | "blocker"
  | "timeline"
  | "simulation"
  | "laborCapacity"
  | "readiness"
  | "variance";

export type LivingGraphLayoutMode = "hierarchical" | "timeline" | "force";

/**
 * Detail level of the rendered graph:
 * - milestones: one node per milestone (high-level flowchart, default)
 * - activities: one node per source entity (aggregated process map)
 * - events: every process event as its own node
 */
export type LivingGraphViewLevel = "milestones" | "activities" | "events";

export type LivingGraphSimulationScenario =
  | "delay1d"
  | "delay3d"
  | "delay1w"
  | "markBlocked"
  | "removeBlocker"
  | "increaseDuration";

/** Result of a deterministic what-if simulation run. */
export interface LivingGraphSimulationState {
  focusNodeId: string;
  scenario: LivingGraphSimulationScenario;
  affectedNodeIds: string[];
  /** Estimated extra days propagated to the deepest affected node. */
  estimatedDelayDays: number;
  /** Number of critical-path nodes among the affected set. */
  criticalPathImpact: number;
  /** Milestone-gate nodes affected downstream. */
  affectedMilestoneLabels: string[];
  /** Strongest downstream dependency (highest weight edge target). */
  strongestDependencyLabel: string | null;
  riskDelta: LivingGraphRiskLevel;
}

/** Deterministic insight rendered in the detail panel (AI placeholder). */
export interface LivingGraphInsight {
  /** i18n key under livingGraph.insights */
  kind:
    | "bottleneck"
    | "rework"
    | "traceabilityGap"
    | "risk"
    | "sopCandidate"
    | "blocker"
    | "laborCapacityGap"
    | "healthy";
  /** Values interpolated into the i18n template. */
  values: Record<string, string | number>;
}

/** Labor risk metadata attached to synthetic labor_risk nodes or enriched existing nodes. */
export interface LaborRiskNodeData {
  tradeKey: string;
  weekLabel: string;
  shortageRisk: ShortageRiskLevel;
  gapHeadcount: number;
  requiredHeadcount: number;
  availableHeadcount: number;
  utilizationPct: number | null;
  locationZone: string | null;
  affectedActivityKeys: string[];
  affectedResourceKeys: string[];
  affectedMilestoneIds: string[];
  criticalPathImpact: boolean;
  insightKind: CapacityInsightKind;
}

/** Workface readiness metadata attached to construction_activity nodes. */
export interface ReadinessNodeData {
  readinessLevel: "ready" | "at_risk" | "not_ready" | "blocked";
  readinessPct: number;
  missingPrerequisites: string[];
  summary: string;
  recommendedAction: string;
}

/** Productivity variance metadata attached to construction_activity nodes. */
export interface VarianceNodeData {
  /** Variance severity classification (on_track/minor/major/critical). */
  varianceSeverity: "on_track" | "minor" | "major" | "critical";
  /** Variance percentage (null if not tracked). */
  variancePct: number | null;
  /** Schedule risk level. */
  scheduleRisk: "none" | "low" | "medium" | "high" | "critical";
  /** Numeric risk score 0-100. */
  scheduleRiskScore: number;
  /** Most likely cause category. */
  likelyCause: string;
  /** Confidence score 0-1 for the likely cause. */
  causeConfidence: number;
  /** Trend direction compared to trade peers. */
  trendDirection: "improving" | "worsening" | "stable" | "insufficient_data";
}

/** Project-level summary shown in the toolbar / header. */
export interface GraphMetricSummary {
  nodeCount: number;
  edgeCount: number;
  orphanCount: number;
  cycleCount: number;
  blockedCount: number;
  bottleneckCount: number;
  criticalPathLength: number;
  maxDepth: number;
  laborRiskCount: number;
}
