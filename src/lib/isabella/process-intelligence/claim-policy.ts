// ============================================================================
// ProjectOps360° — Isabella Process Intelligence · claim/evidence policy
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT
//
// What evidence each claim TYPE requires before Isabella may assert it. This is
// the anti-hallucination core: no supporting packet of the right type + minimum
// confidence ⇒ Isabella may NOT make the claim. Crucially, a SYNTHETIC
// milestone_chain edge can never back a dependency/blocker claim (it carries a
// `disallowedClaims` guard). Pure — no retrieval, no LLM.
// ============================================================================

import type {
  IsabellaClaimType,
  IsabellaConfidence,
  IsabellaEvidencePacket,
  IsabellaEvidenceType,
} from "./types";
import { meetsConfidence } from "./confidence";

export interface ClaimEvidenceRequirement {
  claimType: IsabellaClaimType;
  /** Any packet whose evidenceType is in this set can count toward support. */
  anyOfEvidenceTypes: IsabellaEvidenceType[];
  /** Minimum number of qualifying packets. */
  minEvidence: number;
  /** Minimum confidence a qualifying packet must carry. */
  minConfidence: IsabellaConfidence;
  /** For inference-class claims — the answer must be labeled as such. */
  mustLabelInference: boolean;
  notes: string;
}

export const CLAIM_EVIDENCE_REQUIREMENTS: Record<IsabellaClaimType, ClaimEvidenceRequirement> = {
  factual_project_data: {
    claimType: "factual_project_data",
    anyOfEvidenceTypes: ["task", "subtask", "milestone", "status_report"],
    minEvidence: 1,
    minConfidence: "verified",
    mustLabelInference: false,
    notes: "Deterministic task/milestone data reference. Verified retrieval only.",
  },
  status_summary: {
    claimType: "status_summary",
    anyOfEvidenceTypes: ["task", "subtask", "milestone", "living_graph_node", "status_report"],
    minEvidence: 1,
    minConfidence: "high",
    mustLabelInference: false,
    notes: "Task/milestone status/progress references.",
  },
  dependency_claim: {
    claimType: "dependency_claim",
    // A REAL dependency edge or record — never the synthetic milestone_chain.
    anyOfEvidenceTypes: ["dependency", "living_graph_edge"],
    minEvidence: 1,
    minConfidence: "high",
    mustLabelInference: false,
    notes: "Requires a real dependency edge/record. Synthetic milestone_chain is barred via disallowedClaims.",
  },
  blocker_claim: {
    claimType: "blocker_claim",
    anyOfEvidenceTypes: ["blocker", "dependency", "risk", "decision"],
    minEvidence: 1,
    minConfidence: "high",
    mustLabelInference: false,
    notes: "Blocker status, dependency, risk, decision, or an explicit blockedReason.",
  },
  risk_claim: {
    claimType: "risk_claim",
    anyOfEvidenceTypes: ["risk", "delay_finding", "bottleneck_finding"],
    minEvidence: 1,
    minConfidence: "medium",
    mustLabelInference: false,
    notes: "Risk record, delay signal, bottleneck, or approved analysis.",
  },
  root_cause_claim: {
    claimType: "root_cause_claim",
    anyOfEvidenceTypes: [
      "delay_finding",
      "rework_finding",
      "bottleneck_finding",
      "milestone_flow_segment",
      "blocker",
      "dependency",
      "event_summary",
    ],
    minEvidence: 2, // multiple supporting signals
    minConfidence: "medium",
    mustLabelInference: true,
    notes: "Multiple supporting signals + confidence. Distinguish confirmed / likely / possible cause.",
  },
  recommendation_claim: {
    claimType: "recommendation_claim",
    anyOfEvidenceTypes: [
      "delay_finding",
      "rework_finding",
      "bottleneck_finding",
      "blocker",
      "risk",
      "milestone_flow_segment",
      "status_report",
    ],
    minEvidence: 1,
    minConfidence: "medium",
    mustLabelInference: true,
    notes: "Backed by diagnosis/root-cause/context evidence; prioritized.",
  },
  assumption_or_inference: {
    claimType: "assumption_or_inference",
    anyOfEvidenceTypes: [
      "task",
      "subtask",
      "milestone",
      "living_graph_node",
      "living_graph_edge",
      "milestone_flow_segment",
      "delay_finding",
      "event_summary",
    ],
    minEvidence: 1,
    minConfidence: "low",
    mustLabelInference: true,
    notes: "Any supporting signal; MUST be labeled as an inference/assumption.",
  },
};

/** Look up the evidence requirement for a claim type. */
export function evidenceRequirementFor(claimType: IsabellaClaimType): ClaimEvidenceRequirement {
  return CLAIM_EVIDENCE_REQUIREMENTS[claimType];
}

/** Does this packet HARD-forbid the given claim? (e.g. synthetic milestone_chain) */
export function packetForbidsClaim(packet: IsabellaEvidencePacket, claimType: IsabellaClaimType): boolean {
  return (packet.disallowedClaims ?? []).includes(claimType);
}

export interface ClaimSupportResult {
  ok: boolean;
  qualifyingCount: number;
  required: number;
  reason?: string;
}

/**
 * Can the given evidence support the claim? A packet qualifies only when it is
 * NOT hard-forbidden for the claim, its evidenceType is accepted, and its
 * confidence meets the minimum. Deterministic and side-effect free.
 */
export function canEvidenceSupportClaim(
  claimType: IsabellaClaimType,
  evidence: IsabellaEvidencePacket[],
): ClaimSupportResult {
  const req = evidenceRequirementFor(claimType);
  const accepted = new Set(req.anyOfEvidenceTypes);
  const qualifying = evidence.filter(
    (p) =>
      !packetForbidsClaim(p, claimType) &&
      accepted.has(p.evidenceType) &&
      meetsConfidence(p.confidence, req.minConfidence),
  );
  const ok = qualifying.length >= req.minEvidence;
  return {
    ok,
    qualifyingCount: qualifying.length,
    required: req.minEvidence,
    reason: ok
      ? undefined
      : qualifying.length === 0
        ? "No qualifying evidence of the required type/confidence (or all forbidden for this claim)."
        : `Insufficient evidence: ${qualifying.length}/${req.minEvidence}.`,
  };
}

/**
 * Build a SYNTHETIC milestone_chain edge evidence packet — presentation-only
 * sequencing (order_index), NOT a prerequisite. It is barred from ever backing a
 * dependency or blocker claim. Helper so callers can't forget the guard.
 */
export function makeSyntheticMilestoneChainEvidence(input: {
  evidenceId: string;
  sourceId: string;
  projectId: string;
  organizationId: string;
  title: string;
  summary?: string;
}): IsabellaEvidencePacket {
  return {
    evidenceId: input.evidenceId,
    evidenceType: "living_graph_edge",
    sourceKind: "living_graph",
    sourceId: input.sourceId,
    projectId: input.projectId,
    organizationId: input.organizationId,
    title: input.title,
    summary: input.summary ?? "Presentation-only milestone sequencing (order_index) — not a real prerequisite.",
    citationLabel: "Living Graph milestone sequence (presentation only)",
    confidence: "verified",
    visibility: "project",
    claimSupport: ["status_summary"],
    disallowedClaims: ["dependency_claim", "blocker_claim"],
    limitations: ["Synthetic milestone_chain edge — sequencing only, never a dependency."],
  };
}
