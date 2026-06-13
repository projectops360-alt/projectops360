"use client";

import { Link } from "@/i18n/navigation";
import type { Milestone, MilestoneStatus, RoadmapTask, TaskStatus, TaskPriority, Locale } from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import {
  Map, CheckCircle2, Loader2, Circle, Ban, Pause, ArrowRight,
  FileText, Send, Code, ShieldCheck,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SnapshotTranslations {
  title: string;
  viewFull: string;
  overallProgress: string;
  currentMilestone: string;
  nextMilestone: string;
  blockedTasks: string;
  noBlockedTasks: string;
  upcomingTasks: string;
  noUpcomingTasks: string;
  tasksDone: string;
  noMilestones: string;
  noMilestonesDescription: string;
  statusLabels: Record<MilestoneStatus | TaskStatus, string>;
  priorityLabels: Record<TaskPriority, string>;
}

interface RoadmapSnapshotProps {
  projectId: string;
  locale: Locale;
  milestones: Milestone[];
  tasks: RoadmapTask[];
  progress: RoadmapProgress;
  translations: SnapshotTranslations;
}

// ── Constants ────────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<MilestoneStatus, { ring: string; fill: string }> = {
  completed: { ring: "ring-green-500", fill: "bg-green-500" },
  in_progress: { ring: "ring-brand-500", fill: "bg-brand-500 animate-pulse" },
  planned: { ring: "ring-gray-300 dark:ring-gray-600", fill: "bg-gray-300 dark:bg-gray-600" },
  blocked: { ring: "ring-red-500", fill: "bg-red-500" },
  deferred: { ring: "ring-amber-500", fill: "bg-amber-500" },
};

const STATUS_BADGE: Record<MilestoneStatus, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  in_progress: "bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400",
  planned: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  deferred: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATUS_ICON: Record<MilestoneStatus, React.ReactNode> = {
  completed: <CheckCircle2 className="h-3 w-3" />,
  in_progress: <Loader2 className="h-3 w-3 animate-spin" />,
  planned: <Circle className="h-3 w-3" />,
  blocked: <Ban className="h-3 w-3" />,
  deferred: <Pause className="h-3 w-3" />,
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

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  p1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  p2: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  p3: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const PRIORITY_ORDER: Record<TaskPriority, number> = { p1: 0, p2: 1, p3: 2 };

// ── Component ────────────────────────────────────────────────────────────────────

export function RoadmapSnapshot({
  projectId,
  milestones,
  tasks,
  progress,
  translations: t,
}: RoadmapSnapshotProps) {
  const currentMilestone = progress.currentMilestoneId
    ? milestones.find((m) => m.id === progress.currentMilestoneId) ?? null
    : null;
  const nextMilestone = progress.nextMilestoneId
    ? milestones.find((m) => m.id === progress.nextMilestoneId) ?? null
    : null;

  const currentProgress = currentMilestone
    ? progress.milestones[currentMilestone.id]
    : null;

  // 3 upcoming tasks: not done, sorted by priority then order_index
  const upcomingTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const priDiff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      if (priDiff !== 0) return priDiff;
      return a.order_index - b.order_index;
    })
    .slice(0, 3);

  // Empty state
  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Map className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-base font-semibold text-foreground">{t.title}</h2>
          </div>
          <Link
            href={`/projects/${projectId}/execution-map`}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            {t.viewFull} →
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Map className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">{t.noMilestones}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{t.noMilestonesDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Map className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-base font-semibold text-foreground">{t.title}</h2>
        </div>
        <Link
          href={`/projects/${projectId}/execution-map`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
        >
          {t.viewFull}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Top section: Overall progress + Current milestone */}
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        {/* Overall progress */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t.overallProgress}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{progress.overallPercent}%</p>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress.overallPercent === 100
                  ? "bg-green-500"
                  : progress.overallPercent > 0
                    ? "bg-brand-600 dark:bg-brand-500"
                    : "bg-gray-300 dark:bg-gray-600"
              }`}
              style={{ width: `${progress.overallPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t.tasksDone
              .replace("{done}", String(tasks.filter((t) => t.status === "done").length))
              .replace("{total}", String(tasks.length))}
          </p>
        </div>

        {/* Current milestone */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          {currentMilestone && currentProgress ? (
            <>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t.currentMilestone}</p>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_DOT[currentMilestone.status].fill}`} />
                <p className="text-sm font-semibold text-foreground truncate">{currentMilestone.title}</p>
                <span className={`shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[currentMilestone.status]}`}>
                  {STATUS_ICON[currentMilestone.status]}
                  {t.statusLabels[currentMilestone.status]}
                </span>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{currentProgress.progressPercent}%</span>
                  <span>{currentProgress.doneTasks}/{currentProgress.totalTasks} {t.tasksDone.split(" ")[0]?.toLowerCase()}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentProgress.progressPercent === 100
                        ? "bg-green-500"
                        : "bg-brand-600 dark:bg-brand-500"
                    }`}
                    style={{ width: `${currentProgress.progressPercent}%` }}
                  />
                </div>
              </div>
              {nextMilestone && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.nextMilestone}: <span className="font-medium text-foreground">{nextMilestone.title}</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noMilestones}</p>
          )}
        </div>
      </div>

      {/* Blocked count */}
      {progress.blockersCount > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-3 py-2 flex items-center gap-2">
          <Ban className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          <span className="text-xs font-medium text-red-800 dark:text-red-400">
            {t.blockedTasks.replace("{count}", String(progress.blockersCount))}
          </span>
        </div>
      )}

      {/* Upcoming tasks */}
      {upcomingTasks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">{t.upcomingTasks}</p>
          <div className="space-y-1.5">
            {upcomingTasks.map((task) => {
              const taskStyle = TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.not_started;
              const priorityBadge = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.p2;
              const milestone = task.milestone_id
                ? milestones.find((m) => m.id === task.milestone_id)
                : null;
              return (
                <div key={task.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                  <span className={taskStyle.color}>{taskStyle.icon}</span>
                  <span className="text-xs text-foreground truncate flex-1">{task.title}</span>
                  <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${priorityBadge}`}>
                    {task.priority.toUpperCase()}
                  </span>
                  {milestone && (
                    <span className="shrink-0 text-[10px] text-muted-foreground hidden sm:inline">
                      {milestone.title.split("—")[0]?.trim()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {upcomingTasks.length === 0 && (
        <div className="flex items-center justify-center py-3">
          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
          <p className="text-xs text-green-700 dark:text-green-400 font-medium">{t.noUpcomingTasks}</p>
        </div>
      )}
    </div>
  );
}