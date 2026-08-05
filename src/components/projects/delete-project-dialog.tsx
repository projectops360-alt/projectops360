"use client";

// ============================================================================
// Permanent project deletion — two-step confirmation
// ============================================================================
// Archiving is reversible and needs one confirmation. This is not: the project
// and everything cascading from it are destroyed. So the user passes two
// separate gates, and the first one states the actual damage in numbers rather
// than asking them to accept an abstraction.
// ============================================================================

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  advanceDeletion,
  deletionImpactLines,
  resetDeletion,
  type DeletionStep,
} from "@/lib/projects/deletion-confirmation";
import type { ProjectDeletionImpact } from "@/app/[locale]/(app)/projects/actions";

interface DeleteProjectDialogProps {
  impact: ProjectDeletionImpact;
  /** Resolves to an error key, or undefined on success. */
  onConfirm: () => Promise<string | undefined>;
  onClose: () => void;
  labels: {
    step1Title: string;
    step1Body: string;
    tasks: string;
    milestones: string;
    dependencies: string;
    events: string;
    step1Confirm: string;
    step2Title: string;
    step2Body: string;
    step2Confirm: string;
    cancel: string;
    deleting: string;
    failed: string;
  };
}

export function DeleteProjectDialog({ impact, onConfirm, onClose, labels }: DeleteProjectDialogProps) {
  const [step, setStep] = useState<DeletionStep>(resetDeletion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The state machine decides when destruction is authorised — the button
  // never calls onConfirm on its own.
  const handleConfirm = async () => {
    const next = advanceDeletion(step);
    setStep(next.step);
    if (!next.destroy) return;

    setBusy(true);
    setError(null);
    const failure = await onConfirm();
    // On success the caller navigates away; only a failure returns here.
    if (failure) {
      setError(labels.failed);
      setBusy(false);
    }
  };

  const counts = deletionImpactLines(impact, {
    tasks: labels.tasks,
    milestones: labels.milestones,
    dependencies: labels.dependencies,
    events: labels.events,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-950/50 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="delete-project-title" className="text-base font-semibold text-foreground">
              {step === 1 ? labels.step1Title : labels.step2Title}
            </h2>

            {step === 1 ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">{labels.step1Body}</p>
                {counts.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-foreground">
                    {counts.map((line) => (
                      <li key={line} className="flex items-baseline gap-2">
                        <span className="text-muted-foreground">•</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{labels.step2Body}</p>
            )}

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? labels.deleting : step === 1 ? labels.step1Confirm : labels.step2Confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
