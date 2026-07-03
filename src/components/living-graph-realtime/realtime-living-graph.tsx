"use client";

// ============================================================================
// ProjectOps360° — Realtime Living Graph · Client orchestrator (Task 5)
// ============================================================================
// The high-fidelity realtime consumer of the Task 4 hierarchy-safe delta/sync
// contract. It NEVER queries project_event_log, NEVER subscribes to Supabase
// directly, NEVER recalculates graph truth — it consumes the approved delta,
// accumulates a view model, and narrows correctly: Milestone → Tasks →
// Subtasks → Child Subtasks → Evidence only when the overlay is enabled.
// Expand/collapse is scoped and never leaks; layout/expansion are presentation
// state and never mutate canonical data.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Bot, Layers, ListTree, RotateCcw } from "lucide-react";
import { askIsabella } from "@/lib/isabella/ask-isabella";
import { localizedHref } from "@/i18n/href";
import type { HierarchicalGraphDelta, LivingGraphRootScope } from "@/lib/living-graph/realtime";
import { assessGraphLoad, resolvePerfBudget } from "@/lib/living-graph/realtime";
import {
  applyDelta,
  rebuildFromDeltas,
  markChangesAgainstPrevious,
  emptyViewModel,
  selectVisibleGraph,
  scopedExpandableNodeIds,
  expansionScopeKey,
  emptyExpansion,
  toggleExpanded,
  expandAllScoped,
  collapseAllScoped,
  resetScope,
  expandedIds,
  computeRealtimeLayout,
  applySyncResponse,
  markStaleIfExpired,
  nodeOwnerName,
  type RealtimeLayoutMode,
  type RealtimeGraphViewModel,
  type RealtimeSyncState,
} from "@/lib/living-graph-realtime-ui";
import {
  getRealtimeGraphSignatureAction,
  getRealtimeGraphSnapshotAction,
} from "@/app/[locale]/(app)/projects/[projectId]/execution-map/realtime/actions";
import { REALTIME_NODE_TYPES, realtimeNodeType, type RealtimeNodeData } from "./realtime-graph-nodes";
import { RealtimeSyncBar } from "./realtime-sync-bar";
import { RealtimeNodeInspector } from "./realtime-node-inspector";
import { useLiveGraphSync } from "./use-live-graph-sync";

const EDGE_STYLE: Record<string, { stroke: string; dash?: string }> = {
  hierarchy: { stroke: "#7c3aed" },
  dependency: { stroke: "#64748b", dash: "6 4" },
  evidence: { stroke: "#10b981", dash: "2 4" },
  milestone_flow: { stroke: "#f59e0b" },
};

export interface RealtimeLivingGraphProps {
  projectId: string;
  organizationId: string;
  userId: string;
  locale: string;
  initialDelta: HierarchicalGraphDelta;
  ownerNames: Record<string, string>;
  milestones: { id: string; title: string }[];
  /** Content signature of the initial snapshot (drives the polling sync). */
  initialSignature: string;
}

// The realtime consumer uses the LGRE "polling" delivery fallback until the
// live Supabase channel is wired: poll a cheap signature, refetch on change.
const POLL_INTERVAL_MS = 10_000;
const FRESHNESS_BUDGET_MS = 25_000;

function Inner(props: RealtimeLivingGraphProps) {
  const t = useTranslations("realtimeGraph");
  const router = useRouter();
  const { fitView } = useReactFlow();

  // ── View model from the approved initial delta (Task 4) ──
  const [model, setModel] = useState<RealtimeGraphViewModel>(() => {
    const empty = emptyViewModel(props.initialDelta.scope.projectId, props.initialDelta.scope.organizationId);
    const res = applyDelta(empty, props.initialDelta);
    return res.applied ? res.model : empty;
  });
  const [syncState, setSyncState] = useState<RealtimeSyncState>(() =>
    applySyncResponse({ kind: "noop", reason: "initial_snapshot", deltas: [], snapshot: null, targetVersion: props.initialDelta.producedVersion }, props.initialDelta.generatedAt),
  );
  const [ownerNames, setOwnerNames] = useState(props.ownerNames);
  const signatureRef = useRef(props.initialSignature);
  const modelRef = useRef(model);
  modelRef.current = model;
  const lastSyncMsRef = useRef(Date.now());
  const busyRef = useRef(false);

  // Refetch the approved snapshot delta and full-resync the view model. Shared
  // by the LIVE push (instant, on a typed notice) and the polling fallback.
  const refetchSnapshot = useCallback(
    async (reason: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const { snapshot } = await getRealtimeGraphSnapshotAction(props.projectId);
        if (!snapshot) return;
        signatureRef.current = snapshot.signature;
        setOwnerNames(snapshot.ownerNames);
        const rebuilt = rebuildFromDeltas(snapshot.projectId, snapshot.organizationId, [snapshot.delta]);
        setModel((prev) => markChangesAgainstPrevious(rebuilt, prev));
        lastSyncMsRef.current = Date.now();
        setSyncState(applySyncResponse({ kind: "deltas", reason, deltas: [], snapshot: null, targetVersion: modelRef.current.version + 1 }, new Date().toISOString()));
      } finally {
        busyRef.current = false;
      }
    },
    [props.projectId],
  );

  // ── LIVE push (LGRE Task 2 subscription → typed notices → instant refetch) ──
  const { connected: liveConnected } = useLiveGraphSync({
    projectId: props.projectId,
    organizationId: props.organizationId,
    userId: props.userId,
    onChange: () => void refetchSnapshot("realtime_push"),
    onConnectionChange: (state) => {
      if (state === "live") {
        lastSyncMsRef.current = Date.now();
        setSyncState((s) => ({ ...s, freshness: "live", reason: "realtime_connected", lastSyncedAt: new Date().toISOString() }));
      }
    },
  });

  // ── Polling fallback (LGRE ladder). Runs slower while the live channel is
  //    connected (safety net); primary delivery when the channel is down. ──
  useEffect(() => {
    let cancelled = false;
    const interval = liveConnected ? POLL_INTERVAL_MS * 3 : POLL_INTERVAL_MS;
    const tick = async () => {
      try {
        const { signature } = await getRealtimeGraphSignatureAction(props.projectId);
        if (cancelled) return;
        if (signature == null) {
          setSyncState((s) => markStaleIfExpired(s, Date.now() - lastSyncMsRef.current, FRESHNESS_BUDGET_MS));
          return;
        }
        if (signature === signatureRef.current) {
          lastSyncMsRef.current = Date.now();
          setSyncState((s) => (s.freshness === "stale" ? { ...s, freshness: "live", lastSyncedAt: new Date().toISOString() } : { ...s, lastSyncedAt: new Date().toISOString() }));
          return;
        }
        await refetchSnapshot("polled_update");
      } catch {
        if (!cancelled) setSyncState((s) => markStaleIfExpired(s, Date.now() - lastSyncMsRef.current, FRESHNESS_BUDGET_MS));
      }
    };
    const timer = window.setInterval(tick, interval);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [props.projectId, liveConnected, refetchSnapshot]);

  const [rootScope, setRootScope] = useState<LivingGraphRootScope>({ type: "project", id: null });
  const [expansion, setExpansion] = useState(emptyExpansion());
  const [evidenceOverlay, setEvidenceOverlay] = useState(false);
  const [dependencyOverlay, setDependencyOverlay] = useState(false);
  const [layoutMode, setLayoutMode] = useState<RealtimeLayoutMode>("mind_map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const scopeKey = useMemo(() => expansionScopeKey(props.projectId, rootScope), [props.projectId, rootScope]);
  const expandedSet = useMemo(() => new Set(expandedIds(expansion, scopeKey)), [expansion, scopeKey]);

  const ctx = useMemo(
    () => ({ rootScope, expandedIds: expandedSet, evidenceOverlay, dependencyOverlay }),
    [rootScope, expandedSet, evidenceOverlay, dependencyOverlay],
  );

  const visible = useMemo(() => selectVisibleGraph(model, ctx), [model, ctx]);
  const filteredNodes = useMemo(() => {
    if (!statusFilter) return visible.nodes;
    return visible.nodes.filter((n) => {
      const s = n.payload.status;
      return typeof s === "string" && s === statusFilter;
    });
  }, [visible.nodes, statusFilter]);
  const positions = useMemo(() => computeRealtimeLayout(filteredNodes, layoutMode), [filteredNodes, layoutMode]);

  const toggleExpand = useCallback(
    (nodeId: string) => setExpansion((s) => toggleExpanded(s, scopeKey, nodeId)),
    [scopeKey],
  );

  const rfNodes = useMemo<Node<RealtimeNodeData>[]>(
    () =>
      filteredNodes.map((n) => ({
        id: n.nodeId,
        type: realtimeNodeType(n.nodeKind),
        position: positions.get(n.nodeId) ?? { x: 0, y: 0 },
        selected: n.nodeId === selectedId,
        data: {
          node: n,
          ownerName: nodeOwnerName(n, ownerNames),
          expanded: expandedSet.has(n.nodeId),
          isCurrentVersion: n.changedAtVersion === model.version && model.version > 1,
          onToggleExpand: toggleExpand,
          onOpenInspector: setSelectedId,
        },
      })),
    [filteredNodes, positions, selectedId, expandedSet, model.version, ownerNames, toggleExpand],
  );

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.nodeId)), [filteredNodes]);
  const rfEdges = useMemo<Edge[]>(
    () =>
      visible.edges
        .filter((e) => visibleNodeIds.has(e.sourceNodeId) && visibleNodeIds.has(e.targetNodeId))
        .map((e) => {
          const style = EDGE_STYLE[e.edgeKind] ?? { stroke: "#94a3b8" };
          return {
            id: e.edgeId,
            source: e.sourceNodeId,
            target: e.targetNodeId,
            style: { stroke: style.stroke, strokeWidth: e.edgeKind === "hierarchy" ? 2.2 : 1.6, strokeDasharray: style.dash },
            markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke, width: 14, height: 14 },
          };
        }),
    [visible.edges, visibleNodeIds],
  );

  useEffect(() => {
    const id = window.setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 60);
    return () => window.clearTimeout(id);
  }, [rootScope, layoutMode, evidenceOverlay, dependencyOverlay, statusFilter, fitView]);

  // Task 6 large-graph guard: expanding EVERYTHING in a large scope can trigger
  // a render storm. When the scope is large we arm a one-click confirmation
  // instead of expanding immediately (progressive, hierarchy-safe — Expand all
  // stays SCOPED to the selected milestone/task; it never dumps the whole
  // project). A second click confirms.
  const perfBudget = useMemo(() => resolvePerfBudget(), []);
  const [expandAllArmed, setExpandAllArmed] = useState(false);

  const handleExpandAll = useCallback(() => {
    const ids = scopedExpandableNodeIds(model, ctx);
    const load = assessGraphLoad(
      { nodeCount: ids.length, edgeCount: visible.edges.length },
      perfBudget,
    );
    if (load.isLarge && !expandAllArmed) {
      setExpandAllArmed(true);
      return;
    }
    setExpandAllArmed(false);
    setExpansion((s) => expandAllScoped(s, scopeKey, ids));
    window.setTimeout(() => void fitView({ padding: 0.15, duration: 300 }), 80);
  }, [model, ctx, scopeKey, fitView, perfBudget, visible.edges.length, expandAllArmed]);

  const handleCollapseAll = useCallback(() => {
    setExpandAllArmed(false);
    setExpansion((s) => collapseAllScoped(s, scopeKey));
    window.setTimeout(() => void fitView({ padding: 0.15, duration: 300 }), 80);
  }, [scopeKey, fitView]);

  const handleReset = useCallback(() => {
    setExpandAllArmed(false);
    setRootScope({ type: "project", id: null });
    setExpansion((s) => resetScope(s, scopeKey));
    setEvidenceOverlay(false);
    setDependencyOverlay(false);
    setSelectedId(null);
    setStatusFilter("");
  }, [scopeKey]);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => setSelectedId(node.id), []);

  const selectedNode = selectedId ? (model.nodes[selectedId] ?? null) : null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="rt-root">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <RealtimeSyncBar state={syncState} />

        <select
          data-testid="rt-milestone-focus"
          aria-label={t("toolbar.focusMilestone")}
          value={rootScope.type === "milestone" ? (rootScope.id ?? "") : ""}
          onChange={(e) => setRootScope(e.target.value ? { type: "milestone", id: e.target.value } : { type: "project", id: null })}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">{t("toolbar.wholeProject")}</option>
          {props.milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>

        <select
          data-testid="rt-layout"
          aria-label={t("toolbar.layout")}
          value={layoutMode}
          onChange={(e) => setLayoutMode(e.target.value as RealtimeLayoutMode)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="mind_map">{t("toolbar.layoutMindMap")}</option>
          <option value="hierarchical">{t("toolbar.layoutHierarchical")}</option>
          <option value="left_to_right">{t("toolbar.layoutLeftRight")}</option>
        </select>

        <label className="inline-flex items-center gap-1 text-xs text-foreground">
          <input type="checkbox" data-testid="rt-evidence-overlay" checked={evidenceOverlay} onChange={(e) => setEvidenceOverlay(e.target.checked)} />
          {t("toolbar.evidenceOverlay")}
        </label>
        <label className="inline-flex items-center gap-1 text-xs text-foreground">
          <input type="checkbox" data-testid="rt-dependency-overlay" checked={dependencyOverlay} onChange={(e) => setDependencyOverlay(e.target.checked)} />
          {t("toolbar.dependencyOverlay")}
        </label>

        <select
          data-testid="rt-status-filter"
          aria-label={t("toolbar.filterStatus")}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">{t("toolbar.allStatuses")}</option>
          {[...new Set(visible.nodes.map((n) => (typeof n.payload.status === "string" ? n.payload.status : null)).filter((x): x is string => !!x))].sort().map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" data-testid="rt-expand-all" onClick={handleExpandAll} className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 px-2 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-500/10 dark:text-violet-300">
            <ListTree className="h-3.5 w-3.5" aria-hidden /> {t("toolbar.expandAll")}
          </button>
          <button type="button" data-testid="rt-collapse-all" onClick={handleCollapseAll} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            <Layers className="h-3.5 w-3.5" aria-hidden /> {t("toolbar.collapseAll")}
          </button>
          <button type="button" data-testid="rt-reset" onClick={handleReset} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t("toolbar.reset")}
          </button>
          <button
            type="button"
            data-testid="rt-ask-isabella"
            onClick={() => askIsabella({ query: t("isabella.question"), entity: { type: "project", id: props.projectId } })}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Bot className="h-3.5 w-3.5" aria-hidden /> {t("isabella.ask")}
          </button>
        </div>
      </div>

      {expandAllArmed && (
        <p
          className="flex flex-wrap items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-300"
          data-testid="rt-large-graph-warning"
          role="alert"
        >
          {t("largeGraphWarning")}
          <button
            type="button"
            data-testid="rt-expand-all-confirm"
            onClick={handleExpandAll}
            className="rounded border border-amber-500/60 px-1.5 py-0.5 font-medium hover:bg-amber-500/20"
          >
            {t("largeGraphConfirm")}
          </button>
          <button
            type="button"
            onClick={() => setExpandAllArmed(false)}
            className="rounded border border-border px-1.5 py-0.5 font-medium text-muted-foreground hover:bg-muted"
          >
            {t("largeGraphCancel")}
          </button>
        </p>
      )}

      {visible.collapsedChildCount > 0 && (
        <p className="border-b border-border bg-violet-500/5 px-3 py-1 text-[11px] text-violet-700 dark:text-violet-300" data-testid="rt-collapsed-notice">
          {t("collapsedHidden", { count: visible.collapsedChildCount })}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={REALTIME_NODE_TYPES}
            onNodeClick={onNodeClick}
            fitView
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            nodesConnectable={false}
            edgesFocusable={false}
            deleteKeyCode={null}
          >
            <Background gap={26} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!hidden md:!block" />
          </ReactFlow>
        </div>

        {selectedNode && (
          <RealtimeNodeInspector
            node={selectedNode}
            ownerName={nodeOwnerName(selectedNode, ownerNames)}
            onClose={() => setSelectedId(null)}
            onOpenTeam={() => router.push(localizedHref(props.locale, `/projects/${props.projectId}/team`))}
          />
        )}
      </div>
    </div>
  );
}

export function RealtimeLivingGraph(props: RealtimeLivingGraphProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
