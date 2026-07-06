"use client";

// ============================================================================
// ProjectOps360° — Task Execution Map · Right-side detail panel
// ============================================================================
// Opens when any node is clicked. Parent panel: full details, progress
// calculation method + breakdown, subtask summary, blockers, close gate, and
// Ask Isabella. Subtask panel: all fields + operational actions (complete,
// block with reason, unblock, reassign, due date, progress) wired to the
// audited server actions. RBAC is enforced server-side; the UI only hides
// what the role can never do.
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, Bot, CheckCircle2, Pencil, Trash2, Unlock, X } from "lucide-react";
import { askIsabella } from "@/lib/isabella/ask-isabella";
import type { Subtask } from "@/lib/subtasks/types";
import { computeParentProgress, deriveParentSignals, evaluateParentCloseGate } from "@/lib/subtasks/progress";
import type { ParentTaskInfo } from "@/lib/subtasks/map-model";
import {
  completeSubtaskAction,
  blockSubtaskAction,
  unblockSubtaskAction,
  deleteSubtaskAction,
  updateSubtaskAction,
} from "@/lib/subtasks/actions";
import { EntityAttachmentsSection } from "@/components/attachments/entity-attachments-section";
import { STATUS_ICONS, STATUS_BADGE_CLASS } from "./map-nodes";

export type PanelSelection =
  | { kind: "parent" }
  | { kind: "subtask"; subtaskId: string }
  | { kind: "blocker"; subtaskId: string };

export interface SubtaskDetailPanelProps {
  projectId: string;
  parent: ParentTaskInfo;
  subtasks: Subtask[];
  ownerNames: Record<string, string>;
  selection: PanelSelection;
  canManage: boolean;
  /** Whether the current role may upload attachments (viewers cannot). */
  canUpload?: boolean;
  onClose: () => void;
  onEdit: (subtask: Subtask) => void;
  asOf: Date;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/50 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function SubtaskDetailPanel(props: SubtaskDetailPanelProps) {
  const t = useTranslations("taskExecutionMap");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [blockReason, setBlockReason] = useState("");
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selection = props.selection;
  const subtask =
    selection.kind === "parent"
      ? null
      : (props.subtasks.find((s) => s.id === selection.subtaskId) ?? null);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <aside
      data-testid="tem-detail-panel"
      className="flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-border bg-card p-4"
      aria-label={t("panel.ariaLabel")}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {props.selection.kind === "parent"
            ? t("panel.parentTitle")
            : props.selection.kind === "blocker"
              ? t("blocker.title")
              : t("panel.subtaskTitle")}
        </h3>
        <button
          type="button"
          onClick={props.onClose}
          aria-label={t("panel.close")}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-600">
          {["forbidden", "not_authenticated", "unexpected", "blockReasonRequired"].includes(error)
            ? t(`errors.${error as "forbidden" | "not_authenticated" | "unexpected" | "blockReasonRequired"}`)
            : t("errors.unexpected")}
        </p>
      )}

      {props.selection.kind === "parent" ? (
        <ParentPanel {...props} />
      ) : subtask ? (
        <>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{subtask.title}</p>
            {subtask.description && (
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{subtask.description}</p>
            )}
          </div>
          <div className="mt-3">
            <Row label={t("table.status")} value={<StatusText status={subtask.status} />} />
            <Row label={t("table.progress")} value={`${subtask.status === "completed" ? 100 : subtask.progress}%`} />
            <Row
              label={t("table.owner")}
              value={subtask.owner_id ? (props.ownerNames[subtask.owner_id] ?? t("unassigned")) : t("unassigned")}
            />
            <Row label={t("form.weight")} value={subtask.weight ?? "—"} />
            <Row label={t("form.estimatedHours")} value={subtask.estimated_hours != null ? `${subtask.estimated_hours}h` : "—"} />
            <Row label={t("form.actualHours")} value={subtask.actual_hours != null ? `${subtask.actual_hours}h` : "—"} />
            <Row label={t("node.dueDate")} value={subtask.due_date ?? "—"} />
            <Row label={t("panel.completedAt")} value={subtask.completed_at?.slice(0, 10) ?? "—"} />
            {subtask.is_critical && <Row label={t("node.critical")} value={t("yes")} />}
            {subtask.status === "blocked" && (
              <Row label={t("panel.blockedReason")} value={subtask.blocked_reason ?? t("blocker.noReason")} />
            )}
          </div>

          {/* Progress quick update */}
          <div className="mt-3">
            <label htmlFor="tem-progress-input" className="text-xs text-muted-foreground">
              {t("panel.updateProgress")}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="tem-progress-input"
                type="range"
                min={0}
                max={100}
                step={5}
                defaultValue={subtask.progress}
                className="w-full"
                disabled={pending || subtask.status === "completed" || subtask.status === "cancelled"}
                onMouseUp={(e) =>
                  run(() =>
                    updateSubtaskAction({
                      projectId: props.projectId,
                      subtaskId: subtask.id,
                      progress: Number((e.target as HTMLInputElement).value),
                      status: subtask.status === "not_started" ? "in_progress" : undefined,
                    }),
                  )
                }
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {subtask.status !== "completed" && subtask.status !== "cancelled" && (
              <button
                type="button"
                disabled={pending}
                data-testid="tem-action-complete"
                onClick={() => run(() => completeSubtaskAction({ projectId: props.projectId, subtaskId: subtask.id }))}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("actions.complete")}
              </button>
            )}
            {subtask.status === "blocked" ? (
              <button
                type="button"
                disabled={pending}
                data-testid="tem-action-unblock"
                onClick={() => run(() => unblockSubtaskAction({ projectId: props.projectId, subtaskId: subtask.id }))}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <Unlock className="h-3.5 w-3.5" /> {t("actions.unblock")}
              </button>
            ) : (
              subtask.status !== "completed" &&
              subtask.status !== "cancelled" && (
                <button
                  type="button"
                  disabled={pending}
                  data-testid="tem-action-block"
                  onClick={() => setShowBlockForm((v) => !v)}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-red-500/40 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Ban className="h-3.5 w-3.5" /> {t("actions.block")}
                </button>
              )
            )}
            <button
              type="button"
              disabled={pending}
              data-testid="tem-action-edit"
              onClick={() => props.onEdit(subtask)}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Pencil className="h-3.5 w-3.5" /> {t("actions.edit")}
            </button>
            {props.canManage && (
              <button
                type="button"
                disabled={pending}
                data-testid="tem-action-delete"
                onClick={() => {
                  if (window.confirm(t("actions.deleteConfirm"))) {
                    run(() => deleteSubtaskAction({ projectId: props.projectId, subtaskId: subtask.id }));
                    props.onClose();
                  }
                }}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("actions.delete")}
              </button>
            )}
          </div>

          {/* Block-with-reason (reason REQUIRED) */}
          {showBlockForm && (
            <form
              data-testid="tem-block-form"
              className="mt-2 space-y-2 rounded-md border border-red-500/30 bg-red-500/5 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (blockReason.trim().length < 3) {
                  setError("blockReasonRequired");
                  return;
                }
                run(() =>
                  blockSubtaskAction({ projectId: props.projectId, subtaskId: subtask.id, reason: blockReason.trim() }),
                );
                setShowBlockForm(false);
                setBlockReason("");
              }}
            >
              <label htmlFor="tem-block-reason" className="text-xs font-medium text-foreground">
                {t("actions.blockReasonLabel")}
              </label>
              <textarea
                id="tem-block-reason"
                required
                minLength={3}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={t("actions.blockReasonPlaceholder")}
                className="w-full rounded border border-border bg-background p-1.5 text-xs"
                rows={2}
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t("actions.confirmBlock")}
              </button>
            </form>
          )}

          <button
            type="button"
            data-testid="tem-ask-isabella"
            onClick={() =>
              askIsabella({
                query: t("isabella.subtaskQuestion", { title: subtask.title }),
                entity: { type: "subtask", id: subtask.id, title: subtask.title },
              })
            }
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Bot className="h-4 w-4" /> {t("isabella.askAboutSubtask")}
          </button>

          <EntityAttachmentsSection
            projectId={props.projectId}
            subtaskId={subtask.id}
            canUpload={props.canUpload}
          />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("panel.notFound")}</p>
      )}
    </aside>
  );
}

function StatusText({ status }: { status: Subtask["status"] }) {
  const t = useTranslations("taskExecutionMap");
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASS[status]}`}>
      <Icon className="h-3 w-3" aria-hidden /> {t(`status.${status}`)}
    </span>
  );
}

function ParentPanel(props: SubtaskDetailPanelProps) {
  const t = useTranslations("taskExecutionMap");
  const calc = computeParentProgress(props.subtasks);
  const signals = deriveParentSignals(props.subtasks, props.asOf);
  const gate = evaluateParentCloseGate(props.subtasks);
  const blocked = props.subtasks.filter((s) => s.status === "blocked");

  return (
    <div data-testid="tem-parent-panel">
      <p className="text-sm font-medium text-foreground">{props.parent.title}</p>
      <div className="mt-2">
        <Row
          label={t("panel.calcMethod")}
          value={calc ? t(`calc.${calc.modeUsed}`) : t("parent.progressManual")}
        />
        <Row label={t("table.progress")} value={`${calc ? calc.progress : props.parent.progress}%`} />
        <Row label={t("parent.done")} value={`${signals.completedCount}/${signals.activeCount}`} />
        <Row label={t("parent.blocked")} value={signals.blockedCount} />
        <Row label={t("parent.overdue")} value={signals.overdueCount} />
        <Row label={t("parent.estimated")} value={`${signals.estimatedHours}h`} />
        <Row label={t("parent.actual")} value={`${signals.actualHours}h`} />
        <Row
          label={t("parent.variance")}
          value={signals.varianceHours === null ? "—" : `${signals.varianceHours > 0 ? "+" : ""}${Math.round(signals.varianceHours * 10) / 10}h`}
        />
      </div>

      {calc && calc.breakdown.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-foreground">{t("panel.breakdown")}</h4>
          <ul className="mt-1 space-y-0.5">
            {calc.breakdown.map((b) => (
              <li key={b.subtaskId} className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{b.title}</span>
                <span className="tabular-nums">
                  {Math.round(b.share * 100)}% × {b.effectiveProgress}%
                </span>
              </li>
            ))}
          </ul>
          {calc.fallbackReason && (
            <p className="mt-1 text-[10px] text-amber-600">{t(`calc.fallback.${calc.fallbackReason}`)}</p>
          )}
        </div>
      )}

      {blocked.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-red-600">{t("panel.blockers")}</h4>
          <ul className="mt-1 space-y-1">
            {blocked.map((s) => (
              <li key={s.id} className="rounded border border-red-500/30 bg-red-500/5 p-1.5 text-[11px]">
                <span className="font-medium text-foreground">{s.title}</span>
                <p className="text-muted-foreground">{s.blocked_reason ?? t("blocker.noReason")}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!gate.allowed && (
        <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-700">
          {t("panel.closeGate", { count: gate.incompleteCount })}
        </p>
      )}

      <button
        type="button"
        data-testid="tem-ask-isabella-parent"
        onClick={() =>
          askIsabella({
            query: t("isabella.parentQuestion", { title: props.parent.title }),
            entity: { type: "task", id: props.parent.id, title: props.parent.title },
          })
        }
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <Bot className="h-4 w-4" /> {t("isabella.askAboutTask")}
      </button>

      <EntityAttachmentsSection
        projectId={props.projectId}
        taskId={props.parent.id}
        canUpload={props.canUpload}
      />
    </div>
  );
}
