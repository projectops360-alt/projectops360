"use client";

// ============================================================================
// ProjectOps360° — Time Tracking · Log / edit a time entry
// ============================================================================
// Rendered from inside the subtask form, so it deliberately uses a <div> and
// button handlers instead of a nested <form> (a form inside a form is invalid
// HTML and the browser drops the inner one). Enter still submits.
//
// One dialog serves BOTH levels: pass `subtaskId` to log against a subtask,
// omit it to log against the task itself. Same component, same action, same
// table — a second "task time" dialog would be a parallel system.
// ============================================================================

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { X, Clock } from "lucide-react";
import { logTimeEntryAction, updateTimeEntryAction } from "@/lib/time-tracking/actions";
import { resolveEntryDuration } from "@/lib/time-tracking/effort";
import type { TimeEntryView } from "@/lib/time-tracking/types";

export interface TimeEntryDialogProps {
  projectId: string;
  taskId: string;
  /** Null/omitted = the entry belongs to the task itself. */
  subtaskId?: string | null;
  /** Null = new entry. */
  entry: TimeEntryView | null;
  /**
   * People the effort may be attributed to. Only offered when the viewer is
   * allowed to log in someone else's name — a contributor records their own.
   */
  people?: { id: string; name: string }[];
  canLogForOthers?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Today in the user's own timezone — not UTC, which can be yesterday. */
function todayLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function TimeEntryDialog({
  projectId,
  taskId,
  subtaskId,
  entry,
  people,
  canLogForOthers,
  onClose,
  onSaved,
}: TimeEntryDialogProps) {
  const t = useTranslations("taskExecutionMap.timeTracking");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [workDate, setWorkDate] = useState(entry?.work_date?.slice(0, 10) ?? todayLocal());
  const [startTime, setStartTime] = useState(entry?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(entry?.end_time?.slice(0, 5) ?? "");
  const [duration, setDuration] = useState(
    entry && !entry.start_time ? String(entry.duration_hours) : "",
  );
  const [comment, setComment] = useState(entry?.comment ?? "");
  // Whose effort this is. Empty = the caller's own; the server defaults to the
  // session user, so an unset picker can never mis-attribute.
  const [userId, setUserId] = useState(entry?.user_id ?? "");
  const showPeoplePicker = !!canLogForOthers && !!people && people.length > 0;

  // Live preview: as soon as both ends of the interval are known, the user sees
  // the hours that will actually be stored.
  const preview = resolveEntryDuration({
    startTime: startTime || null,
    endTime: endTime || null,
    durationHours: duration === "" ? null : Number(duration),
  });
  const usingInterval = !!startTime && !!endTime;

  const submit = () => {
    setError(null);
    if (!preview.ok) {
      setError(t(`errors.${preview.error ?? "invalid_duration"}`));
      return;
    }
    startTransition(async () => {
      const payload = {
        projectId,
        workDate,
        startTime: usingInterval ? startTime : null,
        endTime: usingInterval ? endTime : null,
        durationHours: usingInterval ? null : Number(duration),
        comment: comment.trim() || null,
        userId: userId || null,
      };
      const res = entry
        ? await updateTimeEntryAction({ ...payload, entryId: entry.id })
        : await logTimeEntryAction({ ...payload, taskId, subtaskId: subtaskId ?? null });
      if (res.error) {
        setError(t.has(`errors.${res.error}`) ? t(`errors.${res.error}`) : t("errors.unexpected"));
        return;
      }
      onSaved();
      onClose();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div
        data-testid="tem-time-entry-dialog"
        onKeyDown={onKeyDown}
        className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4" />
            {entry ? t("editTitle") : t("logTitle")}
          </h3>
          <button type="button" onClick={onClose} aria-label={t("cancel")} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="tem-te-date" className="text-xs font-medium text-foreground">
            {t("date")} *
          </label>
          <input
            id="tem-te-date"
            type="date"
            required
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
          />
        </div>

        {/* Whose effort — a manager may record work done by someone else. The
            entry keeps both: user_id is the person who did the work, created_by
            stays the person who typed it in. */}
        {showPeoplePicker && (
          <div>
            <label htmlFor="tem-te-user" className="text-xs font-medium text-foreground">
              {t("forUser")}
            </label>
            <select
              id="tem-te-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            >
              <option value="">{t("forUserSelf")}</option>
              {people!.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("forUserHint")}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="tem-te-start" className="text-xs font-medium text-foreground">
              {t("startTime")}
            </label>
            <input
              id="tem-te-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={duration !== ""}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="tem-te-end" className="text-xs font-medium text-foreground">
              {t("endTime")}
            </label>
            <input
              id="tem-te-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={duration !== ""}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="tem-te-duration" className="text-xs font-medium text-foreground">
            {t("duration")}
          </label>
          <input
            id="tem-te-duration"
            type="number"
            min={0.25}
            max={24}
            step={0.25}
            value={usingInterval && preview.ok ? String(preview.hours) : duration}
            onChange={(e) => setDuration(e.target.value)}
            // With an interval the duration is derived, so it is shown, not typed.
            disabled={usingInterval}
            className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm disabled:opacity-60"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">{t("durationHint")}</p>
        </div>

        <div>
          <label htmlFor="tem-te-comment" className="text-xs font-medium text-foreground">
            {t("comment")}
          </label>
          <textarea
            id="tem-te-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t("commentPlaceholder")}
            className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !preview.ok}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
