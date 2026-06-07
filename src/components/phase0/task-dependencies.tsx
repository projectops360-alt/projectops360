"use client";

import { useTranslations } from "next-intl";
import type { Phase0Task } from "@/types/phase0";

export function TaskDependencies({
  dependencies,
  tasks,
}: {
  dependencies: string[];
  tasks: Phase0Task[];
}) {
  const t = useTranslations("phase0Control.task");

  if (dependencies.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">{t("noDependencies")}</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {dependencies.map((depId) => {
        const depTask = tasks.find((task) => task.id === depId);
        return (
          <span
            key={depId}
            className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            {depId}{depTask ? ` — ${depTask.title}` : ""}
          </span>
        );
      })}
    </div>
  );
}