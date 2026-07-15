import type {
  IsabellaClaimType,
  IsabellaConfidence,
} from "@/lib/isabella/process-intelligence/types";
import type { IsabellaRoute } from "@/lib/isabella/process-intelligence-runtime/types";

export type GovernedFindingStatus = "accepted" | "withheld";

export interface GovernedReasoningFinding {
  id: string;
  claimType: IsabellaClaimType;
  statement: string;
  confidence: IsabellaConfidence;
  evidenceRefs: string[];
  status: GovernedFindingStatus;
  inferenceLabel: "fact" | "inference" | "recommendation";
  reason?: string;
}

export interface ReasoningEvidenceConflict {
  sourceKey: string;
  evidenceRefs: string[];
  resolution: "withhold_inference";
}

export interface IsabellaReasoningTrace {
  contractVersion: "1.0.0";
  route: IsabellaRoute;
  stages: Array<
    "intent" | "scope" | "evidence" | "conflict_resolution" | "findings" | "confidence" | "recommendation" | "narration"
  >;
  scope: { organizationId: string | null; projectId: string | null };
  acceptedEvidenceCount: number;
  rejectedEvidenceCount: number;
  conflicts: ReasoningEvidenceConflict[];
  findings: GovernedReasoningFinding[];
  acceptedFindingCount: number;
  withheldFindingCount: number;
  recommendationCount: number;
  limitations: string[];
}
