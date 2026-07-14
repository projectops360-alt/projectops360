"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  GitCompareArrows,
  History,
  ListChecks,
  Search,
  ShieldCheck,
  ShieldQuestion,
  UserRound,
} from "lucide-react";
import type {
  TaskCaseSummary,
  TaskCaseWarningCode,
} from "@/lib/graph/task-case-analysis";

interface TaskCaseExplorerProps {
  locale: string;
  cases: TaskCaseSummary[];
  eventsTruncated: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onSelectEvent: (eventId: string) => void;
  onOpenTask: (taskId: string) => void;
}

function humanize(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
}

function formatDuration(ms: number | null, es: boolean): string {
  if (ms == null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} min`;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} ${es ? "días" : "days"}`;
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusTone(status: string): string {
  if (["done", "tested", "implemented", "completed"].includes(status)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "blocked") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  if (["in_progress", "sent_to_ai", "prompt_ready"].includes(status)) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

function warningText(code: TaskCaseWarningCode, es: boolean): string {
  const copy: Record<TaskCaseWarningCode, [string, string]> = {
    no_history: ["No canonical history was captured for this task.", "No se capturó historial canónico para esta tarea."],
    missing_acceptance_criteria: ["Acceptance criteria are missing.", "Faltan criterios de aceptación."],
    missing_evidence: ["No evidence or file is linked.", "No hay evidencia ni archivo vinculado."],
    missing_completion_event: ["The status is complete, but no completion event exists.", "El estado figura completo, pero no existe un evento de finalización."],
    missing_completion_timestamp: ["The status is complete, but completed_at is missing.", "El estado figura completo, pero falta completed_at."],
    incomplete: ["This task is not complete.", "Esta tarea no está terminada."],
  };
  return copy[code][es ? 1 : 0];
}

function verificationCopy(summary: TaskCaseSummary, es: boolean): {
  title: string;
  description: string;
  tone: string;
  icon: typeof ShieldCheck;
} {
  if (summary.verificationState === "verified_complete") {
    return {
      title: es ? "Finalización verificable" : "Verifiable completion",
      description: es
        ? "Hay estado final, timestamp, evento, criterios y evidencia vinculada."
        : "Final status, timestamp, event, criteria, and linked evidence are present.",
      tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
      icon: ShieldCheck,
    };
  }
  if (summary.verificationState === "complete_unverified") {
    return {
      title: es ? "Completa, pero no verificable" : "Complete, but not verifiable",
      description: es
        ? "El estado dice que terminó, pero faltan elementos para demostrar el resultado."
        : "The status says complete, but required proof of the result is missing.",
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      icon: ShieldQuestion,
    };
  }
  return {
    title: es ? "Trabajo no terminado" : "Work not complete",
    description: es
      ? "La tarea sigue abierta; la cronología explica su estado actual, no una finalización."
      : "The task remains open; the chronology explains its current state, not completion.",
    tone: "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200",
    icon: History,
  };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function TaskCaseExplorer({
  locale,
  cases,
  eventsTruncated,
  selectedTaskId,
  onSelectTask,
  onSelectEvent,
  onOpenTask,
}: TaskCaseExplorerProps) {
  const es = locale === "es";
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("");
  const [status, setStatus] = useState("");
  const [compareTaskId, setCompareTaskId] = useState("");
  const selected = cases.find((taskCase) => taskCase.task.id === selectedTaskId) ?? null;
  const compare = cases.find((taskCase) => taskCase.task.id === compareTaskId) ?? null;
  const phases = useMemo(
    () => [...new Set(cases.map((taskCase) => taskCase.milestoneTitle).filter((value): value is string => Boolean(value)))].sort(),
    [cases],
  );
  const statuses = useMemo(
    () => [...new Set(cases.map((taskCase) => taskCase.task.status))].sort(),
    [cases],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return cases.filter((taskCase) => {
      if (phase && taskCase.milestoneTitle !== phase) return false;
      if (status && taskCase.task.status !== status) return false;
      if (!normalized) return true;
      return `${taskCase.task.external_key ?? ""} ${taskCase.task.title} ${taskCase.milestoneTitle ?? ""}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [cases, phase, query, status]);

  const withHistory = cases.filter((taskCase) => taskCase.events.length > 0).length;
  const verified = cases.filter((taskCase) => taskCase.verificationState === "verified_complete").length;
  const needsProof = cases.filter((taskCase) => taskCase.verificationState === "complete_unverified").length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background/35" data-testid="task-case-explorer">
      <div className="grid grid-cols-2 gap-2 border-b border-border p-3 sm:grid-cols-4">
        <Metric label={es ? "Tareas" : "Task cases"} value={cases.length} />
        <Metric label={es ? "Con historial" : "With history"} value={withHistory} />
        <Metric label={es ? "Verificadas" : "Verified"} value={verified} />
        <Metric label={es ? "Falta evidencia" : "Need proof"} value={needsProof} />
      </div>
      {eventsTruncated && (
        <p role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
          {es
            ? "El registro fue truncado. Las historias muestran solo los eventos cargados; un evento ausente no demuestra que no ocurrió."
            : "The log was truncated. Stories show loaded events only; a missing event does not prove it never happened."}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(220px,42%)_minmax(0,1fr)] lg:grid-cols-[minmax(300px,38%)_1fr] lg:grid-rows-1">
        <section className="flex min-h-0 flex-col border-b border-border bg-card/65 lg:border-b-0 lg:border-r" aria-label={es ? "Casos de tarea" : "Task cases"}>
          <div className="space-y-2 border-b border-border p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <input
                aria-label={es ? "Buscar casos de tarea" : "Search task cases"}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={es ? "Buscar por tarea, ID o fase…" : "Search task, ID, or phase…"}
                className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none focus:border-brand-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select aria-label={es ? "Filtrar por fase" : "Filter by phase"} value={phase} onChange={(event) => setPhase(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                <option value="">{es ? "Todas las fases" : "All phases"}</option>
                {phases.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select aria-label={es ? "Filtrar por estado" : "Filter by status"} value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                <option value="">{es ? "Todos los estados" : "All statuses"}</option>
                {statuses.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {es ? `${filtered.length} de ${cases.length} tareas` : `${filtered.length} of ${cases.length} tasks`}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {filtered.map((taskCase) => {
              const active = taskCase.task.id === selectedTaskId;
              return (
                <button
                  key={taskCase.task.id}
                  type="button"
                  onClick={() => onSelectTask(taskCase.task.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${active ? "border-brand-500 bg-brand-500/10" : "border-transparent hover:border-border hover:bg-muted/50"}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground" title={taskCase.task.title}>
                        {taskCase.task.external_key ? `${taskCase.task.external_key} · ` : ""}{taskCase.task.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{taskCase.milestoneTitle ?? (es ? "Sin fase" : "No phase")}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${statusTone(taskCase.task.status)}`}>
                      {humanize(taskCase.task.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{taskCase.task.progress}%</span>
                    <span>·</span>
                    <span>{taskCase.events.length} {es ? "eventos" : "events"}</span>
                    <span>·</span>
                    <span>{taskCase.completedSubtasks}/{taskCase.subtasks.length} {es ? "subtareas" : "subtasks"}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-10 text-center text-xs text-muted-foreground">{es ? "No hay tareas que coincidan." : "No matching task cases."}</p>
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto p-4" aria-label={es ? "Historia de la tarea" : "Task story"}>
          {!selected ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <ListChecks className="h-10 w-10 text-brand-500/70" aria-hidden />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{es ? "Selecciona una tarea" : "Select a task case"}</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {es ? "Verás su estado real, subtareas, criterios, evidencia y secuencia temporal." : "Review its real status, subtasks, criteria, evidence, and timestamped sequence."}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {selected.milestoneTitle ?? (es ? "Sin fase" : "No phase")} › {selected.task.external_key ?? selected.task.id.slice(0, 8)}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">{selected.task.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(selected.task.status)}`}>{humanize(selected.task.status)}</span>
                    <span className="text-xs text-muted-foreground">{selected.task.progress}%</span>
                    <span className="text-xs text-muted-foreground">
                      {selected.completedSubtasks}/{selected.subtasks.length} {es ? "subtareas completas" : "subtasks complete"}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => onOpenTask(selected.task.id)} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                  {es ? "Abrir tarea" : "Open task"}
                </button>
              </div>

              {(() => {
                const verification = verificationCopy(selected, es);
                const Icon = verification.icon;
                return (
                  <div className={`flex items-start gap-2 rounded-lg border p-3 ${verification.tone}`} role="status">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <div>
                      <p className="text-xs font-semibold">{verification.title}</p>
                      <p className="mt-0.5 text-[11px] opacity-90">{verification.description}</p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Metric label={es ? "Eventos" : "Events"} value={selected.events.length} />
                <Metric label={es ? "Duración observada" : "Observed duration"} value={formatDuration(selected.elapsedMs, es)} />
                <Metric label={es ? "Archivos" : "Files"} value={selected.attachments.length} />
                <Metric label={es ? "Refs. evidencia" : "Evidence refs"} value={selected.evidenceRefs.length} />
              </div>

              {selected.warningCodes.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    {es ? "Vacíos de verificación" : "Verification gaps"}
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px] text-amber-800/90 dark:text-amber-200/90">
                    {selected.warningCodes.map((code) => <li key={code}>• {warningText(code, es)}</li>)}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-card/75 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><FileCheck2 className="h-3.5 w-3.5 text-brand-600" />{es ? "Definición de terminado" : "Definition of done"}</p>
                  <p className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
                    {selected.task.acceptance_criteria?.trim() || (es ? "Sin criterios de aceptación." : "No acceptance criteria.")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card/75 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><UserRound className="h-3.5 w-3.5 text-brand-600" />{es ? "Responsabilidad y cierre" : "Ownership and closure"}</p>
                  <dl className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between gap-3"><dt>{es ? "Asignación" : "Assignment"}</dt><dd className="truncate text-foreground">{selected.task.assigned_resource_id ?? selected.task.assigned_to ?? (es ? "Sin asignar" : "Unassigned")}</dd></div>
                    <div className="flex justify-between gap-3"><dt>completed_at</dt><dd className="text-foreground">{formatDate(selected.task.completed_at, locale)}</dd></div>
                    <div className="flex justify-between gap-3"><dt>{es ? "Último evento" : "Last event"}</dt><dd className="text-foreground">{formatDate(selected.lastOccurredAt, locale)}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card/75 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Clock3 className="h-3.5 w-3.5 text-brand-600" />{es ? "Historia registrada" : "Recorded history"}</p>
                  <span className="text-[10px] text-muted-foreground">{es ? "Orden temporal; no implica causalidad" : "Temporal order; not causality"}</span>
                </div>
                {selected.events.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">{es ? "No existe historial canónico para esta tarea." : "No canonical history exists for this task."}</p>
                ) : (
                  <ol className="relative mt-3 space-y-2 border-l border-brand-500/30 pl-4">
                    {selected.events.map((event) => (
                      <li key={event.eventId} className="relative">
                        <span className="absolute -left-[1.15rem] top-2 h-2 w-2 rounded-full bg-brand-500" aria-hidden />
                        <button type="button" onClick={() => onSelectEvent(event.eventId)} className="w-full rounded-md border border-border bg-background/70 px-3 py-2 text-left hover:border-brand-500/50 hover:bg-brand-500/5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-medium text-foreground">{humanize(event.eventType)}</p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(event.occurredAt, locale)} · #{event.sequenceNumber}</p>
                            </div>
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{humanize(event.lifecycleClass ?? "event")}</span>
                          </div>
                          {(event.fromState || event.toState) && <p className="mt-1 text-[10px] text-muted-foreground">{event.fromState ?? "…"} → {event.toState ?? "…"}</p>}
                          <p className="mt-1 text-[10px] text-muted-foreground">{event.actorType ?? "—"}{event.actorId ? ` · ${event.actorId.slice(0, 8)}` : ""} · {event.sourceModule ?? "—"}</p>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-card/75 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><FileText className="h-3.5 w-3.5 text-brand-600" />{es ? "Archivos vinculados" : "Linked files"}</p>
                  {selected.attachments.length === 0 ? <p className="mt-2 text-[11px] text-muted-foreground">{es ? "Sin archivos." : "No files."}</p> : (
                    <ul className="mt-2 space-y-1 text-[11px] text-foreground">{selected.attachments.map((attachment) => <li key={attachment.id} className="truncate" title={attachment.fileName}>• {attachment.fileName}</li>)}</ul>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-card/75 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />{es ? "Evidencia canónica" : "Canonical evidence"}</p>
                  {selected.evidenceRefs.length === 0 ? <p className="mt-2 text-[11px] text-muted-foreground">{es ? "Ningún evento referencia evidencia." : "No event references evidence."}</p> : (
                    <ul className="mt-2 space-y-1 text-[11px] text-foreground">{selected.evidenceRefs.map((ref) => <li key={`${ref.eventId}-${ref.objectType}-${ref.objectId}`} className="truncate">• {ref.objectType} · {ref.objectId}</li>)}</ul>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card/75 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><GitCompareArrows className="h-3.5 w-3.5 text-brand-600" />{es ? "Comparar con otra tarea" : "Compare with another task"}</p>
                  <select aria-label={es ? "Elegir tarea para comparar" : "Choose task to compare"} value={compareTaskId} onChange={(event) => setCompareTaskId(event.target.value)} className="h-8 max-w-sm rounded-md border border-border bg-background px-2 text-xs text-foreground">
                    <option value="">{es ? "Elegir tarea…" : "Choose task…"}</option>
                    {cases.filter((taskCase) => taskCase.task.id !== selected.task.id).map((taskCase) => <option key={taskCase.task.id} value={taskCase.task.id}>{taskCase.task.external_key ? `${taskCase.task.external_key} · ` : ""}{taskCase.task.title}</option>)}
                  </select>
                </div>
                {compare && (
                  <div className="mt-3">
                    <p className="mb-2 text-[10px] text-muted-foreground">{es ? "Comparación descriptiva; no atribuye causalidad." : "Descriptive comparison; it does not attribute causality."}</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {[selected, compare].map((taskCase) => <div key={taskCase.task.id} className="rounded-md border border-border bg-background/70 p-2">
                        <p className="truncate font-semibold text-foreground">{taskCase.task.external_key ?? taskCase.task.title}</p>
                        <p className="mt-1 text-muted-foreground">{humanize(taskCase.task.status)} · {taskCase.task.progress}%</p>
                        <p className="text-muted-foreground">{taskCase.events.length} {es ? "eventos" : "events"} · {formatDuration(taskCase.elapsedMs, es)}</p>
                        <p className="text-muted-foreground">{taskCase.attachments.length + taskCase.evidenceRefs.length} {es ? "evidencias/archivos" : "evidence/files"}</p>
                      </div>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
