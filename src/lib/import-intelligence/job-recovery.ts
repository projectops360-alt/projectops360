// ============================================================================
// Import job recovery — no state may be a dead end
// ============================================================================
// A function that exceeds its time limit is KILLED: no exception is thrown, so
// the executor's catch never runs, the job is never marked failed and no
// rollback is attempted. The job simply stays in 'importing' for ever.
//
// Rollback used to accept only 'imported' and 'failed', so such a job could
// neither be finished nor undone — the user was stuck with a half-projected
// import and no way out. An abandoned 'importing' job is therefore recoverable
// once it has clearly outlived any run that could still be in flight.
// ============================================================================

/** Longest a real run can take, plus margin. Anything older is abandoned. */
export const ABANDONED_IMPORT_AFTER_MS = 15 * 60 * 1000;

/**
 * Whether a rollback may proceed.
 *
 * `importing` is allowed only when the job is old enough that no live run
 * could still be writing to it — rolling back underneath a running import
 * would delete rows it is about to reference.
 */
export function canRollbackJob(
  status: string,
  lastActivityAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (status === "imported" || status === "failed") return true;
  if (status !== "importing") return false;

  if (!lastActivityAt) return false;
  const started = Date.parse(lastActivityAt);
  if (!Number.isFinite(started)) return false;
  return now - started >= ABANDONED_IMPORT_AFTER_MS;
}
