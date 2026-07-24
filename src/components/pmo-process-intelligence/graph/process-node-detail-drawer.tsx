"use client";

import Link from "next/link";
import {
  Bot,
  ChevronRight,
  ExternalLink,
  FileSearch,
  X,
} from "lucide-react";
import type {
  ProcessGraphConnection,
  ProcessGraphEntity,
} from "@/lib/pmo-process-intelligence/process-graph.types";

export function ProcessNodeDetailDrawer({
  locale,
  entity,
  connection,
  onClose,
  onDrillDown,
  onAskIsabella,
}: {
  locale: "en" | "es";
  entity: ProcessGraphEntity | null;
  connection: ProcessGraphConnection | null;
  onClose: () => void;
  onDrillDown: () => void;
  onAskIsabella: () => void;
}) {
  if (!entity && !connection) return null;
  const es = locale === "es";
  return (
    <aside className="absolute inset-y-3 right-3 z-40 flex w-[min(420px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
            {entity
              ? `${entity.kind} · ${es ? "detalle" : "detail"}`
              : es
                ? "Conexión seleccionada"
                : "Selected connection"}
          </p>
          <h2 className="mt-1 truncate text-lg font-extrabold text-slate-950">
            {entity?.label ?? connection?.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={es ? "Cerrar detalles" : "Close details"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {entity ? (
          <>
            <Answer
              question={es ? "¿Qué es este nodo?" : "What is this node?"}
              answer={entity.definition}
            />
            <Answer
              question={es ? "¿Qué representa?" : "What does it represent?"}
              answer={
                es
                  ? `${entity.includedEntityIds.length} entidades autorizadas dentro de esta proyección.`
                  : `${entity.includedEntityIds.length} authorized entities inside this projection.`
              }
            />
            <Answer
              question={es ? "¿Por qué importa?" : "Why does it matter?"}
              answer={whyItMatters(entity, locale)}
            />
            <Answer
              question={es ? "¿Qué cambió?" : "What changed?"}
              answer={whatChanged(entity, locale)}
            />
            <Answer
              question={es ? "¿Dónde está el problema?" : "Where is the problem?"}
              answer={whereIsTheProblem(entity, locale)}
            />
            <Answer
              question={es ? "¿Cuál es el impacto?" : "What is the impact?"}
              answer={impactSummary(entity, locale)}
            />
            <Metrics entity={entity} locale={locale} />
            <Evidence evidence={entity.evidence} locale={locale} />
            <Answer
              question={
                es ? "¿Qué puede hacer el usuario?" : "What can the user do?"
              }
              answer={
                es
                  ? "Seleccionar relaciones, profundizar cuando exista un nivel inferior, abrir el registro canónico, revisar evidencia o preguntar a Isabella con este contexto."
                  : "Select relationships, drill down when a lower level exists, open the canonical record, inspect evidence, or ask Isabella with this context."
              }
            />
          </>
        ) : connection ? (
          <>
            <Answer
              question={es ? "¿Qué representa?" : "What does it represent?"}
              answer={
                es
                  ? `Ruta ${connection.kind} entre ${connection.sourceLabel} y ${connection.targetLabel}.`
                  : `${connection.kind} route from ${connection.sourceLabel} to ${connection.targetLabel}.`
              }
            />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs">
              <Metric label={es ? "Proyectos" : "Projects"} value={connection.projectIds.length} />
              <Metric label={es ? "Casos" : "Cases"} value={connection.caseCount} />
              <Metric label={es ? "Transiciones" : "Transitions"} value={connection.transitionCount} />
              <Metric label={es ? "Frecuencia" : "Frequency"} value={connection.frequency} />
              <Metric label={es ? "Retrabajo" : "Rework"} value={connection.reworkCount} />
              <Metric label={es ? "Calidad" : "Data quality"} value={`${Math.round(connection.dataQualityScore * 100)}%`} />
            </dl>
            <Evidence evidence={connection.evidence} locale={locale} />
          </>
        ) : null}
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-slate-200 p-4">
        {entity && entity.kind !== "activity" ? (
          <button
            type="button"
            onClick={onDrillDown}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            {es ? "Profundizar" : "Drill down"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {entity?.href ? (
          <Link
            href={entity.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            {es ? "Abrir registro" : "Open record"}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onAskIsabella}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100"
        >
          <Bot className="h-3.5 w-3.5" />
          {es ? "Preguntar a Isabella" : "Ask Isabella"}
        </button>
      </footer>
    </aside>
  );
}

function whyItMatters(
  entity: ProcessGraphEntity,
  locale: "en" | "es",
): string {
  const es = locale === "es";
  if (entity.kind === "stage") {
    return es
      ? "Concentra el desempeño de los proyectos que actualmente se encuentran en esta etapa del proceso."
      : "It concentrates the performance of projects currently in this process stage.";
  }
  if (entity.kind === "project") {
    return es
      ? "Conecta el flujo operativo con costo, riesgo, recursos y resultados del proyecto autorizado."
      : "It connects operational flow with cost, risk, resources, and outcomes for the authorized project.";
  }
  return es
    ? "Aterriza el desempeño ejecutivo en trabajo canónico que puede verificarse y gestionarse."
    : "It grounds executive performance in canonical work that can be verified and managed.";
}

function whatChanged(
  entity: ProcessGraphEntity,
  locale: "en" | "es",
): string {
  const es = locale === "es";
  const trend = entity.metrics.trend;
  if (trend && trend !== "unavailable") {
    return es
      ? `La tendencia agregada disponible es ${trend}. El estado actual es ${entity.status.replaceAll("_", " ")}.`
      : `The available aggregate trend is ${trend}. Current status is ${entity.status.replaceAll("_", " ")}.`;
  }
  return es
    ? `El estado actual es ${entity.status.replaceAll("_", " ")}. Esta proyección no atribuye un cambio temporal cuando no existe evidencia comparable.`
    : `Current status is ${entity.status.replaceAll("_", " ")}. This projection does not claim a temporal change without comparable evidence.`;
}

function whereIsTheProblem(
  entity: ProcessGraphEntity,
  locale: "en" | "es",
): string {
  const es = locale === "es";
  const signals = [
    (entity.metrics.criticalRisks ?? 0) > 0
      ? `${entity.metrics.criticalRisks} ${es ? "riesgos críticos" : "critical risks"}`
      : null,
    (entity.metrics.overallocatedResources ?? 0) > 0
      ? `${entity.metrics.overallocatedResources} ${es ? "recursos sobreasignados" : "overallocated resources"}`
      : null,
    (entity.metrics.reworkOccurrences ?? 0) > 0
      ? `${entity.metrics.reworkOccurrences} ${es ? "ocurrencias de retrabajo" : "rework occurrences"}`
      : null,
    entity.status === "blocked"
      ? es
        ? "estado bloqueado"
        : "blocked status"
      : null,
  ].filter((value): value is string => value !== null);
  return signals.length > 0
    ? signals.join(" · ")
    : es
      ? "No hay una señal crítica verificable en las métricas visibles."
      : "No critical signal is verifiable in the visible metrics.";
}

function impactSummary(
  entity: ProcessGraphEntity,
  locale: "en" | "es",
): string {
  const es = locale === "es";
  const variance = entity.metrics.forecastVariance;
  const outsideSla = entity.metrics.outsideSlaProjectCount;
  const parts = [
    variance == null
      ? null
      : `${es ? "variación prevista" : "forecast variance"}: ${Math.round(variance)}`,
    outsideSla == null
      ? null
      : `${outsideSla} ${es ? "proyectos fuera de SLA" : "projects outside SLA"}`,
    entity.metrics.delayProbabilityPct == null
      ? null
      : `${es ? "probabilidad de retraso" : "delay probability"}: ${entity.metrics.delayProbabilityPct}%`,
  ].filter((value): value is string => value !== null);
  return parts.length > 0
    ? parts.join(" · ")
    : es
      ? "El impacto cuantitativo adicional no está disponible en esta proyección."
      : "Additional quantitative impact is not available in this projection.";
}

function Answer({ question, answer }: { question: string; answer: string }) {
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-950">{question}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{answer}</p>
    </section>
  );
}

function Metrics({
  entity,
  locale,
}: {
  entity: ProcessGraphEntity;
  locale: "en" | "es";
}) {
  const es = locale === "es";
  const values = Object.entries(entity.metrics).filter(
    ([, value]) => value !== undefined,
  );
  return (
    <section>
      <h3 className="text-xs font-bold text-slate-950">
        {es ? "Impacto y métricas" : "Impact and metrics"}
      </h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs">
        {values.map(([key, value]) => (
          <Metric
            key={key}
            label={key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}
            value={
              typeof value === "number"
                ? Number.isInteger(value)
                  ? value
                  : value.toFixed(2)
                : value == null
                  ? "—"
                  : String(value)
            }
          />
        ))}
      </dl>
    </section>
  );
}

function Evidence({
  evidence,
  locale,
}: {
  evidence: readonly string[];
  locale: "en" | "es";
}) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-950">
        <FileSearch className="h-3.5 w-3.5" />
        {locale === "es" ? "Evidencia" : "Evidence"}
      </h3>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {evidence.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <>
      <dt className="capitalize text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900">{value}</dd>
    </>
  );
}
