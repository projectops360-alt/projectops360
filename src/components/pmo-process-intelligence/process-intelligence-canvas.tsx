"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeMouseHandler,
  type OnNodeDrag,
  type Viewport,
} from "@xyflow/react";
import type { PmoPiFilters } from "@/lib/pmo-process-intelligence/contracts";
import type { PmoPiExecutivePortfolioModel } from "@/lib/pmo-process-intelligence/executive-projection";
import {
  buildProcessGraphProjection,
  processGraphNodeLabel,
  resolveProcessGraphEntity,
} from "@/lib/pmo-process-intelligence/process-graph.adapter";
import type {
  ProcessGraphEntity,
  ProcessGraphHierarchyModel,
  ProcessGraphScreenContext,
} from "@/lib/pmo-process-intelligence/process-graph.types";
import {
  clearProcessGraphLayout,
  loadProcessGraphLayout,
  saveProcessGraphLayout,
  type ProcessGraphLayoutScope,
  type ProcessGraphSavedPosition,
} from "@/lib/pmo-process-intelligence/process-graph-layout-storage";
import { publishIsabellaScreenContext } from "@/lib/isabella/screen-context-event";
import { askIsabella } from "@/lib/isabella/ask-isabella";
import { LivingGraphLayoutControls } from "@/components/graph/living-graph-layout-controls";
import { ProcessGraphViewport } from "./graph/process-graph-viewport";
import { ProcessGraphToolbar } from "./graph/process-graph-toolbar";
import { ProcessGraphLegend } from "./graph/process-graph-legend";
import { ProcessGraphBreadcrumbs } from "./graph/process-graph-breadcrumbs";
import { ProcessNodeContextMenu } from "./graph/process-node-context-menu";
import { ProcessNodeDetailDrawer } from "./graph/process-node-detail-drawer";
import {
  type ProcessGraphFlowEdge,
  type ProcessGraphFlowNode,
} from "./graph/process-graph-flow-types";
import { useProcessGraphLayout } from "./graph/use-process-graph-layout";
import { useProcessGraphState } from "./graph/use-process-graph-state";

export interface ProcessIntelligenceCanvasProps {
  locale: "en" | "es";
  base: string;
  route: string;
  organizationId: string;
  userId: string;
  organizationName: string;
  executiveModel: PmoPiExecutivePortfolioModel;
  hierarchy: ProcessGraphHierarchyModel;
  layer: Exclude<PmoPiFilters["overlay"], "whatif">;
  dateFrom: string;
  dateTo: string;
  search: string;
  projectFilterIds: string[];
  focusProjectId?: string | null;
  onProjectSelect?: (projectId: string | null) => void;
  onOpenTechnicalEvents: () => void;
}

export function ProcessIntelligenceCanvas(
  props: ProcessIntelligenceCanvasProps,
) {
  return (
    <ReactFlowProvider>
      <ProcessIntelligenceCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function ProcessIntelligenceCanvasInner({
  locale,
  base,
  route,
  organizationId,
  userId,
  organizationName,
  executiveModel,
  hierarchy,
  layer,
  dateFrom,
  dateTo,
  search,
  projectFilterIds,
  focusProjectId = null,
  onProjectSelect,
  onOpenTechnicalEvents,
}: ProcessIntelligenceCanvasProps) {
  const graph = useProcessGraphState();
  const {
    drillDown,
    expandedNodeIds,
    hoveredNodeId,
    selectNode,
    selectedSet,
    semanticZoom,
    setNavigation,
    toggleExpanded,
  } = graph;
  const {
    fitView,
    getNode,
    getNodes,
    getViewport,
    setCenter,
    setViewport,
    zoomTo,
  } = useReactFlow<ProcessGraphFlowNode, ProcessGraphFlowEdge>();
  const rootRef = useRef<HTMLDivElement>(null);
  const nodeClickTimerRef = useRef<number | null>(null);
  const movingViewportRef = useRef<Viewport>(graph.viewport);
  const [manualPositions, setManualPositions] = useState<
    Map<string, ProcessGraphSavedPosition>
  >(() => new Map());
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);
  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const motionDuration = prefersReducedMotion ? 0 : 180;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const projection = useMemo(
    () =>
      buildProcessGraphProjection({
        locale,
        base,
        executive: executiveModel,
        hierarchy,
        navigation: graph.navigation,
        semanticZoom: graph.semanticZoom,
        expandedNodeIds: graph.expandedNodeIds,
        layer,
      }),
    [
      base,
      executiveModel,
      graph.expandedNodeIds,
      graph.navigation,
      graph.semanticZoom,
      hierarchy,
      layer,
      locale,
    ],
  );

  const positions = useProcessGraphLayout({
    entities: projection.entities,
    connections: projection.connections,
    manualPositions,
  });

  const relatedNodeIds = useMemo(() => {
    const focusId =
      graph.hoveredNodeId ??
      graph.selectedNodeIds[0] ??
      null;
    const ids = new Set<string>();
    if (focusId) {
      ids.add(focusId);
      for (const edge of projection.connections) {
        if (edge.source === focusId || edge.target === focusId) {
          ids.add(edge.source);
          ids.add(edge.target);
        }
      }
    } else if (graph.hoveredEdgeId) {
      const edge = projection.connections.find(
        (candidate) => candidate.id === graph.hoveredEdgeId,
      );
      if (edge) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    return ids;
  }, [
    graph.hoveredEdgeId,
    graph.hoveredNodeId,
    graph.selectedNodeIds,
    projection.connections,
  ]);

  const derivedNodes = useMemo<ProcessGraphFlowNode[]>(
    () =>
      projection.entities.map((entity) => ({
        id: entity.id,
        type: entity.kind,
        position: positions.get(entity.id) ?? { x: 0, y: 0 },
        selected: selectedSet.has(entity.id),
        draggable: true,
        focusable: true,
        data: {
          entity,
          semanticZoom,
          layer,
          expanded: expandedNodeIds.has(entity.id),
          hovered: hoveredNodeId === entity.id,
          dimmed:
            relatedNodeIds.size > 0 && !relatedNodeIds.has(entity.id),
          locale,
          onToggleExpanded: (nodeId: string) => {
            toggleExpanded(nodeId);
            if (semanticZoom === "far") {
              void zoomTo(0.9, { duration: motionDuration });
            }
          },
        },
      })),
    [
      expandedNodeIds,
      hoveredNodeId,
      layer,
      locale,
      motionDuration,
      positions,
      projection.entities,
      relatedNodeIds,
      selectedSet,
      semanticZoom,
      toggleExpanded,
      zoomTo,
    ],
  );
  const derivedEdges = useMemo<ProcessGraphFlowEdge[]>(
    () =>
      projection.connections.map((connection) => {
        const activeNode =
          graph.hoveredNodeId ?? graph.selectedNodeIds[0] ?? null;
        return {
          id: connection.id,
          source: connection.source,
          target: connection.target,
          type: "processGraph",
          selected: graph.selectedEdgeIds.includes(connection.id),
          focusable: true,
          data: {
            connection,
            hovered: graph.hoveredEdgeId === connection.id,
            dimmed:
              graph.hoveredEdgeId != null
                ? graph.hoveredEdgeId !== connection.id
                : activeNode != null &&
                  connection.source !== activeNode &&
                  connection.target !== activeNode,
            locale,
          },
        };
      }),
    [
      graph.hoveredEdgeId,
      graph.hoveredNodeId,
      graph.selectedEdgeIds,
      graph.selectedNodeIds,
      locale,
      projection.connections,
    ],
  );

  const [nodes, setNodes, onNodesChange] =
    useNodesState<ProcessGraphFlowNode>(derivedNodes);
  const [edges, setEdges] =
    useEdgesState<ProcessGraphFlowEdge>(derivedEdges);

  useEffect(() => setNodes(derivedNodes), [derivedNodes, setNodes]);
  useEffect(() => setEdges(derivedEdges), [derivedEdges, setEdges]);

  const layoutScope = useMemo<ProcessGraphLayoutScope>(
    () => ({
      userId,
      organizationId,
      navigation: graph.navigation,
      activeLayer: layer,
      projectIds: projectFilterIds,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    }),
    [
      dateFrom,
      dateTo,
      graph.navigation,
      layer,
      organizationId,
      projectFilterIds,
      userId,
    ],
  );
  const layoutScopeKey = JSON.stringify(layoutScope);

  const applySavedLayout = useCallback(() => {
    const saved = loadProcessGraphLayout(layoutScope);
    setHasSavedLayout(saved != null);
    setHasUnsavedLayout(false);
    setManualPositions(
      new Map(Object.entries(saved?.nodes ?? {})),
    );
    if (saved?.viewport) {
      window.setTimeout(
        () => void setViewport(saved.viewport, { duration: motionDuration }),
        0,
      );
    } else {
      window.setTimeout(
        () => void fitView({ padding: 0.18, duration: motionDuration }),
        0,
      );
    }
  }, [fitView, layoutScope, motionDuration, setViewport]);

  useEffect(() => {
    const timeout = window.setTimeout(applySavedLayout, 0);
    return () => window.clearTimeout(timeout);
  }, [applySavedLayout, layoutScopeKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("graphLevel", graph.navigation.level);
    const nodeId =
      graph.navigation.milestoneId ??
      graph.navigation.projectId ??
      graph.navigation.stageKey ??
      "";
    if (nodeId) url.searchParams.set("graphNode", nodeId);
    else url.searchParams.delete("graphNode");
    window.history.replaceState(window.history.state, "", url);
  }, [graph.navigation]);

  const selectedEntity =
    projection.entities.find(
      (entity) => entity.id === graph.drawerNodeId,
    ) ??
    (graph.drawerNodeId
      ? resolveProcessGraphEntity(graph.drawerNodeId, {
          locale,
          base,
          executive: executiveModel,
          hierarchy,
        })
      : null);
  const selectedConnection =
    projection.connections.find(
      (connection) => connection.id === graph.drawerEdgeId,
    ) ?? null;
  const contextEntity = graph.contextMenu
    ? projection.entities.find(
        (entity) => entity.id === graph.contextMenu?.nodeId,
      ) ??
      resolveProcessGraphEntity(graph.contextMenu.nodeId, {
        locale,
        base,
        executive: executiveModel,
        hierarchy,
      })
    : null;

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = getNode(nodeId);
      if (!node) return;
      const width = node.measured?.width ?? 240;
      const height = node.measured?.height ?? 140;
      void setCenter(
        node.position.x + width / 2,
        node.position.y + height / 2,
        {
          zoom: Math.max(1, getViewport().zoom),
          duration: prefersReducedMotion ? 0 : 220,
        },
      );
      selectNode(nodeId);
    },
    [getNode, getViewport, prefersReducedMotion, selectNode, setCenter],
  );

  useEffect(() => {
    if (!focusProjectId) return;
    const project = executiveModel.projects.find(
      (candidate) => candidate.id === focusProjectId,
    );
    if (!project) return;
    setNavigation({
      level: "project",
      stageKey: project.currentStage,
      projectId: project.id,
      milestoneId: null,
    });
  }, [executiveModel.projects, focusProjectId, setNavigation]);

  useEffect(() => {
    const currentId =
      graph.hoveredNodeId ?? graph.selectedNodeIds[0] ?? null;
    const current = currentId
      ? resolveProcessGraphEntity(currentId, {
          locale,
          base,
          executive: executiveModel,
          hierarchy,
        })
      : null;
    const screenContext: ProcessGraphScreenContext = {
      route,
      dashboardMode: "process-intelligence-beta",
      organizationId,
      portfolioId: null,
      programId: null,
      projectId:
        graph.navigation.projectId ?? current?.projectId ?? null,
      hierarchyLevel: graph.navigation.level,
      activeLayer: layer,
      hoveredNodeId: graph.hoveredNodeId,
      hoveredEdgeId: graph.hoveredEdgeId,
      selectedNodeIds: graph.selectedNodeIds,
      selectedEdgeIds: graph.selectedEdgeIds,
      visibleNodeIds: nodes.map((node) => node.id),
      visibleNodeCount: nodes.length,
      visibleEdgeIds: edges.map((edge) => edge.id),
      visibleEdgeCount: edges.length,
      dateRange: {
        from: dateFrom || null,
        to: dateTo || null,
      },
      filters: {
        projectIds: projectFilterIds,
        search,
        stageKey: graph.navigation.stageKey,
      },
      viewport: graph.viewport,
      currentMetrics: current?.metrics ?? null,
      activeBottleneck: projection.activeBottleneck,
      activeVariant: projection.activeVariant,
      dataQuality: projection.dataQualityScore,
      language: locale,
      visibleNodeLabels: nodes.map((node) => node.data.entity.label),
    };
    publishIsabellaScreenContext({
      module: "process_mining",
      screen: "process_intelligence_canvas",
      pageTitle:
        locale === "es"
          ? "Canvas PMO de Process Intelligence"
          : "PMO Process Intelligence Canvas",
      pathname: route,
      tab: layer,
      workflow:
        locale === "es"
          ? "Navegar organización, etapas, proyectos, hitos y actividades."
          : "Navigate organization, stages, projects, milestones and activities.",
      components: [
        "Process graph viewport",
        "Graph toolbar",
        "Graph breadcrumbs",
        "Graph minimap",
        "Node detail drawer",
      ],
      projectId: screenContext.projectId ?? undefined,
      processGraph: screenContext,
    });
  }, [
    base,
    dateFrom,
    dateTo,
    edges,
    executiveModel,
    graph.hoveredEdgeId,
    graph.hoveredNodeId,
    graph.navigation,
    graph.selectedEdgeIds,
    graph.selectedNodeIds,
    graph.viewport,
    hierarchy,
    layer,
    locale,
    nodes,
    organizationId,
    projectFilterIds,
    projection.activeBottleneck,
    projection.activeVariant,
    projection.dataQualityScore,
    route,
    search,
  ]);
  useEffect(
    () => () => publishIsabellaScreenContext(null),
    [],
  );
  useEffect(
    () => () => {
      if (nodeClickTimerRef.current != null) {
        window.clearTimeout(nodeClickTimerRef.current);
      }
    },
    [],
  );

  const handleNodeClick: NodeMouseHandler<ProcessGraphFlowNode> = useCallback(
    (event, node) => {
      if (nodeClickTimerRef.current != null) {
        window.clearTimeout(nodeClickTimerRef.current);
      }
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      nodeClickTimerRef.current = window.setTimeout(() => {
        selectNode(node.id, additive);
        if (node.data.entity.kind === "project") {
          onProjectSelect?.(node.data.entity.projectId);
        }
        nodeClickTimerRef.current = null;
      }, 220);
    },
    [onProjectSelect, selectNode],
  );
  const handleNodeDoubleClick: NodeMouseHandler<ProcessGraphFlowNode> =
    useCallback(
      (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        if (nodeClickTimerRef.current != null) {
          window.clearTimeout(nodeClickTimerRef.current);
          nodeClickTimerRef.current = null;
        }
        drillDown(node.data.entity);
      },
      [drillDown],
    );
  const handleNodeContextMenu: NodeMouseHandler<ProcessGraphFlowNode> =
    useCallback(
      (event, node) => {
        event.preventDefault();
        const root = rootRef.current?.getBoundingClientRect();
        graph.setContextMenu({
          nodeId: node.id,
          x: Math.max(
            8,
            Math.min((root?.width ?? 800) - 250, event.clientX - (root?.left ?? 0)),
          ),
          y: Math.max(
            8,
            Math.min((root?.height ?? 620) - 360, event.clientY - (root?.top ?? 0)),
          ),
        });
      },
      [graph],
    );
  const handleNodeDrag: OnNodeDrag<ProcessGraphFlowNode> = useCallback(() => {
    setHasUnsavedLayout(true);
  }, []);
  const handleNodeDragStop: OnNodeDrag<ProcessGraphFlowNode> = useCallback(
    (_event, node) => {
      setManualPositions((current) => {
        const next = new Map(current);
        next.set(node.id, node.position);
        return next;
      });
      setHasUnsavedLayout(true);
    },
    [],
  );

  const saveLayout = useCallback(() => {
    setSavingLayout(true);
    const nodePositions = Object.fromEntries(
      getNodes().map((node) => [node.id, node.position]),
    );
    const ok = saveProcessGraphLayout(
      layoutScope,
      nodePositions,
      getViewport(),
    );
    setHasSavedLayout(ok);
    setHasUnsavedLayout(!ok);
    setSavingLayout(false);
  }, [getNodes, getViewport, layoutScope]);
  const resetAutoLayout = useCallback(() => {
    setManualPositions(new Map());
    setHasUnsavedLayout(hasSavedLayout);
    window.setTimeout(
      () => void fitView({ padding: 0.18, duration: motionDuration }),
      0,
    );
  }, [fitView, hasSavedLayout, motionDuration]);
  const clearSaved = useCallback(() => {
    clearProcessGraphLayout(layoutScope);
    setHasSavedLayout(false);
    setHasUnsavedLayout(false);
    setManualPositions(new Map());
    window.setTimeout(
      () => void fitView({ padding: 0.18, duration: motionDuration }),
      0,
    );
  }, [fitView, layoutScope, motionDuration]);
  const resetNodePosition = useCallback(
    (nodeId: string) => {
      setManualPositions((current) => {
        const next = new Map(current);
        next.delete(nodeId);
        return next;
      });
      setHasUnsavedLayout(true);
      window.setTimeout(
        () => void fitView({ padding: 0.18, duration: motionDuration }),
        0,
      );
    },
    [fitView, motionDuration],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!rootRef.current?.contains(event.target as Node)) return;
      if (event.key === "Enter") {
        const nodeElement = (event.target as HTMLElement).closest<HTMLElement>(
          ".react-flow__node[data-id]",
        );
        const nodeId = nodeElement?.dataset.id;
        if (nodeId) {
          event.preventDefault();
          selectNode(
            nodeId,
            event.ctrlKey || event.metaKey || event.shiftKey,
          );
        }
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        return;
      }
      const selectedId = graph.selectedNodeIds[0];
      const selected = selectedId ? getNode(selectedId) : null;
      if (!selected) return;
      const candidates = getNodes()
        .filter((node) => node.id !== selected.id)
        .map((node) => {
          const dx = node.position.x - selected.position.x;
          const dy = node.position.y - selected.position.y;
          const valid =
            (event.key === "ArrowLeft" && dx < 0) ||
            (event.key === "ArrowRight" && dx > 0) ||
            (event.key === "ArrowUp" && dy < 0) ||
            (event.key === "ArrowDown" && dy > 0);
          const score =
            event.key === "ArrowLeft" || event.key === "ArrowRight"
              ? Math.abs(dx) + Math.abs(dy) * 2
              : Math.abs(dy) + Math.abs(dx) * 2;
          return { node, valid, score };
        })
        .filter((item) => item.valid)
        .sort((left, right) => left.score - right.score);
      const next = candidates[0]?.node;
      if (!next) return;
      event.preventDefault();
      focusNode(next.id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    focusNode,
    getNode,
    getNodes,
    graph.selectedNodeIds,
    selectNode,
  ]);

  const askAboutEntity = useCallback(
    (entity: ProcessGraphEntity | null) => {
      askIsabella({
        query: entity
          ? locale === "es"
            ? `Explícame ${entity.label} usando el contexto visible del canvas.`
            : `Explain ${entity.label} using the visible canvas context.`
          : locale === "es"
            ? "¿Qué estoy viendo en este canvas?"
            : "What am I looking at on this canvas?",
        entity: entity
          ? {
              type: entity.kind,
              id: entity.id.replace(/^[^:]+:/, ""),
              title: entity.label,
            }
          : undefined,
      });
    },
    [locale],
  );
  const breadcrumbLabels = useMemo(
    () => ({
      stageLabel: graph.navigation.stageKey
        ? processGraphNodeLabel(`stage:${graph.navigation.stageKey}`, {
            executive: executiveModel,
            hierarchy,
            locale,
          })
        : null,
      projectLabel: graph.navigation.projectId
        ? processGraphNodeLabel(`project:${graph.navigation.projectId}`, {
            executive: executiveModel,
            hierarchy,
            locale,
          })
        : null,
      milestoneLabel: graph.navigation.milestoneId
        ? processGraphNodeLabel(`milestone:${graph.navigation.milestoneId}`, {
            executive: executiveModel,
            hierarchy,
            locale,
          })
        : null,
    }),
    [executiveModel, graph.navigation, hierarchy, locale],
  );

  return (
    <section
      ref={rootRef}
      aria-label={
        locale === "es"
          ? "Canvas interactivo de Process Intelligence"
          : "Interactive Process Intelligence canvas"
      }
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-slate-50 p-3"
          : "relative flex min-h-[680px] flex-col"
      }
    >
      <div className="grid gap-2 pb-2 lg:grid-cols-[minmax(0,1fr)_auto]">
        <ProcessGraphBreadcrumbs
          locale={locale}
          organizationName={organizationName}
          navigation={graph.navigation}
          stageLabel={breadcrumbLabels.stageLabel}
          projectLabel={breadcrumbLabels.projectLabel}
          milestoneLabel={breadcrumbLabels.milestoneLabel}
          onOrganization={graph.resetNavigation}
          onBack={graph.goBack}
        />
        <ProcessGraphToolbar
          locale={locale}
          entities={projection.entities}
          semanticZoom={graph.semanticZoom}
          layer={layer}
          canGoBack={graph.navigation.level !== "organization"}
          fullscreen={fullscreen}
          onFocusNode={focusNode}
          onFitView={() =>
            void fitView({ padding: 0.18, duration: motionDuration })
          }
          onReset={resetAutoLayout}
          onBack={graph.goBack}
          onToggleFullscreen={() => setFullscreen((current) => !current)}
        />
      </div>
      <div className="relative h-[600px] min-h-[600px] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <ProcessGraphViewport
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeMouseEnter={(_event, node) => graph.setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => graph.setHoveredNodeId(null)}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onEdgeClick={(event, edge) =>
            graph.selectEdge(
              edge.id,
              event.ctrlKey || event.metaKey || event.shiftKey,
            )
          }
          onEdgeMouseEnter={(_event, edge) =>
            graph.setHoveredEdgeId(edge.id)
          }
          onEdgeMouseLeave={() => graph.setHoveredEdgeId(null)}
          onPaneClick={graph.clearSelection}
          onMove={(_event, viewport) => {
            movingViewportRef.current = viewport;
          }}
          onMoveEnd={(_event, viewport) => {
            movingViewportRef.current = viewport;
            graph.setViewport(viewport);
          }}
        />
        <LivingGraphLayoutControls
          locale={locale}
          hasUnsaved={hasUnsavedLayout}
          hasSaved={hasSavedLayout}
          saving={savingLayout}
          onSave={saveLayout}
          onResetSaved={applySavedLayout}
          onResetAuto={resetAutoLayout}
          onClear={clearSaved}
        />
        <ProcessGraphLegend locale={locale} semanticZoom={graph.semanticZoom} />
        {graph.contextMenu && contextEntity ? (
          <ProcessNodeContextMenu
            locale={locale}
            entity={contextEntity}
            x={graph.contextMenu.x}
            y={graph.contextMenu.y}
            expanded={graph.expandedNodeIds.has(contextEntity.id)}
            onDetails={() => {
              graph.selectNode(contextEntity.id);
              graph.setContextMenu(null);
            }}
            onFocus={() => {
              focusNode(contextEntity.id);
              graph.setContextMenu(null);
            }}
            onToggleExpanded={() => {
              graph.toggleExpanded(contextEntity.id);
              graph.setContextMenu(null);
            }}
            onDrillDown={() => {
              graph.drillDown(contextEntity);
              graph.setContextMenu(null);
            }}
            onOpenHref={() => {
              if (contextEntity.href) window.location.assign(contextEntity.href);
            }}
            onEvidence={() => {
              graph.selectNode(contextEntity.id);
              graph.setContextMenu(null);
            }}
            onOpenTechnicalEvents={() => {
              graph.setContextMenu(null);
              onOpenTechnicalEvents();
            }}
            onResetPosition={() => {
              resetNodePosition(contextEntity.id);
              graph.setContextMenu(null);
            }}
            onAskIsabella={() => {
              askAboutEntity(contextEntity);
              graph.setContextMenu(null);
            }}
            onClose={() => graph.setContextMenu(null)}
          />
        ) : null}
        <ProcessNodeDetailDrawer
          locale={locale}
          entity={selectedEntity}
          connection={selectedConnection}
          onClose={graph.clearSelection}
          onDrillDown={() => {
            if (selectedEntity) graph.drillDown(selectedEntity);
          }}
          onAskIsabella={() => askAboutEntity(selectedEntity)}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <p>
          {nodes.length} {locale === "es" ? "nodos visibles" : "visible nodes"} ·{" "}
          {edges.length} {locale === "es" ? "conexiones" : "connections"}
        </p>
        <button
          type="button"
          onClick={onOpenTechnicalEvents}
          className="font-semibold text-emerald-700 hover:underline"
        >
          {locale === "es"
            ? "Abrir evidencia técnica de eventos"
            : "Open technical event evidence"}
        </button>
      </div>
    </section>
  );
}
