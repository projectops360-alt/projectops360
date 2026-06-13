"use client";

// ============================================================================
// Project Status Report — plain-language, visual, print-to-PDF
// ============================================================================
// Story-driven status for a non-technical reader: a progress ring, the
// milestone journey, what's done / happening now / coming next, what needs
// attention, and the materials. "Download PDF" uses the browser print dialog
// (print CSS in globals.css isolates #status-report-print).
// ============================================================================

import { Download, CheckCircle2, Loader2, Circle, AlertTriangle, Package, CalendarDays } from "lucide-react";
import type { Locale } from "@/types/database";
import type { ProjectStatusReport, PhaseState } from "@/lib/execution/status-report";

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
    attention: "What needs your attention",
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
    attention: "Lo que necesita tu atención",
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

function PhaseIcon({ state }: { state: PhaseState }) {
  if (state === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (state === "in_progress") return <Loader2 className="h-5 w-5 text-amber-500" />;
  return <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600" />;
}

export function StatusReportClient({ report, locale }: { report: ProjectStatusReport; locale: Locale }) {
  const t = L[locale] ?? L.en;
  const i18n = (f: { en?: string; es?: string }) => f[locale] ?? f.en ?? "";
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }) : "—";

  const severityRank = { high: 0, medium: 1, low: 2 };
  const attention = [...report.attention].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Action bar (hidden in PDF) */}
      <div className="mb-4 flex items-center justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
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
        </header>

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

        {/* Journey */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.journey}</h2>
          <ol className="space-y-2">
            {report.phases.map((phase) => {
              const c = STATE_COLOR[phase.state];
              return (
                <li key={phase.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <PhaseIcon state={phase.state} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{phase.title}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.chip}`}>
                        {phase.total > 0 ? `${phase.done} ${t.of} ${phase.total}` : t.states[phase.state]}
                      </span>
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

        {/* Attention */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.attention}</h2>
          {attention.length === 0 ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
              {t.allGood}
            </p>
          ) : (
            <ul className="space-y-2">
              {attention.map((a, i) => (
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
