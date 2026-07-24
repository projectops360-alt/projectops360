"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  GitPullRequestArrow,
  ShieldAlert,
} from "lucide-react";
import {
  executiveStageLabel,
  type PmoPiExecutivePortfolioModel,
  type PmoPiExecutiveStage,
  type PmoPiExecutiveStageKey,
  type PmoPiExecutiveStatus,
} from "@/lib/pmo-process-intelligence/executive-projection";
import type { PmoPiFilters } from "@/lib/pmo-process-intelligence/contracts";

type ExecutiveOverlay = Exclude<PmoPiFilters["overlay"], "whatif">;

const CANVAS_WIDTH = 1160;
const CANVAS_HEIGHT = 540;
const NODE_WIDTH = 156;
const NODE_HEIGHT = 86;
const MAIN_Y = 164;
const STAGE_X: Record<PmoPiExecutiveStageKey, number> = {
  initiate: 70,
  plan: 294,
  execute: 518,
  control: 742,
  close: 966,
};

const STATUS_COLOR: Record<PmoPiExecutiveStatus, string> = {
  on_target: "#059669",
  stable: "#2563eb",
  attention: "#d97706",
  critical: "#dc2626",
  insufficient: "#64748b",
};

const STATUS_FILL: Record<PmoPiExecutiveStatus, string> = {
  on_target: "#ecfdf5",
  stable: "#eff6ff",
  attention: "#fffbeb",
  critical: "#fef2f2",
  insufficient: "#f8fafc",
};

function money(value: number, locale: "en" | "es") {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const [scaled, suffix] =
    absolute >= 1_000_000_000
      ? [absolute / 1_000_000_000, "B"]
      : absolute >= 1_000_000
        ? [absolute / 1_000_000, "M"]
        : absolute >= 1_000
          ? [absolute / 1_000, "K"]
          : [absolute, ""];
  const digits = suffix && scaled < 100 ? 1 : 0;
  const formatted = scaled.toFixed(digits).replace(/\.0$/, "");
  return `${sign}${locale === "es" ? "US$" : "$"}${formatted}${suffix}`;
}

function duration(value: number | null, locale: "en" | "es") {
  if (value == null) return locale === "es" ? "Sin datos" : "No data";
  const hours = value / 3_600_000;
  if (hours >= 48) return `${(hours / 24).toFixed(1)} d`;
  if (hours >= 1) return `${hours.toFixed(1)} h`;
  return `${Math.round(value / 60_000)} min`;
}

function statusLabel(status: PmoPiExecutiveStatus, locale: "en" | "es") {
  const labels: Record<PmoPiExecutiveStatus, { en: string; es: string }> = {
    on_target: { en: "On target", es: "En objetivo" },
    stable: { en: "Stable", es: "Estable" },
    attention: { en: "Attention", es: "Atención" },
    critical: { en: "Critical", es: "Crítico" },
    insufficient: { en: "Insufficient", es: "Sin datos" },
  };
  return labels[status][locale];
}

function overlayStatus(
  stage: PmoPiExecutiveStage,
  overlay: ExecutiveOverlay,
): PmoPiExecutiveStatus {
  if (overlay === "risk") {
    if (stage.activeRisks >= 8) return "critical";
    if (stage.activeRisks > 0) return "attention";
    return stage.projectCount > 0 ? "on_target" : "insufficient";
  }
  if (overlay === "finance") {
    if (stage.eac <= 0 && stage.actualCost <= 0) return "insufficient";
    if (stage.forecastVariance < 0) return "critical";
    return "on_target";
  }
  if (overlay === "resources") {
    if (stage.overallocatedResources >= 3) return "critical";
    if (stage.overallocatedResources > 0) return "attention";
    return stage.projectCount > 0 ? "stable" : "insufficient";
  }
  return stage.status;
}

function stageOverlayMetric(
  stage: PmoPiExecutiveStage,
  model: PmoPiExecutivePortfolioModel,
  overlay: ExecutiveOverlay,
  locale: "en" | "es",
) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  if (overlay === "finance") {
    return {
      primary: `${money(stage.actualCost, locale)} / ${money(stage.eac, locale)}`,
      secondary: `${tt("Forecast variance", "Variación prevista")}: ${money(stage.forecastVariance, locale)}`,
    };
  }
  if (overlay === "risk") {
    return {
      primary: `${stage.activeRisks} ${tt("active risks", "riesgos activos")}`,
      secondary: `${stage.reworkOccurrences} ${tt("rework events", "eventos de retrabajo")}`,
    };
  }
  if (overlay === "resources") {
    return {
      primary: `${stage.overallocatedResources} ${tt("overallocated", "sobreasignados")}`,
      secondary: `${stage.activeProjectCount} ${tt("active projects", "proyectos activos")}`,
    };
  }
  if (overlay === "dependencies") {
    const dependencies = model.projects
      .filter((project) => project.currentStage === stage.key)
      .reduce((sum, project) => sum + project.dependencyCount, 0);
    return {
      primary: `${dependencies} ${tt("dependencies", "dependencias")}`,
      secondary: `${stage.projectCount} ${tt("projects exposed", "proyectos expuestos")}`,
    };
  }
  if (overlay === "benefits") {
    return {
      primary: tt("No canonical model", "Sin modelo canónico"),
      secondary: tt("Benefits are not inferred", "No se infieren beneficios"),
    };
  }
  return {
    primary: duration(stage.averageCycleTimeMs, locale),
    secondary: `${stage.reworkOccurrences} ${tt("rework events", "eventos de retrabajo")}`,
  };
}

function compactVariantPath(path: PmoPiExecutiveStageKey[]) {
  const compact: PmoPiExecutiveStageKey[] = [];
  for (const stage of path) {
    if (compact.at(-1) !== stage) compact.push(stage);
    if (compact.length === 7) break;
  }
  return compact;
}

export function ExecutivePortfolioFlow({
  model,
  locale,
  overlay = "process",
  selectedStage,
  onSelectStage,
  onShowProjects,
}: {
  model: PmoPiExecutivePortfolioModel;
  locale: "en" | "es";
  overlay?: ExecutiveOverlay;
  selectedStage: PmoPiExecutiveStageKey | null;
  onSelectStage: (stage: PmoPiExecutiveStageKey | null) => void;
  onShowProjects: (projectIds: string[]) => void;
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const [showRework, setShowRework] = useState(false);
  const primaryBottleneck = model.bottlenecks[0] ?? null;
  const totalRework = model.stages.reduce(
    (sum, stage) => sum + stage.reworkOccurrences,
    0,
  );
  const maxFrequency = Math.max(
    1,
    ...model.connections.map((connection) => connection.frequency),
  );
  const reworkProjects = useMemo(
    () =>
      new Set(
        model.reworkLoops.flatMap((loop) =>
          model.stages
            .find((stage) => stage.key === loop.to)
            ?.projectIds.slice(0, loop.affectedProjectCount) ?? [],
        ),
      ),
    [model.reworkLoops, model.stages],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            {tt("Portfolio execution process map", "Mapa del proceso de ejecución del portafolio")}
          </h2>
          <p className="text-sm text-slate-600">
            {tt(
              "Real project routes aggregated into business stages. Line thickness represents observed frequency.",
              "Rutas reales de proyectos agregadas en etapas de negocio. El grosor representa la frecuencia observada.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700">
            {tt("Overlay", "Capa")}: {overlay}
          </span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
            {tt("Portfolio health", "Salud")}: <strong>{model.portfolioHealthScore ?? "—"}/100</strong>
          </span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-700">
            {tt("Data quality", "Calidad")}: {Math.round(model.dataQualityScore * 100)}%
          </span>
        </div>
      </div>

      {primaryBottleneck ? (
        <section className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
            <p className="text-sm text-slate-800">
              <strong>{tt("Primary bottleneck", "Principal cuello de botella")}:</strong>{" "}
              {executiveStageLabel(primaryBottleneck.stage, locale)} ·{" "}
              {primaryBottleneck.affectedProjectCount} {tt("affected projects", "proyectos afectados")} ·{" "}
              {duration(primaryBottleneck.averageWaitMs, locale)} {tt("average wait", "de espera promedio")} ·{" "}
              {money(primaryBottleneck.financialImpact, locale)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onShowProjects(primaryBottleneck.affectedProjectIds)}
            className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            {tt("View projects", "Ver proyectos")}
          </button>
        </section>
      ) : null}

      <section
        aria-label={tt("Executive BPM process map", "Mapa BPM ejecutivo")}
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,_#ffffff,_#f8fafc)] shadow-sm"
      >
        <svg
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="min-w-[980px]"
          role="img"
          aria-labelledby="executive-process-title executive-process-description"
        >
          <title id="executive-process-title">
            {tt("Executive portfolio BPM process", "Proceso BPM ejecutivo del portafolio")}
          </title>
          <desc id="executive-process-description">
            {tt(
              "Five business stages connected by observed project flow, with up to three variants and optional rework loops.",
              "Cinco etapas de negocio conectadas por el flujo observado de proyectos, con hasta tres variantes y loops de retrabajo opcionales.",
            )}
          </desc>
          <defs>
            {Object.entries(STATUS_COLOR).map(([status, color]) => (
              <marker
                key={status}
                id={`arrow-${status}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            ))}
            <marker id="arrow-variant" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
            <marker id="arrow-rework" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
            </marker>
          </defs>

          <text x="24" y="28" className="fill-slate-500 text-[11px] font-semibold uppercase tracking-[0.18em]">
            {tt("Observed main route", "Ruta principal observada")}
          </text>

          {model.stages.map((stage, index) => {
            const x = STAGE_X[stage.key];
            const nextStage = model.stages[index + 1];
            const phaseWidth = index === model.stages.length - 1 ? 176 : 202;
            return (
              <g key={`phase-${stage.key}`}>
                <path
                  d={`M ${x - 12} 44 H ${x + phaseWidth - 22} L ${x + phaseWidth - 4} 70 L ${x + phaseWidth - 22} 96 H ${x - 12} Z`}
                  fill={index % 2 === 0 ? "#ecfdf5" : "#eff6ff"}
                  stroke={index % 2 === 0 ? "#a7f3d0" : "#bfdbfe"}
                />
                <text x={x + 8} y="66" className="fill-slate-500 text-[10px] font-semibold">
                  0{index + 1}
                </text>
                <text x={x + 8} y="84" className="fill-slate-900 text-[13px] font-bold">
                  {executiveStageLabel(stage.key, locale).toUpperCase()}
                </text>
                {nextStage ? (
                  <text x={x + phaseWidth - 36} y="84" className="fill-slate-400 text-[12px]">›</text>
                ) : null}
              </g>
            );
          })}

          <circle cx="28" cy={MAIN_Y + NODE_HEIGHT / 2} r="17" fill="#ffffff" stroke="#059669" strokeWidth="3" />
          <path d={`M 23 ${MAIN_Y + NODE_HEIGHT / 2} l 10 0 l -5 -5 m 5 5 l -5 5`} fill="none" stroke="#059669" strokeWidth="2" />

          {model.connections.map((connection) => {
            const fromX = STAGE_X[connection.from] + NODE_WIDTH;
            const toX = STAGE_X[connection.to];
            const y = MAIN_Y + NODE_HEIGHT / 2;
            const width = 2.5 + (connection.frequency / maxFrequency) * 8;
            const status = connection.status;
            const curve = Math.max(34, Math.abs(toX - fromX) * 0.35);
            return (
              <g key={`${connection.from}:${connection.to}`}>
                <path
                  d={`M ${fromX} ${y} C ${fromX + curve} ${y}, ${toX - curve} ${y}, ${toX} ${y}`}
                  fill="none"
                  stroke={STATUS_COLOR[status]}
                  strokeWidth={width}
                  strokeLinecap="round"
                  opacity="0.78"
                  markerEnd={`url(#arrow-${status})`}
                />
                <rect x={(fromX + toX) / 2 - 24} y={y - 25} width="48" height="18" rx="9" fill="#ffffff" stroke="#cbd5e1" />
                <text x={(fromX + toX) / 2} y={y - 12} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">
                  {connection.projectCount} · {connection.frequency}x
                </text>
              </g>
            );
          })}

          {model.stages.map((stage) => (
            <StageNode
              key={stage.key}
              stage={stage}
              model={model}
              locale={locale}
              overlay={overlay}
              selected={selectedStage === stage.key}
              bottleneck={primaryBottleneck?.stage === stage.key}
              onSelect={() => onSelectStage(selectedStage === stage.key ? null : stage.key)}
            />
          ))}

          <line x1="24" x2={CANVAS_WIDTH - 24} y1="294" y2="294" stroke="#e2e8f0" />
          <text x="24" y="320" className="fill-slate-500 text-[11px] font-semibold uppercase tracking-[0.18em]">
            {tt("Process variants", "Variantes del proceso")}
          </text>

          {model.variants.map((variant, index) => {
            const path = compactVariantPath(variant.stagePath);
            const y = 352 + index * 48;
            const points = path.map((stage) => `${STAGE_X[stage] + NODE_WIDTH / 2},${y}`);
            const color = variant.kind === "critical" ? "#dc2626" : index === 0 ? "#059669" : "#64748b";
            return (
              <g key={variant.id}>
                <text x="28" y={y + 4} className="fill-slate-700 text-[11px] font-semibold">
                  {variant.kind === "dominant"
                    ? tt("Dominant", "Dominante")
                    : variant.kind === "secondary"
                      ? tt("Second", "Segunda")
                      : tt("Critical", "Crítica")}
                </text>
                {points.length > 1 ? (
                  <polyline
                    points={points.join(" ")}
                    fill="none"
                    stroke={color}
                    strokeWidth={index === 0 ? 4 : 2.5}
                    strokeDasharray={variant.kind === "critical" ? "7 5" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={index === 0 ? 0.9 : 0.7}
                    markerEnd={variant.kind === "critical" ? "url(#arrow-rework)" : "url(#arrow-variant)"}
                  />
                ) : null}
                {path.map((stage, stageIndex) => (
                  <g key={`${variant.id}:${stage}:${stageIndex}`}>
                    <circle cx={STAGE_X[stage] + NODE_WIDTH / 2} cy={y} r="7" fill="#ffffff" stroke={color} strokeWidth="3" />
                  </g>
                ))}
                <text x={CANVAS_WIDTH - 26} y={y + 4} textAnchor="end" className="fill-slate-600 text-[11px]">
                  {Math.round(variant.sharePct)}% · {variant.projectCount} {tt("projects", "proyectos")} · {duration(variant.averageCycleTimeMs, locale)}
                </text>
              </g>
            );
          })}

          {model.variants.length === 0 ? (
            <text x={CANVAS_WIDTH / 2} y="376" textAnchor="middle" className="fill-slate-500 text-[13px]">
              {tt("No process variants are available in this scope.", "No hay variantes de proceso disponibles en este alcance.")}
            </text>
          ) : null}

          {showRework
            ? model.reworkLoops.slice(0, 3).map((loop, index) => {
                const fromX = STAGE_X[loop.from] + NODE_WIDTH / 2;
                const toX = STAGE_X[loop.to] + NODE_WIDTH / 2;
                const y = MAIN_Y + NODE_HEIGHT + 12;
                const controlY = 278 + index * 10;
                const path = fromX === toX
                  ? `M ${fromX} ${y} C ${fromX + 70} ${controlY}, ${fromX - 70} ${controlY}, ${fromX} ${y}`
                  : `M ${fromX} ${y} Q ${(fromX + toX) / 2} ${controlY} ${toX} ${y}`;
                return (
                  <g key={`${loop.from}:${loop.to}:${index}`}>
                    <path d={path} fill="none" stroke="#dc2626" strokeWidth={2.5 + index} strokeDasharray="8 6" markerEnd="url(#arrow-rework)" />
                    <text x={(fromX + toX) / 2} y={controlY - 5} textAnchor="middle" className="fill-red-700 text-[10px] font-semibold">
                      ↩ {loop.frequency} · {loop.affectedProjectCount} {tt("projects", "proyectos")}
                    </text>
                  </g>
                );
              })
            : null}

          <g transform={`translate(24 ${CANVAS_HEIGHT - 44})`}>
            <line x1="0" x2="35" y1="0" y2="0" stroke="#059669" strokeWidth="5" />
            <text x="44" y="4" className="fill-slate-600 text-[10px]">{tt("Dominant route", "Ruta dominante")}</text>
            <line x1="170" x2="205" y1="0" y2="0" stroke="#64748b" strokeWidth="2.5" />
            <text x="214" y="4" className="fill-slate-600 text-[10px]">{tt("Secondary flow", "Flujo secundario")}</text>
            <line x1="350" x2="385" y1="0" y2="0" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="7 5" />
            <text x="394" y="4" className="fill-slate-600 text-[10px]">{tt("Rework / deviation", "Retrabajo / desviación")}</text>
            <text x={CANVAS_WIDTH - 72} y="4" textAnchor="end" className="fill-slate-500 text-[10px]">
              {tt("Width = frequency", "Grosor = frecuencia")}
            </text>
          </g>
        </svg>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <GitPullRequestArrow className="h-5 w-5 text-slate-500" />
          <p className="text-sm text-slate-700">
            <strong>{totalRework}</strong> {tt("rework events", "eventos de retrabajo")} ·{" "}
            <strong>{reworkProjects.size}</strong> {tt("affected projects", "proyectos afectados")}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={showRework}
          onClick={() => setShowRework((current) => !current)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {showRework ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showRework ? tt("Hide rework loops", "Ocultar loops") : tt("Show rework loops", "Mostrar loops")}
        </button>
      </div>
    </div>
  );
}

function StageNode({
  stage,
  model,
  locale,
  overlay,
  selected,
  bottleneck,
  onSelect,
}: {
  stage: PmoPiExecutiveStage;
  model: PmoPiExecutivePortfolioModel;
  locale: "en" | "es";
  overlay: ExecutiveOverlay;
  selected: boolean;
  bottleneck: boolean;
  onSelect: () => void;
}) {
  const status = overlayStatus(stage, overlay);
  const color = STATUS_COLOR[status];
  const metric = stageOverlayMetric(stage, model, overlay, locale);
  const x = STAGE_X[stage.key];
  const y = MAIN_Y;
  const StatusIcon = status === "critical" ? ShieldAlert : status === "on_target" ? CheckCircle2 : CircleDot;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${executiveStageLabel(stage.key, locale)}: ${stage.projectCount} ${locale === "es" ? "proyectos" : "projects"}`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer outline-none"
    >
      <rect
        x={x}
        y={y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx="16"
        fill={STATUS_FILL[status]}
        stroke={selected ? "#059669" : color}
        strokeWidth={selected ? 4 : 2}
      />
      <rect x={x} y={y} width="8" height={NODE_HEIGHT} rx="4" fill={color} />
      <circle cx={x + 28} cy={y + 24} r="12" fill="#ffffff" stroke={color} strokeWidth="2" />
      <text x={x + 28} y={y + 28} textAnchor="middle" className="fill-slate-900 text-[11px] font-bold">
        {stage.projectCount}
      </text>
      <text x={x + 48} y={y + 22} className="fill-slate-900 text-[14px] font-bold">
        {executiveStageLabel(stage.key, locale)}
      </text>
      <text x={x + 48} y={y + 38} className="fill-slate-500 text-[10px]">
        {stage.activeProjectCount} {locale === "es" ? "activos" : "active"} · {statusLabel(status, locale)}
      </text>
      <text x={x + 18} y={y + 61} className="fill-slate-800 text-[11px] font-semibold">
        {metric.primary}
      </text>
      <text x={x + 18} y={y + 76} className="fill-slate-500 text-[9px]">
        {metric.secondary}
      </text>
      {bottleneck ? (
        <g transform={`translate(${x + NODE_WIDTH - 18} ${y - 6})`}>
          <circle r="12" fill="#fff7ed" stroke="#d97706" strokeWidth="2" />
          <StatusIcon x="-6" y="-6" width="12" height="12" color="#b45309" />
        </g>
      ) : null}
    </g>
  );
}
