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

function signalScore(value: string): number {
  return value === "critical" ? 100 : value === "high" ? 72 : value === "medium" ? 45 : 20;
}

function evidenceStatus(value: FrictionConfidence): "confirmed" | "candidate" | "unknown" {
  return value === "high" ? "confirmed" : value === "unknown" ? "unknown" : "candidate";
}

function evidenceRefs(refs: Array<{ kind: string; eventId?: string | null; metricRef?: string | null }>, fallback: string) {
  return refs.map((e, index) => ({
    kind: e.eventId ? "project_event_log" : e.kind,
    id: e.eventId ?? e.metricRef ?? `${fallback}:${index}`,
    ...(e.eventId ? { label: e.kind } : {}),
  }));
}

export function frictionSignalFromMpfFinding(finding: MilestoneFlowDetectionFinding): FrictionSignal {
  const resolvedConfidence = confidence(finding.confidence);
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
    confidence: resolvedConfidence,
    score: signalScore(finding.severity),
    observedValue: finding.durationMs,
    expectedOrBaseline: null,
    evidenceStatus: evidenceStatus(resolvedConfidence),
    occurredAt: finding.startedAt,
    evidenceTimestampStart: finding.startedAt,
    evidenceTimestampEnd: finding.endedAt,
    evidenceDescription: `MPF detected ${finding.findingType} from the recorded milestone-transition sequence.`,
    evidenceRefs: evidenceRefs(finding.evidenceRefs, finding.findingId),
    relatedEntityIds: finding.sourceSegmentIds,
    metadata: { status: finding.status, durationMs: finding.durationMs, isOpen: finding.isOpen },
  };
}

function fromRework(f: MilestoneFlowReworkFinding): FrictionSignal {
  const resolvedConfidence = confidence(f.confidence);
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
    confidence: resolvedConfidence,
    score: signalScore(f.severity),
    observedValue: f.reworkType,
    expectedOrBaseline: "forward_only_transition",
    evidenceStatus: evidenceStatus(resolvedConfidence),
    occurredAt: f.startedAt,
    evidenceTimestampStart: f.startedAt,
    evidenceTimestampEnd: f.endedAt,
    evidenceDescription: `MPF detected explicit ${f.reworkType} sequence evidence.`,
    evidenceRefs: evidenceRefs(f.evidenceRefs, f.findingId),
    relatedEntityIds: [...f.sourceSegmentIds, ...f.affectedEntityRefs],
    metadata: { status: f.status, durationMs: f.durationMs, isOpen: f.isOpen, triggerType: f.triggerType },
  };
}

function fromBottleneck(f: MilestoneFlowBottleneckFinding): FrictionSignal {
  const resolvedConfidence = confidence(f.confidence);
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
    confidence: resolvedConfidence,
    score: signalScore(f.severity),
    observedValue: f.durationMs ?? f.occurrenceCount,
    expectedOrBaseline: null,
    evidenceStatus: evidenceStatus(resolvedConfidence),
    evidenceTimestampStart: null,
    evidenceTimestampEnd: null,
    evidenceDescription: f.candidateReason,
    evidenceRefs: evidenceRefs(f.evidenceRefs, f.findingId),
    relatedEntityIds: f.affectedSegmentIds,
    metadata: { status: f.status, durationMs: f.durationMs, occurrenceCount: f.occurrenceCount, structural: f.isStructuralCandidate },
  };
}

function fromPropagation(f: MilestoneConstraintPropagationFinding): FrictionSignal {
  const resolvedConfidence = confidence(f.confidence);
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
    confidence: resolvedConfidence,
    score: signalScore(f.severity),
    observedValue: f.delayImpactMs ?? f.riskImpact,
    expectedOrBaseline: 0,
    evidenceStatus: evidenceStatus(resolvedConfidence),
    evidenceTimestampStart: null,
    evidenceTimestampEnd: null,
    evidenceDescription: f.propagationReason,
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
  const refs = h.reasons.flatMap((r, i) => evidenceRefs(r.evidence, `health:${transitionId}:${i}`));
  if (refs.length === 0) return null;
  const resolvedConfidence = confidence(h.confidence);
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
    confidence: resolvedConfidence,
    score: signalScore(s),
    observedValue: h.score,
    expectedOrBaseline: 100,
    evidenceStatus: evidenceStatus(resolvedConfidence),
    evidenceTimestampStart: null,
    evidenceTimestampEnd: null,
    evidenceDescription: `MPF transition health is ${h.status} from evidence-backed reasons.`,
    evidenceRefs: refs,
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
