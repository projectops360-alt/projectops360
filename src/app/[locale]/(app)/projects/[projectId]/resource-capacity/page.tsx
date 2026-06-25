import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { computeResourceCapacity } from "@/lib/capacity/service";
import { buildCapacitySummary, type CapacityLabels } from "@/lib/capacity/insight";
import {
  Users, Gauge, Activity, Ban, AlertTriangle, Clock, Wallet, Flag, Sparkles, CheckCircle2,
} from "lucide-react";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Terminology adapts per project type; the calculation engine never changes.
function labelsFor(projectType: string | null, isEs: boolean): CapacityLabels & { title: string; subtitle: string } {
  const map: Record<string, { en: string; ens: string }> = {
    data_center_construction: { en: "Crew", ens: "Crews" },
    residential_construction: { en: "Crew", ens: "Crews" },
    commercial_construction: { en: "Crew", ens: "Crews" },
    infrastructure: { en: "Crew", ens: "Crews" },
    industrial: { en: "Crew", ens: "Crews" },
    software_development: { en: "Resource", ens: "Resources" },
  };
  const w = map[projectType ?? ""] ?? { en: "Resource", ens: "Resources" };
  return {
    resourceWord: w.en, resourcesWord: w.ens,
    title: isEs ? "Inteligencia de Capacidad de Recursos" : "Resource Capacity Intelligence",
    subtitle: isEs
      ? "Capacidad real de la fuerza de trabajo vs. el plan — horas efectivas, utilización, cuellos de botella e impacto en hitos."
      : "Real workforce capacity vs. the plan — effective hours, utilization, bottlenecks, and milestone impact.",
  };
}

const STATUS_TONE: Record<string, string> = {
  available: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  healthy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  near_capacity: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  overallocated: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  needs_review: "bg-muted text-muted-foreground",
};
const HEALTH_TONE: Record<string, string> = {
  healthy: "text-green-600 dark:text-green-400", watch: "text-amber-600 dark:text-amber-400",
  at_risk: "text-orange-600 dark:text-orange-400", critical: "text-red-600 dark:text-red-400",
};

export default async function ResourceCapacityPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";
  if (!UUID_RE.test(projectId)) notFound();

  const org = await getOrgContext();
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects").select("id, project_type")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!project) notFound();

  const L = labelsFor(project.project_type as string | null, isEs);
  const r = await computeResourceCapacity(org, projectId, { weeks: 4 });
  const summary = buildCapacitySummary(r, L, isEs);
  const t = r.totals;
  const n = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString(isEs ? "es" : "en"));
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);

  const cards = [
    { label: isEs ? "Índice de Salud" : "Health Index", value: `${r.health.score}`, tone: HEALTH_TONE[r.health.band], icon: Gauge, sub: isEs ? bandEs(r.health.band) : r.health.band },
    { label: isEs ? "Capacidad Efectiva" : "Effective Capacity", value: `${n(t.totalEffectiveHours)}h`, icon: Activity, sub: `${isEs ? "nominal" : "nominal"} ${n(t.totalNominalHours)}h` },
    { label: isEs ? "Carga Asignada" : "Assigned Workload", value: `${n(t.totalAssignedHours)}h`, icon: Clock, sub: pct(t.averageUtilizationPercent) + (isEs ? " util." : " util.") },
    { label: isEs ? "Capacidad Restante" : "Remaining", value: `${n(t.totalRemainingHours)}h`, icon: Wallet, sub: "" },
    { label: isEs ? "Sobreasignadas" : "Overallocated", value: `${n(t.totalOverallocatedHours)}h`, tone: t.totalOverallocatedHours > 0 ? "text-red-600 dark:text-red-400" : undefined, icon: AlertTriangle, sub: `${t.overallocatedResourceCount + t.criticalResourceCount} ${L.resourcesWord.toLowerCase()}` },
    { label: isEs ? "Disponibilidad" : "Availability", value: pct(t.workforceAvailabilityPercent), icon: Users, sub: `${isEs ? "overhead" : "overhead"} ${pct(t.projectOverheadPercent)}` },
    { label: isEs ? "Cuellos de botella" : "Bottlenecks", value: `${t.criticalResourceCount}`, tone: t.criticalResourceCount > 0 ? "text-red-600 dark:text-red-400" : undefined, icon: Ban, sub: isEs ? "críticos" : "critical" },
    { label: isEs ? "Hitos en riesgo" : "At-risk Milestones", value: `${t.atRiskMilestoneCount}`, tone: t.atRiskMilestoneCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined, icon: Flag, sub: "" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Users className="h-6 w-6 text-brand-500" />{L.title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{L.subtitle}</p>
      </div>

      {/* Overview cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <c.icon className={`h-4 w-4 ${c.tone ?? "text-muted-foreground"}`} />
            </div>
            <p className={`mt-1.5 text-2xl font-bold tracking-tight ${c.tone ?? "text-foreground"}`}>{c.value}</p>
            {c.sub && <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>}
          </div>
        ))}
      </section>

      {/* PMO summary */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-4 w-4 text-purple-500" />{isEs ? "Resumen PMO" : "PMO Summary"}
        </h2>
        <p className="mt-2 text-sm font-medium text-foreground">{summary.headline}</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {summary.bullets.map((b, i) => <li key={i}>· {b}</li>)}
        </ul>
        {summary.bottlenecks.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Cuellos de botella" : "Bottlenecks"}</p>
            <ul className="mt-1 space-y-1 text-sm text-red-700 dark:text-red-300">{summary.bottlenecks.map((b, i) => <li key={i}>• {b}</li>)}</ul>
          </div>
        )}
        {summary.warnings.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Datos faltantes" : "Missing data"}</p>
            <ul className="mt-1 space-y-1 text-sm text-amber-700 dark:text-amber-300">{summary.warnings.map((b, i) => <li key={i}>⚠ {b}</li>)}</ul>
          </div>
        )}
        {summary.recommendations.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Acciones recomendadas (requieren tu aprobación)" : "Recommended actions (require your approval)"}</p>
            <ul className="mt-1 space-y-1 text-sm text-foreground">{summary.recommendations.map((b, i) => <li key={i}>→ {b}</li>)}</ul>
          </div>
        )}
      </section>

      {/* Capacity table */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-4 w-4 text-brand-500" />{isEs ? `Capacidad por ${L.resourceWord}` : `Capacity by ${L.resourceWord}`}
          <span className="ml-1 font-normal normal-case text-[11px]">({isEs ? "próximas 4 semanas" : "next 4 weeks"})</span>
        </h2>
        {r.resources.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {isEs ? "No hay recursos asignados con capacidad. Agrega asignaciones de recursos al proyecto." : "No resourced capacity. Add resource allocations to the project."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
                  <th className="py-2 pr-3">{L.resourceWord}</th>
                  <th className="px-3">{isEs ? "Rol" : "Role"}</th>
                  <th className="px-3 text-right">{isEs ? "Efectiva" : "Effective"}</th>
                  <th className="px-3 text-right">{isEs ? "Asignada" : "Assigned"}</th>
                  <th className="px-3 text-right">{isEs ? "Restante" : "Remaining"}</th>
                  <th className="px-3 text-right">Util.</th>
                  <th className="px-3 text-right">Overhead</th>
                  <th className="px-3">{isEs ? "Estado" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {r.resources.map((x) => (
                  <tr key={x.resourceKey} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium text-foreground">{x.name}</td>
                    <td className="px-3 text-muted-foreground">{x.role ?? "—"}</td>
                    <td className="px-3 text-right text-foreground">{n(x.effectivePeriodHours)}h</td>
                    <td className="px-3 text-right text-foreground">{n(x.assignedHours)}h</td>
                    <td className={`px-3 text-right ${x.remainingHours < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{n(x.remainingHours)}h</td>
                    <td className="px-3 text-right text-foreground">{pct(x.utilizationPercent)}</td>
                    <td className="px-3 text-right text-muted-foreground">{pct(x.overheadPercent)}</td>
                    <td className="px-3">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONE[x.status]}`}>
                        {statusLabel(x.status, isEs)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly timeline */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-4 w-4 text-brand-500" />{isEs ? "Capacidad semanal" : "Weekly capacity"}
          </h2>
          <ul className="space-y-2">
            {r.weekly.map((w) => {
              const u = w.utilizationPercent ?? 0;
              return (
                <li key={w.weekLabel} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{w.weekLabel}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${u > 120 ? "bg-red-500" : u > 100 ? "bg-orange-500" : u >= 90 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, u)}%` }} />
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">{n(w.assignedHours)}/{n(w.effectiveHours)}h · {pct(w.utilizationPercent)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Capacity risk list */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />{isEs ? "Riesgos de capacidad" : "Capacity risks"}
          </h2>
          {r.milestones.filter((m) => m.capacityRiskLevel !== "none").length === 0 && t.unassignedTaskCount === 0 && t.missingEstimateCount === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />{isEs ? "Sin riesgos de capacidad detectados." : "No capacity risks detected."}
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {r.milestones.filter((m) => m.capacityRiskLevel === "high" || m.capacityRiskLevel === "medium").map((m) => (
                <li key={m.milestoneId} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                  <span className="min-w-0 truncate text-foreground">{m.name}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${m.capacityRiskLevel === "high" ? STATUS_TONE.critical : STATUS_TONE.near_capacity}`}>
                    {m.overloadedResources > 0 ? `${m.overloadedResources} ${isEs ? "sobrecargados" : "overloaded"}` : m.tasksWithoutOwner > 0 ? `${m.tasksWithoutOwner} ${isEs ? "sin dueño" : "no owner"}` : `${m.tasksWithoutEstimate} ${isEs ? "sin estimar" : "no estimate"}`}
                  </span>
                </li>
              ))}
              {t.unassignedTaskCount > 0 && (
                <li className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                  <span className="text-foreground">{isEs ? "Tareas sin asignar" : "Unassigned tasks"}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t.unassignedTaskCount}{t.unassignedCriticalTaskCount > 0 ? ` · ${t.unassignedCriticalTaskCount} ${isEs ? "críticas" : "critical"}` : ""}</span>
                </li>
              )}
              {t.missingEstimateCount > 0 && (
                <li className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                  <span className="text-foreground">{isEs ? "Tareas sin estimación" : "Tasks without estimate"}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t.missingEstimateCount}</span>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* Health breakdown */}
      {r.health.deductions.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Gauge className="h-4 w-4 text-brand-500" />{isEs ? "Por qué este puntaje" : "Why this score"}
          </h2>
          <ul className="flex flex-wrap gap-2 text-xs">
            {r.health.deductions.map((d, i) => (
              <li key={i} className="rounded-lg border border-border bg-muted/30 px-2 py-1 text-muted-foreground">
                −{d.points} · {deductionLabel(d.reason, isEs)}{d.count ? ` (${d.count})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function statusLabel(s: string, isEs: boolean): string {
  const en: Record<string, string> = { available: "Available", healthy: "Healthy", near_capacity: "Near capacity", overallocated: "Overallocated", critical: "Critical", needs_review: "Needs review" };
  const es: Record<string, string> = { available: "Disponible", healthy: "Saludable", near_capacity: "Casi al límite", overallocated: "Sobreasignado", critical: "Crítico", needs_review: "Revisar" };
  return (isEs ? es : en)[s] ?? s;
}
function bandEs(b: string): string {
  return ({ healthy: "Saludable", watch: "Vigilar", at_risk: "En riesgo", critical: "Crítico" } as Record<string, string>)[b] ?? b;
}
function deductionLabel(reason: string, isEs: boolean): string {
  const en: Record<string, string> = {
    critical_resource: "critical resource", overallocated_resource: "overallocated resource",
    unassigned_critical_task: "unassigned critical task", missing_estimate: "missing estimate",
    milestone_severe_capacity_gap: "milestone capacity gap", missing_critical_role: "missing critical role",
    overhead_over_threshold: "overhead over threshold", effective_below_70pct_nominal: "effective < 70% of nominal",
  };
  const es: Record<string, string> = {
    critical_resource: "recurso crítico", overallocated_resource: "recurso sobreasignado",
    unassigned_critical_task: "tarea crítica sin asignar", missing_estimate: "estimación faltante",
    milestone_severe_capacity_gap: "brecha de capacidad en hito", missing_critical_role: "rol crítico faltante",
    overhead_over_threshold: "overhead sobre umbral", effective_below_70pct_nominal: "efectiva < 70% de nominal",
  };
  return (isEs ? es : en)[reason] ?? reason;
}
