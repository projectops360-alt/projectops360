import type { ProcessGraphEntity } from "@/lib/pmo-process-intelligence/process-graph.types";

function money(value: number | null | undefined): string {
  if (value == null) return "—";
  const absolute = Math.abs(value);
  const compact =
    absolute >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : absolute >= 1_000
        ? `${(value / 1_000).toFixed(1)}K`
        : Math.round(value).toString();
  return `$${compact}`;
}

function duration(value: number | null | undefined): string {
  if (value == null) return "—";
  const hours = value / 3_600_000;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function ProcessNodeTooltip({
  entity,
  locale,
}: {
  entity: ProcessGraphEntity;
  locale: "en" | "es";
}) {
  const es = locale === "es";
  const metrics = entity.metrics;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-80 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xl"
    >
      <p className="text-xs font-bold text-slate-950">{entity.label}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-600">
        {entity.definition}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        {entity.kind === "stage" ? (
          <>
            <Metric label={es ? "Activos" : "Active"} value={metrics.activeProjectCount} />
            <Metric label="Cycle time" value={duration(metrics.cycleTimeMs)} />
            <Metric label={es ? "Objetivo" : "Target"} value={duration(metrics.targetCycleTimeMs)} />
            <Metric label={es ? "Fuera de SLA" : "Outside SLA"} value={metrics.outsideSlaProjectCount} />
            <Metric label={es ? "Retrabajo" : "Rework"} value={metrics.reworkOccurrences} />
            <Metric label={es ? "Budget" : "Budget"} value={money(metrics.approvedBudget)} />
            <Metric label={es ? "Costo real" : "Actual cost"} value={money(metrics.actualCost)} />
            <Metric
              label={es ? "Budget consumido" : "Budget consumed"}
              value={
                metrics.budgetConsumedPct == null
                  ? "—"
                  : `${metrics.budgetConsumedPct.toFixed(1)}%`
              }
            />
            <Metric label="EAC" value={money(metrics.eac)} />
            <Metric label={es ? "Riesgos" : "Risks"} value={metrics.criticalRisks} />
            <Metric
              label={es ? "Recursos sobreasignados" : "Overallocated resources"}
              value={metrics.overallocatedResources}
            />
            <Metric
              label={es ? "Tendencia" : "Trend"}
              value={metrics.trend?.replaceAll("_", " ") ?? "—"}
            />
            <Metric
              label={es ? "Calidad" : "Data quality"}
              value={
                metrics.dataQualityScore == null
                  ? "—"
                  : `${Math.round(metrics.dataQualityScore * 100)}%`
              }
            />
          </>
        ) : entity.kind === "project" ? (
          <>
            <Metric label="Health" value={metrics.healthScore == null ? "—" : `${metrics.healthScore}/100`} />
            <Metric label={es ? "Avance" : "Progress"} value={metrics.progressPercent == null ? "—" : `${metrics.progressPercent}%`} />
            <Metric
              label={es ? "Fin previsto" : "Forecast finish"}
              value={metrics.forecastFinish ?? "—"}
            />
            <Metric label={es ? "Prob. retraso" : "Delay probability"} value={metrics.delayProbabilityPct == null ? "—" : `${metrics.delayProbabilityPct}%`} />
            <Metric label="Budget" value={money(metrics.approvedBudget)} />
            <Metric label={es ? "Costo real" : "Actual cost"} value={money(metrics.actualCost)} />
            <Metric label="EAC" value={money(metrics.eac)} />
            <Metric label="CPI" value={metrics.cpi?.toFixed(2) ?? "—"} />
            <Metric label="SPI" value={metrics.spi?.toFixed(2) ?? "—"} />
            <Metric label={es ? "Riesgos críticos" : "Critical risks"} value={metrics.criticalRisks} />
            <Metric label={es ? "Sobrecarga" : "Overallocated"} value={metrics.overallocatedResources} />
            <Metric
              label={es ? "Project Manager" : "Project Manager"}
              value={metrics.projectManager ?? "—"}
            />
          </>
        ) : (
          <>
            <Metric label={es ? "Avance" : "Progress"} value={metrics.progressPercent == null ? "—" : `${metrics.progressPercent}%`} />
            <Metric label={es ? "Estimado" : "Estimate"} value={metrics.estimateHours == null ? "—" : `${metrics.estimateHours}h`} />
            <Metric label={es ? "Real" : "Actual"} value={metrics.actualHours == null ? "—" : `${metrics.actualHours}h`} />
            <Metric label={es ? "Estado" : "Status"} value={entity.status.replaceAll("_", " ")} />
          </>
        )}
      </dl>
      <p className="mt-2 border-t border-slate-200 pt-2 text-[10px] font-medium text-slate-500">
        {es
          ? "Click: seleccionar · Doble click: profundizar · Arrastrar: reposicionar"
          : "Click: select · Double click: drill down · Drag: reposition"}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900">
        {value == null ? "—" : value}
      </dd>
    </>
  );
}
