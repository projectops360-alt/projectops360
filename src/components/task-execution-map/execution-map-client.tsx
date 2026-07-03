"use client";

// ============================================================================
// ProjectOps360° — Task Execution Map · Client orchestrator
// ============================================================================
// The task-level execution mind map: parent task as the central node,
// subtasks branching out, blockers attached as alert nodes, dependencies as
// dotted nodes. Two views (Map primary / Table fallback), toolbar with
// search, filters (status/owner/blocked/overdue/critical), grouping, three
// layouts, and a right-side detail panel. The Living Graph remains the
// project-level view — this is the task-level drill-down.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bot, ListTree, Map as MapIcon, Plus, Save, RotateCcw } from "lucide-react";
import type { Viewport } from "@xyflow/react";
import { askIsabella } from "@/lib/isabella/ask-isabella";
import type { Subtask, SubtaskStatus } from "@/lib/subtasks/types";
import { SUBTASK_STATUSES } from "@/lib/subtasks/types";
import { deleteSubtaskAction } from "@/lib/subtasks/actions";
import {
  buildExecutionMapModel,
  filterSubtasks,
  groupSubtasks,
  resolveEffectiveGrouping,
  type ExecutionMapFilters,
  type ExecutionMapGrouping,
  type ExecutionMapLayout,
  type ExternalDependencyInfo,
  type ParentTaskInfo,
} from "@/lib/subtasks/map-model";
import {
  loadSubtaskLayout,
  saveSubtaskLayout,
  clearSubtaskLayout,
  applySavedSubtaskPositions,
  isSubtaskLayoutPartial,
  type SavedSubtaskLayout,
  type SavedSubtaskNodePosition,
  SUBTASK_LAYOUT_SCHEMA_VERSION,
} from "@/lib/subtasks/subtask-map-layout";
import { ExecutionMapCanvas } from "./execution-map-canvas";
import { SubtaskDetailPanel, type PanelSelection } from "./subtask-detail-panel";
import { SubtaskTableView } from "./subtask-table-view";
import { SubtaskFormDialog } from "./subtask-form-dialog";

export interface ExecutionMapClientProps {
  projectId: string;
  parent: ParentTaskInfo;
  subtasks: Subtask[];
  dependencies: ExternalDependencyInfo[];
  ownerNames: Record<string, string>;
  owners: { id: string; name: string }[];
  canManage: boolean;
}

export function ExecutionMapClient(props: ExecutionMapClientProps) {
  const t = useTranslations("taskExecutionMap");
  const router = useRouter();
  const [view, setView] = useState<"map" | "table">("map");
  // Default layout is LEFT-TO-RIGHT so expanded subtasks flow horizontally.
  const [layout, setLayout] = useState<ExecutionMapLayout>("left_to_right");
  const [grouping, setGrouping] = useState<ExecutionMapGrouping>("none");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [filters, setFilters] = useState<ExecutionMapFilters>({});
  const [selection, setSelection] = useState<PanelSelection | null>(null);
  const [editing, setEditing] = useState<Subtask | null>(null);
  const [creating, setCreating] = useState(false);
  // NotebookLM root-first: the Subtask Map opens showing ONLY the root task;
  // the user clicks the root to reveal its subtasks (progressive expansion).
  const [rootExpanded, setRootExpanded] = useState(false);

  // ── Manual layout (drag + save) — presentation state only ───────────────────
  const [manualPositions, setManualPositions] = useState<Map<string, SavedSubtaskNodePosition>>(
    () => new Map(),
  );
  const [savedLayout, setSavedLayout] = useState<SavedSubtaskLayout | null>(null);
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);
  const [layoutNotice, setLayoutNotice] = useState<"saved" | "reset" | "cleared" | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const [, startTransition] = useTransition();

  const asOf = useMemo(() => new Date(), []);

  const model = useMemo(
    () =>
      buildExecutionMapModel({
        parent: props.parent,
        subtasks: props.subtasks,
        dependencies: props.dependencies,
        ownerNames: props.ownerNames,
        filters,
        grouping,
        layout,
        expandedGroups,
        rootExpanded,
        asOf,
      }),
    [props.parent, props.subtasks, props.dependencies, props.ownerNames, filters, grouping, layout, expandedGroups, rootExpanded, asOf],
  );

  // Live node ids (for reconciling a saved layout against the current graph).
  const liveNodeIds = useMemo(() => model.nodes.map((n) => n.id), [model.nodes]);

  // Load the saved layout for this task + layout context. Reloads on a context
  // switch (layout mode) — never on filters/expansion — so a manual arrangement
  // survives filtering. Presentation-only (localStorage; SSR-safe).
  useEffect(() => {
    const loaded = loadSubtaskLayout(props.projectId, props.parent.id, layout);
    setSavedLayout(loaded);
    setManualPositions(applySavedSubtaskPositions(loaded, liveNodeIds).positions);
    setHasUnsavedLayout(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.projectId, props.parent.id, layout]);

  const layoutPartiallyApplied = useMemo(
    () => (savedLayout ? isSubtaskLayoutPartial(applySavedSubtaskPositions(savedLayout, liveNodeIds)) : false),
    [savedLayout, liveNodeIds],
  );

  const handleNodeDragStop = useCallback((nodeId: string, position: SavedSubtaskNodePosition) => {
    setManualPositions((prev) => {
      const next = new Map(prev);
      next.set(nodeId, position);
      return next;
    });
    setHasUnsavedLayout(true);
  }, []);

  const handleSaveLayout = useCallback(() => {
    const nodes: Record<string, SavedSubtaskNodePosition> = {};
    for (const [id, pos] of manualPositions) nodes[id] = pos;
    const ok = saveSubtaskLayout({
      version: SUBTASK_LAYOUT_SCHEMA_VERSION,
      projectId: props.projectId,
      taskId: props.parent.id,
      layout,
      nodes,
      viewport: viewportRef.current ?? undefined,
      savedAt: new Date().toISOString(),
    });
    if (ok) {
      setSavedLayout(loadSubtaskLayout(props.projectId, props.parent.id, layout));
      setHasUnsavedLayout(false);
      setLayoutNotice("saved");
    }
  }, [manualPositions, props.projectId, props.parent.id, layout]);

  const handleResetLayout = useCallback(() => {
    // Back to the deterministic auto-layout (drops manual positions this session).
    setManualPositions(new Map());
    setHasUnsavedLayout(savedLayout != null);
    setLayoutNotice("reset");
  }, [savedLayout]);

  const handleClearSavedLayout = useCallback(() => {
    clearSubtaskLayout(props.projectId, props.parent.id, layout);
    setSavedLayout(null);
    setManualPositions(new Map());
    setHasUnsavedLayout(false);
    setLayoutNotice("cleared");
  }, [props.projectId, props.parent.id, layout]);

  const handleDeleteSubtask = useCallback(
    (subtaskId: string) => {
      startTransition(async () => {
        const res = await deleteSubtaskAction({ projectId: props.projectId, subtaskId });
        if (!res.error) {
          setSelection((cur) => (cur?.kind !== "parent" && cur?.subtaskId === subtaskId ? null : cur));
          router.refresh();
        }
      });
    },
    [props.projectId, router],
  );

  useEffect(() => {
    if (!layoutNotice) return;
    const id = window.setTimeout(() => setLayoutNotice(null), 2500);
    return () => window.clearTimeout(id);
  }, [layoutNotice]);

  // Expand ALL under this task: reveal the root and every group so the whole
  // subtask hierarchy shows (NotebookLM "Expand all"). Collapse ALL returns to
  // the clean parent-only view (requirement #8).
  const handleExpandAll = useCallback(() => {
    setRootExpanded(true);
    const { visible } = filterSubtasks(props.subtasks, filters, asOf);
    const eff = resolveEffectiveGrouping(grouping, visible.length);
    setExpandedGroups(eff === "none" ? [] : [...groupSubtasks(visible, eff).keys()]);
  }, [props.subtasks, filters, grouping, asOf]);

  const handleCollapseAll = useCallback(() => {
    setRootExpanded(false);
    setExpandedGroups([]);
  }, []);

  const selectedNodeId =
    selection?.kind === "parent"
      ? `task:${props.parent.id}`
      : selection?.kind === "subtask"
        ? `subtask:${selection.subtaskId}`
        : selection?.kind === "blocker"
          ? `blocker:${selection.subtaskId}`
          : null;

  const handleNodeClick = (nodeId: string, kind: string) => {
    if (kind === "parentTask") {
      // Clicking the root expands its subtasks (NotebookLM); also selects it.
      if (!rootExpanded && props.subtasks.length > 0) setRootExpanded(true);
      setSelection({ kind: "parent" });
    } else if (kind === "subtask") setSelection({ kind: "subtask", subtaskId: nodeId.replace("subtask:", "") });
    else if (kind === "blocker") setSelection({ kind: "blocker", subtaskId: nodeId.replace("blocker:", "") });
    else if (kind === "group") {
      const key = nodeId.replace("group:", "");
      setExpandedGroups((prev) => (prev.includes(key) ? prev : [...prev, key]));
    }
  };

  const toggleFilter = (patch: Partial<ExecutionMapFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const fitKey = `${layout}|${grouping}|${JSON.stringify(filters)}|${expandedGroups.join(",")}|${view}|${rootExpanded}`;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="tem-root">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        {/* View switcher */}
        <div className="inline-flex overflow-hidden rounded-md border border-border" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            data-testid="tem-view-map"
            onClick={() => setView("map")}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <MapIcon className="h-3.5 w-3.5" /> {t("view.map")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "table"}
            data-testid="tem-view-table"
            onClick={() => setView("table")}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <ListTree className="h-3.5 w-3.5" /> {t("view.table")}
          </button>
        </div>

        {/* Search */}
        <input
          type="search"
          data-testid="tem-search"
          value={filters.search ?? ""}
          onChange={(e) => toggleFilter({ search: e.target.value })}
          placeholder={t("toolbar.search")}
          aria-label={t("toolbar.search")}
          className="w-40 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />

        {/* Status filter */}
        <select
          data-testid="tem-filter-status"
          aria-label={t("toolbar.filterStatus")}
          value={filters.statuses?.[0] ?? ""}
          onChange={(e) =>
            toggleFilter({ statuses: e.target.value ? [e.target.value as SubtaskStatus] : undefined })
          }
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">{t("toolbar.allStatuses")}</option>
          {SUBTASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>

        {/* Owner filter */}
        <select
          data-testid="tem-filter-owner"
          aria-label={t("toolbar.filterOwner")}
          value={filters.ownerId ?? ""}
          onChange={(e) => toggleFilter({ ownerId: e.target.value || undefined })}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">{t("toolbar.allOwners")}</option>
          {props.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        {/* Quick toggles */}
        <label className="inline-flex items-center gap-1 text-xs text-foreground">
          <input
            type="checkbox"
            data-testid="tem-filter-blocked"
            checked={!!filters.onlyBlocked}
            onChange={(e) => toggleFilter({ onlyBlocked: e.target.checked || undefined })}
          />
          {t("toolbar.onlyBlocked")}
        </label>
        <label className="inline-flex items-center gap-1 text-xs text-foreground">
          <input
            type="checkbox"
            data-testid="tem-filter-overdue"
            checked={!!filters.onlyOverdue}
            onChange={(e) => toggleFilter({ onlyOverdue: e.target.checked || undefined })}
          />
          {t("toolbar.onlyOverdue")}
        </label>
        <label className="inline-flex items-center gap-1 text-xs text-foreground">
          <input
            type="checkbox"
            data-testid="tem-filter-critical"
            checked={!!filters.onlyCritical}
            onChange={(e) => toggleFilter({ onlyCritical: e.target.checked || undefined })}
          />
          {t("toolbar.onlyCritical")}
        </label>

        {view === "map" && props.subtasks.length > 0 && (
          <div className="inline-flex overflow-hidden rounded-md border border-border" role="group">
            <button
              type="button"
              data-testid="tem-expand-root"
              onClick={handleExpandAll}
              aria-pressed={rootExpanded}
              className={`px-2.5 py-1.5 text-xs font-medium ${rootExpanded ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {t("toolbar.expandRoot")}
            </button>
            <button
              type="button"
              data-testid="tem-collapse-root"
              onClick={handleCollapseAll}
              disabled={!rootExpanded}
              className={`px-2.5 py-1.5 text-xs font-medium ${!rootExpanded ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"} disabled:cursor-default`}
            >
              {t("toolbar.collapseRoot")}
            </button>
          </div>
        )}

        {view === "map" && rootExpanded && (
          <>
            {/* Grouping */}
            <select
              data-testid="tem-grouping"
              aria-label={t("toolbar.groupBy")}
              value={grouping}
              onChange={(e) => {
                setGrouping(e.target.value as ExecutionMapGrouping);
                setExpandedGroups([]);
              }}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="none">{t("toolbar.groupNone")}</option>
              <option value="status">{t("toolbar.groupStatus")}</option>
              <option value="owner">{t("toolbar.groupOwner")}</option>
              <option value="priority">{t("toolbar.groupPriority")}</option>
            </select>

            {/* Layout */}
            <select
              data-testid="tem-layout"
              aria-label={t("toolbar.layout")}
              value={layout}
              onChange={(e) => setLayout(e.target.value as ExecutionMapLayout)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="radial">{t("toolbar.layoutRadial")}</option>
              <option value="hierarchical">{t("toolbar.layoutHierarchical")}</option>
              <option value="left_to_right">{t("toolbar.layoutLeftRight")}</option>
            </select>

            {/* Saved layout controls (UX-007 parity) — drag nodes, then save.
                Presentation-only: coordinates + viewport, never task data. */}
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                data-testid="tem-save-layout"
                onClick={handleSaveLayout}
                disabled={!hasUnsavedLayout}
                title={t("toolbar.saveLayout")}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                {t("toolbar.saveLayout")}
                {hasUnsavedLayout && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
              </button>
              <button
                type="button"
                data-testid="tem-reset-layout"
                onClick={handleResetLayout}
                disabled={manualPositions.size === 0}
                title={t("toolbar.resetLayout")}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t("toolbar.resetLayout")}
              </button>
              {savedLayout && (
                <button
                  type="button"
                  data-testid="tem-clear-layout"
                  onClick={handleClearSavedLayout}
                  title={t("toolbar.clearLayout")}
                  className="rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  {t("toolbar.clearLayout")}
                </button>
              )}
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="tem-ask-isabella-map"
            onClick={() =>
              askIsabella({
                query: t("isabella.mapQuestion", { title: props.parent.title }),
                entity: { type: "task", id: props.parent.id, title: props.parent.title },
              })
            }
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Bot className="h-3.5 w-3.5" /> {t("isabella.ask")}
          </button>
          <button
            type="button"
            data-testid="tem-add-subtask"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> {t("actions.addSubtask")}
          </button>
        </div>
      </div>

      {/* Hidden-by-filters honesty notice */}
      {model.hiddenSubtaskIds.length > 0 && (
        <p className="border-b border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
          {t("toolbar.hiddenByFilters", { count: model.hiddenSubtaskIds.length })}
        </p>
      )}

      {/* Saved-layout transient notice + honest "partially applied" hint */}
      {view === "map" && layoutNotice && (
        <p
          role="status"
          className="border-b border-border bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
          data-testid="tem-layout-notice"
        >
          {t(`toolbar.layoutNotice.${layoutNotice}`)}
        </p>
      )}
      {view === "map" && rootExpanded && layoutPartiallyApplied && !layoutNotice && (
        <p className="border-b border-border bg-amber-500/10 px-3 py-1 text-[11px] text-amber-700 dark:text-amber-400">
          {t("toolbar.layoutPartial")}
        </p>
      )}

      {/* ── Content ── */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {view === "map" ? (
            <div className="h-full min-h-[480px]">
              <ExecutionMapCanvas
                model={model}
                selectedNodeId={selectedNodeId}
                onNodeClick={handleNodeClick}
                fitKey={fitKey}
                manualPositions={manualPositions}
                onNodeDragStop={handleNodeDragStop}
                onDeleteSubtask={props.canManage ? handleDeleteSubtask : undefined}
                savedViewport={savedLayout?.viewport ?? null}
                onViewportChange={(vp) => {
                  viewportRef.current = vp;
                }}
              />
            </div>
          ) : (
            <div className="p-3">
              <SubtaskTableView
                subtasks={props.subtasks.filter((s) => !model.hiddenSubtaskIds.includes(s.id))}
                ownerNames={props.ownerNames}
                onSelect={(id) => setSelection({ kind: "subtask", subtaskId: id })}
                asOf={asOf}
              />
            </div>
          )}
        </div>

        {selection && (
          <SubtaskDetailPanel
            projectId={props.projectId}
            parent={props.parent}
            subtasks={props.subtasks}
            ownerNames={props.ownerNames}
            selection={selection}
            canManage={props.canManage}
            onClose={() => setSelection(null)}
            onEdit={(s) => setEditing(s)}
            asOf={asOf}
          />
        )}
      </div>

      {(creating || editing) && (
        <SubtaskFormDialog
          projectId={props.projectId}
          taskId={props.parent.id}
          subtask={editing}
          owners={props.owners}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
