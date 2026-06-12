"use client";

import type { Milestone, MilestoneStatus, RoadmapTask, TaskStatus, TaskPriority, Locale } from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import {
  CheckCircle2, Loader2, Circle, Ban, Pause,
  FileText, Send, Code, ShieldCheck,
  Settings, Shield, Users, BookOpen, Link2, Sparkles, BarChart3, RotateCcw, CheckCircle, Rocket,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskCount {
  total: number;
  done: number;
  inProgress: number;
}

interface BoardTranslations {
  statusLabels: Record<MilestoneStatus | TaskStatus, string>;
  priorityLabels: Record<TaskPriority, string>;
  tasks: string;
  noTasks: string;
  sprint: string;
  noDate: string;
}

interface MilestoneBoardProps {
  milestones: Milestone[];
  progress: RoadmapProgress;
  tasksByMilestone: Record<string, RoadmapTask[]>;
  taskCounts: Record<string, TaskCount>;
  expandedMilestones: Set<string>;
  onToggleMilestone: (id: string) => void;
  locale: Locale;
  translations: BoardTranslations;
}

// ── Constants ────────────────────────────────────────────────────────────────────

const COLUMNS: { status: MilestoneStatus; colorClass: string; headerClass: string; dotClass: string }[] = [
  { status: "completed", colorClass: "border-green-200 dark:border-green-800", headerClass: "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-400", dotClass: "bg-green-500" },
  { status: "in_progress", colorClass: "border-brand-200 dark:border-brand-800", headerClass: "bg-brand-50 dark:bg-brand-950/20 text-brand-800 dark:text-brand-400", dotClass: "bg-brand-500" },
  { status: "planned", colorClass: "border-gray-200 dark:border-gray-700", headerClass: "bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300", dotClass: "bg-gray-400" },
  { status: "blocked", colorClass: "border-red-200 dark:border-red-800", headerClass: "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-400", dotClass: "bg-red-500" },
  { status: "deferred", colorClass: "border-amber-200 dark:border-amber-800", headerClass: "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400", dotClass: "bg-amber-500" },
];

const STATUS_ICON: Record<MilestoneStatus, React.ReactNode> = {
  completed: <CheckCircle2 className="h-3.5 w-3.5" />,
  in_progress: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  planned: <Circle className="h-3.5 w-3.5" />,
  blocked: <Ban className="h-3.5 w-3.5" />,
  deferred: <Pause className="h-3.5 w-3.5" />,
};

const MILESTONE_ICON_MAP: Record<string, React.ReactNode> = {
  setup: <Settings className="h-4 w-4" />,
  shield_database: <Shield className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  notebook: <BookOpen className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
  sparkles: <Sparkles className="h-4 w-4" />,
  chart: <BarChart3 className="h-4 w-4" />,
  loop: <RotateCcw className="h-4 w-4" />,
  check_circle: <CheckCircle className="h-4 w-4" />,
  rocket: <Rocket className="h-4 w-4" />,
};

const TASK_STATUS_ICON: Record<TaskStatus, { icon: React.ReactNode; strike: boolean }> = {
  done: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />, strike: true },
  tested: { icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />, strike: false },
  implemented: { icon: <Code className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />, strike: false },
  in_progress: { icon: <Loader2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-spin" />, strike: false },
  sent_to_ai: { icon: <Send className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />, strike: false },
  prompt_ready: { icon: <FileText className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />, strike: false },
  not_started: { icon: <Circle className="h-3.5 w-3.5 text-gray-400" />, strike: false },
  blocked: { icon: <Ban className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />, strike: false },
  deferred: { icon: <Pause className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />, strike: false },
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  p1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  p2: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  p3: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function formatDate(date: string | null, locale: Locale): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Milestone Card ──────────────────────────────────────────────────────────────

function MilestoneCard({
  milestone,
  computedPercent,
  milestoneTasks,
  counts,
  isExpanded,
  onToggle,
  locale,
  t,
}: {
  milestone: Milestone;
  computedPercent: number;
  milestoneTasks: RoadmapTask[];
  counts: TaskCount;
  isExpanded: boolean;
  onToggle: () => void;
  locale: Locale;
  t: BoardTranslations;
}) {
  const icon = MILESTONE_ICON_MAP[milestone.icon_key ?? ""] ?? <Circle className="h-4 w-4" />;
  const startDate = formatDate(milestone.start_date, locale);
  const targetDate = formatDate(milestone.target_date, locale);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      {/* Card header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
            {icon}
          </div>
          <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">
            {milestone.title}
          </h4>
        </div>

        {/* Progress bar */}
        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              computedPercent === 100
                ? "bg-green-500"
                : milestone.status === "in_progress"
                  ? "bg-brand-600 dark:bg-brand-500"
                  : "bg-gray-400 dark:bg-gray-600"
            }`}
            style={{ width: `${computedPercent}%` }}
          />
        </div>

        {/* Meta row */}
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{computedPercent}%</span>
          {counts.total > 0 && (
            <span>{counts.done}/{counts.total} {t.tasks.toLowerCase()}</span>
          )}
        </div>

        {/* Date */}
        {(startDate || targetDate) && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {startDate && targetDate ? `${startDate} → ${targetDate}` : startDate || targetDate}
          </p>
        )}

        {/* Expand indicator */}
        <div className="mt-1 text-center">
          <svg className={`h-3.5 w-3.5 mx-auto text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Expanded tasks */}
      {isExpanded && (
        <div className="border-t border-border/50 bg-muted/20">
          {milestoneTasks.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {milestoneTasks.map((task) => {
                const taskStyle = TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.not_started;
                const priorityBadge = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.p2;
                return (
                  <li key={task.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="shrink-0">{taskStyle.icon}</span>
                    <span className={`text-xs leading-snug min-w-0 flex-1 ${taskStyle.strike ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {task.title}
                    </span>
                    <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${priorityBadge}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-xs italic text-muted-foreground">{t.noTasks}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Board Component ─────────────────────────────────────────────────────────────

export function MilestoneBoard({
  milestones,
  progress,
  tasksByMilestone,
  taskCounts,
  expandedMilestones,
  onToggleMilestone,
  locale,
  translations: t,
}: MilestoneBoardProps) {
  // Group milestones by status
  const milestonesByStatus: Record<MilestoneStatus, Milestone[]> = {
    completed: [],
    in_progress: [],
    planned: [],
    blocked: [],
    deferred: [],
  };

  for (const m of milestones) {
    const group = milestonesByStatus[m.status];
    if (group) group.push(m);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {COLUMNS.map((col) => {
        const columnMilestones = milestonesByStatus[col.status] ?? [];
        return (
          <div key={col.status} className={`flex flex-col rounded-xl border ${col.colorClass}`}>
            {/* Column header */}
            <div className={`rounded-t-xl px-3 py-2.5 ${col.headerClass}`}>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${col.dotClass}`} />
                <span className="text-xs font-semibold">
                  {t.statusLabels[col.status]}
                </span>
                <span className="ml-auto text-[10px] font-medium opacity-75">
                  {columnMilestones.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 min-h-[120px]">
              {columnMilestones.length > 0 ? (
                columnMilestones.map((milestone) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    computedPercent={progress.milestones[milestone.id]?.progressPercent ?? milestone.progress_percent}
                    milestoneTasks={tasksByMilestone[milestone.id] ?? []}
                    counts={taskCounts[milestone.id] ?? { total: 0, done: 0, inProgress: 0 }}
                    isExpanded={expandedMilestones.has(milestone.id)}
                    onToggle={() => onToggleMilestone(milestone.id)}
                    locale={locale}
                    t={t}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 italic">
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}