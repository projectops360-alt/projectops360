import type { MilestoneFlowBottleneckFinding, MilestoneFlowReworkFinding } from "@/lib/milestone-flow/advanced-detection-types";
import type { MilestoneFlowDetectionFinding } from "@/lib/milestone-flow/delay-detector-types";
import type { MilestoneFlowEvidenceRef } from "@/lib/milestone-flow/types";
import type { CreateKnowledgeObjectInput, KnowledgeConfidence, KnowledgeEvidenceInput } from "./types";

type MpfFinding = MilestoneFlowDetectionFinding | MilestoneFlowReworkFinding | MilestoneFlowBottleneckFinding;

function findingLabel(finding: MpfFinding): string {
  if ("findingType" in finding) return finding.findingType.replaceAll("_", " ");
  if ("reworkType" in finding) return finding.reworkType.replaceAll("_", " ");
  return `${finding.bottleneckType.replaceAll("_", " ")} bottleneck`;
}

function mapEvidenceRef(ref: MilestoneFlowEvidenceRef): KnowledgeEvidenceInput[] {
  const evidence: KnowledgeEvidenceInput[] = [];
  if (ref.eventId) {
    evidence.push({ type: "project_event", ref: ref.eventId, role: "supports", confidence: ref.confidence, note: ref.note });
  }
  if (ref.metricRef) {
    evidence.push({ type: "metric", ref: ref.metricRef, role: "supports", confidence: ref.confidence, note: ref.note });
  }
  return evidence;
}

function uniqueEvidence(evidence: KnowledgeEvidenceInput[]): KnowledgeEvidenceInput[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.type}:${item.ref}:${item.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mapMpfFindingToKnowledgeProposal(finding: MpfFinding): CreateKnowledgeObjectInput {
  const label = findingLabel(finding);
  const sourceEventIds = "sourceEventIds" in finding ? finding.sourceEventIds : [];
  const metricRefs = finding.metricRefs;
  const evidence = uniqueEvidence([
    {
      type: "engine_finding",
      ref: finding.findingId,
      role: "supports",
      confidence: finding.confidence,
      note: "Deterministically mapped from the Milestone Process Flow engine.",
    },
    ...sourceEventIds.map((ref) => ({
      type: "project_event" as const,
      ref,
      role: "supports" as const,
      confidence: finding.confidence,
    })),
    ...metricRefs.map((ref) => ({
      type: "metric" as const,
      ref,
      role: "supports" as const,
      confidence: finding.confidence,
    })),
    ...finding.evidenceRefs.flatMap(mapEvidenceRef),
  ]);

  return {
    projectId: finding.projectId,
    knowledgeType: "finding",
    idempotencyKey: `mpf-finding:${finding.findingId}`,
    title: `MPF finding: ${label}`,
    summary: `${label} detected for transition ${finding.transitionId}.`,
    body: `The Milestone Process Flow engine detected ${label}. This is a proposal and requires human validation before activation.`,
    structuredContent: { finding },
    confidence: finding.confidence as KnowledgeConfidence,
    confidenceReason: `Inherited from MPF finding ${finding.findingId}.`,
    provenance: {
      captureMethod: "derived",
      sourceKind: "milestone_process_flow",
      sourceRef: finding.findingId,
      engineName: "milestone-process-flow",
      dataQualityFlags: finding.warnings.map((warning) => warning.code),
    },
    evidence,
    proposalRationale: "Promoted for review from deterministic process-mining output; no lifecycle approval is implied.",
  };
}
