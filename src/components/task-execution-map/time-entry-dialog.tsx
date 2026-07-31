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

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { X, Clock, Loader2 } from "lucide-react";
import { logTimeEntryAction, updateTimeEntryAction } from "@/lib/time-tracking/actions";
import { resolveCrewEntry } from "@/lib/time-tracking/effort";
import {
  filterPeople,
  PEOPLE_SEARCH_THRESHOLD,
  type TimeLogPerson,
} from "@/lib/time-tracking/people";
import type { TimeEntryView } from "@/lib/time-tracking/types";

export interface TimeEntryDialogProps {
  projectId: string;
  taskId: string;
  /** Null/omitted = the entry belongs to the task itself. */
  subtaskId?: string | null;
  /** Null = new entry. */
  entry: TimeEntryView | null;
  /**
   * People the effort may be attributed to, already de-duplicated and sorted
   * with the caller first. Only offered when the viewer is allowed to log in
   * someone else's name — a contributor records their own.
   */
  people?: TimeLogPerson[];
  peopleStatus?: "loading" | "ready" | "error";
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
  peopleStatus = "ready",
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
  // Per-person hours, never the crew total: on a crew row the total is the
  // crew's, and seeding this field with it would multiply by the crew again.
  const [duration, setDuration] = useState(
    entry && !entry.start_time
      ? String(entry.hours_per_person ?? entry.duration_hours / (entry.crew_size || 1))
      : "",
  );
  const [crewSize, setCrewSize] = useState(String(entry?.crew_size ?? 1));
  const [comment, setComment] = useState(entry?.comment ?? "");
  // Whose effort this is. Empty = the caller's own; the server defaults to the
  // session user, so an unset picker can never mis-attribute. On an existing
  // entry it is the person already recorded.
  const [userId, setUserId] = useState(entry?.user_id ?? "");
  const [peopleQuery, setPeopleQuery] = useState("");
  const showPeoplePicker = !!canLogForOthers;
  const visiblePeople = filterPeople(people ?? [], peopleQuery);
  const needsSearch = (people?.length ?? 0) > PEOPLE_SEARCH_THRESHOLD;

  // Preselect the caller by their real id once the list arrives. Leaving the
  // value empty would need a placeholder option, and that placeholder was the
  // duplicate "Myself" this fix removes.
  useEffect(() => {
    if (userId || peopleStatus !== "ready") return;
    const self = people?.find((p) => p.isSelf);
    if (self) setUserId(self.id);
  }, [people, peopleStatus, userId]);

  /** "Efrain Prada (Myself)" — one entry per human, never a separate "Myself". */
  const personLabel = (person: TimeLogPerson): string => {
    const base = person.isSelf ? `${person.name} (${t("forUserSelf")})` : person.name;
    return person.email ? `${base} · ${person.email}` : base;
  };

  // Live preview: as soon as both ends of the interval are known, the user sees
  // the hours that will actually be stored — including the crew multiplication,
  // so "20 people × 10 h" shows its 200 man-hour total before saving.
  const preview = resolveCrewEntry({
    startTime: startTime || null,
    endTime: endTime || null,
    hoursPerPerson: duration === "" ? null : Number(duration),
    crewSize: crewSize === "" ? 1 : Number(crewSize),
  });
  const usingInterval = !!startTime && !!endTime;
  const isCrew = preview.ok && preview.crewSize > 1;

  // Save is gated on preview.ok, so an invalid duration used to disable the
  // button and say NOTHING — submit() held the only error message and could
  // never run. Anyone typing 100 hours (over the 24h-per-entry rule) or a
  // backwards interval just saw a dead button. The reason is now shown as soon
  // as there is something to judge.
  const hasDurationInput = duration !== "" || usingInterval || crewSize === "";
  const validationError =
    hasDurationInput && !preview.ok ? t(`errors.${preview.error ?? "invalid_duration"}`) : null;
  const shownError = error ?? validationError;

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
        crewSize: crewSize === "" ? 1 : Number(crewSize),
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

        {shownError && (
          <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-600">
            {shownError}
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

            {peopleStatus === "loading" && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("forUserLoading")}
              </p>
            )}

            {/* A failed lookup says so. Silently showing only the current user is
                what made the original bug look like correct behaviour. */}
            {peopleStatus === "error" && (
              <p role="alert" className="mt-1 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-600">
                {t("errors.people_unavailable")}
              </p>
            )}

            {peopleStatus === "ready" && (people?.length ?? 0) === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{t("forUserEmpty")}</p>
            )}

            {peopleStatus === "ready" && (people?.length ?? 0) > 0 && (
              <>
                {needsSearch && (
                  <input
                    type="search"
                    value={peopleQuery}
                    onChange={(e) => setPeopleQuery(e.target.value)}
                    placeholder={t("forUserSearch")}
                    aria-label={t("forUserSearch")}
                    className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
                  />
                )}
                <select
                  id="tem-te-user"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
                >
                  {/* No separate "Myself" option: the caller is already the
                      first row, labelled. Two entries for one human was the
                      reported bug, not a convenience. */}
                  {visiblePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {personLabel(person)}
                    </option>
                  ))}
                </select>
                {needsSearch && visiblePeople.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("forUserNoMatch")}</p>
                )}
              </>
            )}

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

        {/* Hours are PER PERSON and the crew multiplies them. Keeping the two
            separate is what lets a 200 man-hour crew shift through while still
            refusing to claim one person worked 200 hours in a day. */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="tem-te-duration" className="text-xs font-medium text-foreground">
              {t("durationPerPerson")}
            </label>
            <input
              id="tem-te-duration"
              type="number"
              min={0.25}
              max={24}
              step={0.25}
              value={usingInterval && preview.ok ? String(preview.hoursPerPerson) : duration}
              onChange={(e) => setDuration(e.target.value)}
              // With an interval the duration is derived, so it is shown, not typed.
              disabled={usingInterval}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="tem-te-crew" className="text-xs font-medium text-foreground">
              {t("crewSize")}
            </label>
            <input
              id="tem-te-crew"
              type="number"
              min={1}
              max={999}
              step={1}
              value={crewSize}
              onChange={(e) => setCrewSize(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            />
          </div>
        </div>

        {/* The stored number, shown before saving so the multiplication is never
            a surprise after the fact. */}
        {isCrew && (
          <p className="rounded border border-border bg-muted/40 p-2 text-xs text-foreground">
            {t("crewTotal", {
              crew: preview.crewSize,
              hours: preview.hoursPerPerson ?? 0,
              total: preview.totalHours ?? 0,
            })}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">{t("durationHint")}</p>

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
