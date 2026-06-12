"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  CheckCircle2, Loader2, Circle, Ban, Pause,
  FileText, Send, Code, ShieldCheck, AlertCircle,
  GripVertical, Filter, ChevronLeft, ChevronRight,
  ChevronDown, Columns3, Eye, EyeOff, PanelLeftClose,
  CornerDownRight,
} from "lucide-react";
import { updateTaskStatusAction } from "@/app/[locale]/(app)/projects/[projectId]/roadmap/actions";
import { StatusChangeDialog } from "@/components/roadmap/status-change-dialog";
import { TaskFormDialog, type TaskFormTranslations } from "@/components/roadmap/task-form-dialog";
import {
  useWorkboardPreferences,
  COLLAPSED_COLUMN_WIDTH,
} from "@/hooks/use-workboard-preferences";
import { useColumnResize } from "@/hooks/use-column-resize";
import type { Milestone, RoadmapTask, TaskStatus, TaskPriority, TaskDependency, Locale } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkboardTranslations {
  title: string;
  description: string;
  empty: string;
  dragHint: string;
  filterBySprint: string;
  allSprints: string;
  noSprint: string;
  dependsOn: string;
  groupLabels: Record<string, string>;
  columnVisibility: string;
  showAll: string;
  collapseColumn: string;
  expandColumn: string;
  resetWidth: string;
  columns: Record<TaskStatus, string>;
  priorityLabels: Record<TaskPriority, string>;
  errors: Record<string, string>;
  statusChange: {
    title: string;
    movingTo: string;
    noteLabel: string;
    notePlaceholder: Record<string, string>;
    moveWithout: string;
    moveWith: string;
    cancel: string;
    statusLabels: Record<string, string>;
  };
  taskForm: TaskFormTranslations;
}

interface WorkboardClientProps {
  projectId: string;
  projectTitle: string;
  milestones: Milestone[];
  tasks: RoadmapTask[];
  dependencies: TaskDependency[];
  locale: Locale;
  translations: WorkboardTranslations;
}

// ── Column Configuration ────────────────────────────────────────────────────────

const COLUMN_GROUPS: { label: string; statuses: TaskStatus[] }[] = [
  { label: "backlog", statuses: ["not_started", "prompt_ready"] },
  { label: "active", statuses: ["sent_to_ai", "in_progress", "implemented", "tested"] },
  { label: "complete", statuses: ["done", "blocked", "deferred"] },
];

const STATUS_COLOR: Record<TaskStatus, { bg: string; border: string; dot: string; header: string }> = {
  not_started: { bg: "bg-gray-50 dark:bg-gray-900/20", border: "border-gray-200 dark:border-gray-700", dot: "bg-gray-400", header: "text-gray-700 dark:text-gray-300" },
  prompt_ready: { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", dot: "bg-purple-500", header: "text-purple-700 dark:text-purple-300" },
  sent_to_ai: { bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-200 dark:border-indigo-800", dot: "bg-indigo-500", header: "text-indigo-700 dark:text-indigo-300" },
  in_progress: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-500", header: "text-blue-700 dark:text-blue-300" },
  implemented: { bg: "bg-cyan-50 dark:bg-cyan-900/20", border: "border-cyan-200 dark:border-cyan-800", dot: "bg-cyan-500", header: "text-cyan-700 dark:text-cyan-300" },
  tested: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", header: "text-emerald-700 dark:text-emerald-300" },
  done: { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", dot: "bg-green-500", header: "text-green-700 dark:text-green-300" },
  blocked: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", dot: "bg-red-500", header: "text-red-700 dark:text-red-300" },
  deferred: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500", header: "text-amber-700 dark:text-amber-300" },
};

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  done: <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />,
  tested: <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
  implemented: <Code className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />,
  in_progress: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />,
  sent_to_ai: <Send className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />,
  prompt_ready: <FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />,
  not_started: <Circle className="h-3.5 w-3.5 text-gray-400" />,
  blocked: <Ban className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />,
  deferred: <Pause className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  p1: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  p2: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  p3: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// Statuses that mean a task has been started (or finished)
const STARTED_STATUSES: Set<TaskStatus> = new Set([
  "sent_to_ai", "in_progress", "implemented", "tested", "done",
]);

// ── BoardColumn (separate component so useColumnResize is called at top level) ─

/** Predecessor info shown on a task card: title + whether the dependency is satisfied */
interface PredecessorInfo {
  id: string;
  title: string;
  met: boolean;
}

interface BoardColumnProps {
  status: TaskStatus;
  isLastInGroup: boolean;
  columnTasks: RoadmapTask[];
  milestoneMap: Map<string, string>;
  predecessorsByTask: Map<string, PredecessorInfo[]>;
  anyResizing: boolean;
  getColumnWidth: (status: TaskStatus) => number;
  setColumnWidth: (status: TaskStatus, width: number) => void;
  resetColumnWidth: (status: TaskStatus) => void;
  isColumnCollapsed: (status: TaskStatus) => boolean;
  toggleColumnCollapse: (status: TaskStatus) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  onTaskClick: (task: RoadmapTask) => void;
  translations: {
    columns: Record<TaskStatus, string>;
    empty: string;
    collapseColumn: string;
    expandColumn: string;
    resetWidth: string;
    priorityLabels: Record<TaskPriority, string>;
    dependsOn: string;
  };
}

function BoardColumn({
  status,
  isLastInGroup,
  columnTasks,
  milestoneMap,
  predecessorsByTask,
  anyResizing,
  getColumnWidth,
  setColumnWidth,
  resetColumnWidth,
  isColumnCollapsed,
  toggleColumnCollapse,
  onResizeStart,
  onResizeEnd,
  onTaskClick,
  translations: t,
}: BoardColumnProps) {
  const color = STATUS_COLOR[status];
  const collapsed = isColumnCollapsed(status);
  const currentWidth = getColumnWidth(status);

  // Hook called at top level of this component — no rules-of-hooks violation
  const resizeHandle = useColumnResize({
    status,
    currentWidth,
    onResize: setColumnWidth,
    onReset: resetColumnWidth,
    onResizeStart,
    onResizeEnd,
  });

  return (
    <div
      className={`rounded-xl border ${color.border} ${color.bg} flex flex-col relative transition-[width] duration-150`}
      style={{
        width: collapsed ? COLLAPSED_COLUMN_WIDTH : currentWidth,
        flexShrink: 0,
      }}
    >
      {collapsed ? (
        /* ── Collapsed column: thin vertical strip ── */
        <div
          className="flex flex-col items-center justify-center py-3 px-1 cursor-pointer h-full"
          onClick={() => toggleColumnCollapse(status)}
          title={t.expandColumn}
        >
          <div className="[writing-mode:vertical-rl] rotate-180 flex flex-col items-center gap-1">
            {STATUS_ICON[status]}
            <span className={`text-[9px] font-semibold ${color.header} mt-1`}>
              {columnTasks.length}
            </span>
            <span className={`text-[8px] ${color.header} opacity-70 truncate max-h-20`}>
              {t.columns[status]}
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* ── Column header with collapse button ── */}
          <div className={`flex items-center gap-1.5 px-3 py-2.5 border-b ${color.border}`}>
            {STATUS_ICON[status]}
            <span className={`text-xs font-semibold ${color.header} truncate`}>
              {t.columns[status]}
            </span>
            <span className={`text-[10px] font-medium ${color.header} opacity-60 ml-auto`}>
              {columnTasks.length}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleColumnCollapse(status); }}
              className="p-0.5 rounded hover:bg-muted/50 transition-colors shrink-0"
              aria-label={t.collapseColumn}
              title={t.collapseColumn}
            >
              <PanelLeftClose className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {/* ── Droppable area ── */}
          <Droppable droppableId={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-1 min-h-[120px] p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}
              >
                {columnTasks.map((task, index) => (
                  <Draggable key={task.id} draggableId={`task-${task.id}`} index={index} isDragDisabled={anyResizing}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        onClick={() => { if (!snapshot.isDragging) onTaskClick(task); }}
                        className={`rounded-lg border border-border bg-card p-2.5 shadow-sm transition-shadow cursor-pointer ${snapshot.isDragging ? "shadow-lg ring-2 ring-brand-500/30" : "hover:shadow-md hover:border-brand-500/30"}`}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                            {task.description && <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1">{task.description}</p>}
                            {(predecessorsByTask.get(task.id) ?? []).map((pred) => (
                              <p
                                key={pred.id}
                                className={`mt-0.5 flex items-center gap-1 text-[10px] ${pred.met ? "text-muted-foreground/60" : "text-amber-600 dark:text-amber-400"}`}
                                title={`${t.dependsOn}: ${pred.title}`}
                              >
                                <CornerDownRight className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{t.dependsOn}: {pred.title}</span>
                              </p>
                            ))}
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              {task.milestone_id && milestoneMap.has(task.milestone_id) && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{milestoneMap.get(task.milestone_id)}</span>
                              )}
                              <span className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold ${PRIORITY_BADGE[task.priority]}`}>
                                {task.priority.toUpperCase()}
                              </span>
                              {task.is_blocked && <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />}
                            </div>
                            {task.estimate_hours && <span className="text-[10px] text-muted-foreground/60 mt-0.5">{task.estimate_hours}h</span>}
                            {task.progress > 0 && (
                              <div className="mt-1.5 flex items-center gap-1">
                                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${task.progress}%` }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground">{task.progress}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                  <div className="flex items-center justify-center py-6">
                    <p className="text-[11px] text-muted-foreground/50">{t.empty}</p>
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </>
      )}

      {/* ── Resize handle (right edge, not on last column in group) ── */}
      {!isLastInGroup && !collapsed && (
        <div
          className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize z-10 group/resize"
          onMouseDown={resizeHandle.onMouseDown}
          onDoubleClick={resizeHandle.onDoubleClick}
          title={t.resetWidth}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-border opacity-0 group-hover/resize:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WorkboardClient({
  projectId,
  projectTitle,
  milestones,
  tasks: initialTasks,
  dependencies,
  locale,
  translations: t,
}: WorkboardClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<RoadmapTask[]>(initialTasks);
  const [isDragging, setIsDragging] = useState(false);
  const [dependencyWarning, setDependencyWarning] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<RoadmapTask | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    taskId: string;
    taskTitle: string;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
  } | null>(null);

  // ── Resize global state (disables DnD while resizing) ──────────────────────
  const [anyResizing, setAnyResizing] = useState(false);

  // ── Workboard Preferences ────────────────────────────────────────────────────
  const {
    loaded: prefsLoaded,
    isColumnVisible,
    toggleColumn,
    showAllColumns,
    isGroupCollapsed,
    toggleGroup,
    getColumnWidth,
    setColumnWidth,
    resetColumnWidth,
    isColumnCollapsed,
    toggleColumnCollapse,
    allStatuses,
  } = useWorkboardPreferences(projectId);

  // ── Column Visibility Popover ──────────────────────────────────────────────
  const [visOpen, setVisOpen] = useState(false);
  const visRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visOpen) return;
    const handler = (e: MouseEvent) => {
      if (visRef.current && !visRef.current.contains(e.target as Node)) {
        setVisOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [visOpen]);

  // ── Sprint Filter ────────────────────────────────────────────────────────────
  const NO_SPRINT = "__none__" as const;
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);

  const sprintOptions = useMemo(() => {
    const names = new Set<string>();
    for (const task of tasks) {
      if (task.sprint_name) names.add(task.sprint_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const hasUnsprinted = useMemo(() => tasks.some((t) => !t.sprint_name), [tasks]);

  const filteredTasks = useMemo(() => {
    if (sprintFilter === null) return tasks;
    if (sprintFilter === NO_SPRINT) return tasks.filter((t) => !t.sprint_name);
    return tasks.filter((t) => t.sprint_name === sprintFilter);
  }, [tasks, sprintFilter]);

  // Group filtered tasks by status
  const tasksByStatus: Record<TaskStatus, RoadmapTask[]> = {
    not_started: [], prompt_ready: [], sent_to_ai: [], in_progress: [],
    implemented: [], tested: [], done: [], blocked: [], deferred: [],
  };
  for (const task of filteredTasks) {
    tasksByStatus[task.status].push(task);
  }

  // Milestone lookup
  const milestoneMap = new Map(milestones.map((m) => [m.id, m.title]));

  // Predecessor lookup per task (ordering dependencies only), with met/unmet state
  const predecessorsByTask = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const map = new Map<string, PredecessorInfo[]>();
    for (const dep of dependencies) {
      if (dep.dependency_type !== "finish_to_start" && dep.dependency_type !== "start_to_start") continue;
      const pred = taskById.get(dep.predecessor_id);
      if (!pred || !taskById.has(dep.successor_id)) continue;
      const met = dep.dependency_type === "finish_to_start"
        ? pred.status === "done"
        : STARTED_STATUSES.has(pred.status);
      const arr = map.get(dep.successor_id) ?? [];
      arr.push({ id: pred.id, title: pred.title, met });
      map.set(dep.successor_id, arr);
    }
    return map;
  }, [dependencies, tasks]);

  // ── Horizontal scroll navigation ────────────────────────────────────────────
  const SCROLL_STEP = 300;

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    const ro = new ResizeObserver(updateScrollButtons);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateScrollButtons); ro.disconnect(); };
  }, [updateScrollButtons]);

  const scrollBoard = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -SCROLL_STEP : SCROLL_STEP, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "ArrowLeft") { e.preventDefault(); scrollBoard("left"); }
        if (e.key === "ArrowRight") { e.preventDefault(); scrollBoard("right"); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scrollBoard]);

  // ── Drag and Drop ─────────────────────────────────────────────────────────────

  // Find an unfinished predecessor that blocks starting a task.
  // finish_to_start: predecessor must be done; start_to_start: predecessor must be started.
  const findBlockingPredecessor = useCallback(
    (taskId: string, toStatus: TaskStatus): RoadmapTask | null => {
      if (!STARTED_STATUSES.has(toStatus)) return null;
      for (const dep of dependencies) {
        if (dep.successor_id !== taskId) continue;
        const pred = tasks.find((t) => t.id === dep.predecessor_id);
        if (!pred) continue;
        if (dep.dependency_type === "finish_to_start" && pred.status !== "done") return pred;
        if (dep.dependency_type === "start_to_start" && !STARTED_STATUSES.has(pred.status)) return pred;
      }
      return null;
    },
    [dependencies, tasks],
  );

  // Auto-dismiss the dependency warning banner
  useEffect(() => {
    if (!dependencyWarning) return;
    const timer = setTimeout(() => setDependencyWarning(null), 6000);
    return () => clearTimeout(timer);
  }, [dependencyWarning]);

  const handleDragEnd = useCallback((result: DropResult) => {
    setIsDragging(false);
    if (!result.destination) return;
    const taskId = result.draggableId.replace("task-", "");
    const newStatus = result.destination.droppableId as TaskStatus;
    if (!isColumnVisible(newStatus) || isColumnCollapsed(newStatus)) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    const blocker = findBlockingPredecessor(taskId, newStatus);
    if (blocker) {
      setDependencyWarning(
        t.errors.dependency_not_met
          .replace("{task}", task.title)
          .replace("{predecessor}", blocker.title),
      );
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    setPendingStatusChange({ taskId, taskTitle: task.title, fromStatus: task.status, toStatus: newStatus });
  }, [tasks, isColumnVisible, isColumnCollapsed, findBlockingPredecessor, t.errors.dependency_not_met]);

  const handleStatusConfirm = useCallback(async (note?: string) => {
    if (!pendingStatusChange) return;
    const res = await updateTaskStatusAction({
      taskId: pendingStatusChange.taskId, status: pendingStatusChange.toStatus, projectId, note,
    });
    if (res.error) {
      setTasks((prev) => prev.map((t) => t.id === pendingStatusChange.taskId ? { ...t, status: pendingStatusChange.fromStatus } : t));
      if (res.error === "dependency_not_met") {
        setDependencyWarning(
          t.errors.dependency_not_met
            .replace("{task}", pendingStatusChange.taskTitle)
            .replace("{predecessor}", res.predecessorTitle ?? "—"),
        );
      }
    }
    setPendingStatusChange(null);
    router.refresh();
  }, [pendingStatusChange, projectId, router, t.errors.dependency_not_met]);

  const handleStatusCancel = useCallback(() => {
    if (!pendingStatusChange) return;
    setTasks((prev) => prev.map((t) => t.id === pendingStatusChange.taskId ? { ...t, status: pendingStatusChange.fromStatus } : t));
    setPendingStatusChange(null);
  }, [pendingStatusChange]);

  // ── Resize callbacks ───────────────────────────────────────────────────────
  const handleResizeStart = useCallback(() => setAnyResizing(true), []);
  const handleResizeEnd = useCallback(() => setAnyResizing(false), []);

  // ── Wait for preferences to load (SSR-safe) ──────────────────────────────────
  if (!prefsLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">{projectTitle}</p>
        <h1 className="text-xl font-semibold text-foreground">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>

      <p className="text-xs text-muted-foreground">{t.dragHint}</p>

      {/* Dependency warning banner */}
      {dependencyWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{dependencyWarning}</span>
          <button
            type="button"
            onClick={() => setDependencyWarning(null)}
            className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 font-medium"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className={`flex items-center gap-3 flex-wrap transition-opacity ${isDragging || anyResizing ? "pointer-events-none opacity-50" : ""}`}>
        {/* Sprint Filter */}
        {sprintOptions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <button type="button" onClick={() => setSprintFilter(null)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${sprintFilter === null ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {t.allSprints}
            </button>
            {sprintOptions.map((name) => (
              <button key={name} type="button" onClick={() => setSprintFilter(sprintFilter === name ? null : name)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${sprintFilter === name ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {name}
              </button>
            ))}
            {hasUnsprinted && (
              <button type="button" onClick={() => setSprintFilter(sprintFilter === NO_SPRINT ? null : NO_SPRINT)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium italic transition-colors ${sprintFilter === NO_SPRINT ? "bg-gray-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {t.noSprint}
              </button>
            )}
          </div>
        )}

        {/* Column Visibility Toggle */}
        <div className="relative" ref={visRef}>
          <button type="button" onClick={() => setVisOpen(!visOpen)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${visOpen ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            aria-label={t.columnVisibility}>
            <Columns3 className="h-3 w-3" />
            <span>{t.columnVisibility}</span>
          </button>
          {visOpen && (
            <div className="absolute z-30 mt-1 left-0 w-56 rounded-xl border border-border bg-card shadow-lg p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-foreground">{t.columnVisibility}</span>
                <button type="button" onClick={showAllColumns} className="text-[10px] text-brand-600 hover:text-brand-700 font-medium">
                  {t.showAll}
                </button>
              </div>
              {COLUMN_GROUPS.map((group) => (
                <div key={group.label}>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.groupLabels[group.label]}</span>
                  <div className="mt-1 space-y-1">
                    {group.statuses.map((status) => {
                      const visible = isColumnVisible(status);
                      const visibleInGroup = group.statuses.filter((s) => isColumnVisible(s)).length;
                      const isLast = visibleInGroup === 1 && visible;
                      return (
                        <div key={status}
                          onClick={() => { if (!isLast) toggleColumn(status); }}
                          className={`flex items-center gap-2 px-1.5 py-0.5 rounded transition-colors ${isLast ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"}`}>
                          {visible ? <Eye className="h-3 w-3 text-brand-600 shrink-0" /> : <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className={`text-[11px] ${visible ? "text-foreground" : "text-muted-foreground line-through"}`}>{t.columns[status]}</span>
                          <span className="ml-auto text-[9px] text-muted-foreground">{tasksByStatus[status].length}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Kanban Board ─────────────────────────────────────────────────────── */}
      <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
        <div className="relative group/board">
          {canScrollLeft && <div className="absolute left-0 top-0 bottom-0 z-10 w-8 pointer-events-none bg-gradient-to-r from-background to-transparent" />}
          {canScrollRight && <div className="absolute right-0 top-0 bottom-0 z-10 w-8 pointer-events-none bg-gradient-to-l from-background to-transparent" />}
          <button type="button" onClick={() => scrollBoard("left")} disabled={!canScrollLeft}
            className={`absolute -left-1 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 shadow-lg backdrop-blur-sm transition-all ${canScrollLeft ? "opacity-100 hover:bg-accent hover:scale-110 cursor-pointer" : "opacity-0 pointer-events-none"}`}
            aria-label="Scroll left">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => scrollBoard("right")} disabled={!canScrollRight}
            className={`absolute -right-1 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 shadow-lg backdrop-blur-sm transition-all ${canScrollRight ? "opacity-100 hover:bg-accent hover:scale-110 cursor-pointer" : "opacity-0 pointer-events-none"}`}
            aria-label="Scroll right">
            <ChevronRight className="h-5 w-5" />
          </button>

          <div ref={scrollRef} className="workboard-scroll flex gap-4 overflow-x-auto pb-4 scroll-smooth" style={{ scrollbarWidth: "thin" }}>
            {COLUMN_GROUPS.map((group) => {
              const collapsed = isGroupCollapsed(group.label);
              const visibleStatuses = group.statuses.filter((s) => isColumnVisible(s));
              const groupTaskCount = group.statuses.reduce((sum, s) => sum + tasksByStatus[s].length, 0);

              if (visibleStatuses.length === 0 && !collapsed) return null;

              return (
                <div key={group.label} className="flex-shrink-0">
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-2 cursor-pointer select-none group/header" onClick={() => toggleGroup(group.label)}>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.groupLabels[group.label]}</span>
                    <span className="text-[10px] text-muted-foreground/60 font-medium">{groupTaskCount}</span>
                  </div>

                  {/* Columns */}
                  {!collapsed && visibleStatuses.length > 0 && (
                    <div className="flex gap-3">
                      {visibleStatuses.map((status, statusIndex) => (
                        <BoardColumn
                          key={status}
                          status={status}
                          isLastInGroup={statusIndex === visibleStatuses.length - 1}
                          columnTasks={tasksByStatus[status]}
                          milestoneMap={milestoneMap}
                          predecessorsByTask={predecessorsByTask}
                          anyResizing={anyResizing}
                          getColumnWidth={getColumnWidth}
                          setColumnWidth={setColumnWidth}
                          resetColumnWidth={resetColumnWidth}
                          isColumnCollapsed={isColumnCollapsed}
                          toggleColumnCollapse={toggleColumnCollapse}
                          onResizeStart={handleResizeStart}
                          onResizeEnd={handleResizeEnd}
                          onTaskClick={(task) => setEditingTask(task)}
                          translations={{
                            columns: t.columns,
                            empty: t.empty,
                            collapseColumn: t.collapseColumn,
                            expandColumn: t.expandColumn,
                            resetWidth: t.resetWidth,
                            priorityLabels: t.priorityLabels,
                            dependsOn: t.dependsOn,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>

      {/* Status Change Dialog */}
      {pendingStatusChange && (
        <StatusChangeDialog
          taskTitle={pendingStatusChange.taskTitle}
          fromStatus={pendingStatusChange.fromStatus}
          toStatus={pendingStatusChange.toStatus}
          translations={t.statusChange}
          onConfirm={handleStatusConfirm}
          onCancel={handleStatusCancel}
        />
      )}

      {/* Task Form Dialog */}
      {editingTask && (
        <TaskFormDialog
          mode="edit"
          projectId={projectId}
          locale={locale}
          milestones={milestones}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); router.refresh(); }}
          translations={t.taskForm as any}
        />
      )}
    </div>
  );
}