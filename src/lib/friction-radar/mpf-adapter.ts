import type { MilestoneFlowDetectionFinding } from "@/lib/milestone-flow/delay-detector-types";
import type {
  MilestoneFlowBottleneckFinding,
  MilestoneConstraintPropagationFinding,
  MilestoneFlowReworkFinding,
} from "@/lib/milestone-flow/advanced-detection-types";
import type { MilestoneFlowProjection, MilestoneTransitionHealth } from "@/lib/milestone-flow";
import type { FrictionCategory, FrictionConfidence, FrictionSeverity, FrictionSignal } from "./types";

const CATEGORY_BY_FINDING: Record<string, FrictionCategory> = {
  blocker: "process",
  waiting_time: "process",
  decision_delay: "decision",
  approval_delay: "decision",
  rework: "quality",
};

function severity(value: string): FrictionSeverity {
  return value === "critical" || value === "high" || value === "medium" || value === "low" ? value : "low";
}

function confidence(value: string): FrictionConfidence {
  return value === "high" || value === "medium" || value === "low" || value === "unknown" ? value : "unknown";
}

function evidenceRefs(refs: Array<{ kind: string; eventId?: string | null; metricRef?: string | null }>, fallback: string) {
  return refs.map((e, index) => ({
    kind: e.eventId ? "project_event_log" : e.kind,
    id: e.eventId ?? e.metricRef ?? `${fallback}:${index}`,
    ...(e.eventId ? { label: e.kind } : {}),
  }));
}

export function frictionSignalFromMpfFinding(finding: MilestoneFlowDetectionFinding): FrictionSignal {
  return {
    signalId: `mpf:${finding.findingId}`,
    organizationId: finding.organizationId,
    projectId: finding.projectId,
    source: "mpf",
    signalType: finding.findingType,
    category: CATEGORY_BY_FINDING[finding.findingType] ?? "process",
    entityType: "milestone_transition",
    entityId: finding.transitionId,
    severity: severity(finding.severity),
    confidence: confidence(finding.confidence),
    occurredAt: finding.startedAt,
    evidenceRefs: evidenceRefs(finding.evidenceRefs, finding.findingId),
    relatedEntityIds: finding.sourceSegmentIds,
    metadata: { status: finding.status, durationMs: finding.durationMs, isOpen: finding.isOpen },
  };
}

function fromRework(f: MilestoneFlowReworkFinding): FrictionSignal {
  return {
    signalId: `mpf:${f.findingId}`,
    organizationId: f.organizationId,
    projectId: f.projectId,
    source: "mpf",
    signalType: `rework:${f.reworkType}`,
    category: "quality",
    entityType: "milestone_transition",
    entityId: f.transitionId,
    severity: severity(f.severity),
    confidence: confidence(f.confidence),
    occurredAt: f.startedAt,
    evidenceRefs: evidenceRefs(f.evidenceRefs, f.findingId),
    relatedEntityIds: [...f.sourceSegmentIds, ...f.affectedEntityRefs],
    metadata: { status: f.status, durationMs: f.durationMs, isOpen: f.isOpen, triggerType: f.triggerType },
  };
}

function fromBottleneck(f: MilestoneFlowBottleneckFinding): FrictionSignal {
  return {
    signalId: `mpf:${f.findingId}`,
    organizationId: f.organizationId,
    projectId: f.projectId,
    source: "mpf",
    signalType: `bottleneck:${f.bottleneckType}`,
    category: "process",
    entityType: "milestone_transition",
    entityId: f.transitionId,
    severity: severity(f.severity),
    confidence: confidence(f.confidence),
    evidenceRefs: evidenceRefs(f.evidenceRefs, f.findingId),
    relatedEntityIds: f.affectedSegmentIds,
    metadata: { status: f.status, durationMs: f.durationMs, occurrenceCount: f.occurrenceCount, structural: f.isStructuralCandidate },
  };
}

function fromPropagation(f: MilestoneConstraintPropagationFinding): FrictionSignal {
  return {
    signalId: `mpf:${f.findingId}`,
    organizationId: f.organizationId,
    projectId: f.projectId,
    source: "mpf",
    signalType: `constraint_propagation:${f.propagationType}`,
    category: "dependency",
    entityType: "milestone_transition",
    entityId: f.originTransitionId,
    severity: severity(f.severity),
    confidence: confidence(f.confidence),
    evidenceRefs: evidenceRefs(f.evidenceRefs, f.findingId),
    relatedEntityIds: [f.affectedTransitionId, ...f.propagationPath],
    metadata: { status: f.status, delayImpactMs: f.delayImpactMs, riskImpact: f.riskImpact },
  };
}

function fromHealth(projection: MilestoneFlowProjection, transitionId: string, h: MilestoneTransitionHealth): FrictionSignal | null {
  const severityByHealth: Record<string, FrictionSeverity | null> = {
    blocked: "critical", regressed: "critical", at_risk: "high", degraded: "medium",
    watch: "low", recovering: "low", healthy: null, unknown: null,
  };
  const s = severityByHealth[h.status];
  if (!s) return null;
  return {
    signalId: `mpf:health:${transitionId}`,
    organizationId: projection.scope.organizationId,
    projectId: projection.scope.projectId,
    source: "mpf",
    signalType: `transition_health:${h.status}`,
    category: "process",
    entityType: "milestone_transition",
    entityId: transitionId,
    severity: s,
    confidence: confidence(h.confidence),
    evidenceRefs: h.reasons.flatMap((r, i) => evidenceRefs(r.evidence, `health:${transitionId}:${i}`)),
    metadata: { healthStatus: h.status, healthScore: h.score },
  };
}

/** Convert the complete MPF projection into normalized Friction Radar signals. */
export function frictionSignalsFromMpfProjection(projection: MilestoneFlowProjection): FrictionSignal[] {
  const signals: FrictionSignal[] = [];
  for (const findings of Object.values(projection.findingsByTransition ?? {})) {
    for (const f of findings) signals.push(frictionSignalFromMpfFinding(f));
  }
  for (const findings of Object.values(projection.reworkFindingsByTransition ?? {})) {
    for (const f of findings) signals.push(fromRework(f));
  }
  for (const findings of Object.values(projection.bottleneckFindingsByTransition ?? {})) {
    for (const f of findings) signals.push(fromBottleneck(f));
  }
  for (const f of projection.constraintPropagationFindings ?? []) signals.push(fromPropagation(f));
  for (const [transitionId, health] of Object.entries(projection.healthByTransition ?? {})) {
    const signal = fromHealth(projection, transitionId, health);
    if (signal) signals.push(signal);
  }
  return signals;
}
