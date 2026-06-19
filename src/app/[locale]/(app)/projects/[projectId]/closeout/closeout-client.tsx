"use client";

// ============================================================================
// Project Closeout Report — auto-generated on Closing meeting completion.
// Readiness gate (pre-conditions for closure) + live metrics + AI narrative
// (Plant Pals-style sections), print-to-PDF (like the Status Report).
// Print CSS in globals.css isolates #closeout-report-print.
// ============================================================================

import type { ReactNode } from "react";
import Image from "next/image";
import {
  Download, Sparkles, CalendarClock, DollarSign, ShieldCheck, ListChecks, TrendingUp,
  AlertTriangle, CheckCircle2, XCircle, Trophy, Lightbulb, Wrench, ClipboardList,
  Flag, Archive,
} from "lucide-react";
import { printWithFilename, docFilename } from "@/lib/print-document";
import type { CloseoutMetrics, CloseoutReadiness, CloseoutNarrative, MilestoneDuration, ReadinessCheck } from "@/lib/rhythm/closeout";

interface Props {
  locale: string;
  projectId: string;
  projectName: string;
  metrics: CloseoutMetrics;
  readiness: CloseoutReadiness;
  milestoneDurations: MilestoneDuration[];
  archive: string[];
  narrative: CloseoutNarrative | null;
  executiveSummary: string | null;
  generatedAt: string | null;
}

export function CloseoutReportClient({
  locale, projectId, projectName, metrics: m, readiness, milestoneDurations, archive, narrative, executiveSummary, generatedAt,
}: Props) {
  const isEs = locale === "es";
  const today = new Date().toLocaleDateString(isEs ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const money = (n: number) => n.toLocaleString(isEs ? "es-ES" : "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const cur = m.budget.currency;
  const budgetUnder = m.budget.variance >= 0;

  const hasNarrative = narrative != null && (
    narrative.keyAccomplishments.length + narrative.wentWell.length + narrative.wentWrong.length +
    narrative.openItems.length + narrative.nextSteps.length > 0
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-bold text-foreground">{isEs ? "Reporte de Cierre" : "Closeout Report"}</h1>
          <p className="text-xs text-muted-foreground">{isEs ? "Métricas en vivo. El resumen y las lecciones se generan al completar la reunión de Cierre." : "Live metrics. Narrative is generated when the Closing meeting is completed."}</p>
        </div>
        <button type="button" onClick={() => printWithFilename(docFilename("Closeout", "CLS", projectId))} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
          <Download className="h-4 w-4" />{isEs ? "Descargar PDF" : "Download PDF"}
        </button>
      </div>

      {/* ── Readiness gate (screen only) ─────────────────────────────────────── */}
      <ReadinessPanel readiness={readiness} isEs={isEs} />

      <div id="closeout-report-print" className="space-y-6 rounded-2xl border border-border bg-card p-8 print:border-0 print:shadow-none">
        {/* Header */}
        <header className="border-b border-border pb-5">
          <Image src="/logo-report.png" alt="Project Ops 360°" width={358} height={473} className="mb-4 h-40 w-auto" priority />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">{isEs ? "Reporte de cierre del proyecto" : "Project Closeout Report"}</p>
              <h2 className="text-2xl font-bold text-foreground">{projectName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{today}</p>
            </div>
            <ReadinessStamp readiness={readiness} isEs={isEs} />
          </div>
        </header>

        {/* Executive summary */}
        <Section icon={Sparkles} title={isEs ? "Resumen ejecutivo" : "Executive summary"} accent>
          {executiveSummary ? (
            <p className="text-sm text-foreground">{executiveSummary}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />{isEs ? "Aún no generado. Completa la reunión de “Cierre del Proyecto” para generarlo con IA a partir de la información acumulada." : "Not generated yet. Complete a \"Closing Project\" meeting to generate it with AI from accumulated data."}</p>
          )}
        </Section>

        {/* Headline KPIs (Results) */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />{isEs ? "Resultados" : "Results"}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label={isEs ? "Tareas completadas" : "Tasks complete"} value={`${m.schedule.completionPct}%`} highlight />
            <Kpi label={isEs ? "Variación cronograma" : "Schedule variance"} value={m.schedule.scheduleVariancePct != null ? `${m.schedule.scheduleVariancePct > 0 ? "+" : ""}${m.schedule.scheduleVariancePct}%` : "—"} good={m.schedule.scheduleVariancePct != null && m.schedule.scheduleVariancePct <= 0} warn={m.schedule.scheduleVariancePct != null && m.schedule.scheduleVariancePct > 0} />
            <Kpi label={isEs ? "Variación presupuesto" : "Budget variance"} value={m.budget.hasData && m.budget.variancePct != null ? `${budgetUnder ? "" : "+"}${-(m.budget.variancePct)}%` : "—"} good={m.budget.hasData && budgetUnder} warn={m.budget.hasData && !budgetUnder} />
            <Kpi label={isEs ? "Riesgos resueltos" : "Risks resolved"} value={m.risks.total > 0 ? `${m.risks.resolvedPct}%` : "—"} good={m.risks.total > 0 && m.risks.resolvedPct >= 70} />
          </div>
        </section>

        {/* Key accomplishments */}
        {narrative && narrative.keyAccomplishments.length > 0 && (
          <Section icon={Trophy} title={isEs ? "Logros clave" : "Key accomplishments"}>
            <Bullets items={narrative.keyAccomplishments} />
          </Section>
        )}

        {/* Milestone duration table */}
        {milestoneDurations.length > 0 && (
          <Section icon={CalendarClock} title={isEs ? "Duración de hitos" : "Task & milestone duration"}>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{isEs ? "Hito" : "Milestone"}</th>
                    <th className="px-3 py-2 text-left font-medium">{isEs ? "Descripción" : "Description"}</th>
                    <th className="px-3 py-2 text-right font-medium">{isEs ? "Duración" : "Duration"}</th>
                    <th className="px-3 py-2 text-right font-medium">{isEs ? "Resultado" : "Outcome"}</th>
                  </tr>
                </thead>
                <tbody>
                  {milestoneDurations.map((ms, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium text-foreground">{ms.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{ms.description ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">{ms.duration ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <OutcomeBadge outcome={ms.outcome} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Detail metric sections */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card icon={CalendarClock} title={isEs ? "Desempeño de cronograma" : "Schedule performance"} rows={[
            [isEs ? "Tareas hechas" : "Tasks done", `${m.schedule.doneTasks} / ${m.schedule.totalTasks} (${m.schedule.completionPct}%)`],
            [isEs ? "Tareas abiertas" : "Open tasks", String(m.schedule.openTasks)],
            [isEs ? "Bloqueadas" : "Blocked", String(m.schedule.blockedTasks)],
            [isEs ? "Tareas tardías" : "Late tasks", String(m.schedule.lateTasks)],
            [isEs ? "Hitos completados" : "Milestones complete", `${m.schedule.completedMilestones} / ${m.schedule.totalMilestones}`],
            [isEs ? "Duración (plan/real)" : "Duration (plan/actual)", m.schedule.plannedDays != null ? `${m.schedule.plannedDays} / ${m.schedule.actualDays ?? "—"} ${isEs ? "días" : "days"}` : "—"],
          ]} />
          <Card icon={DollarSign} title={isEs ? "Desempeño de presupuesto" : "Budget performance"} rows={m.budget.hasData ? [
            [isEs ? "Estimado" : "Estimated", `${cur} ${money(m.budget.estimated)}`],
            [isEs ? "Comprometido" : "Committed", `${cur} ${money(m.budget.committed)}`],
            [isEs ? "Real" : "Actual", `${cur} ${money(m.budget.actual)}`],
            [isEs ? "Variación" : "Variance", `${cur} ${money(m.budget.variance)} (${budgetUnder ? (isEs ? "bajo presupuesto" : "under") : (isEs ? "sobre presupuesto" : "over")})`],
          ] : [[isEs ? "Sin datos de costo" : "No cost data", "—"]]} />
          <Card icon={ShieldCheck} title={isEs ? "Riesgos e incidencias" : "Risks & issues"} rows={[
            [isEs ? "Riesgos totales" : "Total risks", String(m.risks.total)],
            [isEs ? "Resueltos" : "Resolved", `${m.risks.closed} (${m.risks.resolvedPct}%)`],
            [isEs ? "Abiertos" : "Open", String(m.risks.open + m.risks.mitigated)],
            ["RFIs", `${m.rfis.closed} / ${m.rfis.total} ${isEs ? "cerrados" : "closed"}`],
            [isEs ? "Submittals" : "Submittals", `${m.submittals.approved} / ${m.submittals.total} ${isEs ? "resueltos" : "resolved"}`],
          ]} />
          <Card icon={ListChecks} title={isEs ? "Gobernanza y participación" : "Governance & engagement"} rows={[
            [isEs ? "Decisiones registradas" : "Decisions logged", String(m.decisions)],
            [isEs ? "Acciones completadas" : "Actions completed", `${m.actions.completed} / ${m.actions.total}`],
            [isEs ? "Acciones abiertas" : "Open actions", String(m.actions.open)],
            [isEs ? "Reuniones realizadas" : "Meetings held", String(m.meetings)],
          ]} />
        </div>

        {/* Lessons learned */}
        {narrative && (narrative.wentWell.length > 0 || narrative.wentWrong.length > 0) && (
          <Section icon={Lightbulb} title={isEs ? "Lecciones aprendidas" : "Lessons learned"}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {narrative.wentWell.length > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/20">
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />{isEs ? "Qué salió bien" : "What went well"}</h4>
                  <Bullets items={narrative.wentWell} dense />
                </div>
              )}
              {narrative.wentWrong.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                  <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"><Wrench className="h-3.5 w-3.5" />{isEs ? "Retos y cómo se manejaron" : "Challenges & how handled"}</h4>
                  <Bullets items={narrative.wentWrong} dense />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Open items */}
        {narrative && narrative.openItems.length > 0 && (
          <Section icon={ClipboardList} title={isEs ? "Asuntos abiertos" : "Open items"}>
            <Bullets items={narrative.openItems} />
          </Section>
        )}

        {/* Next steps */}
        {narrative && narrative.nextSteps.length > 0 && (
          <Section icon={Flag} title={isEs ? "Próximos pasos y consideraciones futuras" : "Next steps & future considerations"}>
            <Bullets items={narrative.nextSteps} />
          </Section>
        )}

        {/* Narrative placeholder when nothing generated yet */}
        {!hasNarrative && (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            {isEs
              ? "Las secciones de logros, lecciones aprendidas, asuntos abiertos y próximos pasos se generan automáticamente con IA al completar la reunión de “Cierre del Proyecto”, a partir de las reuniones, decisiones y riesgos acumulados."
              : "Accomplishments, lessons learned, open items and next steps are generated automatically with AI when the \"Closing Project\" meeting is completed, from accumulated meetings, decisions and risks."}
          </p>
        )}

        {/* Resources & archive */}
        {archive.length > 0 && (
          <Section icon={Archive} title={isEs ? "Recursos y archivo del proyecto" : "Resources & project archive"}>
            <div className="flex flex-wrap gap-1.5">
              {archive.map((a, i) => (
                <span key={i} className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground">{a}</span>
              ))}
            </div>
          </Section>
        )}

        <p className="text-[10px] text-muted-foreground">
          {isEs ? "Métricas calculadas automáticamente de los datos del proyecto. Algunas (satisfacción del cliente, ROI, ingresos) no se rastrean aún y se omiten." : "Metrics computed automatically from project data. Some (customer satisfaction, ROI, revenue) are not tracked yet and are omitted."}
          {generatedAt && ` · ${isEs ? "Resumen generado" : "Summary generated"}: ${new Date(generatedAt).toLocaleDateString(isEs ? "es-ES" : "en-US")}`}
        </p>
      </div>
    </div>
  );
}

// ── Readiness gate panel (screen only) ──────────────────────────────────────

function ReadinessPanel({ readiness, isEs }: { readiness: CloseoutReadiness; isEs: boolean }) {
  const { ready, failCount, warnCount, checks, score } = readiness;
  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4 print:hidden">
      <div className={`mb-3 flex items-center gap-3 rounded-lg border p-3 ${
        ready
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
      }`}>
        {ready ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" /> : <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${ready ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>
            {ready
              ? (isEs ? "Listo para cerrar el proyecto" : "Ready to close the project")
              : (isEs ? `No listo para cierre — ${failCount} requisito(s) pendiente(s)` : `Not ready to close — ${failCount} requirement(s) pending`)}
          </p>
          <p className={`text-xs ${ready ? "text-green-700/80 dark:text-green-400/80" : "text-red-700/80 dark:text-red-400/80"}`}>
            {isEs
              ? `${score}% de los criterios cumplidos${warnCount > 0 ? ` · ${warnCount} advertencia(s)` : ""}`
              : `${score}% of criteria met${warnCount > 0 ? ` · ${warnCount} warning(s)` : ""}`}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {checks.map((c) => <CheckRow key={c.key} check={c} isEs={isEs} />)}
      </div>
    </div>
  );
}

function CheckRow({ check, isEs }: { check: ReadinessCheck; isEs: boolean }) {
  const icon = check.level === "pass"
    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
    : check.level === "fail"
      ? <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="truncate text-xs font-medium text-foreground">{isEs ? check.labelEs : check.labelEn}</span>
        {!check.blocking && check.level !== "pass" && (
          <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{isEs ? "opcional" : "optional"}</span>
        )}
      </div>
      {check.level !== "pass" && (
        <span className="shrink-0 text-[11px] text-muted-foreground">{isEs ? check.detailEs : check.detailEn}</span>
      )}
    </div>
  );
}

function ReadinessStamp({ readiness, isEs }: { readiness: CloseoutReadiness; isEs: boolean }) {
  return (
    <div className={`shrink-0 rounded-lg border px-3 py-1.5 text-center ${
      readiness.ready
        ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
        : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
    }`}>
      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{isEs ? "Estado de cierre" : "Closeout status"}</p>
      <p className={`text-sm font-bold ${readiness.ready ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
        {readiness.ready ? (isEs ? "Listo" : "Ready") : (isEs ? "Pendiente" : "Pending")}
      </p>
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, accent, children }: { icon: typeof Sparkles; title: string; accent?: boolean; children: ReactNode }) {
  return (
    <section className={`break-inside-avoid ${accent ? "rounded-lg border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-900 dark:bg-brand-950/20" : ""}`}>
      <h3 className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${accent ? "text-brand-700 dark:text-brand-400" : "text-muted-foreground"}`}>
        <Icon className="h-3.5 w-3.5" />{title}
      </h3>
      {children}
    </section>
  );
}

function Bullets({ items, dense }: { items: string[]; dense?: boolean }) {
  return (
    <ul className={`${dense ? "space-y-0.5" : "space-y-1"} text-sm text-foreground`}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const done = outcome === "Completado" || outcome === "Completed";
  const deferred = outcome === "Diferido" || outcome === "Deferred";
  const cls = done
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : deferred
      ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{outcome}</span>;
}

function Kpi({ label, value, highlight, good, warn }: { label: string; value: string; highlight?: boolean; good?: boolean; warn?: boolean }) {
  const color = highlight ? "text-brand-600 dark:text-brand-400" : good ? "text-green-600 dark:text-green-400" : warn ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30" : "border-border bg-muted/20"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Card({ icon: Icon, title, rows }: { icon: typeof CalendarClock; title: string; rows: [string, string][] }) {
  return (
    <section className="break-inside-avoid rounded-xl border border-border p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-brand-500" />{title}</h3>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-border/40 py-1 last:border-0">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
