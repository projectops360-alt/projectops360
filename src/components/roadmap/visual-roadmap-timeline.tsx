"use client";

import type { Milestone, MilestoneStatus, MilestoneStatusDisplay, RoadmapTask, TaskStatus, TaskPriority, Locale } from "@/types/database";
import type { RoadmapProgress } from "@/lib/roadmap/progress";
import {
  MILESTONE_STATUS_COLORS, TASK_STATUS_ICON_DEFS, TASK_STATUS_BADGE_CLASSES,
  PRIORITY_BADGE_CLASSES, getProgressBarClass,
} from "@/lib/roadmap/status-mappings";
import { renderMilestoneStatusIcon, renderMilestoneIcon, renderTaskStatusIcon } from "@/components/roadmap/status-icon-renderer";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskCount {
  total: number;
  done: number;
  inProgress: number;
}

interface TimelineTranslations {
  statusLabels: Record<MilestoneStatus | TaskStatus, string>;
  priorityLabels: Record<TaskPriority, string>;
  tasks: string;
  noTasks: string;
  sprint: string;
}

interface VisualRoadmapTimelineProps {
  milestones: Milestone[];
  progress: RoadmapProgress;
  tasksByMilestone: Record<string, RoadmapTask[]>;
  taskCounts: Record<string, TaskCount>;
  expandedMilestones: Set<string>;
  onToggleMilestone: (id: string) => void;
  locale: Locale;
  translations: TimelineTranslations;
}

// ── Status Config ────────────────────────────────────────────────────────────────
// Mappings are now centralized in @/lib/roadmap/status-mappings and
// @/components/roadmap/status-icon-renderer for consistency across all views.

function formatDate(date: string | null, locale: Locale): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────────

export function VisualRoadmapTimeline({
  milestones,
  progress,
  tasksByMilestone,
  taskCounts,
  expandedMilestones,
  onToggleMilestone,
  locale,
  translations: t,
}: VisualRoadmapTimelineProps) {
  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {milestones.map((milestone, idx) => {
          const isExpanded = expandedMilestones.has(milestone.id);
          const milestoneTasks = tasksByMilestone[milestone.id] ?? [];
          const counts = taskCounts[milestone.id] ?? { total: 0, done: 0, inProgress: 0 };
          const computedStatus: MilestoneStatusDisplay = progress.computedMilestoneStatuses[milestone.id] ?? milestone.status;
          const statusColors = MILESTONE_STATUS_COLORS[computedStatus] ?? MILESTONE_STATUS_COLORS.planned;
          const statusBadge = MILESTONE_STATUS_COLORS[computedStatus]?.badge ?? MILESTONE_STATUS_COLORS.planned.badge;
          const milestoneIcon = renderMilestoneIcon(milestone.icon_key);
          const startDate = formatDate(milestone.start_date, locale);
          const targetDate = formatDate(milestone.target_date, locale);
          const isLast = idx === milestones.length - 1;

          return (
            <div key={milestone.id} className="relative pl-14">
              {/* Timeline node */}
              <div className={`absolute left-5 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full border-2 ${statusColors.ring} bg-card z-10`}>
                <div className={`h-4 w-4 rounded-full ${statusColors.fill}`} />
              </div>

              {/* Connector to content */}
              <div className={`rounded-xl border transition-all ${
                computedStatus === "in_progress"
                  ? "border-brand-200 bg-brand-50/30 dark:border-brand-800 dark:bg-brand-950/10"
                  : computedStatus === "completed"
                    ? "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/10"
                    : "border-border bg-card"
              }`}>
                {/* Milestone header (clickable) */}
                <button
                  type="button"
                  onClick={() => onToggleMilestone(milestone.id)}
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon from icon_key */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${statusColors.iconBg} ${statusColors.textColor}`}>
                      {milestoneIcon}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title + status badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{milestone.title}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge}`}>
                          {renderMilestoneStatusIcon(computedStatus)}
                          {t.statusLabels[computedStatus as MilestoneStatus] ?? computedStatus}
                        </span>
                      </div>

                      {/* Description */}
                      {milestone.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {milestone.description}
                        </p>
                      )}

                      {/* Meta row: date + task count + progress */}
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        {(startDate || targetDate) && (
                          <span className="flex items-center gap-1">
                            <span>{startDate}{startDate && targetDate ? " → " : ""}{targetDate}</span>
                          </span>
                        )}
                        {counts.total > 0 && (
                          <span>{counts.done}/{counts.total} {t.tasks.toLowerCase()}</span>
                        )}
                        <span className="font-medium text-foreground tabular-nums">{progress.milestones[milestone.id]?.progressPercent ?? milestone.progress_percent}%</span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${statusColors.bar}`}
                          style={{ width: `${progress.milestones[milestone.id]?.progressPercent ?? milestone.progress_percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Expand/collapse chevron */}
                    <div className="shrink-0 pt-1">
                      {isExpanded ? (
                        <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                      ) : (
                        <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded task list */}
                {isExpanded && (
                  <div className="border-t border-border/50 bg-muted/20">
                    {milestoneTasks.length > 0 ? (
                      <ul className="divide-y divide-border/50">
                        {milestoneTasks.map((task) => {
                          const taskIcon = renderTaskStatusIcon(task.status);
                          const priorityBadge = PRIORITY_BADGE_CLASSES[task.priority] ?? PRIORITY_BADGE_CLASSES.p2;
                          return (
                            <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                              <span className="shrink-0">{taskIcon.icon}</span>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm leading-snug ${taskIcon.strike ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                  {task.title}
                                </p>
                                {task.sprint_name && (
                                  <span className="text-[10px] text-muted-foreground">{t.sprint.replace("{name}", task.sprint_name)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityBadge}`}>
                                  {task.priority.toUpperCase()}
                                </span>
                                {task.estimate_hours != null && (
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{task.estimate_hours}h</span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="px-4 py-3 text-xs italic text-muted-foreground">{t.noTasks}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}