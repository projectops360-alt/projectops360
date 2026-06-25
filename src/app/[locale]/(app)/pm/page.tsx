import { setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth";
import { getPmCenterSummary } from "@/lib/pm-center/service";
import {
  Briefcase, FolderKanban, Ban, AlertTriangle, Route, Scale, CalendarDays,
  Flag, ArrowUpRight, ListChecks,
} from "lucide-react";

export default async function PmCenterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const base = isEs ? "/es" : "";

  const org = await getOrgContext();

  // Team members / stakeholders / clients / viewers don't get the PM Center.
  if (
    org.orgRole === "TEAM_MEMBER" || org.orgRole === "STAKEHOLDER" ||
    org.orgRole === "CLIENT" || org.orgRole === "VIEWER"
  ) {
    redirect(`${base}/my-work`);
  }

  const data = await getPmCenterSummary(org, locale);

  if (!data.hasProjects) {
    return (
      <div className="space-y-6">
        <PmHeader tt={tt} />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            {tt("No projects assigned to you yet. Projects you manage or are added to will appear here.",
              "Aún no tienes proyectos asignados. Los proyectos que gestionas o en los que te agregan aparecerán aquí.")}
          </p>
          <Link href={`${base}/projects`} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            <FolderKanban className="h-4 w-4" />{tt("Projects", "Proyectos")}
          </Link>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: tt("My Projects", "Mis Proyectos"), value: data.counts.projects, icon: FolderKanban, tone: "text-blue-600 dark:text-blue-400" },
    { label: tt("Open Tasks", "Tareas Abiertas"), value: data.counts.openTasks, icon: ListChecks, tone: "text-brand-600 dark:text-brand-400" },
    { label: tt("Blocked", "Bloqueadas"), value: data.counts.blocked, icon: Ban, tone: "text-red-600 dark:text-red-400" },
    { label: tt("Open Risks", "Riesgos Abiertos"), value: data.counts.risks, icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <PmHeader tt={tt} />

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.tone}`} />
            </div>
            <p className={`mt-1.5 text-2xl font-bold tracking-tight ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* My Active Projects */}
        <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <SectionTitle icon={<FolderKanban className="h-4 w-4 text-brand-500" />} title={tt("My Active Projects", "Mis Proyectos Activos")} />
          <ul className="mt-3 space-y-2">
            {data.projects.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="block rounded-lg border border-border p-3 transition-colors hover:border-brand-400 hover:bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">{p.status}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {p.doneTasks}/{p.totalTasks} · {p.blockedTasks > 0 ? tt(`${p.blockedTasks} blocked`, `${p.blockedTasks} bloqueadas`) : `${p.progress}%`}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* My Critical Tasks */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Route className="h-4 w-4 text-brand-500" />} title={tt("My Critical Tasks", "Mis Tareas Críticas")} />
          {data.criticalTasks.length === 0 ? <Empty text={tt("Nothing critical right now.", "Nada crítico ahora.")} /> : (
            <ul className="mt-3 space-y-1.5">
              {data.criticalTasks.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="block rounded-lg border border-border p-2.5 transition-colors hover:border-brand-400 hover:bg-muted/30">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{t.project} · {t.reason}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Milestones needing attention */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Flag className="h-4 w-4 text-brand-500" />} title={tt("Milestones Requiring Attention", "Hitos que Requieren Atención")} />
          {data.milestonesNeedingAttention.length === 0 ? <Empty text={tt("No milestones due soon.", "Sin hitos próximos a vencer.")} /> : (
            <ul className="mt-3 space-y-1.5">
              {data.milestonesNeedingAttention.map((m) => (
                <li key={m.id}>
                  <Link href={m.href} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 transition-colors hover:border-brand-400 hover:bg-muted/30">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{m.title}</p><p className="text-[11px] text-muted-foreground">{m.project}</p></div>
                    {m.targetDate && <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400">{new Date(m.targetDate).toLocaleDateString(locale, { month: "short", day: "numeric" })}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* My Risks & Issues */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} title={tt("Risks & Issues I Own", "Riesgos e Incidencias a mi Cargo")} />
          {data.myRisks.length === 0 ? <Empty text={tt("No open risks.", "Sin riesgos abiertos.")} /> : (
            <ul className="mt-3 space-y-1.5">
              {data.myRisks.map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 transition-colors hover:border-brand-400 hover:bg-muted/30">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{r.title}</p><p className="text-[11px] text-muted-foreground">{r.project}</p></div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{r.severity}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pending Decisions */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<Scale className="h-4 w-4 text-brand-500" />} title={tt("Pending Decisions", "Decisiones Pendientes")} />
          {data.pendingDecisions.length === 0 ? <Empty text={tt("No decisions waiting.", "Sin decisiones pendientes.")} /> : (
            <ul className="mt-3 space-y-1.5">
              {data.pendingDecisions.map((d, i) => (
                <li key={i}>
                  <Link href={d.href} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 transition-colors hover:border-brand-400 hover:bg-muted/30">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{d.title}</p><p className="text-[11px] text-muted-foreground">{d.project} · {d.impact}</p></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle icon={<CalendarDays className="h-4 w-4 text-brand-500" />} title={tt("Upcoming 14 Days", "Próximos 14 Días")} />
          {data.upcoming.length === 0 ? <Empty text={tt("Nothing scheduled.", "Nada programado.")} /> : (
            <ul className="mt-3 space-y-1.5">
              {data.upcoming.map((u, i) => (
                <li key={i}>
                  <Link href={u.href} className="flex items-center gap-3 rounded-lg p-1 text-sm transition-colors hover:bg-muted/30">
                    <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{new Date(u.date).toLocaleDateString(locale, { month: "short", day: "numeric" })}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{u.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{u.project}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function PmHeader({ tt }: { tt: (en: string, es: string) => string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Briefcase className="h-6 w-6 text-brand-500" />
          {tt("PM Center", "Centro del PM")}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {tt("Your execution home: your projects, critical tasks, milestones, risks and next actions.",
            "Tu centro de ejecución: tus proyectos, tareas críticas, hitos, riesgos y próximas acciones.")}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{icon}{title}</h2>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{text}</p>;
}
