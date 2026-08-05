"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { localizedHref } from "@/i18n/href";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import {
  createProjectAction,
  loadGovernanceUnitsAction,
  loadProjectCreationScopeAction,
} from "@/app/[locale]/(app)/projects/actions";
import { getI18nValue, type I18nField, type Locale } from "@/types/database";

type CreateState =
  | { error: string; success?: undefined; projectId?: undefined }
  | { error?: undefined; success: true; projectId: string }
  | null;

interface CreateProjectDialogProps {
  locale: Locale;
  onClose: () => void;
}

type ScopeState =
  | "ACTIVE_ORGANIZATION"
  | "ORGANIZATION_SELECTION_REQUIRED"
  | "NO_ACTIVE_ORGANIZATION";

type OrganizationOption = { id: string; slug: string; name: unknown };
type GovernanceUnitOption = { id: string; name: string; code: string; isDefault: boolean };

export function CreateProjectDialog({ locale, onClose }: CreateProjectDialogProps) {
  const t = useTranslations("projects.form");
  const tStatus = useTranslations("projects");
  const router = useRouter();
  const [isOpen] = useState(true);

  // Creation scope: which organizations the server would actually accept, and
  // which PMO unit inside the chosen one will own the project. Both are decided
  // server-side; the form only mirrors what the command already allows.
  const [scopeState, setScopeState] = useState<ScopeState | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [units, setUnits] = useState<GovernanceUnitOption[]>([]);
  const [governanceUnitId, setGovernanceUnitId] = useState("");
  const [unitsLoading, setUnitsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadProjectCreationScopeAction().then((scope) => {
      if (cancelled) return;
      setScopeState(scope.state);
      setOrganizations(scope.organizations);
      // Exactly one creatable organization is not a choice — take it and keep
      // the dropdown out of the form.
      setOrganizationId(
        scope.state === "ACTIVE_ORGANIZATION" ? (scope.organizations[0]?.id ?? "") : "",
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // With no organization there is nothing to load, and nothing to clear:
    // `units` is only ever read alongside a chosen organization, and the next
    // successful load replaces it wholesale. Clearing state synchronously here
    // would be an extra render and a lint error, for no observable difference.
    if (!organizationId) return;

    let cancelled = false;
    void (async () => {
      setUnitsLoading(true);
      const result = await loadGovernanceUnitsAction(organizationId);
      if (cancelled) return;
      setUnits(result.units);
      // One unit is not a choice. Several: honour the system default if there
      // is one, otherwise make the user say which PMO owns this.
      const preselected =
        result.units.length === 1
          ? result.units[0]
          : result.units.find((u) => u.isDefault);
      setGovernanceUnitId(preselected?.id ?? "");
      setUnitsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const orgLabel = useCallback(
    (org: OrganizationOption) =>
      getI18nValue(org.name as I18nField | null | undefined, locale, org.slug) || org.slug,
    [locale],
  );

  const noOrganization = scopeState === "NO_ACTIVE_ORGANIZATION";
  const noUnits = Boolean(organizationId) && !unitsLoading && units.length === 0;
  const scopeReady = Boolean(organizationId) && Boolean(governanceUnitId);

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

    if (!organizationId) {
      return { error: t("errors.no_active_organization") };
    }

    if (!governanceUnitId) {
      return { error: t("errors.governance_unit_required") };
    }

    const result = await createProjectAction({
      name,
      description,
      status,
      projectType,
      useTemplate,
      defaultLanguage,
      locale,
      organizationId,
      governanceUnitId,
    });

    if (result.error) {
      const errorKey = result.error as string;
      if (errorKey === "slug_exists") return { error: t("errors.slugExists") };
      if (errorKey === "not_authorized") return { error: t("errors.not_authorized") };
      if (errorKey === "governance_unit_required")
        return { error: t("errors.governance_unit_required") };
      if (errorKey === "no_active_organization")
        return { error: t("errors.no_active_organization") };
      return { error: t("errors.unexpected") };
    }

    // Close dialog and navigate to the Project Charter — the official first
    // step. The user defines the project foundation before real execution.
    onClose();
    if (result.projectId) {
      router.push(localizedHref(locale, `/projects/${result.projectId}/charter?onboard=true`));
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

        {noOrganization && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t("noActiveOrganization")}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          {/* Organization — only shown when there is an actual choice to make */}
          {scopeState === "ORGANIZATION_SELECTION_REQUIRED" && (
            <div className="space-y-2">
              <label
                htmlFor="project-organization"
                className="block text-sm font-medium text-foreground"
              >
                {t("organization")}
              </label>
              <select
                id="project-organization"
                name="organizationId"
                required
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                <option value="">{t("organizationPlaceholder")}</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {orgLabel(org)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Owning PMO */}
          {organizationId && (
            <div className="space-y-2">
              <label
                htmlFor="project-governance-unit"
                className="block text-sm font-medium text-foreground"
              >
                {t("governanceUnit")}
              </label>
              {noUnits ? (
                <p className="text-sm text-muted-foreground">{t("noGovernanceUnit")}</p>
              ) : (
                <select
                  id="project-governance-unit"
                  name="governanceUnitId"
                  required
                  value={governanceUnitId}
                  onChange={(e) => setGovernanceUnitId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  disabled={isPending || unitsLoading}
                >
                  <option value="">{t("governanceUnitPlaceholder")}</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

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
              <option value="ai_native_execution">{t("types.ai_native_execution")}</option>
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
            href={localizedHref(locale, `/import`)}
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
              disabled={isPending || !scopeReady}
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