"use client";

// ============================================================================
// ProjectOps360° — Task Execution Map · Subtask create/edit dialog
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { Subtask, SubtaskStatus, SubtaskPriority } from "@/lib/subtasks/types";
import { SUBTASK_STATUSES, SUBTASK_PRIORITIES } from "@/lib/subtasks/types";
import { createSubtaskAction, updateSubtaskAction } from "@/lib/subtasks/actions";
import { EntityAttachmentsSection } from "@/components/attachments/entity-attachments-section";

export interface SubtaskFormDialogProps {
  projectId: string;
  taskId: string;
  /** Null = create. */
  subtask: Subtask | null;
  owners: { id: string; name: string }[];
  onClose: () => void;
}

export function SubtaskFormDialog({ projectId, taskId, subtask, owners, onClose }: SubtaskFormDialogProps) {
  const t = useTranslations("taskExecutionMap");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(subtask?.title ?? "");
  const [description, setDescription] = useState(subtask?.description ?? "");
  const [status, setStatus] = useState<SubtaskStatus>(subtask?.status ?? "not_started");
  const [priority, setPriority] = useState<SubtaskPriority>(subtask?.priority ?? "p2");
  const [ownerId, setOwnerId] = useState<string>(subtask?.owner_id ?? "");
  const [dueDate, setDueDate] = useState(subtask?.due_date ?? "");
  const [estimatedHours, setEstimatedHours] = useState(subtask?.estimated_hours?.toString() ?? "");
  const [actualHours, setActualHours] = useState(subtask?.actual_hours?.toString() ?? "");
  const [weight, setWeight] = useState(subtask?.weight?.toString() ?? "");
  const [isCritical, setIsCritical] = useState(subtask?.is_critical ?? false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const base = {
        projectId,
        title: title.trim(),
        description,
        status,
        priority,
        owner_id: ownerId || null,
        due_date: dueDate || (subtask ? null : undefined),
        estimated_hours: estimatedHours === "" ? null : Number(estimatedHours),
        weight: weight === "" ? null : Number(weight),
        is_critical: isCritical,
      };
      const res = subtask
        ? await updateSubtaskAction({
            ...base,
            subtaskId: subtask.id,
            actual_hours: actualHours === "" ? null : Number(actualHours),
          })
        : await createSubtaskAction({ ...base, taskId });
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <form
        data-testid="tem-subtask-form"
        onSubmit={submit}
        className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {subtask ? t("form.editTitle") : t("form.createTitle")}
          </h3>
          <button type="button" onClick={onClose} aria-label={t("panel.close")} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="tem-f-title" className="text-xs font-medium text-foreground">
            {t("form.title")} *
          </label>
          <input
            id="tem-f-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            maxLength={300}
          />
        </div>
        <div>
          <label htmlFor="tem-f-desc" className="text-xs font-medium text-foreground">
            {t("form.description")}
          </label>
          <textarea
            id="tem-f-desc"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="tem-f-status" className="text-xs font-medium text-foreground">
              {t("table.status")}
            </label>
            <select
              id="tem-f-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SubtaskStatus)}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            >
              {SUBTASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tem-f-priority" className="text-xs font-medium text-foreground">
              {t("form.priority")}
            </label>
            <select
              id="tem-f-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as SubtaskPriority)}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            >
              {SUBTASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tem-f-owner" className="text-xs font-medium text-foreground">
              {t("table.owner")}
            </label>
            <select
              id="tem-f-owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            >
              <option value="">{t("unassigned")}</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tem-f-due" className="text-xs font-medium text-foreground">
              {t("node.dueDate")}
            </label>
            <input
              id="tem-f-due"
              type="date"
              value={dueDate ?? ""}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tem-f-est" className="text-xs font-medium text-foreground">
              {t("form.estimatedHours")}
            </label>
            <input
              id="tem-f-est"
              type="number"
              min={0}
              step={0.5}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            />
          </div>
          {subtask && (
            <div>
              <label htmlFor="tem-f-act" className="text-xs font-medium text-foreground">
                {t("form.actualHours")}
              </label>
              <input
                id="tem-f-act"
                type="number"
                min={0}
                step={0.5}
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
              />
            </div>
          )}
          <div>
            <label htmlFor="tem-f-weight" className="text-xs font-medium text-foreground">
              {t("form.weight")}
            </label>
            <input
              id="tem-f-weight"
              type="number"
              min={0}
              step={0.5}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background p-1.5 text-sm"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={isCritical} onChange={(e) => setIsCritical(e.target.checked)} />
          {t("form.isCritical")}
        </label>

        {/* Attachments (TASK-SUBTASK-FILE-ATTACHMENTS) — edit mode only (needs a
            persisted subtask id). Runs through its own server actions, so it is
            independent of this form's submit. */}
        {subtask && (
          <div className="rounded-md border border-border px-3 py-2">
            <EntityAttachmentsSection projectId={projectId} subtaskId={subtask.id} />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {t("form.cancel")}
          </button>
          <button
            type="submit"
            disabled={pending || title.trim().length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t("form.saving") : t("form.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
