// ============================================================================
// ProjectOps360° — Labor Capacity → Living Graph Mapping
// ============================================================================
// Pure, deterministic functions that bridge labor capacity analysis data
// to the Living Graph visualization. Creates synthetic `labor_risk` nodes
// for high/critical shortages, connects them to affected milestones and
// activities via `labor_constrained` / `delayed` edges, and enriches
// existing graph nodes with labor risk metadata.
//
// No database calls, no AI calls, no randomness.
// Same inputs → same outputs. Fully deterministic.
// ============================================================================

import type { Locale, ShortageRiskLevel, TradeTaxonomy } from "@/types/database";
import { getI18nValue } from "@/types/database";
import type {
  LivingGraphNode,
  LivingGraphEdge,
  LaborRiskNodeData,
  LivingGraphInsight,
  ReadinessNodeData,
  VarianceNodeData,
} from "@/types/living-graph";
import type {
  LaborCapacityResult,
  WeeklyCapacityGap,
} from "@/lib/labor/capacity";
import type { CapacityInsightKind } from "@/lib/labor/explanation";
import { classifyGapInsight } from "@/lib/labor/explanation";
import type { LookaheadActivity } from "@/lib/labor/lookahead";
import { buildShortExplanation } from "@/lib/labor/readiness-explanation";
import type {
  ProductivityVarianceResult,
  ActivityScheduleRisk,
  VarianceTrend,
  VarianceTrendDirection,
  ScheduleRiskLevel,
} from "@/lib/labor/productivity-variance";
import type { ActivityVarianceMetrics, VarianceSeverity } from "@/lib/labor/labor-variance";
import type { VarianceCauseResult, VarianceCauseCategory } from "@/lib/labor/variance-cause-classification";
import type { LaborVarianceResult } from "@/lib/labor/labor-variance";

// ── Labor risk node ID convention ──────────────────────────────────────────────

/** Stable, deterministic ID for a synthetic labor risk node. */
export function laborRiskNodeId(tradeKey: string, weekLabel: string): string {
  return `labor-risk:${tradeKey}:${weekLabel}`;
}

/** Stable, deterministic ID for a synthetic labor constraint edge. */
function laborEdgeId(
  sourceId: string,
  targetId: string,
  edgeType: string,
): string {
  return `labor-edge:${sourceId}:${targetId}:${edgeType}`;
}

// ── mapLaborRisksToGraphNodes ──────────────────────────────────────────────────

/**
 * Create synthetic `labor_risk` nodes for each WeeklyCapacityGap
 * with shortageRisk "high" or "critical". These nodes appear on the
 * Living Graph canvas and can be clicked to show the labor risk
 * explanation in the detail panel.
 *
 * Only high/critical gaps become nodes — lower-severity gaps are shown
 * via the overlay on existing nodes only (see enrichExistingNodesWithLaborData).
 */
export function mapLaborRisksToGraphNodes(
  capacity: LaborCapacityResult,
  taxonomy: TradeTaxonomy[],
  locale: Locale = "en",
): { riskNodes: LivingGraphNode[]; riskNodeGaps: WeeklyCapacityGap[] } {
  const isEn = locale === "en";

  // Build trade label lookup
  const tradeLabelMap = new Map<string, string>();
  for (const tax of taxonomy) {
    tradeLabelMap.set(
      tax.trade_key,
      getI18nValue(tax.label_i18n, locale) || tax.trade_key,
    );
  }

  const riskNodes: LivingGraphNode[] = [];
  const riskNodeGaps: WeeklyCapacityGap[] = [];

  for (const gap of capacity.weeklyGaps) {
    if (gap.shortageRisk !== "high" && gap.shortageRisk !== "critical") continue;

    const nodeId = laborRiskNodeId(gap.tradeKey, gap.weekLabel);
    const tradeLabel = tradeLabelMap.get(gap.tradeKey) || gap.tradeKey;
    const label = isEn
      ? `${tradeLabel} shortage ${gap.weekLabel}`
      : `${tradeLabel} escasez ${gap.weekLabel}`;
    const description = isEn
      ? `Labor capacity gap: ${Math.abs(gap.gapHeadcount)} headcount short in week ${gap.weekLabel}`
      : `Brecha de capacidad laboral: ${Math.abs(gap.gapHeadcount)} headcount faltante en semana ${gap.weekLabel}`;

    // Classify insight for the risk node
    const insight = classifyGapInsight(gap, []);

    const laborRisk: LaborRiskNodeData = {
      tradeKey: gap.tradeKey,
      weekLabel: gap.weekLabel,
      shortageRisk: gap.shortageRisk,
      gapHeadcount: gap.gapHeadcount,
      requiredHeadcount: gap.requiredHeadcount,
      availableHeadcount: gap.availableHeadcount,
      utilizationPct: gap.utilizationPct,
      locationZone: gap.locationZone,
      affectedActivityKeys: gap.affectedActivityKeys,
      affectedResourceKeys: gap.affectedResourceKeys,
      affectedMilestoneIds: capacity.affectedMilestoneIds,
      criticalPathImpact: gap.criticalPathImpact,
      insightKind: insight.kind as CapacityInsightKind,
    };

    riskNodes.push({
      id: nodeId,
      projectId: "",
      nodeType: "labor_risk",
      sourceEntityType: "construction_activities",
      sourceEntityId: `${gap.tradeKey}:${gap.weekLabel}`,
      label,
      description,
      status: gap.shortageRisk === "critical" ? "blocked" : "in_progress",
      progress: null,
      startDate: gap.weekStart,
      endDate: gap.weekEnd,
      durationDays: 5,
      occurredAt: gap.weekStart,
      createdAt: "",
      updatedAt: "",
      riskLevel:
        gap.shortageRisk === "critical"
          ? "high"
          : gap.shortageRisk === "high"
            ? "high"
            : "medium",
      isBlocked: gap.shortageRisk === "critical",
      isCritical: gap.criticalPathImpact,
      milestoneId: null,
      milestoneLabel: null,
      milestoneOrder: null,
      traceabilityScore: null,
      metadata: { laborRisk },
    });

    riskNodeGaps.push(gap);
  }

  return { riskNodes, riskNodeGaps };
}

// ── mapLaborConstraintsToEdges ─────────────────────────────────────────────────

/**
 * Create synthetic edges connecting labor risk nodes to existing
 * Living Graph nodes (milestone gates and task transitions).
 *
 * - labor_constrained: risk node → milestone gate for affected milestones
 * - delayed: risk node → task_transition whose milestone is affected
 */
export function mapLaborConstraintsToEdges(
  capacity: LaborCapacityResult,
  riskNodes: LivingGraphNode[],
  existingNodes: LivingGraphNode[],
  projectId: string,
): LivingGraphEdge[] {
  if (riskNodes.length === 0) return [];

  const edges: LivingGraphEdge[] = [];

  // Build a lookup of milestone IDs → existing milestone_gate node IDs
  const milestoneNodeMap = new Map<string, string>(); // milestoneId → nodeId
  for (const node of existingNodes) {
    if (node.nodeType === "milestone_gate" && node.milestoneId) {
      milestoneNodeMap.set(node.milestoneId, node.id);
    }
    // Also handle milestone-level aggregated nodes (id starts with "milestone:")
    if (node.id.startsWith("milestone:") && node.sourceEntityId) {
      milestoneNodeMap.set(node.sourceEntityId, node.id);
    }
  }

  // Build a set of task node IDs whose milestone is affected
  const affectedMilestoneIds = new Set(capacity.affectedMilestoneIds);
  const taskNodeIds = new Map<string, string>(); // milestoneId → task nodeId
  for (const node of existingNodes) {
    if (
      node.sourceEntityType === "roadmap_tasks" &&
      node.milestoneId &&
      affectedMilestoneIds.has(node.milestoneId)
    ) {
      taskNodeIds.set(node.id, node.milestoneId);
    }
  }

  // For each risk node, create edges to affected milestone gates and task nodes
  for (const riskNode of riskNodes) {
    const laborRisk = riskNode.metadata.laborRisk as LaborRiskNodeData | undefined;
    if (!laborRisk) continue;

    // Connect to affected milestone gates via labor_constrained edges
    for (const milestoneId of laborRisk.affectedMilestoneIds) {
      const targetNodeId = milestoneNodeMap.get(milestoneId);
      if (!targetNodeId || targetNodeId === riskNode.id) continue;

      edges.push({
        id: laborEdgeId(riskNode.id, targetNodeId, "labor_constrained"),
        projectId,
        sourceNodeId: riskNode.id,
        targetNodeId,
        edgeType: "labor_constrained",
        weight: 1,
        lagDays: null,
        isCritical: laborRisk.criticalPathImpact,
        riskLevel: laborRisk.shortageRisk === "critical" ? "high" : "medium",
        metadata: {
          laborConstrained: {
            tradeKey: laborRisk.tradeKey,
            weekLabel: laborRisk.weekLabel,
            gapHeadcount: laborRisk.gapHeadcount,
          },
        },
      });
    }

    // Connect to affected task nodes via delayed edges (only for critical path)
    if (laborRisk.criticalPathImpact) {
      for (const [taskId, milestoneId] of taskNodeIds.entries()) {
        if (!laborRisk.affectedMilestoneIds.includes(milestoneId)) continue;
        if (taskId === riskNode.id) continue;

        edges.push({
          id: laborEdgeId(riskNode.id, taskId, "delayed"),
          projectId,
          sourceNodeId: riskNode.id,
          targetNodeId: taskId,
          edgeType: "delayed",
          weight: 0.8,
          lagDays: null,
          isCritical: true,
          riskLevel: "high",
          metadata: {
            laborConstrained: {
              tradeKey: laborRisk.tradeKey,
              weekLabel: laborRisk.weekLabel,
              gapHeadcount: laborRisk.gapHeadcount,
            },
          },
        });
      }
    }
  }

  return edges;
}

// ── enrichExistingNodesWithLaborData ───────────────────────────────────────────

/**
 * Enrich existing Living Graph nodes with labor risk metadata.
 * For nodes whose source entity (task/milestone) overlaps with a labor gap,
 * add metadata.laborRisk and metadata.requiresTrade so the overlay and
 * detail panel can display labor information.
 *
 * Returns a new array (does not mutate the input).
 */
export function enrichExistingNodesWithLaborData(
  nodes: LivingGraphNode[],
  capacity: LaborCapacityResult,
): LivingGraphNode[] {
  if (capacity.weeklyGaps.length === 0) return nodes;

  // Collect the worst gap per affected milestone ID
  const milestoneGaps = new Map<string, WeeklyCapacityGap[]>();
  for (const gap of capacity.weeklyGaps) {
    if (gap.shortageRisk === "none") continue;
    for (const mId of capacity.affectedMilestoneIds) {
      const existing = milestoneGaps.get(mId) ?? [];
      existing.push(gap);
      milestoneGaps.set(mId, existing);
    }
  }

  // Pick the worst gap per milestone
  const milestoneWorstGap = new Map<string, WeeklyCapacityGap>();
  const riskOrder: ShortageRiskLevel[] = [
    "critical",
    "high",
    "medium",
    "low",
    "none",
  ];
  for (const [mId, gaps] of milestoneGaps) {
    const sorted = [...gaps].sort((a, b) => {
      const ai = riskOrder.indexOf(a.shortageRisk);
      const bi = riskOrder.indexOf(b.shortageRisk);
      return ai - bi; // lower index = worse
    });
    milestoneWorstGap.set(mId, sorted[0]);
  }

  return nodes.map((node) => {
    // Check if this node's milestone is affected
    if (!node.milestoneId) return node;
    const worstGap = milestoneWorstGap.get(node.milestoneId);
    if (!worstGap) return node;

    // Build the LaborRiskNodeData summary
    const insight = classifyGapInsight(worstGap, []);
    const laborRisk: LaborRiskNodeData = {
      tradeKey: worstGap.tradeKey,
      weekLabel: worstGap.weekLabel,
      shortageRisk: worstGap.shortageRisk,
      gapHeadcount: worstGap.gapHeadcount,
      requiredHeadcount: worstGap.requiredHeadcount,
      availableHeadcount: worstGap.availableHeadcount,
      utilizationPct: worstGap.utilizationPct,
      locationZone: worstGap.locationZone,
      affectedActivityKeys: worstGap.affectedActivityKeys,
      affectedResourceKeys: worstGap.affectedResourceKeys,
      affectedMilestoneIds: capacity.affectedMilestoneIds,
      criticalPathImpact: worstGap.criticalPathImpact,
      insightKind: insight.kind as CapacityInsightKind,
    };

    return {
      ...node,
      metadata: {
        ...node.metadata,
        laborRisk,
        requiresTrade: worstGap.tradeKey,
      },
    };
  });
}

// ── Readiness enrichment ────────────────────────────────────────────────────────

/**
 * Enrich construction_activity nodes with workface readiness data.
 * For each node whose sourceEntityType is "construction_activity" and whose
 * activity is not ready, adds `metadata.readiness` with readiness level,
 * percentage, missing prerequisites, short summary, and recommended action.
 *
 * Uses the activity key from the node's label or entityId to match against
 * the lookahead activities.
 */
export function enrichNodesWithReadiness(
  nodes: LivingGraphNode[],
  lookaheadActivities: LookaheadActivity[],
  locale: Locale
): LivingGraphNode[] {
  // Build a lookup by activity key
  const activityMap = new Map(lookaheadActivities.map((a) => [a.activityKey, a]));

  return nodes.map((node) => {
    // Only enrich construction activity nodes
    if (node.sourceEntityType !== "construction_activities") return node;

    // Match the node to a lookahead activity by activity key
    // The node's sourceEntityId should be the activity key, or we try the label
    const activity = activityMap.get(node.sourceEntityId) ?? activityMap.get(node.label);
    if (!activity) return node;

    // Only add readiness data for not-ready activities
    if (activity.readiness === "ready") return node;

    const explanation = buildShortExplanation(activity, locale);

    const readiness: ReadinessNodeData = {
      readinessLevel: activity.readiness,
      readinessPct: activity.readinessPct,
      missingPrerequisites: activity.readinessChecklist
        .filter((item) => item.required && !item.completed)
        .map((item) => getI18nValue(item.label_i18n, locale) ?? item.item_key),
      summary: getI18nValue(explanation, locale),
      recommendedAction: getI18nValue(
        activity.blockers.length > 0
          ? { en: "Resolve blockers", es: "Resolver bloqueadores" }
          : { en: "Expedite missing prerequisites", es: "Acelerar prerrequisitos faltantes" },
        locale
      ),
    };

    return {
      ...node,
      metadata: {
        ...node.metadata,
        readiness,
      },
    };
  });
}

// ── Variance Enrichment ──────────────────────────────────────────────────────

/**
 * Enrich construction_activity nodes with productivity variance data.
 *
 * Matches nodes by `sourceEntityId` (or `label`) to activity keys.
 * Only enriches tracked activities (isTracked === true).
 *
 * @param nodes - Living Graph nodes to enrich
 * @param laborVariance - Per-activity variance metrics (from computeLaborVariance)
 * @param productivityResult - Trends + schedule risks (from computeProductivityVariance)
 * @param causeResults - Cause classification results
 */
export function enrichNodesWithVariance(
  nodes: LivingGraphNode[],
  laborVariance: LaborVarianceResult,
  productivityResult: ProductivityVarianceResult,
  causeResults: VarianceCauseResult[]
): LivingGraphNode[] {
  // Build lookups by activity key for O(1) access
  const metricsMap = new Map(
    laborVariance.activities.map((m) => [m.activityKey, m])
  );
  const trendMap = new Map(
    productivityResult.trends.map((t) => [t.activityKey, t])
  );
  const riskMap = new Map(
    productivityResult.scheduleRisks.map((r) => [r.activityKey, r])
  );
  const causeMap = new Map(
    causeResults.map((c) => [c.activityKey, c])
  );

  return nodes.map((node) => {
    // Only enrich construction activity nodes
    if (node.sourceEntityType !== "construction_activities") return node;

    // Match node to activity metrics by sourceEntityId (or label fallback)
    const metrics = metricsMap.get(node.sourceEntityId) ?? metricsMap.get(node.label);
    if (!metrics || !metrics.isTracked) return node;

    const trend = trendMap.get(metrics.activityKey);
    const risk = riskMap.get(metrics.activityKey);
    const cause = causeMap.get(metrics.activityKey);

    const variance: VarianceNodeData = {
      varianceSeverity: metrics.varianceSeverity ?? "on_track",
      variancePct: metrics.variancePct,
      scheduleRisk: risk?.riskLevel ?? "none",
      scheduleRiskScore: risk?.riskScore ?? 0,
      likelyCause: cause?.likelyCause.cause ?? "unclassified",
      causeConfidence: cause?.likelyCause.confidence ?? 0,
      trendDirection: trend?.direction ?? "insufficient_data",
    };

    return {
      ...node,
      metadata: {
        ...node.metadata,
        variance,
      },
    };
  });
}

// ── buildLaborRiskInsight ──────────────────────────────────────────────────────

/**
 * Build a LivingGraphInsight for a labor risk node or enriched node.
 * Uses the same classification as explanation.ts but returns the
 * LivingGraphInsight format (kind + values for i18n interpolation).
 */
export function buildLaborRiskInsight(
  laborRisk: LaborRiskNodeData,
  downstreamCount: number,
): LivingGraphInsight {
  return {
    kind: "laborCapacityGap",
    values: {
      trade: laborRisk.tradeKey,
      week: laborRisk.weekLabel,
      gap: Math.abs(laborRisk.gapHeadcount),
      requiredHC: laborRisk.requiredHeadcount,
      availableHC: laborRisk.availableHeadcount,
      downstream: downstreamCount,
      criticalPath: laborRisk.criticalPathImpact ? 1 : 0,
      utilizationPct: laborRisk.utilizationPct ?? 0,
      zone: laborRisk.locationZone ?? "",
      insightKind: laborRisk.insightKind,
    },
  };
}