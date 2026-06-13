import { setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { getOrgContext } from "@/lib/auth";
import { getCommandCenterSummary, band, type CommandCenterData, type HealthBand } from "@/lib/command-center/service";
import {
  UploadCloud, Sparkles, BarChart3, Gauge, FolderKanban, Ban, Route, Wallet, Scale,
  AlertTriangle, OctagonAlert, CheckCircle2, Users, Package, Network, CalendarDays, Activity,
  ArrowUpRight, Clock, ListChecks,
} from "lucide-react";

const BAND_BAR: Record<HealthBand, string> = { green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500" };
const BAND_TEXT: Record<HealthBand, string> = { green: "text-green-600 dark:text-green-400", amber: "text-amber-600 dark:text-amber-400", red: "text-red-600 dark:text-red-400" };
const KPI_TONE: Record<string, string> = {
  green: "text-green-600 dark:text-green-400", blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400", red: "text-red-600 dark:text-red-400", purple: "text-purple-600 dark:text-purple-400",
};
const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);

  const org = await getOrgContext();
  const data = await getCommandCenterSummary(org.organizationId, locale);
  const base = `/${locale}`;

  const KPI_LABEL: Record<string, string> = {
    portfolio_health: tt("Portfolio Health", "Salud del Portafolio"),
    active_projects: tt("Active Projects", "Proyectos Activos"),
    blocked_tasks: tt("Blocked Tasks", "Tareas Bloqueadas"),
    critical_path_risks: tt("Critical Path Risks", "Riesgos de Ruta Crítica"),
    budget_variance: tt("Budget Variance", "Variación de Presupuesto"),
    pm_decisions: tt("PM Decisions", "Decisiones del PM"),
  };
  const HEALTH_LABEL: Record<string, string> = {
    schedule: tt("Schedule", "Cronograma"), budget: tt("Budget", "Presupuesto"),
    resources: tt("Resources", "Recursos"), materials: tt("Materials", "Materiales"),
    risk: tt("Risk", "Riesgo"), critical_path: tt("Critical Path", "Ruta Crítica"),
  };

  // ── Empty state: no projects ──
  if (!data.hasProjects) {
    return (
      <div className="space-y-6">
        <Header tt={tt} base={base} />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <Gauge className="h-10 w-10 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            {tt("Create or import a project to activate the PMO Command Center.",
              "Crea o importa un proyecto para activar el PMO Command Center.")}
          </p>
          <div className="flex gap-2">
            <Link href={`${base}/import`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"><UploadCloud className="h-4 w-4" />{tt("Import Project", "Importar Proyecto")}</Link>
            <Link href={`${base}/projects`} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"><FolderKanban className="h-4 w-4" />{tt("Projects", "Proyectos")}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header tt={tt} base={base} />

      {/* KPI cards — each drills into its related view */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {data.kpis.map((k) => {
          const Icon = { portfolio_health: Gauge, active_projects: FolderKanban, blocked_tasks: Ban, critical_path_risks: Route, budget_variance: Wallet, pm_decisions: Scale }[k.key] ?? Gauge;
          const href = KPI_HREF(base)[k.key];
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{KPI_LABEL[k.key] ?? k.key}</p>
                <Icon className={`h-4 w-4 ${KPI_TONE[k.tone]}`} />
              </div>
              <p className={`mt-1.5 text-2xl font-bold tracking-tight ${KPI_TONE[k.tone]}`}>{k.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{k.subtitle}</p>
            </>
          );
          return href ? (
            <Link key={k.key} href={href} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-400 hover:bg-muted/30">
              {inner}
              <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-400">{tt("View", "Ver")} <ArrowUpRight className="h-3 w-3" /></span>
            </Link>
          ) : (
            <div key={k.key} className="rounded-xl border border-border bg-card p-4">{inner}</div>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Portfolio Health Engine */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Gauge className="h-4 w-4 text-brand-500" />} title={tt("Portfolio Health Engine", "Motor de Salud del Portafolio")} />
          <div className="mt-4 flex items-center gap-5">
            <HealthRing score={data.portfolioHealth.overall} />
            <div className="flex-1 space-y-2">
              {data.portfolioHealth.dimensions.map((d) => {
                const b = band(d.score);
                return (
                  <div key={d.key}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{HEALTH_LABEL[d.key] ?? d.key}</span>
                      <span className={`font-semibold ${BAND_TEXT[b]}`}>{d.score}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${BAND_BAR[b]}`} style={{ width: `${d.score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">{tt(data.portfolioHealth.derivedFrom, "Calculado a partir de datos conectados de cronograma, presupuesto, recursos, materiales y riesgos.")}</p>
        </section>

        {/* Today's PMO Focus */}
        <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <SectionTitle icon={<ListChecks className="h-4 w-4 text-brand-500" />} title={tt("Today's PMO Focus", "Foco del PMO Hoy")} />
          <ul className="mt-3 space-y-2">
            {data.pmoFocus.map((f) => (
              <li key={f.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <span className={`mt-0.5 shrink-0 ${f.severity === "critical" ? "text-red-500" : f.severity === "ready" ? "text-green-500" : "text-amber-500"}`}>
                  {f.severity === "critical" ? <OctagonAlert className="h-4 w-4" /> : f.severity === "ready" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{f.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${SEV_BADGE[f.severity]}`}>{f.severity}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{f.explanation}</p>
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">{f.action}{f.project ? ` · ${f.project}` : ""}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Operator Briefing */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Sparkles className="h-4 w-4 text-purple-500" />} title={tt("AI Operator Briefing", "Resumen del Operador IA")} />
          {data.aiRecommendations.length === 0 ? (
            <Empty text={tt("No recommendations right now — execution data looks clean.", "Sin recomendaciones ahora — los datos de ejecución lucen limpios.")} />
          ) : (
            <ul className="mt-3 space-y-2">
              {data.aiRecommendations.map((r) => (
                <li key={r.id} className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    {r.confidence != null && <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">{Math.round(r.confidence * 100)}%</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.explanation}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{r.impact}</span>
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-400">{r.action} →</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Critical Path Monitor */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Route className="h-4 w-4 text-brand-500" />} title={tt("Critical Path Monitor", "Monitor de Ruta Crítica")} />
          {data.criticalPath.length === 0 ? (
            <Empty text={tt("Critical path appears once tasks have durations and dependencies.", "La ruta crítica aparece cuando las tareas tienen duración y dependencias.")} />
          ) : (
            <ol className="mt-3 space-y-1.5">
              {data.criticalPath.map((c) => (
                <li key={c.order} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{c.order}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.task}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.project}{c.blocker ? ` · ${c.blocker}` : ""}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.risk === "red" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" : c.risk === "amber" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"}`}>{c.status}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Decision Queue */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Scale className="h-4 w-4 text-brand-500" />} title={tt("Decision Queue", "Cola de Decisiones")} link={{ href: `${base}/projects`, label: tt("All", "Todas") }} />
          {data.decisionQueue.length === 0 ? (
            <Empty text={tt("No decisions are waiting on you.", "No hay decisiones esperando por ti.")} />
          ) : (
            <ul className="mt-3 space-y-2">
              {data.decisionQueue.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{d.title}</p><p className="text-xs text-muted-foreground">{d.project ?? "—"} · {d.impact}</p></div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{tt("Pending", "Pendiente")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Resource & Labor Capacity */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Users className="h-4 w-4 text-brand-500" />} title={tt("Resource & Labor Capacity", "Capacidad de Recursos y Mano de Obra")} link={{ href: `${base}/team`, label: tt("Team", "Equipo") }} />
          {data.resourceCapacity.length === 0 ? (
            <Empty text={tt("Add people or crews to see capacity.", "Agrega personas o cuadrillas para ver la capacidad.")} />
          ) : (
            <ul className="mt-3 space-y-1.5">
              {data.resourceCapacity.map((r, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate text-foreground">{r.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${r.utilization == null ? "bg-gray-300" : r.utilization > 100 ? "bg-red-500" : r.utilization >= 85 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, r.utilization ?? 0)}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{r.utilization != null ? `${r.utilization}% · ` : ""}{tt(r.status, statusEs(r.status))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Material & Procurement Risk */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Package className="h-4 w-4 text-brand-500" />} title={tt("Material & Procurement Risk", "Riesgo de Materiales y Compras")} />
          {data.materialProcurementRisk.length === 0 ? (
            <Empty text={tt("No materials at risk.", "No hay materiales en riesgo.")} />
          ) : (
            <ul className="mt-3 space-y-2">
              {data.materialProcurementRisk.map((m, i) => (
                <li key={i} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{m.quantity}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{m.project}{m.requiredBy ? ` · ${tt("by", "para")} ${m.requiredBy}` : ""}</span>
                    <span className="flex items-center gap-1.5">
                      {m.confidence != null && <span className={m.confidence < 80 ? "text-amber-600 dark:text-amber-400" : ""}>{m.confidence}%</span>}
                      <span className="rounded-full bg-muted px-1.5 py-0.5">{m.status.replace(/_/g, " ")}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Living Graph Signals */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Network className="h-4 w-4 text-brand-500" />} title={tt("Living Graph Signals", "Señales del Living Graph")} />
          {!data.hasGraph ? (
            <Empty text={tt("Living Graph signals will appear once tasks, dependencies, resources, materials, or risks are connected.", "Las señales del Living Graph aparecerán cuando se conecten tareas, dependencias, recursos, materiales o riesgos.")} />
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {data.livingGraphSignals.map((s) => (
                <div key={s.key} className="rounded-lg border border-border p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming 14 days */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<CalendarDays className="h-4 w-4 text-brand-500" />} title={tt("Upcoming 14 Days", "Próximos 14 Días")} />
          {data.upcomingLookahead.length === 0 ? (
            <Empty text={tt("Nothing scheduled in the next two weeks.", "Nada programado en las próximas dos semanas.")} />
          ) : (
            <ul className="mt-3 space-y-1.5">
              {data.upcomingLookahead.map((u, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{new Date(u.date).toLocaleDateString(locale, { month: "short", day: "numeric" })}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{u.event}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{u.impact}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Budget & Forecast Signals */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Wallet className="h-4 w-4 text-brand-500" />} title={tt("Budget & Forecast Signals", "Señales de Presupuesto y Pronóstico")} link={{ href: `${base}/reports`, label: tt("Reports", "Reportes") }} />
          {data.budgetForecastSignals.length === 0 ? (
            <Empty text={tt("No budget recorded yet.", "Aún no hay presupuesto registrado.")} />
          ) : (
            <ul className="mt-3 space-y-1.5">
              {data.budgetForecastSignals.map((b, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground">{b.area}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{b.estimate.toLocaleString()} → {b.forecast.toLocaleString()}</span>
                  <span className={`w-16 shrink-0 text-right text-xs font-medium ${b.variance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{b.variance >= 0 ? "+" : ""}{b.variance.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent activity + Quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <SectionTitle icon={<Activity className="h-4 w-4 text-brand-500" />} title={tt("Recent Activity", "Actividad Reciente")} />
          {data.recentActivity.length === 0 ? (
            <Empty text={tt("No recent changes.", "Sin cambios recientes.")} />
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{a.event.replace(/_/g, " ")} · <span className="text-muted-foreground">{a.entity.replace(/_/g, " ")}</span></span>
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{a.source}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(a.at).toLocaleDateString(locale, { month: "short", day: "numeric" })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<ArrowUpRight className="h-4 w-4 text-brand-500" />} title={tt("Quick Actions", "Acciones Rápidas")} />
          <div className="mt-3 grid grid-cols-1 gap-2">
            <QuickLink href={`${base}/import`} icon={<UploadCloud className="h-4 w-4" />} label={tt("Import Project", "Importar Proyecto")} />
            <QuickLink href={`${base}/ai-operator`} icon={<Sparkles className="h-4 w-4" />} label={tt("Ask AI Operator", "Consultar Operador IA")} />
            <QuickLink href={`${base}/reports`} icon={<BarChart3 className="h-4 w-4" />} label={tt("Create Report", "Crear Reporte")} />
            <QuickLink href={`${base}/projects`} icon={<FolderKanban className="h-4 w-4" />} label={tt("Projects", "Proyectos")} />
            <QuickLink href={`${base}/team`} icon={<Users className="h-4 w-4" />} label={tt("Team", "Equipo")} />
          </div>
        </section>
      </div>
    </div>
  );
}

/** Where each KPI drills into. Blocked/critical/budget open a prebuilt report
 *  in the Reports studio; the rest go to their module. */
function KPI_HREF(base: string): Record<string, string | undefined> {
  return {
    portfolio_health: `${base}/reports?report=project_health_report`,
    active_projects: `${base}/projects`,
    blocked_tasks: `${base}/reports?report=blocked_tasks_report`,
    critical_path_risks: `${base}/reports?report=critical_path_report`,
    budget_variance: `${base}/reports?report=cost_overrun_risk`,
    pm_decisions: `${base}/projects`,
  };
}

function statusEs(s: string): string {
  return ({ Available: "Disponible", Overloaded: "Sobrecargado", Unconfirmed: "Sin confirmar", Underallocated: "Subutilizado", Missing: "Faltante" } as Record<string, string>)[s] ?? s;
}

function Header({ tt, base }: { tt: (en: string, es: string) => string; base: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Gauge className="h-6 w-6 text-brand-500" />
          {tt("PMO Command Center", "PMO Command Center")}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {tt("AI-powered control tower for schedule, budget, resources, materials, risks, decisions, and execution intelligence.",
            "Torre de control con IA para cronograma, presupuesto, recursos, materiales, riesgos, decisiones e inteligencia de ejecución.")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`${base}/import`} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"><UploadCloud className="h-4 w-4" />{tt("Import", "Importar")}</Link>
        <Link href={`${base}/ai-operator`} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"><Sparkles className="h-4 w-4 text-purple-500" />{tt("Ask AI", "Consultar IA")}</Link>
        <Link href={`${base}/reports`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"><BarChart3 className="h-4 w-4" />{tt("Create Report", "Crear Reporte")}</Link>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, link }: { icon: React.ReactNode; title: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{icon}{title}</h2>
      {link && <Link href={link.href} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">{link.label} →</Link>}
    </div>
  );
}

function HealthRing({ score }: { score: number }) {
  const r = 46, c = 2 * Math.PI * r, offset = c - (score / 100) * c;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="11" className="text-muted" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 60 60)" />
      <text x="60" y="66" textAnchor="middle" className="fill-foreground" fontSize="28" fontWeight="700">{score}</text>
    </svg>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand-400 hover:bg-muted/40">
      <span className="text-brand-500">{icon}</span>{label}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{text}</p>;
}

export type { CommandCenterData };
