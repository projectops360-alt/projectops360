// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT — claim/evidence guards
// ============================================================================
// Anti-hallucination core: each claim type needs qualifying evidence; a
// SYNTHETIC milestone_chain edge can never back a dependency/blocker claim.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  CLAIM_EVIDENCE_REQUIREMENTS,
  canEvidenceSupportClaim,
  evidenceRequirementFor,
  makeSyntheticMilestoneChainEvidence,
  packetForbidsClaim,
} from "@/lib/isabella/process-intelligence/claim-policy";
import { validateDeterministicReportConfidence } from "@/lib/isabella/process-intelligence/confidence";
import { ISABELLA_CLAIM_TYPES } from "@/lib/isabella/process-intelligence/types";
import type {
  IsabellaConfidence,
  IsabellaEvidencePacket,
  IsabellaEvidenceType,
} from "@/lib/isabella/process-intelligence/types";

let seq = 0;
function ev(type: IsabellaEvidenceType, confidence: IsabellaConfidence = "verified", extra: Partial<IsabellaEvidencePacket> = {}): IsabellaEvidencePacket {
  seq += 1;
  return {
    evidenceId: `e${seq}`,
    evidenceType: type,
    sourceKind: "deterministic_project_data",
    sourceId: `s${seq}`,
    projectId: "p1",
    organizationId: "org1",
    title: `Evidence ${seq}`,
    summary: "…",
    citationLabel: "Source",
    confidence,
    visibility: "project",
    ...extra,
  };
}

describe("claim evidence requirements", () => {
  it("declares a requirement for every claim type", () => {
    for (const ct of ISABELLA_CLAIM_TYPES) {
      const req = evidenceRequirementFor(ct);
      expect(req.claimType).toBe(ct);
      expect(req.anyOfEvidenceTypes.length).toBeGreaterThan(0);
      expect(req.minEvidence).toBeGreaterThanOrEqual(1);
    }
  });

  it("factual_project_data requires a verified deterministic reference", () => {
    expect(canEvidenceSupportClaim("factual_project_data", [ev("task", "verified")]).ok).toBe(true);
    // A mere low-confidence inference cannot back a factual data claim.
    expect(canEvidenceSupportClaim("factual_project_data", [ev("task", "low")]).ok).toBe(false);
    // No evidence at all → cannot claim.
    expect(canEvidenceSupportClaim("factual_project_data", []).ok).toBe(false);
  });

  it("dependency_claim requires a REAL dependency edge/record", () => {
    expect(canEvidenceSupportClaim("dependency_claim", [ev("dependency", "high")]).ok).toBe(true);
    expect(canEvidenceSupportClaim("dependency_claim", [ev("living_graph_edge", "high")]).ok).toBe(true);
    // A task on its own cannot establish a dependency.
    expect(canEvidenceSupportClaim("dependency_claim", [ev("task", "verified")]).ok).toBe(false);
  });

  it("a SYNTHETIC milestone_chain edge can NEVER support a dependency or blocker claim", () => {
    const chain = makeSyntheticMilestoneChainEvidence({
      evidenceId: "mc1",
      sourceId: "edge:mc1",
      projectId: "p1",
      organizationId: "org1",
      title: "Phase 1 → Phase 2 (sequence)",
    });
    expect(chain.evidenceType).toBe("living_graph_edge");
    expect(packetForbidsClaim(chain, "dependency_claim")).toBe(true);
    expect(canEvidenceSupportClaim("dependency_claim", [chain]).ok).toBe(false);
    expect(canEvidenceSupportClaim("blocker_claim", [chain]).ok).toBe(false);
  });

  it("root_cause_claim requires multiple signals + confidence and is an inference", () => {
    const req = evidenceRequirementFor("root_cause_claim");
    expect(req.minEvidence).toBeGreaterThanOrEqual(2);
    expect(req.mustLabelInference).toBe(true);
    expect(canEvidenceSupportClaim("root_cause_claim", [ev("delay_finding", "medium")]).ok).toBe(false); // only 1
    expect(
      canEvidenceSupportClaim("root_cause_claim", [ev("delay_finding", "medium"), ev("bottleneck_finding", "medium")]).ok,
    ).toBe(true);
  });

  it("recommendation_claim requires evidence and is labeled as inference", () => {
    expect(evidenceRequirementFor("recommendation_claim").mustLabelInference).toBe(true);
    expect(canEvidenceSupportClaim("recommendation_claim", []).ok).toBe(false);
    expect(canEvidenceSupportClaim("recommendation_claim", [ev("blocker", "high")]).ok).toBe(true);
  });
});

describe("verified confidence for deterministic reports", () => {
  it("a successful deterministic report must be verified and never low-confidence", () => {
    expect(validateDeterministicReportConfidence({ retrievalSucceeded: true, confidence: "verified" })).toEqual([]);
    expect(validateDeterministicReportConfidence({ retrievalSucceeded: true, confidence: "low" }).length).toBeGreaterThan(0);
    expect(validateDeterministicReportConfidence({ retrievalSucceeded: true, confidence: "unknown" }).length).toBeGreaterThan(0);
    // factual_project_data requirement is pinned to verified.
    expect(CLAIM_EVIDENCE_REQUIREMENTS.factual_project_data.minConfidence).toBe("verified");
  });
});
