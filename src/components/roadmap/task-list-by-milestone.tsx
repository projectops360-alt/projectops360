"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Milestone, MilestoneStatus, RoadmapTask, TaskStatus, TaskPriority, TaskDependency, Locale } from "@/types/database";
import {
  CheckCircle2, Loader2, Circle, Ban, Pause,
  FileText, Send, Code, ShieldCheck,
  ListTodo, Filter, ChevronDown, Sparkles, Copy, Check, AlertTriangle, AlertCircle, History,
  MoreVertical, Pencil, Archive, Trash2, Link2, Plus, ArrowUp, ArrowDown,
} from "lucide-react";

/** Virtual milestone id used to group tasks that have no milestone (e.g. created by AI). */
const UNASSIGNED_MILESTONE = "__unassigned__";
import { createDependencyAction } from "@/app/[locale]/(app)/projects/[projectId]/execution-map/dependency-actions";
import { updateTaskStatusAction } from "@/app/[locale]/(app)/projects/[projectId]/roadmap/actions";
import { recordPromptSentAction } from "@/app/[locale]/(app)/projects/[projectId]/roadmap/actions";
import { getTaskAuditTrailAction, type AuditTrailEntry } from "@/app/[locale]/(app)/projects/[projectId]/roadmap/actions";
import { checkDependencies } from "@/lib/roadmap/dependencies";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskCount {
  total: number;
  done: number;
  inProgress: number;
}

interface TaskListTranslations {
  title: string;
  filterByStatus: string;
  allStatuses: string;
  selectMilestone: string;
  noTasksForMilestone: string;
  progressCount: string;
  remaining: string;
  dependencyNotes: string;
  executionNotes: string;
  blockerReason: string;
  acceptanceCriteria: string;
  updateStatus: string;
  statusUpdated: string;
  statusUpdateFailed: string;
  estimate: string;
  actual: string;
  noEstimate: string;
  unassigned: string;
  statusLabels: Record<MilestoneStatus | TaskStatus, string>;
  priorityLabels: Record<TaskPriority, string>;
  sprint: string;
  hours: string;
  copyPrompt: string;
  copiedPrompt: string;
  markAsSentToAi: string;
  promptWarning: string;
  promptLabel: string;
  promptContextLabel: string;
  aiToolLabel: string;
  lastSentLabel: string;
  implementationNotesLabel: string;
  testNotesLabel: string;
  dependencyWarning: string;
  dependencyComplete: string;
  dependencyIncomplete: string;
  auditTrail: string;
  auditTrailEmpty: string;
  statusChanged: string;
  promptCopied: string;
  promptSent: string;
  taskBlocked: string;
  taskCompleted: string;
  taskUnblocked: string;
  editTask: string;
  archiveTask: string;
  confirmArchiveTask: string;
  editMilestone: string;
  archiveMilestone: string;
  confirmArchiveMilestone: string;
  addPredecessor: string;
  addPredecessorPlaceholder: string;
  predecessorAdded: string;
  predecessorExists: string;
  cancel: string;
  noMatchingTasks: string;
  circularDependencyError: string;
  dependencyAddError: string;
  // Optional (newer keys) — components fall back to English defaults
  dependsOn?: string;
  showPrompt?: string;
  hidePrompt?: string;
}

interface TaskListByMilestoneProps {
  projectId: string;
  milestones: Milestone[];
  tasks: RoadmapTask[];
  taskCounts: Record<string, TaskCount>;
  /** Real task dependencies (task_dependencies table) — shown as predecessors on each task */
  dependencies?: TaskDependency[];
  locale: Locale;
  translations: TaskListTranslations;
  initialStatusFilter?: TaskStatus | null;
  onEditTask?: (task: RoadmapTask) => void;
  onArchiveTask?: (taskId: string) => Promise<void>;
  onEditMilestone?: (milestone: Milestone) => void;
  onArchiveMilestone?: (milestoneId: string) => Promise<void>;
  /** Create a task already linked to this milestone. */
  onAddTask?: (milestoneId: string) => void;
  /** Reorder a milestone up/down in the project sequence. */
  onMoveMilestone?: (milestoneId: string, direction: "up" | "down") => Promise<void>;
}

// ── Constants ────────────────────────────────────────────────────────────────────

const TASK_STATUS_FILTER_OPTIONS: TaskStatus[] = [
  "not_started",
  "prompt_ready",
  "sent_to_ai",
  "in_progress",
  "implemented",
  "tested",
  "done",
  "blocked",
  "deferred",
];

const TASK_STATUS_ICON: Record<TaskStatus, { icon: React.ReactNode; color: string }> = {
  done: { icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600 dark:text-green-400" },
  tested: { icon: <ShieldCheck className="h-4 w-4" />, color: "text-emerald-600 dark:text-emerald-400" },
  implemented: { icon: <Code className="h-4 w-4" />, color: "text-cyan-600 dark:text-cyan-400" },
  in_progress: { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: "text-blue-600 dark:text-blue-400" },
  sent_to_ai: { icon: <Send className="h-4 w-4" />, color: "text-indigo-600 dark:text-indigo-400" },
  prompt_ready: { icon: <FileText className="h-4 w-4" />, color: "text-purple-600 dark:text-purple-400" },
  not_started: { icon: <Circle className="h-4 w-4" />, color: "text-gray-400" },
  blocked: { icon: <Ban className="h-4 w-4" />, color: "text-red-600 dark:text-red-400" },
  deferred: { icon: <Pause className="h-4 w-4" />, color: "text-amber-600 dark:text-amber-400" },
};

const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  tested: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  implemented: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sent_to_ai: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  prompt_ready: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  not_started: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  deferred: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  p1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  p2: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  p3: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const MILESTONE_STATUS_DOT: Record<MilestoneStatus, string> = {
  completed: "bg-green-500",
  in_progress: "bg-brand-500 animate-pulse",
  planned: "bg-gray-400 dark:bg-gray-600",
  blocked: "bg-red-500",
  deferred: "bg-amber-500",
};

// ── Milestone Selector ──────────────────────────────────────────────────────────

function MilestoneSelector({
  milestones,
  selectedId,
  onSelect,
  taskCounts,
  locale,
  t,
  onEditMilestone,
  onArchiveMilestone,
  onAddTask,
  onMoveMilestone,
  unassignedCount,
}: {
  milestones: Milestone[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  taskCounts: Record<string, TaskCount>;
  locale: Locale;
  t: TaskListTranslations;
  onEditMilestone?: (milestone: Milestone) => void;
  onArchiveMilestone?: (milestoneId: string) => Promise<void>;
  onAddTask?: (milestoneId: string) => void;
  onMoveMilestone?: (milestoneId: string, direction: "up" | "down") => Promise<void>;
  unassignedCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [moving, setMoving] = useState(false);
  const selected = milestones.find((m) => m.id === selectedId);
  const selectedIndex = milestones.findIndex((m) => m.id === selectedId);

  return (
    <div className="flex items-center">
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto"
      >
        {selected ? (
          <>
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${MILESTONE_STATUS_DOT[selected.status]}`} />
            <span className="font-medium text-foreground truncate">{selected.title}</span>
            {taskCounts[selected.id] && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {taskCounts[selected.id].done}/{taskCounts[selected.id].total}
              </span>
            )}
          </>
        ) : selectedId === UNASSIGNED_MILESTONE ? (
          <>
            <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-amber-400" />
            <span className="font-medium text-foreground truncate">
              {locale === "es" ? "Sin milestone" : "No milestone"}
            </span>
            {typeof unassignedCount === "number" && unassignedCount > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0">{unassignedCount}</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">{t.selectMilestone}</span>
        )}
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full sm:w-80 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {milestones.map((m) => {
            const counts = taskCounts[m.id] ?? { total: 0, done: 0 };
            const isSelected = m.id === selectedId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelect(isSelected ? null : m.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                  isSelected ? "bg-muted/30" : ""
                }`}
              >
                <div className={`h-2 w-2 rounded-full shrink-0 ${MILESTONE_STATUS_DOT[m.status]}`} />
                <span className="flex-1 truncate text-foreground">{m.title}</span>
                {counts.total > 0 && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {counts.done}/{counts.total}
                  </span>
                )}
              </button>
            );
          })}
          {typeof unassignedCount === "number" && unassignedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onSelect(selectedId === UNASSIGNED_MILESTONE ? null : UNASSIGNED_MILESTONE);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-t border-border ${
                selectedId === UNASSIGNED_MILESTONE ? "bg-muted/30" : ""
              }`}
            >
              <div className="h-2 w-2 rounded-full shrink-0 bg-amber-400" />
              <span className="flex-1 truncate text-foreground">
                {locale === "es" ? "Sin milestone (creadas por IA)" : "No milestone (AI-created)"}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">{unassignedCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Milestone actions menu */}
      {selected && (onEditMilestone || onArchiveMilestone || onMoveMilestone) && (
        <div className="relative ml-2">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Milestone actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-30 w-48 rounded-lg border border-border bg-card shadow-lg">
                {onMoveMilestone && (
                  <>
                    <button
                      type="button"
                      disabled={moving || selectedIndex <= 0}
                      onClick={async () => {
                        setMoving(true);
                        await onMoveMilestone(selected.id, "up");
                        setMoving(false);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                      {locale === "es" ? "Mover arriba" : "Move up"}
                    </button>
                    <button
                      type="button"
                      disabled={moving || selectedIndex < 0 || selectedIndex >= milestones.length - 1}
                      onClick={async () => {
                        setMoving(true);
                        await onMoveMilestone(selected.id, "down");
                        setMoving(false);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                      {locale === "es" ? "Mover abajo" : "Move down"}
                    </button>
                  </>
                )}
                {onEditMilestone && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEditMilestone(selected); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t.editMilestone}
                </button>
              )}
              {onArchiveMilestone && (
                <button
                  type="button"
                  disabled={archiving}
                  onClick={async () => {
                    if (!confirm(t.confirmArchiveMilestone)) return;
                    setArchiving(true);
                    setMenuOpen(false);
                    await onArchiveMilestone(selected.id);
                    setArchiving(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {t.archiveMilestone}
                </button>
              )}
            </div>
            </>
          )}
        </div>
      )}
    </div>
      {selected && onAddTask && (
        <button
          type="button"
          onClick={() => onAddTask(selected.id)}
          className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-600 px-2.5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus className="h-3.5 w-3.5" />
          {locale === "es" ? "Tarea" : "Task"}
        </button>
      )}
    </div>
  );
}

// ── Status Filter ────────────────────────────────────────────────────────────────

/** Quick-filter statuses that are most actionable in AI-assisted execution. */
const QUICK_FILTER_STATUSES: TaskStatus[] = ["prompt_ready", "blocked"];

function StatusFilter({
  selected,
  onSelect,
  statusCounts,
  t,
}: {
  selected: TaskStatus | null;
  onSelect: (status: TaskStatus | null) => void;
  statusCounts: Record<string, number>;
  t: TaskListTranslations;
}) {
  const totalCount = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);

  return (
    <div className="space-y-2">
      {/* Quick filters: Prompt Ready + Blocked */}
      <div className="flex items-center gap-2">
        {QUICK_FILTER_STATUSES.map((qs) => {
          const count = statusCounts[qs] ?? 0;
          const icon = TASK_STATUS_ICON[qs];
          const isActive = selected === qs;
          const isBlocked = qs === "blocked";
          const isPromptReady = qs === "prompt_ready";
          return (
            <button
              key={qs}
              type="button"
              onClick={() => onSelect(isActive ? null : qs)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? isBlocked
                    ? "bg-red-600 text-white shadow-sm shadow-red-200 dark:shadow-red-900/30"
                    : isPromptReady
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-200 dark:shadow-purple-900/30"
                      : "bg-foreground text-background"
                  : isBlocked
                    ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800/50"
                    : isPromptReady
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-950/50 border border-purple-200 dark:border-purple-800/50"
                      : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={isActive ? "text-white" : icon.color}>{icon.icon}</span>
              {t.statusLabels[qs]}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  isActive ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Full status filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
            selected === null
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.allStatuses}({totalCount})
        </button>
        {TASK_STATUS_FILTER_OPTIONS.map((status) => {
          const statusIcon = TASK_STATUS_ICON[status];
          const statusBadge = TASK_STATUS_BADGE[status];
          const count = statusCounts[status] ?? 0;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onSelect(selected === status ? null : status)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                selected === status ? statusBadge : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={selected === status ? "" : statusIcon.color}>{statusIcon.icon}</span>
              {t.statusLabels[status]}
              {count > 0 && (
                <span className={`rounded-full px-1 py-0 text-[9px] font-bold tabular-nums ${
                  selected === status ? "opacity-80" : "text-muted-foreground/70"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Progress Bar ────────────────────────────────────────────────────────────────

function ProgressSummary({
  counts,
  t,
}: {
  counts: TaskCount;
  t: TaskListTranslations;
}) {
  const remaining = counts.total - counts.done;
  const percent = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-foreground tabular-nums">{percent}%</span>
        <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              percent === 100 ? "bg-green-500" : percent > 0 ? "bg-brand-600 dark:bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <span>{t.progressCount.replace("{done}", String(counts.done)).replace("{total}", String(counts.total))}</span>
      {remaining > 0 && (
        <span className="text-muted-foreground/70">
          · {remaining} {t.remaining.toLowerCase()}
        </span>
      )}
    </div>
  );
}

// ── Task Row ──────────────────────────────────────────────────────────────────────

function TaskStatusDropdown({
  currentStatus,
  isPending,
  onStatusChange,
  t,
}: {
  currentStatus: TaskStatus;
  isPending: boolean;
  onStatusChange: (status: TaskStatus) => void;
  t: TaskListTranslations;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const statusIcon = TASK_STATUS_ICON[currentStatus] ?? TASK_STATUS_ICON.not_started;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !isPending && setOpen(!open)}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted ${
          isPending ? "opacity-50 pointer-events-none" : "cursor-pointer"
        }`}
        title={t.updateStatus}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
          <span className={statusIcon.color}>{statusIcon.icon}</span>
        )}
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-8 w-40 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1">
          {TASK_STATUS_FILTER_OPTIONS.map((s) => {
            const sIcon = TASK_STATUS_ICON[s];
            const isActive = s === currentStatus;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onStatusChange(s);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted/50 ${
                  isActive ? "bg-muted/30 font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className={sIcon.color}>{sIcon.icon}</span>
                <span>{t.statusLabels[s]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromptCopyButton({
  task,
  projectId,
  onStatusUpdated,
  t,
}: {
  task: RoadmapTask;
  projectId: string;
  onStatusUpdated: (taskId: string, newStatus: TaskStatus) => void;
  t: TaskListTranslations;
}) {
  const [copied, setCopied] = useState(false);
  const [sending, startTransition] = useTransition();

  const handleCopy = useCallback(() => {
    if (!task.prompt_body) return;
    navigator.clipboard.writeText(task.prompt_body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [task.prompt_body]);

  const handleCopyAndMark = useCallback(() => {
    if (!task.prompt_body) return;
    navigator.clipboard.writeText(task.prompt_body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      startTransition(async () => {
        const result = await recordPromptSentAction({
          taskId: task.id,
          projectId,
          setStatusToSentToAi: task.status === "prompt_ready",
        });
        if (!result.error) {
          onStatusUpdated(task.id, task.status === "prompt_ready" ? "sent_to_ai" : task.status);
        }
      });
    });
  }, [task.prompt_body, task.id, task.status, projectId, onStatusUpdated]);

  const isPromptReady = task.status === "prompt_ready";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
        title={t.copyPrompt}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? t.copiedPrompt : t.copyPrompt}
      </button>
      {isPromptReady && (
        <button
          type="button"
          onClick={handleCopyAndMark}
          disabled={sending}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={t.markAsSentToAi}
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {t.markAsSentToAi}
        </button>
      )}
    </div>
  );
}

// ── Audit Trail Section ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {};
// Populated dynamically from translations in the component

function AuditTrailSection({
  taskId,
  projectId,
  locale,
  t,
}: {
  taskId: string;
  projectId: string;
  locale: Locale;
  t: TaskListTranslations;
}) {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Map action to translation key
  const actionLabel = (action: string): string => {
    const map: Record<string, string> = {
      task_status_changed: t.statusChanged,
      task_blocked: t.taskBlocked,
      task_completed: t.taskCompleted,
      task_unblocked: t.taskUnblocked,
      prompt_copied: t.promptCopied,
      prompt_sent_to_ai: t.promptSent,
      update: t.statusChanged,
    };
    return map[action] ?? action;
  };

  const handleToggle = useCallback(() => {
    if (!isOpen && entries.length === 0) {
      setLoading(true);
      getTaskAuditTrailAction({ taskId, projectId, limit: 5 }).then((result) => {
        if (result.data) setEntries(result.data);
        setLoading(false);
      });
    }
    setIsOpen(!isOpen);
  }, [isOpen, entries.length, taskId, projectId]);

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <History className="h-3 w-3" />
        {t.auditTrail}
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>
      {isOpen && entries.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {entries.map((entry) => {
            const meta = entry.metadata as Record<string, string>;
            return (
              <div key={entry.id} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span className="shrink-0 text-muted-foreground/50">{formatDate(entry.created_at)}</span>
                <span className="font-medium text-muted-foreground/80">{actionLabel(entry.action)}</span>
                {meta.previousStatus && meta.newStatus && (
                  <span className="text-muted-foreground/60">
                    {meta.previousStatus} → {meta.newStatus}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isOpen && entries.length === 0 && !loading && (
        <p className="mt-0.5 text-[10px] text-muted-foreground/50">{t.auditTrailEmpty}</p>
      )}
    </div>
  );
}

// Statuses that mean a task has been started (or finished) — for predecessor met/unmet display
const STARTED_TASK_STATUSES: Set<TaskStatus> = new Set([
  "sent_to_ai", "in_progress", "implemented", "tested", "done",
]);

function TaskRow({
  task,
  allTasks,
  dependencies,
  projectId,
  locale,
  t,
  onStatusUpdated,
  onEditTask,
  onArchiveTask,
}: {
  task: RoadmapTask;
  allTasks: RoadmapTask[];
  dependencies: TaskDependency[];
  projectId: string;
  locale: Locale;
  t: TaskListTranslations;
  onStatusUpdated: (taskId: string, newStatus: TaskStatus) => void;
  onEditTask?: (task: RoadmapTask) => void;
  onArchiveTask?: (taskId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showPredSelector, setShowPredSelector] = useState(false);
  const [addingPred, setAddingPred] = useState(false);
  const [predSearch, setPredSearch] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const statusBadge = TASK_STATUS_BADGE[task.status] ?? TASK_STATUS_BADGE.not_started;
  const priorityBadge = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.p2;
  const isDone = task.status === "done";
  const isBlocked = task.status === "blocked";
  const isPromptReady = task.status === "prompt_ready";

  // Visual emphasis: blocked tasks get a red left border + tinted bg, prompt_ready gets purple
  const rowBorderClass = isBlocked
    ? "border-l-4 border-l-red-500 dark:border-l-red-400 bg-red-50/30 dark:bg-red-950/10"
    : isPromptReady
      ? "border-l-4 border-l-purple-500 dark:border-l-purple-400 bg-purple-50/20 dark:bg-purple-950/10"
      : "";

  // Dependency check (text references parsed from dependency_notes)
  const depCheck = checkDependencies(task, allTasks);

  // Real predecessors from task_dependencies (ordering types only)
  const realPredecessors = dependencies
    .filter((d) =>
      d.successor_id === task.id &&
      (d.dependency_type === "finish_to_start" || d.dependency_type === "start_to_start"),
    )
    .map((d) => {
      const pred = allTasks.find((p) => p.id === d.predecessor_id);
      if (!pred) return null;
      const met = d.dependency_type === "finish_to_start"
        ? pred.status === "done"
        : STARTED_TASK_STATUSES.has(pred.status);
      return { pred, met };
    })
    .filter((p): p is { pred: RoadmapTask; met: boolean } => p !== null);

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (newStatus === task.status) return;
    startTransition(async () => {
      const result = await updateTaskStatusAction({
        taskId: task.id,
        status: newStatus,
        projectId,
      });
      if (result.error) {
        console.error("Status update failed:", result.error);
      } else {
        onStatusUpdated(task.id, newStatus);
      }
    });
  };

  return (
    <div id={`task-${task.id}`} className={`rounded-lg border border-border shadow-sm transition-shadow hover:shadow-md ${isDone ? "opacity-75" : ""} ${rowBorderClass}`}>
      <div className="flex items-start gap-3 p-3">
        {/* Status dropdown */}
        <div className="shrink-0 pt-0.5">
          <TaskStatusDropdown
            currentStatus={task.status}
            isPending={isPending}
            onStatusChange={handleStatusChange}
            t={t}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title + badges */}
          <div className="flex items-start gap-2">
            <p className={`text-sm font-medium leading-snug flex-1 ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {task.title}
            </p>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityBadge}`}>
              {task.priority.toUpperCase()}
            </span>
            <span className={`shrink-0 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge}`}>
              {t.statusLabels[task.status]}
            </span>
            {/* Task actions menu */}
            {(onEditTask || onArchiveTask) && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setTaskMenuOpen(!taskMenuOpen)}
                  className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Task actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {taskMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setTaskMenuOpen(false)} />
                    <div className="absolute right-0 top-6 z-30 w-44 rounded-lg border border-border bg-card shadow-lg">
                    {onEditTask && (
                      <button
                        type="button"
                        onClick={() => { setTaskMenuOpen(false); onEditTask(task); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t.editTask}
                      </button>
                    )}
                    {/* Add predecessor */}
                    <button
                      type="button"
                      onClick={() => {
                        setTaskMenuOpen(false);
                        setShowPredSelector(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {t.addPredecessor}
                    </button>
                    {onArchiveTask && (
                      <button
                        type="button"
                        disabled={archiving}
                        onClick={async () => {
                          if (!confirm(t.confirmArchiveTask)) return;
                          setArchiving(true);
                          setTaskMenuOpen(false);
                          await onArchiveTask(task.id);
                          setArchiving(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        {t.archiveTask}
                      </button>
                    )}
                  </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Meta: sprint, estimate, actual, prompt indicator */}
          <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
            {task.sprint_name && (
              <span>{t.sprint.replace("{name}", task.sprint_name)}</span>
            )}
            {task.estimate_hours != null && (
              <span>{t.estimate}: {t.hours.replace("{hours}", String(task.estimate_hours))}</span>
            )}
            {task.actual_hours != null && (
              <span>{t.actual}: {t.hours.replace("{hours}", String(task.actual_hours))}</span>
            )}
            {task.prompt_body && (
              <span className="inline-flex items-center gap-0.5 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-3 w-3" />
                Prompt
              </span>
            )}
            {depCheck.hasWarning && (
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="h-3 w-3" />
                {depCheck.warningCount === 1 ? t.dependencyWarning : `${depCheck.warningCount} ${t.dependencyWarning}`}
              </span>
            )}
          </div>

          {/* Predecessors (real dependencies from task_dependencies) */}
          {realPredecessors.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {realPredecessors.map(({ pred, met }) => {
                const predIcon = TASK_STATUS_ICON[pred.status] ?? TASK_STATUS_ICON.not_started;
                return (
                  <div key={pred.id} className="flex items-center gap-1.5 text-[11px]">
                    <Link2 className={`h-3 w-3 shrink-0 ${met ? "text-muted-foreground/50" : "text-amber-600 dark:text-amber-400"}`} />
                    <span className="text-muted-foreground/70">{t.dependsOn ?? "Depends on"}:</span>
                    <span className={predIcon.color}>{predIcon.icon}</span>
                    <span className={`truncate max-w-[220px] ${met ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                      {pred.title}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0 text-[9px] font-medium ${met ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                      {met ? t.dependencyComplete : t.dependencyIncomplete}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div className="mt-1.5">
              <p className="text-xs text-muted-foreground leading-snug">
                {task.description}
              </p>
            </div>
          )}

          {/* Dependency notes */}
          {task.dependency_notes && (
            <div className="mt-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                {t.dependencyNotes}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {task.dependency_notes}
              </p>
            </div>
          )}

          {/* Execution notes */}
          {task.execution_notes && (
            <div className="mt-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 mb-0.5">
                {t.executionNotes}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
                {task.execution_notes}
              </p>
            </div>
          )}

          {/* Blocker reason */}
          {task.blocker_reason && (
            <div className="mt-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-red-600/70 dark:text-red-400/70 mb-0.5">
                {t.blockerReason}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 leading-snug">
                {task.blocker_reason}
              </p>
            </div>
          )}

          {/* Detected dependency status */}
          {depCheck.dependencies.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {depCheck.dependencies.map((dep) => {
                const depIcon = TASK_STATUS_ICON[dep.status] ?? TASK_STATUS_ICON.not_started;
                const depBadge = TASK_STATUS_BADGE[dep.status] ?? TASK_STATUS_BADGE.not_started;
                return (
                  <div key={dep.ref} className="flex items-center gap-1.5 text-[11px]">
                    <span className={depIcon.color}>{depIcon.icon}</span>
                    <span className="font-medium text-muted-foreground">{dep.ref}</span>
                    <span className="text-muted-foreground/70">—</span>
                    <span className={`truncate max-w-[180px] ${dep.isComplete ? "text-muted-foreground" : "text-foreground"}`}>
                      {dep.taskTitle}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0 text-[9px] font-medium ${dep.isComplete ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : depBadge}`}>
                      {dep.isComplete ? t.dependencyComplete : t.dependencyIncomplete}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Acceptance criteria */}
          {task.acceptance_criteria && (
            <div className="mt-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                {t.acceptanceCriteria}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {task.acceptance_criteria}
              </p>
            </div>
          )}

          {/* AI Prompt section — collapsed by default, header toggles the body */}
          {task.prompt_body && (
            <div className="mt-2 rounded-md border border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20 overflow-hidden">
              <div className={`flex items-center justify-between gap-2 px-3 py-1.5 ${promptOpen ? "border-b border-purple-200/60 dark:border-purple-800/40" : ""}`}>
                <button
                  type="button"
                  onClick={() => setPromptOpen(!promptOpen)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 transition-colors"
                  title={promptOpen ? (t.hidePrompt ?? "Hide prompt") : (t.showPrompt ?? "Show prompt")}
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${promptOpen ? "" : "-rotate-90"}`} />
                  <Sparkles className="h-3 w-3" />
                  {t.promptLabel}
                </button>
                <div className="flex items-center gap-1.5">
                  {task.ai_tool_target && (
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      {task.ai_tool_target}
                    </span>
                  )}
                  <PromptCopyButton
                    task={task}
                    projectId={projectId}
                    onStatusUpdated={onStatusUpdated}
                    t={t}
                  />
                </div>
              </div>
              {promptOpen && (
                <>
                  <div className="px-3 py-2">
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed break-words">
                      {task.prompt_body}
                    </pre>
                  </div>
                  {(task.prompt_context || task.last_prompt_sent_at) && (
                    <div className="px-3 py-1.5 border-t border-purple-200/60 dark:border-purple-800/40 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                      {task.prompt_context && (
                        <span>{t.promptContextLabel}: {task.prompt_context}</span>
                      )}
                      {task.last_prompt_sent_at && (
                        <span>{t.lastSentLabel}: {new Date(task.last_prompt_sent_at).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                    </div>
                  )}
                  <div className="px-3 py-1.5 border-t border-purple-200/60 dark:border-purple-800/40">
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {t.promptWarning}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Implementation notes */}
          {task.implementation_notes && (
            <div className="mt-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-0.5">
                {t.implementationNotesLabel}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {task.implementation_notes}
              </p>
            </div>
          )}

          {/* Test notes */}
          {task.test_notes && (
            <div className="mt-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5">
                {t.testNotesLabel}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {task.test_notes}
              </p>
            </div>
          )}

          {/* Audit trail */}
          <AuditTrailSection
            taskId={task.id}
            projectId={projectId}
            locale={locale}
            t={t}
          />
        </div>
      </div>

      {/* Predecessor selector */}
      {showPredSelector && (
        <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/50 dark:bg-brand-950/20 p-3">
          <p className="text-xs font-medium text-foreground mb-2">{t.addPredecessor}</p>
          <input
            type="text"
            value={predSearch}
            onChange={(e) => setPredSearch(e.target.value)}
            placeholder={t.addPredecessorPlaceholder}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20"
            autoFocus
          />
          <div className="mt-2 max-h-32 overflow-y-auto space-y-0.5">
            {allTasks
              .filter((t) => t.id !== task.id && t.title.toLowerCase().includes(predSearch.toLowerCase()))
              .slice(0, 8)
              .map((pred) => (
                <button
                  key={pred.id}
                  type="button"
                  disabled={addingPred}
                  onClick={async () => {
                    setAddingPred(true);
                    const result = await createDependencyAction({
                      predecessor_id: pred.id,
                      successor_id: task.id,
                      dependency_type: "finish_to_start",
                      projectId,
                    });
                    setAddingPred(false);
                    if (result.error) {
                      alert(result.error === "cycle_detected" ? t.circularDependencyError : t.dependencyAddError);
                    } else {
                      setShowPredSelector(false);
                      setPredSearch("");
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <span className={`shrink-0 ${TASK_STATUS_ICON[pred.status]?.color ?? "text-gray-400"}`}>{TASK_STATUS_ICON[pred.status]?.icon ?? <Circle className="h-2 w-2" />}</span>
                  <span className="flex-1 truncate text-foreground">{pred.title}</span>
                  <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${TASK_STATUS_BADGE[pred.status] ?? TASK_STATUS_BADGE.not_started}`}>
                    {t.statusLabels[pred.status]}
                  </span>
                </button>
              ))}
            {allTasks.filter((t) => t.id !== task.id && t.title.toLowerCase().includes(predSearch.toLowerCase())).length === 0 && predSearch.length > 0 && (
              <p className="text-xs text-muted-foreground py-1">{t.noMatchingTasks}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setShowPredSelector(false); setPredSearch(""); }}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.cancel}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function TaskListByMilestone({
  projectId,
  milestones,
  tasks,
  taskCounts,
  dependencies = [],
  locale,
  translations: t,
  initialStatusFilter,
  onEditTask,
  onArchiveTask,
  onEditMilestone,
  onArchiveMilestone,
  onAddTask,
  onMoveMilestone,
}: TaskListByMilestoneProps) {
  const router = useRouter();
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(() => {
    // Default to first in_progress milestone
    const inProgress = milestones.find((m) => m.status === "in_progress");
    return inProgress?.id ?? milestones[0]?.id ?? null;
  });
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(initialStatusFilter ?? null);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, TaskStatus>>({});

  // Apply optimistic status overrides
  const tasksWithOptimism = tasks.map((task) => ({
    ...task,
    status: optimisticUpdates[task.id] ?? task.status,
  }));

  // Tasks with no milestone (e.g. created by Rythm AI) — surfaced as their own group.
  const unassignedCount = tasksWithOptimism.filter((t) => !t.milestone_id).length;

  // Filter tasks for selected milestone (or the unassigned group)
  const milestoneTasks =
    selectedMilestoneId === UNASSIGNED_MILESTONE
      ? tasksWithOptimism.filter((t) => !t.milestone_id)
      : selectedMilestoneId
        ? tasksWithOptimism.filter((t) => t.milestone_id === selectedMilestoneId)
        : [];

  // Apply status filter
  const filteredTasks = statusFilter
    ? milestoneTasks.filter((t) => t.status === statusFilter)
    : milestoneTasks;

  // Sort: active work first, AI-active next, then blocked, not_started, deferred, done last
  const STATUS_ORDER: Record<TaskStatus, number> = {
    in_progress: 0,
    sent_to_ai: 1,
    prompt_ready: 2,
    implemented: 3,
    tested: 4,
    blocked: 5,
    not_started: 6,
    deferred: 7,
    done: 8,
  };
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const orderDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (orderDiff !== 0) return orderDiff;
    // Then by priority
    const PRIORITY_ORDER: Record<TaskPriority, number> = { p1: 0, p2: 1, p3: 2 };
    const priDiff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    if (priDiff !== 0) return priDiff;
    // Then by order_index
    return a.order_index - b.order_index;
  });

  // Compute counts for filtered tasks
  const selectedCounts =
    selectedMilestoneId === UNASSIGNED_MILESTONE
      ? {
          total: unassignedCount,
          done: milestoneTasks.filter((t) => t.status === "done").length,
          inProgress: milestoneTasks.filter((t) => t.status === "in_progress").length,
        }
      : selectedMilestoneId
        ? taskCounts[selectedMilestoneId] ?? { total: 0, done: 0, inProgress: 0 }
        : { total: 0, done: 0, inProgress: 0 };

  // Compute per-status counts for the selected milestone
  const statusCounts: Record<string, number> = {};
  for (const task of milestoneTasks) {
    statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
  }

  const handleStatusUpdated = (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update: immediately reflect the new status in the UI
    setOptimisticUpdates((prev) => ({ ...prev, [taskId]: newStatus }));
    // Then refresh server data to get the canonical state
    router.refresh();
  };

  return (
    <div>
      {/* Milestone selector */}
      <div className="mb-4 flex items-center">
        <MilestoneSelector
          milestones={milestones}
          selectedId={selectedMilestoneId}
          onSelect={setSelectedMilestoneId}
          taskCounts={taskCounts}
          locale={locale}
          t={t}
          onEditMilestone={onEditMilestone}
          onArchiveMilestone={onArchiveMilestone}
          onAddTask={onAddTask}
          onMoveMilestone={onMoveMilestone}
          unassignedCount={unassignedCount}
        />
      </div>

      {selectedMilestoneId && (
        <>
          {/* Progress summary */}
          <div className="mb-3">
            <ProgressSummary counts={selectedCounts} t={t} />
          </div>

          {/* Status filter */}
          <div className="mb-4">
            <StatusFilter
              selected={statusFilter}
              onSelect={setStatusFilter}
              statusCounts={statusCounts}
              t={t}
            />
          </div>

          {/* Task list */}
          {sortedTasks.length > 0 ? (
            <div className="space-y-2">
              {sortedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  allTasks={tasksWithOptimism}
                  dependencies={dependencies}
                  projectId={projectId}
                  locale={locale}
                  t={t}
                  onStatusUpdated={handleStatusUpdated}
                  onEditTask={onEditTask}
                  onArchiveTask={onArchiveTask}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <ListTodo className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {statusFilter
                  ? t.noTasksForMilestone
                  : t.noTasksForMilestone}
              </p>
            </div>
          )}
        </>
      )}

      {!selectedMilestoneId && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <ListTodo className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t.selectMilestone}</p>
        </div>
      )}
    </div>
  );
}