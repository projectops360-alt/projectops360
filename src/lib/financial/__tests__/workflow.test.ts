import { describe, expect, it } from "vitest";
import {
  FINANCIAL_TRANSITIONS,
  getFinancialTransition,
  validateFinancialTransition,
} from "../workflow";

describe("financial workflow contract", () => {
  it("defines every approved controlled transition explicitly", () => {
    expect(FINANCIAL_TRANSITIONS.size).toBe(14);
    expect(getFinancialTransition("change", "approved", "posted")).toMatchObject({
      eventType: "financial_change_posted",
      capability: "financial.post",
    });
    expect(getFinancialTransition("period", "closed", "reopened")).toMatchObject({
      eventType: "financial_period_reopened",
      capability: "financial.period.manage",
    });
  });

  it("rejects implicit or skipped lifecycle states", () => {
    expect(getFinancialTransition("baseline", "draft", "active")).toBeNull();
    expect(getFinancialTransition("payment", "submitted", "approved")).toBeNull();
  });

  it("requires human evidence and segregation for approvals", () => {
    expect(validateFinancialTransition({
      domain: "boe",
      currentStatus: "submitted",
      targetStatus: "approved",
      actorType: "human",
      actorId: "user-1",
      preparedBy: "user-1",
      evidenceRefs: [],
    })).toEqual([
      "financial_evidence_required",
      "financial_segregation_of_duties_violation",
    ]);
  });

  it("does not allow AI to approve or post financial records", () => {
    expect(validateFinancialTransition({
      domain: "change",
      currentStatus: "recommended",
      targetStatus: "approved",
      actorType: "ai",
      actorId: "isabella",
      requestedBy: "user-1",
      evidenceRefs: ["change:evidence"],
    })).toContain("financial_human_authority_required");
  });
});
