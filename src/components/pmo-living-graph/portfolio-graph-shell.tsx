"use client";

// ============================================================================
// PMO Portfolio Living Graph — client shell (CAP-048)
// ============================================================================
// The one stateful component. It owns the navigation position, filters,
// selection, path finding and impact analysis.
//
// What is on screen is decided in two passes, in this order:
//
//   1. `scopeToNavigation` — WHICH LEVEL. Large to small: the portfolio shows
//      projects; entering a project HIDES the other projects and shows its
//      milestones; a milestone shows its tasks; a task shows its subtasks,
//      risks and costs. Both passes are pure and covered by navigation.test.ts.
//   2. `buildGraphWindow`  — filters, confidence floor and the hard node cap,
//      applied to whatever the level produced.
//
// The previous build expanded projects in place instead, so opening one project
// left the other four on screen with their edges crossing it. That is the bug
// this ordering exists to prevent.
//
// The state split is deliberate and load-bearing:
//
//   STRUCTURAL  — which nodes exist and where they sit. Recomputed only when
//                 zoom / expansion / filters / focus change.
//   INTERACTION — hover, dim, path highlight, blast rings. Patched onto the
//                 live arrays in place.
//
// Collapsing the two would rebuild every node on every pointer move, which
// costs React Flow its `measured` dimensions (nodes and edges shudder) and
// snaps a dragged node back to its layout position. See graph-node-sync.ts.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { AlertTriangle, Info, Network, X } from "lucide-react";
import type {
  GraphEdge,
  GraphFilters,
  GraphNode,
} from "@/lib/pmo-living-graph/contracts";
import { buildGraphWindow, defaultFilters } from "@/lib/pmo-living-graph/subgraph";
import {
  PORTFOLIO_NAVIGATION,
  buildBreadcrumbs,
  drillDownTo,
  drillUp,
  scopeToNavigation,
  type GraphNavigation,
} from "@/lib/pmo-living-graph/navigation";
import {
  buildAdjacency,
  findPath,
  getBlastRadius,
  getNeighbors,
} from "@/lib/pmo-living-graph/graph-algorithms";
import type { CriticalNode } from "@/lib/pmo-living-graph/graph-algorithms";
import type { PortfolioMetrics } from "@/lib/pmo-living-graph/portfolio-metrics";
import { PortfolioGraphCanvas } from "./portfolio-graph-canvas";
import { GraphToolbar } from "./graph-toolbar";
import { GraphBreadcrumbs } from "./graph-breadcrumbs";
import { GraphLegend } from "./graph-legend";
import { PortfolioMetricsBar } from "./portfolio-metrics-bar";
import { GraphSidePanel, type SidePanelNodeContext } from "./graph-side-panel";
import type { GraphFlowEdge, GraphFlowNode } from "./graph-flow-types";
import {
  applyEdgeInteraction,
  applyNodeInteraction,
  mergeStructuralNodes,
} from "./graph-node-sync";
import {
  clearSavedPositions,
  computeGraphLayout,
  loadSavedPositions,
  pruneAgainstFullGraph,
  saveSavedPositions,
  type SavedPosition,
} from "./graph-layout";
import { projectLens, unavailableLenses } from "@/lib/pmo-intelligence/lens-projection";
import { scopeToSearchParams, type PmoLens, type PmoScope } from "@/lib/pmo-intelligence/scope";
import { kpiIntent, type PmoKpiKey } from "@/lib/pmo-intelligence/kpi-bindings";
import { kpiOutcome, type KpiOutcome } from "@/lib/pmo-intelligence/kpi-feedback";
import {
  loadPanelPreferences,
  savePanelPreferences,
  togglePanel,
  type PmoPanelKey,
} from "@/lib/pmo-intelligence/panel-preferences";
import {
  filterCriticalPathForSelection,
  resolveCriticalPathNodes,
  type PmoDashboardSlice,
  type PmoFocusSlice,
} from "@/lib/pmo-intelligence/dashboard-model";
import { buildIsabellaAsk, buildIsabellaSubgraph } from "@/lib/pmo-intelligence/isabella-context";
import { reloadPmoIntelligenceAction } from "@/lib/pmo-intelligence/commands.server";
import { askIsabella } from "@/lib/isabella/ask-isabella";
import type { PmoPiInsight } from "@/lib/pmo-process-intelligence/insights";
import { usePmoScope } from "@/components/pmo-intelligence/use-pmo-scope";
import { PmoGlobalFilters } from "@/components/pmo-intelligence/global-filters";
import { PmoLensTabs } from "@/components/pmo-intelligence/lens-tabs";
import { PmoLensPanel } from "@/components/pmo-intelligence/lens-panel";
import { PmoKpiBar } from "@/components/pmo-intelligence/kpi-bar";
import { PmoHealthPanel } from "@/components/pmo-intelligence/health-panel";
import { PmoFocusPanel } from "@/components/pmo-intelligence/focus-panel";
import { PmoCriticalPathDrawer } from "@/components/pmo-intelligence/critical-path-drawer";
import { PmoInsightsPanel } from "@/components/pmo-intelligence/insights-panel";
import { PmoWhatIfPanel } from "@/components/pmo-intelligence/whatif-panel";
import { PmoTopActions } from "@/components/pmo-intelligence/top-actions";
import { PmoPanelToggles } from "@/components/pmo-intelligence/panel-toggles";
import type { PmoIntelligenceLayerProps } from "@/components/pmo-intelligence/layer-contract";

export interface PortfolioGraphShellProps {
  locale: "en" | "es";
  /** Locale prefix for links ("" or "/es"). */
  base: string;
  organizationId: string;
  userId: string;
  organizationName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  criticalNodes: CriticalNode[];
  metrics: PortfolioMetrics;
  unavailableSources: string[];
  /**
   * PMO Intelligence Center layer (CAP-048 Phase 2, M3/M4).
   *
   * Optional on purpose: without it this shell behaves exactly as it did in
   * Phase 1 — same canvas, same toolbar, same navigation. Phase 2 is additive,
   * and the flag that governs the module must be able to turn the extra layer
   * off without taking the graph with it.
   */
  intelligence?: PmoIntelligenceLayerProps;
}

const LAYOUT_SAVED_TOAST_MS = 2_500;

/**
 * The slice used when the intelligence layer is absent.
 *
 * Every collection is empty and every KPI is simply missing — not zero. Without
 * the layer none of these panels render at all, so this exists to satisfy the
 * hook's non-optional `initialModel` rather than to be displayed.
 */
const EMPTY_DASHBOARD: PmoDashboardSlice = {
  kpis: [],
  health: null,
  focus: [],
  criticalPath: [],
  insights: [],
  whatIf: { financeRows: [], criticalRiskCount: 0, systemicRisks: [], capacity: [] },
  blockedDaysByProject: [],
  unavailableSources: [],
  generatedAt: "",
};

export function PortfolioGraphShell(props: PortfolioGraphShellProps) {
  // React Flow hooks used by the canvas require the provider above them.
  return (
    <ReactFlowProvider>
      <ShellBody {...props} />
    </ReactFlowProvider>
  );
}

function ShellBody({
  locale,
  base,
  organizationId,
  userId,
  organizationName,
  nodes,
  edges,
  criticalNodes,
  metrics,
  unavailableSources,
  intelligence,
}: PortfolioGraphShellProps) {
  const t = useTranslations("pmoLivingGraph");

  // ── View state ──────────────────────────────────────────────────────────
  // Where the user is in the hierarchy. This replaced `expandedProjectIds` +
  // semantic `zoom`: two controls that could disagree about depth are now one
  // position that cannot.
  const [navigation, setNavigation] = useState<GraphNavigation>(PORTFOLIO_NAVIGATION);
  const [filters, setFilters] = useState<GraphFilters>(defaultFilters);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [focusActive, setFocusActive] = useState(false);
  const [pathMode, setPathMode] = useState(false);
  const [pathEndpoints, setPathEndpoints] = useState<string[]>([]);
  const [blastHops, setBlastHops] = useState<1 | 2 | 3 | null>(null);
  // Restored lazily rather than in an effect: the saved layout is available on
  // the very first paint, so nodes never flash at their auto-layout position
  // and then jump. `loadSavedPositions` returns {} when there is no window, so
  // this is SSR-safe.
  //
  // PMO-LG-LAYOUT-PERSISTENCE. Loaded UNPRUNED and kept that way for the life of
  // the session. This map is the user's arrangement of the WHOLE portfolio, not
  // of the current view: the canvas shows one level at a time and may be
  // filtered further, so anything scoped to what is on screen would discard the
  // positions of every node the user is not currently looking at. `layout`
  // below already ignores entries with no node in the window, so carrying them
  // costs nothing and losing them costs the arrangement.
  const [manualPositions, setManualPositions] = useState<Record<string, SavedPosition>>(
    () => loadSavedPositions(organizationId, userId),
  );
  const [layoutSavedAt, setLayoutSavedAt] = useState<number | null>(null);

  // Interaction state deliberately lives outside the structural memo.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const draggingRef = useRef(false);

  // ── Derived indices over the full graph ─────────────────────────────────
  // Built from every node/edge, not the window: focus and impact must be able
  // to reach through nodes the current window happens to hide.
  const adjacency = useMemo(() => buildAdjacency(edges), [edges]);
  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const labelsById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.label] as const)),
    [nodes],
  );
  const criticalById = useMemo(
    () => new Map(criticalNodes.map((item) => [item.nodeId, item])),
    [criticalNodes],
  );
  const projectLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      if (node.kind === "project" && node.projectId) map.set(node.projectId, node.label);
    }
    return map;
  }, [nodes]);

  // ── Focus mode neighbourhood ────────────────────────────────────────────
  const focusNeighbourIds = useMemo(() => {
    if (!focusActive || !selectedNodeId) return null;
    return new Set(getNeighbors(adjacency, selectedNodeId, "both"));
  }, [adjacency, focusActive, selectedNodeId]);

  // ── Pass 1: the level ───────────────────────────────────────────────────
  const scoped = useMemo(
    () => scopeToNavigation(nodes, edges, navigation),
    [nodes, edges, navigation],
  );

  // ── Pass 2: the window ──────────────────────────────────────────────────
  // The level has already decided visibility, so windowing is told to hide
  // nothing further: `zoom: "near"` admits every kind, and every project on
  // screen counts as expanded. What is left is filters, the confidence floor
  // and the hard cap — the parts that must still apply at any level.
  const scopedProjectIds = useMemo(
    () =>
      [
        ...new Set(
          scoped.nodes
            .map((node) => node.projectId)
            .filter((id): id is string => id != null),
        ),
      ],
    [scoped.nodes],
  );

  const projection = useMemo(
    () =>
      buildGraphWindow(scoped.nodes, scoped.edges, {
        zoom: "near",
        expandedProjectIds: scopedProjectIds,
        filters,
        focusNodeId: focusActive ? selectedNodeId : null,
        focusNeighbourIds,
      }),
    [scoped, scopedProjectIds, filters, focusActive, selectedNodeId, focusNeighbourIds],
  );

  // ── PMO Intelligence layer (CAP-048 Phase 2) ────────────────────────────
  // One scope for every panel above the canvas. Feeding it the node ids that
  // are actually on screen is what lets it drop a selection the new scope no
  // longer shows, instead of leaving the side panel describing an invisible
  // node.
  const visibleNodeIds = useMemo(
    () => new Set(projection.nodes.map((node) => node.id)),
    [projection.nodes],
  );

  // The client-side reloader. Milestone 3 left `reload` undefined, which made
  // the whole abort/supersede path in `usePmoScope` dead code that had never
  // run once. This is the loader it was written for: a data-affecting scope
  // change now refreshes the KPIs, health, focus, critical path and insights
  // WITHOUT a route navigation, so the canvas keeps its layout and viewport.
  const reloadDashboard = useCallback(
    async (nextScope: PmoScope): Promise<PmoDashboardSlice> => {
      const result = await reloadPmoIntelligenceAction({
        // Serialised through the same parser the route uses, so a malformed
        // date is dropped at the boundary rather than reaching the database.
        scopeQuery: scopeToSearchParams(nextScope).toString(),
        locale,
      });
      if (result.error || !result.slice) throw new Error(result.error ?? "unexpected");
      return result.slice;
    },
    [locale],
  );

  const {
    scope,
    session,
    model: dashboard,
    setLens,
    setProjectIds,
    setDateRange,
    resetScope,
    setSession,
    onToggleDrawer,
    onApplyKpiIntent,
    isLoading: scopeLoading,
    error: scopeError,
  } = usePmoScope<PmoDashboardSlice>({
    organizationId,
    initialScope: intelligence?.initialScope,
    initialModel: intelligence?.dashboard ?? EMPTY_DASHBOARD,
    // Without the intelligence layer the shell is Phase 1 exactly: no reloader,
    // no server action, nothing beyond the canvas.
    reload: intelligence ? reloadDashboard : undefined,
    visibleNodeIds,
  });

  // Lens projection: the same graph, re-emphasised. Never a different graph.
  //
  // The blocked-days map is taken from the RELOADED slice rather than from the
  // server props, so a date-range change moves the process lens too. Reading it
  // from `intelligence.lensData` would freeze it at the first paint and leave
  // one panel answering a question the rest of the screen has moved on from —
  // the exact failure the shared scope exists to prevent.
  const lensInput = useMemo(() => {
    if (!intelligence) return null;
    return {
      ...intelligence.lensData,
      blockedDaysByProject:
        dashboard.blockedDaysByProject.length > 0
          ? new Map(dashboard.blockedDaysByProject)
          : intelligence.lensData.blockedDaysByProject,
      nodes,
      edges,
      criticalNodeIds: criticalNodes.map((item) => item.nodeId),
    };
  }, [intelligence, dashboard.blockedDaysByProject, nodes, edges, criticalNodes]);

  const lensProjection = useMemo(
    () => (lensInput ? projectLens(lensInput, scope.activeLens) : null),
    [lensInput, scope.activeLens],
  );

  const lensUnavailable = useMemo(
    () => (lensInput ? unavailableLenses(lensInput) : new Map<PmoLens, string>()),
    [lensInput],
  );

  // ── Layout ──────────────────────────────────────────────────────────────
  const layout = useMemo(() => {
    const automatic = computeGraphLayout(projection.nodes, projection.edges);
    // A manual drag always wins over the auto-layout, for nodes still present.
    // Entries for nodes outside this window are simply skipped — they are not
    // stale, they belong to a level the user is not looking at.
    for (const [id, position] of Object.entries(manualPositions)) {
      if (automatic.has(id)) automatic.set(id, position);
    }
    return automatic;
  }, [projection, manualPositions]);

  // ── Orphan maintenance ──────────────────────────────────────────────────
  // PMO-LG-LAYOUT-PERSISTENCE. The ONLY place positions are ever dropped, and
  // it prunes against `nodes` — the complete graph the server sent — never
  // against `projection.nodes`, which is one level of one filtered view.
  //
  // Keyed on the full node set so it re-runs when the portfolio itself changes
  // (an entity was deleted) and not when the user navigates or filters. Without
  // this the map would grow forever and eventually place ghosts on the canvas;
  // with it scoped wrongly it would erase the user's work on every drill-down,
  // which is the regression this shape exists to make impossible.
  const fullGraphNodeIds = useMemo(
    () => new Set(nodes.map((node) => node.id)),
    [nodes],
  );

  useEffect(() => {
    setManualPositions((current) => {
      const pruned = pruneAgainstFullGraph(current, fullGraphNodeIds);
      // Identity is preserved when nothing was orphaned, so this effect cannot
      // drive a render loop through its own setState.
      if (Object.keys(pruned).length === Object.keys(current).length) return current;
      // "replace": merging would read the orphans straight back out of storage.
      saveSavedPositions(organizationId, userId, pruned, "replace");
      return pruned;
    });
  }, [fullGraphNodeIds, organizationId, userId]);

  // ── Drilling ────────────────────────────────────────────────────────────
  // Held in a ref and read through a stable callback, so the node data objects
  // do not change identity every time `navigation` moves. Passing the raw
  // handler would rebuild every node on each level change for no reason.
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  const drillInto = useCallback(
    (node: GraphNode) => {
      const next = drillDownTo(node, navigationRef.current);
      // Leaves return null: there is no deeper level, so the click selects the
      // node and the panel answers instead of the canvas emptying out.
      if (!next) {
        setSelectedNodeId(node.id);
        return;
      }
      setNavigation(next);
      // A selection from the previous level would point at a node that is no
      // longer on screen.
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setBlastHops(null);
    },
    [],
  );

  const nodesByIdRef = useRef(nodesById);
  nodesByIdRef.current = nodesById;

  const drillIntoById = useCallback(
    (nodeId: string) => {
      const node = nodesByIdRef.current.get(nodeId);
      if (node) drillInto(node);
    },
    [drillInto],
  );

  const handleLevelUp = useCallback(() => {
    setNavigation((current) => drillUp(current));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setBlastHops(null);
  }, []);

  const handleBreadcrumb = useCallback((next: GraphNavigation) => {
    setNavigation(next);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setBlastHops(null);
  }, []);

  // ── Structural projection → React Flow ──────────────────────────────────
  const structuralNodes = useMemo<GraphFlowNode[]>(
    () =>
      projection.nodes.map((node) => ({
        id: node.id,
        type: "graphNode" as const,
        position: layout.get(node.id) ?? { x: 0, y: 0 },
        data: {
          node,
          // `drillDownTo` is the single authority on what has a deeper level,
          // so the affordance and the gesture can never disagree.
          drillable: drillDownTo(node, navigation) != null,
          isAnchor: node.id === scoped.anchorNodeId,
          locale,
          onDrillDown: drillIntoById,
          hovered: false,
          dimmed: false,
          onPath: false,
          blastHop: null,
          lensEmphasis: "none" as const,
        },
      })),
    [projection.nodes, layout, locale, drillIntoById, navigation, scoped.anchorNodeId],
  );

  const structuralEdges = useMemo<GraphFlowEdge[]>(
    () =>
      projection.edges.map((edge) => ({
        id: edge.id,
        type: "graphEdge" as const,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        data: {
          edge,
          hovered: false,
          dimmed: false,
          onPath: false,
          lensEmphasis: "none" as const,
        },
      })),
    [projection.edges],
  );

  // The live React Flow arrays. React Flow owns and mutates these (drag,
  // measure), so they are held by its own state hooks rather than plain
  // useState — that is what makes the setters legitimate effect targets.
  const [flowNodes, setFlowNodes, onNodesChange] =
    useNodesState<GraphFlowNode>(structuralNodes);
  const [flowEdges, setFlowEdges] = useEdgesState<GraphFlowEdge>(structuralEdges);

  // Merge structure onto the live arrays. This runs on structural change ONLY —
  // never on hover — which is what preserves `measured` and drag positions.
  useEffect(() => {
    setFlowNodes((current) =>
      mergeStructuralNodes(current, structuralNodes, draggingRef.current),
    );
  }, [setFlowNodes, structuralNodes]);

  // Bring the camera to the new level. `fitView` on the canvas only runs at
  // mount, so without this the user drills into a project and stares at the
  // patch of empty canvas where the portfolio used to be. Deliberately keyed on
  // the navigation position alone: refitting on every filter change would fight
  // a user who has panned somewhere on purpose.
  const { fitView } = useReactFlow();
  useEffect(() => {
    // One frame's delay so React Flow has measured the nodes it just received;
    // fitting against unmeasured nodes lands on the wrong rectangle.
    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 300 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, navigation]);

  useEffect(() => {
    setFlowEdges((current) => {
      const previous = new Map(current.map((edge) => [edge.id, edge]));
      return structuralEdges.map((edge) => {
        const prior = previous.get(edge.id);
        if (!prior) return edge;
        return {
          ...prior,
          data: {
            ...edge.data,
            hovered: prior.data?.hovered ?? false,
            dimmed: prior.data?.dimmed ?? false,
            onPath: prior.data?.onPath ?? false,
            lensEmphasis: prior.data?.lensEmphasis ?? "none",
          },
        } as GraphFlowEdge;
      });
    });
  }, [setFlowEdges, structuralEdges]);

  // ── Path finding ────────────────────────────────────────────────────────
  const path = useMemo(() => {
    if (pathEndpoints.length < 2) return null;
    return findPath(adjacency, pathEndpoints[0], pathEndpoints[1]);
  }, [adjacency, pathEndpoints]);

  const pathNodeIds = useMemo(
    () => new Set(path?.nodeIds ?? []),
    [path],
  );
  const pathEdgeIds = useMemo(
    () => new Set((path?.edges ?? []).map((edge) => edge.id)),
    [path],
  );

  const pathHint = useMemo(() => {
    if (!pathMode) return null;
    if (pathEndpoints.length < 2) return t("selectTwoNodes");
    if (!path) return t("noPath");
    return t("pathFound", { hops: path.hops });
  }, [pathMode, pathEndpoints.length, path, t]);

  // ── Blast radius ────────────────────────────────────────────────────────
  const blast = useMemo(() => {
    if (!blastHops || !selectedNodeId) return null;
    return getBlastRadius(adjacency, selectedNodeId, blastHops);
  }, [adjacency, blastHops, selectedNodeId]);

  const blastHopsById = useMemo(() => {
    const map = new Map<string, number>();
    if (!blast) return map;
    for (const [hop, ids] of blast.byHop) {
      for (const id of ids) map.set(id, hop);
    }
    return map;
  }, [blast]);

  // ── Dimming ─────────────────────────────────────────────────────────────
  // Precedence is intentional: an explicit query (path, impact) outranks a
  // transient hover, so moving the mouse never destroys an answer on screen.
  const relatedNodeIds = useMemo(() => {
    if (pathNodeIds.size > 0) return pathNodeIds;
    if (blast) return new Set([blast.originNodeId, ...blast.affectedNodeIds]);
    const active = hoveredNodeId ?? selectedNodeId;
    if (!active) return new Set<string>();
    return new Set([active, ...getNeighbors(adjacency, active, "both")]);
  }, [pathNodeIds, blast, hoveredNodeId, selectedNodeId, adjacency]);

  const selectedNodeIds = useMemo(
    () => new Set(selectedNodeId ? [selectedNodeId] : []),
    [selectedNodeId],
  );

  // ── Interaction patch ───────────────────────────────────────────────────
  // Lens emphasis rides this pass rather than the structural one on purpose:
  // switching lens must not rebuild the node array, or React Flow loses its
  // measured sizes and the canvas shudders on every tab click. Same reason
  // hover was separated in Phase 1 (see graph-node-sync.ts).
  useEffect(() => {
    setFlowNodes((current) =>
      applyNodeInteraction(current, {
        hoveredNodeId,
        relatedNodeIds,
        selectedNodeIds,
        pathNodeIds,
        blastHops: blastHopsById,
        lensHighlightedIds: lensProjection?.highlightedNodeIds,
        lensMutedIds: lensProjection?.dimmedNodeIds,
      }),
    );
  }, [
    setFlowNodes,
    hoveredNodeId,
    relatedNodeIds,
    selectedNodeIds,
    pathNodeIds,
    blastHopsById,
    lensProjection,
  ]);

  useEffect(() => {
    setFlowEdges((current) =>
      applyEdgeInteraction(current, {
        hoveredEdgeId,
        activeNodeId: hoveredNodeId ?? selectedNodeId,
        selectedEdgeIds: selectedEdgeId ? [selectedEdgeId] : [],
        pathEdgeIds,
        lensHighlightedEdgeIds: lensProjection?.highlightedEdgeIds,
      }),
    );
  }, [
    setFlowEdges,
    hoveredEdgeId,
    hoveredNodeId,
    selectedNodeId,
    selectedEdgeId,
    pathEdgeIds,
    lensProjection,
  ]);

  // ── Canvas handlers ─────────────────────────────────────────────────────
  // `onNodesChange` comes from useNodesState: it is React Flow's own change
  // applier, so drag and measure updates land without a hand-rolled reducer.

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: GraphFlowNode) => {
      setSelectedEdgeId(null);
      if (pathMode) {
        // Two picks make a query; a third starts a new one rather than
        // silently extending the previous pair.
        setPathEndpoints((current) =>
          current.length >= 2 ? [node.id] : [...current, node.id],
        );
        return;
      }
      setSelectedNodeId(node.id);
    },
    [pathMode],
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: GraphFlowNode) => {
      // Double-click is the drill gesture at every level, not just on projects.
      if (pathMode) return;
      drillInto(node.data.node);
    },
    [drillInto, pathMode],
  );

  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: GraphFlowNode) => setHoveredNodeId(node.id),
    [],
  );
  const onNodeMouseLeave = useCallback(() => setHoveredNodeId(null), []);

  const onNodeDragStart = useCallback(() => {
    draggingRef.current = true;
  }, []);

  // React Flow reports drags from both pointer families; the event is unused
  // either way, so the union is accepted rather than narrowed.
  //
  // PMO-LG-LAYOUT-PERSISTENCE. The drag is written to storage immediately, not
  // held until the user finds "Save layout". Treating a drag as exploratory
  // sounds tidy and is wrong in practice: moving a node IS the gesture that
  // expresses the arrangement, and the user who moves five nodes and reloads
  // has every reason to expect five moved nodes. "Save layout" survives as an
  // explicit confirmation, but it is no longer the only thing standing between
  // a drag and its own persistence.
  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: GraphFlowNode) => {
      draggingRef.current = false;
      setManualPositions((current) => {
        const next = {
          ...current,
          [node.id]: { x: node.position.x, y: node.position.y },
        };
        // Merges over the stored map rather than replacing it, so nodes outside
        // this view keep their positions.
        saveSavedPositions(organizationId, userId, next);
        return next;
      });
    },
    [organizationId, userId],
  );

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: GraphFlowEdge) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(edge.id);
  }, []);

  const onEdgeMouseEnter = useCallback(
    (_event: React.MouseEvent, edge: GraphFlowEdge) => setHoveredEdgeId(edge.id),
    [],
  );
  const onEdgeMouseLeave = useCallback(() => setHoveredEdgeId(null), []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setBlastHops(null);
  }, []);

  // ── Toolbar handlers ────────────────────────────────────────────────────
  const clearFilters = useCallback(() => setFilters(defaultFilters()), []);

  const filtersActive =
    filters.search !== "" ||
    filters.nodeKinds.length > 0 ||
    filters.edgeTypes.length > 0 ||
    filters.projectIds.length > 0 ||
    filters.minConfidence > 0;

  const toggleFocus = useCallback(() => {
    setFocusActive((current) => !current);
  }, []);

  const togglePathMode = useCallback(() => {
    setPathMode((current) => {
      // Leaving path mode must also clear the highlight, or a stale answer
      // stays lit on the canvas.
      if (current) setPathEndpoints([]);
      return !current;
    });
  }, []);

  const handleSaveLayout = useCallback(() => {
    saveSavedPositions(organizationId, userId, manualPositions);
    setLayoutSavedAt(Date.now());
  }, [organizationId, userId, manualPositions]);

  const handleResetLayout = useCallback(() => {
    clearSavedPositions(organizationId, userId);
    setManualPositions({});
  }, [organizationId, userId]);

  // Auto-dismiss the save confirmation; a permanent badge would read as state.
  useEffect(() => {
    if (layoutSavedAt == null) return;
    const timer = window.setTimeout(() => setLayoutSavedAt(null), LAYOUT_SAVED_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [layoutSavedAt]);

  // ── Milestone 5/6 orchestration ─────────────────────────────────────────
  // Every handler below re-aims what is already on screen. None of them
  // navigates away, and none computes a figure: the numbers arrive in
  // `dashboard`, produced by the functions the parity matrix names (ADR-012).

  const [activeKpi, setActiveKpi] = useState<PmoKpiKey | null>(null);
  const [selectedFocusId, setSelectedFocusId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);

  // ── Collapsible panels ──────────────────────────────────────────────────
  // The canvas is the product; both side panels are now answerable to the user.
  //
  // Isabella defaults CLOSED so there is exactly one Isabella on screen — the
  // global floating widget. This panel is her findings for the current scope,
  // reached from a labelled toolbar control rather than occupying 320px at all
  // times. Read lazily so the first paint is already correct: initialising in an
  // effect would render both panels open and then collapse them, which costs a
  // reflow of the graph on every load.
  const [panels, setPanels] = useState(() =>
    loadPanelPreferences(organizationId, userId),
  );

  const handleTogglePanel = useCallback(
    (key: PmoPanelKey) => {
      setPanels((current) => {
        const next = togglePanel(current, key);
        // Persisted on the transition rather than in an effect: this is the only
        // place the value can change, so there is no state to synchronise.
        savePanelPreferences(organizationId, userId, next);
        return next;
      });
    },
    [organizationId, userId],
  );

  // ── KPI click feedback ──────────────────────────────────────────────────
  // What the last KPI click achieved. A click that resolves to nothing must say
  // so — silence is indistinguishable from a broken control.
  const [kpiFeedback, setKpiFeedback] = useState<KpiOutcome | null>(null);

  // A confirmation auto-dismisses; an empty result does not. The successful
  // case is already visible on the canvas, so the words are redundant after a
  // moment — but "nothing matched" IS the only evidence the click did anything,
  // and it must stay until the user dismisses it or clicks something else.
  useEffect(() => {
    if (kpiFeedback == null || kpiFeedback.kind === "empty") return;
    const timer = window.setTimeout(() => setKpiFeedback(null), LAYOUT_SAVED_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [kpiFeedback]);

  /**
   * Centre the camera on a set of nodes.
   *
   * `fitView` with explicit nodes rather than `setCenter`: a KPI can select a
   * dozen nodes and centring on the first would leave the rest off-screen,
   * which reads as the click having selected only one thing.
   */
  const centreOn = useCallback(
    (nodeIds: readonly string[]) => {
      if (nodeIds.length === 0) return;
      window.requestAnimationFrame(() => {
        void fitView({
          nodes: nodeIds.map((id) => ({ id })),
          padding: 0.3,
          duration: 300,
          maxZoom: 1.2,
        });
      });
    },
    [fitView],
  );

  /**
   * Apply a selection coming from a panel to the canvas.
   *
   * The canvas keeps a single-selection model (`selectedNodeId`) from Phase 1
   * while the session tracks the full set. Both are updated so the side panel
   * describes the primary node and the canvas highlights all of them, rather
   * than the two disagreeing about what is selected.
   */
  const applySelection = useCallback(
    (nodeIds: string[], focus: boolean) => {
      setSession((current) => ({
        ...current,
        selectedNodeIds: nodeIds,
        selectedEdgeId: null,
        focusedNodeId: focus ? (nodeIds[0] ?? null) : null,
      }));
      setSelectedNodeId(nodeIds[0] ?? null);
      setSelectedEdgeId(null);
      setFocusActive(focus && nodeIds.length > 0);
      centreOn(nodeIds);
    },
    [centreOn, setSession],
  );

  // ── KPI clicks ──────────────────────────────────────────────────────────
  const kpiContext = useMemo(
    () => ({
      criticalNodeIds: criticalNodes.map((item) => item.nodeId),
      // Shared resources are reported per project by the graph engine; the
      // intent binding needs the project ids those links touch.
      sharedResourceProjectIds: [
        ...new Set(
          nodes
            .filter((node) => node.kind === "resource" && node.projectId != null)
            .map((node) => node.projectId as string),
        ),
      ],
      // Blocked subjects come from the blocked-days pass, which records the
      // canonical entity — the same key graph nodes carry.
      blockedSubjectIds: dashboard.blockedDaysByProject.map(([projectId]) => projectId),
    }),
    [criticalNodes, nodes, dashboard.blockedDaysByProject],
  );

  const handleKpiClick = useCallback(
    (key: PmoKpiKey) => {
      // Clicking the lit KPI clears it, so a KPI is never a one-way trip.
      if (activeKpi === key) {
        setActiveKpi(null);
        applySelection([], false);
        onToggleDrawer("none");
        setKpiFeedback(null);
        return;
      }
      setActiveKpi(key);
      setSelectedFocusId(null);
      const intent = kpiIntent(key, nodes, kpiContext);
      // The hook applies the lens and the session half together, so the screen
      // never shows a lens that disagrees with the selection it opened for.
      onApplyKpiIntent(intent);
      applySelection(intent.selectNodeIds, intent.focus);

      // Two KPIs (health, budget variance) are explanations rather than places.
      // `openPanel` is how the binding says so, and honouring it is what makes
      // those clicks visible at all — without this they selected nothing and
      // looked broken.
      if (intent.openPanel === "health" && !panels.overview) {
        handleTogglePanel("overview");
      }
      if (intent.openPanel === "evidence" && !panels.isabella) {
        handleTogglePanel("isabella");
      }

      // Say what happened. `kpiOutcome` distinguishes "found nothing" from
      // "this figure has no nodes by nature", so an empty result never reads as
      // a bug and a real bug is never hidden behind a friendly message.
      setKpiFeedback(kpiOutcome(key, intent));
    },
    [
      activeKpi,
      nodes,
      kpiContext,
      onApplyKpiIntent,
      applySelection,
      onToggleDrawer,
      panels.overview,
      panels.isabella,
      handleTogglePanel,
    ],
  );

  // ── PMO focus ───────────────────────────────────────────────────────────
  /**
   * Which graph nodes each focus item names.
   *
   * Focus items are prose ("\"Pour slab\" is blocked on the critical path"), so
   * matching is by the project the item names plus the quoted title. Items that
   * name no entity ("4 materials need validation") resolve to nothing and say
   * so, rather than being matched to whatever is nearest.
   */
  const focusResolvedNodeIds = useMemo(() => {
    const resolved = new Map<string, string[]>();
    for (const item of dashboard.focus) {
      const quoted = item.title.match(/"([^"]+)"/)?.[1] ?? null;
      const matches = nodes
        .filter((node) => {
          if (quoted) return node.label === quoted;
          if (!item.project) return false;
          // A project-scoped item with no quoted entity points at the project.
          return node.kind === "project" && node.label === item.project;
        })
        .map((node) => node.id);
      resolved.set(item.id, matches);
    }
    return resolved;
  }, [dashboard.focus, nodes]);

  const handleSelectFocus = useCallback(
    (item: PmoFocusSlice) => {
      setSelectedFocusId((current) => (current === item.id ? null : item.id));
      setActiveKpi(null);
      const matched = focusResolvedNodeIds.get(item.id) ?? [];
      // Unresolvable items still select nothing rather than selecting something
      // arbitrary; the panel already states that they have no canvas match.
      applySelection(matched, false);
      // An item that carries evidence opens it; one that does not leaves the
      // drawer where the user put it.
      if (matched.length > 0) setDrawerOpen(true);
    },
    [focusResolvedNodeIds, applySelection],
  );

  // ── Critical path drawer ────────────────────────────────────────────────
  const criticalPathSteps = useMemo(
    () =>
      resolveCriticalPathNodes(
        dashboard.criticalPath,
        nodes.map((node) => ({
          id: node.id,
          kind: node.kind,
          label: node.label,
          projectId: node.projectId,
        })),
        projectLabelById,
      ),
    [dashboard.criticalPath, nodes, projectLabelById],
  );

  const selectedProjectLabels = useMemo(() => {
    const labels: string[] = [];
    for (const id of session.selectedNodeIds) {
      const node = nodesById.get(id);
      if (!node) continue;
      // Both a selected project and a selected task inside one narrow the
      // drawer to that project's steps.
      if (node.kind === "project") labels.push(node.label);
      else if (node.projectId) {
        const label = projectLabelById.get(node.projectId);
        if (label) labels.push(label);
      }
    }
    return [...new Set(labels)];
  }, [session.selectedNodeIds, nodesById, projectLabelById]);

  const criticalPathView = useMemo(
    () =>
      filterCriticalPathForSelection(criticalPathSteps, {
        selectedNodeIds: session.selectedNodeIds,
        selectedProjectLabels,
      }),
    [criticalPathSteps, session.selectedNodeIds, selectedProjectLabels],
  );

  const handleSelectStep = useCallback(
    (nodeId: string) => applySelection([nodeId], false),
    [applySelection],
  );

  // ── Isabella ────────────────────────────────────────────────────────────
  const scopeLabel = useMemo(
    () =>
      scope.projectIds.length === 0
        ? organizationName
        : t("scopeProjects", { count: scope.projectIds.length }),
    [scope.projectIds.length, organizationName, t],
  );

  /**
   * Ask Isabella with the dashboard's context and a MINIMAL subgraph.
   *
   * CAP-048 §6 and ADR-012 risk 4: never the whole graph. The anchors are the
   * current selection, falling back to whatever the active lens highlighted —
   * with neither, the question goes without graph context rather than with an
   * arbitrary slice of it.
   */
  const handleAskIsabella = useCallback(
    (question: string, extraAnchors: readonly string[] = []) => {
      const anchors =
        extraAnchors.length > 0
          ? extraAnchors
          : session.selectedNodeIds.length > 0
            ? session.selectedNodeIds
            : [...(lensProjection?.highlightedNodeIds ?? [])];

      const subgraph = buildIsabellaSubgraph(nodes, edges, anchors);
      const ask = buildIsabellaAsk(
        {
          lens: scope.activeLens,
          scopeLabel,
          selectedNodeIds: [...session.selectedNodeIds],
          subgraph,
          highlightedPath: path?.nodeIds ?? [],
          openEvidenceId: session.evidenceId,
        },
        question,
      );
      askIsabella(ask);
    },
    [
      session.selectedNodeIds,
      session.evidenceId,
      lensProjection,
      nodes,
      edges,
      scope.activeLens,
      scopeLabel,
      path,
    ],
  );

  const handleOpenInsightInMap = useCallback(
    (insight: PmoPiInsight) => {
      // `openInMapActivities` names ACTIVITIES (event types), which only some
      // rules carry. `affected` carries canonical entity ids, which is what the
      // canvas can actually resolve — so both are tried, activities first.
      const activities = new Set(insight.openInMapActivities ?? []);
      const affectedIds = new Set(insight.affected.map((item) => item.id));
      const matched = nodes
        .filter(
          (node) => activities.has(node.canonicalEntityId) || affectedIds.has(node.canonicalEntityId),
        )
        .map((node) => node.id);

      // The process lens is the one that explains a flow finding; switching to
      // it is part of "open in map", not a separate step for the user.
      if (matched.length > 0) {
        setLens("process");
        applySelection(matched, false);
      }
    },
    [nodes, setLens, applySelection],
  );

  const handleEvidenceOpen = useCallback(
    (insightId: string | null) =>
      setSession((current) => ({ ...current, evidenceId: insightId })),
    [setSession],
  );

  // ── Side panel context ──────────────────────────────────────────────────
  const nodeContext = useMemo<SidePanelNodeContext | null>(() => {
    if (!selectedNodeId) return null;
    const node = nodesById.get(selectedNodeId);
    if (!node) return null;

    const connectedEdges = edges.filter(
      (edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id,
    );
    const relatedRisks = connectedEdges
      .filter((edge) => edge.type === "impacts" && edge.targetNodeId === node.id)
      .map((edge) => nodesById.get(edge.sourceNodeId))
      .filter((candidate): candidate is GraphNode => candidate?.kind === "risk");

    // Children come from the full graph, not the window: a task's subtasks are
    // worth listing in the panel even before the user drills into that task.
    const children = connectedEdges
      .filter(
        (edge) =>
          (edge.type === "contains" || edge.type === "belongs_to") &&
          edge.sourceNodeId === node.id,
      )
      .map((edge) => nodesById.get(edge.targetNodeId))
      .filter((candidate): candidate is GraphNode => candidate != null);

    const costs = connectedEdges
      .filter((edge) => edge.type === "consumes_budget" && edge.targetNodeId === node.id)
      .map((edge) => nodesById.get(edge.sourceNodeId))
      .filter((candidate): candidate is GraphNode => candidate?.kind === "budget_item");

    return {
      node,
      connectedEdges,
      labelsById,
      relatedRisks,
      children,
      costs,
      critical: criticalById.get(node.id) ?? null,
      projectLabel: node.projectId ? projectLabelById.get(node.projectId) ?? null : null,
    };
  }, [selectedNodeId, nodesById, edges, labelsById, criticalById, projectLabelById]);

  const edgeContext = useMemo(() => {
    if (!selectedEdgeId) return null;
    const edge = edges.find((candidate) => candidate.id === selectedEdgeId);
    if (!edge) return null;
    return {
      edge,
      sourceLabel: labelsById.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      targetLabel: labelsById.get(edge.targetNodeId) ?? edge.targetNodeId,
    };
  }, [selectedEdgeId, edges, labelsById]);

  const closePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // ── Navigation trail ────────────────────────────────────────────────────
  // Built from the FULL node list: the labels for the levels above are needed
  // precisely when those nodes are no longer on screen.
  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(nodes, navigation, t("levelPortfolio")),
    [nodes, navigation, t],
  );

  // A level with no children is a real answer ("this milestone has no tasks"),
  // and it must not render as a blank canvas the user reads as a broken screen.
  const levelIsEmpty = projection.nodes.length === 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-lg font-extrabold text-slate-950">{t("title")}</h1>
            <p className="text-xs text-slate-500">
              {t("subtitle")} · {organizationName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import / Ask AI / Report — all three delegate to the existing
                flow rather than reimplementing a step of it (CAP-048 §6). */}
            {intelligence ? (
              <PmoTopActions
                base={base}
                projectIds={scope.projectIds}
                onAskIsabella={() => handleAskIsabella(t("askDefaultQuestion"))}
              />
            ) : null}
            {/* "Back to dashboards" removed: this is now the only dashboard, so
                the link pointed at the screen the user was already on. */}
          </div>
        </div>

        {/* Global filters own the SCOPE. They sit above everything precisely so
            it is obvious they are not one panel's private control. */}
        {intelligence ? (
          <div className="mt-3">
            <PmoGlobalFilters
              organizationName={intelligence.organizationName}
              projects={intelligence.projects}
              selectedProjectIds={scope.projectIds}
              onProjectIdsChange={setProjectIds}
              dateRange={scope.dateRange}
              onDateRangeChange={setDateRange}
              isLoading={scopeLoading}
              onReset={resetScope}
              hasActiveFilters={
                scope.projectIds.length > 0 ||
                scope.dateRange.from != null ||
                scope.dateRange.to != null
              }
            />
          </div>
        ) : null}

        {/* The unified KPI bar (M5). Every card is a control: clicking one
            changes the lens and aims the canvas, so the answer stays on the
            screen the question was asked from. Without the intelligence layer
            the Phase 1 metrics bar is what shows, unchanged. */}
        {intelligence ? (
          <div className="mt-3">
            <PmoKpiBar
              kpis={dashboard.kpis}
              locale={locale}
              activeKpi={activeKpi}
              onKpiClick={handleKpiClick}
            />
          </div>
        ) : (
          <div className="mt-3">
            <PortfolioMetricsBar metrics={metrics} locale={locale} />
          </div>
        )}

        {/* Naming the sources that failed is what turns a silent gap into an
            actionable one. */}
        {unavailableSources.length > 0 ? (
          <p
            role="status"
            className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("unavailableHint", { sources: unavailableSources.join(", ") })}
          </p>
        ) : null}

        {/* A failed reload keeps the previous data on screen and says so.
            Blanking the dashboard would lose the context the user is in. */}
        {scopeError ? (
          <p
            role="alert"
            className="mt-2 flex items-start gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("reloadFailed", { reason: scopeError })}
          </p>
        ) : null}
      </header>

      {/* The trail is always mounted, at every level. Making it conditional
          would mean the control appears only after the portfolio is already
          hidden — the exact moment the user needs it to have been there. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <GraphBreadcrumbs
          trail={breadcrumbs}
          onNavigate={handleBreadcrumb}
          onLevelUp={handleLevelUp}
          canLevelUp={navigation.level !== "portfolio"}
        />
        <p className="text-[11px] text-slate-400">{t("drillHint")}</p>
      </div>

      {/* Lenses. Every one of these reprojects the canvas below — none of them
          navigates, and none mounts a dashboard of its own. */}
      {intelligence ? (
        <div className="border-b border-slate-200 bg-white px-4 py-2">
          <PmoLensTabs
            activeLens={scope.activeLens}
            onLensChange={setLens}
            unavailable={lensUnavailable}
          />
        </div>
      ) : null}

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
        <GraphToolbar
          locale={locale}
          filters={filters}
          onFiltersChange={setFilters}
          filtersActive={filtersActive}
          onClearFilters={clearFilters}
          focusActive={focusActive}
          canFocus={selectedNodeId != null}
          onToggleFocus={toggleFocus}
          pathActive={pathMode}
          onTogglePathMode={togglePathMode}
          pathHint={pathHint}
          blastHops={blastHops}
          onBlastHopsChange={setBlastHops}
          canBlast={selectedNodeId != null}
          onSaveLayout={handleSaveLayout}
          onResetLayout={handleResetLayout}
          layoutSavedAt={layoutSavedAt}
        >
          {/* The single entry point for both side panels. It sits in the
              toolbar, with the other view controls, rather than floating over
              the canvas — the app already has one floating Isabella and a
              second would be exactly the ambiguity this removes. */}
          {intelligence ? (
            <PmoPanelToggles
              isabellaOpen={panels.isabella}
              onToggleIsabella={() => handleTogglePanel("isabella")}
              insightCount={dashboard.insights.length}
              overviewOpen={panels.overview}
              onToggleOverview={() => handleTogglePanel("overview")}
            />
          ) : null}
        </GraphToolbar>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Left rail: health, focus, and the scenario controls. All three read
            the composed model and none of them recomputes anything (ADR-012).
            Collapsible — when it is closed the canvas takes the width. */}
        {intelligence && panels.overview ? (
          <aside className="flex w-[260px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-slate-200 bg-slate-50 p-2">
            <PmoHealthPanel
              health={dashboard.health}
              activeLens={scope.activeLens}
              onLensChange={setLens}
            />
            <PmoFocusPanel
              focus={dashboard.focus}
              selectedFocusId={selectedFocusId}
              onSelectFocus={handleSelectFocus}
              resolvedNodeIds={focusResolvedNodeIds}
            />
            {/* The what-if lens frames the canvas for a scenario; the controls
                that actually run `simulateWhatIf` live here, on that lens. */}
            {scope.activeLens === "whatif" ? (
              <PmoWhatIfPanel whatIf={dashboard.whatIf} locale={locale} />
            ) : null}
          </aside>
        ) : null}

        <div className="relative min-w-0 flex-1">
          <PortfolioGraphCanvas
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onEdgeClick={onEdgeClick}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            onPaneClick={onPaneClick}
          />

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2">
            <GraphLegend locale={locale} />

            {/* Truncation is stated, never hidden — "showing N of M" is the
                difference between a partial view and a wrong one. */}
            {projection.truncated ? (
              <p className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm">
                <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                {t("truncated", {
                  shown: projection.nodes.length,
                  total: projection.totalNodeCount,
                })}
              </p>
            ) : null}

            {blast ? (
              <p className="pointer-events-auto rounded-md border border-amber-200 bg-amber-50/95 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 shadow-sm">
                {t("affectedNodes", { count: blast.totalAffected })}
              </p>
            ) : null}

            {/* What the last KPI click did. An empty result is stated here
                rather than left silent — a click with no visible effect reads
                as a broken control, which was the reported complaint. */}
            {kpiFeedback ? (
              <KpiFeedbackNotice
                outcome={kpiFeedback}
                onDismiss={() => setKpiFeedback(null)}
              />
            ) : null}
          </div>

          {levelIsEmpty ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="pointer-events-auto max-w-sm rounded-xl border border-slate-200 bg-white/95 p-5 text-center shadow-sm">
                <Network className="mx-auto h-7 w-7 text-slate-300" aria-hidden />
                <p className="mt-2 text-sm font-bold text-slate-900">{t("levelEmpty")}</p>
                <p className="mt-1 text-xs text-slate-500">{t("levelEmptyHint")}</p>
                {navigation.level !== "portfolio" ? (
                  <button
                    type="button"
                    onClick={handleLevelUp}
                    className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    {t("levelUp")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* What the lens found, in words. The canvas carries the emphasis; a
            highlighted node with no stated reason is decoration. */}
        {lensProjection ? (
          <PmoLensPanel
            projection={lensProjection}
            labelsById={labelsById}
            onSelectNode={setSelectedNodeId}
          />
        ) : null}

        {/* Isabella's six deterministic rules, with the real evidence package
            behind each one and feedback that goes to the EXISTING action.
            Opened from the toolbar control, closed by default: the app has ONE
            Isabella and it is the global floating widget. */}
        {intelligence && panels.isabella ? (
          <PmoInsightsPanel
            insights={dashboard.insights}
            locale={locale}
            scopeLabel={scopeLabel}
            onOpenInMap={handleOpenInsightInMap}
            onEvidenceOpen={handleEvidenceOpen}
            onClose={() => handleTogglePanel("isabella")}
            onAskIsabella={(insight) =>
              handleAskIsabella(
                t("askAboutInsight", { title: insight.title[locale] }),
                nodes
                  .filter((node) =>
                    insight.affected.some((item) => item.id === node.canonicalEntityId),
                  )
                  .map((node) => node.id),
              )
            }
          />
        ) : null}

        <GraphSidePanel
          locale={locale}
          base={base}
          nodeContext={nodeContext}
          edgeContext={edgeContext}
          onClose={closePanel}
        />
      </div>

      {/* The critical path drawer sits at the bottom, across the full width:
          it is about the portfolio's schedule, not about one panel's selection,
          even though the selection narrows it. */}
      {intelligence ? (
        <PmoCriticalPathDrawer
          steps={criticalPathView.steps}
          contextual={criticalPathView.contextual}
          contextLabel={selectedProjectLabels[0] ?? null}
          open={drawerOpen}
          onToggle={() => setDrawerOpen((current) => !current)}
          selectedNodeIds={session.selectedNodeIds}
          onSelectStep={handleSelectStep}
        />
      ) : null}
    </div>
  );
}

/**
 * The result of the last KPI click, in words.
 *
 * Tone carries the distinction the message makes: an "applied" result is
 * confirmation and reads quietly; an "empty" one is the case a user would
 * otherwise interpret as a dead button, so it is amber and dismissible.
 *
 * `role="status"` rather than `role="alert"`: this is the outcome of something
 * the user just did deliberately, not an interruption.
 */
function KpiFeedbackNotice({
  outcome,
  onDismiss,
}: {
  outcome: KpiOutcome;
  onDismiss: () => void;
}) {
  const t = useTranslations("pmoIntelligence");
  const isEmpty = outcome.kind === "empty";

  return (
    <p
      role="status"
      className={`pointer-events-auto flex max-w-xs items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm ${
        isEmpty
          ? "border-amber-200 bg-amber-50/95 text-amber-800"
          : "border-emerald-200 bg-emerald-50/95 text-emerald-800"
      }`}
    >
      {isEmpty ? (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : null}
      <span className="min-w-0 flex-1">
        {t(outcome.messageKey, { count: outcome.selectedCount })}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("kpiOutcomeDismiss")}
        title={t("kpiOutcomeDismiss")}
        className="shrink-0 rounded p-0.5 hover:bg-black/5"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </p>
  );
}
