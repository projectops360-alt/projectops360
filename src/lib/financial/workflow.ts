import type { FinancialCapability } from "./types";

export type FinancialWorkflowDomain =
  | "estimate"
  | "boe"
  | "baseline"
  | "funding"
  | "accrual"
  | "payment"
  | "change"
  | "period";

export interface FinancialTransitionDefinition {
  domain: FinancialWorkflowDomain;
  from: string;
  to: string;
  eventType: string;
  capability: FinancialCapability;
  subjectType: string;
  approval: boolean;
}

export interface FinancialTransitionRequest {
  domain: FinancialWorkflowDomain;
  currentStatus: string;
  targetStatus: string;
  actorType: "human" | "system" | "ai" | "external";
  actorId: string | null;
  preparedBy?: string | null;
  requestedBy?: string | null;
  evidenceRefs: string[];
}

const transition = (
  definition: FinancialTransitionDefinition,
): [string, FinancialTransitionDefinition] => [
  `${definition.domain}:${definition.from}:${definition.to}`,
  definition,
];

export const FINANCIAL_TRANSITIONS = new Map<string, FinancialTransitionDefinition>([
  transition({ domain: "estimate", from: "draft", to: "submitted", eventType: "financial_estimate_prepared", capability: "financial.prepare", subjectType: "financial_estimate", approval: false }),
  transition({ domain: "boe", from: "submitted", to: "approved", eventType: "financial_boe_approved", capability: "financial.approve", subjectType: "financial_boe", approval: true }),
  transition({ domain: "baseline", from: "approved", to: "active", eventType: "financial_baseline_activated", capability: "financial.approve", subjectType: "financial_baseline", approval: true }),
  transition({ domain: "funding", from: "submitted", to: "approved", eventType: "funding_authorized", capability: "financial.funding.authorize", subjectType: "funding_authorization", approval: true }),
  transition({ domain: "accrual", from: "submitted", to: "approved", eventType: "financial_accrual_approved", capability: "financial.approve", subjectType: "financial_accrual", approval: true }),
  transition({ domain: "accrual", from: "reviewed", to: "approved", eventType: "financial_accrual_approved", capability: "financial.approve", subjectType: "financial_accrual", approval: true }),
  transition({ domain: "payment", from: "validated", to: "approved", eventType: "financial_payment_approved", capability: "financial.payment.release", subjectType: "financial_payment", approval: true }),
  transition({ domain: "change", from: "assessed", to: "approved", eventType: "financial_change_approved", capability: "financial.approve", subjectType: "financial_change", approval: true }),
  transition({ domain: "change", from: "recommended", to: "approved", eventType: "financial_change_approved", capability: "financial.approve", subjectType: "financial_change", approval: true }),
  transition({ domain: "change", from: "approved", to: "posted", eventType: "financial_change_posted", capability: "financial.post", subjectType: "financial_change", approval: false }),
  transition({ domain: "change", from: "authorized_for_posting", to: "posted", eventType: "financial_change_posted", capability: "financial.post", subjectType: "financial_change", approval: false }),
  transition({ domain: "period", from: "open", to: "closed", eventType: "financial_period_closed", capability: "financial.period.manage", subjectType: "financial_period", approval: true }),
  transition({ domain: "period", from: "reopened", to: "reclosed", eventType: "financial_period_closed", capability: "financial.period.manage", subjectType: "financial_period", approval: true }),
  transition({ domain: "period", from: "closed", to: "reopened", eventType: "financial_period_reopened", capability: "financial.period.manage", subjectType: "financial_period", approval: true }),
]);

export function getFinancialTransition(
  domain: FinancialWorkflowDomain,
  currentStatus: string,
  targetStatus: string,
): FinancialTransitionDefinition | null {
  return FINANCIAL_TRANSITIONS.get(`${domain}:${currentStatus}:${targetStatus}`) ?? null;
}

export function validateFinancialTransition(request: FinancialTransitionRequest): string[] {
  const definition = getFinancialTransition(
    request.domain,
    request.currentStatus,
    request.targetStatus,
  );
  if (!definition) return ["financial_transition_not_allowed"];

  const errors: string[] = [];
  if (request.actorType !== "human" || !request.actorId) {
    errors.push("financial_human_authority_required");
  }
  if (request.evidenceRefs.length === 0) errors.push("financial_evidence_required");
  if (
    definition.approval &&
    (request.actorId === request.preparedBy || request.actorId === request.requestedBy)
  ) {
    errors.push("financial_segregation_of_duties_violation");
  }
  return errors;
}
