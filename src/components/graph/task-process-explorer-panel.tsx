"use client";

import { Activity, GitFork, Info, Route } from "lucide-react";
import type {
  ProcessActivityAggregate,
  ProcessTransitionAggregate,
  TaskProcessAggregate,
  TaskProcessModel,
} from "@/lib/graph/task-process-analysis";

interface TaskProcessExplorerPanelProps {
  locale: string;
  model: TaskProcessModel;
  aggregate: TaskProcessAggregate;
  eventsTruncated: boolean;
  selectedVariantId: string;
  onVariantChange: (variantId: string) => void;
  activityCoverage: number;
  connectionCoverage: number;
  onActivityCoverageChange: (value: number) => void;
  onConnectionCoverageChange: (value: number) => void;
  selectedActivity: ProcessActivityAggregate | null;
  selectedTransition: ProcessTransitionAggregate | null;
}

function humanize(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
}

function formatDuration(ms: number | null, es: boolean): string {
  if (ms == null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} ${es ? "días" : "days"}`;
}

export function TaskProcessExplorerPanel({
  locale,
  model,
  aggregate,
  eventsTruncated,
  selectedVariantId,
  onVariantChange,
  activityCoverage,
  connectionCoverage,
  onActivityCoverageChange,
  onConnectionCoverageChange,
  selectedActivity,
  selectedTransition,
}: TaskProcessExplorerPanelProps) {
  const es = locale === "es";
  return (
    <aside className="flex h-auto max-h-[42%] w-full shrink-0 flex-col border-b border-border bg-card/90 lg:h-full lg:max-h-none lg:w-[310px] lg:border-b-0 lg:border-r" aria-label={es ? "Controles del proceso" : "Process controls"}>
      <div className="border-b border-border p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Route className="h-3.5 w-3.5 text-brand-600" aria-hidden />
          {es ? "Ciclo observado de tareas" : "Observed task lifecycle"}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {aggregate.visibleCaseCount} {es ? "casos" : "cases"} · {aggregate.visibleEventCount} {es ? "eventos de negocio" : "business events"}
        </p>
        <p className="mt-1 text-[9px] text-muted-foreground">
          {es
            ? "Orden directo observado; no representa dependencias planificadas."
            : "Observed direct-follow order; not planned dependencies."}
        </p>
      </div>

      <div className="space-y-3 border-b border-border p-3">
        <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex justify-between"><span>{es ? "Cobertura de actividades" : "Activity coverage"}</span><span>{activityCoverage}%</span></span>
          <input type="range" min={10} max={100} step={10} value={activityCoverage} onChange={(event) => onActivityCoverageChange(Number(event.target.value))} className="mt-1 w-full accent-emerald-600" />
        </label>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex justify-between"><span>{es ? "Cobertura de conexiones" : "Connection coverage"}</span><span>{connectionCoverage}%</span></span>
          <input type="range" min={10} max={100} step={10} value={connectionCoverage} onChange={(event) => onConnectionCoverageChange(Number(event.target.value))} className="mt-1 w-full accent-emerald-600" />
        </label>
        <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {es ? "Menos cobertura conserva las rutas más frecuentes y evita el mapa ilegible." : "Lower coverage keeps the most frequent paths and avoids an unreadable map."}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><GitFork className="h-3.5 w-3.5 text-brand-600" />{es ? "Variantes" : "Variants"}</p>
            <span className="text-[10px] text-muted-foreground">{model.variants.variants.length}</span>
          </div>
          <div className="mt-2 space-y-1">
            <button type="button" onClick={() => onVariantChange("all")} className={`w-full rounded-md border px-2 py-1.5 text-left text-[10px] ${selectedVariantId === "all" ? "border-brand-500 bg-brand-500/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}>
              {es ? "Todas las variantes" : "All variants"}
            </button>
            {model.variants.variants.slice(0, 10).map((variant, index) => (
              <button key={variant.variantId} type="button" onClick={() => onVariantChange(variant.variantId)} className={`w-full rounded-md border px-2 py-1.5 text-left ${selectedVariantId === variant.variantId ? "border-brand-500 bg-brand-500/10" : "border-transparent hover:bg-muted"}`}>
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-semibold text-foreground">#{index + 1} · {variant.caseCount} {es ? "casos" : "cases"}</span>
                  <span className="text-muted-foreground">{variant.frequencyPct}%</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[9px] text-muted-foreground" title={variant.signature.map(humanize).join(" → ")}>
                  {variant.signature.slice(0, 5).map(humanize).join(" → ")}{variant.signature.length > 5 ? " …" : ""}
                </p>
                <p className="mt-1 text-[9px] text-muted-foreground">{formatDuration(variant.medianDurationMs, es)} · {Math.round(variant.reworkRate * 100)}% {es ? "retrabajo" : "rework"}</p>
              </button>
            ))}
            {model.variants.variants.length === 0 && <p className="py-3 text-center text-[10px] text-muted-foreground">{es ? "No hay suficientes eventos para descubrir variantes." : "Not enough events to discover variants."}</p>}
          </div>
        </div>

        {(selectedActivity || selectedTransition) && (
          <div className="space-y-2 border-b border-border p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Activity className="h-3.5 w-3.5 text-brand-600" />{es ? "Selección" : "Selection"}</p>
            {selectedActivity && (
              <dl className="space-y-1 text-[10px] text-muted-foreground">
                <div><dt className="font-medium text-foreground">{humanize(selectedActivity.eventType)}</dt></div>
                <div className="flex justify-between gap-2"><dt>{es ? "Casos" : "Cases"}</dt><dd>{selectedActivity.caseCount} ({selectedActivity.caseCoveragePct}%)</dd></div>
                <div className="flex justify-between gap-2"><dt>{es ? "Ocurrencias" : "Occurrences"}</dt><dd>{selectedActivity.eventCount}</dd></div>
                <div className="flex justify-between gap-2"><dt>{es ? "Inicios / finales" : "Starts / ends"}</dt><dd>{selectedActivity.startCaseCount} / {selectedActivity.endCaseCount}</dd></div>
              </dl>
            )}
            {selectedTransition && (
              <dl className="space-y-1 text-[10px] text-muted-foreground">
                <div><dt className="font-medium text-foreground">{humanize(selectedTransition.sourceEventType)} → {humanize(selectedTransition.targetEventType)}</dt></div>
                <div className="flex justify-between gap-2"><dt>{es ? "Casos" : "Cases"}</dt><dd>{selectedTransition.caseCount}</dd></div>
                <div className="flex justify-between gap-2"><dt>{es ? "Ocurrencias" : "Occurrences"}</dt><dd>{selectedTransition.occurrenceCount}</dd></div>
                <div className="flex justify-between gap-2"><dt>{es ? "Mediana" : "Median"}</dt><dd>{formatDuration(selectedTransition.medianDurationMs, es)}</dd></div>
                <p className="pt-1 text-[9px] text-muted-foreground">{es ? "Conexión observada en orden temporal; no es causalidad." : "Observed direct-follow order; not causality."}</p>
              </dl>
            )}
          </div>
        )}

        {(eventsTruncated || model.eventsWithoutTask > 0 || model.eventsWithoutBusinessTime > 0) && (
          <div className="p-3 text-[10px] text-amber-700 dark:text-amber-300">
            <p className="font-semibold">{es ? "Calidad de datos" : "Data quality"}</p>
            {eventsTruncated && <p className="mt-1">{es ? "El registro fue truncado; las variantes y frecuencias reflejan solo los eventos cargados." : "The log was truncated; variants and frequencies reflect only loaded events."}</p>}
            {model.eventsWithoutTask > 0 && <p className="mt-1">{model.eventsWithoutTask} {es ? "eventos no se vincularon a una tarea." : "events were not linked to a task."}</p>}
            {model.eventsWithoutBusinessTime > 0 && <p>{model.eventsWithoutBusinessTime} {es ? "eventos no tienen occurred_at utilizable." : "events lack usable occurred_at."}</p>}
          </div>
        )}
      </div>
    </aside>
  );
}
