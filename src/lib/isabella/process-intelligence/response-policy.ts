// ============================================================================
// ProjectOps360° — Isabella Process Intelligence · response policy
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT
//
// The rules an Isabella answer must satisfy. Encoded as a deterministic
// validator so future engines/tests can assert compliance — NOT wired into the
// live chat here. Pure.
// ============================================================================

import type { IsabellaConfidence, IsabellaIntentCategory } from "./types";
import { isLowConfidenceLabel } from "./confidence";

export const ISABELLA_RESPONSE_MUST = [
  "Answer in the user's language.",
  "Be direct and useful.",
  "Use verified data when available.",
  "State scope (project / milestone / task / time).",
  "Include sorting/filtering criteria for reports.",
  "Include total counts for reports.",
  "Cite evidence for project-specific claims.",
  "Distinguish facts from assumptions.",
  "Ask for clarification only when necessary.",
  "Avoid generic refusal for deterministic data that exists.",
] as const;

export const ISABELLA_RESPONSE_MUST_NOT = [
  "Hallucinate tasks.",
  "Invent blockers.",
  "Invent dependencies.",
  "Treat synthetic milestone_chain as a dependency.",
  "Claim evidence exists when it does not.",
  "Use low-confidence labels for verified data.",
  "Give vague PM advice when the user asked for a report.",
] as const;

/** A candidate Isabella answer, described just enough to validate the policy. */
export interface IsabellaResponseShape {
  intent: IsabellaIntentCategory;
  /** Did an approved deterministic retrieval succeed for this answer? */
  retrievalSucceeded: boolean;
  /** Whether the underlying data actually exists (≥0 rows retrieved). */
  dataExists: boolean;
  confidence: IsabellaConfidence;
  /** For report intents: does the answer state its scope? */
  statesScope: boolean;
  /** For report intents: does the answer state sort/filter criteria? */
  statesSortOrFilter: boolean;
  /** For report intents: does the answer include a total count? */
  includesCount: boolean;
  /** Did the answer fall back to a generic "no verified answer"? */
  usedGenericRefusal: boolean;
  /** Does every project-specific claim carry a citation? */
  claimsCited: boolean;
}

/**
 * Validate a candidate response against the policy. Returns violations (empty =
 * compliant). Focused on the guarantees the reported bug demands: a successful
 * deterministic report is verified, scoped, counted, cited, and never a generic
 * refusal or a low-confidence label.
 */
export function validateIsabellaResponse(r: IsabellaResponseShape): string[] {
  const v: string[] = [];
  const isReport = r.intent === "deterministic_project_report";

  if (isReport && r.retrievalSucceeded) {
    if (r.usedGenericRefusal) v.push("Deterministic report must not use a generic 'no verified answer' when data was retrieved.");
    if (isLowConfidenceLabel(r.confidence)) v.push("Deterministic report must not carry a low-confidence label.");
    if (r.confidence !== "verified") v.push("Successful deterministic report must be 'verified'.");
    if (r.dataExists) {
      if (!r.statesScope) v.push("Report must state its scope.");
      if (!r.statesSortOrFilter) v.push("Report must state its sort/filter criteria.");
      if (!r.includesCount) v.push("Report must include a total count.");
    }
  }

  // Any project-specific factual answer must cite evidence.
  if ((isReport || r.intent === "project_status_question" || r.intent === "root_cause_analysis") && r.dataExists && !r.claimsCited) {
    v.push("Project-specific claims must cite evidence.");
  }

  return v;
}
