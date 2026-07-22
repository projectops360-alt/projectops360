import type {
  AuthorizationResult,
  FinancialActor,
  FinancialAuthorizationRequest,
  FinancialDelegation,
} from "./types";

function activeDelegation(
  actor: FinancialActor,
  request: FinancialAuthorizationRequest,
): FinancialDelegation | undefined {
  const at = Date.parse(request.occurredAt);
  return actor.delegations?.find((delegation) => {
    const withinTime =
      Number.isFinite(at) &&
      at >= Date.parse(delegation.effectiveFrom) &&
      at <= Date.parse(delegation.effectiveTo);
    const withinAmount =
      delegation.maximumAmount === undefined ||
      request.amount === undefined ||
      Math.abs(request.amount) <= delegation.maximumAmount;
    return (
      delegation.capability === request.capability &&
      delegation.projectId === request.projectId &&
      withinTime &&
      withinAmount
    );
  });
}

function violatesSegregation(request: FinancialAuthorizationRequest): boolean {
  const requester = request.requesterId ?? null;
  const approver = request.approverId ?? null;
  const poster = request.posterId ?? null;
  const reconciler = request.reconcilerId ?? null;
  return Boolean(
    (requester && approver && requester === approver) ||
    (approver && poster && approver === poster) ||
    (poster && reconciler && poster === reconciler),
  );
}

export function authorizeFinancialAction(
  actor: FinancialActor,
  request: FinancialAuthorizationRequest,
): AuthorizationResult {
  if (actor.actorType === "ai" || actor.actorType === "external") {
    return { allowed: false, reason: "actor_type_not_authorized" };
  }
  if (actor.organizationId !== request.organizationId) {
    return { allowed: false, reason: "cross_organization_scope" };
  }
  if (!actor.projectIds.includes(request.projectId)) {
    return { allowed: false, reason: "project_scope_not_authorized" };
  }
  if (violatesSegregation(request)) {
    return { allowed: false, reason: "segregation_of_duties_conflict" };
  }
  if (actor.capabilities.includes(request.capability)) {
    return { allowed: true, source: "direct" };
  }
  if (activeDelegation(actor, request)) {
    return { allowed: true, source: "delegation" };
  }
  return { allowed: false, reason: "capability_not_authorized" };
}
