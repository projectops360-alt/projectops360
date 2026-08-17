import type { MilestoneFlowDetectionFinding } from "@/lib/milestone-flow/delay-detector-types";
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
    evidenceRefs: finding.evidenceRefs.map((e, index) => ({
      kind: e.kind,
      id: e.eventId ?? e.metricRef ?? `${finding.findingId}:evidence:${index}`,
    })),
    relatedEntityIds: finding.sourceSegmentIds,
    metadata: {
      status: finding.status,
      durationMs: finding.durationMs,
      isOpen: finding.isOpen,
    },
  };
}
