"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, ListChecks } from "lucide-react";
import type { Milestone, MilestoneStatus, RoadmapTask, Locale } from "@/types/database";

// Unifies the former "Flow" executive dashboard (KPIs + insights) inside the
// Living Graph. Everything is derived from milestones + tasks — no extra data.

const MS_STATUS_DOT: Record<MilestoneStatus, string> = {
  completed: "bg-green-500",
  in_progress: "bg-brand-500",
  planned: "bg-gray-400",
  blocked: "bg-red-500",
  deferred: "bg-amber-500",
};

function Kpi({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${accent ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ExecutiveSummaryPanel({
  milestones,
  tasks,
  locale,
}: {
  milestones: Milestone[];
  tasks: RoadmapTask[];
  locale: Locale;
}) {
  const es = locale === "es";
  const [open, setOpen] = useState(true);

  // ── KPIs ──
  const totalMs = milestones.length;
  const completedMs = milestones.filter((m) => m.status === "completed").length;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.is_blocked || t.status === "blocked");
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const remainingEffort = tasks
    .filter((t) => t.status !== "done")
    .reduce((sum, t) => sum + (Number(t.estimate_hours) || 0), 0);

  // ── Insights ──
  const distribution: Record<MilestoneStatus, number> = {
    completed: 0, in_progress: 0, planned: 0, blocked: 0, deferred: 0,
  };
  for (const m of milestones) distribution[m.status] = (distribution[m.status] ?? 0) + 1;

  const byPriority = { p1: 0, p2: 0, p3: 0 } as Record<string, number>;
  for (const t of tasks) byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;

  const statusLabel: Record<MilestoneStatus, string> = {
    completed: es ? "Completado" : "Completed",
    in_progress: es ? "En progreso" : "In progress",
    planned: es ? "Planeado" : "Planned",
    blocked: es ? "Bloqueado" : "Blocked",
    deferred: es ? "Diferido" : "Deferred",
  };

  return (
    <div className="rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {es ? "Resumen ejecutivo" : "Executive Summary"}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {progressPct}% · {completedMs}/{totalMs} {es ? "milestones" : "milestones"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label={es ? "Milestones" : "Milestones"} value={`${completedMs}/${totalMs}`} sub={es ? "completados" : "completed"} accent="text-brand-600" />
            <Kpi label={es ? "Progreso" : "Progress"} value={`${progressPct}%`} sub={es ? "general" : "overall"} />
            <Kpi label={es ? "Tareas" : "Tasks"} value={`${doneTasks}/${totalTasks}`} sub={es ? "completadas" : "completed"} accent="text-green-600" />
            <Kpi label={es ? "En progreso" : "In progress"} value={inProgress} />
            <Kpi label={es ? "Bloqueos" : "Blockers"} value={blocked.length} accent={blocked.length > 0 ? "text-red-600" : undefined} />
            <Kpi label={es ? "Esfuerzo restante" : "Remaining effort"} value={`${remainingEffort}h`} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Milestone distribution */}
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {es ? "Distribución de milestones" : "Milestone distribution"}
              </p>
              <div className="space-y-1">
                {(Object.keys(distribution) as MilestoneStatus[])
                  .filter((s) => distribution[s] > 0)
                  .map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[11px]">
                      <span className={`h-2 w-2 rounded-full ${MS_STATUS_DOT[s]}`} />
                      <span className="flex-1 text-foreground">{statusLabel[s]}</span>
                      <span className="tabular-nums text-muted-foreground">{distribution[s]}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Tasks by priority */}
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ListChecks className="h-3 w-3" />
                {es ? "Tareas por prioridad" : "Tasks by priority"}
              </p>
              <div className="flex gap-2 text-[11px]">
                <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">P1 · {byPriority.p1}</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">P2 · {byPriority.p2}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">P3 · {byPriority.p3}</span>
              </div>
            </div>

            {/* Blockers & recommendations */}
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                {es ? "Bloqueos y recomendaciones" : "Blockers & recommendations"}
              </p>
              {blocked.length === 0 ? (
                <p className="text-[11px] text-green-600">{es ? "Sin bloqueos. El flujo avanza." : "No blockers. Flow is healthy."}</p>
              ) : (
                <ul className="space-y-1">
                  {blocked.slice(0, 4).map((t) => (
                    <li key={t.id} className="text-[11px]">
                      <span className="text-foreground">{t.title}</span>
                      {t.blocker_reason && <span className="text-muted-foreground"> — {t.blocker_reason}</span>}
                    </li>
                  ))}
                  {blocked.length > 4 && (
                    <li className="text-[10px] text-muted-foreground">+{blocked.length - 4} {es ? "más" : "more"}</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
