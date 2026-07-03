// ============================================================================
// ProjectOps360° — MPF Engine · Isabella Evidence Packet Types (Phase 3, Task 7)
// ============================================================================
// Structured evidence packets Isabella consumes to explain milestone-flow health.
// NO natural language is generated here and NO LLM/AI API is called — only typed
// facts / inferences / predictions / recommendations / uncertainties + allowed /
// disallowed claim guardrails. Facts require evidence refs; predictions are never
// facts; recommendations are action categories only; unsupported causal/predictive
// claims are explicitly disallowed. Extends the Task 1 explanation-frame contract.
// ============================================================================

import type {
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneTransitionHealthStatus,
  IsabellaMilestoneFlowExplanationFrame,
  MilestoneFlowProjectScope,
  MilestoneProcessFlowEngineVersion,
  MilestoneProcessFlowConfigVersion,
} from "./types";
import type { MilestoneRecommendedActionCategory } from "./transition-health-types";

export interface MilestoneFlowIsabellaEvidencePacket {
  scope: MilestoneFlowProjectScope;
  transitionId: string;
  projectId: string;
  organizationId: string;
  healthStatus: MilestoneTransitionHealthStatus;
  confidence: MilestoneFlowEvidenceConfidence;
  /** Evidence-backed facts (each ref carries an eventId or metricRef). */
  facts: MilestoneFlowEvidenceRef[];
  /** Inferences derived from facts/findings (never asserted as facts). */
  inferences: MilestoneFlowEvidenceRef[];
  /** Optional predictions — never represented as facts. */
  predictions: MilestoneFlowEvidenceRef[];
  /** Recommendations = action categories only (no prose). */
  recommendations: MilestoneFlowEvidenceRef[];
  /** Explicit uncertainties. */
  uncertainties: MilestoneFlowEvidenceRef[];
  /** All deduped evidence refs backing the packet. */
  evidenceRefs: MilestoneFlowEvidenceRef[];
  /** Machine claim keys Isabella MAY assert (evidence-supported only). */
  allowedClaims: string[];
  /** Machine claim keys Isabella MUST NOT assert (unsupported causal/predictive). */
  disallowedClaims: string[];
  /** The Task 1 five-slot explanation frame. */
  explanationFrame: IsabellaMilestoneFlowExplanationFrame;
  recommendedActionCategory: MilestoneRecommendedActionCategory;
  engineVersion: MilestoneProcessFlowEngineVersion;
  configVersion: MilestoneProcessFlowConfigVersion;
}

export interface MilestoneFlowIsabellaEvidencePacketResult {
  packetsByTransition: Record<string, MilestoneFlowIsabellaEvidencePacket>;
}
