// ============================================================================
// PMO Process Intelligence — Isabella insight engine (CAP-047 · M7)
// ============================================================================
// Deterministic rules over the module's read models — NO LLM, no invention.
// The evidence contract is enforced BY CONSTRUCTION: an insight cannot be
// built without sources, formulas, timestamps, confidence and limitations
// (guard test asserts 100% completeness). Confidence derives from the data
// quality of the underlying projection — never fabricated.
// ============================================================================

import type { PmoPiEvidencePackage, PmoPiFlowModel } from "./contracts";
import type { PmoPiFinanceOverlayModel } from "./financial-overlay";
import type { PmoPiOverlaysData } from "./overlays-read.server";
import { executiveActivityLabel } from "./executive-projection";

export const PMO_PI_KNOWLEDGE_VERSION = "pmo-pi-knowledge-v1";
export const PMO_PI_RULE_SNAPSHOT_VERSION = "pmo-pi-rules-v1";

export type PmoPiInsightRule =
  | "bottleneck_pressure"
  | "rework_hotspot"
  | "cost_efficiency"
  | "forecast_overrun"
  | "systemic_risk"
  | "capacity_pressure";

export interface PmoPiInsight {
  id: string;
  rule: PmoPiInsightRule;
  severity: "info" | "warning" | "critical";
  /** 0–1, derived from the underlying projection's data quality. */
  confidence: number;
  title: { en: string; es: string };
  summary: { en: string; es: string };
  impact: { kind: "time" | "cost" | "risk" | "capacity"; en: string; es: string };
  horizon: "immediate" | "short_term" | "mid_term";
  affected: { type: string; id: string }[];
  affectedProjectCount: number;
  recommendedAction: { en: string; es: string };
  evidence: PmoPiEvidencePackage;
  knowledgeVersion: string;
  ruleSnapshotVersion: string;
  /** Optional deep actions the UI can wire. */
  openInMapActivities?: string[];
  simulateHint?: "budget" | "risk" | "capacity";
}

const fmtH = (ms: number | null): string => (ms == null ? "?" : `${Math.round(ms / 3_600_000)} h`);

export function buildInsights(input: {
  flow: PmoPiFlowModel | null;
  finance: PmoPiFinanceOverlayModel | null;
  overlays: PmoPiOverlaysData | null;
  projectNames: Record<string, string>;
  generatedAt: string;
}): PmoPiInsight[] {
  const insights: PmoPiInsight[] = [];
  const { flow, finance, overlays, projectNames, generatedAt } = input;
  const name = (id: string) => projectNames[id] ?? id;

  const evidence = (
    partial: Partial<PmoPiEvidencePackage> & { formulas: string[]; projections: string[] },
    quality: number,
  ): PmoPiEvidencePackage => ({
    sourceEventIds: partial.sourceEventIds ?? [],
    technicalEventTypes: partial.technicalEventTypes ?? [],
    affectedCaseCount: partial.affectedCaseCount,
    cutoffDate: partial.cutoffDate ?? generatedAt,
    knowledgeVersion: PMO_PI_KNOWLEDGE_VERSION,
    formulas: partial.formulas,
    projections: partial.projections,
    timestamps: partial.timestamps ?? [{ recordedAt: generatedAt }],
    assumptions: partial.assumptions ?? [],
    limitations: [...(partial.limitations ?? []), "temporal_order_is_not_causality"],
    dataQualityScore: quality,
  });

  // ── Process rules ──────────────────────────────────────────────────────────
  if (flow && flow.nodes.length > 0) {
    const q = flow.quality.dataQualityScore;
    const bottleneck = flow.nodes.find((n) => n.bottleneckScore >= 0.7);
    if (bottleneck) {
      const stage = {
        en: executiveActivityLabel(bottleneck.activity, "en"),
        es: executiveActivityLabel(bottleneck.activity, "es"),
      };
      insights.push({
        id: `bottleneck:${bottleneck.id}`,
        rule: "bottleneck_pressure",
        severity: "warning",
        confidence: q,
        title: {
          en: `${bottleneck.caseCount} projects show delays before ${stage.en.toLowerCase()}`,
          es: `${bottleneck.caseCount} proyectos presentan retrasos antes de ${stage.es.toLowerCase()}`,
        },
        summary: {
          en: `${bottleneck.caseCount} case(s) wait on average ${fmtH(bottleneck.avgIncomingWaitingMs)} before this activity — the highest waiting pressure in scope.`,
          es: `${bottleneck.caseCount} caso(s) esperan en promedio ${fmtH(bottleneck.avgIncomingWaitingMs)} antes de esta actividad — la mayor presión de espera en alcance.`,
        },
        impact: {
          kind: "time",
          en: `Average incoming wait ${fmtH(bottleneck.avgIncomingWaitingMs)} × frequency ${bottleneck.frequency}.`,
          es: `Espera media de entrada ${fmtH(bottleneck.avgIncomingWaitingMs)} × frecuencia ${bottleneck.frequency}.`,
        },
        horizon: "short_term",
        affected: [{ type: "activity", id: bottleneck.id }],
        affectedProjectCount: bottleneck.caseCount,
        recommendedAction: {
          en: "Inspect the handoff feeding this activity and rebalance ownership or batch size.",
          es: "Inspecciona el traspaso que alimenta esta actividad y rebalancea responsables o tamaño de lote.",
        },
        evidence: evidence(
          {
            formulas: ["bottleneckScore = normalized(avg incoming wait × frequency)"],
            projections: ["project_event_log → buildFlowModel"],
            timestamps: [{ recordedAt: generatedAt }],
            technicalEventTypes: [bottleneck.activity],
            affectedCaseCount: bottleneck.caseCount,
          },
          q,
        ),
        openInMapActivities: [bottleneck.id],
        knowledgeVersion: PMO_PI_KNOWLEDGE_VERSION,
        ruleSnapshotVersion: PMO_PI_RULE_SNAPSHOT_VERSION,
      });
    }

    const rework = [...flow.nodes].sort((a, b) => b.reworkOccurrences - a.reworkOccurrences)[0];
    if (rework && rework.reworkOccurrences > 0) {
      const stage = {
        en: executiveActivityLabel(rework.activity, "en"),
        es: executiveActivityLabel(rework.activity, "es"),
      };
      insights.push({
        id: `rework:${rework.id}`,
        rule: "rework_hotspot",
        severity: "warning",
        confidence: q,
        title: {
          en: `Repeated work is concentrated in ${stage.en.toLowerCase()}`,
          es: `El retrabajo se concentra en ${stage.es.toLowerCase()}`,
        },
        summary: {
          en: `${rework.reworkOccurrences} repetition(s) of this activity were recorded inside single cases — a rework loop, not new work.`,
          es: `Se registraron ${rework.reworkOccurrences} repetición(es) de esta actividad dentro de casos individuales — un loop de retrabajo, no trabajo nuevo.`,
        },
        impact: {
          kind: "time",
          en: "Each repetition consumes capacity without advancing the case.",
          es: "Cada repetición consume capacidad sin avanzar el caso.",
        },
        horizon: "short_term",
        affected: [{ type: "activity", id: rework.id }],
        affectedProjectCount: rework.caseCount,
        recommendedAction: {
          en: "Trace the return path in the map and address its trigger (quality gate, unclear acceptance).",
          es: "Rastrea el camino de retorno en el mapa y ataca su disparador (gate de calidad, aceptación poco clara).",
        },
        evidence: evidence(
          {
            formulas: ["rework = activity re-occurrence within one case"],
            projections: ["project_event_log → buildFlowModel"],
            technicalEventTypes: [rework.activity],
            affectedCaseCount: rework.caseCount,
          },
          q,
        ),
        openInMapActivities: [rework.id],
        knowledgeVersion: PMO_PI_KNOWLEDGE_VERSION,
        ruleSnapshotVersion: PMO_PI_RULE_SNAPSHOT_VERSION,
      });
    }
  }

  // ── Financial rules ────────────────────────────────────────────────────────
  if (finance) {
    for (const a of finance.alerts) {
      if (a.rule === "cpi_below_threshold" || a.rule === "eac_exceeds_baseline") {
        const isOverrun = a.rule === "eac_exceeds_baseline";
        insights.push({
          id: `finance:${a.id}`,
          rule: isOverrun ? "forecast_overrun" : "cost_efficiency",
          severity: a.severity,
          confidence: 0.9, // reconciled cockpit projection
          title: {
            en: isOverrun ? `${name(a.projectId)} forecasts above its baseline` : `${name(a.projectId)} is spending inefficiently`,
            es: isOverrun ? `${name(a.projectId)} pronostica por encima de su baseline` : `${name(a.projectId)} está gastando con ineficiencia`,
          },
          summary: {
            en: `${a.formula} → ${Object.entries(a.observed).map(([k, v]) => `${k}=${v}`).join(", ")} (status date ${a.statusDate ?? "unknown"}).`,
            es: `${a.formula} → ${Object.entries(a.observed).map(([k, v]) => `${k}=${v}`).join(", ")} (fecha de corte ${a.statusDate ?? "desconocida"}).`,
          },
          impact: {
            kind: "cost",
            en: isOverrun ? "Projected completion cost exceeds the approved baseline." : "Every unit of work costs more than planned.",
            es: isOverrun ? "El costo proyectado al cierre excede la baseline aprobada." : "Cada unidad de trabajo cuesta más de lo planificado.",
          },
          horizon: isOverrun ? "mid_term" : "immediate",
          affected: [{ type: "project", id: a.projectId }],
          affectedProjectCount: 1,
          recommendedAction: {
            en: "Review the cost drivers in the Budget Command Center and simulate a corrective scenario.",
            es: "Revisa los generadores de costo en el Budget Command Center y simula un escenario correctivo.",
          },
          evidence: evidence(
            {
              formulas: [a.formula],
              projections: [a.source],
              timestamps: [{ statusDate: a.statusDate ?? undefined }],
              assumptions: finance.assumptions,
            },
            0.9,
          ),
          simulateHint: "budget",
          knowledgeVersion: PMO_PI_KNOWLEDGE_VERSION,
          ruleSnapshotVersion: PMO_PI_RULE_SNAPSHOT_VERSION,
        });
      }
    }
  }

  // ── Risk & capacity rules ──────────────────────────────────────────────────
  if (overlays) {
    for (const s of overlays.risk.systemic.slice(0, 2)) {
      insights.push({
        id: `systemic:${s.riskId}`,
        rule: "systemic_risk",
        severity: s.severity === "critical" ? "critical" : "warning",
        confidence: 0.85,
        title: {
          en: `Risk "${s.title}" propagates through the plan`,
          es: `El riesgo "${s.title}" se propaga por el plan`,
        },
        summary: {
          en: `Its linked task blocks ${s.downstreamTaskCount} downstream task(s) via recorded dependencies.`,
          es: `Su tarea vinculada bloquea ${s.downstreamTaskCount} tarea(s) aguas abajo vía dependencias registradas.`,
        },
        impact: {
          kind: "risk",
          en: `${s.downstreamTaskCount} task(s) inherit this exposure if it materializes.`,
          es: `${s.downstreamTaskCount} tarea(s) heredan esta exposición si se materializa.`,
        },
        horizon: "immediate",
        affected: [
          { type: "risk", id: s.riskId },
          { type: "task", id: s.linkedTaskId },
        ],
        affectedProjectCount: 1,
        recommendedAction: {
          en: "Prioritize its mitigation plan; simulate closing it to see the exposure change.",
          es: "Prioriza su plan de mitigación; simula cerrarlo para ver el cambio de exposición.",
        },
        evidence: evidence(
          {
            formulas: ["downstream reach = BFS over recorded task_dependencies"],
            projections: ["risks", "task_dependencies"],
            limitations: ["propagation_follows_explicit_dependencies_only"],
          },
          0.85,
        ),
        simulateHint: "risk",
        knowledgeVersion: PMO_PI_KNOWLEDGE_VERSION,
        ruleSnapshotVersion: PMO_PI_RULE_SNAPSHOT_VERSION,
      });
    }

    const pressured = overlays.capacity.filter((c) => c.hasCapacityInputs && c.overallocatedResourceCount > 0);
    if (pressured.length > 0) {
      const worst = [...pressured].sort((a, b) => b.overallocatedResourceCount - a.overallocatedResourceCount)[0];
      insights.push({
        id: `capacity:${worst.projectId}`,
        rule: "capacity_pressure",
        severity: "warning",
        confidence: 0.8,
        title: {
          en: `${name(worst.projectId)} has overallocated people`,
          es: `${name(worst.projectId)} tiene personas sobreasignadas`,
        },
        summary: {
          en: `${worst.overallocatedResourceCount} resource(s) exceed their effective capacity; ${worst.atRiskMilestoneCount} milestone(s) at capacity risk.`,
          es: `${worst.overallocatedResourceCount} recurso(s) exceden su capacidad efectiva; ${worst.atRiskMilestoneCount} hito(s) con riesgo de capacidad.`,
        },
        impact: {
          kind: "capacity",
          en: "Overallocation converts schedule buffer into hidden delay.",
          es: "La sobreasignación convierte el colchón de cronograma en atraso oculto.",
        },
        horizon: "short_term",
        affected: [{ type: "project", id: worst.projectId }],
        affectedProjectCount: 1,
        recommendedAction: {
          en: "Rebalance assignments in Resource Capacity; simulate a capacity increase to compare.",
          es: "Rebalancea asignaciones en Resource Capacity; simula un aumento de capacidad para comparar.",
        },
        evidence: evidence(
          {
            formulas: ["overallocated = assigned hours > effective hours (lib/capacity)"],
            projections: ["project_resource_allocations", "roadmap_tasks"],
          },
          0.8,
        ),
        simulateHint: "capacity",
        knowledgeVersion: PMO_PI_KNOWLEDGE_VERSION,
        ruleSnapshotVersion: PMO_PI_RULE_SNAPSHOT_VERSION,
      });
    }
  }

  const rank = { critical: 0, warning: 1, info: 2 } as const;
  insights.sort((a, b) => rank[a.severity] - rank[b.severity] || b.confidence - a.confidence || a.id.localeCompare(b.id));
  return insights;
}
