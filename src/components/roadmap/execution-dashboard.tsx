"use client";

import type { RoadmapTask, TaskStatus, Locale } from "@/types/database";
import type { NextStepRecommendation } from "@/lib/roadmap/recommendation";
import {
  Ban, FileText, Send, Code, ShieldCheck, CheckCircle2,
  Circle, Pause, Loader2, AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExecutionDashboardTranslations {
  title: string;
  promptReady: string;
  sentToAi: string;
  implemented: string;
  tested: string;
  blocked: string;
  completed: string;
  notStarted: string;
  inProgress: string;
  deferred: string;
  currentSprint: string;
  noSprint: string;
  recentChanges: string;
  noRecentChanges: string;
}

interface ExecutionDashboardProps {
  tasks: RoadmapTask[];
  nextStep: NextStepRecommendation | null;
  locale: Locale;
  translations: ExecutionDashboardTranslations;
  onStatusFilter?: (status: TaskStatus) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; bg: string; text: string; border: string }> = {
  prompt_ready: {
    icon: <FileText className="h-4 w-4" />,
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800/50",
  },
  sent_to_ai: {
    icon: <Send className="h-4 w-4" />,
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800/50",
  },
  implemented: {
    icon: <Code className="h-4 w-4" />,
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-700 dark:text-cyan-400",
    border: "border-cyan-200 dark:border-cyan-800/50",
  },
  tested: {
    icon: <ShieldCheck className="h-4 w-4" />,
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/50",
  },
  blocked: {
    icon: <Ban className="h-4 w-4" />,
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800/50",
  },
  done: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-800/50",
  },
  in_progress: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/50",
  },
  not_started: {
    icon: <Circle className="h-4 w-4" />,
    bg: "bg-gray-50 dark:bg-gray-900/30",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700/50",
  },
  deferred: {
    icon: <Pause className="h-4 w-4" />,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/50",
  },
};

// ── Component ────────────────────────────────────────────────────────────────────

export function ExecutionDashboard({
  tasks,
  nextStep,
  locale,
  translations: t,
  onStatusFilter,
}: ExecutionDashboardProps) {
  // Compute status counts
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }

  // Find current sprint
  const sprintNames = [...new Set(tasks.map((t) => t.sprint_name).filter(Boolean))];
  const currentSprint = sprintNames.length > 0 ? sprintNames[0] : null;

  // Dashboard cards order
  const dashboardCards: { status: string; count: number; label: string; config: typeof STATUS_CONFIG[string] }[] = [
    { status: "blocked", count: counts["blocked"] ?? 0, label: t.blocked, config: STATUS_CONFIG.blocked },
    { status: "prompt_ready", count: counts["prompt_ready"] ?? 0, label: t.promptReady, config: STATUS_CONFIG.prompt_ready },
    { status: "sent_to_ai", count: counts["sent_to_ai"] ?? 0, label: t.sentToAi, config: STATUS_CONFIG.sent_to_ai },
    { status: "in_progress", count: counts["in_progress"] ?? 0, label: t.inProgress, config: STATUS_CONFIG.in_progress },
    { status: "implemented", count: counts["implemented"] ?? 0, label: t.implemented, config: STATUS_CONFIG.implemented },
    { status: "tested", count: counts["tested"] ?? 0, label: t.tested, config: STATUS_CONFIG.tested },
    { status: "done", count: counts["done"] ?? 0, label: t.completed, config: STATUS_CONFIG.done },
  ];

  return (
    <div className="space-y-3">
      {/* Sprint indicator */}
      {currentSprint && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 dark:bg-brand-950/30 px-2 py-0.5 text-brand-700 dark:text-brand-400 font-medium">
            {t.currentSprint}: {currentSprint}
          </span>
          {sprintNames.length > 1 && (
            <span>+{sprintNames.length - 1} {locale === "es" ? "más" : "more"}</span>
          )}
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {dashboardCards.map(({ status, count, label, config }) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatusFilter?.(status as TaskStatus)}
            className={`rounded-lg border ${config.border} ${config.bg} p-2.5 text-center transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div className={`flex items-center justify-center mb-1 ${config.text}`}>
              {config.icon}
            </div>
            <div className={`text-lg font-bold tabular-nums ${config.text}`}>
              {count}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium truncate">
              {label}
            </div>
          </button>
        ))}
      </div>

      {/* Blocked alert */}
      {(counts["blocked"] ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-400">
            {counts["blocked"]} {counts["blocked"] === 1
              ? (locale === "es" ? "tarea bloqueada" : "blocked task")
              : (locale === "es" ? "tareas bloqueadas" : "blocked tasks")
            }
          </p>
          {onStatusFilter && (
            <button
              type="button"
              onClick={() => onStatusFilter("blocked")}
              className="ml-auto text-[10px] font-semibold text-red-700 dark:text-red-400 underline underline-offset-2 hover:text-red-800 dark:hover:text-red-300"
            >
              {locale === "es" ? "Ver bloqueadas" : "View blocked"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}