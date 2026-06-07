"use client";

import { useTranslations } from "next-intl";
import type { Phase0Task, TaskStatus } from "@/types/phase0";
import { phase0Tasks } from "@/data/phase0-tasks";
import { usePhase0Progress } from "@/hooks/use-phase0-progress";
import { ProgressHeader } from "./progress-header";
import { TaskCard } from "./task-card";
import { Loader2 } from "lucide-react";

export function Phase0ControlClient() {
  const t = useTranslations("phase0Control");
  const { progress, loaded, setTaskStatus, setTaskNotes, resetProgress } =
    usePhase0Progress();

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Merge default task statuses with user overrides from localStorage
  const tasksWithStatus: (Phase0Task & { status: TaskStatus; notes: string })[] =
    phase0Tasks.map((task) => ({
      ...task,
      status: progress.taskStatuses[task.id] ?? task.defaultStatus,
      notes: progress.taskNotes[task.id] ?? "",
    }));

  const completed = tasksWithStatus.filter((t) => t.status === "done").length;
  const total = tasksWithStatus.length;

  // Group tasks by category for visual organization
  const categories = Array.from(new Set(phase0Tasks.map((t) => t.category)));

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("pageDescription")}
        </p>
      </div>

      {/* ── Progress ── */}
      <ProgressHeader
        completed={completed}
        total={total}
        lastSaved={progress.lastSaved}
        onReset={resetProgress}
      />

      {/* ── Tasks grouped by category ── */}
      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </h2>
          <div className="space-y-3">
            {tasksWithStatus
              .filter((task) => task.category === category)
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  status={task.status}
                  notes={task.notes}
                  allTasks={phase0Tasks}
                  onStatusChange={setTaskStatus}
                  onNotesChange={setTaskNotes}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}