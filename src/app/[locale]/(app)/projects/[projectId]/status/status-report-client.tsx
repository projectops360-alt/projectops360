"use client";

// ============================================================================
// Project Status Report — plain-language, visual, print-to-PDF
// ============================================================================
// Story-driven status for a non-technical reader: a progress ring, the
// milestone journey, what's done / happening now / coming next, what needs
// attention, and the materials. "Download PDF" uses the browser print dialog
// (print CSS in globals.css isolates #status-report-print).
// ============================================================================

import Image from "next/image";
import { Download, CheckCircle2, Loader2, Circle, AlertTriangle, OctagonAlert, Package, CalendarDays, ListChecks, User, Users, UserPlus, Play, ArrowUpRight } from "lucide-react";
import type { Locale } from "@/types/database";
import type { ProjectStatusReport, PhaseState, PhaseStatus, DailyActionType } from "@/lib/execution/status-report";
import { printWithFilename, docFilename } from "@/lib/print-document";

const L = {
  en: {
    title: "Project status",
    subtitle: "How the work is going, in plain words",
    download: "Download PDF",
    generated: "Generated",
    plannedWindow: "Planned window",
    overall: "Overall progress",
    jobsDone: "jobs done",
    journey: "The journey",
    done: "Done",
    now: "Happening now",
    next: "Coming next",
    nothingNow: "Nothing is in progress right now.",
    nothingNext: "Nothing left — you're at the finish line.",
    focusTitle: "Needs your attention now",
    focusSubtitle: "These are blocking progress — resolve them first.",
    inPhase: "in",
    onHold: "On hold",
    todoTitle: "What to do now",
    todoSubtitle: "The work that can move forward today, and who does it.",
    todoEmpty: "Nothing is actionable right now.",
    unassigned: "Unassigned — who does this?",
    waiting: (n: number) => `${n} more task(s) are waiting on a predecessor to finish.`,
    actions: { unblock: "Unblock", do_now: "Continue", start: "Start", assign: "Assign someone" } as Record<DailyActionType, string>,
    attention: "Other things to review",
    allGood: "Nothing needs your attention right now. 🎉",
    materials: "What it's being built with",
    noMaterials: "No materials recorded yet.",
    states: { completed: "Done", in_progress: "In progress", upcoming: "Coming up", empty: "No tasks" } as Record<PhaseState, string>,
    of: "of",
    projectTypes: {
      software_development: "Software project",
      data_center_construction: "Data center",
      residential_construction: "Home construction",
      commercial_construction: "Commercial construction",
      infrastructure: "Infrastructure",
      industrial: "Industrial",
      general: "Project",
    } as Record<string, string>,
  },
  es: {
    title: "Estado del proyecto",
    subtitle: "Cómo va la obra, en palabras sencillas",
    download: "Descargar PDF",
    generated: "Generado",
    plannedWindow: "Ventana planificada",
    overall: "Avance general",
    jobsDone: "trabajos listos",
    journey: "El recorrido",
    done: "Hecho",
    now: "Ahora mismo",
    next: "Lo que viene",
    nothingNow: "Ahora mismo no hay nada en marcha.",
    nothingNext: "No queda nada — estás en la meta.",
    focusTitle: "Necesita tu atención ahora",
    focusSubtitle: "Esto está frenando el avance — resuélvelo primero.",
    inPhase: "en",
    onHold: "En pausa",
    todoTitle: "Qué hacer ahora",
    todoSubtitle: "El trabajo que puede avanzar hoy, y quién lo hace.",
    todoEmpty: "No hay nada accionable en este momento.",
    unassigned: "Sin asignar — ¿quién lo hace?",
    waiting: (n: number) => `${n} tarea(s) más están esperando a que termine una predecesora.`,
    actions: { unblock: "Desbloquear", do_now: "Continuar", start: "Empezar", assign: "Asignar a alguien" } as Record<DailyActionType, string>,
    attention: "Otros puntos por revisar",
    allGood: "Nada necesita tu atención ahora mismo. 🎉",
    materials: "Con qué se está construyendo",
    noMaterials: "Todavía no hay materiales registrados.",
    states: { completed: "Listo", in_progress: "En marcha", upcoming: "Por venir", empty: "Sin tareas" } as Record<PhaseState, string>,
    of: "de",
    projectTypes: {
      software_development: "Proyecto de software",
      data_center_construction: "Centro de datos",
      residential_construction: "Construcción residencial",
      commercial_construction: "Construcción comercial",
      infrastructure: "Infraestructura",
      industrial: "Industrial",
      general: "Proyecto",
    } as Record<string, string>,
  },
};

const STATE_COLOR: Record<PhaseState, { dot: string; bar: string; text: string; chip: string }> = {
  completed: { dot: "bg-green-500", bar: "bg-green-500", text: "text-green-700 dark:text-green-400", chip: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  in_progress: { dot: "bg-amber-500", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  upcoming: { dot: "bg-gray-300 dark:bg-gray-600", bar: "bg-gray-400", text: "text-gray-500 dark:text-gray-400", chip: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  empty: { dot: "bg-gray-200 dark:bg-gray-700", bar: "bg-gray-300", text: "text-gray-400", chip: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

function ProgressRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct >= 80 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#3b82f6";
  return (
    <svg viewBox="0 0 128 128" className="h-36 w-36 shrink-0">
      <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="12" className="text-muted" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 64 64)"
      />
      <text x="64" y="60" textAnchor="middle" className="fill-foreground" fontSize="26" fontWeight="700">{pct}%</text>
      <text x="64" y="82" textAnchor="middle" className="fill-muted-foreground" fontSize="9">▱▰▱▰▱</text>
    </svg>
  );
}

function PhaseIcon({ phase }: { phase: PhaseStatus }) {
  if (phase.blocked.length > 0) return <OctagonAlert className="h-5 w-5 text-red-500" />;
  if (phase.state === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (phase.state === "in_progress") return <Loader2 className="h-5 w-5 text-amber-500" />;
  return <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600" />;
}

export function StatusReportClient({ report, projectId, locale, charterContext }: { report: ProjectStatusReport; projectId: string; locale: Locale; charterContext?: { goal: string | null; status: string | null } }) {
  const pdfName = docFilename("StatusReport", "STA", projectId, (report.generatedAt ?? "").slice(0, 10).replace(/-/g, ""));
  const t = L[locale] ?? L.en;
  const i18n = (f: { en?: string; es?: string }) => f[locale] ?? f.en ?? "";
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }) : "—";

  const severityRank = { high: 0, medium: 1, low: 2 };
  // Blockers are surfaced in their own top banner — keep only the rest here.
  const otherAttention = report.attention
    .filter((a) => a.kind !== "blocked")
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Action bar (hidden in PDF) */}
      <div className="mb-4 flex items-center justify-end print:hidden">
        <button
          type="button"
          onClick={() => printWithFilename(pdfName)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Download className="h-4 w-4" />
          {t.download}
        </button>
      </div>

      {/* Printable report */}
      <div id="status-report-print" className="space-y-8 rounded-2xl border border-border bg-card p-8 print:border-0 print:shadow-none">
        {/* Header */}
        <header className="border-b border-border pb-5">
          {/* Brand mark — full-color logo on the light report surface */}
          <Image
            src="/logo-report.png"
            alt="Project Ops 360°"
            width={358}
            height={473}
            className="mb-5 h-40 w-auto"
            priority
          />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">{t.title}</p>
              <h1 className="mt-1 text-2xl font-bold text-foreground">{report.projectTitle}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {t.projectTypes[report.projectType] ?? report.projectType}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>{t.generated}: {fmtDate(report.generatedAt)}</span>
            {(report.plannedStart || report.plannedFinish) && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {t.plannedWindow}: {fmtDate(report.plannedStart)} → {fmtDate(report.plannedFinish)}
              </span>
            )}
          </div>
          {charterContext?.goal && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2 dark:border-brand-900 dark:bg-brand-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                {locale === "es" ? "Meta del proyecto (según el Charter)" : "Project goal (from the Charter)"}
              </p>
              <p className="text-sm text-foreground">{charterContext.goal}</p>
            </div>
          )}
        </header>

        {/* Problems first: blockers banner (only when something is on hold) */}
        {report.blockers.length > 0 && (
          <section className="rounded-xl border-2 border-red-300 bg-red-50 p-5 dark:border-red-800 dark:bg-red-950/30">
            <div className="flex items-center gap-2">
              <OctagonAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <h2 className="text-base font-bold text-red-800 dark:text-red-300">
                {t.focusTitle}
                <span className="ml-1.5 font-semibold">({report.blockers.length})</span>
              </h2>
            </div>
            <p className="mt-0.5 pl-7 text-sm text-red-700/90 dark:text-red-300/80">{t.focusSubtitle}</p>
            <ul className="mt-3 space-y-2">
              {report.blockers.map((b, i) => (
                <li key={i} className="rounded-lg border border-red-200 bg-background/60 p-3 dark:border-red-800/60">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-foreground">{b.taskTitle}</span>
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                      {t.onHold}
                    </span>
                  </div>
                  {b.reason && <p className="mt-1 text-sm text-foreground/80">{b.reason}</p>}
                  {b.phaseTitle && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{t.inPhase} {b.phaseTitle}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Hero: ring + headline */}
        <section className="flex flex-col items-center gap-6 sm:flex-row">
          <ProgressRing pct={report.completionPct} />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <p className="text-lg font-medium leading-relaxed text-foreground">{i18n(report.headline_i18n)}</p>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Stat label={t.done} value={report.doneTasks} tone="green" />
              {report.startedTasks > 0 && <Stat label={t.states.in_progress} value={report.startedTasks} tone="amber" />}
              {report.blockedTasks > 0 && <Stat label={locale === "es" ? "En pausa" : "On hold"} value={report.blockedTasks} tone="red" />}
              <Stat label={locale === "es" ? "Por hacer" : "To do"} value={report.notStartedTasks} tone="gray" />
            </div>
          </div>
        </section>

        {/* What to do now — daily action list, grouped by who does it */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ListChecks className="h-4 w-4" />
            {t.todoTitle}
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{t.todoSubtitle}</p>
          {report.dailyPlan.owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.todoEmpty}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {report.dailyPlan.owners.map((owner) => {
                const isUnassigned = owner.ownerKind === "unassigned";
                const OwnerIcon = owner.ownerKind === "resource" ? Users : isUnassigned ? UserPlus : User;
                return (
                  <div
                    key={owner.ownerKey}
                    className={`rounded-xl border p-3 ${isUnassigned ? "border-dashed border-amber-300 dark:border-amber-700" : "border-border"}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isUnassigned ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"}`}>
                        <OwnerIcon className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {isUnassigned ? t.unassigned : owner.ownerName}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{owner.actions.length}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {owner.actions.map((a) => (
                        <li key={a.taskId} className="flex items-start gap-2 text-sm">
                          <ActionBadge action={a.action} label={t.actions[a.action]} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-foreground">{a.taskTitle}</span>
                            {a.action === "unblock" && a.reason && (
                              <span className="block text-xs text-red-600 dark:text-red-400">{a.reason}</span>
                            )}
                            {a.phaseTitle && (
                              <span className="block text-xs text-muted-foreground">{t.inPhase} {a.phaseTitle}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          {report.dailyPlan.waitingCount > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">{t.waiting(report.dailyPlan.waitingCount)}</p>
          )}
        </section>

        {/* Journey */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.journey}</h2>
          <ol className="space-y-2">
            {report.phases.map((phase) => {
              const c = STATE_COLOR[phase.state];
              return (
                <li key={phase.id} className={`flex items-center gap-3 rounded-lg border p-3 ${phase.blocked.length > 0 ? "border-red-300 dark:border-red-800" : "border-border"}`}>
                  <PhaseIcon phase={phase} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{phase.title}</span>
                      {phase.blocked.length > 0 ? (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                          {phase.blocked.length} {t.onHold.toLowerCase()}
                        </span>
                      ) : (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.chip}`}>
                          {phase.total > 0 ? `${phase.done} ${t.of} ${phase.total}` : t.states[phase.state]}
                        </span>
                      )}
                    </div>
                    {phase.total > 0 && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${phase.pct}%` }} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Done / Now / Next */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Bucket title={t.done} tone="green">
            {report.donePhases.length > 0
              ? report.donePhases.map((p) => <li key={p.id} className="truncate">{p.title}</li>)
              : <li className="text-muted-foreground">—</li>}
          </Bucket>
          <Bucket title={t.now} tone="amber">
            {report.currentPhase
              ? <li className="font-medium">{report.currentPhase.title}</li>
              : <li className="text-muted-foreground">{t.nothingNow}</li>}
          </Bucket>
          <Bucket title={t.next} tone="gray">
            {report.upcomingPhases.length > 0
              ? report.upcomingPhases.map((p) => <li key={p.id} className="truncate">{p.title}</li>)
              : <li className="text-muted-foreground">{t.nothingNext}</li>}
          </Bucket>
        </section>

        {/* Other things to review (blockers already shown at the top) */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.attention}</h2>
          {otherAttention.length === 0 ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
              {report.blockers.length > 0 ? "—" : t.allGood}
            </p>
          ) : (
            <ul className="space-y-2">
              {otherAttention.map((a, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    a.severity === "high"
                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                      : a.severity === "medium"
                        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{i18n(a.message_i18n)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Materials */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Package className="h-4 w-4" />
            {t.materials}
          </h2>
          {report.materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noMaterials}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {report.materials.map((m, i) => (
                <span key={i} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground">
                  {m.name}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ActionBadge({ action, label }: { action: DailyActionType; label: string }) {
  const cfg: Record<DailyActionType, { cls: string; Icon: typeof Play }> = {
    unblock: { cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", Icon: OctagonAlert },
    do_now: { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", Icon: Play },
    start: { cls: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300", Icon: ArrowUpRight },
    assign: { cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", Icon: UserPlus },
  };
  const { cls, Icon } = cfg[action];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" | "gray" }) {
  const tones = {
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${tones[tone]}`}>
      <span className="font-bold">{value}</span>
      {label}
    </span>
  );
}

function Bucket({ title, tone, children }: { title: string; tone: "green" | "amber" | "gray"; children: React.ReactNode }) {
  const head = {
    green: "text-green-700 dark:text-green-400",
    amber: "text-amber-700 dark:text-amber-400",
    gray: "text-gray-600 dark:text-gray-400",
  };
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${head[tone]}`}>{title}</h3>
      <ul className="space-y-1 text-sm text-foreground">{children}</ul>
    </div>
  );
}
