"use client";

import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LifecycleStepView } from "@/features/navigator/navigatorContent";

interface ProjectLifecycleMapProps {
  views: LifecycleStepView[];
  /** Toggles completion for a lifecycle step (localStorage-backed). */
  onToggleStep: (stepKey: string) => void;
  /** Label for the "mark as complete" affordance. */
  markCompleteLabel: string;
  markIncompleteLabel: string;
  completedLabel: string;
  currentLabel: string;
  upcomingLabel: string;
}

export function ProjectLifecycleMap({
  views,
  onToggleStep,
  markCompleteLabel,
  markIncompleteLabel,
  completedLabel,
  currentLabel,
  upcomingLabel,
}: ProjectLifecycleMapProps) {
  return (
    <ol className="relative space-y-1">
      {views.map(({ step, state }, index) => {
        const isLast = index === views.length - 1;
        const isCompleted = state === "completed";
        const isCurrent = state === "current";

        return (
          <li key={step.key} className="relative flex gap-3 pb-3">
            {/* Vertical connector */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px",
                  isCompleted ? "bg-brand-500/40" : "bg-border",
                )}
              />
            )}

            {/* Node */}
            <button
              type="button"
              onClick={() => onToggleStep(step.key)}
              aria-pressed={isCompleted}
              aria-label={
                isCompleted ? `${step.label} — ${markIncompleteLabel}` : `${step.label} — ${markCompleteLabel}`
              }
              title={isCompleted ? markIncompleteLabel : markCompleteLabel}
              className={cn(
                "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30",
                isCompleted && "border-brand-500 bg-brand-600 text-white",
                isCurrent && !isCompleted && "border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20",
                !isCompleted && !isCurrent && "border-border bg-card text-muted-foreground hover:border-brand-400",
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" strokeWidth={3} />
              ) : isCurrent ? (
                <span className="h-2 w-2 rounded-full bg-brand-600" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              )}
            </button>

            {/* Label + state */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    isCurrent && "text-brand-700",
                    isCompleted && "text-foreground",
                    !isCompleted && !isCurrent && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
                <StateBadge
                  state={state}
                  completedLabel={completedLabel}
                  currentLabel={currentLabel}
                  upcomingLabel={upcomingLabel}
                />
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.hint}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StateBadge({
  state,
  completedLabel,
  currentLabel,
  upcomingLabel,
}: {
  state: LifecycleStepView["state"];
  completedLabel: string;
  currentLabel: string;
  upcomingLabel: string;
}) {
  // Hide "upcoming" badge to keep the map scannable; lock glyph implies pending/future.
  if (state === "upcoming") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70"
        title={upcomingLabel}
      >
        <Lock className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
    );
  }
  const styles =
    state === "completed"
      ? "bg-brand-50 text-brand-700"
      : "border border-brand-200 bg-brand-50 text-brand-700";
  const label = state === "completed" ? completedLabel : currentLabel;
  return (
    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", styles)}>
      {label}
    </span>
  );
}