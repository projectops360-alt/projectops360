"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { PinnableKpi, ResolvedPinnedKpi } from "@/lib/kpi/milestone-pins";
import { MilestoneKpiContextMenu } from "@/components/graph/milestone-kpi-context-menu";
import { pinKpiToMilestone, unpinKpiFromMilestone } from "@/lib/kpi/milestone-pin-actions";
import { useRouter } from "next/navigation";
import { placeHoverPanel } from "@/lib/roadmap/hover-panel-position";
import {
  ganttTimelineWidth,
  defaultZoomFor,
  fitsLabel,
  monthLabelStep,
  GANTT_ZOOM_LEVELS,
  type GanttZoom,
} from "@/lib/roadmap/gantt-zoom";
import type { Milestone, RoadmapTask, TaskStatus, TaskPriority, Locale } from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import {
  CheckCircle2, Loader2, Circle, Ban, Pause,
  FileText, Send, Code, ShieldCheck, Calendar,
  ChevronRight, ChevronDown, ZoomIn, ZoomOut, Maximize2, AlertCircle,
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
  /** KPIs pinned to each milestone — the same pins the Living Graph shows. */
  pinnedKpisByMilestone?: Record<string, ResolvedPinnedKpi[]>;
  /** Everything pinnable, for the right-click menu on a milestone row. */
  pinnableKpis?: PinnableKpi[];
  projectId?: string;
}

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

/** Bilingual labels for the zoom levels (UX-012: never one language only). */
const ZOOM_LABEL = {
  en: { fit: "Fit", quarter: "Quarter", month: "Month", week: "Week", day: "Day" },
  es: { fit: "Todo", quarter: "Trimestre", month: "Mes", week: "Semana", day: "Día" },
} as const;

// Row height constants
const ROW_HEIGHT = 32; // px per row
const MILESTONE_ROW_HEIGHT = 36; // px per milestone row
const LEFT_COL_WIDTH = 220; // px for the label column
/** Must match the panel's Tailwind width below (w-[280px]). */
const HOVER_PANEL_WIDTH = 280;

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

// ── Month Headers ─────────────────────────────────────────────────────────────

function MonthHeaders({
  range,
  locale,
  timelineWidth,
}: {
  range: { start: Date; end: Date; totalDays: number };
  locale: Locale;
  /** Drives how many month labels fit before they collide. */
  timelineWidth: number;
}) {
  const months: { label: string; left: number; width: number; show: boolean }[] = [];
  // On a fourteen-month plan at Fit zoom every month label would overlap the
  // next. Thin them to quarters/half-years rather than letting them collide.
  const step = monthLabelStep(range.totalDays, timelineWidth);
  let index = 0;
  const startMonth = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  let current = new Date(startMonth);

  while (current <= range.end) {
    const monthStart = new Date(Math.max(current.getTime(), range.start.getTime()));
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const monthEnd = new Date(Math.min(nextMonth.getTime(), range.end.getTime()));
    const leftPx = (daysBetween(range.start, monthStart) / range.totalDays) * 100;
    const widthPx = (daysBetween(monthStart, monthEnd) / range.totalDays) * 100;
    months.push({
      label: current.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
        month: "short",
        year: "numeric",
      }),
      left: leftPx,
      width: widthPx,
      show: index % step === 0,
    });
    index++;
    current = nextMonth;
  }

  return (
    <div className="relative h-6 mb-1">
      {months.map((m, i) => (
        <div
          key={i}
          className="absolute top-0 overflow-hidden whitespace-nowrap border-l border-border pl-1 text-[10px] font-medium text-muted-foreground"
          style={{ left: `${m.left}%`, width: `${m.width}%` }}
        >
          {m.show ? m.label : ""}
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

// ── Milestone inspector ───────────────────────────────────────────────────────

function MilestoneInspector({
  milestone,
  counts,
  kpis,
  locale,
}: {
  milestone: Milestone;
  counts: TaskCount;
  kpis: ResolvedPinnedKpi[];
  locale: Locale;
}) {
  const isEs = locale === "es";
  return (
    <div className="space-y-1.5 text-xs">
      <div className="text-sm font-semibold">{milestone.title}</div>
      <div className="text-muted-foreground">
        {counts.done}/{counts.total} {isEs ? "tareas" : "tasks"}
      </div>
      {milestone.start_date && milestone.target_date && (
        <div className="text-muted-foreground">
          {formatShortDate(parseDate(milestone.start_date)!, locale)} —{" "}
          {formatShortDate(parseDate(milestone.target_date)!, locale)}
        </div>
      )}

      {/* The SAME pins the Living Graph shows, evaluated in this milestone's
          own scope. Not a second copy of the numbers — one source (REG-010). */}
      {kpis.length > 0 ? (
        <div className="space-y-1 border-t border-border/60 pt-1.5">
          {kpis.map((kpi) => (
            <div key={kpi.slug} className="flex items-baseline justify-between gap-2">
              {kpi.status === "missing" ? (
                <>
                  <span className="truncate italic text-muted-foreground/70">{kpi.slug}</span>
                  <span className="shrink-0 text-[9px] text-amber-600 dark:text-amber-400">
                    {isEs ? "KPI eliminado" : "KPI deleted"}
                  </span>
                </>
              ) : (
                <>
                  <span className="truncate text-muted-foreground">
                    {isEs ? kpi.nameEs : kpi.nameEn}
                  </span>
                  {kpi.status === "ok" ? (
                    <span
                      className={`shrink-0 font-mono font-bold tabular-nums ${kpi.offTarget ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}
                    >
                      {kpi.formatted}
                      {kpi.unit && kpi.unit !== "currency" && (
                        <span className="ml-0.5 text-[9px] font-semibold text-muted-foreground">
                          {kpi.unit}
                        </span>
                      )}
                    </span>
                  ) : (
                    // "Not computable" is an answer, shown in full — hiding the
                    // row would look like the KPI was never pinned.
                    <span className="shrink-0 font-mono text-muted-foreground/70" title={kpi.reason}>
                      {kpi.taskCount === 0
                        ? isEs ? "sin tareas" : "no tasks"
                        : isEs ? "sin datos" : "no data"}
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground/80">
          {isEs
            ? "Clic derecho sobre el hito para añadirle un KPI."
            : "Right-click the milestone to add a KPI."}
        </p>
      )}
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
    <div className="space-y-1.5 text-xs">
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
  pinnedKpisByMilestone,
  pinnableKpis,
  projectId,
}: GanttRoadmapProps) {
  // null = the user has not chosen; the level is derived from how long the
  // plan is, so a two-week sprint opens at Day and a two-year programme at
  // Quarter without anyone hunting for the right button.
  const [zoomChoice, setZoomChoice] = useState<GanttZoom | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [showBaseline, setShowBaseline] = useState(true);
  /** Live canvas width for the drag handler, which closes over its own scope. */
  const timelineWidthRef = useRef(0);
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
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);
  /** Where the pointer was when the row was ENTERED. Deliberately not tracked
   *  on move: re-rendering 274 rows for every pixel of travel would make the
   *  chart stutter, and the panel only needs to be near the row, not glued to
   *  the cursor. */
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [kpiMenu, setKpiMenu] = useState<{ milestoneId: string; title: string; x: number; y: number } | null>(null);
  const router = useRouter();

  const range = computeDateRange(milestones, tasksByMilestone);

  // ── Drag-and-drop for task bars ──────────────────────────────────────────────
  const ganttRef = useRef<HTMLDivElement | null>(null);

  // The timeline needs a real pixel width, and that starts with knowing how
  // much room it has. Measured rather than assumed so the chart reflows when
  // the window resizes or a side panel opens.
  useEffect(() => {
    const el = ganttRef.current;
    if (!el) return;
    const measure = () => setAvailableWidth(Math.max(0, el.clientWidth - LEFT_COL_WIDTH));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      // The width the percentages are relative to is the CANVAS, which is now
      // wider than the viewport at most zoom levels. Measuring the scroller
      // instead would make a bar jump further than the cursor moved.
      const chartWidth = timelineWidthRef.current;
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

  const zoom: GanttZoom =
    zoomChoice ?? (availableWidth > 0 ? defaultZoomFor(range.totalDays, availableWidth) : "fit");
  // THE fix: bars are still positioned in percentages, but the canvas those
  // percentages are of now has a width that the zoom level actually decides.
  const timelineWidth = ganttTimelineWidth({
    totalDays: range.totalDays,
    zoom,
    availableWidth,
  });

  timelineWidthRef.current = timelineWidth;

  // What the fixed inspector shows. Hovering a task wins over hovering its
  // milestone row: the pointer is on the more specific thing.
  const inspector = (() => {
    if (hoveredTask) {
      for (const m of milestones) {
        const found = (tasksByMilestone[m.id] ?? []).find((x) => x.id === hoveredTask);
        if (found) return { kind: "task" as const, task: found, milestone: m };
      }
    }
    if (hoveredMilestone) {
      const m = milestones.find((x) => x.id === hoveredMilestone);
      if (m) {
        return {
          kind: "milestone" as const,
          milestone: m,
          counts: taskCounts[m.id] ?? { total: 0, done: 0, inProgress: 0 },
        };
      }
    }
    return null;
  })();

  const placement =
    inspector && pointer && typeof window !== "undefined"
      ? placeHoverPanel({
          pointerX: pointer.x,
          pointerY: pointer.y,
          panelWidth: HOVER_PANEL_WIDTH,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        })
      : null;

  // How much of the plan has moved since it was committed to. Counted here so
  // the toolbar can say "no drift" out loud instead of showing an empty legend
  // that the user has to interpret.
  const baselineStats = (() => {
    let total = 0;
    let drifted = 0;
    for (const list of Object.values(tasksByMilestone)) {
      for (const task of list) {
        if (!task.baseline_start_date || !task.baseline_end_date) continue;
        total++;
        if (
          task.baseline_start_date !== task.start_date ||
          task.baseline_end_date !== task.end_date
        ) {
          drifted++;
        }
      }
    }
    return { total, drifted };
  })();

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
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {locale === "es" ? "Zoom" : "Zoom"}:
        </span>
        {GANTT_ZOOM_LEVELS.map((level) => {
          const label = ZOOM_LABEL[locale === "es" ? "es" : "en"][level];
          const active = zoom === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => setZoomChoice(level)}
              aria-pressed={active}
              title={
                level === "fit"
                  ? locale === "es"
                    ? "Ajustar todo el cronograma a la pantalla"
                    : "Fit the whole schedule on screen"
                  : undefined
              }
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border border-border bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {level === "fit" && <Maximize2 className="h-3 w-3" />}
              {level === "quarter" && <ZoomOut className="h-3 w-3" />}
              {level === "day" && <ZoomIn className="h-3 w-3" />}
              {label}
            </button>
          );
        })}
        {zoomChoice != null && (
          <button
            type="button"
            onClick={() => setZoomChoice(null)}
            className="ml-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            {locale === "es" ? "Automático" : "Auto"}
          </button>
        )}

        {/*
          Plan inicial vs plan actual. Offered only when a baseline exists —
          a toggle that reveals nothing would suggest the project has no drift
          when the truth is that it has nothing to compare against.
        */}
        {baselineStats.total > 0 && (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={() => setShowBaseline((v) => !v)}
              aria-pressed={showBaseline}
              className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
                showBaseline
                  ? "border border-border bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="h-[5px] w-4 rounded-full border border-dashed border-slate-400 bg-slate-300/60" aria-hidden />
              {locale === "es" ? "Plan inicial" : "Original plan"}
            </button>
            <span className="text-[10px] text-muted-foreground">
              {baselineStats.drifted === 0
                ? locale === "es"
                  ? "Sin desviación respecto al plan inicial"
                  : "No drift from the original plan"
                : locale === "es"
                  ? `${baselineStats.drifted} de ${baselineStats.total} tareas reprogramadas`
                  : `${baselineStats.drifted} of ${baselineStats.total} tasks rescheduled`}
            </span>
          </>
        )}
      </div>

      {/*
        The inspector, pinned to the top right.

        It used to be a tooltip anchored to the hovered ROW (`top-full`), which
        dropped it straight over the twelve rows underneath — the detail was
        legible only by covering the chart it described. Fixed to one corner it
        never occludes a bar, and the eye learns one place to look instead of
        tracking a box that moves with the cursor.
      */}
      <div className="relative">
      {inspector && placement && (
        <div
          role="status"
          // Fixed to the viewport, not the row: anchored to the pointer so it
          // belongs to what is being hovered, and hanging UPWARD so the rows
          // below — the ones being compared against — stay readable.
          // pointer-events-none so it can never swallow a drag that started on
          // a bar beneath it.
          style={{
            left: placement.left,
            top: placement.top,
            transform: placement.above ? "translateY(-100%)" : undefined,
          }}
          className="pointer-events-none fixed z-50 w-[280px] rounded-xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur"
        >
          {inspector.kind === "task" ? (
            <TaskTooltip task={inspector.task} milestone={inspector.milestone} locale={locale} />
          ) : (
            <MilestoneInspector
              milestone={inspector.milestone}
              counts={inspector.counts}
              kpis={pinnedKpisByMilestone?.[inspector.milestone.id] ?? []}
              locale={locale}
            />
          )}
        </div>
      )}

      {/* Gantt chart */}
      <div className="overflow-x-auto rounded-lg border border-border" ref={ganttRef}>
        <div style={{ width: LEFT_COL_WIDTH + timelineWidth }}>
          {/* Header row */}
          <div className="sticky top-0 z-30 bg-muted/50 backdrop-blur-sm">
            <div className="flex">
              <div className="shrink-0 border-b border-r border-border bg-muted/80" style={{ width: LEFT_COL_WIDTH }}>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {t.milestone} / {t.tasks}
                </div>
              </div>
              <div className="relative border-b border-border" style={{ width: timelineWidth }}>
                <MonthHeaders range={range} locale={locale} timelineWidth={timelineWidth} />
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
                    onMouseEnter={(e) => {
                      setHoveredMilestone(milestone.id);
                      setPointer({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => {
                      setHoveredMilestone(null);
                      setPointer(null);
                    }}
                    // Right-click a phase to decide how it is measured. The pin
                    // is the same row the Living Graph writes, so a KPI added
                    // here appears there and vice versa.
                    onContextMenu={(e) => {
                      if (!projectId || !pinnableKpis?.length) return;
                      e.preventDefault();
                      setKpiMenu({
                        milestoneId: milestone.id,
                        title: milestone.title,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    style={{ height: MILESTONE_ROW_HEIGHT }}
                  >
                    {/* Label */}
                    <div className="shrink-0 border-b border-r border-border px-2 flex items-center gap-1.5" style={{ width: LEFT_COL_WIDTH }}>
                      {(pinnedKpisByMilestone?.[milestone.id]?.length ?? 0) > 0 && (
                        <span
                          className="shrink-0 rounded bg-brand-500/15 px-1 font-mono text-[9px] font-bold text-brand-700 dark:text-brand-300"
                          title={locale === "es" ? "KPIs de este hito" : "KPIs on this milestone"}
                        >
                          {pinnedKpisByMilestone![milestone.id].length}
                        </span>
                      )}
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
                    <div className="relative border-b border-border" style={{ height: MILESTONE_ROW_HEIGHT, width: timelineWidth }}>
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
                      {milestoneStart && msWidth > 0 && fitsLabel((msWidth / 100) * timelineWidth) && (
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

                    // The plan this work was COMMITTED to, drawn underneath as
                    // a thin ghost. Only when it differs from today's dates —
                    // a ghost sitting exactly under every bar is noise that
                    // teaches the eye to ignore the one that has moved.
                    const baseStart = parseDate(task.baseline_start_date ?? null);
                    const baseEnd = parseDate(task.baseline_end_date ?? null);
                    const hasDrift =
                      showBaseline &&
                      baseStart != null && baseEnd != null &&
                      (task.baseline_start_date !== task.start_date ||
                        task.baseline_end_date !== task.end_date);
                    const bLeft = hasDrift ? getPos(baseStart!, range) : 0;
                    const bWidth = hasDrift ? Math.max(0.5, getPos(baseEnd!, range) - bLeft) : 0;
                    const slipDays = hasDrift && taskEndDate
                      ? Math.round((taskEndDate.getTime() - baseEnd!.getTime()) / 86400000)
                      : 0;

                    const isHovered = hoveredTask === task.id;
                    const progressPct = task.progress ?? 0;

                    return (
                      <div
                        key={task.id}
                        className="flex items-center hover:bg-muted/20 transition-colors relative"
                        style={{ height: ROW_HEIGHT }}
                        onMouseEnter={(e) => {
                          setHoveredTask(task.id);
                          setPointer({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => {
                          setHoveredTask(null);
                          setPointer(null);
                        }}
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
                        <div className="relative border-b border-border" style={{ height: ROW_HEIGHT, width: timelineWidth }}>
                          {hasDrift && (
                            <div
                              className="absolute bottom-0.5 h-[5px] rounded-full border border-dashed border-slate-400/70 bg-slate-300/50 dark:border-slate-500/70 dark:bg-slate-600/40"
                              style={{ left: `${bLeft}%`, width: `${bWidth}%` }}
                              title={
                                locale === "es"
                                  ? `Plan inicial: ${task.baseline_start_date} → ${task.baseline_end_date}` +
                                    (slipDays !== 0 ? ` · ${slipDays > 0 ? "+" : ""}${slipDays} d` : "")
                                  : `Original plan: ${task.baseline_start_date} → ${task.baseline_end_date}` +
                                    (slipDays !== 0 ? ` · ${slipDays > 0 ? "+" : ""}${slipDays} d` : "")
                              }
                            />
                          )}
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
                              {fitsLabel((tWidth / 100) * timelineWidth) && (
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

      {kpiMenu && projectId && (
        <MilestoneKpiContextMenu
          locale={locale}
          x={kpiMenu.x}
          y={kpiMenu.y}
          milestoneTitle={kpiMenu.title}
          available={pinnableKpis ?? []}
          pinned={pinnedKpisByMilestone?.[kpiMenu.milestoneId] ?? []}
          onTogglePin={async (slug, isPinned) => {
            const action = isPinned ? unpinKpiFromMilestone : pinKpiToMilestone;
            const result = await action({ projectId, milestoneId: kpiMenu.milestoneId, kpiSlug: slug });
            if (result.ok) {
              router.refresh();
              return null;
            }
            return result.error ?? "write_failed";
          }}
          onClose={() => setKpiMenu(null)}
        />
      )}
    </div>
  );
}