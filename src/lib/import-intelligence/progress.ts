// ============================================================================
// Import progress — what the importer is doing right now
// ============================================================================
// A large plan takes minutes to write. With only a spinner on screen there is
// no way to tell "working" from "hung", and a healthy 262-second import that
// wrote all 274 tasks and its complete graph was cancelled by the user, who
// reasonably assumed it had died.
//
// So the executor reports what it is doing, per category. Progress is written
// onto the job row and the client polls it — no streaming, no new transport,
// and it survives a page reload because the state lives in the database.
// ============================================================================

/** The categories an import writes, in the order it writes them. */
export const IMPORT_PHASES = [
  "project",
  "charter",
  "milestones",
  "resources",
  "budget_items",
  "tasks",
  "dependencies",
  "materials",
  "risks",
  "graph",
  "critical_path",
] as const;

export type ImportPhase = (typeof IMPORT_PHASES)[number];

export interface ImportProgress {
  /** What is being written right now. */
  phase: ImportPhase;
  /** Rows completed in this phase. */
  done: number;
  /** Rows expected in this phase; 0 when the phase is not countable. */
  total: number;
  /** Completed phases, so the UI can show a full history rather than one line. */
  completed: { phase: ImportPhase; count: number }[];
  updatedAt: string;
}

/**
 * How often progress may be written.
 *
 * Reporting every row would add one database write per row — the very cost
 * that makes a large import slow. Throttling keeps the overhead to a handful
 * of writes while still moving often enough to look alive.
 */
export const PROGRESS_WRITE_INTERVAL_MS = 1500;

/** Report the first and last row of a phase regardless of the interval, so a
 *  phase never appears stuck at 0 or short of its total. */
export function shouldWriteProgress(
  done: number,
  total: number,
  lastWriteAt: number,
  now: number,
): boolean {
  if (done <= 1) return true;
  if (total > 0 && done >= total) return true;
  return now - lastWriteAt >= PROGRESS_WRITE_INTERVAL_MS;
}

/** Human-facing summary: "Tasks 150/274". Label lookup stays in the UI. */
export function formatPhaseProgress(done: number, total: number): string {
  return total > 0 ? `${done}/${total}` : String(done);
}

/**
 * Whether an import that reports this progress looks alive.
 *
 * Used to tell "still working" from "the function died": a job in `importing`
 * whose progress has not moved for longer than this is no longer running,
 * because a timeout kills the process without any chance to record failure.
 */
export const PROGRESS_STALL_MS = 90_000;

export function isProgressStalled(
  progress: ImportProgress | null,
  now: number = Date.now(),
): boolean {
  if (!progress) return false;
  const updated = Date.parse(progress.updatedAt);
  if (!Number.isFinite(updated)) return false;
  return now - updated > PROGRESS_STALL_MS;
}
