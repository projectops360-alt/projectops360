import { describe, expect, it } from "vitest";
import {
  assignOwnerSchema,
  authorizeEvidenceAction,
  conditionForOutcome,
  createEvidenceBindingSchema,
  humanMayTransition,
  isMoreConservative,
  outcomeIsPassing,
  resolveFindingSchema,
  severityForCondition,
} from "../contracts";
import { CONTROL_STATES, EVIDENCE_OUTCOMES, type ControlState } from "../types";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("evidence outcome semantics", () => {
  it("treats only current and approaching_stale as passing", () => {
    expect(EVIDENCE_OUTCOMES.filter(outcomeIsPassing)).toEqual(["current", "approaching_stale"]);
  });

  /**
   * The point of the engine. A source that could not be read must never be
   * indistinguishable from a source that was read and said yes — that is exactly
   * the failure mode a trust system exists to prevent.
   */
  it("fails closed on unavailable and invalid", () => {
    expect(outcomeIsPassing("unavailable")).toBe(false);
    expect(outcomeIsPassing("invalid")).toBe(false);
    expect(outcomeIsPassing("contradictory")).toBe(false);
    expect(conditionForOutcome("unavailable", 0)).toBe("evidence_unavailable");
    expect(conditionForOutcome("invalid", 5)).toBe("evidence_invalid");
  });

  it("separates never-evidenced from lapsed", () => {
    expect(conditionForOutcome("stale", 0)).toBe("evidence_missing");
    expect(conditionForOutcome("stale", 1)).toBe("evidence_stale");
  });

  it("raises no condition while evidence holds", () => {
    expect(conditionForOutcome("current", 3)).toBeNull();
    expect(conditionForOutcome("approaching_stale", 3)).toBeNull();
  });

  it("assigns a severity to every condition", () => {
    expect(severityForCondition("evidence_missing")).toBe("high");
    expect(severityForCondition("evidence_contradictory")).toBe("high");
    expect(severityForCondition("control_lost_operating")).toBe("high");
    expect(severityForCondition("evidence_stale")).toBe("medium");
    expect(severityForCondition("evidence_unavailable")).toBe("medium");
    expect(severityForCondition("evidence_invalid")).toBe("medium");
  });
});

describe("control state conservatism", () => {
  /**
   * `operating` is the one state that cannot be asserted. A human may always
   * lower a control; raising one requires evidence, and this asymmetry is what
   * makes the state mean anything.
   */
  it("never lets a human raise a control without evidence", () => {
    expect(humanMayTransition("operating", "degraded")).toBe(true);
    expect(humanMayTransition("operating", "ineffective")).toBe(true);
    expect(humanMayTransition("degraded", "operating")).toBe(false);
    expect(humanMayTransition("implemented", "operating")).toBe(false);
    expect(humanMayTransition("proposed", "implemented")).toBe(false);
  });

  it("refuses a no-op as a transition", () => {
    for (const state of CONTROL_STATES) {
      expect(humanMayTransition(state, state)).toBe(false);
    }
  });

  it("ranks every state, so no pair is undecidable", () => {
    for (const from of CONTROL_STATES) {
      for (const to of CONTROL_STATES) {
        expect(typeof isMoreConservative(from as ControlState, to as ControlState)).toBe("boolean");
      }
    }
  });
});

describe("evidence binding contract", () => {
  it("accepts a closed interval vocabulary only", () => {
    expect(
      createEvidenceBindingSchema.safeParse({
        bindingObjectId: UUID_A,
        resolverKey: "governance_audit_activity",
        freshnessInterval: "7 days",
        warningInterval: "2 days",
      }).success,
    ).toBe(true);
  });

  /** Free text in an interval would reach SQL. The regex is the boundary. */
  it("rejects free-text intervals and unknown resolvers", () => {
    const base = { bindingObjectId: UUID_A, resolverKey: "governance_audit_activity" as const, warningInterval: "2 days" };
    expect(createEvidenceBindingSchema.safeParse({ ...base, freshnessInterval: "7 days'; drop table x --" }).success).toBe(false);
    expect(createEvidenceBindingSchema.safeParse({ ...base, freshnessInterval: "forever" }).success).toBe(false);
    expect(
      createEvidenceBindingSchema.safeParse({ ...base, freshnessInterval: "7 days", resolverKey: "arbitrary_sql" }).success,
    ).toBe(false);
  });

  it("rejects unknown fields rather than ignoring them", () => {
    expect(
      createEvidenceBindingSchema.safeParse({
        bindingObjectId: UUID_A,
        resolverKey: "governance_audit_activity",
        freshnessInterval: "7 days",
        warningInterval: "2 days",
        organizationId: UUID_B,
      }).success,
    ).toBe(false);
  });
});

describe("resolution and ownership contracts", () => {
  it("requires a rationale to close a finding", () => {
    expect(resolveFindingSchema.safeParse({ findingObjectId: UUID_A, resolution: "resolved", rationale: "  " }).success).toBe(false);
    expect(resolveFindingSchema.safeParse({ findingObjectId: UUID_A, resolution: "resolved", rationale: "Evidence restored." }).success).toBe(true);
  });

  it("accepts only the two stated resolutions", () => {
    expect(resolveFindingSchema.safeParse({ findingObjectId: UUID_A, resolution: "accepted", rationale: "Risk accepted by the board." }).success).toBe(true);
    expect(resolveFindingSchema.safeParse({ findingObjectId: UUID_A, resolution: "dismissed", rationale: "No reason." }).success).toBe(false);
  });

  it("requires a rationale to name an owner", () => {
    expect(assignOwnerSchema.safeParse({ objectId: UUID_A, ownerUserId: UUID_B, rationale: "" }).success).toBe(false);
    expect(assignOwnerSchema.safeParse({ objectId: UUID_A, ownerUserId: UUID_B, rationale: "Named control owner." }).success).toBe(true);
  });
});

describe("authorization matrix", () => {
  it("lets anyone read and any member evaluate", () => {
    for (const role of ["owner", "admin", "member", "viewer"]) {
      expect(authorizeEvidenceAction(role, "read")).toBe(true);
    }
    expect(authorizeEvidenceAction("member", "evaluate")).toBe(true);
    expect(authorizeEvidenceAction("viewer", "evaluate")).toBe(false);
  });

  it("restricts closing findings and naming owners to owner and admin", () => {
    for (const action of ["resolve_finding", "assign_owner", "define_binding"] as const) {
      expect(authorizeEvidenceAction("owner", action)).toBe(true);
      expect(authorizeEvidenceAction("admin", action)).toBe(true);
      expect(authorizeEvidenceAction("member", action)).toBe(false);
      expect(authorizeEvidenceAction("viewer", action)).toBe(false);
    }
  });

  it("denies an unknown role every action", () => {
    for (const action of ["read", "define_binding", "evaluate", "resolve_finding", "assign_owner"] as const) {
      expect(authorizeEvidenceAction("stranger", action)).toBe(false);
    }
  });
});
