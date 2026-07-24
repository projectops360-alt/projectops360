"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  ExternalLink,
  Gauge,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import {
  executiveStageLabel,
  type PmoPiExecutiveProject,
} from "@/lib/pmo-process-intelligence/executive-projection";

function money(value: number | null, locale: "en" | "es") {
  if (value == null) return locale === "es" ? "No disponible" : "Unavailable";
  return new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function value(value: string | number | null, locale: "en" | "es") {
  if (value == null || value === "") {
    return locale === "es" ? "No disponible" : "Unavailable";
  }
  return String(value);
}

function duration(valueMs: number | null, locale: "en" | "es") {
  if (valueMs == null) return locale === "es" ? "No disponible" : "Unavailable";
  const days = valueMs / 86_400_000;
  return days >= 1 ? `${days.toFixed(1)} d` : `${(valueMs / 3_600_000).toFixed(1)} h`;
}

export function ProjectExecutiveDrawer({
  project,
  locale,
  base,
  focusHref,
  onClose,
}: {
  project: PmoPiExecutiveProject;
  locale: "en" | "es";
  base: string;
  focusHref: string;
  onClose: () => void;
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={tt("Project executive detail", "Detalle ejecutivo del proyecto")}
      className="fixed inset-x-3 bottom-3 top-20 z-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:left-auto sm:w-[440px]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {tt("Executive project view", "Vista ejecutiva del proyecto")}
          </p>
          <h2 className="text-xl font-bold text-slate-950">{project.title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {executiveStageLabel(project.currentStage, locale)} ·{" "}
            {project.status}
          </p>
        </div>
        <button
          type="button"
          aria-label={tt("Close", "Cerrar")}
          onClick={onClose}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SummaryCard
          icon={<Gauge className="h-4 w-4 text-emerald-700" />}
          label={tt("Project Health Score", "Project Health Score")}
          value={`${project.healthScore}/100`}
        />
        <SummaryCard
          icon={<Activity className="h-4 w-4 text-blue-700" />}
          label={tt("Process events", "Eventos de proceso")}
          value={String(project.processEventCount)}
        />
        <SummaryCard
          icon={<CalendarClock className="h-4 w-4 text-amber-700" />}
          label={tt("Cycle time", "Cycle time")}
          value={duration(project.cycleTimeMs, locale)}
        />
        <SummaryCard
          icon={<ShieldAlert className="h-4 w-4 text-red-700" />}
          label={tt("Delay probability", "Probabilidad de retraso")}
          value={
            project.delayProbabilityPct == null
              ? tt("Unavailable", "No disponible")
              : `${project.delayProbabilityPct}%`
          }
        />
      </div>

      <Section title={tt("Governance", "Gobernanza")} icon={<Users className="h-4 w-4" />}>
        <Row label={tt("Project Manager", "Project Manager")} value={value(project.projectManager, locale)} />
        <Row label={tt("Sponsor", "Sponsor")} value={value(project.sponsor, locale)} />
        <Row label={tt("Portfolio", "Portafolio")} value={tt("Not configured", "No configurado")} />
        <Row label={tt("Program", "Programa")} value={tt("Not configured", "No configurado")} />
        <Row label={tt("Forecast finish", "Forecast finish")} value={value(project.forecastFinish, locale)} />
      </Section>

      <Section
        title={tt("Financial control", "Control financiero")}
        icon={<CircleDollarSign className="h-4 w-4" />}
      >
        <Row label={tt("Original budget", "Presupuesto original")} value={money(project.originalBudget, locale)} />
        <Row label={tt("Current baseline", "Baseline vigente")} value={money(project.currentBaseline, locale)} />
        <Row label={tt("Approved budget", "Presupuesto aprobado")} value={money(project.approvedBudget, locale)} />
        <Row label={tt("Committed Cost", "Committed Cost")} value={money(project.committedCost, locale)} />
        <Row label={tt("Actual Cost", "Actual Cost")} value={money(project.actualCost, locale)} />
        <Row label={tt("Accrued Cost", "Accrued Cost")} value={money(project.accruedCost, locale)} />
        <Row label="ETC" value={money(project.etc, locale)} />
        <Row label="EAC" value={money(project.eac, locale)} />
        <Row label="VAC" value={money(project.vac, locale)} />
        <Row label="CPI" value={project.cpi?.toFixed(2) ?? tt("Unavailable", "No disponible")} />
        <Row label="SPI" value={project.spi?.toFixed(2) ?? tt("Unavailable", "No disponible")} />
        <Row label={tt("Contingency", "Contingencia")} value={money(project.contingency, locale)} />
        <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
          {tt(
            "Actuals, commitments and accruals are shown separately and are never added together.",
            "Actuals, commitments y accruals se muestran por separado y nunca se suman entre sí.",
          )}
        </p>
      </Section>

      <Section title={tt("Execution exposure", "Exposición de ejecución")} icon={<ShieldAlert className="h-4 w-4" />}>
        <Row label={tt("Critical risks", "Riesgos críticos")} value={String(project.criticalRisks)} />
        <Row label={tt("Active risks", "Riesgos activos")} value={String(project.activeRisks)} />
        <Row label={tt("Overallocated resources", "Recursos sobreasignados")} value={String(project.overallocatedResources)} />
        <Row label={tt("Dependencies", "Dependencias")} value={String(project.dependencyCount)} />
        <Row label={tt("Benefits", "Beneficios")} value={tt("Not configured", "No configurados")} />
      </Section>

      <Section title={tt("Latest significant events", "Últimos eventos significativos")} icon={<Activity className="h-4 w-4" />}>
        <ol className="space-y-2">
          {project.latestSignificantEvents.map((event, index) => (
            <li key={`${event.occurredAt}:${index}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-800">
                {tt("Movement in", "Movimiento en")}{" "}
                {executiveStageLabel(event.stage, locale)}
              </span>
              <time className="text-slate-500">
                {new Date(event.occurredAt).toLocaleDateString(
                  locale === "es" ? "es-US" : "en-US",
                )}
              </time>
            </li>
          ))}
          {project.latestSignificantEvents.length === 0 ? (
            <li className="text-xs text-slate-500">
              {tt("No significant events available.", "No hay eventos significativos disponibles.")}
            </li>
          ) : null}
        </ol>
      </Section>

      <div className="sticky bottom-0 mt-5 grid gap-2 border-t border-slate-200 bg-white pt-4 sm:grid-cols-2">
        <Link
          href={focusHref}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          {tt("Focus on Project", "Focus on Project")}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={`${base}/projects/${project.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          {tt("Open Project", "Abrir proyecto")}
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-600">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        {icon}
        {title}
      </h3>
      <div className="mt-2 rounded-xl border border-slate-200 p-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 text-xs last:border-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-right font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
