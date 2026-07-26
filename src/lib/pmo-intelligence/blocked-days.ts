// ============================================================================
// PMO Intelligence Center — blocked days from the canonical event log
// ============================================================================
// The parity matrix listed "blocked days" as a gap: the KPI existed on the mock
// but nothing computed it, so Dashboard 3 reported `unavailable`. This closes
// it, deterministically, from `project_event_log` state transitions — the only
// place that records when work actually entered and left a blocked state.
//
// Pure. The loader that fetches the rows lives in read-model.server.ts.
//
// Deliberately conservative: a blocked interval is only counted when BOTH ends
// are observed. An open interval — blocked, never unblocked — is reported
// separately as `stillBlocked`, because "blocked since March" and "was blocked
// for 4 days" are different facts and a PMO should not see them summed.
// ============================================================================

/** The state name the domain uses. Not inferred — it is the value in the enum. */
const BLOCKED_STATE = "blocked";

const MS_PER_DAY = 86_400_000;

export interface StateTransitionRow {
  project_id: string;
  subject_type: string | null;
  subject_id: string | null;
  from_state: string | null;
  to_state: string | null;
  occurred_at: string;
}

export interface BlockedInterval {
  projectId: string;
  subjectId: string;
  startedAt: string;
  /** Null while the subject is still blocked. */
  endedAt: string | null;
  days: number | null;
}

export interface BlockedDaysResult {
  /** Closed intervals only, per project. */
  daysByProject: Map<string, number>;
  totalDays: number;
  intervals: BlockedInterval[];
  /** Subjects blocked right now, with no unblock event yet. */
  stillBlocked: BlockedInterval[];
}

function daysBetween(startIso: string, endIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return (end - start) / MS_PER_DAY;
}

/**
 * Total days spent in a blocked state, per project.
 *
 * Walks each subject's transitions in chronological order and pairs every
 * entry into `blocked` with the next exit from it. Re-entering while already
 * blocked does not open a second interval — that would double count a single
 * period of stalled work, which is exactly the failure this KPI invites.
 *
 * @param asOf ISO timestamp used to age still-open intervals. Passed in rather
 *             than read from the clock so the calculation stays pure and
 *             testable.
 */
export function computeBlockedDays(
  rows: readonly StateTransitionRow[],
  asOf: string,
): BlockedDaysResult {
  const bySubject = new Map<string, StateTransitionRow[]>();

  for (const row of rows) {
    if (!row.subject_id) continue;
    // A transition that neither enters nor leaves the blocked state tells us
    // nothing about blocked time.
    if (row.from_state !== BLOCKED_STATE && row.to_state !== BLOCKED_STATE) continue;
    const key = `${row.project_id}|${row.subject_id}`;
    const bucket = bySubject.get(key);
    if (bucket) bucket.push(row);
    else bySubject.set(key, [row]);
  }

  const intervals: BlockedInterval[] = [];
  const stillBlocked: BlockedInterval[] = [];
  const daysByProject = new Map<string, number>();

  for (const [key, subjectRows] of bySubject) {
    const [projectId, subjectId] = key.split("|");
    // The event log guarantees ordering by sequence, but a projection may
    // arrive out of order; sorting here keeps the pairing correct regardless.
    const ordered = [...subjectRows].sort((a, b) =>
      a.occurred_at.localeCompare(b.occurred_at),
    );

    let openedAt: string | null = null;

    for (const row of ordered) {
      if (row.to_state === BLOCKED_STATE) {
        // Already blocked: not a new interval.
        if (openedAt === null) openedAt = row.occurred_at;
        continue;
      }
      if (row.from_state === BLOCKED_STATE && openedAt !== null) {
        const days = daysBetween(openedAt, row.occurred_at);
        intervals.push({
          projectId,
          subjectId,
          startedAt: openedAt,
          endedAt: row.occurred_at,
          days,
        });
        daysByProject.set(projectId, (daysByProject.get(projectId) ?? 0) + days);
        openedAt = null;
      }
    }

    if (openedAt !== null) {
      stillBlocked.push({
        projectId,
        subjectId,
        startedAt: openedAt,
        endedAt: null,
        days: daysBetween(openedAt, asOf),
      });
    }
  }

  let totalDays = 0;
  for (const days of daysByProject.values()) totalDays += days;

  return { daysByProject, totalDays, intervals, stillBlocked };
}

/** Days currently accumulating, kept apart from closed intervals. */
export function currentlyBlockedDays(result: BlockedDaysResult): number {
  return result.stillBlocked.reduce((sum, interval) => sum + (interval.days ?? 0), 0);
}
