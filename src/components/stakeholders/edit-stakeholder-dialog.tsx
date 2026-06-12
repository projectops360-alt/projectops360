"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2 } from "lucide-react";
import { updateStakeholderAction } from "@/app/[locale]/(app)/projects/[projectId]/stakeholders/actions";
import type { Stakeholder, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";

type EditState =
  | { error: string; success?: undefined }
  | { error?: undefined; success: true }
  | null;

interface EditStakeholderDialogProps {
  stakeholder: Stakeholder;
  locale: Locale;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditStakeholderDialog({
  stakeholder,
  locale,
  projectId,
  onClose,
  onSaved,
}: EditStakeholderDialogProps) {
  const t = useTranslations("stakeholders.form");
  const tInfluence = useTranslations("stakeholders.influence");
  const tInterest = useTranslations("stakeholders.interest");

  const currentRole = getI18nValue(stakeholder.role_i18n, locale);
  const currentNotes = getI18nValue(stakeholder.notes_i18n, locale);

  async function handleUpdate(
    _prevState: EditState,
    formData: FormData,
  ): Promise<EditState> {
    const name = (formData.get("name") as string)?.trim();
    const role = (formData.get("role") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const influence = (formData.get("influence") as string) || undefined;
    const interest = (formData.get("interest") as string) || undefined;
    const notes = (formData.get("notes") as string)?.trim();
    const languagePreference = formData.get("languagePreference") as string;

    if (!name) {
      return { error: t("errors.nameRequired") };
    }

    const result = await updateStakeholderAction({
      stakeholderId: stakeholder.id,
      name,
      role,
      email: email || undefined,
      influence: influence as "high" | "medium" | "low" | undefined,
      interest: interest as "high" | "medium" | "low" | undefined,
      notes,
      languagePreference,
      projectId,
      locale,
    });

    if (result.error) {
      const errorKey = result.error as string;
      if (errorKey === "nameRequired") return { error: t("errors.nameRequired") };
      if (errorKey === "nameTooLong") return { error: t("errors.nameTooLong") };
      if (errorKey === "roleTooLong") return { error: t("errors.roleTooLong") };
      if (errorKey === "invalidEmail") return { error: t("errors.invalidEmail") };
      if (errorKey === "notesTooLong") return { error: t("errors.notesTooLong") };
      return { error: t("errors.unexpected") };
    }

    onSaved();
    onClose();
    return { success: true as const };
  }

  const [state, formAction, isPending] = useActionState(handleUpdate, null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
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
          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="edit-stakeholder-name" className="block text-sm font-medium text-foreground">
              {t("name")} <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-stakeholder-name"
              name="name"
              type="text"
              required
              maxLength={200}
              defaultValue={stakeholder.name}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label htmlFor="edit-stakeholder-role" className="block text-sm font-medium text-foreground">
              {t("role")}
            </label>
            <input
              id="edit-stakeholder-role"
              name="role"
              type="text"
              maxLength={200}
              defaultValue={currentRole}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("rolePlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="edit-stakeholder-email" className="block text-sm font-medium text-foreground">
              {t("email")}
            </label>
            <input
              id="edit-stakeholder-email"
              name="email"
              type="email"
              defaultValue={stakeholder.email ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("emailPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Influence & Interest side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-stakeholder-influence" className="block text-sm font-medium text-foreground">
                {t("influence")}
              </label>
              <select
                id="edit-stakeholder-influence"
                name="influence"
                defaultValue={stakeholder.influence ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                <option value="">—</option>
                <option value="high">{tInfluence("high")}</option>
                <option value="medium">{tInfluence("medium")}</option>
                <option value="low">{tInfluence("low")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-stakeholder-interest" className="block text-sm font-medium text-foreground">
                {t("interest")}
              </label>
              <select
                id="edit-stakeholder-interest"
                name="interest"
                defaultValue={stakeholder.interest ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                <option value="">—</option>
                <option value="high">{tInterest("high")}</option>
                <option value="medium">{tInterest("medium")}</option>
                <option value="low">{tInterest("low")}</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="edit-stakeholder-notes" className="block text-sm font-medium text-foreground">
              {t("notes")}
            </label>
            <textarea
              id="edit-stakeholder-notes"
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={currentNotes}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("notesPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Language Preference */}
          <div className="space-y-2">
            <label htmlFor="edit-stakeholder-language" className="block text-sm font-medium text-foreground">
              {t("language")}
            </label>
            <select
              id="edit-stakeholder-language"
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