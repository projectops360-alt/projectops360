"use client";

// ============================================================================
// ProjectOps360° — Living Graph view (main client orchestrator)
// ============================================================================
// Interactive process-intelligence surface: React Flow canvas with custom
// nodes/edges, overlays, filters, search, three layout modes, timeline
// playback, deterministic what-if simulation and large-graph safeguards.
// ============================================================================

import "@xyflow/react/dist/style.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Position,
  useReactFlow,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type NodeChange,
  type OnNodeDrag,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Share2, MonitorSmartphone, Route, Sparkles, X, RefreshCw, Loader2 } from "lucide-react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Milestone, RoadmapTask, LaborResource, ConstructionActivity, TradeTaxonomy, Locale } from "@/types/database";
import type {
  LivingGraphData,
  LivingGraphNode as GraphNode,
  LivingGraphOverlay,
  LivingGraphLayoutMode,
  LivingGraphViewLevel,
  LivingGraphSimulationState,
  LivingGraphSimulationScenario,
} from "@/types/living-graph";
import type { LaborCapacityResult } from "@/lib/labor/capacity";
import type { LookaheadActivity } from "@/lib/labor/lookahead";
import type { ProcessNodeType, ProcessEdgeType, FindPathResult } from "@/types/database";
import {
  aggregateByMilestone,
  analyzeGraph,
  buildPathNarrative,
  clusterByEntity,
  collectReachable,
  computeGraphHealth,
  nodeOverlayEmphasis,
  pruneEdgesForClarity,
  runSimulation,
  type OverlayEmphasis,
} from "@/lib/graph/living-graph-analysis";
import { buildDemoGraphData } from "@/lib/graph/living-graph-demo-data";
import {
  computeLayout,
  milestoneFlowLayout,
  snakeHandleSides,
  NODE_WIDTH,
  NODE_HEIGHT,
  MILESTONE_NODE_WIDTH,
  MILESTONE_NODE_HEIGHT,
  type SnakeSide,
} from "@/lib/graph/living-graph-layout";
import {
  NODE_TYPE_STYLES,
  EDGE_TYPE_STYLES,
  GRAPH_SEMANTIC_COLORS,
  minimapNodeColor,
} from "@/lib/graph/living-graph-styles";
import {
  mapLaborRisksToGraphNodes,
  mapLaborConstraintsToEdges,
  enrichExistingNodesWithLaborData,
  enrichNodesWithReadiness,
  enrichNodesWithVariance,
} from "@/lib/graph/labor-graph-mapping";
import { LivingGraphNode } from "./living-graph-node";
import { LivingGraphMilestoneNode } from "./living-graph-milestone-node";
import { LivingGraphEdge } from "./living-graph-edge";
import { LivingGraphToolbar } from "./living-graph-toolbar";
import { LivingGraphTimeline } from "./living-graph-timeline";
import { LivingGraphDetailPanel } from "./living-graph-detail-panel";
import { LivingGraphMetricsHeader } from "./living-graph-metrics-header";
import { LivingGraphLegend } from "./living-graph-legend";
import { LivingGraphSimulationPanel } from "./living-graph-simulation-panel";
import {
  LivingGraphEditDialogs,
  type EditingEntity,
} from "./living-graph-edit-dialogs";
import type {
  LivingFlowNode,
  LivingFlowEdge,
  TimelinePlaybackState,
} from "./living-graph-flow-types";

const NODE_TYPES = { living: LivingGraphNode, milestoneCard: LivingGraphMilestoneNode };
const EDGE_TYPES = { living: LivingGraphEdge };

const SIDE_TO_POSITION: Record<SnakeSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const ALL_NODE_TYPES = Object.keys(NODE_TYPE_STYLES) as ProcessNodeType[];
const ALL_EDGE_TYPES = Object.keys(EDGE_TYPE_STYLES) as ProcessEdgeType[];

const LARGE_GRAPH_THRESHOLD = 150;

export interface LivingGraphViewProps {
  projectId: string;
  data: LivingGraphData;
  /** Full records for in-graph editing of the underlying entities. */
  milestones: Milestone[];
  tasks: RoadmapTask[];
  /** Labor capacity data (optional — enables the laborCapacity overlay). */
  laborCapacity?: LaborCapacityResult;
  laborResources?: LaborResource[];
  laborActivities?: ConstructionActivity[];
  tradeTaxonomy?: TradeTaxonomy[];
  /** Lookahead activities with readiness data (optional — enables readiness enrichment). */
  lookaheadActivities?: LookaheadActivity[];
  /** Per-activity variance metrics from computeLaborVariance (optional — enables variance overlay). */
  laborVariance?: import("@/lib/labor/labor-variance").LaborVarianceResult;
  /** Productivity variance result (optional — trends + schedule risks for variance overlay). */
  varianceResult?: import("@/lib/labor/productivity-variance").ProductivityVarianceResult;
  /** Variance cause classification results (optional — enables variance overlay detail). */
  varianceCauses?: import("@/lib/labor/variance-cause-classification").VarianceCauseResult[];
}

// ── Public wrapper: provider + empty / mobile states ──────────────────────────

export function LivingGraphView({ projectId, data, milestones, tasks, laborCapacity, laborResources, laborActivities, tradeTaxonomy, lookaheadActivities, laborVariance, varianceResult, varianceCauses }: LivingGraphViewProps) {
  const t = useTranslations("livingGraph");
  // Demo mode: opt-in sample graph, only offered when the project is empty
  const [demoMode, setDemoMode] = useState(false);
  const effectiveData = useMemo(
    () => (demoMode && data.nodes.length === 0 ? buildDemoGraphData(projectId) : data),
    [demoMode, data, projectId],
  );

  if (effectiveData.nodes.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 py-20 text-center"
      >
        <Share2 className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
        <h3 className="text-base font-semibold text-foreground">{t("emptyState.title")}</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("emptyState.description")}
        </p>
        <button
          type="button"
          onClick={() => setDemoMode(true)}
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {t("demo.cta")}
        </button>
      </div>
    );
  }

  return (
    <>
      {demoMode && (
        <p
          role="status"
          className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t("demo.badge")}
        </p>
      )}
      {/* Mobile notice */}
      <div
        role="status"
        className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-10 text-center md:hidden"
      >
        <MonitorSmartphone className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("warnings.mobileNotice")}</p>
      </div>
      {/* Desktop / tablet */}
      <div className="hidden md:block">
        <ReactFlowProvider>
          <LivingGraphCanvas
            projectId={projectId}
            data={effectiveData}
            milestones={milestones}
            tasks={tasks}
            laborCapacity={laborCapacity}
            laborResources={laborResources}
            laborActivities={laborActivities}
            tradeTaxonomy={tradeTaxonomy}
            lookaheadActivities={lookaheadActivities}
            laborVariance={laborVariance}
            varianceResult={varianceResult}
            varianceCauses={varianceCauses}
          />
        </ReactFlowProvider>
      </div>
    </>
  );
}

// ── Inner canvas (needs ReactFlowProvider context) ─────────────────────────────

function LivingGraphCanvas({ projectId, data, milestones, tasks, laborCapacity, laborResources, laborActivities, tradeTaxonomy, lookaheadActivities, laborVariance, varianceResult, varianceCauses }: LivingGraphViewProps) {
  const t = useTranslations("livingGraph");
  const router = useRouter();
  const { fitView, setCenter, getIntersectingNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [recalculating, setRecalculating] = useState(false);

  async function handleRecalculate() {
    setRecalculating(true);
    const { refreshLivingGraphAction } = await import(
      "@/app/[locale]/(app)/projects/[projectId]/execution-map/living-graph/actions"
    );
    await refreshLivingGraphAction({ projectId });
    setRecalculating(false);
    router.refresh();
  }

  // ── State ──
  const [overlay, setOverlay] = useState<LivingGraphOverlay>("normal");
  const [layoutMode, setLayoutMode] = useState<LivingGraphLayoutMode>("hierarchical");
  // High-level milestone flowchart by default; drill into activities/events
  const [viewLevel, setViewLevel] = useState<LivingGraphViewLevel>("milestones");
  // Milestones picked for drill-down (max 2)
  const [milestonePicks, setMilestonePicks] = useState<string[]>([]);
  // Drill-down filter: only show activities of these milestones
  const [milestoneFocus, setMilestoneFocus] = useState<Set<string> | null>(null);
  // User-dragged node positions (override the computed layout)
  const [manualPositions, setManualPositions] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  );
  // Node currently hovered while dragging another node (drop-to-connect)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // Entity being edited via the roadmap dialogs (in-graph editing)
  const [editingEntity, setEditingEntity] = useState<EditingEntity | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeTypeFilter, setNodeTypeFilter] = useState<Set<ProcessNodeType>>(
    new Set(ALL_NODE_TYPES),
  );
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<Set<ProcessEdgeType>>(
    new Set(ALL_EDGE_TYPES),
  );
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<"low" | "medium" | "high" | null>(null);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [focusIds, setFocusIds] = useState<Set<string> | null>(null);
  const [downstreamIds, setDownstreamIds] = useState<Set<string> | null>(null);
  const [pathModeFromId, setPathModeFromId] = useState<string | null>(null);
  const [pathResult, setPathResult] = useState<string[] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [simulation, setSimulation] = useState<LivingGraphSimulationState | null>(null);
  // Timeline playback
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Prune the temporal-proximity edge mesh for readability (toggleable)
  const [simplifyEdges, setSimplifyEdges] = useState(true);

  // ── Labor-enriched graph (inject risk nodes + edges, enrich existing nodes) ──
  const laborEnrichedData = useMemo(() => {
    if (!laborCapacity || !laborActivities || !tradeTaxonomy) return data;
    let enrichedNodes = enrichExistingNodesWithLaborData(data.nodes, laborCapacity);

    // Enrich construction activity nodes with readiness data
    if (lookaheadActivities && lookaheadActivities.length > 0) {
      const locale = (typeof window !== "undefined" ? document.documentElement.lang : "en") as Locale;
      enrichedNodes = enrichNodesWithReadiness(enrichedNodes, lookaheadActivities, locale);
    }

    // Enrich construction activity nodes with variance data
    if (laborVariance && varianceResult && varianceCauses) {
      enrichedNodes = enrichNodesWithVariance(enrichedNodes, laborVariance, varianceResult, varianceCauses);
    }

    // Only inject synthetic risk nodes at activities/events level (not milestones)
    if (viewLevel === "milestones") {
      return { ...data, nodes: enrichedNodes };
    }

    const { riskNodes } = mapLaborRisksToGraphNodes(laborCapacity, tradeTaxonomy, (typeof window !== "undefined" ? document.documentElement.lang : "en") as Locale);
    const constraintEdges = mapLaborConstraintsToEdges(
      laborCapacity,
      riskNodes,
      enrichedNodes,
      projectId,
    );

    return {
      ...data,
      nodes: [...enrichedNodes, ...riskNodes],
      edges: [...data.edges, ...constraintEdges],
    };
  }, [data, laborCapacity, laborActivities, tradeTaxonomy, viewLevel, projectId, lookaheadActivities]);

  // ── Derived graph (aggregate → prune → analysis → filter → layout) ──
  const displayGraph = useMemo(() => {
    if (viewLevel === "milestones") {
      return aggregateByMilestone(laborEnrichedData.nodes, laborEnrichedData.edges);
    }
    const graph =
      viewLevel === "activities"
        ? clusterByEntity(laborEnrichedData.nodes, laborEnrichedData.edges)
        : { nodes: laborEnrichedData.nodes, edges: laborEnrichedData.edges };
    return simplifyEdges
      ? { nodes: graph.nodes, edges: pruneEdgesForClarity(graph.edges) }
      : graph;
  }, [viewLevel, laborEnrichedData, simplifyEdges]);

  const analysis = useMemo(
    () => analyzeGraph(displayGraph.nodes, displayGraph.edges),
    [displayGraph],
  );

  // Executive metrics for the premium dashboard header
  const health = useMemo(() => computeGraphHealth(analysis), [analysis]);

  const statuses = useMemo(
    () =>
      [...new Set(displayGraph.nodes.map((n) => n.status).filter((s): s is string => !!s))].sort(),
    [displayGraph.nodes],
  );

  const filtered = useMemo(() => {
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null;
    const nodes = displayGraph.nodes.filter((n) => {
      if (!nodeTypeFilter.has(n.nodeType)) return false;
      if (statusFilter && n.status !== statusFilter) return false;
      if (riskFilter && n.riskLevel !== riskFilter) return false;
      if (blockedOnly && !n.isBlocked) return false;
      if (criticalOnly && !(analysis.metrics.get(n.id)?.onCriticalPath || n.isCritical)) {
        return false;
      }
      const time = new Date(n.occurredAt).getTime();
      if (fromTime != null && time < fromTime) return false;
      if (toTime != null && time >= toTime) return false;
      if (focusIds && !focusIds.has(n.id)) return false;
      if (
        milestoneFocus &&
        viewLevel !== "milestones" &&
        (!n.milestoneId || !milestoneFocus.has(n.milestoneId))
      ) {
        return false;
      }
      return true;
    });
    const idSet = new Set(nodes.map((n) => n.id));
    const edges = displayGraph.edges.filter(
      (e) =>
        edgeTypeFilter.has(e.edgeType) &&
        idSet.has(e.sourceNodeId) &&
        idSet.has(e.targetNodeId),
    );
    return { nodes, edges };
  }, [
    displayGraph,
    analysis,
    nodeTypeFilter,
    edgeTypeFilter,
    statusFilter,
    riskFilter,
    blockedOnly,
    criticalOnly,
    dateFrom,
    dateTo,
    focusIds,
    milestoneFocus,
    viewLevel,
  ]);

  const layoutPositions = useMemo(
    () =>
      viewLevel === "milestones"
        ? milestoneFlowLayout(filtered.nodes) // serpentine roadmap, layoutMode ignored
        : computeLayout(layoutMode, filtered.nodes, filtered.edges),
    [viewLevel, layoutMode, filtered],
  );

  // User drags win over the computed layout
  const positions = useMemo(() => {
    if (manualPositions.size === 0) return layoutPositions;
    const merged = new Map(layoutPositions);
    for (const [id, pos] of manualPositions) {
      if (merged.has(id)) merged.set(id, pos);
    }
    return merged;
  }, [layoutPositions, manualPositions]);

  // ── Search ──
  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return new Set<string>();
    return new Set(
      filtered.nodes
        .filter(
          (n) =>
            n.label.toLowerCase().includes(q) ||
            n.id.toLowerCase().includes(q) ||
            n.sourceEntityId.toLowerCase().includes(q) ||
            n.sourceEntityType.toLowerCase().includes(q),
        )
        .map((n) => n.id),
    );
  }, [searchQuery, filtered.nodes]);

  // ── Timeline playback ──
  const timelineActive = overlay === "timeline";
  const currentEvent = playbackIndex >= 0 ? data.events[playbackIndex] : null;
  const currentTime = currentEvent ? new Date(currentEvent.occurredAt).getTime() : null;

  const playbackStateFor = useCallback(
    (node: GraphNode): TimelinePlaybackState => {
      if (!timelineActive) return "none";
      if (currentTime == null) return "future";
      const nodeTime = new Date(node.occurredAt).getTime();
      if (nodeTime > currentTime) return "future";
      const isActive =
        currentEvent != null &&
        (viewLevel === "activities"
          ? node.id === `cluster:${currentEvent.entityType}:${currentEvent.entityId}`
          : viewLevel === "events"
            ? node.id === currentEvent.nodeId
            : false); // milestone level: no single active node
      return isActive ? "active" : "past";
    },
    [timelineActive, currentTime, currentEvent, viewLevel],
  );

  // Overlay switch resets playback/simulation state tied to the old overlay
  const handleOverlayChange = useCallback((next: LivingGraphOverlay) => {
    setOverlay(next);
    if (next !== "timeline") {
      setPlaying(false);
      setPlaybackIndex(-1);
    }
    if (next !== "simulation") setSimulation(null);
  }, []);

  // ── Path edges lookup ──
  const pathEdgeIds = useMemo(() => {
    if (!pathResult || pathResult.length < 2) return new Set<string>();
    const ids = new Set<string>();
    for (let i = 0; i < pathResult.length - 1; i++) {
      for (const e of analysis.adjacency.out.get(pathResult[i]) ?? []) {
        if (e.targetNodeId === pathResult[i + 1]) ids.add(e.id);
      }
    }
    return ids;
  }, [pathResult, analysis]);
  const pathNodeIds = useMemo(() => new Set(pathResult ?? []), [pathResult]);

  // Deterministic path summary (PI-008 upgrades this to an AI narrative)
  const pathNarrative = useMemo(
    () => (pathResult ? buildPathNarrative(analysis, pathResult) : null),
    [pathResult, analysis],
  );

  // ── React Flow node/edge models ──
  const simulationAffected = useMemo(
    () => new Set(simulation?.affectedNodeIds ?? []),
    [simulation],
  );

  // Hierarchical flows top→bottom (Celonis style); timeline/force flow left→right
  const flowVertical = layoutMode === "hierarchical";
  const isMilestoneLevel = viewLevel === "milestones";

  const rfNodes = useMemo<LivingFlowNode[]>(() => {
    const total = filtered.nodes.length;
    return filtered.nodes.map((node, index) => {
      const metrics = analysis.metrics.get(node.id) ?? null;
      const emphasis: OverlayEmphasis = nodeOverlayEmphasis(
        overlay,
        node,
        metrics ?? undefined,
        analysis,
      );
      const clusterSize =
        typeof node.metadata.clusterSize === "number" ? node.metadata.clusterSize : 1;
      // Milestone cards follow the serpentine flow; other levels follow layout direction
      const snakeSides = isMilestoneLevel ? snakeHandleSides(index, total) : null;
      return {
        id: node.id,
        type: (isMilestoneLevel ? "milestoneCard" : "living") as "living" | "milestoneCard",
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        width: isMilestoneLevel ? MILESTONE_NODE_WIDTH : NODE_WIDTH,
        height: isMilestoneLevel ? MILESTONE_NODE_HEIGHT : NODE_HEIGHT,
        sourcePosition: snakeSides
          ? SIDE_TO_POSITION[snakeSides.source]
          : flowVertical
            ? Position.Bottom
            : Position.Right,
        targetPosition: snakeSides
          ? SIDE_TO_POSITION[snakeSides.target]
          : flowVertical
            ? Position.Top
            : Position.Left,
        selected: node.id === selectedNodeId,
        data: {
          node,
          metrics,
          emphasis,
          playback: playbackStateFor(node),
          isSearchHit: searchHits.has(node.id),
          isSimulationImpact: simulationAffected.has(node.id),
          isSimulationOrigin: simulation?.focusNodeId === node.id,
          isDownstreamHighlight: downstreamIds?.has(node.id) ?? false,
          isPathMember:
            pathNodeIds.has(node.id) ||
            (viewLevel === "milestones" &&
              node.milestoneId != null &&
              milestonePicks.includes(node.milestoneId)),
          isFocusNode: focusIds != null && node.id === selectedNodeId,
          isDropTarget: node.id === dropTargetId,
          clusterSize,
        },
      };
    });
  }, [
    filtered.nodes,
    positions,
    analysis,
    overlay,
    selectedNodeId,
    playbackStateFor,
    searchHits,
    simulationAffected,
    simulation,
    downstreamIds,
    pathNodeIds,
    focusIds,
    flowVertical,
    viewLevel,
    isMilestoneLevel,
    milestonePicks,
    dropTargetId,
  ]);

  // Drill-down: show only the picked milestones' activities
  const handleDrillIntoPicks = useCallback(() => {
    if (milestonePicks.length === 0) return;
    setMilestoneFocus(new Set(milestonePicks));
    setMilestonePicks([]);
    setManualPositions(new Map());
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setViewLevel("activities");
  }, [milestonePicks]);

  const pickedLabels = useMemo(
    () =>
      milestonePicks
        .map(
          (id) =>
            displayGraph.nodes.find((n) => n.milestoneId === id)?.milestoneLabel ??
            displayGraph.nodes.find((n) => n.milestoneId === id)?.label ??
            id,
        )
        .join(" + "),
    [milestonePicks, displayGraph.nodes],
  );

  const dimmedNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of rfNodes) {
      if (n.data.emphasis === "dimmed" || n.data.playback === "future") set.add(n.id);
    }
    return set;
  }, [rfNodes]);

  const rfEdges = useMemo<LivingFlowEdge[]>(() => {
    const edges: LivingFlowEdge[] = filtered.edges.map((edge) => {
      const style = EDGE_TYPE_STYLES[edge.edgeType];
      const isCritical =
        analysis.criticalEdgeIds.has(edge.id) && overlay === "criticalPath";
      const dimmed =
        dimmedNodeIds.has(edge.sourceNodeId) || dimmedNodeIds.has(edge.targetNodeId);
      const playbackHidden =
        timelineActive &&
        (currentTime == null ||
          new Date(
            analysis.adjacency.nodeById.get(edge.targetNodeId)?.occurredAt ?? 0,
          ).getTime() > currentTime);
      return {
        id: edge.id,
        type: "living" as const,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        animated:
          style.animated ||
          edge.metadata.milestone_chain === true ||
          isCritical, // critical path flows visibly in its overlay
        selected: edge.id === selectedEdgeId,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCritical ? GRAPH_SEMANTIC_COLORS.critical : style.stroke,
          width: 16,
          height: 16,
        },
        data: {
          edge,
          emphasis: (dimmed ? "dimmed" : "normal") as OverlayEmphasis,
          isCritical,
          isPathMember: pathEdgeIds.has(edge.id),
          playbackHidden,
        },
      };
    });

    // Celonis-style selection link between the two picked milestones
    if (isMilestoneLevel && milestonePicks.length === 2) {
      const [a, b] = milestonePicks;
      edges.push({
        id: "__pick-link",
        type: "living" as const,
        source: `milestone:${a}`,
        target: `milestone:${b}`,
        data: {
          edge: {
            id: "__pick-link",
            projectId: "",
            sourceNodeId: `milestone:${a}`,
            targetNodeId: `milestone:${b}`,
            edgeType: "informed",
            weight: 1,
            lagDays: null,
            isCritical: false,
            riskLevel: null,
            metadata: { pick_link: true },
          },
          emphasis: "normal" as OverlayEmphasis,
          isCritical: false,
          isPathMember: false,
          playbackHidden: false,
        },
      });
    }

    return edges;
  }, [
    filtered.edges,
    analysis,
    overlay,
    dimmedNodeIds,
    selectedEdgeId,
    pathEdgeIds,
    timelineActive,
    currentTime,
    isMilestoneLevel,
    milestonePicks,
  ]);

  // ── Selection helpers ──
  const selectedNode = useMemo(
    () => (selectedNodeId ? (analysis.adjacency.nodeById.get(selectedNodeId) ?? null) : null),
    [selectedNodeId, analysis],
  );
  const selectedEdge = useMemo(
    () =>
      selectedEdgeId
        ? (displayGraph.edges.find((e) => e.id === selectedEdgeId) ?? null)
        : null,
    [selectedEdgeId, displayGraph.edges],
  );

  // ── Handlers ──
  const clientFindPath = useCallback(
    (fromId: string, toId: string): string[] | null => {
      // BFS shortest path over outgoing edges
      const prev = new Map<string, string>();
      const queue = [fromId];
      const seen = new Set([fromId]);
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (id === toId) {
          const path = [toId];
          let cursor = toId;
          while (prev.has(cursor)) {
            cursor = prev.get(cursor)!;
            path.unshift(cursor);
          }
          return path;
        }
        for (const e of analysis.adjacency.out.get(id) ?? []) {
          if (!seen.has(e.targetNodeId)) {
            seen.add(e.targetNodeId);
            prev.set(e.targetNodeId, id);
            queue.push(e.targetNodeId);
          }
        }
      }
      return null;
    },
    [analysis],
  );

  const resolvePath = useCallback(
    async (fromId: string, toId: string) => {
      // Prefer the backend RPC on the raw graph; fall back to client BFS
      if (viewLevel === "events") {
        try {
          const supabase = createBrowserClient();
          const { data: rpcData, error } = await supabase.rpc("find_path", {
            p_project_id: projectId,
            p_from_node_id: fromId,
            p_to_node_id: toId,
          });
          if (!error && Array.isArray(rpcData) && rpcData.length > 0) {
            const row = rpcData[0] as FindPathResult;
            if (row.path_node_ids?.length > 0) {
              setPathResult(row.path_node_ids);
              return;
            }
          }
        } catch {
          // fall through to client BFS
        }
      }
      setPathResult(clientFindPath(fromId, toId));
    },
    [viewLevel, projectId, clientFindPath],
  );

  const onNodeClick = useCallback<NodeMouseHandler<LivingFlowNode>>(
    (_event, node) => {
      if (pathModeFromId && pathModeFromId !== node.id) {
        void resolvePath(pathModeFromId, node.id);
        setPathModeFromId(null);
        return;
      }
      // Milestone level: clicks also pick milestones for drill-down (max 2)
      if (viewLevel === "milestones") {
        const milestoneId = node.data.node.milestoneId;
        if (milestoneId) {
          setMilestonePicks((prev) =>
            prev.includes(milestoneId)
              ? prev.filter((id) => id !== milestoneId)
              : [...prev.slice(-1), milestoneId],
          );
        }
      }
      setSelectedEdgeId(null);
      setSelectedNodeId(node.id);
    },
    [pathModeFromId, resolvePath, viewLevel],
  );

  const onEdgeClick = useCallback<EdgeMouseHandler<LivingFlowEdge>>(
    (_event, edge) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(edge.id);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // Free repositioning: drag position changes become manual layout overrides
  const onNodesChange = useCallback((changes: NodeChange<LivingFlowNode>[]) => {
    setManualPositions((prev) => {
      let next: Map<string, { x: number; y: number }> | null = null;
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          if (!next) next = new Map(prev);
          next.set(change.id, change.position);
        }
      }
      return next ?? prev;
    });
  }, []);

  // Drop-to-connect (milestone level): highlight the card under the drag
  const onNodeDrag = useCallback<OnNodeDrag<LivingFlowNode>>(
    (_event, node) => {
      if (!isMilestoneLevel) return;
      const target = getIntersectingNodes(node).find(
        (n) => n.type === "milestoneCard" && n.id !== node.id,
      );
      setDropTargetId(target?.id ?? null);
    },
    [isMilestoneLevel, getIntersectingNodes],
  );

  const onNodeDragStop = useCallback<OnNodeDrag<LivingFlowNode>>(
    (_event, node) => {
      setDropTargetId(null);
      if (!isMilestoneLevel) return;
      const target = getIntersectingNodes(node).find(
        (n) => n.type === "milestoneCard" && n.id !== node.id,
      ) as LivingFlowNode | undefined;
      if (!target) return;
      const a = node.data.node.milestoneId;
      const b = target.data.node.milestoneId;
      if (!a || !b || a === b) return;
      // Snap the dragged card back to its slot and connect both milestones
      setManualPositions((prev) => {
        if (!prev.has(node.id)) return prev;
        const next = new Map(prev);
        next.delete(node.id);
        return next;
      });
      setMilestonePicks([a, b]);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    [isMilestoneLevel, getIntersectingNodes],
  );

  // In-graph editing: resolve the node's underlying entity and open its dialog
  const handleEditNode = useCallback(
    (node: GraphNode) => {
      if (node.id.startsWith("milestone:") || node.sourceEntityType === "milestones") {
        const milestoneId = node.id.startsWith("milestone:")
          ? node.milestoneId
          : node.sourceEntityId;
        const milestone = milestones.find((m) => m.id === milestoneId);
        if (milestone) setEditingEntity({ kind: "milestone", milestone });
      } else if (node.sourceEntityType === "roadmap_tasks") {
        const task = tasks.find((candidate) => candidate.id === node.sourceEntityId);
        if (task) setEditingEntity({ kind: "task", task });
      }
    },
    [milestones, tasks],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler<LivingFlowNode>>(
    (_event, node) => handleEditNode(node.data.node),
    [handleEditNode],
  );

  const handleExtractSubgraph = useCallback(
    async (node: GraphNode) => {
      // RPC works on raw event nodes; aggregated levels fall back to client BFS
      if (viewLevel === "events") {
        try {
          const supabase = createBrowserClient();
          const { data: rpcData, error } = await supabase.rpc("extract_subgraph", {
            p_project_id: projectId,
            p_entity_type: node.sourceEntityType,
            p_entity_id: node.sourceEntityId,
            p_depth: 2,
          });
          if (!error && Array.isArray(rpcData) && rpcData.length > 0) {
            const row = rpcData[0] as { nodes: { id: string }[] | null };
            const ids = (row.nodes ?? []).map((n) => n.id);
            if (ids.length > 0) {
              setFocusIds(new Set(ids));
              return;
            }
          }
        } catch {
          // fall through to client BFS
        }
      }
      const reachable = collectReachable(analysis.adjacency, node.id, "downstream", 2);
      const upstream = collectReachable(analysis.adjacency, node.id, "upstream", 2);
      setFocusIds(new Set([node.id, ...reachable, ...upstream]));
    },
    [viewLevel, projectId, analysis],
  );

  const handleFocusNode = useCallback(
    (nodeId: string) => {
      const reachable = collectReachable(analysis.adjacency, nodeId, "downstream", 2);
      const upstream = collectReachable(analysis.adjacency, nodeId, "upstream", 2);
      setFocusIds(new Set([nodeId, ...reachable, ...upstream]));
    },
    [analysis],
  );

  const handleShowDownstream = useCallback(
    (nodeId: string) => {
      setDownstreamIds(collectReachable(analysis.adjacency, nodeId, "downstream"));
    },
    [analysis],
  );

  const handleRunScenario = useCallback(
    (nodeId: string, scenario: LivingGraphSimulationScenario) => {
      setSimulation(runSimulation(analysis, nodeId, scenario));
    },
    [analysis],
  );

  const handleCenterSearchHit = useCallback(() => {
    const first = [...searchHits][0];
    if (!first) return;
    const pos = positions.get(first);
    if (pos) {
      setCenter(pos.x + NODE_WIDTH / 2, pos.y + NODE_HEIGHT / 2, {
        zoom: 1.1,
        duration: 400,
      });
      setSelectedEdgeId(null);
      setSelectedNodeId(first);
    }
  }, [searchHits, positions, setCenter]);

  const handleResetFilters = useCallback(() => {
    setNodeTypeFilter(new Set(ALL_NODE_TYPES));
    setEdgeTypeFilter(new Set(ALL_EDGE_TYPES));
    setStatusFilter(null);
    setRiskFilter(null);
    setBlockedOnly(false);
    setCriticalOnly(false);
    setDateFrom("");
    setDateTo("");
    setFocusIds(null);
    setDownstreamIds(null);
    setPathResult(null);
    setMilestoneFocus(null);
    setMilestonePicks([]);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Escape clears transient modes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPathModeFromId(null);
        setDownstreamIds(null);
        setPathResult(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Re-fit after layout or filter structure changes
  useEffect(() => {
    const id = setTimeout(() => {
      void fitView({ padding: 0.15, duration: 300 });
    }, 60);
    return () => clearTimeout(id);
  }, [layoutMode, viewLevel, focusIds, milestoneFocus, fitView]);

  const showPanel = selectedNode != null || selectedEdge != null;

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-220px)] min-h-[640px] flex-col gap-2 rounded-lg bg-background"
    >
      {/* Executive insight header */}
      <LivingGraphMetricsHeader health={health} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleRecalculate}
          disabled={recalculating}
          title={t("recalculateHint")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {recalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t("recalculate")}
        </button>
      </div>

      <LivingGraphToolbar
        overlay={overlay}
        onOverlayChange={handleOverlayChange}
        layoutMode={layoutMode}
        onLayoutModeChange={(mode) => {
          setLayoutMode(mode);
          setManualPositions(new Map()); // recomputed layout discards manual drags
        }}
        onSearchChange={setSearchQuery}
        searchHitCount={searchHits.size}
        searchActive={searchQuery.trim().length >= 2}
        onCenterSearchHit={handleCenterSearchHit}
        nodeTypeFilter={nodeTypeFilter}
        onToggleNodeType={(type) =>
          setNodeTypeFilter((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
          })
        }
        edgeTypeFilter={edgeTypeFilter}
        onToggleEdgeType={(type) =>
          setEdgeTypeFilter((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
          })
        }
        statusFilter={statusFilter}
        statuses={statuses}
        onStatusFilterChange={setStatusFilter}
        riskFilter={riskFilter}
        onRiskFilterChange={setRiskFilter}
        blockedOnly={blockedOnly}
        onBlockedOnlyChange={setBlockedOnly}
        criticalOnly={criticalOnly}
        onCriticalOnlyChange={setCriticalOnly}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        simplifyEdges={simplifyEdges}
        onToggleSimplifyEdges={() => setSimplifyEdges((v) => !v)}
        viewLevel={viewLevel}
        onViewLevelChange={(level) => {
          setViewLevel(level);
          setMilestonePicks([]);
          setManualPositions(new Map());
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }}
        focusActive={
          focusIds != null ||
          downstreamIds != null ||
          pathResult != null ||
          milestoneFocus != null
        }
        onClearFocus={() => {
          setFocusIds(null);
          setDownstreamIds(null);
          setPathResult(null);
          setMilestoneFocus(null);
          setMilestonePicks([]);
        }}
        onFitView={() => void fitView({ padding: 0.15, duration: 300 })}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onResetFilters={handleResetFilters}
        summary={analysis.summary}
        largeGraphWarning={filtered.nodes.length > LARGE_GRAPH_THRESHOLD && focusIds == null}
      />

      {/* Status hints */}
      {isMilestoneLevel && milestonePicks.length === 0 && (
        <p className="text-[11px] text-muted-foreground">{t("drill.hint")}</p>
      )}
      {pathModeFromId && (
        <p role="status" className="rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs text-brand-600 dark:text-brand-400">
          {t("actions.findPathHint")}
        </p>
      )}
      {viewLevel === "milestones" && milestonePicks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5">
          <span className="text-xs text-brand-600 dark:text-brand-400">
            {t("drill.selected", { names: pickedLabels })}
          </span>
          <button
            type="button"
            onClick={handleDrillIntoPicks}
            className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700"
          >
            {t("drill.viewFlow")}
          </button>
        </div>
      )}
      {pathNarrative && (
        <div className="rounded-md border border-brand-500/40 bg-brand-500/5 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <Route className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {t("pathNarrative.title", {
                    steps: pathNarrative.steps.length,
                    days: pathNarrative.totalDurationDays,
                  })}
                </p>
                <p className="truncate text-[11px] text-muted-foreground" title={pathNarrative.steps.map((s) => s.label).join(" → ")}>
                  {pathNarrative.steps.map((s) => s.label).join(" → ")}
                </p>
                {pathNarrative.blockedLabels.length > 0 && (
                  <p className="text-[11px] text-red-500">
                    {t("pathNarrative.blocked", {
                      labels: pathNarrative.blockedLabels.join(", "),
                    })}
                  </p>
                )}
                {pathNarrative.delayedSegments.length > 0 && (
                  <p className="text-[11px] text-amber-500">
                    {t("pathNarrative.delays", {
                      segments: pathNarrative.delayedSegments.join("; "),
                    })}
                  </p>
                )}
                {pathNarrative.weakestEdge && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("pathNarrative.weakest", {
                      from: pathNarrative.weakestEdge.sourceLabel,
                      to: pathNarrative.weakestEdge.targetLabel,
                      weight: pathNarrative.weakestEdge.weight,
                    })}
                  </p>
                )}
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  {t("pathNarrative.aiSoon")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPathResult(null)}
              aria-label={t("actions.close")}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}
      {overlay === "simulation" && !selectedNode && (
        <p role="status" className="rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-600 dark:text-orange-400">
          {t("simulation.selectNode")}
        </p>
      )}

      {/* Canvas + detail panel */}
      <div
        className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card/30"
        style={{
          backgroundImage:
            "radial-gradient(1100px 420px at 50% -10%, rgba(99,102,241,0.07), transparent), radial-gradient(700px 300px at 100% 100%, rgba(16,185,129,0.05), transparent)",
        }}
      >
        <LivingGraphLegend />
        {overlay === "simulation" && selectedNode && (
          <LivingGraphSimulationPanel
            selectedNode={selectedNode}
            simulation={simulation}
            baselineDays={
              selectedNode.durationDays ??
              (selectedNode.startDate && selectedNode.endDate
                ? Math.max(
                    0,
                    Math.round(
                      ((new Date(selectedNode.endDate).getTime() -
                        new Date(selectedNode.startDate).getTime()) /
                        86_400_000) *
                        10,
                    ) / 10,
                  )
                : 1)
            }
            onRunScenario={handleRunScenario}
            onReset={() => setSimulation(null)}
          />
        )}
        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onNodesChange={onNodesChange}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            fitView
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable
            nodesConnectable={false}
            edgesFocusable
            proOptions={{ hideAttribution: true }}
            aria-label={t("title")}
          >
            <Background gap={24} size={1} />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(n) =>
                minimapNodeColor((n as LivingFlowNode).data.node.nodeType)
              }
              className="!bg-card"
            />
          </ReactFlow>
        </div>

        {showPanel && (
          <div className="absolute inset-y-0 right-0 z-20 lg:relative lg:inset-auto">
            <LivingGraphDetailPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              analysis={analysis}
              overlay={overlay}
              simulation={simulation}
              pathModeFromId={pathModeFromId}
              onFindPathFrom={(id) => setPathModeFromId((cur) => (cur === id ? null : id))}
              onExtractSubgraph={(node) => void handleExtractSubgraph(node)}
              onShowDownstream={handleShowDownstream}
              onFocusNode={handleFocusNode}
              onRunScenario={handleRunScenario}
              onEditEntity={handleEditNode}
              onClose={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Timeline playback (visible in timeline overlay) */}
      {timelineActive && (
        <LivingGraphTimeline
          events={data.events}
          currentIndex={playbackIndex}
          playing={playing}
          speed={speed}
          onIndexChange={setPlaybackIndex}
          onPlayingChange={setPlaying}
          onSpeedChange={setSpeed}
        />
      )}

      {/* In-graph entity editing (roadmap dialogs) */}
      <LivingGraphEditDialogs
        projectId={projectId}
        milestones={milestones}
        editing={editingEntity}
        onClose={() => setEditingEntity(null)}
        onSaved={() => {
          setEditingEntity(null);
          router.refresh(); // re-fetch graph + enrichment with the new data
        }}
      />
    </div>
  );
}
