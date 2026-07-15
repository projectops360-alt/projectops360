import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import {
  canEvidenceSupportClaim,
  evidenceRequirementFor,
  type IsabellaClaimType,
  type IsabellaConfidence,
  type IsabellaEvidencePacket,
} from "@/lib/isabella/process-intelligence";
import type { IsabellaRoute } from "@/lib/isabella/process-intelligence-runtime/types";
import type { IsabellaDailyProcessDiagnosis } from "@/lib/isabella/daily-diagnosis";
import type { IsabellaRootCauseAnalysis } from "@/lib/isabella/root-cause";
import type { IsabellaRecommendationPlan } from "@/lib/isabella/recommendations";
import type {
  GovernedReasoningFinding,
  IsabellaReasoningTrace,
  ReasoningEvidenceConflict,
} from "./types";

interface ReasoningArtifacts {
  diagnosis?: IsabellaDailyProcessDiagnosis;
  analysis?: IsabellaRootCauseAnalysis;
  plan?: IsabellaRecommendationPlan;
}

function evidenceRef(packet: IsabellaEvidencePacket): string {
  return packet.citationRef ?? packet.evidenceId;
}

function scopedEvidence(context: IsabellaProcessContext): {
  accepted: IsabellaEvidencePacket[];
  rejected: IsabellaEvidencePacket[];
} {
  const organizationId = context.scope?.organizationId;
  const projectId = context.scope?.projectId ?? context.project?.projectId;
  const packets = [
    ...context.evidencePackets,
    ...(context.processSignals?.packets ?? []),
    ...(context.processSignals?.advancedPackets ?? []),
  ];
  const unique = [...new Map(packets.map((packet) => [packet.evidenceId, packet])).values()];
  return {
    accepted: unique.filter((packet) => packet.organizationId === organizationId && packet.projectId === projectId),
    rejected: unique.filter((packet) => packet.organizationId !== organizationId || packet.projectId !== projectId),
  };
}

function findConflicts(packets: readonly IsabellaEvidencePacket[]): ReasoningEvidenceConflict[] {
  const grouped = new Map<string, IsabellaEvidencePacket[]>();
  for (const packet of packets) {
    const key = `${packet.sourceKind}:${packet.sourceId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), packet]);
  }
  return [...grouped.entries()].flatMap(([sourceKey, rows]) => {
    const summaries = new Set(rows.map((row) => row.summary.trim().toLowerCase()));
    return summaries.size > 1
      ? [{ sourceKey, evidenceRefs: rows.map(evidenceRef), resolution: "withhold_inference" as const }]
      : [];
  });
}

function evaluateFinding(
  finding: Omit<GovernedReasoningFinding, "status" | "reason">,
  packets: readonly IsabellaEvidencePacket[],
  conflictedRefs: ReadonlySet<string>,
): GovernedReasoningFinding {
  const referenced = packets.filter((packet) => finding.evidenceRefs.includes(evidenceRef(packet)) || finding.evidenceRefs.includes(packet.evidenceId));
  if (finding.evidenceRefs.some((ref) => conflictedRefs.has(ref))) {
    return { ...finding, status: "withheld", reason: "conflicting_evidence" };
  }
  const support = canEvidenceSupportClaim(finding.claimType, referenced);
  if (!support.ok) return { ...finding, status: "withheld", reason: support.reason };
  return { ...finding, status: "accepted" };
}

function rootClaim(classification: string): IsabellaClaimType {
  return classification === "confirmed_cause" ? "blocker_claim" : "root_cause_claim";
}

function collectCandidates(
  context: IsabellaProcessContext,
  route: IsabellaRoute,
  artifacts: ReasoningArtifacts,
  processEvidenceRefs: string[],
): Array<Omit<GovernedReasoningFinding, "status" | "reason">> {
  const out: Array<Omit<GovernedReasoningFinding, "status" | "reason">> = [];
  if (route === "process_mining_summary" && context.processMiningContext) {
    const mining = context.processMiningContext;
    out.push({
      id: "process-mining:summary",
      claimType: "factual_project_data",
      statement: `${mining.eventCount} canonical events, ${mining.directFollowCount ?? 0} direct-follow relations and ${mining.variantCount ?? 0} variants observed.`,
      confidence: mining.integrityValid === true ? "verified" : "medium",
      evidenceRefs: processEvidenceRefs,
      inferenceLabel: "fact",
    });
  }
  const diagnosis = artifacts.diagnosis;
  if (diagnosis) {
    for (const [sectionKey, section] of Object.entries(diagnosis.sections)) {
      for (const [index, item] of section.items.entries()) {
        out.push({
          id: `diagnosis:${sectionKey}:${index}`,
          claimType: item.severity === "blocked" ? "blocker_claim" : "status_summary",
          statement: item.detail,
          confidence: item.confidence,
          evidenceRefs: item.evidenceRefs,
          inferenceLabel: "fact",
        });
      }
    }
  }
  for (const finding of artifacts.analysis?.findings ?? []) {
    out.push({
      id: `root:${finding.id}`,
      claimType: rootClaim(finding.classification),
      statement: finding.explanation,
      confidence: finding.confidence,
      evidenceRefs: finding.evidenceRefs,
      inferenceLabel: finding.classification === "confirmed_cause" ? "fact" : "inference",
    });
  }
  for (const recommendation of artifacts.plan?.recommendations ?? []) {
    out.push({
      id: `recommendation:${recommendation.id}`,
      claimType: "recommendation_claim",
      statement: recommendation.rationale,
      confidence: recommendation.confidence,
      evidenceRefs: recommendation.evidenceRefs,
      inferenceLabel: "recommendation",
    });
  }
  return out;
}

export function buildIsabellaReasoningTrace(
  context: IsabellaProcessContext,
  route: IsabellaRoute,
  artifacts: ReasoningArtifacts,
): IsabellaReasoningTrace {
  const evidence = scopedEvidence(context);
  const conflicts = findConflicts(evidence.accepted);
  const conflictedRefs = new Set(conflicts.flatMap((conflict) => conflict.evidenceRefs));
  const processEvidenceRefs = evidence.accepted
    .filter((packet) => packet.sourceKind === "project_event_graph" || packet.sourceKind === "milestone_process_flow")
    .map(evidenceRef);
  const findings = collectCandidates(context, route, artifacts, processEvidenceRefs)
    .map((finding) => evaluateFinding(finding, evidence.accepted, conflictedRefs));
  const limitations = [...context.limitations];
  if (evidence.rejected.length > 0) limitations.push("cross_scope_evidence_rejected");
  if (conflicts.length > 0) limitations.push("conflicting_evidence_withheld");
  if (findings.some((finding) => finding.status === "withheld")) limitations.push("unsupported_findings_withheld");
  return {
    contractVersion: "1.0.0",
    route,
    stages: ["intent", "scope", "evidence", "conflict_resolution", "findings", "confidence", "recommendation", "narration"],
    scope: {
      organizationId: context.scope?.organizationId ?? null,
      projectId: context.scope?.projectId ?? context.project?.projectId ?? null,
    },
    acceptedEvidenceCount: evidence.accepted.length,
    rejectedEvidenceCount: evidence.rejected.length,
    conflicts,
    findings,
    acceptedFindingCount: findings.filter((finding) => finding.status === "accepted").length,
    withheldFindingCount: findings.filter((finding) => finding.status === "withheld").length,
    recommendationCount: findings.filter((finding) => finding.status === "accepted" && finding.inferenceLabel === "recommendation").length,
    limitations: [...new Set(limitations)],
  };
}

export function governRootCauseAnalysis(
  analysis: IsabellaRootCauseAnalysis,
  trace: IsabellaReasoningTrace,
  language: "en" | "es",
): IsabellaRootCauseAnalysis {
  const accepted = new Set(trace.findings.filter((finding) => finding.status === "accepted").map((finding) => finding.id));
  const findings = analysis.findings.map((finding) => accepted.has(`root:${finding.id}`)
    ? finding
    : {
        ...finding,
        classification: "insufficient_evidence" as const,
        confidence: "unknown" as const,
        limitations: [...new Set([...(finding.limitations ?? []), "Withheld by governed reasoning: evidence requirements were not met."])],
      });
  const acceptedFindingIds = new Set(analysis.findings.filter((finding) => accepted.has(`root:${finding.id}`)).map((finding) => finding.id));
  const allWithheld = findings.length > 0 && findings.every((finding) => finding.classification === "insufficient_evidence");
  return {
    ...analysis,
    findings,
    evidenceChains: analysis.evidenceChains.filter((chain) => acceptedFindingIds.has(chain.findingId)),
    recommendationHandoffHints: analysis.recommendationHandoffHints
      .map((hint) => ({ ...hint, findingIds: hint.findingIds.filter((id) => acceptedFindingIds.has(id)) }))
      .filter((hint) => hint.findingIds.length > 0),
    confidence: allWithheld ? "unknown" : analysis.confidence,
    summary: allWithheld
      ? language === "es"
        ? "Se observaron síntomas, pero la evidencia disponible no permite afirmar una causa."
        : "Symptoms were observed, but the available evidence does not support asserting a cause."
      : analysis.summary,
  };
}

export function governRecommendationPlan(
  plan: IsabellaRecommendationPlan,
  trace: IsabellaReasoningTrace,
  language: "en" | "es",
): IsabellaRecommendationPlan {
  const accepted = new Set(trace.findings.filter((finding) => finding.status === "accepted").map((finding) => finding.id));
  const recommendations = plan.recommendations.filter((recommendation) => accepted.has(`recommendation:${recommendation.id}`));
  if (recommendations.length === plan.recommendations.length) return plan;
  return {
    ...plan,
    status: recommendations.length === 0 ? "empty" : plan.status,
    recommendations,
    recommendationGroups: plan.recommendationGroups
      .map((group) => ({ ...group, recommendations: group.recommendations.filter((id) => recommendations.some((item) => item.id === id)) }))
      .filter((group) => group.recommendations.length > 0),
    evidenceRefs: [...new Set(recommendations.flatMap((recommendation) => recommendation.evidenceRefs))],
    summary: recommendations.length === 0
      ? language === "es"
        ? "No hay una recomendación con evidencia suficiente. Se requiere revisión humana adicional."
        : "No recommendation has sufficient evidence. Additional human review is required."
      : plan.summary,
  };
}

export function minimumEvidenceForClaim(claimType: IsabellaClaimType): number {
  return evidenceRequirementFor(claimType).minEvidence;
}

export function conservativeConfidence(confidence: IsabellaConfidence, accepted: boolean): IsabellaConfidence {
  return accepted ? confidence : "unknown";
}
