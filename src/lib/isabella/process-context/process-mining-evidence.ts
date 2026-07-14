import { createClient } from "@/lib/supabase/server";
import { validateEventIntegrity } from "@/lib/events/event-integrity";
import {
  loadCanonicalEventProjection,
  type CanonicalEventLoadResult,
} from "@/lib/graph/event-relationship-loader";
import {
  loadMilestoneFlowProjection,
  type MilestoneFlowLoadResult,
} from "@/lib/milestone-flow-ui/load-projection";
import type {
  IsabellaCitation,
  IsabellaConfidence,
  IsabellaEvidencePacket,
  IsabellaEvidenceType,
} from "@/lib/isabella/process-intelligence/types";
import type { MilestoneFlowProjection } from "@/lib/milestone-flow";
import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import {
  buildIsabellaCitation,
  buildIsabellaEvidencePacket,
  safeRef,
} from "./evidence-builder";
import type {
  IsabellaProcessMiningContext,
  IsabellaProcessSignals,
  IsabellaProjectScope,
} from "./types";

const RECENT_EVENT_LIMIT = 16;
const TRANSITION_PACKET_LIMIT = 20;
const FINDING_PACKET_LIMIT = 30;
const MINING_CATEGORIES = new Set(["task", "milestone", "dependency"]);

export interface ProcessMiningEvidenceOutcome {
  context: IsabellaProcessMiningContext;
  signals: IsabellaProcessSignals;
  packets: IsabellaEvidencePacket[];
  citations: IsabellaCitation[];
  limitations: string[];
}

function mapConfidence(value: string | null | undefined): IsabellaConfidence {
  if (value === "high" || value === "medium" || value === "low" || value === "unknown") return value;
  return "unknown";
}

function eventConfidence(event: LivingGraphCanonicalEvent): IsabellaConfidence {
  if (event.lifecycleClass === "SYNTHETIC_BACKFILL_EVENT") return "medium";
  if (event.confidence != null && event.confidence < 0.6) return "low";
  return "verified";
}

function eventSummary(event: LivingGraphCanonicalEvent, es: boolean): string {
  const transition = event.fromState || event.toState
    ? es
      ? `Transicion ${event.fromState ?? "-"} -> ${event.toState ?? "-"}.`
      : `Transition ${event.fromState ?? "-"} -> ${event.toState ?? "-"}.`
    : "";
  const source = event.sourceModule
    ? es ? `Fuente ${event.sourceModule}.` : `Source ${event.sourceModule}.`
    : "";
  return `${event.eventType}. ${transition} ${source}`.trim();
}

function makeEventPackets(
  events: LivingGraphCanonicalEvent[],
  scope: IsabellaProjectScope,
): IsabellaEvidencePacket[] {
  const es = scope.locale === "es";
  return [...events]
    .sort((left, right) => right.sequenceNumber - left.sequenceNumber)
    .slice(0, RECENT_EVENT_LIMIT)
    .map((event) => buildIsabellaEvidencePacket({
      evidenceId: safeRef("event", event.eventId),
      evidenceType: "event_summary",
      sourceKind: "project_event_graph",
      sourceId: safeRef("event", event.eventId),
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      title: event.eventType,
      summary: eventSummary(event, es),
      citationLabel: es ? "Resumen de evento canonico" : "Canonical event summary",
      citationRef: safeRef("event", event.eventId),
      occurredAt: event.occurredAt,
      confidence: eventConfidence(event),
      allowedClaims: ["status_summary", "assumption_or_inference"],
      disallowedClaims: event.causedBy.length > 0 ? undefined : ["root_cause_claim"],
      limitations: event.lifecycleClass === "SYNTHETIC_BACKFILL_EVENT"
        ? [es ? "Evento reconstruido; no es observacion en tiempo real." : "Backfilled event; not a real-time observation."]
        : undefined,
    }));
}

function transitionTitle(
  sourceId: string | null,
  targetId: string,
  names: Record<string, string>,
  es: boolean,
): string {
  const source = sourceId ? (names[sourceId] ?? sourceId) : (es ? "Inicio del proyecto" : "Project start");
  return `${source} -> ${names[targetId] ?? targetId}`;
}

function makeFlowPackets(
  projection: MilestoneFlowProjection,
  names: Record<string, string>,
  scope: IsabellaProjectScope,
): IsabellaEvidencePacket[] {
  const es = scope.locale === "es";
  const packets: IsabellaEvidencePacket[] = [];
  const transitionById = new Map(
    projection.transitions.map((transition) => [transition.transitionId, transition]),
  );

  for (const transition of projection.transitions.slice(0, TRANSITION_PACKET_LIMIT)) {
    const health = projection.healthSummariesByTransition?.[transition.transitionId];
    const title = transitionTitle(
      transition.sourceMilestoneId,
      transition.targetMilestoneId,
      names,
      es,
    );
    packets.push(buildIsabellaEvidencePacket({
      evidenceId: safeRef("milestone-flow", transition.transitionId),
      evidenceType: "milestone_flow_segment",
      sourceKind: "milestone_process_flow",
      sourceId: safeRef("milestone-flow", transition.transitionId),
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      title,
      summary: es
        ? `Salud ${health?.healthStatus ?? "unknown"}; estado ${transition.state.status}; ${transition.evidenceEventIds.length} evento(s) de evidencia.`
        : `Health ${health?.healthStatus ?? "unknown"}; state ${transition.state.status}; ${transition.evidenceEventIds.length} evidence event(s).`,
      citationLabel: es ? "Transicion de Milestone Process Flow" : "Milestone Process Flow transition",
      citationRef: safeRef("milestone-flow", transition.transitionId),
      occurredAt: transition.state.lastEventAt,
      confidence: mapConfidence(health?.confidence),
      allowedClaims: ["status_summary", "recommendation_claim", "assumption_or_inference"],
      disallowedClaims: ["root_cause_claim"],
      limitations: health?.uncertaintyNotes,
    }));
  }

  const delayFindings = Object.values(projection.findingsByTransition ?? {})
    .flat()
    .slice(0, FINDING_PACKET_LIMIT);
  for (const finding of delayFindings) {
    const transition = transitionById.get(finding.transitionId);
    const title = transition
      ? transitionTitle(transition.sourceMilestoneId, transition.targetMilestoneId, names, es)
      : finding.transitionId;
    const evidenceType: IsabellaEvidenceType = finding.findingType === "blocker"
      ? "blocker"
      : "delay_finding";
    packets.push(buildIsabellaEvidencePacket({
      evidenceId: safeRef("mpf-finding", finding.findingId),
      evidenceType,
      sourceKind: "milestone_process_flow",
      sourceId: safeRef("milestone-flow", finding.transitionId),
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      title: `${finding.findingType}: ${title}`,
      summary: es
        ? `Hallazgo derivado ${finding.status}; severidad ${finding.severity}; duracion ${finding.durationMs ?? "desconocida"} ms.`
        : `Derived finding ${finding.status}; severity ${finding.severity}; duration ${finding.durationMs ?? "unknown"} ms.`,
      citationLabel: es ? "Hallazgo derivado de flujo" : "Derived flow finding",
      citationRef: safeRef("mpf-finding", finding.findingId),
      occurredAt: finding.endedAt ?? finding.startedAt,
      confidence: mapConfidence(finding.confidence),
      allowedClaims: evidenceType === "blocker"
        ? ["blocker_claim", "status_summary", "recommendation_claim"]
        : ["risk_claim", "root_cause_claim", "recommendation_claim", "assumption_or_inference"],
      limitations: [
        es
          ? "Hallazgo derivado; no es un evento canonico ni prueba causal por si solo."
          : "Derived finding; not a canonical event or causal proof on its own.",
      ],
    }));
  }

  const reworkFindings = Object.values(projection.reworkFindingsByTransition ?? {})
    .flat()
    .slice(0, FINDING_PACKET_LIMIT);
  for (const finding of reworkFindings) {
    packets.push(buildIsabellaEvidencePacket({
      evidenceId: safeRef("mpf-rework", finding.findingId),
      evidenceType: "rework_finding",
      sourceKind: "milestone_process_flow",
      sourceId: safeRef("milestone-flow", finding.transitionId),
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      title: `${finding.reworkType}: ${finding.transitionId}`,
      summary: es
        ? `Rework ${finding.status}; severidad ${finding.severity}; trigger ${finding.triggerType}.`
        : `Rework ${finding.status}; severity ${finding.severity}; trigger ${finding.triggerType}.`,
      citationLabel: es ? "Hallazgo de rework" : "Rework finding",
      citationRef: safeRef("mpf-rework", finding.findingId),
      occurredAt: finding.endedAt ?? finding.startedAt,
      confidence: mapConfidence(finding.confidence),
      allowedClaims: ["root_cause_claim", "recommendation_claim", "assumption_or_inference"],
      limitations: [
        es
          ? "Patron derivado; requiere evidencia adicional para afirmar una causa."
          : "Derived pattern; additional evidence is required before asserting a cause.",
      ],
    }));
  }

  const bottleneckFindings = Object.values(projection.bottleneckFindingsByTransition ?? {})
    .flat()
    .slice(0, FINDING_PACKET_LIMIT);
  for (const finding of bottleneckFindings) {
    packets.push(buildIsabellaEvidencePacket({
      evidenceId: safeRef("mpf-bottleneck", finding.findingId),
      evidenceType: "bottleneck_finding",
      sourceKind: "milestone_process_flow",
      sourceId: safeRef("milestone-flow", finding.transitionId),
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      title: `${finding.bottleneckType}: ${finding.transitionId}`,
      summary: es
        ? `Candidato ${finding.status}; severidad ${finding.severity}; ${finding.occurrenceCount} ocurrencia(s).`
        : `Candidate ${finding.status}; severity ${finding.severity}; ${finding.occurrenceCount} occurrence(s).`,
      citationLabel: es ? "Candidato a bottleneck" : "Bottleneck candidate",
      citationRef: safeRef("mpf-bottleneck", finding.findingId),
      confidence: mapConfidence(finding.confidence),
      allowedClaims: ["risk_claim", "root_cause_claim", "recommendation_claim", "assumption_or_inference"],
      limitations: [es ? "Candidato analitico, no causa confirmada." : "Analytical candidate, not a confirmed cause."],
    }));
  }

  return packets;
}

function packetCitations(packets: IsabellaEvidencePacket[]): IsabellaCitation[] {
  return packets.slice(0, 40).map((packet) => buildIsabellaCitation({
    sourceLabel: packet.citationLabel,
    entityType: packet.evidenceType,
    entityTitle: packet.title,
    safeRef: packet.citationRef,
    occurredAt: packet.occurredAt,
    confidence: packet.confidence,
  }));
}

export function buildProcessMiningEvidence(
  eventLoad: CanonicalEventLoadResult,
  flowLoad: MilestoneFlowLoadResult,
  scope: IsabellaProjectScope,
): ProcessMiningEvidenceOutcome {
  const es = scope.locale === "es";
  const events = eventLoad.status === "ok" ? eventLoad.canonicalEvents : [];
  const miningEvents = events.filter((event) => MINING_CATEGORIES.has(event.eventCategory));
  // Validate the complete canonical window. Filtering to mining categories
  // first would report a false broken chain whenever another event category is
  // legitimately interleaved between two task/milestone events.
  const integrity = eventLoad.status === "ok"
    ? validateEventIntegrity(events.map((event) => ({
        eventId: event.eventId,
        organizationId: event.organizationId,
        projectId: event.projectId,
        caseId: event.caseId,
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        actorType: event.actorType,
        occurredAt: event.occurredAt,
        recordedAt: event.recordedAt,
        sequenceNumber: event.sequenceNumber,
        sourceModule: event.sourceModule,
        provenance: event.provenance,
        eventHash: event.eventHash,
        previousEventHash: event.previousEventHash,
        objectRefs: event.objectRefs.map((ref) => ({
          objectType: ref.object_type,
          objectId: ref.object_id,
          role: ref.role,
        })),
      })))
    : null;
  const flow = flowLoad.status === "ok" ? flowLoad.projection : null;
  const observability = flow?.observability;
  const eventPackets = makeEventPackets(events, scope);
  const flowPackets = flowLoad.status === "ok"
    ? makeFlowPackets(flowLoad.projection, flowLoad.milestoneNamesById, scope)
    : [];
  const packets = [...eventPackets, ...flowPackets];
  const limitations: string[] = [];

  if (eventLoad.status !== "ok") {
    limitations.push(es ? "No se pudo cargar el resumen del Project Event Graph." : "Could not load the Project Event Graph summary.");
  }
  if (flowLoad.status !== "ok") {
    limitations.push(es ? "No se pudo calcular Milestone Process Flow." : "Could not calculate Milestone Process Flow.");
  }
  if (eventLoad.eventsTruncated) {
    limitations.push(es ? "El resumen de eventos alcanzo el limite seguro de lectura." : "The event summary reached the safe read limit.");
  }
  if (integrity && !integrity.valid) {
    const errorCount = integrity.issues.filter((issue) => issue.severity === "error").length;
    limitations.push(es ? `La ventana minable presenta ${errorCount} error(es) de integridad.` : `The mining window has ${errorCount} integrity error(s).`);
  }
  if (events.length === 0 && eventLoad.status === "ok") {
    limitations.push(es ? "Aun no hay eventos canonicos visibles para este proyecto." : "No canonical events are visible for this project yet.");
  }

  const status: IsabellaProcessMiningContext["status"] =
    eventLoad.status !== "ok" && flowLoad.status !== "ok"
      ? "unavailable"
      : events.length === 0 && (!flow || flow.transitions.length === 0)
        ? "empty"
        : eventLoad.status !== "ok"
            || flowLoad.status !== "ok"
            || eventLoad.eventsTruncated
            || (integrity != null && !integrity.valid)
          ? "partial"
          : "ready";
  const occurred = events
    .map((event) => event.occurredAt)
    .filter((value): value is string => !!value)
    .sort();
  const context: IsabellaProcessMiningContext = {
    status,
    eventCount: miningEvents.length,
    caseCount: new Set(miningEvents.map((event) => event.caseId)).size,
    taskEventCount: events.filter((event) => event.eventCategory === "task").length,
    milestoneEventCount: events.filter((event) => event.eventCategory === "milestone").length,
    dependencyEventCount: events.filter((event) => event.eventCategory === "dependency").length,
    transitionCount: observability?.transitionCount ?? 0,
    delayFindingCount: observability?.delayFindingCount ?? 0,
    blockerFindingCount: observability?.blockerFindingCount ?? 0,
    reworkFindingCount: observability?.reworkFindingCount ?? 0,
    bottleneckFindingCount: observability?.bottleneckFindingCount ?? 0,
    dataQualityFlagCount: integrity?.dataQualityFlagCount
      ?? events.reduce((count, event) => count + event.dataQualityFlags.length, 0),
    firstOccurredAt: occurred[0] ?? null,
    lastOccurredAt: occurred.at(-1) ?? null,
    eventsTruncated: eventLoad.eventsTruncated,
    integrityValid: integrity?.valid ?? null,
    integrityIssueCount: integrity?.issues.length ?? 0,
    engineVersion: observability?.engineVersion ?? null,
  };
  const signals: IsabellaProcessSignals = {
    blockedCount: 0,
    packets: [],
    advancedFindingsAvailable: flowLoad.status === "ok"
      && (flowLoad.eventCount > 0 || flowLoad.milestoneCount > 0),
    eventHistoryAvailable: eventLoad.status === "ok" && events.length > 0,
    delayFindingCount: context.delayFindingCount,
    reworkFindingCount: context.reworkFindingCount,
    bottleneckFindingCount: context.bottleneckFindingCount,
    transitionCount: context.transitionCount,
    advancedPackets: flowPackets,
  };

  return {
    context,
    signals,
    packets,
    citations: packetCitations(packets),
    limitations,
  };
}

/** Authenticated, RLS-scoped direct source for Isabella Process Mining. */
export async function getIsabellaProcessMiningEvidence(
  scope: IsabellaProjectScope,
): Promise<ProcessMiningEvidenceOutcome> {
  const client = await createClient();
  const [eventLoad, flowLoad] = await Promise.all([
    loadCanonicalEventProjection(client, scope.organizationId, scope.projectId),
    loadMilestoneFlowProjection(scope.projectId, scope.locale === "es" ? "es" : "en"),
  ]);
  return buildProcessMiningEvidence(eventLoad, flowLoad, scope);
}
