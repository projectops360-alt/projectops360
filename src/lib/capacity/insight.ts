// ============================================================================
// ProjectOps360° — Resource Capacity Intelligence: deterministic PMO summary
// ============================================================================
// Builds an evidence-based summary STRICTLY from calculated numbers. No AI, no
// invented data. (An optional AI rephrasing can wrap this later, grounded in the
// same numbers.) Every sentence references a real metric.
// ============================================================================

import type { ResourceCapacityResult } from "./service";

export interface CapacityLabels {
  resourceWord: string;   // e.g. "Resource" / "Crew" / "Consultant"
  resourcesWord: string;
}

export interface CapacitySummary {
  headline: string;
  bullets: string[];
  bottlenecks: string[];
  recommendations: string[];
  warnings: string[];
}

export function buildCapacitySummary(r: ResourceCapacityResult, labels: CapacityLabels, isEs: boolean): CapacitySummary {
  const t = r.totals;
  const n = (v: number) => Math.round(v).toLocaleString(isEs ? "es" : "en");
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
  const bullets: string[] = [];
  const bottlenecks: string[] = [];
  const recommendations: string[] = [];
  const warnings: string[] = [];

  if (!r.hasResources) {
    return {
      headline: isEs ? "Aún no hay recursos con capacidad para analizar." : "No resourced capacity to analyze yet.",
      bullets: [], bottlenecks: [],
      recommendations: [isEs ? "Asigna recursos al proyecto y define su capacidad semanal." : "Add resources to the project and set their weekly capacity."],
      warnings: [],
    };
  }

  // Capacity headline (nominal → effective), grounded.
  bullets.push(isEs
    ? `El proyecto tiene ${n(t.totalNominalHours)} horas nominales en el periodo, pero solo ${n(t.totalEffectiveHours)} horas efectivas tras overhead y disponibilidad (disponibilidad ${pct(t.workforceAvailabilityPercent)}, overhead ${pct(t.projectOverheadPercent)}).`
    : `The project has ${n(t.totalNominalHours)} nominal hours this period, but only ${n(t.totalEffectiveHours)} effective hours after overhead and availability (availability ${pct(t.workforceAvailabilityPercent)}, overhead ${pct(t.projectOverheadPercent)}).`);

  bullets.push(isEs
    ? `Carga asignada: ${n(t.totalAssignedHours)} h · capacidad restante: ${n(t.totalRemainingHours)} h · utilización promedio: ${pct(t.averageUtilizationPercent)}.`
    : `Assigned workload: ${n(t.totalAssignedHours)} h · remaining capacity: ${n(t.totalRemainingHours)} h · average utilization: ${pct(t.averageUtilizationPercent)}.`);

  // Bottlenecks: most-utilized overloaded/critical resources.
  const overloaded = r.resources
    .filter((x) => x.status === "critical" || x.status === "overallocated")
    .sort((a, b) => (b.utilizationPercent ?? 0) - (a.utilizationPercent ?? 0))
    .slice(0, 5);
  for (const x of overloaded) {
    bottlenecks.push(isEs
      ? `${x.name} está al ${pct(x.utilizationPercent)} de utilización con ${n(x.overallocatedHours)} h sobreasignadas.`
      : `${x.name} is at ${pct(x.utilizationPercent)} utilization with ${n(x.overallocatedHours)} overallocated hours.`);
  }

  // Milestones at risk.
  const atRisk = r.milestones.filter((m) => m.capacityRiskLevel === "high").slice(0, 5);
  for (const m of atRisk) {
    bottlenecks.push(isEs
      ? `El hito "${m.name}" está en riesgo por capacidad (${m.overloadedResources} ${labels.resourcesWord.toLowerCase()} sobrecargados, ${m.tasksWithoutOwner} tareas sin responsable).`
      : `Milestone "${m.name}" is at capacity risk (${m.overloadedResources} overloaded ${labels.resourcesWord.toLowerCase()}, ${m.tasksWithoutOwner} tasks without an owner).`);
  }

  // Missing-data warnings (never hide incompleteness).
  if (t.missingEstimateCount > 0) warnings.push(isEs
    ? `${t.missingEstimateCount} tareas sin estimación: el pronóstico de capacidad está incompleto.`
    : `${t.missingEstimateCount} tasks have no estimate, so the capacity forecast is incomplete.`);
  if (t.unassignedCriticalTaskCount > 0) warnings.push(isEs
    ? `${t.unassignedCriticalTaskCount} tareas críticas sin asignar.`
    : `${t.unassignedCriticalTaskCount} critical tasks are unassigned.`);
  if (!r.hasCapacityInputs) warnings.push(isEs
    ? "No hay capacidad definida por recurso; se usan valores por defecto y el estado se marca como “revisar”."
    : "No per-resource capacity is defined; defaults are used and status is marked needs review.");

  // Recommendations (actionable, never auto-applied).
  if (overloaded.length > 0) {
    const top = overloaded[0];
    recommendations.push(isEs
      ? `Reasignar ~${n(top.overallocatedHours)} h de ${top.name} o mover tareas no críticas a la siguiente semana.`
      : `Reassign ~${n(top.overallocatedHours)} h from ${top.name} or move non-critical tasks to next week.`);
  }
  if (t.unassignedCriticalTaskCount > 0) recommendations.push(isEs
    ? "Asignar responsable a las tareas críticas sin dueño."
    : "Assign an owner to the unassigned critical tasks.");
  if (t.missingEstimateCount > 0) recommendations.push(isEs
    ? "Estimar las tareas sin horas para completar el pronóstico."
    : "Add estimates to unestimated tasks to complete the forecast.");

  const headline = isEs
    ? `Salud de fuerza laboral: ${r.health.score}/100 (${bandEs(r.health.band)}).`
    : `Workforce health: ${r.health.score}/100 (${r.health.band}).`;

  return { headline, bullets, bottlenecks, recommendations, warnings };
}

function bandEs(b: string): string {
  return ({ healthy: "Saludable", watch: "Vigilar", at_risk: "En riesgo", critical: "Crítico" } as Record<string, string>)[b] ?? b;
}
