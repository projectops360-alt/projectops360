"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2 } from "lucide-react";
import { createMeetingAction } from "@/app/[locale]/(app)/projects/[projectId]/meetings/actions";
import type { MeetingStatus, Locale } from "@/types/database";

type CreateState =
  | { error: string; success?: undefined; meetingId?: undefined }
  | { error?: undefined; success: true; meetingId: string }
  | null;

const statusOptions: MeetingStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];

interface StakeholderOption {
  id: string;
  name: string;
}

interface CreateMeetingDialogProps {
  locale: Locale;
  projectId: string;
  stakeholders: StakeholderOption[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateMeetingDialog({
  locale,
  projectId,
  stakeholders,
  onClose,
  onCreated,
}: CreateMeetingDialogProps) {
  const t = useTranslations("meetings.form");
  const tStatus = useTranslations("meetings.status");

  async function handleCreate(
    _prevState: CreateState,
    formData: FormData,
  ): Promise<CreateState> {
    const title = (formData.get("title") as string)?.trim();
    const agenda = (formData.get("agenda") as string)?.trim();
    const notes = (formData.get("notes") as string)?.trim();
    const summary = (formData.get("summary") as string)?.trim();
    const meetingDateRaw = (formData.get("meetingDate") as string) || undefined;
    // Convert datetime-local (naive) to ISO with timezone offset
    // so PostgreSQL stores the correct UTC instant
    const meetingDate = meetingDateRaw
      ? new Date(meetingDateRaw).toISOString()
      : undefined;
    const durationStr = formData.get("durationMinutes") as string;
    const durationMinutes = durationStr ? parseInt(durationStr, 10) : undefined;
    const location = (formData.get("location") as string)?.trim();
    const attendees = (formData.get("attendees") as string)?.trim();
    const status = (formData.get("status") as string) || "scheduled";
    const languagePreference = formData.get("languagePreference") as string;

    const relatedIds: string[] = [];
    formData.forEach((value, key) => {
      if (key.startsWith("stakeholder_") && value === "on") {
        relatedIds.push(key.replace("stakeholder_", ""));
      }
    });

    if (!title) {
      return { error: t("errors.titleRequired") };
    }

    const result = await createMeetingAction({
      title,
      agenda,
      notes,
      summary,
      meetingDate,
      durationMinutes: isNaN(durationMinutes ?? NaN) ? undefined : durationMinutes,
      location,
      attendees,
      status,
      linkedStakeholderIds: relatedIds,
      projectId,
      locale: languagePreference,
    });

    if (result.error) {
      const errorMap: Record<string, string> = {
        titleRequired: t("errors.titleRequired"),
        titleTooLong: t("errors.titleTooLong"),
        agendaTooLong: t("errors.agendaTooLong"),
        summaryTooLong: t("errors.summaryTooLong"),
        notesTooLong: t("errors.notesTooLong"),
        attendeesTooLong: t("errors.attendeesTooLong"),
        locationTooLong: t("errors.locationTooLong"),
        durationInvalid: t("errors.durationInvalid"),
      };
      return { error: errorMap[result.error] || t("errors.unexpected") };
    }

    onCreated();
    onClose();
    return { success: true as const, meetingId: result.meetingId ?? "" };
  }

  const [state, formAction, isPending] = useActionState(handleCreate, null);

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="m-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {state?.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {state.error}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="meeting-title" className="block text-sm font-medium text-foreground">
              {t("titleField")} <span className="text-red-500">*</span>
            </label>
            <input
              id="meeting-title"
              name="title"
              type="text"
              required
              maxLength={200}
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("titlePlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Date + Time + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="meeting-date" className="block text-sm font-medium text-foreground">
                {t("meetingDate")}
              </label>
              <input
                id="meeting-date"
                name="meetingDate"
                type="datetime-local"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="meeting-duration" className="block text-sm font-medium text-foreground">
                {t("duration")}
              </label>
              <input
                id="meeting-duration"
                name="durationMinutes"
                type="number"
                min={1}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("durationPlaceholder")}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Location + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="meeting-location" className="block text-sm font-medium text-foreground">
                {t("location")}
              </label>
              <input
                id="meeting-location"
                name="location"
                type="text"
                maxLength={200}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("locationPlaceholder")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="meeting-status" className="block text-sm font-medium text-foreground">
                {t("status")}
              </label>
              <select
                id="meeting-status"
                name="status"
                defaultValue="scheduled"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{tStatus(s)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <label htmlFor="meeting-attendees" className="block text-sm font-medium text-foreground">
              {t("attendees")}
            </label>
            <input
              id="meeting-attendees"
              name="attendees"
              type="text"
              maxLength={500}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("attendeesPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Agenda */}
          <div className="space-y-2">
            <label htmlFor="meeting-agenda" className="block text-sm font-medium text-foreground">
              {t("agenda")}
            </label>
            <textarea
              id="meeting-agenda"
              name="agenda"
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("agendaPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <label htmlFor="meeting-summary" className="block text-sm font-medium text-foreground">
              {t("summary")}
            </label>
            <textarea
              id="meeting-summary"
              name="summary"
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("summaryPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="meeting-notes" className="block text-sm font-medium text-foreground">
              {t("notes")}
            </label>
            <textarea
              id="meeting-notes"
              name="notes"
              rows={5}
              maxLength={5000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("notesPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Related stakeholders */}
          {stakeholders.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t("linkedStakeholders")}
              </label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-background p-2">
                {stakeholders.map((sh) => (
                  <label key={sh.id} className="flex items-center gap-2 px-2 py-1 text-sm text-foreground hover:bg-muted/50 rounded">
                    <input
                      name={`stakeholder_${sh.id}`}
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500/20"
                      disabled={isPending}
                    />
                    {sh.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Language preference */}
          <div className="space-y-2">
            <label htmlFor="meeting-language" className="block text-sm font-medium text-foreground">
              {t("language")}
            </label>
            <select
              id="meeting-language"
              name="languagePreference"
              defaultValue={locale}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "…" : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}