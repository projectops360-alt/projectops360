"use client";

// ============================================================================
// Project Closeout Report — auto-generated on Closing meeting completion.
// Readiness gate (pre-conditions for closure) + live metrics + AI narrative
// (Plant Pals-style sections), print-to-PDF (like the Status Report).
// Print CSS in globals.css isolates #closeout-report-print.
// ============================================================================

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download, Sparkles, CalendarClock, DollarSign, ShieldCheck, ListChecks, TrendingUp,
  AlertTriangle, CheckCircle2, XCircle, Trophy, Lightbulb, Wrench, ClipboardList,
  Flag, Archive, Loader2, CalendarPlus, PlayCircle, ChevronRight, Circle,
} from "lucide-react";
import { localizedHref } from "@/i18n/href";
import type { Locale } from "@/types/database";
import { printWithFilename, docFilename } from "@/lib/print-document";
import type { CloseoutMetrics, CloseoutReadiness, CloseoutNarrative, MilestoneDuration, ReadinessCheck } from "@/lib/rhythm/closeout";
import {
  resolveCloseoutState, primaryCtaFor, activeStepIndex, readinessCtaRoute,
  CLOSEOUT_STEP_KEYS, type CloseoutState, type CloseoutCta,
} from "@/lib/rhythm/closeout-workflow";
import type { CloseoutRiskRecord } from "@/lib/rhythm/closeout-criteria";
import {
  generateCloseoutNarrativeAction, resolveRiskAction, markCloseoutExportedAction,
  assessRiskAction, materializeRiskAction, reopenRiskAction,
} from "./actions";

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
  closingMeetingStatus: "none" | "scheduled" | "completed";
  closingMeetingId: string | null;
  canRunCloseout: boolean;
  exported?: boolean;
  /** RISK-EVENT-CAPTURE (P2-T2/PD-018) — server-evaluated pilot flag; default
   *  OFF. When off, the risk lines render exactly as before. */
  riskEventCapture?: boolean;
}

export function CloseoutReportClient({
  locale, projectId, projectName, metrics: m, readiness, milestoneDurations, archive, narrative, executiveSummary, generatedAt,
  closingMeetingStatus, closingMeetingId, canRunCloseout, exported: exportedInitial = false, riskEventCapture = false,
}: Props) {
  const isEs = locale === "es";
  const router = useRouter();
  const base = localizedHref(locale, `/projects/${projectId}`);
  const [generating, startGenerating] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);
  const today = new Date().toLocaleDateString(isEs ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const money = (n: number) => n.toLocaleString(isEs ? "es-ES" : "en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const cur = m.budget.currency;
  const budgetUnder = m.budget.variance >= 0;

  const hasNarrative = narrative != null && (
    narrative.keyAccomplishments.length + narrative.wentWell.length + narrative.wentWrong.length +
    narrative.openItems.length + narrative.nextSteps.length > 0
  ) || !!executiveSummary;

  // ── UX-010 — guided closeout workflow state ───────────────────────────────
  // `exported` is seeded from the server (persisted on the closing meeting) and
  // flipped optimistically when the user downloads, so the step rail can advance
  // past "Review report" to a completed state instead of stalling on step 5.
  const [exported, setExported] = useState(exportedInitial);
  const state = resolveCloseoutState({
    hasAnyData: m.schedule.totalTasks > 0 || m.meetings > 0,
    readinessReady: readiness.ready,
    closingMeeting: closingMeetingStatus,
    hasNarrative,
    exported,
  });
  const cta = primaryCtaFor(state);
  const activeStep = activeStepIndex(state);

  function handleGenerate() {
    setGenError(null);
    startGenerating(async () => {
      const res = await generateCloseoutNarrativeAction(projectId, locale as Locale);
      if (res.ok) router.refresh();
      else setGenError(res.reason);
    });
  }
  const doDownload = () => {
    printWithFilename(docFilename("Closeout", "CLS", projectId));
    // Mark the workflow complete (step 5 → done) once the report exists; persist
    // so it survives a refresh. Only meaningful when there is a report to export.
    if (hasNarrative && !exported) {
      setExported(true);
      void markCloseoutExportedAction(projectId, locale as Locale).then((res) => {
        if (res.ok) router.refresh();
      });
    }
  };

  const downloadDisabled = !hasNarrative && !readiness.ready;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-foreground">{isEs ? "Reporte de Cierre" : "Closeout Report"}</h1>
            <CloseoutStateBadge state={state} isEs={isEs} />
          </div>
          <p className="text-xs text-muted-foreground">{isEs ? "Métricas en vivo. El resumen ejecutivo se genera al completar la reunión de Cierre del Proyecto." : "Live metrics. The executive summary is generated when the Closing Project meeting is completed."}</p>
        </div>
        {/* Secondary download stays available but is not the only/primary action */}
        <button
          type="button"
          onClick={doDownload}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
          title={downloadDisabled ? (isEs ? "El reporte aún no está listo — completa el proceso de cierre" : "Report not ready yet — complete the closeout process") : undefined}
        >
          <Download className="h-4 w-4" />{isEs ? "Descargar PDF" : "Download PDF"}
        </button>
      </div>

      {/* ── UX-010 — Guided closeout workflow ────────────────────────────────── */}
      <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/20 dark:bg-brand-500/5 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              {isEs ? "Proceso de cierre" : "Closeout process"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{stateHelp(state, isEs)}</p>
          </div>
          <PrimaryCta
            cta={cta} isEs={isEs} base={base} canRun={canRunCloseout}
            generating={generating} onGenerate={handleGenerate} onDownload={doDownload}
          />
        </div>

        {/* Step rail */}
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {CLOSEOUT_STEP_KEYS.map((key, i) => {
            const done = i < activeStep;
            const current = i === activeStep;
            return (
              <li key={key} className={`flex items-start gap-2 rounded-lg border p-2 ${current ? "border-brand-400 bg-card" : "border-border/60 bg-card/50"}`}>
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                ) : current ? (
                  <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                )}
                <div className="min-w-0">
                  <p className={`text-[11px] font-medium ${current ? "text-foreground" : "text-muted-foreground"}`}>{i + 1}. {STEP_LABEL[key][isEs ? "es" : "en"]}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {genError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {genError === "no_meeting"
              ? (isEs ? "Completa primero una reunión de Cierre del Proyecto en el Rhythm Center." : "Complete a Closing Project meeting in the Rhythm Center first.")
              : genError === "not_authorized"
                ? (isEs ? "No tienes permiso para generar el resumen." : "You don't have permission to generate the summary.")
                : (isEs ? "No se pudo generar el resumen. Inténtalo de nuevo." : "Could not generate the summary. Try again.")}
          </p>
        )}

        <p className="mt-2 text-[11px] text-muted-foreground">
          {isEs
            ? "La reunión de Cierre del Proyecto se ejecuta en Project Memory → Rhythm Center. El resumen ejecutivo con IA se genera al completarla; “Descargar PDF” exporta el reporte, no genera el resumen."
            : "The Closing Project meeting runs in Project Memory → Rhythm Center. The AI executive summary is generated when it is completed; \"Download PDF\" exports the report, it does not generate the summary."}
        </p>
      </div>

      {/* ── Readiness gate (screen only) ─────────────────────────────────────── */}
      <ReadinessPanel readiness={readiness} isEs={isEs} base={base} projectId={projectId} locale={locale} canResolve={canRunCloseout} riskEventCapture={riskEventCapture} />

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

function ReadinessPanel({ readiness, isEs, base, projectId, locale, canResolve, riskEventCapture }: { readiness: CloseoutReadiness; isEs: boolean; base: string; projectId: string; locale: string; canResolve: boolean; riskEventCapture: boolean }) {
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
        {checks.map((c) => <CheckRow key={c.key} check={c} isEs={isEs} base={base} projectId={projectId} locale={locale} canResolve={canResolve} riskEventCapture={riskEventCapture} />)}
      </div>
    </div>
  );
}

function CheckRow({ check, isEs, base, projectId, locale, canResolve, riskEventCapture }: { check: ReadinessCheck; isEs: boolean; base: string; projectId: string; locale: string; canResolve: boolean; riskEventCapture: boolean }) {
  // REG-017 — record-backed checks (open risks) reveal the EXACT records inline,
  // so a count like "2 open risk(s)" is always clickable down to the 2 records.
  const [expanded, setExpanded] = useState(false);
  const icon = check.level === "pass"
    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
    : check.level === "fail"
      ? <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
  const route = check.level !== "pass" ? readinessCtaRoute(check.key) : null;
  const records = check.records ?? [];
  // A record-backed, still-failing check resolves INLINE (no dead route).
  const hasInlineRecords = check.recordType === "risk" && check.level !== "pass";
  const inconsistent = check.recordsConsistent === false;
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate text-xs font-medium text-foreground">{isEs ? check.labelEs : check.labelEn}</span>
          {!check.blocking && check.level !== "pass" && (
            <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{isEs ? "opcional" : "optional"}</span>
          )}
          {inconsistent && (
            <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {isEs ? "inconsistencia" : "data issue"}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {check.level !== "pass" && (
            <span className="text-[11px] text-muted-foreground">{isEs ? check.detailEs : check.detailEn}</span>
          )}
          {hasInlineRecords ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
            >
              {isEs ? "Ver riesgos" : "View risks"}
              <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
          ) : route ? (
            <Link
              href={`${base}${route}`}
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
            >
              {isEs ? "Resolver" : "Resolve"} <ChevronRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>

      {hasInlineRecords && expanded && (
        <div className="space-y-1.5 border-t border-border/60 px-2.5 py-2">
          {inconsistent ? (
            <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {isEs
                ? `El cierre esperaba ${check.count} riesgo(s) abierto(s), pero se encontraron ${records.length} registro(s) coincidente(s). Esto indica una inconsistencia de datos entre Cierre y la gestión de riesgos.`
                : `Closeout expected ${check.count} open risk(s), but ${records.length} matching risk record(s) were found. This indicates a data consistency issue between Closeout and Risk Management.`}
            </p>
          ) : records.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{isEs ? "No hay riesgos abiertos." : "No open risks."}</p>
          ) : (
            <ul className="space-y-1">
              {records.map((r) => <RiskLine key={r.id} risk={r} isEs={isEs} projectId={projectId} locale={locale} canResolve={canResolve} riskEventCapture={riskEventCapture} />)}
            </ul>
          )}
          {isDev && check.diagnostics && <DevDiagnostics diagnostics={check.diagnostics} />}
        </div>
      )}
    </div>
  );
}

// RISK-EVENT-CAPTURE (P2-T2/PD-018) — canonical vocabularies for the capturable
// affordances (Assess / Materialize / Reopen). Values are canonical identifiers
// (not UI copy). The closure-reason vocabulary is retained in riskOptionLabel
// for the future RI-05 closure workflow but has no affordance surface today.
const ASSESS_METHOD_OPTIONS = ["probability_impact_matrix", "qualitative", "quantitative", "expert_judgment"] as const;
const REOPEN_REASON_OPTIONS = ["closure_invalidated", "risk_resurfaced", "new_information", "materialized_after_closure"] as const;

function riskOptionLabel(value: string, isEs: boolean): string {
  const labels: Record<string, { en: string; es: string }> = {
    mitigated: { en: "Mitigated", es: "Mitigado" },
    avoided: { en: "Avoided", es: "Evitado" },
    accepted: { en: "Accepted", es: "Aceptado" },
    expired: { en: "Expired", es: "Expirado" },
    materialized_transferred: { en: "Materialized (transferred)", es: "Materializado (transferido)" },
    probability_impact_matrix: { en: "Probability × impact matrix", es: "Matriz probabilidad × impacto" },
    qualitative: { en: "Qualitative", es: "Cualitativo" },
    quantitative: { en: "Quantitative", es: "Cuantitativo" },
    expert_judgment: { en: "Expert judgment", es: "Juicio experto" },
    closure_invalidated: { en: "Closure lost validity", es: "El cierre perdió validez" },
    risk_resurfaced: { en: "Risk resurfaced", es: "El riesgo reapareció" },
    new_information: { en: "New information", es: "Nueva información" },
    materialized_after_closure: { en: "Materialized after closure", es: "Se materializó tras el cierre" },
    total: { en: "Total", es: "Total" },
    partial: { en: "Partial", es: "Parcial" },
  };
  const l = labels[value];
  return l ? (isEs ? l.es : l.en) : value;
}

function RiskLine({ risk, isEs, projectId, locale, canResolve, riskEventCapture }: { risk: CloseoutRiskRecord; isEs: boolean; projectId: string; locale: string; canResolve: boolean; riskEventCapture: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  // Affordance panel (null = collapsed). The affordances flag gates the three
  // CAPTURABLE affordances (Assess / Materialize / Reopen). The Resolve button
  // ALWAYS acts immediately (legacy): risk_closed is "not capturable yet" (RI-05
  // validation gate does not exist on this path — Fase 6), so the "Closure
  // reason" affordance is suppressed until a validated closure workflow exists.
  const [panel, setPanel] = useState<null | "assess" | "materialize" | "reopen">(null);
  const [assessMethod, setAssessMethod] = useState<string>("probability_impact_matrix");
  const [matScope, setMatScope] = useState<string>("partial");
  const [matNote, setMatNote] = useState<string>("");
  const [reopenReason, setReopenReason] = useState<string>("closure_invalidated");
  const [done, setDone] = useState<string | null>(null);

  const isClosed = risk.status === "resolved" || risk.status === "closed";

  function run(fn: () => Promise<{ ok: boolean }>, doneLabel?: string) {
    setError(false);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setPanel(null);
        if (doneLabel) setDone(doneLabel);
        router.refresh();
      } else setError(true);
    });
  }

  function handleResolve() {
    // Legacy immediate resolve: status → resolved (no risk_closed event; the
    // closure_reason affordance is suppressed until RI-05 exists — Fase 6).
    run(() => resolveRiskAction(projectId, risk.id, locale as Locale));
  }

  const actionBtn = "inline-flex items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:border-brand-500 hover:text-brand-600 disabled:opacity-50 dark:hover:text-brand-400";
  const selectCls = "rounded-md border border-border bg-background px-1 py-0.5 text-[10px] text-foreground";

  return (
    <li className="rounded-md bg-muted/30 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="truncate text-[11px] font-medium text-foreground">{risk.title}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">· {risk.ownerName ?? (isEs ? "sin responsable" : "unassigned")}</span>
          {done && <span className="shrink-0 rounded bg-green-500/15 px-1 py-0.5 text-[9px] font-medium text-green-700 dark:text-green-400">{done}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <SeverityBadge severity={risk.severity} />
          <RiskStatusBadge status={risk.status} isEs={isEs} />
          {canResolve && riskEventCapture && !isClosed && (
            <>
              <button type="button" disabled={pending} onClick={() => setPanel(panel === "assess" ? null : "assess")} className={actionBtn}>
                {isEs ? "Evaluar" : "Assess"}
              </button>
              <button type="button" disabled={pending} onClick={() => setPanel(panel === "materialize" ? null : "materialize")} className={actionBtn}>
                {isEs ? "Materializar" : "Materialize"}
              </button>
            </>
          )}
          {canResolve && riskEventCapture && isClosed && (
            <button type="button" disabled={pending} onClick={() => setPanel(panel === "reopen" ? null : "reopen")} className={actionBtn}>
              {isEs ? "Reabrir" : "Reopen"}
            </button>
          )}
          {canResolve && !isClosed && (
            <button
              type="button"
              onClick={handleResolve}
              disabled={pending}
              title={error ? (isEs ? "No se pudo completar. Inténtalo de nuevo." : "Could not complete. Try again.") : undefined}
              className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${
                error
                  ? "border-red-300 text-red-600 hover:border-red-500 dark:text-red-400"
                  : "border-border bg-background text-foreground hover:border-green-500 hover:text-green-600 dark:hover:text-green-400"
              }`}
            >
              {pending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <CheckCircle2 className="h-3 w-3" />}
              {isEs ? "Resolver" : "Resolve"}
            </button>
          )}
        </div>
      </div>

      {/* ── Affordance panels (Assess / Materialize / Reopen) — capturable risk
          events, gated by the affordances flag (capture flag must also be on so
          the event is actually written). The Resolve / closure-reason affordance
          is intentionally absent: risk_closed is "not capturable yet" (RI-05). ─ */}
      {riskEventCapture && panel === "assess" && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-1.5">
          <span className="text-[10px] text-muted-foreground">{isEs ? "Método:" : "Method:"}</span>
          <select value={assessMethod} onChange={(e) => setAssessMethod(e.target.value)} className={selectCls} aria-label={isEs ? "Método de evaluación" : "Assessment method"}>
            {ASSESS_METHOD_OPTIONS.map((m2) => <option key={m2} value={m2}>{riskOptionLabel(m2, isEs)}</option>)}
          </select>
          <span className="text-[10px] text-muted-foreground">
            {isEs ? "Confirma los valores vigentes del riesgo" : "Confirms the risk's current values"}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => assessRiskAction(projectId, risk.id, assessMethod), isEs ? "Evaluado" : "Assessed")}
            className={actionBtn}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            {isEs ? "Confirmar evaluación" : "Confirm assessment"}
          </button>
        </div>
      )}
      {riskEventCapture && panel === "materialize" && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-1.5">
          <span className="text-[10px] text-muted-foreground">{isEs ? "Alcance:" : "Scope:"}</span>
          <select value={matScope} onChange={(e) => setMatScope(e.target.value)} className={selectCls} aria-label={isEs ? "Alcance de materialización" : "Materialization scope"}>
            {(["partial", "total"] as const).map((s) => <option key={s} value={s}>{riskOptionLabel(s, isEs)}</option>)}
          </select>
          <input
            value={matNote}
            onChange={(e) => setMatNote(e.target.value)}
            placeholder={isEs ? "Impacto observado (opcional)" : "Observed impact (optional)"}
            className={`${selectCls} min-w-[160px] flex-1`}
            aria-label={isEs ? "Impacto observado" : "Observed impact"}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => materializeRiskAction(projectId, risk.id, matScope, matNote), isEs ? "Materializado" : "Materialized")}
            className={actionBtn}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
            {isEs ? "Registrar materialización" : "Record materialization"}
          </button>
        </div>
      )}
      {riskEventCapture && panel === "reopen" && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-1.5">
          <span className="text-[10px] text-muted-foreground">{isEs ? "Razón de reapertura:" : "Reopen reason:"}</span>
          <select value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} className={selectCls} aria-label={isEs ? "Razón de reapertura" : "Reopen reason"}>
            {REOPEN_REASON_OPTIONS.map((r) => <option key={r} value={r}>{riskOptionLabel(r, isEs)}</option>)}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reopenRiskAction(projectId, risk.id, reopenReason, locale as Locale), isEs ? "Reabierto" : "Reopened")}
            className={actionBtn}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            {isEs ? "Confirmar reapertura" : "Confirm reopen"}
          </button>
        </div>
      )}
    </li>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return <span className={`rounded px-1 py-0.5 text-[9px] font-medium uppercase ${cls[severity] ?? cls.medium}`}>{severity}</span>;
}

function RiskStatusBadge({ status, isEs }: { status: string; isEs: boolean }) {
  const label: Record<string, { en: string; es: string }> = {
    open: { en: "Open", es: "Abierto" },
    identified: { en: "Identified", es: "Identificado" },
    mitigating: { en: "Mitigating", es: "Mitigando" },
  };
  const l = label[status] ?? { en: status, es: status };
  return <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{isEs ? l.es : l.en}</span>;
}

function DevDiagnostics({ diagnostics }: { diagnostics: NonNullable<ReadinessCheck["diagnostics"]> }) {
  return (
    <details className="mt-1 rounded-md border border-dashed border-border/70 bg-background/60 px-2 py-1 text-[10px] text-muted-foreground">
      <summary className="cursor-pointer select-none font-mono">dev · closeout criterion diagnostics</summary>
      <dl className="mt-1 space-y-0.5 font-mono">
        <div><span className="text-foreground">source:</span> {diagnostics.source}</div>
        <div><span className="text-foreground">count:</span> {diagnostics.count}</div>
        <div><span className="text-foreground">includedIds:</span> [{diagnostics.includedIds.join(", ")}]</div>
        <div><span className="text-foreground">excluded:</span> [{diagnostics.excluded.map((e) => `${e.id}:${e.reason}`).join(", ")}]</div>
        <div><span className="text-foreground">resolveRoute:</span> {diagnostics.resolveRoute ?? "inline"}</div>
        <div><span className="text-foreground">generatedAt:</span> {diagnostics.generatedAt}</div>
      </dl>
    </details>
  );
}

// ── UX-010 — workflow helpers ────────────────────────────────────────────────

const STEP_LABEL: Record<string, { en: string; es: string }> = {
  check_readiness: { en: "Check readiness", es: "Revisar preparación" },
  resolve_requirements: { en: "Resolve requirements", es: "Resolver requisitos" },
  closing_meeting: { en: "Closing meeting", es: "Reunión de cierre" },
  generate_summary: { en: "Generate summary", es: "Generar resumen" },
  review_report: { en: "Review report", es: "Revisar reporte" },
  download_pdf: { en: "Download PDF", es: "Descargar PDF" },
};

function stateHelp(state: CloseoutState, isEs: boolean): string {
  const map: Record<CloseoutState, { en: string; es: string }> = {
    not_started: { en: "Start by recording project work, then run the closing process.", es: "Comienza registrando el trabajo del proyecto y luego ejecuta el cierre." },
    readiness_incomplete: { en: "Resolve the pending requirements below, then run the Closing Project meeting.", es: "Resuelve los requisitos pendientes de abajo y luego ejecuta la reunión de Cierre del Proyecto." },
    ready_for_closing_meeting: { en: "Requirements met. Run the Closing Project meeting in the Rhythm Center.", es: "Requisitos cumplidos. Ejecuta la reunión de Cierre del Proyecto en el Rhythm Center." },
    meeting_scheduled: { en: "A Closing Project meeting is scheduled. Open it and complete it to generate the summary.", es: "Hay una reunión de Cierre del Proyecto programada. Ábrela y complétala para generar el resumen." },
    meeting_completed: { en: "Closing meeting completed. Generate the AI executive summary.", es: "Reunión de cierre completada. Genera el resumen ejecutivo con IA." },
    report_ready: { en: "The report is ready. Review it and download the PDF.", es: "El reporte está listo. Revísalo y descarga el PDF." },
    exported: { en: "The report has been exported.", es: "El reporte fue exportado." },
  };
  return isEs ? map[state].es : map[state].en;
}

function CloseoutStateBadge({ state, isEs }: { state: CloseoutState; isEs: boolean }) {
  const meta: Record<CloseoutState, { en: string; es: string; cls: string }> = {
    not_started: { en: "Not started", es: "Sin iniciar", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30" },
    readiness_incomplete: { en: "Needs attention", es: "Requiere atención", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    ready_for_closing_meeting: { en: "Ready for meeting", es: "Listo para reunión", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
    meeting_scheduled: { en: "Meeting scheduled", es: "Reunión programada", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
    meeting_completed: { en: "Ready to generate", es: "Listo para generar", cls: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30" },
    report_ready: { en: "Ready", es: "Listo", cls: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" },
    exported: { en: "Exported", es: "Exportado", cls: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" },
  };
  const m = meta[state];
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.cls}`}>{isEs ? m.es : m.en}</span>;
}

function PrimaryCta({
  cta, isEs, base, canRun, generating, onGenerate, onDownload,
}: {
  cta: CloseoutCta; isEs: boolean; base: string; canRun: boolean;
  generating: boolean; onGenerate: () => void; onDownload: () => void;
}) {
  const cls = "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50";
  if (cta === "create_meeting") {
    return (
      <Link href={`${base}/rhythm`} className={cls}>
        <CalendarPlus className="h-4 w-4" />{isEs ? "Crear reunión de Cierre" : "Create Closing Project Meeting"}
      </Link>
    );
  }
  if (cta === "open_meeting") {
    return (
      <Link href={`${base}/rhythm`} className={cls}>
        <PlayCircle className="h-4 w-4" />{isEs ? "Abrir reunión de Cierre" : "Open Closing Project Meeting"}
      </Link>
    );
  }
  if (cta === "generate_summary") {
    if (!canRun) {
      return <span className="text-xs text-muted-foreground">{isEs ? "Sin permiso para generar" : "No permission to generate"}</span>;
    }
    return (
      <button type="button" onClick={onGenerate} disabled={generating} className={cls}>
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {isEs ? "Generar resumen ejecutivo" : "Generate Executive Summary"}
      </button>
    );
  }
  // download_pdf
  return (
    <button type="button" onClick={onDownload} className={cls}>
      <Download className="h-4 w-4" />{isEs ? "Descargar PDF" : "Download PDF"}
    </button>
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
