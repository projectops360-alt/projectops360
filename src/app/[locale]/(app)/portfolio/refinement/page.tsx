import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { Link } from "@/i18n/navigation";
import { bandForScore } from "@/lib/refinement/templates";
import { detectRefinementRisks } from "@/lib/refinement/risk";
import { Layers, Gauge, ShieldAlert, CheckCircle2, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

const RESOLVED = new Set(["ready_for_planning", "planned", "in_execution", "done"]);

// Portfolio-wide refinement readiness: aggregates every project's refinement
// backlog so a PMO can see, across the portfolio, what's ready, what's stuck,
// and what's at risk before work moves to execution.
export default async function PortfolioRefinementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";
  const org = await getOrgContext();
  const supabase = await createClient();

  const [projectsRes, itemsRes, depsRes] = await Promise.all([
    supabase.from("projects").select("id, slug, title_i18n").eq("organization_id", org.organizationId).is("deleted_at", null),
    supabase.from("project_backlog_items").select("id, project_id, refinement_status, readiness_score, priority, risk_level, owner_id, estimation_method, estimate_value, updated_at, status")
      .eq("organization_id", org.organizationId).is("deleted_at", null).neq("status", "promoted"),
    supabase.from("work_item_dependencies").select("backlog_item_id, depends_on_item_id").eq("organization_id", org.organizationId),
  ]);

  const projects = (projectsRes.data ?? []) as Record<string, unknown>[];
  const items = (itemsRes.data ?? []) as Record<string, unknown>[];
  const deps = (depsRes.data ?? []) as Record<string, unknown>[];

  const statusById = new Map(items.map((it) => [String(it.id), String(it.refinement_status ?? "new")]));
  const unresolvedFor = (itemId: string) => deps
    .filter((d) => String(d.backlog_item_id) === itemId)
    .filter((d) => !RESOLVED.has(statusById.get(String(d.depends_on_item_id)) ?? "new")).length;

  const byProject = new Map<string, Record<string, unknown>[]>();
  for (const it of items) {
    const pid = String(it.project_id);
    if (!byProject.has(pid)) byProject.set(pid, []);
    byProject.get(pid)!.push(it);
  }

  const rows = projects.map((proj) => {
    const pid = String(proj.id);
    const its = byProject.get(pid) ?? [];
    const scored = its.filter((it) => it.readiness_score != null);
    const avg = scored.length > 0 ? Math.round(scored.reduce((s, it) => s + Number(it.readiness_score ?? 0), 0) / scored.length) : 0;
    const ready = its.filter((it) => String(it.refinement_status) === "ready_for_planning").length;
    const atRisk = its.filter((it) => detectRefinementRisks(it as never, unresolvedFor(String(it.id))).length > 0).length;
    return {
      id: pid,
      title: getI18nValue(proj.title_i18n as never, locale as Locale) || String(proj.slug),
      total: its.length, avg, ready, atRisk,
    };
  }).filter((r) => r.total > 0).sort((a, b) => b.atRisk - a.atRisk || a.avg - b.avg);

  const totals = rows.reduce((acc, r) => ({ total: acc.total + r.total, ready: acc.ready + r.ready, atRisk: acc.atRisk + r.atRisk }), { total: 0, ready: 0, atRisk: 0 });
  const portfolioAvg = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.avg * r.total, 0) / Math.max(1, totals.total)) : 0;

  const TONE: Record<string, string> = {
    red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    green: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Layers className="h-6 w-6 text-brand-500" />{isEs ? "Refinamiento del Portafolio" : "Portfolio Refinement"}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {isEs ? "Estado de preparación del trabajo en todos los proyectos antes de pasar a ejecución: readiness, listos para planear y riesgos de refinamiento." : "Work readiness across all projects before execution: readiness, ready-to-plan, and refinement risks."}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Layers className="h-4 w-4 text-brand-500" />} label={isEs ? "Ítems a refinar" : "Items to refine"} value={totals.total} />
        <Kpi icon={<Gauge className="h-4 w-4 text-brand-500" />} label={isEs ? "Readiness del portafolio" : "Portfolio readiness"} value={`${portfolioAvg}/100`} tone="text-brand-600 dark:text-brand-400" />
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label={isEs ? "Listos para planear" : "Ready for planning"} value={totals.ready} tone="text-green-600 dark:text-green-400" />
        <Kpi icon={<ShieldAlert className="h-4 w-4 text-red-500" />} label={isEs ? "En riesgo" : "At risk"} value={totals.atRisk} tone={totals.atRisk > 0 ? "text-red-600 dark:text-red-400" : undefined} />
      </section>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{isEs ? "Proyecto" : "Project"}</th>
              <th className="px-3 py-2 text-right">{isEs ? "Ítems" : "Items"}</th>
              <th className="px-3 py-2 text-left">{isEs ? "Readiness" : "Readiness"}</th>
              <th className="px-3 py-2 text-right">{isEs ? "Listos" : "Ready"}</th>
              <th className="px-3 py-2 text-right">{isEs ? "En riesgo" : "At risk"}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const band = bandForScore(r.avg);
              return (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="px-3 py-2 font-medium text-foreground">{r.title}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.total}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TONE[band.tone]}`}>{r.avg}</span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-brand-500" style={{ width: `${r.avg}%` }} /></span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{r.ready}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.atRisk > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{r.atRisk}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/projects/${r.id}/delivery`} className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">{isEs ? "Refinar" : "Refine"}<ArrowUpRight className="h-3 w-3" /></Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">{isEs ? "No hay trabajo en refinamiento en ningún proyecto todavía." : "No work in refinement across any project yet."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">{label}</p>{icon}</div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
