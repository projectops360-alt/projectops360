"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Lock, Info } from "lucide-react";
import {
  createMilestoneAction,
  updateMilestoneAction,
} from "@/app/[locale]/(app)/projects/[projectId]/roadmap/actions";
import { MILESTONE_STATUS_OPTIONS } from "@/lib/roadmap/status-mappings";
import type { Milestone, MilestoneStatus, Locale } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

type MilestoneFormMode = "create" | "edit";

type FormState =
  | { error: string; success?: undefined }
  | { error?: undefined; success: true }
  | null;

const ICON_OPTIONS = ["setup", "shield_database", "users", "notebook", "link", "sparkles", "chart", "loop", "check_circle", "rocket"] as const;

interface MilestoneFormTranslations {
  createTitle: string;
  editTitle: string;
  cancel: string;
  save: string;
  creating: string;
  saving: string;
  errors: Record<string, string>;
  statusLabels: Record<string, string>;
  iconLabels: Record<string, string>;
  lockStatus: string;
  lockStatusDescription: string;
  computedStatusNote: string;
  fields: {
    title: string;
    titlePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    status: string;
    startDate: string;
    targetDate: string;
    iconKey: string;
  };
}

interface MilestoneFormDialogProps {
  mode: MilestoneFormMode;
  projectId: string;
  locale: Locale;
  milestones: Milestone[]; // for computing order_index
  milestone?: Milestone; // required for edit mode
  onClose: () => void;
  onSaved: () => void;
  translations: MilestoneFormTranslations;
}

// ── Component ────────────────────────────────────────────────────────────────────

export function MilestoneFormDialog({
  mode,
  projectId,
  locale,
  milestones,
  milestone,
  onClose,
  onSaved,
  translations: t,
}: MilestoneFormDialogProps) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [lockStatus, setLockStatus] = useState(milestone?.status_override_enabled ?? false);
  const [overrideValue, setOverrideValue] = useState<MilestoneStatus>(milestone?.status_override_value ?? milestone?.status ?? "planned");

  async function handleSubmit(_prevState: FormState, formData: FormData): Promise<FormState> {
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const status = lockStatus ? overrideValue : ((formData.get("status") as string) || "planned");
    const startDate = (formData.get("start_date") as string) || "";
    const targetDate = (formData.get("target_date") as string) || "";
    const iconKey = (formData.get("icon_key") as string) || "setup";

    if (!title) {
      return { error: t.errors.titleRequired || "Title is required" };
    }

    const orderIndex = isEdit
      ? milestone?.order_index ?? 0
      : milestones.length;

    if (isEdit && milestone) {
      const result = await updateMilestoneAction({
        milestoneId: milestone.id,
        title,
        description,
        status,
        start_date: startDate,
        target_date: targetDate,
        icon_key: iconKey,
        order_index: orderIndex,
        status_override_enabled: lockStatus,
        status_override_value: lockStatus ? overrideValue : null,
        projectId,
      });
      if (result.error) {
        return { error: t.errors[result.error] || t.errors.unexpected || "Error" };
      }
    } else {
      const result = await createMilestoneAction({
        title,
        description,
        status,
        start_date: startDate,
        target_date: targetDate,
        icon_key: iconKey,
        order_index: orderIndex,
        projectId,
      });
      if (result.error) {
        return { error: t.errors[result.error] || t.errors.unexpected || "Error" };
      }
    }

    onSaved();
    onClose();
    return { success: true };
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? t.editTitle : t.createTitle}
          </h2>
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
            <label htmlFor="milestone-title" className="block text-sm font-medium text-foreground">
              {t.fields.title} <span className="text-red-500">*</span>
            </label>
            <input
              id="milestone-title"
              name="title"
              type="text"
              required
              maxLength={200}
              autoFocus
              defaultValue={isEdit ? milestone?.title : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              placeholder={t.fields.titlePlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Status + Lock Override */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="milestone-status" className="block text-sm font-medium text-foreground">
                {t.fields.status}
              </label>
              <select
                id="milestone-status"
                name="status"
                defaultValue={isEdit ? milestone?.status : "planned"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending || lockStatus}
              >
                {MILESTONE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{t.statusLabels[s]}</option>
                ))}
              </select>
              {/* Lock status override toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={lockStatus}
                  onChange={(e) => setLockStatus(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
                  disabled={isPending}
                />
                <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                  <Lock className="h-3 w-3" />
                  {t.lockStatus}
                </span>
              </label>
            </div>
            {/* Override value dropdown (shown when lock is enabled) */}
            <div className="space-y-2">
              <label htmlFor="milestone-override-status" className="block text-sm font-medium text-foreground">
                {lockStatus ? t.fields.status : t.fields.iconKey}
              </label>
              {lockStatus ? (
                <select
                  id="milestone-override-status"
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value as MilestoneStatus)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  disabled={isPending}
                >
                  {MILESTONE_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{t.statusLabels[s]}</option>
                  ))}
                </select>
              ) : (
                <select
                  id="milestone-icon"
                  name="icon_key"
                  defaultValue={isEdit ? milestone?.icon_key ?? "setup" : "setup"}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  disabled={isPending}
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>{t.iconLabels[icon]}</option>
                  ))}
                </select>
              )}
              {lockStatus && (
                <p className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  {t.lockStatusDescription}
                </p>
              )}
              {!lockStatus && !isEdit && (
                <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  {t.computedStatusNote}
                </p>
              )}
            </div>
          </div>

          {/* Icon key (shown when lock is enabled, since grid col 2 is used for override) */}
          {lockStatus && (
            <div className="space-y-2">
              <label htmlFor="milestone-icon" className="block text-sm font-medium text-foreground">
                {t.fields.iconKey}
              </label>
              <select
                id="milestone-icon"
                name="icon_key"
                defaultValue={isEdit ? milestone?.icon_key ?? "setup" : "setup"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              >
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>{t.iconLabels[icon]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Start Date + Target Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="milestone-start" className="block text-sm font-medium text-foreground">
                {t.fields.startDate}
              </label>
              <input
                id="milestone-start"
                name="start_date"
                type="date"
                defaultValue={isEdit ? milestone?.start_date ?? "" : ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="milestone-target" className="block text-sm font-medium text-foreground">
                {t.fields.targetDate}
              </label>
              <input
                id="milestone-target"
                name="target_date"
                type="date"
                defaultValue={isEdit ? milestone?.target_date ?? "" : ""}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="milestone-description" className="block text-sm font-medium text-foreground">
              {t.fields.description}
            </label>
            <textarea
              id="milestone-description"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={isEdit ? milestone?.description ?? "" : ""}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t.fields.descriptionPlaceholder}
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
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? (isEdit ? t.saving : t.creating) : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}