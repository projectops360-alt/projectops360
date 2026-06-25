import { setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext, getAccessibleProjectIds } from "@/lib/auth";
import { localizedHref } from "@/i18n/href";
import { getI18nValue, type I18nField } from "@/types/database";
import { ListChecks, FolderKanban, CheckCircle2 } from "lucide-react";

const DONE = new Set(["done", "tested"]);

export default async function MyWorkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);

  const org = await getOrgContext();
  const supabase = createAdminClient();
  const link = (p: string) => localizedHref(locale, p);

  const accessibleIds = await getAccessibleProjectIds(org);
  const noProjects = accessibleIds !== null && accessibleIds.length === 0;

  // Projects the user belongs to.
  let projects: { id: string; title: string; status: string }[] = [];
  let tasks: { id: string; title: string; project_id: string | null; status: string }[] = [];

  if (!noProjects) {
    let projectsQ = supabase.from("projects").select("id, title_i18n, slug, status")
      .eq("organization_id", org.organizationId).is("deleted_at", null);
    if (accessibleIds !== null) projectsQ = projectsQ.in("id", accessibleIds);

    let tasksQ = supabase.from("roadmap_tasks").select("id, title, project_id, status")
      .eq("organization_id", org.organizationId).is("deleted_at", null)
      .eq("assigned_to", org.userId);
    if (accessibleIds !== null) tasksQ = tasksQ.in("project_id", accessibleIds);

    const [pRes, tRes] = await Promise.all([projectsQ, tasksQ]);
    projects = (pRes.data ?? []).map((p) => ({ id: p.id, title: getI18nValue(p.title_i18n as I18nField, locale as "en" | "es") || p.slug, status: p.status }));
    tasks = (tRes.data ?? []) as typeof tasks;
  }

  const openTasks = tasks.filter((t) => !DONE.has(t.status));
  const nameById = new Map(projects.map((p) => [p.id, p.title]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ListChecks className="h-6 w-6 text-brand-500" />
          {tt("My Work", "Mi Trabajo")}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {tt("Tasks assigned to you and the projects you collaborate on.",
            "Tareas asignadas a ti y los proyectos en los que colaboras.")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assigned tasks */}
        <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ListChecks className="h-4 w-4 text-brand-500" />{tt("My Assigned Tasks", "Mis Tareas Asignadas")}
          </h2>
          {openTasks.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />{tt("No open tasks assigned to you.", "No tienes tareas abiertas asignadas.")}
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {openTasks.map((t) => (
                <li key={t.id}>
                  <Link href={link(`/projects/${t.project_id}/workboard?task=${t.id}`)} className="block rounded-lg border border-border p-2.5 transition-colors hover:border-brand-400 hover:bg-muted/30">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{t.project_id ? nameById.get(t.project_id) ?? "—" : "—"} · {t.status.replace(/_/g, " ")}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* My projects */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <FolderKanban className="h-4 w-4 text-brand-500" />{tt("My Projects", "Mis Proyectos")}
          </h2>
          {projects.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              {tt("You haven't been added to any project yet.", "Aún no te han agregado a ningún proyecto.")}
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={link(`/projects/${p.id}/workboard`)} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 transition-colors hover:border-brand-400 hover:bg-muted/30">
                    <span className="truncate text-sm font-medium text-foreground">{p.title}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">{p.status}</span>
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
