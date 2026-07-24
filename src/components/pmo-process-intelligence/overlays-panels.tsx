"use client";

// ============================================================================
// PMO Process Intelligence — Risk / Resources / Dependencies / Benefits
// overlay panels (CAP-047 · M6)
// ============================================================================
// Evidence-linked panels over the pure overlay engines. Severity and status
// are always expressed in text (never color alone). Benefits/strategy have
// no data model yet — that absence is DECLARED, never faked.
// ============================================================================

import { AlertTriangle, GitBranch, ShieldAlert, Target, Users } from "lucide-react";
import type {
  PmoPiCapacityProjectSummary,
  PmoPiDependencyOverlay,
  PmoPiRiskOverlay,
} from "@/lib/pmo-process-intelligence/overlays";

const SEV_ES: Record<string, string> = { critical: "crítico", high: "alto", medium: "medio", low: "bajo" };

export function RiskPanel({
  overlay,
  projectNames,
  locale,
}: {
  overlay: PmoPiRiskOverlay;
  projectNames: Record<string, string>;
  locale: "en" | "es";
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  if (overlay.totalOpenCount === 0) {
    return (
      <p className="px-2 py-16 text-center text-sm text-muted-foreground">
        {tt("No open risks in scope.", "No hay riesgos abiertos en alcance.")}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <ShieldAlert className="h-4 w-4" />
        {tt("Risk exposure by project", "Exposición a riesgo por proyecto")}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2">{tt("Project", "Proyecto")}</th>
            <th className="px-3 py-2">{tt("Open", "Abiertos")}</th>
            <th className="px-3 py-2">{tt("Critical", "Críticos")}</th>
            <th className="px-3 py-2">{tt("High", "Altos")}</th>
            <th className="px-3 py-2">{tt("Medium", "Medios")}</th>
            <th className="px-3 py-2">{tt("Low", "Bajos")}</th>
          </tr>
        </thead>
        <tbody>
          {overlay.rows.map((r) => (
            <tr key={r.projectId} className="border-b border-border last:border-0">
              <td className="max-w-[220px] truncate px-3 py-2 font-medium text-foreground">
                {projectNames[r.projectId] ?? r.projectId}
              </td>
              <td className="px-3 py-2">{r.openCount}</td>
              <td className="px-3 py-2">{r.criticalCount > 0 ? `⛔ ${r.criticalCount}` : "0"}</td>
              <td className="px-3 py-2">{r.highCount > 0 ? `⚠ ${r.highCount}` : "0"}</td>
              <td className="px-3 py-2">{r.mediumCount}</td>
              <td className="px-3 py-2">{r.lowCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <AlertTriangle className="h-4 w-4" />
        {tt("Systemic risks (propagate through recorded dependencies)", "Riesgos sistémicos (se propagan por dependencias registradas)")}
      </h3>
      {overlay.systemic.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tt(
            "No linked risk reaches downstream tasks through recorded dependencies.",
            "Ningún riesgo vinculado alcanza tareas aguas abajo por dependencias registradas.",
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {overlay.systemic.map((s) => (
            <li key={s.riskId} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <p className="font-medium text-foreground">
                [{locale === "es" ? SEV_ES[s.severity] ?? s.severity : s.severity}] {s.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {projectNames[s.projectId] ?? s.projectId} ·{" "}
                {tt(
                  `blocks ${s.downstreamTaskCount} downstream task(s) via its linked task`,
                  `bloquea ${s.downstreamTaskCount} tarea(s) aguas abajo vía su tarea vinculada`,
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground">
        {tt("Source", "Fuente")}: {overlay.source} ·{" "}
        {tt("propagation follows explicit dependencies only — never inferred", "la propagación sigue solo dependencias explícitas — nunca se infiere")}
      </p>
    </div>
  );
}

export function ResourcesPanel({
  capacity,
  projectNames,
  locale,
}: {
  capacity: PmoPiCapacityProjectSummary[];
  projectNames: Record<string, string>;
  locale: "en" | "es";
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  const withInputs = capacity.filter((c) => c.hasCapacityInputs);
  if (withInputs.length === 0) {
    return (
      <p className="px-2 py-16 text-center text-sm text-muted-foreground">
        {tt(
          "No project in scope has capacity inputs (allocations + estimates) yet.",
          "Ningún proyecto en alcance tiene insumos de capacidad (asignaciones + estimados) todavía.",
        )}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Users className="h-4 w-4" />
        {tt("Capacity pressure by project", "Presión de capacidad por proyecto")}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2">{tt("Project", "Proyecto")}</th>
            <th className="px-3 py-2">{tt("Availability", "Disponibilidad")}</th>
            <th className="px-3 py-2">{tt("Overallocated people", "Personas sobreasignadas")}</th>
            <th className="px-3 py-2">{tt("At-risk milestones", "Hitos en riesgo")}</th>
            <th className="px-3 py-2">{tt("Unassigned critical tasks", "Tareas críticas sin dueño")}</th>
          </tr>
        </thead>
        <tbody>
          {withInputs.map((c) => (
            <tr key={c.projectId} className="border-b border-border last:border-0">
              <td className="max-w-[220px] truncate px-3 py-2 font-medium text-foreground">
                {projectNames[c.projectId] ?? c.projectId}
              </td>
              <td className="px-3 py-2">
                {c.workforceAvailabilityPercent != null ? `${Math.round(c.workforceAvailabilityPercent)}%` : "—"}
              </td>
              <td className="px-3 py-2">{c.overallocatedResourceCount > 0 ? `⚠ ${c.overallocatedResourceCount}` : "0"}</td>
              <td className="px-3 py-2">{c.atRiskMilestoneCount}</td>
              <td className="px-3 py-2">{c.unassignedCriticalTaskCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted-foreground">
        {tt("Source", "Fuente")}: lib/capacity ({tt("canonical capacity engine — no duplicate math", "motor canónico de capacidad — sin matemática duplicada")})
      </p>
    </div>
  );
}

export function DependenciesPanel({
  overlay,
  projectNames,
  locale,
}: {
  overlay: PmoPiDependencyOverlay;
  projectNames: Record<string, string>;
  locale: "en" | "es";
}) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  if (overlay.totalDependencies === 0) {
    return (
      <p className="px-2 py-16 text-center text-sm text-muted-foreground">
        {tt("No recorded task dependencies in scope.", "No hay dependencias de tareas registradas en alcance.")}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <GitBranch className="h-4 w-4" />
        {tt("Dependencies by project", "Dependencias por proyecto")}
      </h3>
      <ul className="space-y-1 text-sm">
        {overlay.perProject.map((p) => (
          <li key={p.projectId} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            <span className="font-medium text-foreground">{projectNames[p.projectId] ?? p.projectId}</span>
            <span className="text-muted-foreground">{p.dependencyCount} {tt("dependencies", "dependencias")}</span>
          </li>
        ))}
      </ul>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {tt("Unblock hubs (highest downstream out-degree)", "Nodos desbloqueadores (mayor salida aguas abajo)")}
      </h3>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {overlay.hubs.map((h) => (
          <li key={h.taskId}>
            {tt("Task", "Tarea")} {h.taskId.slice(0, 8)}… ({projectNames[h.projectId] ?? h.projectId}) → {h.outDegree} {tt("direct successors", "sucesoras directas")}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground">
        {tt("Source", "Fuente")}: {overlay.source} ·{" "}
        {tt(
          "limitation: only intra-project dependencies are recorded in the data model",
          "limitación: el modelo de datos solo registra dependencias dentro del mismo proyecto",
        )}
      </p>
    </div>
  );
}

export function BenefitsPanel({ locale }: { locale: "en" | "es" }) {
  const tt = (en: string, es: string) => (locale === "es" ? es : en);
  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-center">
      <Target className="h-8 w-8 text-muted-foreground/50" />
      <p className="max-w-md text-sm text-muted-foreground">
        {tt(
          "ProjectOps360° has no benefits/strategic-objective data model yet, so this overlay honestly shows nothing instead of invented figures. When benefit records exist, every calculation here will show its source and date.",
          "ProjectOps360° aún no tiene un modelo de datos de beneficios/objetivos estratégicos, así que esta capa honestamente no muestra nada en lugar de cifras inventadas. Cuando existan registros de beneficios, cada cálculo aquí mostrará su fuente y fecha.",
        )}
      </p>
    </div>
  );
}
