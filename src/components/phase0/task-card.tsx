"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Phase0Task, TaskStatus } from "@/types/phase0";
import { StatusBadge } from "./status-badge";
import { CopyPromptButton } from "./copy-prompt-button";
import { TaskDependencies } from "./task-dependencies";
import { ChevronDown, ChevronRight, Clock, FileText } from "lucide-react";

const STATUS_CYCLE: TaskStatus[] = ["pending", "in_progress", "done", "blocked"];

export function TaskCard({
  task,
  status,
  notes,
  allTasks,
  onStatusChange,
  onNotesChange,
}: {
  task: Phase0Task;
  status: TaskStatus;
  notes: string;
  allTasks: Phase0Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const t = useTranslations("phase0Control");
  const [expanded, setExpanded] = useState(false);

  const cycleStatus = () => {
    const currentIndex = STATUS_CYCLE.indexOf(status);
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
    onStatusChange(task.id, nextStatus);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* ── Header row ── */}
      <div className="flex items-center gap-4 p-5">
        {/* ── ID badge ── */}
        <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
          {task.id}
        </span>

        {/* ── Title + estimate ── */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {t(task.titleKey)}
          </h3>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {task.estimate}
          </div>
        </div>

        {/* ── Status badge (clickable) ── */}
        <button
          type="button"
          onClick={cycleStatus}
          className="shrink-0"
          title={t("task.toggleStatus")}
        >
          <StatusBadge status={status} />
        </button>

        {/* ── Expand toggle ── */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ── Expandable details ── */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          {/* ── Goal ── */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("task.goal")}
            </h4>
            <p className="mt-1 text-sm text-foreground">{t(task.goalKey)}</p>
          </div>

          {/* ── Dependencies ── */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("task.dependencies")}
            </h4>
            <div className="mt-1">
              <TaskDependencies dependencies={task.dependencies} tasks={allTasks} />
            </div>
          </div>

          {/* ── Acceptance Criteria ── */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("task.acceptanceCriteria")}
            </h4>
            <ul className="mt-1 space-y-1">
              {task.criteriaKeys.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                    AC-{key.split(".").pop()}
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Prompt ── */}
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("task.prompt")}
              </h4>
              <CopyPromptButton prompt={t(task.promptKey)} />
            </div>
            <div className="mt-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
              {t(task.promptKey)}
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="mr-1 inline h-3 w-3" />
              {t("task.notes")}
            </h4>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(task.id, e.target.value)}
              placeholder={t("task.notesPlaceholder")}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}