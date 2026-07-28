"use client";

// ============================================================================
// ProjectOps360° — Time Tracking · Subtask effort panel + time log
// ============================================================================
// Shows the three numbers a PM actually asks for (estimated / actual /
// remaining), the effort bar, and the full history. Actual hours are always the
// sum of the entries below — there is no field to type them into, by design
// (guard SUBTASK-ACTUAL-HOURS-DERIVED).
// ============================================================================

import { useState, useEffect, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Clock, Pencil, Trash2, Loader2 } from "lucide-react";
import { listTimeEntriesAction, deleteTimeEntryAction } from "@/lib/time-tracking/actions";
import { computeEffort, effortBarPct, SUBTASK_THRESHOLDS } from "@/lib/time-tracking/effort";
import type { TimeEntryView, EffortSeverity } from "@/lib/time-tracking/types";
import { TimeEntryDialog } from "./time-entry-dialog";

export interface SubtaskTimeLogProps {
  projectId: string;
  subtaskId: string;
  estimatedHours: number | null;
  /** Notifies the parent so the cached actual hours stay in sync on screen. */
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

export function SubtaskTimeLog({ projectId, subtaskId, estimatedHours, onTotalChange }: SubtaskTimeLogProps) {
  const t = useTranslations("taskExecutionMap.timeTracking");
  const [entries, setEntries] = useState<TimeEntryView[] | null>(null);
  const [actualHours, setActualHours] = useState(0);
  const [dialogFor, setDialogFor] = useState<{ entry: TimeEntryView | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await listTimeEntriesAction({ projectId, subtaskId });
      if (res.error) {
        setError(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.unexpected"));
        setEntries([]);
        return;
      }
      setEntries(res.entries ?? []);
      setActualHours(res.actualHours ?? 0);
      onTotalChange?.(res.actualHours ?? 0);
    });
  }, [projectId, subtaskId, t, onTotalChange]);

  useEffect(() => { load(); }, [load]);

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

  const effort = computeEffort(estimatedHours, actualHours, SUBTASK_THRESHOLDS);
  const h = (value: number | null) => (value === null ? "—" : `${value} ${t("hoursShort")}`);

  return (
    <div className="space-y-3" data-testid="tem-subtask-time-log">
      {/* ── Effort summary ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <Figure label={t("estimated")} value={h(effort.estimatedHours)} />
        <Figure label={t("actual")} value={h(effort.actualHours)} />
        <Figure
          label={t("remaining")}
          value={h(effort.remainingHours)}
          className={effort.remainingHours !== null && effort.remainingHours < 0 ? TEXT_COLOR[effort.severity] : undefined}
        />
      </div>

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
                  <td className="py-1.5 pr-2 text-foreground">{entry.user_name || "—"}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums font-medium text-foreground">
                    {entry.duration_hours}
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
          subtaskId={subtaskId}
          entry={dialogFor.entry}
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
