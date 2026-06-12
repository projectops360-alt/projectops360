"use client";

import {
  Ban, FileText, Send, Code, ShieldCheck, CheckCircle2, Circle, ArrowRight, Sparkles,
} from "lucide-react";
import type { Milestone } from "@/types/database";
import type { NextStepRecommendation, RecommendationAction } from "@/lib/roadmap/recommendation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface NextStepPanelTranslations {
  title: string;
  onTrack: string;
  viewTask: string;
  resolveBlocker: string;
  runPrompt: string;
  markCompleted: string;
}

interface NextStepPanelProps {
  recommendation: NextStepRecommendation;
  milestones: Milestone[];
  locale: string;
  translations: NextStepPanelTranslations;
  onTaskAction?: (taskId: string, action: RecommendationAction) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────────

const ACTION_STYLE: Record<RecommendationAction, { icon: React.ReactNode; accent: string; bg: string; border: string; text: string }> = {
  resolve_blocker: {
    icon: <Ban className="h-4 w-4" />,
    accent: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800/50",
    text: "text-red-800 dark:text-red-300",
  },
  run_prompt: {
    icon: <FileText className="h-4 w-4" />,
    accent: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/20",
    border: "border-purple-200 dark:border-purple-800/50",
    text: "text-purple-800 dark:text-purple-300",
  },
  implement_output: {
    icon: <Send className="h-4 w-4" />,
    accent: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/20",
    border: "border-indigo-200 dark:border-indigo-800/50",
    text: "text-indigo-800 dark:text-indigo-300",
  },
  test_implementation: {
    icon: <Code className="h-4 w-4" />,
    accent: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
    border: "border-cyan-200 dark:border-cyan-800/50",
    text: "text-cyan-800 dark:text-cyan-300",
  },
  mark_completed: {
    icon: <ShieldCheck className="h-4 w-4" />,
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800/50",
    text: "text-emerald-800 dark:text-emerald-300",
  },
  start_next: {
    icon: <Circle className="h-4 w-4" />,
    accent: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800/50",
    text: "text-blue-800 dark:text-blue-300",
  },
  on_track: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    accent: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800/50",
    text: "text-green-800 dark:text-green-300",
  },
};

// ── Component ────────────────────────────────────────────────────────────────────

export function NextStepPanel({
  recommendation,
  milestones,
  translations: t,
  onTaskAction,
}: NextStepPanelProps) {
  const { action, taskTitle, reason } = recommendation;
  const style = ACTION_STYLE[action];
  const milestoneName = recommendation.milestoneId
    ? milestones.find((m) => m.id === recommendation.milestoneId)?.title ?? ""
    : "";

  const isOnTrack = action === "on_track";

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-3 transition-colors`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 mt-0.5 ${style.accent}`}>
          {style.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-semibold uppercase tracking-wider ${style.accent}`}>
              {t.title}
            </span>
            {recommendation.priority === "p1" && action !== "on_track" && (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                P1
              </span>
            )}
          </div>

          {isOnTrack ? (
            <p className={`text-sm ${style.text}`}>
              {t.onTrack}
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {taskTitle}
              </p>
              {milestoneName && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {milestoneName}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {reason}
              </p>

              {/* Action button */}
              <div className="mt-2 flex items-center gap-2">
                {action === "run_prompt" && onTaskAction && (
                  <button
                    type="button"
                    onClick={() => onTaskAction(recommendation.taskId, "run_prompt")}
                    className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-purple-700 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    {t.runPrompt}
                  </button>
                )}
                {action === "mark_completed" && onTaskAction && (
                  <button
                    type="button"
                    onClick={() => onTaskAction(recommendation.taskId, "mark_completed")}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {t.markCompleted}
                  </button>
                )}
                {action === "resolve_blocker" && onTaskAction && (
                  <button
                    type="button"
                    onClick={() => onTaskAction(recommendation.taskId, "resolve_blocker")}
                    className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    <Ban className="h-3 w-3" />
                    {t.resolveBlocker}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    // Scroll to the task in the list
                    const el = document.getElementById(`task-${recommendation.taskId}`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("ring-2", "ring-brand-500", "ring-offset-2");
                      setTimeout(() => el.classList.remove("ring-2", "ring-brand-500", "ring-offset-2"), 3000);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {t.viewTask}
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}