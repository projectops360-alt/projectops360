"use client";

import { useState, useCallback, useRef } from "react";
import type { Milestone, RoadmapTask, TaskStatus, TaskPriority, Locale } from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import {
  CheckCircle2, Loader2, Circle, Ban, Pause,
  FileText, Send, Code, ShieldCheck, Calendar,
  ChevronRight, ChevronDown, ZoomIn, ZoomOut, AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskCount {
  total: number;
  done: number;
  inProgress: number;
}

interface GanttTranslations {
  statusLabels: Record<string, string>;
  priorityLabels: Record<TaskPriority, string>;
  tasks: string;
  noTasks: string;
  noDate: string;
  schedule: string;
  milestone: string;
}

interface GanttRoadmapProps {
  milestones: Milestone[];
  progress: RoadmapProgress;
  tasksByMilestone: Record<string, RoadmapTask[]>;
  taskCounts: Record<string, TaskCount>;
  locale: Locale;
  translations: GanttTranslations;
  onTaskDatesChange?: (taskId: string, startDate: string, endDate: string) => void;
}

type ZoomLevel = "day" | "week" | "month";

// ── Constants ────────────────────────────────────────────────────────────────

const TASK_STATUS_BAR: Record<TaskStatus, { bg: string; fill: string; text: string; border: string }> = {
  done: { bg: "bg-green-200 dark:bg-green-900/40", fill: "bg-green-500", text: "text-green-700 dark:text-green-400", border: "border-green-300 dark:border-green-700" },
  tested: { bg: "bg-emerald-200 dark:bg-emerald-900/40", fill: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-700" },
  implemented: { bg: "bg-cyan-200 dark:bg-cyan-900/40", fill: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-300 dark:border-cyan-700" },
  in_progress: { bg: "bg-blue-200 dark:bg-blue-900/40", fill: "bg-blue-500", text: "text-blue-700 dark:text-blue-400", border: "border-blue-300 dark:border-blue-700" },
  sent_to_ai: { bg: "bg-indigo-200 dark:bg-indigo-900/40", fill: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-300 dark:border-indigo-700" },
  prompt_ready: { bg: "bg-purple-200 dark:bg-purple-900/40", fill: "bg-purple-500", text: "text-purple-700 dark:text-purple-400", border: "border-purple-300 dark:border-purple-700" },
  not_started: { bg: "bg-gray-200 dark:bg-gray-800/40", fill: "bg-gray-400 dark:bg-gray-500", text: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600" },
  blocked: { bg: "bg-red-200 dark:bg-red-900/40", fill: "bg-red-500", text: "text-red-700 dark:text-red-400", border: "border-red-300 dark:border-red-700" },
  deferred: { bg: "bg-amber-200 dark:bg-amber-900/40", fill: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-700" },
};

const MILESTONE_STATUS_BAR: Record<string, { bg: string; fill: string; dot: string; text: string; border: string }> = {
  completed: { bg: "bg-green-200 dark:bg-green-900/40", fill: "bg-green-500", dot: "bg-green-500", text: "text-green-700 dark:text-green-400", border: "border-green-300 dark:border-green-700" },
  in_progress: { bg: "bg-brand-200 dark:bg-brand-900/40", fill: "bg-brand-500", dot: "bg-brand-500 animate-pulse", text: "text-brand-700 dark:text-brand-400", border: "border-brand-300 dark:border-brand-700" },
  planned: { bg: "bg-gray-200 dark:bg-gray-800/40", fill: "bg-gray-400 dark:bg-gray-500", dot: "bg-gray-400 dark:bg-gray-500", text: "text-gray-600 dark:text-gray-400", border: "border-gray-300 dark:border-gray-600" },
  blocked: { bg: "bg-red-200 dark:bg-red-900/40", fill: "bg-red-500", dot: "bg-red-500", text: "text-red-700 dark:text-red-400", border: "border-red-300 dark:border-red-700" },
  deferred: { bg: "bg-amber-200 dark:bg-amber-900/40", fill: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-700" },
};

const TASK_STATUS_ICON: Record<TaskStatus, { icon: React.ReactNode; color: string }> = {
  done: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
  tested: { icon: <ShieldCheck className="h-3.5 w-3.5" />, color: "text-emerald-600 dark:text-emerald-400" },
  implemented: { icon: <Code className="h-3.5 w-3.5" />, color: "text-cyan-600 dark:text-cyan-400" },
  in_progress: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: "text-blue-600 dark:text-blue-400" },
  sent_to_ai: { icon: <Send className="h-3.5 w-3.5" />, color: "text-indigo-600 dark:text-indigo-400" },
  prompt_ready: { icon: <FileText className="h-3.5 w-3.5" />, color: "text-purple-600 dark:text-purple-400" },
  not_started: { icon: <Circle className="h-3.5 w-3.5" />, color: "text-gray-400" },
  blocked: { icon: <Ban className="h-3.5 w-3.5" />, color: "text-red-600 dark:text-red-400" },
  deferred: { icon: <Pause className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400" },
};

// Row height constants
const ROW_HEIGHT = 32; // px per row
const MILESTONE_ROW_HEIGHT = 36; // px per milestone row
const LEFT_COL_WIDTH = 220; // px for the label column

// ── Helpers ──────────────────────────────────────────────────────────────────────

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const date = new Date(d + "T00:00:00");
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Compute date range from milestones + tasks that have dates */
function computeDateRange(
  milestones: Milestone[],
  tasksByMilestone: Record<string, RoadmapTask[]>,
): { start: Date; end: Date; totalDays: number } | null {
  let earliest: Date | null = null;
  let latest: Date | null = null;

  // Check milestone dates
  for (const m of milestones) {
    const ms = parseDate(m.start_date);
    const mt = parseDate(m.target_date);
    if (ms) { if (!earliest || ms < earliest) earliest = ms; if (!latest || ms > latest) latest = ms; }
    if (mt) { if (!earliest || mt < earliest) earliest = mt; if (!latest || mt > latest) latest = mt; }
  }

  // Check task dates
  for (const tasks of Object.values(tasksByMilestone)) {
    for (const t of tasks) {
      const ts = parseDate(t.start_date);
      const te = parseDate(t.end_date);
      if (ts) { if (!earliest || ts < earliest) earliest = ts; if (!latest || ts > latest) latest = ts; }
      if (te) { if (!earliest || te < earliest) earliest = te; if (!latest || te > latest) latest = te; }
    }
  }

  if (!earliest || !latest) return null;

  // Add padding
  const start = new Date(earliest);
  start.setDate(start.getDate() - 3);
  const end = new Date(latest);
  end.setDate(end.getDate() + 3);

  const totalDays = daysBetween(start, end);
  return totalDays > 0 ? { start, end, totalDays } : null;
}

/** Get position as percentage */
function getPos(date: Date, range: { start: Date; totalDays: number }): number {
  return (daysBetween(range.start, date) / range.totalDays) * 100;
}

// ── Zoom Configuration ──────────────────────────────────────────────────────────

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 32, label: "Day" },
  week: { dayWidth: 12, label: "Week" },
  month: { dayWidth: 4, label: "Month" },
};

// ── Month Headers ─────────────────────────────────────────────────────────────

function MonthHeaders({
  range,
  locale,
  zoom,
}: {
  range: { start: Date; end: Date; totalDays: number };
  locale: Locale;
  zoom: ZoomLevel;
}) {
  const months: { label: string; left: number; width: number }[] = [];
  const startMonth = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  let current = new Date(startMonth);

  while (current <= range.end) {
    const monthStart = new Date(Math.max(current.getTime(), range.start.getTime()));
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const monthEnd = new Date(Math.min(nextMonth.getTime(), range.end.getTime()));
    const leftPx = (daysBetween(range.start, monthStart) / range.totalDays) * 100;
    const widthPx = (daysBetween(monthStart, monthEnd) / range.totalDays) * 100;
    months.push({
      label: current.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { month: zoom === "day" ? "short" : "short", year: "numeric" }),
      left: leftPx,
      width: widthPx,
    });
    current = nextMonth;
  }

  return (
    <div className="relative h-6 mb-1">
      {months.map((m, i) => (
        <div
          key={i}
          className="absolute top-0 text-[10px] font-medium text-muted-foreground border-l border-border pl-1"
          style={{ left: `${m.left}%`, width: `${m.width}%` }}
        >
          {m.label}
        </div>
      ))}
    </div>
  );
}

// ── Today Marker ──────────────────────────────────────────────────────────────

function TodayMarker({ range }: { range: { start: Date; end: Date; totalDays: number } }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < range.start || today > range.end) return null;
  const leftPercent = (daysBetween(range.start, today) / range.totalDays) * 100;
  return (
    <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 dark:bg-red-500 z-20 pointer-events-none">
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
        {today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>
    </div>
  );
}

// ── Task Tooltip ──────────────────────────────────────────────────────────────

function TaskTooltip({ task, milestone, locale }: { task: RoadmapTask; milestone: Milestone; locale: Locale }) {
  const startDate = parseDate(task.start_date);
  const endDate = parseDate(task.end_date);
  const statusLabel = TASK_STATUS_BAR[task.status]?.text ?? task.status;
  const priorityLabel = task.priority.toUpperCase();
  const progressPct = task.progress ?? 0;

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 text-xs space-y-1.5 min-w-[200px] z-50">
      <div className="font-semibold text-sm">{task.title}</div>
      <div className="text-muted-foreground">{milestone.title}</div>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 ${TASK_STATUS_BAR[task.status]?.text ?? ""}`}>
          {TASK_STATUS_ICON[task.status]?.icon}
          {task.status.replace(/_/g, " ")}
        </span>
        <span className="text-muted-foreground">·</span>
        <span>{priorityLabel}</span>
      </div>
      {startDate && (
        <div className="text-muted-foreground">
          {locale === "es" ? "Inicio" : "Start"}: {formatShortDate(startDate, locale)}
        </div>
      )}
      {endDate && (
        <div className="text-muted-foreground">
          {locale === "es" ? "Fin" : "End"}: {formatShortDate(endDate, locale)}
        </div>
      )}
      {startDate && endDate && (
        <div className="text-muted-foreground">
          {locale === "es" ? "Duración" : "Duration"}: {daysBetween(startDate, endDate) + 1}d
        </div>
      )}
      {task.estimate_hours && (
        <div className="text-muted-foreground">
          {locale === "es" ? "Estimado" : "Est."}: {task.estimate_hours}h
        </div>
      )}
      {progressPct > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-muted-foreground">{progressPct}%</span>
        </div>
      )}
      {task.is_blocked && task.blocker_reason && (
        <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{task.blocker_reason}</span>
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────────

export function GanttRoadmap({
  milestones,
  progress,
  tasksByMilestone,
  taskCounts,
  locale,
  translations: t,
  onTaskDatesChange,
}: GanttRoadmapProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [dragState, setDragState] = useState<{
    taskId: string;
    startDate: Date;
    endDate: Date;
    startMouseX: number;
    barLeftPercent: number;
    barWidthPercent: number;
  } | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(() => {
    // Expand milestones that are in_progress by default
    const expanded = new Set<string>();
    for (const m of milestones) {
      if (m.status === "in_progress") expanded.add(m.id);
    }
    // If none in_progress, expand the first one
    if (expanded.size === 0 && milestones.length > 0) {
      expanded.add(milestones[0].id);
    }
    return expanded;
  });
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const range = computeDateRange(milestones, tasksByMilestone);

  // ── Drag-and-drop for task bars ──────────────────────────────────────────────
  const ganttRef = useRef<HTMLDivElement | null>(null);

  const handleBarMouseDown = useCallback((
    e: React.MouseEvent,
    taskId: string,
    startDate: string | null,
    endDate: string | null,
    barLeftPercent: number,
    barWidthPercent: number,
  ) => {
    // Only handle left click on bars with dates
    if (!startDate || !endDate || !range || !onTaskDatesChange) return;
    e.preventDefault();
    e.stopPropagation();

    const startD = parseDate(startDate)!;
    const endD = parseDate(endDate)!;

    setDragState({
      taskId,
      startDate: startD,
      endDate: endD,
      startMouseX: e.clientX,
      barLeftPercent,
      barWidthPercent,
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!ganttRef.current) return;
      const chartWidth = ganttRef.current.offsetWidth - LEFT_COL_WIDTH;
      if (chartWidth <= 0) return;

      const dx = moveEvent.clientX - e.clientX;
      const dPercent = (dx / chartWidth) * 100;
      const dDays = (dPercent / 100) * range.totalDays;
      const roundedDays = Math.round(dDays);

      const newStart = new Date(startD);
      newStart.setDate(newStart.getDate() + roundedDays);
      const newEnd = new Date(endD);
      newEnd.setDate(newEnd.getDate() + roundedDays);

      setDragState((prev) =>
        prev ? { ...prev, startDate: newStart, endDate: newEnd } : null
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      setDragState((prev) => {
        if (prev && onTaskDatesChange) {
          const fmt = (d: Date) => d.toISOString().split("T")[0];
          onTaskDatesChange(prev.taskId, fmt(prev.startDate), fmt(prev.endDate));
        }
        return null;
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [range, onTaskDatesChange]);

  const toggleMilestone = (id: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!range) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <Calendar className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t.noDate}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {locale === "es" ? "Agrega fechas a los hitos o tareas para ver el cronograma." : "Add dates to milestones or tasks to see the schedule."}
        </p>
      </div>
    );
  }

  // Calculate total rows for scroll height
  let totalRows = 0;
  for (const m of milestones) {
    totalRows += 1; // milestone row
    if (expandedMilestones.has(m.id)) {
      totalRows += (tasksByMilestone[m.id]?.length ?? 0);
    }
  }

  return (
    <div className="space-y-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">
          {locale === "es" ? "Zoom" : "Zoom"}:
        </span>
        <button
          type="button"
          onClick={() => setZoom("day")}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${zoom === "day" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ZoomIn className="h-3 w-3" />
          {locale === "es" ? "Día" : "Day"}
        </button>
        <button
          type="button"
          onClick={() => setZoom("week")}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${zoom === "week" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
        >
          {locale === "es" ? "Semana" : "Week"}
        </button>
        <button
          type="button"
          onClick={() => setZoom("month")}
          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${zoom === "month" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ZoomOut className="h-3 w-3" />
          {locale === "es" ? "Mes" : "Month"}
        </button>
      </div>

      {/* Gantt chart */}
      <div className="overflow-x-auto rounded-lg border border-border" ref={ganttRef}>
        <div className="min-w-[800px]">
          {/* Header row */}
          <div className="sticky top-0 z-30 bg-muted/50 backdrop-blur-sm">
            <div className="flex">
              <div className="shrink-0 border-b border-r border-border bg-muted/80" style={{ width: LEFT_COL_WIDTH }}>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {t.milestone} / {t.tasks}
                </div>
              </div>
              <div className="flex-1 relative border-b border-border">
                <MonthHeaders range={range} locale={locale} zoom={zoom} />
                <TodayMarker range={range} />
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            <TodayMarker range={range} />

            {milestones.map((milestone) => {
              const milestoneStart = parseDate(milestone.start_date);
              const milestoneEnd = parseDate(milestone.target_date);
              const milestoneTasks = tasksByMilestone[milestone.id] ?? [];
              const counts = taskCounts[milestone.id] ?? { total: 0, done: 0, inProgress: 0 };
              const milestoneBar = MILESTONE_STATUS_BAR[milestone.status] ?? MILESTONE_STATUS_BAR.planned;
              const isExpanded = expandedMilestones.has(milestone.id);

              // Milestone bar position
              let msLeft = 0;
              let msWidth = 0;
              if (milestoneStart && milestoneEnd && milestoneEnd >= milestoneStart) {
                msLeft = getPos(milestoneStart, range);
                msWidth = Math.max(0.5, getPos(milestoneEnd, range) - msLeft);
              } else if (milestoneStart) {
                msLeft = getPos(milestoneStart, range);
                msWidth = 2;
              }

              // Milestone progress
              const msProgress = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : (milestone.progress_percent ?? 0);

              return (
                <div key={milestone.id}>
                  {/* Milestone row */}
                  <div
                    className="flex items-center cursor-pointer hover:bg-muted/30 transition-colors group/milestone"
                    onClick={() => toggleMilestone(milestone.id)}
                    style={{ height: MILESTONE_ROW_HEIGHT }}
                  >
                    {/* Label */}
                    <div className="shrink-0 border-b border-r border-border px-2 flex items-center gap-1.5" style={{ width: LEFT_COL_WIDTH }}>
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${milestoneBar.dot}`} />
                      <p className="text-xs font-semibold text-foreground truncate flex-1">
                        {milestone.title}
                      </p>
                      {counts.total > 0 && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {counts.done}/{counts.total}
                        </span>
                      )}
                    </div>

                    {/* Bar area */}
                    <div className="flex-1 relative border-b border-border" style={{ height: MILESTONE_ROW_HEIGHT }}>
                      {msWidth > 0 && (
                        <div
                          className={`absolute top-2 h-5 rounded ${milestoneBar.bg} border ${milestoneBar.border} transition-all group-hover/milestone:shadow-sm overflow-hidden`}
                          style={{ left: `${msLeft}%`, width: `${msWidth}%` }}
                          title={`${milestone.title}${milestoneStart ? ` · ${formatShortDate(milestoneStart, locale)}` : ""}${milestoneEnd ? ` → ${formatShortDate(milestoneEnd, locale)}` : ""} · ${msProgress}%`}
                        >
                          {msProgress > 0 && (
                            <div className={`h-full rounded ${milestoneBar.fill} opacity-60`} style={{ width: `${msProgress}%` }} />
                          )}
                        </div>
                      )}
                      {milestoneStart && msWidth > 0 && zoom !== "month" && (
                        <div
                          className="absolute top-0 text-[9px] text-muted-foreground/60 leading-none"
                          style={{ left: `${msLeft}%` }}
                        >
                          {formatShortDate(milestoneStart, locale)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task rows (expanded) */}
                  {isExpanded && milestoneTasks.map((task) => {
                    const taskBar = TASK_STATUS_BAR[task.status] ?? TASK_STATUS_BAR.not_started;
                    const taskIcon = TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.not_started;

                    // Task bar position - use task dates if available, otherwise milestone position
                    let tLeft = msLeft;
                    let tWidth = 0;
                    let hasOwnDates = false;
                    const taskStartDate = parseDate(task.start_date);
                    const taskEndDate = parseDate(task.end_date);

                    if (taskStartDate && taskEndDate && taskEndDate >= taskStartDate) {
                      tLeft = getPos(taskStartDate, range);
                      tWidth = Math.max(0.5, getPos(taskEndDate, range) - tLeft);
                      hasOwnDates = true;
                    } else if (taskStartDate) {
                      tLeft = getPos(taskStartDate, range);
                      tWidth = 2; // Single-day marker
                      hasOwnDates = true;
                    }

                    const isHovered = hoveredTask === task.id;
                    const progressPct = task.progress ?? 0;

                    return (
                      <div
                        key={task.id}
                        className="flex items-center hover:bg-muted/20 transition-colors relative"
                        style={{ height: ROW_HEIGHT }}
                        onMouseEnter={() => setHoveredTask(task.id)}
                        onMouseLeave={() => setHoveredTask(null)}
                      >
                        {/* Label */}
                        <div className="shrink-0 border-b border-r border-border pl-8 pr-2 flex items-center gap-1.5" style={{ width: LEFT_COL_WIDTH }}>
                          <span className={`shrink-0 ${taskIcon.color}`}>{taskIcon.icon}</span>
                          <p className="text-[11px] text-muted-foreground truncate flex-1">{task.title}</p>
                          {task.is_blocked && (
                            <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                          )}
                        </div>

                        {/* Bar area */}
                        <div className="flex-1 relative border-b border-border" style={{ height: ROW_HEIGHT }}>
                          {hasOwnDates && tWidth > 0 ? (
                            <div
                              className={`absolute top-1.5 h-[22px] rounded-sm ${taskBar.bg} border ${taskBar.border} overflow-hidden transition-all ${isHovered ? "shadow-md z-10" : ""} ${onTaskDatesChange ? "cursor-grab active:cursor-grabbing" : ""} ${dragState?.taskId === task.id ? "opacity-40" : ""}`}
                              style={{
                                left: dragState?.taskId === task.id
                                  ? `${getPos(dragState.startDate, range)}%`
                                  : `${tLeft}%`,
                                width: dragState?.taskId === task.id
                                  ? `${Math.max(0.5, getPos(dragState.endDate, range) - getPos(dragState.startDate, range))}%`
                                  : `${tWidth}%`,
                              }}
                              onMouseDown={(e) => handleBarMouseDown(e, task.id, task.start_date, task.end_date, tLeft, tWidth)}
                            >
                              {progressPct > 0 && (
                                <div className={`h-full ${taskBar.fill} rounded-sm opacity-70`} style={{ width: `${progressPct}%` }} />
                              )}
                              {zoom !== "month" && tWidth > 4 && (
                                <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-medium ${taskBar.text} truncate px-1`}>
                                  {task.status === "done" ? "✓" : ""}
                                </span>
                              )}
                            </div>
                          ) : (
                            // No dates — show as dot at milestone position
                            <div
                              className={`absolute top-2.5 h-3 w-3 rounded-full ${taskBar.fill} opacity-60 ${isHovered ? "opacity-100 shadow-sm" : ""}`}
                              style={{ left: `${msLeft}%` }}
                            />
                          )}
                        </div>

                        {/* Tooltip on hover */}
                        {isHovered && (
                          <div className="absolute z-50 left-[220px] top-full mt-1">
                            <TaskTooltip task={task} milestone={milestone} locale={locale} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}