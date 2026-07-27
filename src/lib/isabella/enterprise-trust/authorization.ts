/**
 * What Isabella may and may not do with Enterprise Trust.
 *
 * Enforced here and in the domain services, not in a system prompt. A prompt is
 * a request; this is a boundary. The Charter's position is that an AI may
 * explain and propose but may never be the thing that makes a governance
 * statement true, and a boundary that lives only in wording is one paraphrase
 * away from not existing.
 */

export const ISABELLA_TRUST_ALLOWED = [
  "read_authorized_trust_context",
  "explain_state",
  "compare_evidence",
  "identify_missing_or_stale_evidence",
  "explain_findings",
  "rank_remediation_candidates",
  "draft_remediation_proposal",
  "propose_relationship",
  "propose_owner_assignment",
  "identify_contradictions",
  "describe_state_changes",
] as const;

export const ISABELLA_TRUST_FORBIDDEN = [
  "activate_binding",
  "deactivate_binding",
  "change_control_state",
  "declare_control_operating",
  "resolve_finding",
  "close_finding",
  "accept_risk",
  "approve_exception",
  "approve_evidence",
  "delete_contradictory_evidence",
  "modify_immutable_history",
  "act_as_human_identity",
] as const;

export type IsabellaTrustAllowedAction = (typeof ISABELLA_TRUST_ALLOWED)[number];
export type IsabellaTrustForbiddenAction = (typeof ISABELLA_TRUST_FORBIDDEN)[number];
export type IsabellaTrustAction = IsabellaTrustAllowedAction | IsabellaTrustForbiddenAction | string;

const ALLOWED = new Set<string>(ISABELLA_TRUST_ALLOWED);

/**
 * Deny by default.
 *
 * An action nobody thought about is refused, not permitted. The alternative —
 * allowing anything not explicitly forbidden — means every capability added
 * later is granted to the AI by default, which is exactly backwards.
 */
export function isabellaMay(action: IsabellaTrustAction): boolean {
  return ALLOWED.has(action);
}

export class IsabellaTrustAuthorityError extends Error {
  constructor(public readonly action: string) {
    super(`isabella_trust_action_forbidden:${action}`);
    this.name = "IsabellaTrustAuthorityError";
  }
}

export function assertIsabellaMay(action: IsabellaTrustAction): void {
  if (!isabellaMay(action)) throw new IsabellaTrustAuthorityError(action);
}

/**
 * Assurances the system must never make.
 *
 * Compliance is asserted by an auditor, not by the software under audit. A
 * sentence like "ProjectOps360 is SOC 2 compliant" is not a strong claim that
 * happens to be unsupported — it is a claim this system is structurally unable
 * to make, and emitting it would misrepresent the one thing the programme exists
 * to be honest about.
 */
const PROHIBITED_ASSURANCE = [
  /\bis\s+soc\s*2\s+compliant\b/i,
  /\bsoc\s*2\s+compliant\b/i,
  /\bis\s+iso\s*27001\s+(certified|compliant)\b/i,
  /\bfully\s+compliant\b/i,
  /\bthis\s+control\s+is\s+certified\b/i,
  /\bcontrol\s+is\s+certified\b/i,
  /\bwe\s+are\s+certified\b/i,
  /\bthe\s+audit\s+will\s+pass\b/i,
  /\bwill\s+pass\s+the\s+audit\b/i,
  /\bguarantee[sd]?\s+compliance\b/i,
  /\baudit[- ]ready\b/i,
  /\bcumple\s+con\s+soc\s*2\b/i,
  /\bestamos?\s+certificad[oa]s?\b/i,
  /\bla\s+auditor[ií]a\s+(va\s+a\s+)?pasar[aá]?\b/i,
];

export function containsProhibitedAssurance(text: string): boolean {
  return PROHIBITED_ASSURANCE.some((pattern) => pattern.test(text));
}

/**
 * Last gate before an answer is returned.
 *
 * Redacting the sentence would leave an answer that reads as if it said
 * something. Refusing the whole answer is the honest failure: the caller learns
 * that the system could not answer safely rather than receiving a quietly
 * shortened one.
 */
export function assertNoProhibitedAssurance(answer: string): void {
  if (containsProhibitedAssurance(answer)) {
    throw new IsabellaTrustAuthorityError("prohibited_compliance_assertion");
  }
}

/**
 * Provenance stamped on anything Isabella generates.
 *
 * A draft that loses its authorship becomes indistinguishable from a human
 * decision the moment somebody reads it a week later.
 */
export interface AiProposalProvenance {
  generatedBy: "isabella";
  actorType: "ai";
  status: "draft";
  requiresHumanApproval: true;
  /** False until an authorized human approves. Metrics must read this, not the draft. */
  countsTowardCoverage: false;
  basedOnEvidence: string[];
}

export function draftProvenance(evidenceRefs: readonly string[]): AiProposalProvenance {
  return {
    generatedBy: "isabella",
    actorType: "ai",
    status: "draft",
    requiresHumanApproval: true,
    countsTowardCoverage: false,
    basedOnEvidence: [...evidenceRefs],
  };
}
