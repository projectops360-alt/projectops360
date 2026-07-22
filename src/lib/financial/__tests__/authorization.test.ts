import { describe, expect, it } from "vitest";
import { authorizeFinancialAction } from "../authorization";
import type { FinancialActor, FinancialAuthorizationRequest } from "../types";

const actor: FinancialActor = {
  actorType: "human",
  userId: "finance-1",
  organizationId: "org-1",
  projectIds: ["project-1"],
  capabilities: ["financial.post", "financial.view"],
};

const request: FinancialAuthorizationRequest = {
  organizationId: "org-1",
  projectId: "project-1",
  capability: "financial.post",
  occurredAt: "2026-07-22T12:00:00.000Z",
  requesterId: "requester-1",
  approverId: "approver-1",
  posterId: "finance-1",
  reconcilerId: "controller-2",
};

describe("financial authorization", () => {
  it("allows a scoped direct capability with valid SoD", () => {
    expect(authorizeFinancialAction(actor, request)).toEqual({
      allowed: true,
      source: "direct",
    });
  });

  it("denies cross-organization and cross-project requests", () => {
    expect(
      authorizeFinancialAction(actor, { ...request, organizationId: "org-2" }),
    ).toMatchObject({ allowed: false, reason: "cross_organization_scope" });
    expect(
      authorizeFinancialAction(actor, { ...request, projectId: "project-2" }),
    ).toMatchObject({ allowed: false, reason: "project_scope_not_authorized" });
  });

  it("denies requester/approver, approver/poster and poster/reconciler conflicts", () => {
    expect(
      authorizeFinancialAction(actor, {
        ...request,
        requesterId: "same",
        approverId: "same",
      }),
    ).toMatchObject({ allowed: false, reason: "segregation_of_duties_conflict" });
    expect(
      authorizeFinancialAction(actor, {
        ...request,
        approverId: "finance-1",
        posterId: "finance-1",
      }),
    ).toMatchObject({ allowed: false, reason: "segregation_of_duties_conflict" });
    expect(
      authorizeFinancialAction(actor, {
        ...request,
        posterId: "same",
        reconcilerId: "same",
      }),
    ).toMatchObject({ allowed: false, reason: "segregation_of_duties_conflict" });
  });

  it("denies AI actors even when capabilities are present", () => {
    expect(
      authorizeFinancialAction({ ...actor, actorType: "ai" }, request),
    ).toMatchObject({ allowed: false, reason: "actor_type_not_authorized" });
  });

  it("allows a bounded active delegation and rejects expired or excessive use", () => {
    const delegated: FinancialActor = {
      ...actor,
      capabilities: [],
      delegations: [{
        capability: "financial.post",
        projectId: "project-1",
        maximumAmount: 1000,
        effectiveFrom: "2026-07-01T00:00:00.000Z",
        effectiveTo: "2026-07-31T23:59:59.999Z",
      }],
    };
    expect(authorizeFinancialAction(delegated, { ...request, amount: 900 })).toEqual({
      allowed: true,
      source: "delegation",
    });
    expect(
      authorizeFinancialAction(delegated, { ...request, amount: 1100 }),
    ).toMatchObject({ allowed: false, reason: "capability_not_authorized" });
    expect(
      authorizeFinancialAction(delegated, {
        ...request,
        amount: 900,
        occurredAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toMatchObject({ allowed: false, reason: "capability_not_authorized" });
  });
});
