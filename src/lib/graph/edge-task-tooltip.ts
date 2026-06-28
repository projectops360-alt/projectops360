// ============================================================================
// ProjectOps360° — Living Graph edge task tooltip (UX-008) — pure helpers
// ============================================================================
// Deterministic, client-safe helpers that turn an edge's task list into the
// hover/tap tooltip content. Status is derived with the SAME canonical rules as
// the rest of the product (task-activity, REG-008/010): a completed task is
// never shown as an active blocker, and Waiting is distinct from Blocked.
// No invention — only what the task data supports.
// ============================================================================

import { isCompletedStatus, isTerminalStatus, hasActiveBlocker } from "@/lib/execution/task-activity";
import type { TaskStatus } from "@/types/database";

/** Raw task carried on an edge (from the graph data source, not the DB). */
export interface EdgeTaskRaw {
  id: string;
  title: string;
  status: string | null;
  isBlocked: boolean;
  /** Optional: the task is waiting on an unfinished predecessor (not blocked). */
  isWaiting?: boolean;
  ownerName?: string | null;
  priority?: string | null;
  dueDate?: string | null;
}

export type EdgeTaskStatusKey =
  | "done" | "in_progress" | "blocked" | "waiting"
  | "deferred" | "cancelled" | "pending";

const IN_PROGRESS = new Set(["in_progress", "sent_to_ai", "implemented", "tested"]);

/**
 * Deterministic display status for one edge task. Precedence mirrors the
 * Execution Status Engine: terminal wins, then explicit blocker, then waiting,
 * then activity. A stale `is_blocked` on a completed task → "done" (REG-008).
 */
export function edgeTaskStatusKey(task: Pick<EdgeTaskRaw, "status" | "isBlocked" | "isWaiting">): EdgeTaskStatusKey {
  const status = task.status ?? "";
  if (isCompletedStatus(status)) return "done";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "deferred") return "deferred";
  if (isTerminalStatus(status)) return "done"; // any other terminal → finished
  if (hasActiveBlocker({ status: status as TaskStatus, is_blocked: task.isBlocked })) return "blocked";
  if (task.isWaiting) return "waiting";
  if (IN_PROGRESS.has(status)) return "in_progress";
  return "pending";
}

/** Tailwind chip classes per status (light surface, ProjectOps360° palette). */
export function edgeTaskStatusChipClass(key: EdgeTaskStatusKey): string {
  switch (key) {
    case "done": return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30";
    case "in_progress": return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "blocked": return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
    case "waiting": return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "deferred": return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
    case "cancelled": return "bg-slate-500/10 text-slate-500 dark:text-slate-500 border-slate-500/30";
    default: return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
  }
}

/** Safely read an edge's task list (edge.metadata.taskList) into typed tasks. */
export function normalizeEdgeTasks(raw: unknown): EdgeTaskRaw[] {
  if (!Array.isArray(raw)) return [];
  const out: EdgeTaskRaw[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const title = typeof o.title === "string" && o.title.trim() ? o.title : "";
    if (!id || !title) continue; // never invent an empty task
    out.push({
      id,
      title,
      status: typeof o.status === "string" ? o.status : null,
      isBlocked: o.isBlocked === true,
      isWaiting: o.isWaiting === true,
      ownerName: typeof o.ownerName === "string" && o.ownerName.trim() ? o.ownerName : null,
      priority: typeof o.priority === "string" && o.priority.trim() ? o.priority : null,
      dueDate: typeof o.dueDate === "string" && o.dueDate.trim() ? o.dueDate : null,
    });
  }
  return out;
}

/** Truncate a long task list for the tooltip: first `max`, plus the remainder count. */
export function limitTasks<T>(tasks: T[], max = 7): { shown: T[]; moreCount: number } {
  if (tasks.length <= max) return { shown: tasks, moreCount: 0 };
  return { shown: tasks.slice(0, max), moreCount: tasks.length - max };
}
