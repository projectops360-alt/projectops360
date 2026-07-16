import { describe, expect, it } from "vitest";
import { buildExplanationContract } from "../contract";

const scope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

describe("P8-T2C explanation contract", () => {
  it("packages a real commissioning recommendation with evidence and human control", () => {
    const explanation = buildExplanationContract({
      ...scope,
      classification: "recommendation",
      claim: "Keep integrated systems testing on hold until the Safety Lead approves the BMS alarm verification report.",
      reasoningSummary: "The owner email establishes approval as a prerequisite, and the current project record shows that approval is still pending.",
      evidence: [
        {
          ref: "communication:owner-commissioning-email",
          sourceType: "communication",
          description: "Owner Commissioning Lead states that testing must not start before Safety Lead approval.",
          observedAt: "2026-07-15T13:30:00Z",
        },
        {
          ref: "project-record:bms-verification-status-20260715",
          sourceType: "project_record",
          description: "BMS verification report status is pending submission and approval.",
          observedAt: "2026-07-15T17:00:00Z",
        },
      ],
      confidence: { value: 0.97, basis: "Two current, project-scoped sources agree on the unmet approval prerequisite." },
      limitations: ["Does not assess technical readiness beyond the BMS alarm verification prerequisite."],
      generatedAt: "2026-07-15T18:00:00Z",
      freshnessWindowHours: 24,
    });

    expect(explanation).toMatchObject({
      classification: "recommendation",
      humanApprovalRequired: true,
      executableNow: false,
      freshness: { status: "current", ageHours: 1 },
      visualHooks: { confidencePercent: 97, evidenceCount: 2, approvalLabel: "Human approval required" },
    });
    expect(explanation.evidence.map((item) => item.ref)).toEqual([
      "communication:owner-commissioning-email",
      "project-record:bms-verification-status-20260715",
    ]);
  });

  it("marks an explanation stale when its evidence exceeds the declared window", () => {
    const explanation = buildExplanationContract({
      ...scope,
      classification: "fact",
      claim: "The last recorded BMS verification status is pending.",
      reasoningSummary: "The claim is copied from the latest available project record.",
      evidence: [{
        ref: "project-record:bms-verification-status-20260710",
        sourceType: "project_record",
        description: "Status recorded as pending.",
        observedAt: "2026-07-10T18:00:00Z",
      }],
      confidence: { value: 1, basis: "Direct project record." },
      limitations: [],
      generatedAt: "2026-07-15T18:00:00Z",
      freshnessWindowHours: 24,
    });
    expect(explanation.freshness.status).toBe("stale");
  });

  it("rejects prediction explanations without a calibrated forecasting reference", () => {
    expect(() => buildExplanationContract({
      ...scope,
      classification: "prediction",
      claim: "Integrated testing will finish by July 31.",
      reasoningSummary: "A schedule projection was requested.",
      evidence: [{
        ref: "project-record:commissioning-schedule",
        sourceType: "project_record",
        description: "Current commissioning schedule.",
        observedAt: "2026-07-15T17:00:00Z",
      }],
      confidence: { value: 0.7, basis: "Uncalibrated schedule estimate." },
      limitations: ["Insufficient historical calibration data."],
      generatedAt: "2026-07-15T18:00:00Z",
      freshnessWindowHours: 24,
    })).toThrow("explanation_prediction_calibration_required");
  });
});
