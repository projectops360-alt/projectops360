"use client";

import { useTranslations } from "next-intl";
import type { TaskStatus } from "@/types/phase0";

const statusConfig: Record<TaskStatus, { labelKey: string; className: string }> = {
  done: {
    labelKey: "statusDone",
    className: "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200",
  },
  in_progress: {
    labelKey: "statusInProgress",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  pending: {
    labelKey: "statusPending",
    className: "bg-muted text-muted-foreground",
  },
  blocked: {
    labelKey: "statusBlocked",
    className: "bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const t = useTranslations("phase0Control.task");
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {t(config.labelKey)}
    </span>
  );
}