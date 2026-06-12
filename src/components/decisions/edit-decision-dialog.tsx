"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2 } from "lucide-react";
import { updateDecisionAction } from "@/app/[locale]/(app)/projects/[projectId]/decisions/actions";
import type { Decision, DecisionStatus, DecisionSourceType, ImpactArea, Locale } from "@/types/database";

type EditState =
  | { error: string; success?: undefined }
  | { error?: undefined; success: true }
  | null;

const statusOptions: DecisionStatus[] = ["proposed", "accepted", "rejected", "deferred", "revoked"];
const sourceTypeOptions: DecisionSourceType[] = ["meeting", "communication", "document", "manual", "other"];
const impactAreaOptions: ImpactArea[] = ["scope", "schedule", "budget", "risk", "quality", "communication", "document", "other"];

interface StakeholderOption {
  id: string;
  name: string;
}

interface EditDecisionDialogProps {
  decision: Decision;
  locale: Locale;
  projectId: string;
  stakeholders: StakeholderOption[];
  linkedStakeholderIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditDecisionDialog({
  decision,
  locale,
  projectId,
  stakeholders,
  linkedStakeholderIds,
  onClose,
  onSaved,
}: EditDecisionDialogProps) {
  const t = useTranslations("decisions.form");
  const tStatus = useTranslations("decisions.status");
  const tSourceType = useTranslations("decisions.sourceType");
  const tImpactArea = useTranslations("decisions.impactArea");

  async function handleUpdate(
    _prevState: EditState,
    formData: FormData,
  ): Promise<EditState> {
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const rationale = (formData.get("rationale") as string)?.trim();
    const decisionMaker = (formData.get("decisionMaker") as string)?.trim();
    const decisionDate = (formData.get("decisionDate") as string) || undefined;
    const sourceType = (formData.get("sourceType") as string) || undefined;
    const sourceRecordId = (formData.get("sourceRecordId") as string) || undefined;
    const impactArea = (formData.get("impactArea") as string) || undefined;
    const evidenceUrl = (formData.get("evidenceUrl") as string)?.trim();
    const status = (formData.get("status") as string) || "proposed";
    const languagePreference = formData.get("languagePreference") as string;

    const selectedIds: string[] = [];
    formData.forEach((value, key) => {
      if (key.startsWith("stakeholder_") && value === "on") {
        selectedIds.push(key.replace("stakeholder_", ""));
      }
    });

    if (!title) {
      return { error: t("errors.titleRequired") };
    }

    const result = await updateDecisionAction({
      decisionId: decision.id,
      title,
      description,
      rationale,
      decisionMaker,
      decisionDate,
      sourceType,
      sourceRecordId,
      impactArea,
      evidenceUrl,
      status,
      linkedStakeholderIds: selectedIds,
      projectId,
      locale: languagePreference,
    });

    if (result.error) {
      const errorMap: Record<string, string> = {
        titleRequired: t("errors.titleRequired"),
        titleTooLong: t("errors.titleTooLong"),
        descriptionTooLong: t("errors.descriptionTooLong"),
        rationaleTooLong: t("errors.rationaleTooLong"),
        decisionMakerTooLong: t("errors.decisionMakerTooLong"),
        evidenceUrlTooLong: t("errors.evidenceUrlTooLong"),
      };
      return { error: errorMap[result.error] || t("errors.unexpected") };
    }

    onSaved();
    onClose();
    return { success: true };
  }

  const [state, formAction, isPending] = useActionState(handleUpdate, null);

  const currentTitle = decision.title_i18n[locale] ?? decision.title_i18n.en ?? "";
  const currentDescription = decision.description_i18n[locale] ?? decision.description_i18n.en ?? "";
  const currentRationale = decision.rationale_i18n[locale] ?? decision.rationale_i18n.en ?? "";

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="m-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("edit")}</h2>
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
            <label htmlFor="edit-decision-title" className="block text-sm font-medium text-foreground">
              {t("titleField")} <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-decision-title"
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

          {/* Decision Date + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-decision-date" className="block text-sm font-medium text-foreground">
                {t("decisionDate")}
              </label>
              <input
                id="edit-decision-date"
                name="decisionDate"
                type="date"
                defaultValue={decision.decision_date?.split("T")[0] ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-decision-status" className="block text-sm font-medium text-foreground">
                {t("status")}
              </label>
              <select
                id="edit-decision-status"
                name="status"
                defaultValue={decision.status}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{tStatus(s)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Decision Maker + Impact Area */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-decision-maker" className="block text-sm font-medium text-foreground">
                {t("decisionMaker")}
              </label>
              <input
                id="edit-decision-maker"
                name="decisionMaker"
                type="text"
                maxLength={200}
                defaultValue={decision.decision_maker ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("decisionMakerPlaceholder")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-decision-impact" className="block text-sm font-medium text-foreground">
                {t("impactArea")}
              </label>
              <select
                id="edit-decision-impact"
                name="impactArea"
                defaultValue={decision.impact_area ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                <option value="">—</option>
                {impactAreaOptions.map((ia) => (
                  <option key={ia} value={ia}>{tImpactArea(ia)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Source Type + Source Record ID */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-decision-source-type" className="block text-sm font-medium text-foreground">
                {t("sourceType")}
              </label>
              <select
                id="edit-decision-source-type"
                name="sourceType"
                defaultValue={decision.source_type ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                <option value="">—</option>
                {sourceTypeOptions.map((st) => (
                  <option key={st} value={st}>{tSourceType(st)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-decision-source-record" className="block text-sm font-medium text-foreground">
                {t("sourceRecordId")}
              </label>
              <input
                id="edit-decision-source-record"
                name="sourceRecordId"
                type="text"
                defaultValue={decision.source_record_id ?? ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={t("sourceRecordIdPlaceholder")}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Evidence URL */}
          <div className="space-y-2">
            <label htmlFor="edit-decision-evidence" className="block text-sm font-medium text-foreground">
              {t("evidenceUrl")}
            </label>
            <input
              id="edit-decision-evidence"
              name="evidenceUrl"
              type="url"
              maxLength={500}
              defaultValue={decision.evidence_url ?? ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t("evidenceUrlPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="edit-decision-description" className="block text-sm font-medium text-foreground">
              {t("description")}
            </label>
            <textarea
              id="edit-decision-description"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={currentDescription}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("descriptionPlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Rationale */}
          <div className="space-y-2">
            <label htmlFor="edit-decision-rationale" className="block text-sm font-medium text-foreground">
              {t("rationale")}
            </label>
            <textarea
              id="edit-decision-rationale"
              name="rationale"
              rows={4}
              maxLength={5000}
              defaultValue={currentRationale}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t("rationalePlaceholder")}
              disabled={isPending}
            />
          </div>

          {/* Linked stakeholders */}
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
                      defaultChecked={linkedStakeholderIds.includes(sh.id)}
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
            <label htmlFor="edit-decision-language" className="block text-sm font-medium text-foreground">
              {t("language")}
            </label>
            <select
              id="edit-decision-language"
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