"use client";

import { useTranslations } from "next-intl";
import type { Phase0Task, TaskStatus } from "@/types/phase0";

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

const priorityConfig: Record<string, string> = {
  P1: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  P2: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  P3: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
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

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityConfig[priority] || "bg-muted text-muted-foreground"}`}
    >
      {priority}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {category}
    </span>
  );
}