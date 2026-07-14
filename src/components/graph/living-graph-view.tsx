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
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { ExecutiveSummaryPanel } from "./executive-summary-panel";
import { Share2, MonitorSmartphone, Route, Sparkles, X, RefreshCw, Loader2, BarChart3, Users, ListTree, Info, ListChecks, GitFork, ScrollText, Workflow } from "lucide-react";
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
import { computeMilestoneTaskCensus } from "@/lib/roadmap/milestone-task-census";
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
import { computeMilestoneFocusPositions, getMilestoneFocusLayoutKey, buildMilestoneFocusHubEdges } from "@/lib/graph/milestone-focus-layout";
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
import {
  enrichNodesWithWorkforce,
  mapWorkforceResourceNodes,
  mapWorkforceAssignmentEdges,
} from "@/lib/graph/workforce-graph-mapping";
import {
  appendSubtaskGraphLayer,
  groupSubtasksByTask,
  toggleSubtaskExpansion,
  collapseAllSubtaskParents,
  scopedExpandableTaskIds,
  type SubtaskLayerRow,
} from "@/lib/graph/subtask-graph-layer";
import type { ResourceCapacityResult } from "@/lib/capacity/service";
import { LivingGraphNode } from "./living-graph-node";
import { LivingGraphMilestoneNode } from "./living-graph-milestone-node";
import { LivingGraphEdge } from "./living-graph-edge";
import { CanonicalEventNode } from "./canonical-event-node";
import { CanonicalObjectNode } from "./canonical-object-node";
import { CanonicalEventEdge } from "./canonical-event-edge";
import { ProcessActivityNode } from "./process-activity-node";
import { ProcessTransitionEdge } from "./process-transition-edge";
import { TaskCaseExplorer } from "./task-case-explorer";
import { TaskProcessExplorerPanel } from "./task-process-explorer-panel";
import { LivingGraphToolbar } from "./living-graph-toolbar";
import { LivingGraphTimeline } from "./living-graph-timeline";
import { LivingGraphDetailPanel } from "./living-graph-detail-panel";
import { LivingGraphMetricsHeader } from "./living-graph-metrics-header";
import { LivingGraphLegend } from "./living-graph-legend";
import { OverlayInfo } from "./overlay-info";
import { buildCanonicalFlow, canonicalEventNodeId } from "@/lib/graph/canonical-event-flow";
import {
  buildTaskCaseSummaries,
  type TaskAttachmentRef,
} from "@/lib/graph/task-case-analysis";
import {
  aggregateTaskProcess,
  assessTaskProcessDiscovery,
  buildTaskProcessModel,
  variantForId,
} from "@/lib/graph/task-process-analysis";
import { buildTaskProcessFlow } from "@/lib/graph/task-process-flow";
import { isCompletedStatus } from "@/lib/execution/task-activity";
import {
  ADVANCED_OVERLAYS,
  resolveOverlayState,
  countDistinctEventDays,
  type OverlaySignals,
} from "@/lib/graph/overlay-metadata";
import { localizedHref } from "@/i18n/href";
import { useGraphUiPref, countActiveGraphFilters } from "@/lib/graph/graph-ui-prefs";
import {
  LAYOUT_SCHEMA_VERSION,
  buildLayoutKey,
  loadSavedLayout,
  saveLayout,
  clearSavedLayout,
  applySavedPositions,
  isPartialApply,
  type SavedGraphLayout,
  type SavedNodePosition,
} from "@/lib/graph/graph-layout-storage";
import { LivingGraphLayoutControls } from "./living-graph-layout-controls";
import { LivingGraphSimulationPanel } from "./living-graph-simulation-panel";
import {
  LivingGraphEditDialogs,
  type EditingEntity,
} from "./living-graph-edit-dialogs";
import {
  analyzeBetween,
  assessBetweenAnalysis,
  getBetweenAnalysisLayoutKey,
  type BetweenAnalysisInput,
  type BetweenAnalysisPreflight,
  type BetweenPreflightBlockingReason,
  type BetweenEndpoint,
  type BetweenAnalysisResult,
} from "@/lib/graph/between-analysis";
import { scopeLivingGraphDataToProject } from "@/lib/graph/project-scoped-data";
import { BetweenAnalysisPanel } from "./between-analysis-panel";
import type {
  LivingFlowNode,
  LivingFlowEdge,
  TimelinePlaybackState,
} from "./living-graph-flow-types";

const NODE_TYPES = {
  living: LivingGraphNode,
  milestoneCard: LivingGraphMilestoneNode,
  canonicalEvent: CanonicalEventNode,
  canonicalObject: CanonicalObjectNode,
  processActivity: ProcessActivityNode,
};
const EDGE_TYPES = {
  living: LivingGraphEdge,
  canonicalEventEdge: CanonicalEventEdge,
  processTransition: ProcessTransitionEdge,
};

type CanonicalEventExperience = "cases" | "process" | "audit";

function betweenPreflightReason(
  reason: BetweenPreflightBlockingReason,
  locale: string,
): string {
  const es = locale === "es";
  const copy: Record<BetweenPreflightBlockingReason, [string, string]> = {
    same_endpoint: [
      "Choose two different endpoints.",
      "Elige dos puntos diferentes.",
    ],
    cross_project_rejected: [
      "The endpoints do not belong to the same project.",
      "Los puntos no pertenecen al mismo proyecto.",
    ],
    start_has_no_canonical_history: [
      "The first endpoint has no canonical event history.",
      "El primer punto no tiene historial canónico.",
    ],
    end_has_no_canonical_history: [
      "The second endpoint has no canonical event history.",
      "El segundo punto no tiene historial canónico.",
    ],
  };
  return copy[reason][es ? 1 : 0];
}

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
  /** Generic resource capacity result (optional — enables the workforceCapacity overlay). */
  resourceCapacity?: ResourceCapacityResult;
  /** Task subtasks (already org/project-scoped + RBAC-validated server-side).
   *  Enables NotebookLM-style progressive subtask expansion. Presentation-only. */
  subtasks?: SubtaskLayerRow[];
  /** Subtask owner id → display name (read-only team context for the inspector). */
  subtaskOwnerNames?: Record<string, string>;
  /** Safe attachment display metadata for task-case evidence context. */
  taskAttachments?: TaskAttachmentRef[];
}

// ── Public wrapper: provider + empty / mobile states ──────────────────────────

export function LivingGraphView({ projectId, data, milestones, tasks, laborCapacity, laborResources, laborActivities, tradeTaxonomy, lookaheadActivities, laborVariance, varianceResult, varianceCauses, resourceCapacity, subtasks, subtaskOwnerNames, taskAttachments }: LivingGraphViewProps) {
  const t = useTranslations("livingGraph");
  // Demo mode: opt-in sample graph, only offered when the project is empty
  const [demoMode, setDemoMode] = useState(false);
  const effectiveData = useMemo(
    () => (demoMode && data.nodes.length === 0 ? buildDemoGraphData(projectId) : data),
    [demoMode, data, projectId],
  );

  // Part B — never block the canvas when canonical events ARE available even if
  // the operational graph is empty. A project with 0 process_nodes but a ready
  // canonical-event projection must still reach the "events" view (the user
  // switches level); only a TRULY empty project (no operational nodes AND no
  // ready/truncated canonical projection) shows the empty / "Try demo" state.
  const canonicalReady =
    data.canonicalEventProjectionStatus === "ready" ||
    data.canonicalEventProjectionStatus === "truncated";
  if (effectiveData.nodes.length === 0 && !canonicalReady) {
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
            key={projectId}
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
            resourceCapacity={resourceCapacity}
            subtasks={subtasks}
            subtaskOwnerNames={subtaskOwnerNames}
            taskAttachments={taskAttachments}
          />
        </ReactFlowProvider>
      </div>
    </>
  );
}

// ── Inner canvas (needs ReactFlowProvider context) ─────────────────────────────

function LivingGraphCanvas({ projectId, data, milestones, tasks, laborCapacity, laborActivities, tradeTaxonomy, lookaheadActivities, laborVariance, varianceResult, varianceCauses, resourceCapacity, subtasks, subtaskOwnerNames, taskAttachments }: LivingGraphViewProps) {
  const t = useTranslations("livingGraph");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { fitView, setCenter, getIntersectingNodes, getViewport, setViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [recalculating, setRecalculating] = useState(false);
  // Floating "Insights" panel (executive KPIs + summary) over the canvas.
  // Sprint #2 — persisted so the user's graph workspace is remembered.
  const [insightsOpen, setInsightsOpen] = useGraphUiPref<boolean>("insightsOpen", false);

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
  // Sprint #2 — overlay/layout/level are persisted view preferences (layout
  // only; no graph business logic). A ?overlay= deep-link still wins (below).
  const [overlay, setOverlay] = useGraphUiPref<LivingGraphOverlay>("overlay", "normal");
  // Deep-link support: the Execution Map "Open Critical Path in Living Graph"
  // CTA links with ?overlay=criticalPath. Applied post-mount to avoid a
  // hydration mismatch (Sprint #1 — Critical Path source-of-truth consolidation).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const o = new URLSearchParams(window.location.search).get("overlay");
    if (o === "criticalPath") setOverlay("criticalPath");
  }, [setOverlay]);
  const [layoutMode, setLayoutMode] = useGraphUiPref<LivingGraphLayoutMode>("layoutMode", "hierarchical");
  // High-level milestone flowchart by default; drill into activities/events
  const [viewLevel, setViewLevel] = useGraphUiPref<LivingGraphViewLevel>("viewLevel", "milestones");
  const [eventExperience, setEventExperience] = useGraphUiPref<CanonicalEventExperience>("eventExperience", "cases");
  const [selectedTaskCaseId, setSelectedTaskCaseId] = useState<string | null>(null);
  const [processVariantId, setProcessVariantId] = useState<string | null>(null);
  const [activityCoverage, setActivityCoverage] = useGraphUiPref<number>("processActivityCoverage", 100);
  const [connectionCoverage, setConnectionCoverage] = useGraphUiPref<number>("processConnectionCoverage", 100);
  // Milestones picked for drill-down (max 2)
  const [milestonePicks, setMilestonePicks] = useState<string[]>([]);
  // Drill-down filter: only show activities of these milestones
  const [milestoneFocus, setMilestoneFocus] = useState<Set<string> | null>(null);
  // ── Between-analysis (CAP-045 §C.2 / Part C) ────────────────────────────────
  // "What happened between?" mode: the user picks two endpoints (milestones /
  // tasks / canonical events) and runs a read-only analysis. Distinct from
  // milestone-focus (drill-down) — selecting two milestones shows BOTH a
  // "View flow" button (drill, unchanged) and an "Analyze what happened" button.
  const [betweenMode, setBetweenMode] = useState(false);
  const [betweenEndpoints, setBetweenEndpoints] = useState<BetweenEndpoint[]>([]);
  const [betweenResult, setBetweenResult] = useState<BetweenAnalysisResult | null>(null);
  // User-dragged node positions (override the computed layout)
  const [manualPositions, setManualPositions] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  );
  // UX-007 — Saved Layouts: persisted manual arrangement per project + context.
  // Presentation state only (coordinates + viewport); never graph relationships.
  const [savedLayout, setSavedLayout] = useState<SavedGraphLayout | null>(null);
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutNotice, setLayoutNotice] = useState<
    "saved" | "error" | "reset" | "auto" | "cleared" | null
  >(null);
  // Latest visible node IDs, read by context-scoped layout load without making
  // the load re-run on every filter change (it must only react to context).
  const filteredIdsRef = useRef<string[]>([]);
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
  // Sprint #2 — Focus Mode: an in-page focus that makes the graph the protagonist
  // (covers page chrome, hides helper text, maximizes the canvas). Distinct from
  // the browser fullscreen API above.
  const [focusMode, setFocusMode] = useState(false);
  const [simulation, setSimulation] = useState<LivingGraphSimulationState | null>(null);
  // Timeline playback
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Prune the temporal-proximity edge mesh for readability (toggleable)
  const [simplifyEdges, setSimplifyEdges] = useState(true);

  // ── Subtask visibility (NotebookLM-style progressive expansion) ──────────────
  // Session/client state only — presentation, never canonical. Empty by default
  // so NOTHING is dumped on first load: the user clicks a task to reveal its
  // subtasks. Referencing task ids in local state (not persisted) avoids stale
  // expansion state (allowed by the requirement).
  const [expandedSubtaskParents, setExpandedSubtaskParents] = useState<Set<string>>(
    () => new Set(),
  );
  const subtasksByTask = useMemo(
    () => groupSubtasksByTask(subtasks ?? []),
    [subtasks],
  );

  // ── B3 — Project isolation filter (defense-in-depth) ──────────────────────────
  // The page stamps `requestedProjectId` on the payload and scopes every query
  // by project_id. As defense-in-depth, filter EVERY layer here so a row whose
  // projectId does not match the requested project can NEVER render — even if a
  // payload were ever reused across mounts. The status/requestedProjectId
  // scalars are carried through unchanged. Canonical layers (which the new
  // projection introduces) are filtered strictly; operational layers keep their
  // required `projectId` field too, so the filter is uniform.
  const requestedProjectId = data.requestedProjectId ?? projectId;
  const projectScopedData = useMemo<LivingGraphData>(
    () => scopeLivingGraphDataToProject(data, requestedProjectId),
    [data, requestedProjectId],
  );

  // ── Labor-enriched graph (inject risk nodes + edges, enrich existing nodes) ──
  const laborEnrichedData = useMemo(() => {
    if (!laborCapacity || !laborActivities || !tradeTaxonomy) return projectScopedData;
    let enrichedNodes = enrichExistingNodesWithLaborData(projectScopedData.nodes, laborCapacity);

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
      return { ...projectScopedData, nodes: enrichedNodes };
    }

    const { riskNodes } = mapLaborRisksToGraphNodes(laborCapacity, tradeTaxonomy, (typeof window !== "undefined" ? document.documentElement.lang : "en") as Locale);
    const constraintEdges = mapLaborConstraintsToEdges(
      laborCapacity,
      riskNodes,
      enrichedNodes,
      projectId,
    );

    return {
      ...projectScopedData,
      nodes: [...enrichedNodes, ...riskNodes],
      edges: [...projectScopedData.edges, ...constraintEdges],
    };
  }, [projectScopedData, laborCapacity, laborActivities, tradeTaxonomy, viewLevel, projectId, lookaheadActivities, laborVariance, varianceResult, varianceCauses]);

  // ── Task → capacity-resource map (for the Workforce Intelligence Layer) ──
  const taskResourceKey = useMemo(() => {
    const map = new Map<string, string>();
    if (!resourceCapacity) return map;
    const byTm = new Map<string, string>(); const byUser = new Map<string, string>();
    for (const r of resourceCapacity.resources) {
      if (r.teamMemberId) byTm.set(r.teamMemberId, r.resourceKey);
      if (r.userId) byUser.set(r.userId, r.resourceKey);
    }
    for (const t of tasks) {
      const tmId = (t as { project_team_member_id?: string | null }).project_team_member_id;
      const k =
        (tmId ? byTm.get(tmId) : undefined)
        ?? (t.assigned_to ? byUser.get(t.assigned_to) : undefined);
      if (k) map.set(t.id, k);
    }
    return map;
  }, [resourceCapacity, tasks]);

  // ── Canonical milestone task census (CAP-001 / REG-018) ──
  // Milestone card counts + the UX-008 edge tooltip derive their task set from
  // the canonical owner (roadmap_tasks), NOT from process_nodes — so they match
  // the Workboard ("different views, same truth").
  const milestoneCensus = useMemo(() => computeMilestoneTaskCensus(tasks), [tasks]);

  // ── Canonical-event Relationships view (CAP-045 extension) ───────────────
  // Status contract (Part B): the page ALWAYS sets
  // `canonicalEventProjectionStatus` ("disabled"|"empty"|"ready"|"error"|
  // "truncated"). The events view is active ONLY when the projection is "ready"
  // or "truncated" (canonical events exist to render). Any other state renders
  // an empty events graph + an explicit status banner — NEVER the operational
  // fallback. The canonical flow is a READ-ONLY projection — it never feeds the
  // operational analysis (critical path / bottleneck / cycles …).
  const projectionStatus = data.canonicalEventProjectionStatus;
  const canonicalEvents = useMemo(
    () => projectScopedData.canonicalEvents ?? [],
    [projectScopedData.canonicalEvents],
  );
  const canonicalEventsActive =
    viewLevel === "events" &&
    (projectionStatus === "ready" || projectionStatus === "truncated");
  const taskCases = useMemo(
    () =>
      buildTaskCaseSummaries({
        tasks,
        milestones,
        events: canonicalEvents,
        subtasks,
        attachments: taskAttachments,
      }),
    [tasks, milestones, canonicalEvents, subtasks, taskAttachments],
  );
  const taskProcessModel = useMemo(
    () => buildTaskProcessModel({ tasks, events: canonicalEvents }),
    [tasks, canonicalEvents],
  );
  const selectedVariantStillExists = taskProcessModel.variants.variants.some(
    (variant) => variant.variantId === processVariantId,
  );
  const effectiveProcessVariantId =
    processVariantId === "all" || selectedVariantStillExists
      ? processVariantId!
      : taskProcessModel.variants.variants[0]?.variantId ?? "all";
  const selectedProcessVariant = variantForId(taskProcessModel, effectiveProcessVariantId);
  const taskProcessAggregate = useMemo(
    () =>
      aggregateTaskProcess(taskProcessModel, {
        caseIds: selectedProcessVariant ? new Set(selectedProcessVariant.caseIds) : null,
        activityCoveragePct: activityCoverage,
        connectionCoveragePct: connectionCoverage,
      }),
    [taskProcessModel, selectedProcessVariant, activityCoverage, connectionCoverage],
  );
  const taskProcessDiscovery = useMemo(
    () =>
      assessTaskProcessDiscovery(
        aggregateTaskProcess(taskProcessModel, {
          caseIds: selectedProcessVariant ? new Set(selectedProcessVariant.caseIds) : null,
          activityCoveragePct: 100,
          connectionCoveragePct: 100,
        }),
      ),
    [taskProcessModel, selectedProcessVariant],
  );
  const caseExplorerActive = canonicalEventsActive && eventExperience === "cases";
  const processExplorerActive = canonicalEventsActive && eventExperience === "process";
  const canonicalAuditActive = canonicalEventsActive && eventExperience === "audit";

  const suggestedPlannedMilestoneId = useMemo(() => {
    const orderedMilestones = [...milestones].sort(
      (left, right) => left.order_index - right.order_index,
    );
    const firstIncomplete = orderedMilestones.find((milestone) =>
      tasks.some(
        (task) =>
          task.milestone_id === milestone.id && !isCompletedStatus(task.status),
      ),
    );
    return firstIncomplete?.id ?? orderedMilestones[orderedMilestones.length - 1]?.id ?? null;
  }, [milestones, tasks]);

  const openPlannedFlow = useCallback(() => {
    setViewLevel("activities");
    setLayoutMode("timeline");
    setMilestoneFocus(
      suggestedPlannedMilestoneId
        ? new Set([suggestedPlannedMilestoneId])
        : null,
    );
    setMilestonePicks([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setBetweenMode(false);
    setBetweenEndpoints([]);
    setBetweenResult(null);
  }, [setLayoutMode, setViewLevel, suggestedPlannedMilestoneId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const taskId = new URLSearchParams(window.location.search).get("task");
    if (!taskId || !tasks.some((task) => task.id === taskId)) return;
    const timeoutId = window.setTimeout(() => {
      setViewLevel("events");
      setEventExperience("cases");
      setSelectedTaskCaseId(taskId);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [tasks, setViewLevel, setEventExperience]);

  // ── Derived graph (aggregate → prune → analysis → filter → layout) ──
  // Part B — the "events" view level NEVER falls back to operational
  // process_nodes/process_edges. When the canonical-event projection is not
  // active (flag OFF / empty / error), the events view renders an EMPTY graph
  // + a status banner below — NOT the operational node dump. The rfNodes/
  // rfEdges memos short-circuit on `canonicalEventsActive` and otherwise
  // consume this `displayGraph`, so an empty displayGraph means no operational
  // nodes ever render under "events".
  const displayGraph = useMemo(() => {
    if (viewLevel === "milestones") {
      return aggregateByMilestone(laborEnrichedData.nodes, laborEnrichedData.edges, milestoneCensus);
    }
    if (viewLevel === "events" && !canonicalEventsActive) {
      return { nodes: [], edges: [] };
    }
    const graph =
      viewLevel === "activities"
        ? clusterByEntity(laborEnrichedData.nodes, laborEnrichedData.edges)
        : { nodes: laborEnrichedData.nodes, edges: laborEnrichedData.edges };
    return simplifyEdges
      ? { nodes: graph.nodes, edges: pruneEdgesForClarity(graph.edges) }
      : graph;
  }, [viewLevel, laborEnrichedData, simplifyEdges, milestoneCensus, canonicalEventsActive]);

  const canonicalFlow = useMemo(
    () =>
      canonicalAuditActive
        ? buildCanonicalFlow(
            canonicalEvents,
            projectScopedData.eventRelationships ?? [],
            selectedNodeId,
          )
        : null,
    [canonicalAuditActive, canonicalEvents, projectScopedData.eventRelationships, selectedNodeId],
  );
  const taskProcessFlow = useMemo(
    () =>
      processExplorerActive
        ? buildTaskProcessFlow(taskProcessAggregate, selectedNodeId, selectedEdgeId, locale)
        : null,
    [processExplorerActive, taskProcessAggregate, selectedNodeId, selectedEdgeId, locale],
  );

  // ── Workforce overlay: enrich the DISPLAYED nodes (milestone cards + tasks)
  //    with capacity status so at-risk work lights up. No resource nodes are
  //    injected into the flow — the per-person roster lives in a side panel,
  //    which works on the readable Milestones view without any drill-down.
  const workforceActive = overlay === "workforceCapacity" && !!resourceCapacity?.hasResources;
  const overlayNodes = useMemo(() => {
    if (!workforceActive || !resourceCapacity) return displayGraph.nodes;
    return enrichNodesWithWorkforce(displayGraph.nodes, resourceCapacity, taskResourceKey);
  }, [workforceActive, resourceCapacity, displayGraph.nodes, taskResourceKey]);

  // Curated Workforce view (Activities/Events): show ONLY the people + their
  // assigned tasks, connected by status-colored edges. Idle people appear as
  // standalone "100% available" cards. This declutters the flat node dump.
  const workforceGraph = useMemo(() => {
    if (!workforceActive || !resourceCapacity || viewLevel === "milestones") return null;
    const resourceNodes = mapWorkforceResourceNodes(resourceCapacity, locale);
    const assignedTasks = overlayNodes.filter(
      (n) => n.sourceEntityType === "roadmap_tasks" && taskResourceKey.has(n.sourceEntityId),
    );
    const edges = mapWorkforceAssignmentEdges(resourceNodes, assignedTasks, taskResourceKey, resourceCapacity, projectId);
    return { nodes: [...assignedTasks, ...resourceNodes], edges };
  }, [workforceActive, resourceCapacity, viewLevel, overlayNodes, taskResourceKey, projectId, locale]);

  const baseNodes = workforceGraph ? workforceGraph.nodes : overlayNodes;
  const baseEdges = workforceGraph ? workforceGraph.edges : displayGraph.edges;

  const analysis = useMemo(
    () => analyzeGraph(displayGraph.nodes, displayGraph.edges),
    [displayGraph],
  );

  // Sprint #3 — deterministic clarity signals for the active advanced overlay
  // (how many relevant items exist, and how many are disconnected). Drives the
  // empty / incomplete / ready state of the overlay clarity card. No invented data.
  const overlaySignals = useMemo<OverlaySignals>(() => {
    const nodes = [...analysis.adjacency.nodeById.values()];
    const degree = (id: string) =>
      (analysis.adjacency.out.get(id)?.length ?? 0) + (analysis.adjacency.inc.get(id)?.length ?? 0);
    switch (overlay) {
      case "risk": {
        const riskNodes = nodes.filter((n) => n.nodeType === "risk_event");
        const riskyWork = nodes.filter((n) => n.riskLevel === "high" || n.riskLevel === "medium");
        const disconnected = riskNodes.filter((n) => degree(n.id) === 0).length;
        return { totalCount: riskNodes.length + riskyWork.length, disconnectedCount: disconnected };
      }
      case "sopCandidate": {
        let total = 0;
        for (const m of analysis.metrics.values()) if (m.sopCandidateScore >= 0.6) total++;
        return { totalCount: total, disconnectedCount: 0 };
      }
      case "variance":
        return {
          totalCount: nodes.filter((n) => n.metadata?.variance != null).length,
          disconnectedCount: 0,
        };
      case "timeline": {
        // Real history = events spread across ≥2 distinct days. A single-day
        // (one-shot import) project has no evolution to replay → empty state.
        const distinctDays = countDistinctEventDays(projectScopedData.events.map((e) => e.occurredAt));
        return { totalCount: distinctDays >= 2 ? projectScopedData.events.length : 0, disconnectedCount: 0 };
      }
      case "simulation":
        return { totalCount: simulation ? 1 : 0, disconnectedCount: 0 };
      default:
        return { totalCount: 1, disconnectedCount: 0 };
    }
  }, [overlay, analysis, projectScopedData.events, simulation]);

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
    const nodes = baseNodes.filter((n) => {
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
      // The curated Workforce view manages its own node set — skip milestone focus.
      if (
        !workforceGraph &&
        milestoneFocus &&
        viewLevel !== "milestones" &&
        (!n.milestoneId || !milestoneFocus.has(n.milestoneId))
      ) {
        return false;
      }
      return true;
    });
    const idSet = new Set(nodes.map((n) => n.id));
    const edges = baseEdges.filter(
      (e) =>
        (workforceGraph || edgeTypeFilter.has(e.edgeType)) &&
        idSet.has(e.sourceNodeId) &&
        idSet.has(e.targetNodeId),
    );
    return { nodes, edges };
  }, [
    baseNodes,
    baseEdges,
    workforceGraph,
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

  // ── Subtask layer (NotebookLM progressive expansion) ────────────────────────
  // Append synthetic subtask nodes + `subtask_of` hierarchy edges for EXPANDED
  // task nodes that are currently visible. Nothing is added when no parent is
  // expanded (clean collapsed default). Applied AFTER filtering so subtasks
  // inherit their parent's visibility; it never mutates canonical data.
  const withSubtasks = useMemo(() => {
    if (subtasksByTask.size === 0) return filtered;
    return appendSubtaskGraphLayer(filtered, {
      projectId,
      subtasksByTask,
      expandedTaskIds: expandedSubtaskParents,
      generatedAt: data.generatedAt,
    });
  }, [filtered, subtasksByTask, expandedSubtaskParents, projectId, data.generatedAt]);

  // Tasks the user CAN expand right now — scoped to the visible graph (the
  // milestone/phase drilled into). Expand all never touches other milestones'
  // tasks (requirements #3/#5/#6). `filtered.nodes` already respects the
  // milestone focus + filters, so scoping to it is scoping to the current view.
  const visibleTaskIdsWithSubtasks = useMemo(
    () => scopedExpandableTaskIds(filtered.nodes, subtasksByTask),
    [filtered.nodes, subtasksByTask],
  );

  const toggleSubtaskParent = useCallback((taskId: string) => {
    setExpandedSubtaskParents((prev) => toggleSubtaskExpansion(prev, taskId));
  }, []);
  const handleExpandAllSubtasks = useCallback(() => {
    // Expand ONLY the currently-visible tasks (current scope), then auto
    // fit-to-view so the newly revealed subtasks are all framed (#14).
    setExpandedSubtaskParents((prev) => {
      const next = new Set(prev);
      for (const id of visibleTaskIdsWithSubtasks) next.add(id);
      return next;
    });
    window.setTimeout(() => void fitView({ padding: 0.15, duration: 300 }), 80);
  }, [visibleTaskIdsWithSubtasks, fitView]);
  const handleCollapseAllSubtasks = useCallback(() => {
    // Clean default view: nothing expanded anywhere, then re-fit (#8/#14).
    setExpandedSubtaskParents(collapseAllSubtaskParents());
    window.setTimeout(() => void fitView({ padding: 0.15, duration: 300 }), 80);
  }, [fitView]);

  // LIVING-GRAPH-MILESTONE-FOCUS-LAYOUT-READABILITY — when exactly ONE milestone
  // is drilled into ("View flow"), use the deterministic compact focus layout
  // (status-grouped, dependency-ordered) instead of the generic auto-layout that
  // scatters tasks. The curated Workforce view manages its own geometry.
  const isMilestoneFocusMode =
    milestoneFocus != null && milestoneFocus.size === 1 && viewLevel !== "milestones" && !workforceGraph;

  // ── Between-analysis mode (CAP-045 §C.2) ───────────────────────────────────
  // Active when the user has toggled between-mode AND picked exactly two
  // endpoints. Separate from milestone-focus (which stays size===1 drill-down).
  // Never active on the curated Workforce view (it manages its own geometry).
  const isBetweenAnalysisMode =
    betweenMode && betweenEndpoints.length === 2 && !workforceGraph;

  // The visible milestone/root node (the hub the tasks radiate from), if present.
  const focusRootNode = useMemo(
    () =>
      isMilestoneFocusMode
        ? withSubtasks.nodes.find((n) => n.sourceEntityType === "milestones" || n.nodeType === "milestone_gate") ?? null
        : null,
    [isMilestoneFocusMode, withSubtasks.nodes],
  );

  // Synthetic PRESENTATION-ONLY hub edges (milestone → each task) so no task
  // floats disconnected from its milestone. Never real dependency evidence.
  const focusHubEdges = useMemo(() => {
    if (!isMilestoneFocusMode || !focusRootNode || !milestoneFocus) return [];
    return buildMilestoneFocusHubEdges({
      rootNodeId: focusRootNode.id,
      nodes: withSubtasks.nodes,
      selectedMilestoneId: [...milestoneFocus][0],
      projectId,
    });
  }, [isMilestoneFocusMode, focusRootNode, milestoneFocus, withSubtasks.nodes, projectId]);

  const layoutPositions = useMemo(() => {
    if (viewLevel === "milestones") {
      return milestoneFlowLayout(withSubtasks.nodes); // serpentine roadmap, layoutMode ignored
    }
    if (isMilestoneFocusMode && milestoneFocus) {
      const selectedMilestoneId = [...milestoneFocus][0];
      return computeMilestoneFocusPositions({
        selectedMilestoneId,
        nodes: withSubtasks.nodes,
        edges: withSubtasks.edges,
        rootNodeId: focusRootNode?.id ?? null,
      });
    }
    return computeLayout(layoutMode, withSubtasks.nodes, withSubtasks.edges);
  }, [viewLevel, layoutMode, withSubtasks, isMilestoneFocusMode, milestoneFocus, focusRootNode]);

  // User drags win over the computed layout. In milestone focus mode the manual
  // positions come from a PER-MILESTONE saved layout (scoped by the focus layout
  // key below), so the global layout never leaks in but drag-to-rearrange still
  // persists — exactly like the rest of the Living Graph.
  const positions = useMemo(() => {
    // Canonical-events view uses its own deterministic layout (project sequence
    // order); saved/manual arrangements belong to the operational contexts.
    if (canonicalAuditActive && canonicalFlow) return canonicalFlow.positions;
    if (manualPositions.size === 0) return layoutPositions;
    const merged = new Map(layoutPositions);
    for (const [id, pos] of manualPositions) {
      if (merged.has(id)) merged.set(id, pos);
    }
    return merged;
  }, [canonicalAuditActive, canonicalFlow, layoutPositions, manualPositions]);

  // ── UX-007 — Saved Layouts ──────────────────────────────────────────────────
  // The context a saved arrangement is scoped to (level + layout mode). Switching
  // context loads ITS saved layout instead of destroying the manual one.
  // In milestone focus mode the saved arrangement is scoped PER MILESTONE (its
  // own key), so dragging persists per focused milestone and the global layout is
  // never applied to — nor overwritten by — the focus map.
  const layoutKey = useMemo(
    () => {
      // Between-analysis: scope the saved arrangement to the pair of endpoints
      // (sorted so START/END share one layout) — never collides with milestones
      // or milestone-focus contexts (UX-007/PD-008 safe).
      if (isBetweenAnalysisMode) {
        return getBetweenAnalysisLayoutKey(
          projectId,
          betweenEndpoints[0].nodeId,
          betweenEndpoints[1].nodeId,
        );
      }
      return isMilestoneFocusMode && milestoneFocus
        ? getMilestoneFocusLayoutKey(projectId, [...milestoneFocus][0])
        : buildLayoutKey(viewLevel, layoutMode);
    },
    [isBetweenAnalysisMode, betweenEndpoints, isMilestoneFocusMode, milestoneFocus, projectId, viewLevel, layoutMode],
  );
  // Keep the live node IDs fresh for the context loader without re-running the
  // context-load on every filter change (refs must not be set during render).
  // Declared before the load effect so the IDs commit first on a context switch.
  useEffect(() => {
    filteredIdsRef.current = withSubtasks.nodes.map((n) => n.id);
  });

  // Load the saved layout for a context: apply saved coordinates to nodes that
  // still exist (new nodes fall through to the auto-layout), or clear to auto.
  const loadContextLayout = useCallback(
    (projectId: string, key: string) => {
      const loaded = loadSavedLayout(projectId, key);
      const liveIds = filteredIdsRef.current;
      // Milestone Focus Map: only restore a saved arrangement that EXACTLY matches
      // the current node set. A stale/partial focus layout would scatter the clean
      // deterministic mind-map (some nodes at old coords, some auto-laid) — so we
      // ignore it and fall back to the mind-map. In-session drags still apply
      // (they are added to manualPositions AFTER this load).
      if (key.startsWith("milestone-focus:") && loaded) {
        const savedIds = Object.keys(loaded.nodes);
        const exact = savedIds.length === liveIds.length && liveIds.every((id) => id in loaded.nodes);
        if (!exact) {
          setSavedLayout(null);
          setManualPositions(new Map());
          setHasUnsavedLayout(false);
          return;
        }
      }
      setSavedLayout(loaded);
      setManualPositions(applySavedPositions(loaded, liveIds).positions);
      setHasUnsavedLayout(false);
    },
    [],
  );

  // Restore on load + whenever the layout context changes (TASK 6). This must run
  // post-commit (not in an event handler) because changing level recomputes the
  // node set, and it must hydrate from localStorage only on the client (SSR-safe,
  // same rationale as useGraphUiPref). Deliberately NOT keyed on filters, so a
  // saved arrangement and unsaved drags survive filtering — only a context switch
  // reloads. The setState here is the intended effect, not a cascading render.
  useEffect(() => {
    loadContextLayout(projectId, layoutKey);
  }, [projectId, layoutKey, loadContextLayout]);

  // Subtle "partially applied" signal when the graph changed since the save
  // (TASK 7): some saved nodes are gone, or some visible nodes are new.
  const layoutPartiallyApplied = useMemo(() => {
    if (!savedLayout) return false;
    // Focus mode uses the deterministic focus layout — the global saved layout is
    // never applied, so the "partially applied" notice must not appear there.
    if (isMilestoneFocusMode) return false;
    return isPartialApply(applySavedPositions(savedLayout, withSubtasks.nodes.map((n) => n.id)));
  }, [savedLayout, withSubtasks.nodes, isMilestoneFocusMode]);

  // Auto-dismiss the transient save/reset/clear notice.
  useEffect(() => {
    if (!layoutNotice) return;
    const id = setTimeout(() => setLayoutNotice(null), 2600);
    return () => clearTimeout(id);
  }, [layoutNotice]);

  // Milestone Focus Map: auto-fit/center after the deterministic layout is placed
  // so the focused milestone appears immediately (no huge empty canvas to pan).
  useEffect(() => {
    if (!isMilestoneFocusMode) return;
    const id = window.setTimeout(() => void fitView({ padding: 0.18, duration: 300 }), 90);
    return () => window.clearTimeout(id);
  }, [isMilestoneFocusMode, layoutPositions, fitView]);

  const handleSaveLayout = useCallback(() => {
    setSavingLayout(true);
    // Capture the current rendered position of every visible node (not just the
    // dragged ones) so the whole arrangement is restored verbatim on reload.
    const nodes: Record<string, SavedNodePosition> = {};
    for (const id of filteredIdsRef.current) {
      const p = positions.get(id);
      if (p) nodes[id] = { x: Math.round(p.x), y: Math.round(p.y) };
    }
    const payload: SavedGraphLayout = {
      version: LAYOUT_SCHEMA_VERSION,
      projectId,
      layoutKey,
      level: viewLevel,
      layoutMode,
      nodes,
      viewport: getViewport(),
      savedAt: new Date().toISOString(),
    };
    const ok = saveLayout(payload);
    setSavingLayout(false);
    if (ok) {
      setSavedLayout(payload);
      setManualPositions(new Map(Object.entries(nodes)));
      setHasUnsavedLayout(false);
      setLayoutNotice("saved");
    } else {
      setLayoutNotice("error");
    }
  }, [positions, projectId, layoutKey, viewLevel, layoutMode, getViewport]);

  const handleResetToSaved = useCallback(() => {
    const loaded = loadSavedLayout(projectId, layoutKey);
    if (!loaded) return;
    setSavedLayout(loaded);
    setManualPositions(applySavedPositions(loaded, filteredIdsRef.current).positions);
    setHasUnsavedLayout(false);
    if (loaded.viewport) void setViewport(loaded.viewport, { duration: 300 });
    else void fitView({ padding: 0.15, duration: 300 });
    setLayoutNotice("reset");
  }, [projectId, layoutKey, setViewport, fitView]);

  const handleResetToAuto = useCallback(() => {
    setManualPositions(new Map());
    // Diverges from the saved layout (if any) until re-saved.
    setHasUnsavedLayout(savedLayout != null);
    void fitView({ padding: 0.15, duration: 300 });
    setLayoutNotice("auto");
  }, [savedLayout, fitView]);

  const handleClearSavedLayout = useCallback(() => {
    clearSavedLayout(projectId, layoutKey);
    setSavedLayout(null);
    setManualPositions(new Map());
    setHasUnsavedLayout(false);
    void fitView({ padding: 0.15, duration: 300 });
    setLayoutNotice("cleared");
  }, [projectId, layoutKey, fitView]);

  // ── Search ──
  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return new Set<string>();
    return new Set(
      withSubtasks.nodes
        .filter(
          (n) =>
            n.label.toLowerCase().includes(q) ||
            n.id.toLowerCase().includes(q) ||
            n.sourceEntityId.toLowerCase().includes(q) ||
            n.sourceEntityType.toLowerCase().includes(q),
        )
        .map((n) => n.id),
    );
  }, [searchQuery, withSubtasks.nodes]);

  // ── Timeline playback ──
  const timelineActive = overlay === "timeline";
  const currentEvent = playbackIndex >= 0 ? projectScopedData.events[playbackIndex] : null;
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
  }, [setOverlay]);

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

  // ── Between-analysis highlight sets (CAP-045 §C.2 / Part C) ───────────────
  // Read-only visual signals derived from `betweenResult`. Presentation only —
  // they never feed operational analyses.
  const betweenPathNodeIds = useMemo(
    () => new Set((betweenResult?.operationalPath ?? []).map((p) => p.nodeId)),
    [betweenResult],
  );
  const betweenEventIds = useMemo(
    () => new Set(betweenResult?.canonicalEventIds ?? []),
    [betweenResult],
  );
  const betweenStartNodeId = betweenResult?.startEndpoint.nodeId ?? null;
  const betweenEndNodeId = betweenResult?.endEndpoint.nodeId ?? null;

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
    if (processExplorerActive && taskProcessFlow) {
      return taskProcessFlow.nodes as unknown as LivingFlowNode[];
    }
    // Canonical-events view: render the projected event/object nodes. The
    // operational node-mapping path below is skipped entirely, so it never
    // sees (and never mutates) canonical data.
    if (canonicalAuditActive && canonicalFlow) {
      return canonicalFlow.nodes.map((n) => {
        const isEventMember =
          n.id.startsWith("ev:") && betweenEventIds.has(n.id.slice(3));
        const isStart = n.id === betweenStartNodeId;
        const isEnd = n.id === betweenEndNodeId;
        return {
          ...n,
          position: canonicalFlow.positions.get(n.id) ?? { x: 0, y: 0 },
          data: {
            ...n.data,
            ...(isEventMember ? { isBetweenEventMember: true } : {}),
            ...(isStart ? { isBetweenStart: true } : {}),
            ...(isEnd ? { isBetweenEnd: true } : {}),
          },
        };
      }) as unknown as LivingFlowNode[];
    }
    const total = withSubtasks.nodes.length;
    return withSubtasks.nodes.map((node, index) => {
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
          // Between-analysis highlighting (read-only presentation signals).
          isBetweenStart: node.id === betweenStartNodeId || undefined,
          isBetweenEnd: node.id === betweenEndNodeId || undefined,
          isBetweenPathMember: betweenPathNodeIds.has(node.id) || undefined,
          // Only task nodes that actually have subtasks get the toggle affordance.
          onToggleSubtasks:
            node.sourceEntityType === "roadmap_tasks" &&
            node.nodeType !== "subtask_item" &&
            subtasksByTask.has(node.sourceEntityId)
              ? toggleSubtaskParent
              : undefined,
        },
      };
    });
  }, [
    processExplorerActive,
    taskProcessFlow,
    canonicalAuditActive,
    canonicalFlow,
    withSubtasks.nodes,
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
    subtasksByTask,
    toggleSubtaskParent,
    betweenEventIds,
    betweenStartNodeId,
    betweenEndNodeId,
    betweenPathNodeIds,
  ]);

  // Drill-down: show only the picked milestones' activities. Flow the tasks
  // LEFT-TO-RIGHT (timeline mode) so a milestone's execution reads horizontally,
  // consistent with the Subtask Map's left-to-right expansion. The layout-key
  // effect then loads THIS context's saved arrangement (or the auto-layout).
  const handleDrillIntoPicks = useCallback(() => {
    if (milestonePicks.length === 0) return;
    setMilestoneFocus(new Set(milestonePicks));
    setMilestonePicks([]);
    // Manual positions are reloaded for the new context by the layout-key effect.
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setLayoutMode("timeline");
    setViewLevel("activities");
  }, [milestonePicks, setLayoutMode, setViewLevel]);

  // ── Between-analysis helpers (CAP-045 §C.2) ────────────────────────────────
  // Map any rendered node (operational milestone/task/process node OR canonical
  // event `ev:<id>`) to a BetweenEndpoint the pure motor understands.
  const nodeToBetweenEndpoint = useCallback(
    (nodeId: string): BetweenEndpoint | null => {
      // Canonical-event node id: `ev:<eventId>`.
      if (nodeId.startsWith("ev:")) {
        const eventId = nodeId.slice(3);
        const ev = canonicalEvents.find((e) => e.eventId === eventId);
        return {
          nodeId,
          label: ev?.eventType ?? eventId,
          kind: "canonical_event",
          eventId,
          sourceEntityId: ev?.sourceEntityId ?? null,
        };
      }
      const node = withSubtasks.nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      const kind: BetweenEndpoint["kind"] =
        node.sourceEntityType === "milestones" || node.nodeType === "milestone_gate"
          ? "milestone"
          : node.sourceEntityType === "roadmap_tasks"
            ? "task"
            : "process_node";
      return {
        nodeId,
        label: node.milestoneLabel ?? node.label,
        kind,
        sourceEntityId: node.sourceEntityId,
      };
    },
    [canonicalEvents, withSubtasks.nodes],
  );

  // Run the pure analysis for the current pair of endpoints (or an explicit
  // pair passed in — used by the two-milestone "Analyze what happened" button).
  const selectedBetweenInput = useMemo<BetweenAnalysisInput | null>(
    () =>
      betweenEndpoints.length === 2
        ? {
            requestedProjectId,
            startEndpoint: betweenEndpoints[0],
            endEndpoint: betweenEndpoints[1],
            nodes: projectScopedData.nodes,
            edges: projectScopedData.edges,
            canonicalEvents,
            eventRelationships: projectScopedData.eventRelationships ?? [],
          }
        : null,
    [
      betweenEndpoints,
      requestedProjectId,
      projectScopedData.nodes,
      projectScopedData.edges,
      projectScopedData.eventRelationships,
      canonicalEvents,
    ],
  );
  const betweenPreflight = useMemo<BetweenAnalysisPreflight | null>(
    () => (selectedBetweenInput ? assessBetweenAnalysis(selectedBetweenInput) : null),
    [selectedBetweenInput],
  );

  const runBetweenAnalysis = useCallback(
    (endpoints: BetweenEndpoint[]) => {
      if (endpoints.length !== 2) {
        setBetweenResult(null);
        return;
      }
      const input: BetweenAnalysisInput = {
        requestedProjectId,
        startEndpoint: endpoints[0],
        endEndpoint: endpoints[1],
        nodes: projectScopedData.nodes,
        edges: projectScopedData.edges,
        canonicalEvents,
        eventRelationships: projectScopedData.eventRelationships ?? [],
      };
      const preflight = assessBetweenAnalysis(input);
      setBetweenResult(preflight.canAnalyze ? analyzeBetween(input) : null);
    },
    [requestedProjectId, projectScopedData.nodes, projectScopedData.edges, canonicalEvents, projectScopedData.eventRelationships],
  );

  // Two-milestone pick → "Analyze what happened" (keeps the picked milestones as
  // the endpoints). Independent of "View flow" (drill-down), which stays separate
  // and does NOT auto-run.
  const handleAnalyzeBetweenMilestones = useCallback(() => {
    if (milestonePicks.length !== 2) return;
    const endpoints: BetweenEndpoint[] = [];
    for (const milestoneId of milestonePicks) {
      const node =
        displayGraph.nodes.find((n) => n.milestoneId === milestoneId) ??
        withSubtasks.nodes.find((n) => n.milestoneId === milestoneId);
      if (!node) continue;
      endpoints.push({
        nodeId: node.id,
        label: node.milestoneLabel ?? node.label,
        kind: "milestone",
        sourceEntityId: node.sourceEntityId,
      });
    }
    if (endpoints.length !== 2) return;
    setBetweenEndpoints(endpoints);
    setBetweenMode(true);
    setMilestonePicks([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    runBetweenAnalysis(endpoints);
  }, [milestonePicks, displayGraph.nodes, withSubtasks.nodes, runBetweenAnalysis]);

  const handleClearBetween = useCallback(() => {
    setBetweenMode(false);
    setBetweenEndpoints([]);
    setBetweenResult(null);
  }, []);

  const handleSwapBetween = useCallback(() => {
    setBetweenEndpoints((prev) => {
      if (prev.length !== 2) return prev;
      const swapped = [prev[1], prev[0]];
      // Re-run on the swapped pair so the panel reflects the new direction.
      queueMicrotask(() => runBetweenAnalysis(swapped));
      return swapped;
    });
  }, [runBetweenAnalysis]);

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
    if (processExplorerActive && taskProcessFlow) {
      return taskProcessFlow.edges as unknown as LivingFlowEdge[];
    }
    // Canonical-events view: render the projected relationship edges (dashed
    // temporal / solid causal / dotted compensation / thin object-ref). The
    // operational edge-mapping path below is skipped entirely.
    if (canonicalAuditActive && canonicalFlow) {
      return canonicalFlow.edges as unknown as LivingFlowEdge[];
    }
    // In milestone focus mode, add synthetic hub edges (milestone → each task) so
    // no task floats disconnected. They render like normal edges but are marked
    // presentation-only and never drive dependency logic.
    const sourceEdges = focusHubEdges.length > 0 ? [...withSubtasks.edges, ...focusHubEdges] : withSubtasks.edges;
    const edges: LivingFlowEdge[] = sourceEdges.map((edge) => {
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

    // Part C — the synthetic `__pick-link` edge between two picked milestones is
    // GONE. Picking two milestones now offers "Analyze what happened" (Between
    // Analysis) alongside "View flow" (drill-down) — see the two-milestone banner.
    return edges;
  }, [
    processExplorerActive,
    taskProcessFlow,
    canonicalAuditActive,
    canonicalFlow,
    withSubtasks.edges,
    focusHubEdges,
    analysis,
    overlay,
    dimmedNodeIds,
    selectedEdgeId,
    pathEdgeIds,
    timelineActive,
    currentTime,
  ]);

  // ── Selection helpers ──
  const selectedNode = useMemo(
    () =>
      selectedNodeId
        ? (analysis.adjacency.nodeById.get(selectedNodeId) ??
          // Synthetic subtask nodes live outside the analysis graph.
          withSubtasks.nodes.find((n) => n.id === selectedNodeId) ??
          null)
        : null,
    [selectedNodeId, analysis, withSubtasks.nodes],
  );
  const selectedEdge = useMemo(
    () =>
      selectedEdgeId
        ? (displayGraph.edges.find((e) => e.id === selectedEdgeId) ?? null)
        : null,
    [selectedEdgeId, displayGraph.edges],
  );

  // Selected canonical event (events view). The selectedNodeId is the flow node
  // id `ev:<eventId>`; map it back to the canonical event view-model.
  const selectedCanonicalEvent = useMemo(() => {
    if (!canonicalEventsActive || !selectedNodeId) return null;
    const eventId = selectedNodeId.startsWith("ev:")
      ? selectedNodeId.slice(3)
      : null;
    if (!eventId) return null;
    return canonicalEvents.find((e) => e.eventId === eventId) ?? null;
  }, [canonicalEventsActive, selectedNodeId, canonicalEvents]);
  const selectedProcessActivity = processExplorerActive
    ? taskProcessAggregate.activities.find((activity) => activity.id === selectedNodeId) ?? null
    : null;
  const selectedProcessTransition = processExplorerActive
    ? taskProcessAggregate.transitions.find((transition) => transition.id === selectedEdgeId) ?? null
    : null;

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
      if ((node.type as string) === "processActivity") {
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
        return;
      }
      // ── Between-analysis mode: pick endpoints (max 2, toggle off if
      //    re-picked) for ALL node types, including canonical events. This is
      //    the ONLY path that lets canonical-event nodes participate in an
      //    analysis (otherwise they stay selection-only — the events view is
      //    read-only). Endpoint picking does NOT mutate the graph.
      if (betweenMode) {
        const ep = nodeToBetweenEndpoint(node.id);
        if (ep) {
          setBetweenEndpoints((prev) => {
            if (prev.some((p) => p.nodeId === ep.nodeId)) {
              return prev.filter((p) => p.nodeId !== ep.nodeId);
            }
            const next = [...prev.slice(-1), ep];
            if (next.length === 2) {
              // Auto-run as soon as the second endpoint is picked.
              queueMicrotask(() => runBetweenAnalysis(next));
            }
            return next;
          });
        }
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
        return;
      }
      // Canonical-event/object nodes: selection only — no milestone pick, no
      // path mode, no in-graph editing (the events view is read-only).
      if ((node.type as string) === "canonicalEvent" || (node.type as string) === "canonicalObject") {
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
        return;
      }
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
    [betweenMode, nodeToBetweenEndpoint, runBetweenAnalysis, pathModeFromId, resolvePath, viewLevel],
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
    let moved = false;
    setManualPositions((prev) => {
      let next: Map<string, { x: number; y: number }> | null = null;
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          if (!next) next = new Map(prev);
          next.set(change.id, change.position);
          moved = true;
        }
      }
      return next ?? prev;
    });
    // UX-007 — surface an unsaved-layout indicator after a manual move.
    if (moved) setHasUnsavedLayout(true);
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
    (_event, node) => {
      // Canonical nodes are read-only — double-click does not open an editor.
      if (
        (node.type as string) === "canonicalEvent" ||
        (node.type as string) === "canonicalObject" ||
        (node.type as string) === "processActivity"
      ) return;
      handleEditNode(node.data.node);
    },
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

  // Re-fit after layout or filter structure changes. UX-007: when a saved layout
  // for this context carries a viewport and the user is not in a focus/drill
  // subset, restore that viewport instead of fitting (TASK 6).
  useEffect(() => {
    if (caseExplorerActive) return;
    const id = setTimeout(() => {
      const saved = loadSavedLayout(projectId, layoutKey);
      if (
        !processExplorerActive &&
        !canonicalAuditActive &&
        saved?.viewport &&
        !focusIds &&
        !milestoneFocus
      ) {
        void setViewport(saved.viewport, { duration: 300 });
      } else {
        void fitView({ padding: 0.15, duration: 300 });
      }
    }, 80);
    return () => clearTimeout(id);
  }, [
    layoutMode,
    viewLevel,
    eventExperience,
    effectiveProcessVariantId,
    activityCoverage,
    connectionCoverage,
    caseExplorerActive,
    processExplorerActive,
    canonicalAuditActive,
    focusIds,
    milestoneFocus,
    fitView,
    setViewport,
    projectId,
    layoutKey,
  ]);

  const showPanel =
    selectedNode != null || selectedEdge != null || selectedCanonicalEvent != null;

  // Progressive disclosure: never dump the full flat activity/event graph. When
  // there are many nodes and no phase is focused, guide the user to drill into
  // one milestone (one layer at a time → narrowing to detail). The curated
  // Workforce view manages its own density, so it's exempt.
  const tooManyOperationalNodes =
    viewLevel === "activities" &&
    !milestoneFocus &&
    !workforceGraph &&
    filtered.nodes.length > 24;
  const tooManyAuditEvents = canonicalAuditActive && canonicalEvents.length > 24;

  // Executive Insights are scoped to what's currently visible (level + phase
  // focus + filters + overlay). Drill into a phase → the KPIs reflect that phase.
  const scopedInsights = useMemo(() => {
    const msIds = new Set<string>();
    const taskIds = new Set<string>();
    for (const n of filtered.nodes) {
      if (n.milestoneId) msIds.add(n.milestoneId);
      if (n.sourceEntityType === "roadmap_tasks" && !n.id.startsWith("workforce:")) {
        taskIds.add(n.sourceEntityId);
      }
    }
    const isMs = viewLevel === "milestones";
    let sMilestones = msIds.size ? milestones.filter((m) => msIds.has(m.id)) : milestones;
    let sTasks = isMs
      ? (msIds.size ? tasks.filter((t) => t.milestone_id != null && msIds.has(t.milestone_id)) : tasks)
      : (taskIds.size ? tasks.filter((t) => taskIds.has(t.id)) : tasks);
    if (sTasks.length === 0 && sMilestones.length === 0) { sMilestones = milestones; sTasks = tasks; }
    const scoped = sTasks.length < tasks.length || sMilestones.length < milestones.length;
    return { milestones: sMilestones, tasks: sTasks, scoped };
  }, [filtered.nodes, viewLevel, milestones, tasks]);

  return (
    <div
      ref={containerRef}
      className={
        focusMode
          ? "fixed inset-0 z-40 flex flex-col gap-2 bg-background p-3"
          : "flex h-[calc(100vh-120px)] min-h-[680px] flex-col gap-2 rounded-lg bg-background"
      }
    >
      {/* Executive KPIs + summary now live in a floating "Insights" panel ON the
          canvas (see below) so the Living Graph owns the full viewport height. */}

      <LivingGraphToolbar
        overlay={overlay}
        onOverlayChange={handleOverlayChange}
        layoutMode={layoutMode}
        onLayoutModeChange={(mode) => {
          // Each layout mode keeps its OWN saved arrangement (UX-007): the
          // layout-key effect loads it (or falls back to the auto layout).
          setLayoutMode(mode);
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
          // The layout-key effect loads this level's saved arrangement (or auto).
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
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((v) => !v)}
        onResetFilters={handleResetFilters}
        activeFilterCount={countActiveGraphFilters({
          statusFilter,
          riskFilter,
          blockedOnly,
          criticalOnly,
          dateFrom,
          dateTo,
          nodeTypeFilter,
          edgeTypeFilter,
          totalNodeTypes: ALL_NODE_TYPES.length,
          totalEdgeTypes: ALL_EDGE_TYPES.length,
        })}
        summary={analysis.summary}
        largeGraphWarning={
          canonicalAuditActive
            ? canonicalEvents.length > LARGE_GRAPH_THRESHOLD
            : viewLevel !== "events" && filtered.nodes.length > LARGE_GRAPH_THRESHOLD && focusIds == null
        }
      />

      {canonicalEventsActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/70 px-2.5 py-2" role="navigation" aria-label={locale === "es" ? "Lectura de eventos" : "Event reading mode"}>
          <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-border bg-background p-0.5">
            {([
              { id: "cases" as const, icon: ListChecks, en: "Task cases", es: "Casos de tarea", count: taskCases.length },
              { id: "process" as const, icon: GitFork, en: "Observed process", es: "Proceso observado", count: taskProcessModel.variants.variants.length },
              { id: "audit" as const, icon: ScrollText, en: "Full audit", es: "Auditoría", count: canonicalEvents.length },
            ]).map((item) => {
              const Icon = item.icon;
              const active = eventExperience === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEventExperience(item.id);
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                    setBetweenMode(false);
                    setBetweenEndpoints([]);
                    setBetweenResult(null);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${active ? "bg-brand-600 text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {locale === "es" ? item.es : item.en}
                  <span className={`rounded px-1 text-[9px] ${active ? "bg-white/20" : "bg-muted"}`}>{item.count}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={openPlannedFlow}
            className="inline-flex items-center gap-1.5 rounded-md border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-500/20 dark:text-brand-300"
          >
            <Workflow className="h-3.5 w-3.5" aria-hidden />
            {locale === "es" ? "Flujo planificado" : "Planned flow"}
          </button>
          <p className="text-[10px] text-muted-foreground">
            {eventExperience === "cases"
              ? (locale === "es" ? "Proyecto › fase › tarea › evento/evidencia" : "Project › phase › task › event/evidence")
              : eventExperience === "process"
                ? (locale === "es" ? "Orden observado entre actividades; no son dependencias planificadas" : "Observed activity order; not planned dependencies")
                : (locale === "es" ? "Registro canónico completo para auditoría avanzada" : "Complete canonical ledger for advanced audit")}
          </p>
        </div>
      )}

      {/* Progressive disclosure: too many nodes → drill into a phase (layers) */}
      {tooManyOperationalNodes && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <span>
            {locale === "es"
              ? `Demasiadas tareas (${filtered.nodes.length}) para leerlas todas. Entra a una fase:`
              : `Too many tasks (${filtered.nodes.length}) to read at once. Drill into a phase:`}
          </span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                setMilestoneFocus(new Set([e.target.value]));
                // Same context — re-apply its saved arrangement to the focused
                // subset (new nodes auto-place); never destroy a saved layout.
                loadContextLayout(projectId, layoutKey);
              }
            }}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">{locale === "es" ? "Elegir fase…" : "Choose a phase…"}</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setViewLevel("milestones")}
            className="rounded-md border border-amber-500/40 px-2 py-1 font-medium hover:bg-amber-500/10"
          >
            {locale === "es" ? "Volver a Milestones" : "Back to Milestones"}
          </button>
        </div>
      )}
      {tooManyAuditEvents && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <span>
            {locale === "es"
              ? `${canonicalEvents.length} eventos no son legibles como un mapa de auditoría completo. Reduce el alcance:`
              : `${canonicalEvents.length} events are not readable as one raw audit map. Narrow the scope:`}
          </span>
          <button
            type="button"
            onClick={() => setEventExperience("cases")}
            className="rounded-md border border-amber-500/40 px-2 py-1 font-medium hover:bg-amber-500/10"
          >
            {locale === "es" ? "Casos de tarea" : "Task cases"}
          </button>
          <button
            type="button"
            onClick={() => setEventExperience("process")}
            className="rounded-md border border-amber-500/40 px-2 py-1 font-medium hover:bg-amber-500/10"
          >
            {locale === "es" ? "Proceso agregado" : "Aggregate process"}
          </button>
        </div>
      )}

      {/* Subtask visibility controls (NotebookLM-style). Shown only where task
          nodes exist (activities/events level) and a VISIBLE task has subtasks.
          The graph starts collapsed; Expand all is an explicit user action and
          is SCOPED to the current view (the drilled-into milestone) — it never
          reveals other milestones' tasks. */}
      {viewLevel === "activities" && visibleTaskIdsWithSubtasks.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-1.5 text-xs text-violet-700 dark:text-violet-300"
          data-testid="graph-subtask-controls"
        >
          <span className="inline-flex items-center gap-1 font-medium">
            <ListTree className="h-3.5 w-3.5" aria-hidden />
            {t("subtasks.controlLabel", { count: visibleTaskIdsWithSubtasks.length })}
          </span>
          <span className="text-muted-foreground">
            {t("subtasks.expandedCount", { count: expandedSubtaskParents.size })}
          </span>
          <button
            type="button"
            onClick={handleExpandAllSubtasks}
            disabled={visibleTaskIdsWithSubtasks.every((id) => expandedSubtaskParents.has(id))}
            className="rounded-md border border-violet-500/40 px-2 py-1 font-medium transition-colors hover:bg-violet-500/10 disabled:opacity-40"
            data-testid="graph-subtask-expand-all"
          >
            {t("subtasks.expandAll")}
          </button>
          <button
            type="button"
            onClick={handleCollapseAllSubtasks}
            disabled={expandedSubtaskParents.size === 0}
            className="rounded-md border border-violet-500/40 px-2 py-1 font-medium transition-colors hover:bg-violet-500/10 disabled:opacity-40"
            data-testid="graph-subtask-collapse-all"
          >
            {t("subtasks.collapseAll")}
          </button>
        </div>
      )}

      {/* Status hints (hidden in Focus Mode to maximize the canvas) */}
      {!focusMode && isMilestoneLevel && milestonePicks.length === 0 && !betweenMode && (
        <p className="text-[11px] text-muted-foreground">{t("drill.hint")}</p>
      )}
      {/* Between-analysis toggle (CAP-045 §C.2). Available across all view
          levels except the curated Workforce view. When ON, the next two node
          clicks become the analysis endpoints. */}
      {!workforceActive && !betweenMode && !isMilestoneFocusMode && (viewLevel !== "events" || canonicalAuditActive) && (
        <button
          type="button"
          onClick={() => {
            setBetweenMode(true);
            setBetweenEndpoints([]);
            setBetweenResult(null);
            setMilestonePicks([]);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-[11px] font-medium text-brand-600 transition-colors hover:bg-brand-500/20 dark:text-brand-400"
        >
          <Route className="h-3.5 w-3.5" aria-hidden />
          {t("between.toggle")}
        </button>
      )}
      {betweenMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5">
          <span className="text-xs text-brand-600 dark:text-brand-400">
            {betweenEndpoints.length === 2
              ? t("between.selected", {
                  names: betweenEndpoints.map((e) => e.label).join(" + "),
                })
              : t("between.pickHint")}
          </span>
          <div className="flex items-center gap-1.5">
            {betweenEndpoints.length === 2 && (
              <button
                type="button"
                onClick={() => runBetweenAnalysis(betweenEndpoints)}
                disabled={betweenPreflight?.canAnalyze === false}
                className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("between.analyze")}
              </button>
            )}
            <button
              type="button"
              onClick={handleClearBetween}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {t("between.clear")}
            </button>
          </div>
        </div>
      )}
      {betweenMode &&
        betweenEndpoints.length === 2 &&
        betweenPreflight &&
        (!betweenPreflight.canAnalyze || betweenPreflight.warnings.length > 0) && (
          <div
            role={betweenPreflight.canAnalyze ? "status" : "alert"}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] ${
              betweenPreflight.canAnalyze
                ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                : "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300"
            }`}
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <div>
              {!betweenPreflight.canAnalyze ? (
                <>
                  <p className="font-semibold">
                    {locale === "es"
                      ? "Esta comparación no produciría una lectura verificable."
                      : "This comparison would not produce a verifiable reading."}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {betweenPreflight.blockingReasons.map((reason) => (
                      <li key={reason}>{betweenPreflightReason(reason, locale)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  {locale === "es"
                    ? "Hay historial canónico para comparar, pero no existe una ruta operativa registrada entre estos puntos. La secuencia temporal no implica causalidad."
                    : "Canonical history is available, but no operational path is recorded between these endpoints. Temporal sequence does not imply causality."}
                </p>
              )}
            </div>
          </div>
        )}
      {/* Sprint #2 — overlay discoverability: the people + assignment-edges view
          renders in the Activities level (not the default Milestones level). */}
      {workforceActive && viewLevel === "milestones" && (
        <p role="status" className="flex items-center gap-1.5 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs text-brand-600 dark:text-brand-400">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {locale === "es"
            ? "Cambia a la vista \"Actividades\" para ver a las personas y sus asignaciones."
            : "Switch to the \"Activities\" view to see people and their assignments."}
        </p>
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
          <div className="flex items-center gap-1.5">
            {milestonePicks.length === 2 && (
              <button
                type="button"
                onClick={handleAnalyzeBetweenMilestones}
                className="rounded-md border border-brand-500/50 px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/20 dark:text-brand-400"
              >
                {t("between.analyze")}
              </button>
            )}
            <button
              type="button"
              onClick={handleDrillIntoPicks}
              className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700"
            >
              {t("drill.viewFlow")}
            </button>
          </div>
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
        className={`relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card/30 ${processExplorerActive ? "flex-col lg:flex-row" : ""}`}
        style={{
          backgroundImage:
            "radial-gradient(1100px 420px at 50% -10%, rgba(99,102,241,0.07), transparent), radial-gradient(700px 300px at 100% 100%, rgba(16,185,129,0.05), transparent)",
        }}
      >
        {!caseExplorerActive && !processExplorerActive && <LivingGraphLegend />}

        {/* UX-007 — Saved Layouts: compact floating controls (works in normal,
            fullscreen and Focus Mode). Save node positions + reset/clear. */}
        {viewLevel !== "events" && (
          <LivingGraphLayoutControls
            locale={locale}
            hasUnsaved={hasUnsavedLayout}
            hasSaved={savedLayout != null}
            saving={savingLayout}
            onSave={handleSaveLayout}
            onResetSaved={handleResetToSaved}
            onResetAuto={handleResetToAuto}
            onClear={handleClearSavedLayout}
          />
        )}

        {/* Transient confirmation (acts as the "Layout saved" toast). */}
        {viewLevel !== "events" && layoutNotice && (
          <div
            role="status"
            className={
              "absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-md border px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur " +
              (layoutNotice === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                : "border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300")
            }
          >
            {layoutNotice === "saved" && (locale === "es" ? "Diseño guardado" : "Layout saved")}
            {layoutNotice === "error" &&
              (locale === "es" ? "No se pudo guardar el diseño" : "Couldn’t save layout")}
            {layoutNotice === "reset" &&
              (locale === "es" ? "Diseño guardado restaurado" : "Saved layout restored")}
            {layoutNotice === "auto" &&
              (locale === "es" ? "Diseño automático aplicado" : "Auto layout applied")}
            {layoutNotice === "cleared" &&
              (locale === "es" ? "Diseño guardado borrado" : "Saved layout cleared")}
          </div>
        )}

        {/* TASK 7 — graph changed since the save: positions partially applied. */}
        {viewLevel !== "events" && layoutPartiallyApplied && !layoutNotice && (
          <div
            role="status"
            className="absolute left-1/2 top-14 z-20 -translate-x-1/2 max-w-[min(92%,30rem)] rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] text-amber-700 dark:text-amber-400"
          >
            {locale === "es"
              ? "El diseño guardado se aplicó parcialmente porque el grafo cambió."
              : "Saved layout was partially applied because the graph changed."}
          </div>
        )}

        {/* Sprint #3 — overlay clarity: what am I looking at, why are nodes here,
            what to do next + empty/incomplete state, for the advanced overlays. */}
        {viewLevel !== "events" && ADVANCED_OVERLAYS.includes(overlay) && (
          <OverlayInfo
            key={overlay}
            overlay={overlay}
            state={resolveOverlayState(overlaySignals)}
            signals={overlaySignals}
            locale={locale}
            projectId={projectId}
            onNavigate={(href) => router.push(localizedHref(locale, href))}
          />
        )}

        {/* Floating Insights (executive KPIs + summary) — hidden while a node
            detail panel occupies the right side. Graph keeps full height. */}
        {viewLevel !== "events" && !showPanel && !insightsOpen && (
          <button
            type="button"
            onClick={() => setInsightsOpen(true)}
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur transition-colors hover:bg-muted"
          >
            <BarChart3 className="h-3.5 w-3.5 text-brand-500" aria-hidden />
            {locale === "es" ? "Indicadores" : "Insights"}
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums"
              style={{
                color: health.healthScore >= 75 ? "#10b981" : health.healthScore >= 50 ? "#f59e0b" : "#ef4444",
                background: "rgba(100,116,139,0.12)",
              }}
            >
              {health.healthScore}
            </span>
          </button>
        )}
        {viewLevel !== "events" && !showPanel && insightsOpen && (
          <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] w-[380px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-brand-500" aria-hidden />
                {locale === "es" ? "Indicadores ejecutivos" : "Executive Insights"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  title={t("recalculateHint")}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {recalculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => setInsightsOpen(false)}
                  aria-label={t("actions.close")}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {scopedInsights.scoped && (
                <p className="flex items-center gap-1.5 rounded-md bg-brand-500/10 px-2 py-1 text-[10px] font-medium text-brand-700 dark:text-brand-300">
                  <BarChart3 className="h-3 w-3" />
                  {locale === "es"
                    ? `Vista actual: ${scopedInsights.tasks.length} tareas · ${scopedInsights.milestones.length} fase(s)`
                    : `Current view: ${scopedInsights.tasks.length} tasks · ${scopedInsights.milestones.length} phase(s)`}
                </p>
              )}
              <LivingGraphMetricsHeader health={health} layout="grid" />
              <ExecutiveSummaryPanel milestones={scopedInsights.milestones} tasks={scopedInsights.tasks} locale={locale} defaultOpen compact />
            </div>
          </div>
        )}

        {/* Workforce roster — per-person utilization, shown with the Workforce
            overlay. Works on the readable Milestones view; at-risk cards light
            up in the graph while this lists who is overloaded. */}
        {viewLevel !== "events" && workforceActive && resourceCapacity && (
          <div className="absolute left-3 top-14 z-20 flex max-h-[calc(100%-4.5rem)] w-[256px] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur">
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-brand-500" aria-hidden />
              {locale === "es" ? "Fuerza laboral" : "Workforce"}
              <span className="ml-auto font-normal normal-case text-[11px]">
                {resourceCapacity.resources.length} · {locale === "es" ? "4 sem" : "4 wks"}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
              {[...resourceCapacity.resources]
                .sort((a, b) => (b.utilizationPercent ?? -1) - (a.utilizationPercent ?? -1))
                .map((r) => {
                  const u = r.utilizationPercent;
                  const color =
                    r.status === "critical" ? "#ef4444"
                    : r.status === "overallocated" ? "#f97316"
                    : r.status === "near_capacity" ? "#f59e0b"
                    : r.status === "needs_review" ? "#94a3b8"
                    : "#10b981";
                  return (
                    <div key={r.resourceKey}>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="min-w-0 truncate font-medium text-foreground" title={r.role ?? undefined}>{r.name}</span>
                        <span className="shrink-0 font-mono font-bold tabular-nums" style={{ color }}>
                          {u == null ? "—" : `${Math.round(u)}%`}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, u ?? 0)}%`, background: color }} />
                      </div>
                      <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
                        <span className="truncate">{r.role ?? "—"}</span>
                        <span className="shrink-0">{Math.round(r.assignedHours)}/{Math.round(r.effectivePeriodHours)}h</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {viewLevel !== "events" && overlay === "simulation" && selectedNode && (
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
        {/* Part B — explicit status banner for the "events" view. The view NEVER
            silently falls back to operational nodes; each non-ready state renders
            its own banner so the user can distinguish disabled / empty / error /
            truncated. Only "ready"/"truncated" render the canonical graph. */}
        {viewLevel === "events" && projectionStatus === "disabled" && (
          <div
            role="status"
            className="absolute left-3 right-3 top-3 z-30 flex items-center gap-2 rounded-md border border-muted-foreground/30 bg-card/95 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur"
          >
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("canonicalEvents.status.disabled.title")}
          </div>
        )}
        {viewLevel === "events" && projectionStatus === "empty" && (
          <div
            role="status"
            className="absolute left-3 right-3 top-3 z-30 flex items-center gap-2 rounded-md border border-amber-500/40 bg-card/95 px-3 py-1.5 text-[11px] font-medium text-amber-700 shadow-sm backdrop-blur dark:text-amber-300"
          >
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("canonicalEvents.status.empty.title")}
          </div>
        )}
        {viewLevel === "events" && projectionStatus === "error" && (
          <div
            role="status"
            className="absolute left-3 right-3 top-3 z-30 flex items-center gap-2 rounded-md border border-red-500/40 bg-card/95 px-3 py-1.5 text-[11px] font-medium text-red-700 shadow-sm backdrop-blur dark:text-red-300"
          >
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("canonicalEvents.status.error.title")}
          </div>
        )}
        {canonicalAuditActive && projectionStatus === "truncated" && (
          <div
            role="status"
            className="absolute left-3 right-3 top-3 z-30 flex items-center gap-2 rounded-md border border-amber-500/40 bg-card/95 px-3 py-1.5 text-[11px] font-medium text-amber-700 shadow-sm backdrop-blur dark:text-amber-300"
          >
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("canonicalEvents.status.truncated.title", { count: canonicalEvents.length })}
          </div>
        )}
        {canonicalAuditActive && canonicalEvents.length > 0 && (
          <p className="absolute bottom-3 left-14 z-20 rounded bg-card/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
            {t("canonicalEvents.viewTitle")} — {t("canonicalEvents.viewHint")}
          </p>
        )}
        {caseExplorerActive ? (
          <div className="min-h-0 min-w-0 flex-1">
            <TaskCaseExplorer
              locale={locale}
              cases={taskCases}
              eventsTruncated={projectScopedData.eventsTruncated ?? false}
              selectedTaskId={selectedTaskCaseId}
              onSelectTask={(taskId) => {
                setSelectedTaskCaseId(taskId);
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              onSelectEvent={(eventId) => {
                setSelectedNodeId(canonicalEventNodeId(eventId));
                setSelectedEdgeId(null);
              }}
              onOpenTask={(taskId) =>
                router.push(localizedHref(locale, `/projects/${projectId}/workboard?task=${taskId}`))
              }
            />
          </div>
        ) : (
          <>
            {processExplorerActive && (
              <TaskProcessExplorerPanel
                locale={locale}
                model={taskProcessModel}
                aggregate={taskProcessAggregate}
                eventsTruncated={projectScopedData.eventsTruncated ?? false}
                selectedVariantId={effectiveProcessVariantId}
                onVariantChange={(variantId) => {
                  setProcessVariantId(variantId);
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                activityCoverage={activityCoverage}
                connectionCoverage={connectionCoverage}
                onActivityCoverageChange={setActivityCoverage}
                onConnectionCoverageChange={setConnectionCoverage}
                selectedActivity={selectedProcessActivity}
                selectedTransition={selectedProcessTransition}
              />
            )}
            <div className="relative min-h-0 min-w-0 flex-1">
              {processExplorerActive && !taskProcessDiscovery.isDiscoverable && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
                  <div
                    role="status"
                    className="pointer-events-auto max-w-md rounded-xl border border-amber-500/40 bg-card/95 p-5 text-center shadow-xl backdrop-blur"
                  >
                    <GitFork className="mx-auto h-6 w-6 text-amber-600" aria-hidden />
                    <h2 className="mt-2 text-sm font-semibold text-foreground">
                      {locale === "es"
                        ? "Aún no hay un flujo observado distinguible"
                        : "No distinct observed flow yet"}
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {taskProcessDiscovery.status === "single_activity"
                        ? locale === "es"
                          ? `Los ${taskProcessAggregate.visibleEventCount} eventos visibles se reducen a un solo tipo de actividad. No existe una transición entre actividades diferentes que dibujar.`
                          : `All ${taskProcessAggregate.visibleEventCount} visible events reduce to one activity type. There is no transition between distinct activities to draw.`
                        : taskProcessDiscovery.status === "no_direct_follow"
                          ? locale === "es"
                            ? "Hay varios tipos de evento, pero todavía no existe una secuencia directa entre ellos."
                            : "Multiple event types exist, but no direct-follow sequence connects them yet."
                          : locale === "es"
                            ? "No hay eventos de negocio vinculados a tareas para descubrir el proceso."
                            : "No task-linked business events are available for process discovery."}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {locale === "es"
                        ? "El flujo de dependencias planificadas sí está disponible y se mantiene separado de la evidencia observada."
                        : "The planned dependency flow is available and remains separate from observed evidence."}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={openPlannedFlow}
                        className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        <Workflow className="h-3.5 w-3.5" aria-hidden />
                        {locale === "es" ? "Abrir fase planificada" : "Open planned phase"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventExperience("cases")}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        {locale === "es" ? "Revisar casos" : "Review task cases"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                nodesDraggable={!processExplorerActive}
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
                  nodeColor={(n) => {
                    if (n.type === "processActivity") return "#10b981";
                    // Canonical event/object nodes have their own colors.
                    if (n.type === "canonicalEvent") {
                      const imp = (n.data as { event?: { eventImportance?: string } }).event?.eventImportance;
                      return imp === "CRITICAL" || imp === "HIGH"
                        ? "#dc2626"
                        : imp === "MEDIUM"
                          ? "#d97706"
                          : "#0891b2";
                    }
                    if (n.type === "canonicalObject") return "#94a3b8";
                    return minimapNodeColor((n as LivingFlowNode).data.node.nodeType);
                  }}
                  className="!bg-card"
                />
              </ReactFlow>
            </div>
          </>
        )}

        {showPanel && (
          <div className="absolute inset-y-0 right-0 z-20 lg:relative lg:inset-auto">
            <LivingGraphDetailPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              analysis={analysis}
              overlay={overlay}
              projectId={projectId}
              onNavigate={(href) => router.push(localizedHref(locale, href))}
              simulation={simulation}
              pathModeFromId={pathModeFromId}
              onFindPathFrom={(id) => setPathModeFromId((cur) => (cur === id ? null : id))}
              onExtractSubgraph={(node) => void handleExtractSubgraph(node)}
              onShowDownstream={handleShowDownstream}
              onFocusNode={handleFocusNode}
              onRunScenario={handleRunScenario}
              onEditEntity={handleEditNode}
              ownerNames={subtaskOwnerNames}
              onOpenTeam={() => router.push(localizedHref(locale, `/projects/${projectId}/team`))}
              selectedCanonicalEvent={selectedCanonicalEvent}
              canonicalEventRelationships={projectScopedData.eventRelationships ?? []}
              eventsTruncated={projectScopedData.eventsTruncated ?? false}
              onClose={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
            />
          </div>
        )}
        {betweenResult && (
          <div className="absolute inset-y-0 right-0 z-20 w-[320px] max-w-[80vw] lg:relative lg:inset-auto lg:w-[360px]">
            <BetweenAnalysisPanel
              result={betweenResult}
              onClose={handleClearBetween}
              onSwap={handleSwapBetween}
              onClear={handleClearBetween}
            />
          </div>
        )}
      </div>

      {/* Timeline playback (visible in timeline overlay) */}
      {timelineActive && (
        <LivingGraphTimeline
          events={projectScopedData.events}
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
