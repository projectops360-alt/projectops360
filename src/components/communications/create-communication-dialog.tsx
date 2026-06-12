"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2 } from "lucide-react";
import { createCommunicationAction } from "@/app/[locale]/(app)/projects/[projectId]/communications/actions";
import type { CommunicationSourceType, Locale } from "@/types/database";

type CreateState =
  | { error: string; success?: undefined; communicationId?: undefined }
  | { error?: undefined; success: true; communicationId: string }
  | null;

const sourceTypeOptions: CommunicationSourceType[] = [
  "email", "meeting", "phone", "teams", "slack",
  "in_person", "document", "manual_note", "other",
];

interface StakeholderOption {
  id: string;
  name: string;
}

interface CreateCommunicationDialogProps {
  locale: Locale;
  projectId: string;
  stakeholders: StakeholderOption[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCommunicationDialog({
  locale,
  projectId,
  stakeholders,
  onClose,
  onCreated,
}: CreateCommunicationDialogProps) {
  const t = useTranslations("communications.form");
  const tSource = useTranslations("communications.sourceType");
  const tStatus = useTranslations("communications.status");

  async function handleCreate(
    _prevState: CreateState,
    formData: FormData,
  ): Promise<CreateState> {
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

    // Collect related stakeholder IDs from checkboxes
    const relatedIds: string[] = [];
    formData.forEach((value, key) => {
      if (key.startsWith("stakeholder_") && value === "on") {
        relatedIds.push(key.replace("stakeholder_", ""));
      }
    });

    if (!title) {
      return { error: t("errors.titleRequired") };
    }

    const result = await createCommunicationAction({
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

    onCreated();
    onClose();
    return { success: true as const, communicationId: result.communicationId ?? "" };
  }

  const [state, formAction, isPending] = useActionState(handleCreate, null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
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
            <label htmlFor="comm-title" className="block text-sm font-medium text-foreground">
              {t("titleField")} <span className="text-red-500">*</span>
            </label>
            <input
              id="comm-title"
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

          {/* Source type + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="comm-source-type" className="block text-sm font-medium text-foreground">
                {t("sourceType")}
              </label>
              <select
                id="comm-source-type"
                name="sourceType"
                defaultValue=""
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
              <label htmlFor="comm-date" className="block text-sm font-medium text-foreground">
                {t("date")}
              </label>
              <input
                id="comm-date"
                name="itemDate"
                type="date"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Sender + Recipients */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="comm-sender" className="block text-sm font-medium text-foreground">
                {t("sender")}
              </label>
              <input
                id="comm-sender"
                name="sender"
                type="text"
                maxLength={200}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("senderPlaceholder")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="comm-recipients" className="block text-sm font-medium text-foreground">
                {t("recipients")}
              </label>
              <input
                id="comm-recipients"
                name="recipients"
                type="text"
                maxLength={500}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("recipientsPlaceholder")}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <label htmlFor="comm-summary" className="block text-sm font-medium text-foreground">
              {t("summary")}
            </label>
            <textarea
              id="comm-summary"
              name="summary"
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("summaryPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Notes / Content */}
          <div className="space-y-2">
            <label htmlFor="comm-content" className="block text-sm font-medium text-foreground">
              {t("content")}
            </label>
            <textarea
              id="comm-content"
              name="content"
              rows={4}
              maxLength={5000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("contentPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Status + Requires follow-up */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="comm-status" className="block text-sm font-medium text-foreground">
                {t("status")}
              </label>
              <select
                id="comm-status"
                name="status"
                defaultValue="logged"
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
            <label htmlFor="comm-language" className="block text-sm font-medium text-foreground">
              {t("language")}
            </label>
            <select
              id="comm-language"
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