"use client";

// ============================================================================
// ProjectOps360° — Time Tracking · Effort panel + time log
// ============================================================================
// Shows the numbers a PM actually asks for (estimated / actual / remaining /
// consumption / variance), the effort bar, and the full history. Actual hours
// are always the sum of the entries below — there is no field to type them
// into, by design (guard SUBTASK-ACTUAL-HOURS-DERIVED).
//
// ONE panel serves both levels. With `subtaskId` it is a subtask's log; without
// it, it is the task's CONSOLIDATED log — the task's own entries plus every
// subtask's, which is exactly the set its actual hours are summed from, so the
// history always adds up to the total shown above it.
// ============================================================================

import { useState, useEffect, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Clock, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  listTimeEntriesAction,
  deleteTimeEntryAction,
  listTimeLogPeopleAction,
  getTaskEffortAction,
} from "@/lib/time-tracking/actions";
import type { TimeLogPerson } from "@/lib/time-tracking/people";
import { computeEffort, effortBarPct, SUBTASK_THRESHOLDS } from "@/lib/time-tracking/effort";
import type { EffortThresholds } from "@/lib/time-tracking/effort";
import type { TimeEntryView, EffortSeverity } from "@/lib/time-tracking/types";
import { TimeEntryDialog } from "./time-entry-dialog";

export interface TimeLogPanelProps {
  projectId: string;
  taskId: string;
  /** Null/omitted = the task's consolidated log instead of one subtask's. */
  subtaskId?: string | null;
  /**
   * Only for subtask level, where the caller already holds the number. At task
   * level it is read from the engine instead: the consolidated estimate depends
   * on the subtasks, which the client does not have.
   */
  estimatedHours?: number | null;
  thresholds?: EffortThresholds;
  /** Notifies the parent so the cached actual hours stay in sync on screen. */
  onTotalChange?: (actualHours: number) => void;
}

export interface SubtaskTimeLogProps {
  projectId: string;
  taskId: string;
  subtaskId: string;
  estimatedHours: number | null;
  onTotalChange?: (actualHours: number) => void;
}

const BAR_COLOR: Record<EffortSeverity, string> = {
  none: "bg-muted-foreground/40",
  on_track: "bg-emerald-500",
  warning: "bg-amber-500",
  over: "bg-orange-500",
  critical: "bg-red-500",
};

const TEXT_COLOR: Record<EffortSeverity, string> = {
  none: "text-muted-foreground",
  on_track: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  over: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

/** A subtask's time log — the original surface, unchanged in behaviour. */
export function SubtaskTimeLog({ projectId, taskId, subtaskId, estimatedHours, onTotalChange }: SubtaskTimeLogProps) {
  return (
    <TimeLogPanel
      projectId={projectId}
      taskId={taskId}
      subtaskId={subtaskId}
      estimatedHours={estimatedHours}
      thresholds={SUBTASK_THRESHOLDS}
      onTotalChange={onTotalChange}
    />
  );
}

export function TimeLogPanel({
  projectId,
  taskId,
  subtaskId,
  estimatedHours,
  thresholds = SUBTASK_THRESHOLDS,
  onTotalChange,
}: TimeLogPanelProps) {
  const t = useTranslations("taskExecutionMap.timeTracking");
  const [entries, setEntries] = useState<TimeEntryView[] | null>(null);
  const [actualHours, setActualHours] = useState(0);
  const [taskEstimated, setTaskEstimated] = useState<number | null>(null);
  const [dialogFor, setDialogFor] = useState<{ entry: TimeEntryView | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canLogForOthers, setCanLogForOthers] = useState(false);
  // Who effort may be attributed to. Owned here rather than passed in: the
  // callers used to hand down `profiles WHERE organization_id`, which is a
  // profile's HOME org and left the picker with a single name (REG-043).
  const [peopleState, setPeopleState] = useState<{
    status: "loading" | "ready" | "error";
    list: TimeLogPerson[];
  }>({ status: "loading", list: [] });
  const [pending, startTransition] = useTransition();
  const isTaskLevel = !subtaskId;

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await listTimeEntriesAction({ projectId, taskId, subtaskId: subtaskId ?? null });
      if (res.error) {
        setError(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.unexpected"));
        setEntries([]);
        return;
      }
      setEntries(res.entries ?? []);
      setActualHours(res.actualHours ?? 0);
      onTotalChange?.(res.actualHours ?? 0);
      // At task level the consolidated estimate is the engine's to decide
      // (subtasks when they exist), so it is refreshed alongside the log.
      if (!subtaskId) {
        const effortRes = await getTaskEffortAction(projectId, taskId);
        setTaskEstimated(effortRes.effort?.estimatedHours ?? null);
      }
    });
  }, [projectId, taskId, subtaskId, t, onTotalChange]);

  useEffect(() => { load(); }, [load]);

  // One call answers both "who" and "may I". The picker is offered only when
  // the server would actually accept someone else's id, so the UI never
  // presents a choice the action will reject.
  useEffect(() => {
    let active = true;
    setPeopleState({ status: "loading", list: [] });
    listTimeLogPeopleAction(projectId, taskId)
      .then((res) => {
        if (!active) return;
        if (res.error || !res.people) {
          // Surfaced as a failure. Falling back to "just you" is what made the
          // bug invisible: the picker looked complete while it was empty.
          setPeopleState({ status: "error", list: [] });
          setCanLogForOthers(false);
          return;
        }
        setPeopleState({ status: "ready", list: res.people });
        setCanLogForOthers(!!res.canLogForOthers);
      })
      .catch(() => {
        if (!active) return;
        setPeopleState({ status: "error", list: [] });
        setCanLogForOthers(false); // deny-by-default
      });
    return () => { active = false; };
  }, [projectId, taskId]);

  const remove = (entry: TimeEntryView) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const res = await deleteTimeEntryAction({ projectId, entryId: entry.id });
      if (res.error) {
        setError(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.unexpected"));
        return;
      }
      load();
    });
  };

  const effort = computeEffort(isTaskLevel ? taskEstimated : estimatedHours, actualHours, thresholds);
  const h = (value: number | null) => (value === null ? "—" : `${value} ${t("hoursShort")}`);
  const signed = (value: number | null) =>
    value === null ? "—" : `${value > 0 ? "+" : ""}${value} ${t("hoursShort")}`;

  return (
    <div
      className="space-y-3"
      data-testid={isTaskLevel ? "tem-task-time-log" : "tem-subtask-time-log"}
    >
      {/* ── Effort summary ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label={t("estimated")} value={h(effort.estimatedHours)} />
        <Figure label={t("actual")} value={h(effort.actualHours)} />
        {/* Remaining is budget LEFT and floors at 0; the overrun is the variance
            beside it, so the two together read as a full picture. */}
        <Figure label={t("remaining")} value={h(effort.remainingHours)} />
        <Figure
          label={t("variance")}
          value={signed(effort.varianceHours)}
          className={effort.varianceHours !== null && effort.varianceHours > 0 ? TEXT_COLOR[effort.severity] : undefined}
        />
      </div>

      {isTaskLevel && (
        <p className="text-[11px] text-muted-foreground">{t("taskLevelHint")}</p>
      )}

      {effort.consumedPct !== null && (
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-medium text-muted-foreground">{t("effort")}</span>
            <span className={TEXT_COLOR[effort.severity]}>
              {effort.actualHours} / {effort.estimatedHours} {t("hoursShort")} · {effort.consumedPct}%
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={effort.consumedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("effort")}
          >
            <div className={`h-full rounded-full transition-all ${BAR_COLOR[effort.severity]}`} style={{ width: `${effortBarPct(effort)}%` }} />
          </div>
          {(effort.severity === "over" || effort.severity === "critical") && (
            <p className={`mt-1 text-[11px] font-medium ${TEXT_COLOR[effort.severity]}`}>{t("overBudget")}</p>
          )}
          {effort.severity === "warning" && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{t("nearBudget")}</p>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">{t("readOnlyHint")}</p>

      {/* ── Log button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setDialogFor({ entry: null })}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        <Clock className="h-3.5 w-3.5" />
        {t("logButton")}
      </button>

      {error && (
        <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* ── History ────────────────────────────────────────────────────── */}
      {entries === null || (pending && entries.length === 0) ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1 pr-2 font-medium">{t("colDate")}</th>
                <th className="py-1 pr-2 font-medium">{t("colUser")}</th>
                <th className="py-1 pr-2 text-right font-medium">{t("colHours")}</th>
                <th className="py-1 pr-2 font-medium">{t("colComment")}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/50 align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums text-foreground">
                    {entry.work_date.slice(0, 10)}
                    {entry.start_time && (
                      <span className="block text-[10px] text-muted-foreground">
                        {entry.start_time.slice(0, 5)}–{entry.end_time?.slice(0, 5)}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-foreground">
                    {entry.user_name || "—"}
                    {/* In the consolidated view, say which entries arrived from a
                        subtask so the total is auditable at a glance. */}
                    {isTaskLevel && entry.subtask_id && (
                      <span className="block text-[10px] text-muted-foreground">{t("viaSubtask")}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums font-medium text-foreground">
                    {entry.duration_hours}
                    {/* Show how a crew total was built, so the number can be
                        checked without opening the entry. */}
                    {entry.crew_size > 1 && (
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {entry.crew_size} × {entry.hours_per_person ?? "—"} {t("hoursShort")}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{entry.comment || "—"}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {entry.can_edit && (
                      <button
                        type="button"
                        onClick={() => setDialogFor({ entry })}
                        aria-label={t("edit")}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {entry.can_delete && (
                      <button
                        type="button"
                        onClick={() => remove(entry)}
                        aria-label={t("delete")}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogFor && (
        <TimeEntryDialog
          projectId={projectId}
          taskId={taskId}
          // Editing keeps the entry on whatever level it was filed under; a new
          // entry follows the panel's own level.
          subtaskId={dialogFor.entry ? dialogFor.entry.subtask_id : subtaskId ?? null}
          entry={dialogFor.entry}
          people={peopleState.list}
          peopleStatus={peopleState.status}
          canLogForOthers={canLogForOthers}
          onClose={() => setDialogFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${className ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

/** Compact "40 h / 26 h" pair for the subtask card. */
export function EffortInline({ estimated, actual, hoursLabel }: { estimated: number | null; actual: number | null; hoursLabel: string }) {
  const effort = computeEffort(estimated, actual ?? 0, SUBTASK_THRESHOLDS);
  if (effort.estimatedHours === null && effort.actualHours === 0) return null;
  return (
    <span className={`tabular-nums ${TEXT_COLOR[effort.severity]}`}>
      {effort.actualHours}/{effort.estimatedHours ?? "—"} {hoursLabel}
    </span>
  );
}

export { BAR_COLOR as EFFORT_BAR_COLOR, TEXT_COLOR as EFFORT_TEXT_COLOR };
