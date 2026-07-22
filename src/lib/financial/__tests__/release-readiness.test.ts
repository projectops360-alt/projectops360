import { describe, expect, it } from "vitest";
import {
  assessForecastQuality,
  assessPilotDataset,
  evaluateProductionReadiness,
} from "../release-readiness";

const passingAssessment = {
  state: "pass" as const,
  blockers: [],
  warnings: [],
};

describe("financial production readiness gates", () => {
  it("blocks an unauthorized or untraceable pilot dataset", () => {
    const result = assessPilotDataset({
      authorized: false,
      traceable: false,
      isolated: true,
      privacyApproved: false,
      privacyClass: "confidential",
      missingHistoryDocumented: false,
    });

    expect(result.state).toBe("blocked");
    expect(result.blockers).toEqual(expect.arrayContaining([
      "pilot_authorization_missing",
      "pilot_traceability_missing",
      "pilot_privacy_approval_missing",
      "pilot_missing_history_not_documented",
    ]));
  });

  it("does not permit predictive claims when history is insufficient", () => {
    const result = assessForecastQuality({
      historicalProjectCount: 1,
      completedSnapshotCount: 4,
      approvedOutcomes: true,
      integrityFailures: 0,
      p50Coverage: null,
      p80Coverage: null,
      calibrationTolerance: 0.1,
    });

    expect(result.state).toBe("blocked");
    expect(result.blockers).toEqual(expect.arrayContaining([
      "forecast_history_volume_insufficient",
      "forecast_calibration_not_available",
    ]));
    expect(result.warnings).toContain("predictive_claims_must_remain_unavailable");
  });

  it("requires every gate and named approver before staged activation", () => {
    const result = evaluateProductionReadiness({
      pilot: passingAssessment,
      reconciliation: passingAssessment,
      forecast: passingAssessment,
      nonFunctional: passingAssessment,
      playbooks: passingAssessment,
      approvals: { releaseOwner: true, pmo: true, productOwner: false },
      productionEnvironmentVerified: true,
      stagedActivationPlanVerified: true,
      rollbackVerified: true,
    });

    expect(result.state).toBe("blocked");
    expect(result.activation).toBe("prohibited");
    expect(result.blockers).toContain("product_owner_approval_missing");
  });

  it("allows only staged activation after all gates pass", () => {
    const result = evaluateProductionReadiness({
      pilot: passingAssessment,
      reconciliation: passingAssessment,
      forecast: passingAssessment,
      nonFunctional: passingAssessment,
      playbooks: passingAssessment,
      approvals: { releaseOwner: true, pmo: true, productOwner: true },
      productionEnvironmentVerified: true,
      stagedActivationPlanVerified: true,
      rollbackVerified: true,
    });

    expect(result).toMatchObject({
      state: "pass",
      activation: "staged_when_authorized",
      blockers: [],
    });
  });
});
