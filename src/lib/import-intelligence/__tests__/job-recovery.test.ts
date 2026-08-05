// ============================================================================
// REG-048 — A timed-out import left the job stranded in 'importing'
// ============================================================================
// Guard: IMPORT-NO-DEAD-END
//
// Importing a 274-task plan exceeded the function's time limit while emitting
// the Living Graph. A timeout KILLS the process, so the executor's catch never
// ran: the job was never marked failed, no rollback was attempted, and it sat
// in 'importing' for ever — while every business row had in fact been written
// correctly. Rollback accepted only 'imported' and 'failed', so the user could
// neither finish nor undo it.
// ============================================================================

import { describe, it, expect } from "vitest";
import { canRollbackJob, ABANDONED_IMPORT_AFTER_MS } from "../job-recovery";

const NOW = Date.parse("2026-08-05T14:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("canRollbackJob", () => {
  it("allows the states that always could be rolled back", () => {
    expect(canRollbackJob("imported", ago(0), NOW)).toBe(true);
    expect(canRollbackJob("failed", ago(0), NOW)).toBe(true);
  });

  it("does NOT roll back underneath a run that may still be writing", () => {
    // Deleting rows a live import is about to reference would corrupt it.
    expect(canRollbackJob("importing", ago(60_000), NOW)).toBe(false);
    expect(canRollbackJob("importing", ago(ABANDONED_IMPORT_AFTER_MS - 1), NOW)).toBe(false);
  });

  it("recovers an import abandoned by a timeout", () => {
    expect(canRollbackJob("importing", ago(ABANDONED_IMPORT_AFTER_MS), NOW)).toBe(true);
    expect(canRollbackJob("importing", ago(6 * 60 * 60 * 1000), NOW)).toBe(true);
  });

  it("leaves states that were never a dead end alone", () => {
    for (const status of ["uploaded", "analyzing", "mapped", "ready_to_import", "cancelled"]) {
      expect(canRollbackJob(status, ago(24 * 60 * 60 * 1000), NOW)).toBe(false);
    }
  });

  it("refuses when there is no timestamp to judge abandonment by", () => {
    // Without a clock reference, assuming the run is dead risks deleting rows
    // from under a live import.
    expect(canRollbackJob("importing", null, NOW)).toBe(false);
    expect(canRollbackJob("importing", undefined, NOW)).toBe(false);
    expect(canRollbackJob("importing", "not a date", NOW)).toBe(false);
  });
});
