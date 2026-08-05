"use client";

// ============================================================================
// Import progress — one line per category
// ============================================================================
// A large plan takes minutes to write. With only a spinner, "working" and
// "hung" look identical: a healthy 262-second import that wrote all 274 tasks
// and its complete graph was cancelled because there was nothing on screen to
// say it was alive.
// ============================================================================

import { Check, Loader2, AlertTriangle } from "lucide-react";
import {
  IMPORT_PHASES,
  formatPhaseProgress,
  type ImportPhase,
  type ImportProgress,
} from "@/lib/import-intelligence/progress";

interface ImportProgressPanelProps {
  progress: ImportProgress | null;
  /** True when progress has not moved for long enough to look abandoned. */
  stalled: boolean;
  labels: {
    title: string;
    starting: string;
    stalled: string;
    phases: Record<ImportPhase, string>;
  };
}

export function ImportProgressPanel({ progress, stalled, labels }: ImportProgressPanelProps) {
  const doneByPhase = new Map<ImportPhase, number>(
    (progress?.completed ?? []).map((c) => [c.phase, c.count]),
  );
  const currentIndex = progress ? IMPORT_PHASES.indexOf(progress.phase) : -1;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {stalled ? (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
        )}
        <p className="text-sm font-medium text-foreground">{labels.title}</p>
      </div>

      {!progress && <p className="mt-3 text-sm text-muted-foreground">{labels.starting}</p>}

      {stalled && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">{labels.stalled}</p>
      )}

      {progress && (
        <ul className="mt-3 space-y-1.5">
          {IMPORT_PHASES.map((phase, index) => {
            const isCurrent = phase === progress.phase;
            // Only phases the import has actually reached are listed, so the
            // panel never implies work that has not started.
            const isDone = doneByPhase.has(phase) || (currentIndex > index && currentIndex >= 0);
            if (!isCurrent && !isDone) return null;

            const count = isCurrent
              ? formatPhaseProgress(progress.done, progress.total)
              : String(doneByPhase.get(phase) ?? "");

            return (
              <li key={phase} className="flex items-center gap-2 text-sm">
                {isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-600" />
                ) : (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                )}
                <span className={isCurrent ? "text-foreground" : "text-muted-foreground"}>
                  {labels.phases[phase]}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
