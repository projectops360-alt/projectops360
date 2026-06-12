// ============================================================================
// ProjectOps360° — Lightweight Dependency Visibility
// ============================================================================
// Parses dependency_notes for task references like "3.1", "4.2", etc.
// Matches them to external_key values on roadmap_tasks.
// Only warns — never blocks operations.
// ============================================================================

import type { RoadmapTask, TaskStatus } from "@/types/database";
import { DEPENDENCY_COMPLETE_STATUSES } from "./status-mappings";

// ── Types ──────────────────────────────────────────────────────────────────────

/** A single dependency detected from a task's dependency_notes. */
export interface DetectedDependency {
  ref: string;            // e.g. "3.1"
  taskId: string | null;  // matched task ID, null if not found
  taskTitle: string;      // title or "Unknown" if not found
  status: TaskStatus;     // current status of the dependency
  isComplete: boolean;    // true if status is "done" or "tested"
}

/** Result of parsing a task's dependency_notes. */
export interface DependencyCheck {
  dependencies: DetectedDependency[];
  hasWarning: boolean;     // true if any dependency is incomplete
  warningCount: number;   // number of incomplete dependencies
}

// ── Status helpers ──────────────────────────────────────────────────────────────

/** Use shared constant — "done" and "tested" both count as complete for dependency checking. */
const COMPLETE_STATUSES: TaskStatus[] = DEPENDENCY_COMPLETE_STATUSES;

// ── Parsing ────────────────────────────────────────────────────────────────────

/**
 * Extract task references from dependency_notes.
 * Matches patterns like "3.1", "4.2", "12.5" (sprint.task format).
 * Also matches "#3.1" or "task 3.1" prefixes.
 */
export function parseDependencyRefs(notes: string | null): string[] {
  if (!notes) return [];

  // Match digit.digit patterns (e.g. 3.1, 4.2, 12.5)
  const pattern = /\b(\d+\.\d+)\b/g;
  const refs: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(notes)) !== null) {
    refs.push(match[1]);
  }

  // Deduplicate
  return [...new Set(refs)];
}

// ── Dependency Check ────────────────────────────────────────────────────────────

/**
 * Check a task's dependency_notes against the full task list.
 * Returns detected dependencies with their status and a warning flag.
 */
export function checkDependencies(
  task: RoadmapTask,
  allTasks: RoadmapTask[],
): DependencyCheck {
  const refs = parseDependencyRefs(task.dependency_notes);

  if (refs.length === 0) {
    return { dependencies: [], hasWarning: false, warningCount: 0 };
  }

  // Build a lookup from external_key to task
  const byExternalKey = new Map<string, RoadmapTask>();
  for (const t of allTasks) {
    if (t.external_key) {
      byExternalKey.set(t.external_key, t);
    }
  }

  const dependencies: DetectedDependency[] = refs.map((ref) => {
    const matched = byExternalKey.get(ref) ?? null;

    return {
      ref,
      taskId: matched?.id ?? null,
      taskTitle: matched?.title ?? `Task ${ref}`,
      status: matched?.status ?? ("not_started" as TaskStatus),
      isComplete: matched ? COMPLETE_STATUSES.includes(matched.status) : false,
    };
  });

  const warningCount = dependencies.filter((d) => !d.isComplete).length;

  return {
    dependencies,
    hasWarning: warningCount > 0,
    warningCount,
  };
}