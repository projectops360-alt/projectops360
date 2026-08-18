import type { FrictionSignal } from "./types";

export interface FrictionSignalEvidenceAssessment {
  signalId: string;
  status: "complete" | "incomplete";
  missingFields: string[];
}

/**
 * Blocking FR-15 evidence contract. Null timestamps/baselines are valid values
 * when the source has no qualified temporal/baseline fact; omitted fields are
 * not. A promoted signal must always name at least one source row/event.
 */
export function assessFrictionSignalEvidence(
  signal: FrictionSignal,
): FrictionSignalEvidenceAssessment {
  const missingFields: string[] = [];
  if (!signal.signalId) missingFields.push("signalId");
  if (!signal.organizationId) missingFields.push("organizationId");
  if (!signal.projectId) missingFields.push("projectId");
  if (!signal.signalType) missingFields.push("signalType");
  if (!signal.category) missingFields.push("category");
  if (!signal.source) missingFields.push("source");
  if (!Number.isFinite(signal.score) || signal.score < 0 || signal.score > 100) {
    missingFields.push("score");
  }
  if (signal.observedValue === undefined) missingFields.push("observedValue");
  if (signal.expectedOrBaseline === undefined) missingFields.push("expectedOrBaseline");
  if (!signal.evidenceStatus) missingFields.push("evidenceStatus");
  if (signal.evidenceTimestampStart === undefined) missingFields.push("evidenceTimestampStart");
  if (signal.evidenceTimestampEnd === undefined) missingFields.push("evidenceTimestampEnd");
  if (!signal.evidenceDescription?.trim()) missingFields.push("evidenceDescription");
  if (!signal.evidenceRefs?.length) missingFields.push("evidenceRefs");
  if (signal.evidenceRefs?.some((ref) => !ref.kind || !ref.id)) {
    missingFields.push("evidenceRefs.kind_or_id");
  }
  return {
    signalId: signal.signalId,
    status: missingFields.length === 0 ? "complete" : "incomplete",
    missingFields,
  };
}

export function partitionEvidenceCompleteSignals(
  signals: readonly FrictionSignal[],
): {
  complete: FrictionSignal[];
  rejected: FrictionSignalEvidenceAssessment[];
} {
  const complete: FrictionSignal[] = [];
  const rejected: FrictionSignalEvidenceAssessment[] = [];
  for (const signal of signals) {
    const assessment = assessFrictionSignalEvidence(signal);
    if (assessment.status === "complete") complete.push(signal);
    else rejected.push(assessment);
  }
  return { complete, rejected };
}
