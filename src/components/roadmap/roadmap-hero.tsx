"use client";

import type { Milestone, MilestoneStatus, RoadmapTask, Locale } from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import { CheckCircle2, Loader2, Circle, Ban, Pause, Flag, ArrowRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskCount {
  total: number;
  done: number;
  inProgress: number;
}

interface HeroTranslations {
  currentPhase: string;
  currentMilestone: string;
  nextMilestone: string;
  overallProgress: string;
  blockers: string;
  noBlockers: string;
  milestones: string;
  tasks: string;
  completed: string;
  inProgress: string;
  planned: string;
  blocked: string;
  noNext: string;
}

interface RoadmapHeroProps {
  milestones: Milestone[];
  tasks: RoadmapTask[];
  taskCounts: Record<string, TaskCount>;
  progress: RoadmapProgress;
  locale: Locale;
  translations: HeroTranslations;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function getMilestoneStatusConfig(status: MilestoneStatus) {
  const configs: Record<MilestoneStatus, { color: string; bg: string; borderColor: string; iconBg: string }> = {
    completed: {
      color: "text-green-700 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/30",
      borderColor: "border-green-200 dark:border-green-800",
      iconBg: "bg-green-100 dark:bg-green-900/50",
    },
    in_progress: {
      color: "text-brand-700 dark:text-brand-400",
      bg: "bg-brand-50 dark:bg-brand-950/20",
      borderColor: "border-brand-200 dark:border-brand-800",
      iconBg: "bg-brand-100 dark:bg-brand-900/50",
    },
    planned: {
      color: "text-gray-700 dark:text-gray-300",
      bg: "bg-gray-50 dark:bg-gray-900/30",
      borderColor: "border-gray-200 dark:border-gray-700",
      iconBg: "bg-gray-100 dark:bg-gray-800",
    },
    blocked: {
      color: "text-red-700 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/30",
      borderColor: "border-red-200 dark:border-red-800",
      iconBg: "bg-red-100 dark:bg-red-900/50",
    },
    deferred: {
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      borderColor: "border-amber-200 dark:border-amber-800",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
    },
  };
  return configs[status] ?? configs.planned;
}

function getMilestoneIcon(status: MilestoneStatus) {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-5 w-5" />;
    case "in_progress": return <Loader2 className="h-5 w-5 animate-spin" />;
    case "blocked": return <Ban className="h-5 w-5" />;
    case "deferred": return <Pause className="h-5 w-5" />;
    default: return <Circle className="h-5 w-5" />;
  }
}

// ── Component ────────────────────────────────────────────────────────────────────

export function RoadmapHero({
  milestones,
  tasks,
  taskCounts,
  progress,
  locale,
  translations: t,
}: RoadmapHeroProps) {
  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const inProgressCount = milestones.filter((m) => m.status === "in_progress").length;
  const plannedCount = milestones.filter((m) => m.status === "planned").length;

  // Current milestone — from computed progress
  const currentMilestone = progress.currentMilestoneId
    ? milestones.find((m) => m.id === progress.currentMilestoneId) ?? null
    : null;
  // Next milestone — from computed progress
  const nextMilestone = progress.nextMilestoneId
    ? milestones.find((m) => m.id === progress.nextMilestoneId) ?? null
    : null;

  // Current phase name (from milestone title, extract text before "—")
  const currentPhase = currentMilestone?.title.split("—")[0]?.trim() ?? "—";
  const currentTitle = currentMilestone?.title ?? "—";

  // Current milestone's computed progress
  const currentProgress = currentMilestone
    ? progress.milestones[currentMilestone.id]
    : null;

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-brand-50/50 to-white dark:from-brand-950/20 dark:to-card p-6">
      {/* Top row: Phase + Progress */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: Current focus */}
        <div className="space-y-4">
          {/* Current phase label */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
              <Flag className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
                {t.currentPhase}
              </p>
              <p className="text-sm font-semibold text-foreground">{currentPhase}</p>
            </div>
          </div>

          {/* Current milestone */}
          {currentMilestone && currentProgress && (
            <div className="ml-10 rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getMilestoneStatusConfig(currentMilestone.status).bg} ${getMilestoneStatusConfig(currentMilestone.status).color}`}>
                  {getMilestoneIcon(currentMilestone.status)}
                  {t[currentMilestone.status === "in_progress" ? "inProgress" : currentMilestone.status === "completed" ? "completed" : currentMilestone.status === "blocked" ? "blocked" : "planned"]}
                </span>
                <p className="text-sm font-medium text-foreground">{currentTitle}</p>
              </div>
              {currentProgress.progressPercent > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{currentProgress.progressPercent}%</span>
                    <span>
                      {currentProgress.doneTasks}/{currentProgress.totalTasks} {t.tasks.toLowerCase()}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-600 dark:bg-brand-500 transition-all duration-500"
                      style={{ width: `${currentProgress.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Next milestone */}
          {nextMilestone && (
            <div className="ml-10 flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4 shrink-0" />
              <span className="font-medium">{t.nextMilestone}:</span>
              <span className="truncate">{nextMilestone.title}</span>
            </div>
          )}
        </div>

        {/* Right: Stats grid */}
        <div className="grid grid-cols-2 gap-3 lg:w-64 shrink-0">
          {/* Overall progress — computed from tasks */}
          <div className="col-span-2 rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-foreground tabular-nums">{progress.overallPercent}%</p>
            <p className="text-xs text-muted-foreground mt-1">{t.overallProgress}</p>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-600 dark:bg-brand-500 transition-all duration-500"
                style={{ width: `${progress.overallPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">{completedCount}</p>
            <p className="text-[10px] text-muted-foreground">{t.completed}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-brand-600 dark:text-brand-400 tabular-nums">{inProgressCount}</p>
            <p className="text-[10px] text-muted-foreground">{t.inProgress}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold text-gray-500 dark:text-gray-400 tabular-nums">{plannedCount}</p>
            <p className="text-[10px] text-muted-foreground">{t.planned}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-lg font-bold tabular-nums">{progress.blockersCount > 0 ? (
              <span className="text-red-600 dark:text-red-400">{progress.blockersCount}</span>
            ) : (
              <span className="text-gray-400">0</span>
            )}</p>
            <p className="text-[10px] text-muted-foreground">{progress.blockersCount > 0 ? t.blockers : t.noBlockers}</p>
          </div>
        </div>
      </div>
    </div>
  );
}