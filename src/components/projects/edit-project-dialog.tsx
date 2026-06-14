"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { updateProjectAction } from "@/app/[locale]/(app)/projects/actions";
import type { ProjectStatus, ProjectType } from "@/types/database";
import type { Locale } from "@/types/database";

type EditState =
  | { error: string; success?: undefined }
  | { error?: undefined; success: true }
  | null;

interface EditProjectDialogProps {
  projectId: string;
  locale: Locale;
  name: string;
  description: string;
  status: ProjectStatus;
  projectType: ProjectType;
  startDate: string | null;
  targetEndDate: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProjectDialog({
  projectId,
  locale,
  name,
  description,
  status,
  projectType,
  startDate,
  targetEndDate,
  onClose,
  onSaved,
}: EditProjectDialogProps) {
  const t = useTranslations("projects.form");
  const tStatus = useTranslations("projects.status");
  const router = useRouter();

  // Convert ISO dates to datetime-local format for the input
  const toDatetimeLocal = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  async function handleUpdate(
    _prevState: EditState,
    formData: FormData,
  ): Promise<EditState> {
    const nameVal = (formData.get("name") as string)?.trim();
    const descVal = (formData.get("description") as string)?.trim() ?? "";
    const statusVal = formData.get("status") as string;
    const projectTypeVal = formData.get("projectType") as string;
    const startDateRaw = formData.get("startDate") as string;
    const targetEndDateRaw = formData.get("targetEndDate") as string;

    if (!nameVal) {
      return { error: t("errors.nameRequired") };
    }

    const result = await updateProjectAction({
      projectId,
      name: nameVal,
      description: descVal,
      status: statusVal,
      projectType: projectTypeVal,
      startDate: startDateRaw ? new Date(startDateRaw).toISOString() : undefined,
      targetEndDate: targetEndDateRaw ? new Date(targetEndDateRaw).toISOString() : undefined,
      locale,
    });

    if (result.error) {
      return { error: t("errors.unexpected") };
    }

    onSaved();
    router.refresh();
    return { success: true };
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
          {/* Project Name */}
          <div className="space-y-2">
            <label htmlFor="edit-project-name" className="block text-sm font-medium text-foreground">
              {t("name")}
            </label>
            <input
              id="edit-project-name"
              name="name"
              type="text"
              required
              maxLength={200}
              autoFocus
              defaultValue={name}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("namePlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="edit-project-description" className="block text-sm font-medium text-foreground">
              {t("description")}
            </label>
            <textarea
              id="edit-project-description"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={description}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("descriptionPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label htmlFor="edit-project-status" className="block text-sm font-medium text-foreground">
              {t("status")}
            </label>
            <select
              id="edit-project-status"
              name="status"
              defaultValue={status}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            >
              <option value="planning">{tStatus("planning")}</option>
              <option value="active">{tStatus("active")}</option>
              <option value="on_hold">{tStatus("on_hold")}</option>
              <option value="completed">{tStatus("completed")}</option>
              <option value="cancelled">{tStatus("cancelled")}</option>
            </select>
          </div>

          {/* Project Type — drives which modules/tabs are visible (e.g. Drawing Intelligence) */}
          <div className="space-y-2">
            <label htmlFor="edit-project-type" className="block text-sm font-medium text-foreground">
              {t("projectType")}
            </label>
            <select
              id="edit-project-type"
              name="projectType"
              defaultValue={projectType}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            >
              <option value="general">{t("types.general")}</option>
              <option value="software_development">{t("types.software_development")}</option>
              <option value="data_center_construction">{t("types.data_center_construction")}</option>
              <option value="residential_construction">{t("types.residential_construction")}</option>
              <option value="commercial_construction">{t("types.commercial_construction")}</option>
              <option value="infrastructure">{t("types.infrastructure")}</option>
              <option value="industrial">{t("types.industrial")}</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <label htmlFor="edit-project-start" className="block text-sm font-medium text-foreground">
              {t("startDate")}
            </label>
            <input
              id="edit-project-start"
              name="startDate"
              type="datetime-local"
              defaultValue={toDatetimeLocal(startDate)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            />
          </div>

          {/* Target End Date */}
          <div className="space-y-2">
            <label htmlFor="edit-project-end" className="block text-sm font-medium text-foreground">
              {t("targetEndDate")}
            </label>
            <input
              id="edit-project-end"
              name="targetEndDate"
              type="datetime-local"
              defaultValue={toDatetimeLocal(targetEndDate)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            />
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