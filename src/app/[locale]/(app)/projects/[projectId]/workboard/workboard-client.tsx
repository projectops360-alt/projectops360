"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import {
  CheckCircle2, Loader2, Circle, Ban, Pause,
  FileText, Send, Code, ShieldCheck, AlertCircle,
  GripVertical, Filter, ChevronLeft, ChevronRight,
  ChevronDown, Columns3, Eye, EyeOff, PanelLeftClose,
  CornerDownRight, User, Rows3, Rows4, Trash2, Network,
  AlertTriangle, ListChecks,
} from "lucide-react";
import { updateTaskStatusAction, reorderTasksAction, archiveTaskAction } from "@/app/[locale]/(app)/projects/[projectId]/roadmap/actions";
import { applyBoardDrag } from "@/lib/workboard/reorder";
import { resolveTaskOwner, type AssigneeInfo } from "@/lib/roadmap/task-owner";
import { StatusChangeDialog } from "@/components/roadmap/status-change-dialog";
import { TaskFormDialog, type TaskFormTranslations } from "@/components/roadmap/task-form-dialog";
import {
  useWorkboardPreferences,
  COLLAPSED_COLUMN_WIDTH,
} from "@/hooks/use-workboard-preferences";
import { useColumnResize } from "@/hooks/use-column-resize";
import type { Milestone, RoadmapTask, TaskStatus, TaskPriority, TaskDependency, Locale } from "@/types/database";
import type { SubtaskDashboardSummary } from "@/lib/subtasks/map-model";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkboardTranslations {
  title: string;
  description: string;
  empty: string;
  dragHint: string;
  filterBySprint: string;
  allSprints: string;
  noSprint: string;
  bySprint: string;
  byMilestone: string;
  allMilestones: string;
  noMilestone: string;
  dependsOn: string;
  owner: string;
  unassigned: string;
  assignedUserUnavailable: string;
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
  /** Workboard Cleanup — safe delete for NO-MILESTONE tasks only. */
  cleanup: {
    deleteTask: string;
    confirmTitle: string;
    confirmBody: string;
    confirmDelete: string;
    cancel: string;
  };
  /** Task Execution Map — subtask signals on cards + header chips. */
  subtasks: {
    executionMap: string;
    blocked: string;
    overdue: string;
    done: string;
  };
  taskForm: TaskFormTranslations;
}

interface WorkboardClientProps {
  projectId: string;
  projectTitle: string;
  milestones: Milestone[];
  tasks: RoadmapTask[];
  dependencies: TaskDependency[];
  assignees: Record<string, AssigneeInfo>;
  locale: Locale;
  translations: WorkboardTranslations;
  /** Task Execution Map — per-task subtask signals (blocked/overdue/done). */
  subtaskSummary?: SubtaskDashboardSummary;
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
  compact: boolean;
  isLastInGroup: boolean;
  columnTasks: RoadmapTask[];
  milestoneMap: Map<string, string>;
  predecessorsByTask: Map<string, PredecessorInfo[]>;
  assignees: Record<string, AssigneeInfo>;
  anyResizing: boolean;
  getColumnWidth: (status: TaskStatus) => number;
  setColumnWidth: (status: TaskStatus, width: number) => void;
  resetColumnWidth: (status: TaskStatus) => void;
  isColumnCollapsed: (status: TaskStatus) => boolean;
  toggleColumnCollapse: (status: TaskStatus) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  onTaskClick: (task: RoadmapTask) => void;
  /** Workboard Cleanup — opens the delete confirmation for a NO-MILESTONE task. */
  onDeleteRequest: (task: RoadmapTask) => void;
  /** Task Execution Map — per-task subtask signals + map link base. */
  subtaskSummary?: SubtaskDashboardSummary;
  taskMapBase?: string;
  translations: {
    columns: Record<TaskStatus, string>;
    empty: string;
    collapseColumn: string;
    expandColumn: string;
    resetWidth: string;
    priorityLabels: Record<TaskPriority, string>;
    dependsOn: string;
    owner: string;
    unassigned: string;
    assignedUserUnavailable: string;
    deleteTask: string;
    subtasks: { executionMap: string; blocked: string; overdue: string; done: string };
  };
}

function BoardColumn({
  status,
  compact,
  isLastInGroup,
  columnTasks,
  milestoneMap,
  predecessorsByTask,
  assignees,
  anyResizing,
  getColumnWidth,
  setColumnWidth,
  resetColumnWidth,
  isColumnCollapsed,
  toggleColumnCollapse,
  onResizeStart,
  onResizeEnd,
  onTaskClick,
  onDeleteRequest,
  subtaskSummary,
  taskMapBase,
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
      data-testid={`workboard-column-${status}`}
      data-status={status}
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
          <div className={`flex items-center gap-1.5 border-b ${compact ? "px-2 py-1.5" : "px-3 py-2.5"} ${color.border}`}>
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
                className={`flex-1 min-h-[120px] transition-colors ${compact ? "p-1.5 space-y-1.5" : "p-2 space-y-2"} ${snapshot.isDraggingOver ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}
              >
                {columnTasks.map((task, index) => (
                  <Draggable key={task.id} draggableId={`task-${task.id}`} index={index} isDragDisabled={anyResizing}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        data-testid={`workboard-card-${task.id}`}
                        data-task-status={task.status}
                        onClick={() => { if (!snapshot.isDragging) onTaskClick(task); }}
                        className={`rounded-lg border border-border bg-card shadow-sm transition-shadow cursor-pointer ${compact ? "p-1.5" : "p-2.5"} ${snapshot.isDragging ? "shadow-lg ring-2 ring-brand-500/30" : "hover:shadow-md hover:border-brand-500/30"}`}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1">
                              <p className="flex-1 text-xs font-medium text-foreground truncate">{task.title}</p>
                              {/* Workboard Cleanup: safe delete ONLY for tasks WITHOUT a
                                  milestone. Tasks with a milestone never show this option
                                  (they belong to the plan — archive them from the editor
                                  flows, not from a quick board action). Requires the
                                  confirmation dialog before anything is deleted. */}
                              {!task.milestone_id && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onDeleteRequest(task); }}
                                  className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                  aria-label={t.deleteTask}
                                  title={t.deleteTask}
                                  data-testid="workboard-delete-no-milestone"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            {!compact && task.description && <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1">{task.description}</p>}
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
                            {/* Sprint #1 — task ownership: who owns this work (avatar/initials +
                                name + role; real data only, never invented). */}
                            {(() => {
                              const owner = resolveTaskOwner(task, assignees);
                              if (owner.state === "assigned") {
                                return (
                                  <div
                                    className="mt-1.5 flex items-center gap-1.5"
                                    title={owner.role ? `${owner.name} · ${owner.role}` : owner.name}
                                  >
                                    {owner.avatarUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={owner.avatarUrl}
                                        alt=""
                                        className="h-5 w-5 shrink-0 rounded-full object-cover"
                                      />
                                    ) : (
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[8px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                                        {owner.initials}
                                      </span>
                                    )}
                                    <span className="min-w-0 leading-tight">
                                      <span className="block truncate text-[10px] font-medium text-foreground">{owner.name}</span>
                                      {owner.role && (
                                        <span className="block truncate text-[9px] text-muted-foreground">{owner.role}</span>
                                      )}
                                    </span>
                                  </div>
                                );
                              }
                              const label = owner.state === "unavailable" ? t.assignedUserUnavailable : t.unassigned;
                              return (
                                <p
                                  className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400"
                                  title={label}
                                >
                                  <User className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </p>
                              );
                            })()}
                            {task.estimate_hours && <span className="text-[10px] text-muted-foreground/60 mt-0.5">{task.estimate_hours}h</span>}
                            {/* Task Execution Map — subtask signals (record-backed) + map link.
                                Additive only: never changes status semantics, counts, or layout. */}
                            {(() => {
                              const sig = subtaskSummary?.byTask[task.id];
                              if (!sig && !taskMapBase) return null;
                              return (
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap" data-testid="workboard-subtask-signals">
                                  {sig && sig.total > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title={t.subtasks.done}>
                                      <ListChecks className="h-3 w-3" aria-hidden />
                                      {sig.completed}/{sig.active}
                                    </span>
                                  )}
                                  {sig && sig.blocked > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600" title={t.subtasks.blocked}>
                                      <Ban className="h-3 w-3" aria-hidden />
                                      {sig.blocked}
                                    </span>
                                  )}
                                  {sig && sig.overdue > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600" title={t.subtasks.overdue}>
                                      <AlertTriangle className="h-3 w-3" aria-hidden />
                                      {sig.overdue}
                                    </span>
                                  )}
                                  {taskMapBase && (
                                    <Link
                                      href={`${taskMapBase}/${task.id}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
                                      title={t.subtasks.executionMap}
                                      data-testid="workboard-execution-map-link"
                                    >
                                      <Network className="h-3 w-3" aria-hidden />
                                      {t.subtasks.executionMap}
                                    </Link>
                                  )}
                                </div>
                              );
                            })()}
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
  assignees,
  locale,
  translations: t,
  subtaskSummary,
}: WorkboardClientProps) {
  const router = useRouter();
  const isEs = locale === "es";
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<RoadmapTask[]>(initialTasks);
  // Auto-refresh after save: `tasks` is local state (optimistic DnD), so when
  // the server re-renders (router.refresh() after a task edit) the fresh
  // server truth must replace it — otherwise saved edits stay invisible until
  // a full browser reload and reopening a task shows stale content.
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);
  const [isDragging, setIsDragging] = useState(false);
  const [dependencyWarning, setDependencyWarning] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<RoadmapTask | null>(null);
  // Workboard Cleanup: pending delete confirmation for a NO-MILESTONE task.
  const [pendingDelete, setPendingDelete] = useState<RoadmapTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // UX-013 — bound the board height to the remaining viewport so the horizontal
  // scrollbar stays reachable at the foot of the screen and each column scrolls
  // its own tasks. Measured at runtime (chrome height varies with filter wrapping).
  const [boardMaxH, setBoardMaxH] = useState<number | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    taskId: string;
    taskTitle: string;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
    /** Destination-column order_index writes to persist after the move is confirmed. */
    orderUpdates: { id: string; order_index: number }[];
    /** Snapshot to restore if the move is cancelled or fails. */
    prevTasks: RoadmapTask[];
  } | null>(null);

  // ── Deep-link: open a specific task from ?task=<id> ────────────────────────
  // Lets the dashboard / search / reports link straight to the exact record.
  const deepLinkedTask = useRef<string | null>(null);
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || deepLinkedTask.current === taskId) return;
    const target = tasks.find((tk) => tk.id === taskId);
    if (!target) return;
    deepLinkedTask.current = taskId;
    const id = setTimeout(() => setEditingTask(target), 0);
    return () => clearTimeout(id);
  }, [searchParams, tasks]);

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
    density,
    toggleDensity,
    allStatuses,
  } = useWorkboardPreferences(projectId);
  const isCompact = density === "compact";

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

  // ── Filter (by sprint or milestone) ───────────────────────────────────────────
  const NONE_VALUE = "__none__" as const;
  const [filterDimension, setFilterDimension] = useState<"sprint" | "milestone">("sprint");
  const [filterValue, setFilterValue] = useState<string | null>(null);

  // Milestone lookup (declared early so filter options can use it)
  const milestoneMap = new Map(milestones.map((m) => [m.id, m.title]));

  const sprintOptions = useMemo(() => {
    const names = new Set<string>();
    for (const task of tasks) {
      if (task.sprint_name) names.add(task.sprint_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  // Milestones that actually have tasks, in milestone order
  const milestoneOptions = useMemo(() => {
    const used = new Set<string>();
    for (const task of tasks) {
      if (task.milestone_id) used.add(task.milestone_id);
    }
    return milestones.filter((m) => used.has(m.id)).map((m) => ({ id: m.id, title: m.title }));
  }, [tasks, milestones]);

  const hasUnsprinted = useMemo(() => tasks.some((t) => !t.sprint_name), [tasks]);
  const hasNoMilestone = useMemo(() => tasks.some((t) => !t.milestone_id), [tasks]);

  // The dimension actually in effect. The Sprint/Milestone toggle only appears
  // when BOTH exist; when a project has milestones but no sprints (or vice-versa)
  // we auto-select the dimension that has options so the milestone filter is
  // always reachable (previously it was hidden behind a toggle that never showed).
  const effectiveDimension = useMemo<"sprint" | "milestone">(() => {
    if (sprintOptions.length === 0 && milestoneOptions.length > 0) return "milestone";
    if (milestoneOptions.length === 0 && sprintOptions.length > 0) return "sprint";
    return filterDimension;
  }, [sprintOptions.length, milestoneOptions.length, filterDimension]);

  function setDimension(dim: "sprint" | "milestone") {
    setFilterDimension(dim);
    setFilterValue(null);
  }

  // Single source of truth for "is this task visible under the active filter?".
  // Used both to derive the filtered board AND to keep drag reordering safe:
  // reorder operates only on visible tasks and preserves hidden tasks' order.
  const isTaskVisible = useCallback(
    (task: RoadmapTask): boolean => {
      if (filterValue === null) return true;
      if (effectiveDimension === "sprint") {
        return filterValue === NONE_VALUE ? !task.sprint_name : task.sprint_name === filterValue;
      }
      return filterValue === NONE_VALUE ? !task.milestone_id : task.milestone_id === filterValue;
    },
    [effectiveDimension, filterValue],
  );

  const filteredTasks = useMemo(() => tasks.filter(isTaskVisible), [tasks, isTaskVisible]);

  // Group filtered tasks by status
  const tasksByStatus: Record<TaskStatus, RoadmapTask[]> = {
    not_started: [], prompt_ready: [], sent_to_ai: [], in_progress: [],
    implemented: [], tested: [], done: [], blocked: [], deferred: [],
  };
  for (const task of filteredTasks) {
    tasksByStatus[task.status].push(task);
  }

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

  // ── Board height fit (UX-013) — keep the horizontal scrollbar at the foot of
  // the viewport by capping the board to the space below its top edge. Recomputes
  // on resize and when the banner above it toggles (which shifts the board down).
  useEffect(() => {
    function computeBoardHeight() {
      const el = scrollRef.current;
      if (!el || typeof window === "undefined") return;
      const top = el.getBoundingClientRect().top;
      // Leave room for the scrollbar + a little breathing space; never shorter
      // than a usable board.
      const available = Math.max(320, Math.round(window.innerHeight - top - 24));
      setBoardMaxH(available);
    }
    computeBoardHeight();
    window.addEventListener("resize", computeBoardHeight);
    return () => window.removeEventListener("resize", computeBoardHeight);
  }, [dependencyWarning]);

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
    const { source, destination, draggableId } = result;
    // Drop outside any droppable → no-op (@hello-pangea/dnd reverts the UI).
    if (!destination) return;
    const taskId = draggableId.replace("task-", "");
    const fromStatus = source.droppableId as TaskStatus;
    const toStatus = destination.droppableId as TaskStatus;
    if (!isColumnVisible(toStatus) || isColumnCollapsed(toStatus)) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // ── Same-column reorder (no status change, no dialog) ────────────────────
    if (fromStatus === toStatus) {
      if (source.index === destination.index) return;
      const res = applyBoardDrag({ tasks, draggableId, source, destination, isVisible: isTaskVisible });
      if (!res) return;
      const prev = tasks;
      setTasks(res.tasks); // apply the visual reorder immediately
      if (res.orderUpdates.length > 0) {
        reorderTasksAction({
          projectId,
          updates: res.orderUpdates.map((u) => ({ taskId: u.id, orderIndex: u.order_index })),
        })
          .then((r) => { if (r?.error) setTasks(prev); })
          .catch(() => setTasks(prev));
      }
      return;
    }

    // ── Cross-column move (status change) ────────────────────────────────────
    const blocker = findBlockingPredecessor(taskId, toStatus);
    if (blocker) {
      setDependencyWarning(
        t.errors.dependency_not_met
          .replace("{task}", task.title)
          .replace("{predecessor}", blocker.title),
      );
      return;
    }
    const res = applyBoardDrag({ tasks, draggableId, source, destination, isVisible: isTaskVisible });
    if (!res) return;
    const prev = tasks;
    // Optimistic: apply status + drop placement in one step.
    setTasks(res.tasks);
    setPendingStatusChange({
      taskId,
      taskTitle: task.title,
      fromStatus: task.status,
      toStatus,
      orderUpdates: res.orderUpdates,
      prevTasks: prev,
    });
  }, [tasks, isColumnVisible, isColumnCollapsed, findBlockingPredecessor, isTaskVisible, projectId, t.errors.dependency_not_met]);

  const handleStatusConfirm = useCallback(async (note?: string) => {
    if (!pendingStatusChange) return;
    const res = await updateTaskStatusAction({
      taskId: pendingStatusChange.taskId, status: pendingStatusChange.toStatus, projectId, note,
    });
    if (res.error) {
      // Restore the full pre-drag board (status + placement).
      setTasks(pendingStatusChange.prevTasks);
      if (res.error === "dependency_not_met") {
        setDependencyWarning(
          t.errors.dependency_not_met
            .replace("{task}", pendingStatusChange.taskTitle)
            .replace("{predecessor}", res.predecessorTitle ?? "—"),
        );
      }
    } else if (pendingStatusChange.orderUpdates.length > 0) {
      // Persist the destination-column drop position (order_index only).
      await reorderTasksAction({
        projectId,
        updates: pendingStatusChange.orderUpdates.map((u) => ({ taskId: u.id, orderIndex: u.order_index })),
      });
    }
    setPendingStatusChange(null);
    router.refresh();
  }, [pendingStatusChange, projectId, router, t.errors.dependency_not_met]);

  const handleStatusCancel = useCallback(() => {
    if (!pendingStatusChange) return;
    // Restore the full pre-drag board (status + placement).
    setTasks(pendingStatusChange.prevTasks);
    setPendingStatusChange(null);
  }, [pendingStatusChange]);

  // ── Workboard Cleanup: confirmed delete of a NO-MILESTONE task ──────────────
  // Server authorization lives in archiveTaskAction (org-scoped soft delete +
  // audit log). The guard here is presentation: the button only exists on
  // no-milestone cards, and this handler re-checks it defensively.
  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDelete || deleting) return;
    if (pendingDelete.milestone_id) {
      setPendingDelete(null);
      return;
    }
    setDeleting(true);
    try {
      const res = await archiveTaskAction(pendingDelete.id, projectId);
      if (res.error) {
        setDependencyWarning(t.errors[res.error] ?? t.errors.unexpected);
      } else {
        setTasks((prev) => prev.filter((tk) => tk.id !== pendingDelete.id));
        router.refresh();
      }
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, deleting, projectId, router, t.errors]);

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
        {/* Task Execution Map — project-level subtask alerts (record-backed). */}
        {subtaskSummary && (subtaskSummary.totals.blocked > 0 || subtaskSummary.totals.overdue > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="workboard-subtask-alerts">
            {subtaskSummary.totals.blocked > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
                <Ban className="h-3 w-3" aria-hidden />
                {t.subtasks.blocked}: {subtaskSummary.totals.blocked}
              </span>
            )}
            {subtaskSummary.totals.overdue > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {t.subtasks.overdue}: {subtaskSummary.totals.overdue}
              </span>
            )}
          </div>
        )}
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
        {/* Filter by sprint or milestone */}
        {(sprintOptions.length > 0 || milestoneOptions.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

            {/* Dimension switch when both dimensions exist; otherwise a static
                label so the single available dimension (e.g. Milestone) is clear. */}
            {sprintOptions.length > 0 && milestoneOptions.length > 0 ? (
              <div className="mr-1 inline-flex overflow-hidden rounded-full border border-border">
                <button
                  type="button"
                  onClick={() => setDimension("sprint")}
                  className={`px-2.5 py-0.5 text-[11px] font-medium transition-colors ${effectiveDimension === "sprint" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  {t.bySprint}
                </button>
                <button
                  type="button"
                  onClick={() => setDimension("milestone")}
                  className={`px-2.5 py-0.5 text-[11px] font-medium transition-colors ${effectiveDimension === "milestone" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  {t.byMilestone}
                </button>
              </div>
            ) : (
              <span className="mr-1 text-[11px] font-semibold text-muted-foreground">
                {effectiveDimension === "milestone" ? t.byMilestone : t.bySprint}
              </span>
            )}

            <button type="button" onClick={() => setFilterValue(null)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${filterValue === null ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {effectiveDimension === "sprint" ? t.allSprints : t.allMilestones}
            </button>

            {effectiveDimension === "sprint"
              ? sprintOptions.map((name) => (
                  <button key={name} type="button" onClick={() => setFilterValue(filterValue === name ? null : name)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${filterValue === name ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                    {name}
                  </button>
                ))
              : milestoneOptions.map((m) => (
                  <button key={m.id} type="button" onClick={() => setFilterValue(filterValue === m.id ? null : m.id)}
                    className={`max-w-[160px] truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${filterValue === m.id ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    title={m.title}>
                    {m.title}
                  </button>
                ))}

            {effectiveDimension === "sprint" && hasUnsprinted && (
              <button type="button" onClick={() => setFilterValue(filterValue === NONE_VALUE ? null : NONE_VALUE)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium italic transition-colors ${filterValue === NONE_VALUE ? "bg-gray-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {t.noSprint}
              </button>
            )}
            {effectiveDimension === "milestone" && hasNoMilestone && (
              <button type="button" onClick={() => setFilterValue(filterValue === NONE_VALUE ? null : NONE_VALUE)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium italic transition-colors ${filterValue === NONE_VALUE ? "bg-gray-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {t.noMilestone}
              </button>
            )}
          </div>
        )}

        {/* Density toggle (UX-013) — Compact fits more columns without zoom */}
        <button
          type="button"
          onClick={toggleDensity}
          aria-pressed={isCompact}
          className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${isCompact ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          title={isCompact ? (isEs ? "Vista cómoda" : "Comfortable view") : (isEs ? "Vista compacta (más columnas visibles)" : "Compact view (more columns visible)")}
        >
          {isCompact ? <Rows3 className="h-3 w-3" /> : <Rows4 className="h-3 w-3" />}
          <span>{isCompact ? (isEs ? "Compacto" : "Compact") : (isEs ? "Cómodo" : "Comfortable")}</span>
        </button>

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

          {/* UX-013 — the board is ONE 2D scroll area, height-bounded to the
              viewport. It scrolls BOTH ways on the same container: the vertical
              scrollbar (right) goes down through tall columns, the horizontal
              scrollbar (bottom) moves across columns. Both bars stay pinned to the
              board's edges (in view), never at the bottom of a long column. The
              height is measured at runtime so it fits the real remaining viewport. */}
          {/* items-stretch equalizes column heights across ALL groups so a
              short/empty target column still offers a full-height drop zone
              (fixes cross-column drops into columns shorter than the source). */}
          <div ref={scrollRef} className={`workboard-scroll flex items-stretch max-h-[calc(100vh-22rem)] ${isCompact ? "gap-2" : "gap-4"} overflow-auto pb-3 scroll-smooth`} style={{ maxHeight: boardMaxH ? `${boardMaxH}px` : undefined }}>
            {COLUMN_GROUPS.map((group) => {
              const collapsed = isGroupCollapsed(group.label);
              const visibleStatuses = group.statuses.filter((s) => isColumnVisible(s));
              const groupTaskCount = group.statuses.reduce((sum, s) => sum + tasksByStatus[s].length, 0);

              if (visibleStatuses.length === 0 && !collapsed) return null;

              return (
                <div key={group.label} className="flex-shrink-0 flex flex-col">
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-2 cursor-pointer select-none group/header" onClick={() => toggleGroup(group.label)}>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.groupLabels[group.label]}</span>
                    <span className="text-[10px] text-muted-foreground/60 font-medium">{groupTaskCount}</span>
                  </div>

                  {/* Columns — flex-1 + items-stretch so each column fills the
                      group height, giving short/empty columns a full drop zone. */}
                  {!collapsed && visibleStatuses.length > 0 && (
                    <div className={`flex flex-1 items-stretch ${isCompact ? "gap-2" : "gap-3"}`}>
                      {visibleStatuses.map((status, statusIndex) => (
                        <BoardColumn
                          key={status}
                          status={status}
                          compact={isCompact}
                          isLastInGroup={statusIndex === visibleStatuses.length - 1}
                          columnTasks={tasksByStatus[status]}
                          milestoneMap={milestoneMap}
                          predecessorsByTask={predecessorsByTask}
                          assignees={assignees}
                          anyResizing={anyResizing}
                          getColumnWidth={getColumnWidth}
                          setColumnWidth={setColumnWidth}
                          resetColumnWidth={resetColumnWidth}
                          isColumnCollapsed={isColumnCollapsed}
                          toggleColumnCollapse={toggleColumnCollapse}
                          onResizeStart={handleResizeStart}
                          onResizeEnd={handleResizeEnd}
                          onTaskClick={(task) => setEditingTask(task)}
                          onDeleteRequest={(task) => setPendingDelete(task)}
                          subtaskSummary={subtaskSummary}
                          taskMapBase={`/${locale}/projects/${projectId}/tasks`}
                          translations={{
                            columns: t.columns,
                            empty: t.empty,
                            collapseColumn: t.collapseColumn,
                            expandColumn: t.expandColumn,
                            resetWidth: t.resetWidth,
                            priorityLabels: t.priorityLabels,
                            dependsOn: t.dependsOn,
                            owner: t.owner,
                            unassigned: t.unassigned,
                            assignedUserUnavailable: t.assignedUserUnavailable,
                            deleteTask: t.cleanup.deleteTask,
                            subtasks: t.subtasks,
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

      {/* Workboard Cleanup — delete confirmation (NO-MILESTONE tasks only).
          Nothing is deleted until the user explicitly confirms here. */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl" role="alertdialog" aria-modal="true">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />
              {t.cleanup.confirmTitle}
            </h2>
            <p className="mt-2 break-words text-sm font-medium text-foreground">{pendingDelete.title}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.cleanup.confirmBody}</p>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.cleanup.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="workboard-delete-confirm"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.cleanup.confirmDelete}
              </button>
            </div>
          </div>
        </div>
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