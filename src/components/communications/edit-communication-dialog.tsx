"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2 } from "lucide-react";
import { updateCommunicationAction } from "@/app/[locale]/(app)/projects/[projectId]/communications/actions";
import type { CommunicationItem, CommunicationSourceType, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";

type EditState =
  | { error: string; success?: undefined }
  | { error?: undefined; success: true }
  | null;

const sourceTypeOptions: CommunicationSourceType[] = [
  "email", "meeting", "phone", "teams", "slack",
  "in_person", "document", "manual_note", "other",
];

interface StakeholderOption {
  id: string;
  name: string;
}

interface EditCommunicationDialogProps {
  communication: CommunicationItem;
  locale: Locale;
  projectId: string;
  stakeholders: StakeholderOption[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditCommunicationDialog({
  communication,
  locale,
  projectId,
  stakeholders,
  onClose,
  onSaved,
}: EditCommunicationDialogProps) {
  const t = useTranslations("communications.form");
  const tSource = useTranslations("communications.sourceType");
  const tStatus = useTranslations("communications.status");

  const currentTitle = getI18nValue(communication.title_i18n, locale);
  const currentSummary = getI18nValue(communication.summary_i18n, locale);
  const currentContent = getI18nValue(communication.content_i18n, locale);

  // Format date for input[type=date] (YYYY-MM-DD)
  const dateValue = communication.item_date
    ? new Date(communication.item_date).toISOString().split("T")[0]
    : "";

  async function handleUpdate(
    _prevState: EditState,
    formData: FormData,
  ): Promise<EditState> {
    const title = (formData.get("title") as string)?.trim();
    const summary = (formData.get("summary") as string)?.trim();
    const content = (formData.get("content") as string)?.trim();
    const sourceType = (formData.get("sourceType") as string) || undefined;
    const itemDate = (formData.get("itemDate") as string) || undefined;
    const sender = (formData.get("sender") as string)?.trim();
    const recipients = (formData.get("recipients") as string)?.trim();
    const requiresFollowUp = formData.get("requiresFollowUp") === "on";
    const status = (formData.get("status") as string) || "logged";
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

    const result = await updateCommunicationAction({
      communicationId: communication.id,
      title,
      summary,
      content,
      sourceType: sourceType as CommunicationSourceType | undefined,
      itemDate,
      sender,
      recipients,
      requiresFollowUp,
      status,
      relatedStakeholderIds: relatedIds,
      projectId,
      locale: languagePreference,
    });

    if (result.error) {
      const errorKey = result.error as string;
      const errorMap: Record<string, string> = {
        titleRequired: t("errors.titleRequired"),
        titleTooLong: t("errors.titleTooLong"),
        summaryTooLong: t("errors.summaryTooLong"),
        contentTooLong: t("errors.contentTooLong"),
        senderTooLong: t("errors.senderTooLong"),
        recipientsTooLong: t("errors.recipientsTooLong"),
      };
      return { error: errorMap[errorKey] || t("errors.unexpected") };
    }

    onSaved();
    onClose();
    return { success: true as const };
  }

  const [state, formAction, isPending] = useActionState(handleUpdate, null);

  const selectedStakeholderIds = communication.related_stakeholder_ids ?? [];

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="m-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("editTitle")}</h2>
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
            <label htmlFor="edit-comm-title" className="block text-sm font-medium text-foreground">
              {t("titleField")} <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-comm-title"
              name="title"
              type="text"
              required
              maxLength={200}
              defaultValue={currentTitle}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("titlePlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Source type + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-comm-source-type" className="block text-sm font-medium text-foreground">
                {t("sourceType")}
              </label>
              <select
                id="edit-comm-source-type"
                name="sourceType"
                defaultValue={communication.source_type ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                <option value="">—</option>
                {sourceTypeOptions.map((st) => (
                  <option key={st} value={st}>{tSource(st)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-comm-date" className="block text-sm font-medium text-foreground">
                {t("date")}
              </label>
              <input
                id="edit-comm-date"
                name="itemDate"
                type="date"
                defaultValue={dateValue}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Sender + Recipients */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-comm-sender" className="block text-sm font-medium text-foreground">
                {t("sender")}
              </label>
              <input
                id="edit-comm-sender"
                name="sender"
                type="text"
                maxLength={200}
                defaultValue={communication.sender ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("senderPlaceholder")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-comm-recipients" className="block text-sm font-medium text-foreground">
                {t("recipients")}
              </label>
              <input
                id="edit-comm-recipients"
                name="recipients"
                type="text"
                maxLength={500}
                defaultValue={communication.recipients ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("recipientsPlaceholder")}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <label htmlFor="edit-comm-summary" className="block text-sm font-medium text-foreground">
              {t("summary")}
            </label>
            <textarea
              id="edit-comm-summary"
              name="summary"
              rows={2}
              maxLength={2000}
              defaultValue={currentSummary}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("summaryPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Notes / Content */}
          <div className="space-y-2">
            <label htmlFor="edit-comm-content" className="block text-sm font-medium text-foreground">
              {t("content")}
            </label>
            <textarea
              id="edit-comm-content"
              name="content"
              rows={4}
              maxLength={5000}
              defaultValue={currentContent}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("contentPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Status + Requires follow-up */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-comm-status" className="block text-sm font-medium text-foreground">
                {t("status")}
              </label>
              <select
                id="edit-comm-status"
                name="status"
                defaultValue={communication.status}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                <option value="draft">{tStatus("draft")}</option>
                <option value="logged">{tStatus("logged")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t("requiresFollowUp")}
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 pt-1">
                <input
                  name="requiresFollowUp"
                  type="checkbox"
                  defaultChecked={communication.requires_follow_up}
                  className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500/20"
                  disabled={isPending}
                />
              </label>
            </div>
          </div>

          {/* Related stakeholders */}
          {stakeholders.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t("relatedStakeholders")}
              </label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-background p-2">
                {stakeholders.map((sh) => (
                  <label key={sh.id} className="flex items-center gap-2 px-2 py-1 text-sm text-foreground hover:bg-muted/50 rounded">
                    <input
                      name={`stakeholder_${sh.id}`}
                      type="checkbox"
                      defaultChecked={selectedStakeholderIds.includes(sh.id)}
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
            <label htmlFor="edit-comm-language" className="block text-sm font-medium text-foreground">
              {t("language")}
            </label>
            <select
              id="edit-comm-language"
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
              {isPending ? "…" : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}