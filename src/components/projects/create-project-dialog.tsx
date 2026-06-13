"use client";

import { useActionState, useState } from "react";
import { localizedHref } from "@/i18n/href";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { createProjectAction } from "@/app/[locale]/(app)/projects/actions";
import type { Locale } from "@/types/database";

type CreateState =
  | { error: string; success?: undefined; projectId?: undefined }
  | { error?: undefined; success: true; projectId: string }
  | null;

interface CreateProjectDialogProps {
  locale: Locale;
  onClose: () => void;
}

export function CreateProjectDialog({ locale, onClose }: CreateProjectDialogProps) {
  const t = useTranslations("projects.form");
  const tStatus = useTranslations("projects");
  const router = useRouter();
  const [isOpen] = useState(true);

  async function handleCreate(
    _prevState: CreateState,
    formData: FormData,
  ): Promise<CreateState> {
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() ?? "";
    const status = formData.get("status") as string;
    const projectType = formData.get("projectType") as string;
    const useTemplate = formData.get("useTemplate") === "on";
    const defaultLanguage = formData.get("defaultLanguage") as string;

    if (!name) {
      return { error: t("errors.nameRequired") };
    }

    const result = await createProjectAction({
      name,
      description,
      status,
      projectType,
      useTemplate,
      defaultLanguage,
      locale,
    });

    if (result.error) {
      const errorKey = result.error as string;
      if (errorKey === "slug_exists") return { error: t("errors.slugExists") };
      return { error: t("errors.unexpected") };
    }

    // Close dialog and navigate to the Execution Map with onboarding
    onClose();
    if (result.projectId) {
      router.push(localizedHref(locale, `/projects/${result.projectId}/execution-map?onboard=true`));
    }
    return { success: true as const, projectId: result.projectId ?? "" };
  }

  const [state, formAction, isPending] = useActionState(handleCreate, null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
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
          {/* Project Name */}
          <div className="space-y-2">
            <label htmlFor="project-name" className="block text-sm font-medium text-foreground">
              {t("name")}
            </label>
            <input
              id="project-name"
              name="name"
              type="text"
              required
              maxLength={200}
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("namePlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="project-description" className="block text-sm font-medium text-foreground">
              {t("description")}
            </label>
            <textarea
              id="project-description"
              name="description"
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("descriptionPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label htmlFor="project-status" className="block text-sm font-medium text-foreground">
              {t("status")}
            </label>
            <select
              id="project-status"
              name="status"
              defaultValue="planning"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            >
              <option value="planning">{tStatus("status.planning")}</option>
              <option value="active">{tStatus("status.active")}</option>
            </select>
          </div>

          {/* Project Type */}
          <div className="space-y-2">
            <label htmlFor="project-type" className="block text-sm font-medium text-foreground">
              {t("projectType")}
            </label>
            <select
              id="project-type"
              name="projectType"
              defaultValue="general"
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

          {/* Create from template */}
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="useTemplate"
              className="mt-0.5 h-4 w-4 rounded border-border accent-brand-600"
              disabled={isPending}
            />
            <span>{t("useTemplate")}</span>
          </label>

          {/* Default Language */}
          <div className="space-y-2">
            <label htmlFor="project-language" className="block text-sm font-medium text-foreground">
              {t("language")}
            </label>
            <select
              id="project-language"
              name="defaultLanguage"
              defaultValue={locale}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>

          {/* Import from file */}
          <a
            href={`/${locale}/import`}
            className="block text-sm text-brand-600 hover:underline dark:text-brand-400"
          >
            {t("importFromFile")}
          </a>

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