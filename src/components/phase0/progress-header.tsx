"use client";

import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";

export function ProgressHeader({
  completed,
  total,
  lastSaved,
  onReset,
}: {
  completed: number;
  total: number;
  lastSaved: string;
  onReset: () => void;
}) {
  const t = useTranslations("phase0Control.progress");
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      {/* ── Top row: label + stats ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("label")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("completed", { done: completed, total })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
            {t("percentage", { percent })}
          </span>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t("confirmReset"))) {
                onReset();
              }
            }}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t("reset")}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* ── Last saved ── */}
      {lastSaved && (
        <p className="text-[11px] text-muted-foreground">
          {t("lastSaved", {
            time: new Date(lastSaved).toLocaleString(),
          })}
        </p>
      )}
    </div>
  );
}