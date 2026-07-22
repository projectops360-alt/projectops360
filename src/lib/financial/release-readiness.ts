export type ReadinessState = "pass" | "blocked" | "not_run";

export type PilotPrivacyClass =
  | "synthetic"
  | "internal_restricted"
  | "confidential"
  | "production_limited";

export interface PilotDatasetAssessmentInput {
  authorized: boolean;
  traceable: boolean;
  isolated: boolean;
  privacyApproved: boolean;
  privacyClass: PilotPrivacyClass;
  missingHistoryDocumented: boolean;
}

export interface ReadinessAssessment {
  state: ReadinessState;
  blockers: string[];
  warnings: string[];
}

export interface ForecastQualityAssessmentInput {
  historicalProjectCount: number;
  completedSnapshotCount: number;
  approvedOutcomes: boolean;
  integrityFailures: number;
  p50Coverage: number | null;
  p80Coverage: number | null;
  calibrationTolerance: number;
}

export interface ReleaseReadinessInput {
  pilot: ReadinessAssessment;
  reconciliation: ReadinessAssessment;
  forecast: ReadinessAssessment;
  nonFunctional: ReadinessAssessment;
  playbooks: ReadinessAssessment;
  approvals: {
    releaseOwner: boolean;
    pmo: boolean;
    productOwner: boolean;
  };
  productionEnvironmentVerified: boolean;
  stagedActivationPlanVerified: boolean;
  rollbackVerified: boolean;
}

export interface ProductionReadinessResult {
  state: ReadinessState;
  blockers: string[];
  warnings: string[];
  activation: "prohibited" | "staged_when_authorized";
}

export const FINANCIAL_READINESS_THRESHOLDS = {
  minimumHistoricalProjects: 3,
  minimumCompletedSnapshots: 30,
} as const;

export function assessPilotDataset(
  input: PilotDatasetAssessmentInput,
): ReadinessAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!input.authorized) blockers.push("pilot_authorization_missing");
  if (!input.traceable) blockers.push("pilot_traceability_missing");
  if (!input.isolated) blockers.push("pilot_isolation_missing");
  if (!input.privacyApproved) blockers.push("pilot_privacy_approval_missing");
  if (!input.missingHistoryDocumented) {
    blockers.push("pilot_missing_history_not_documented");
  }
  if (input.privacyClass === "production_limited") {
    warnings.push("pilot_contains_production_limited_data");
  }

  return {
    state: blockers.length > 0 ? "blocked" : "pass",
    blockers,
    warnings,
  };
}

export function assessForecastQuality(
  input: ForecastQualityAssessmentInput,
): ReadinessAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (
    input.historicalProjectCount < FINANCIAL_READINESS_THRESHOLDS.minimumHistoricalProjects
  ) {
    blockers.push("forecast_history_volume_insufficient");
  }
  if (
    input.completedSnapshotCount < FINANCIAL_READINESS_THRESHOLDS.minimumCompletedSnapshots
  ) {
    blockers.push("forecast_snapshot_volume_insufficient");
  }
  if (!input.approvedOutcomes) blockers.push("forecast_outcomes_not_approved");
  if (input.integrityFailures > 0) blockers.push("forecast_event_integrity_failures");
  if (input.p50Coverage == null || input.p80Coverage == null) {
    blockers.push("forecast_calibration_not_available");
  } else {
    if (Math.abs(input.p50Coverage - 0.5) > input.calibrationTolerance) {
      blockers.push("forecast_p50_outside_calibration_tolerance");
    }
    if (Math.abs(input.p80Coverage - 0.8) > input.calibrationTolerance) {
      blockers.push("forecast_p80_outside_calibration_tolerance");
    }
  }
  if (blockers.includes("forecast_history_volume_insufficient")) {
    warnings.push("predictive_claims_must_remain_unavailable");
  }

  return {
    state: blockers.length > 0 ? "blocked" : "pass",
    blockers,
    warnings,
  };
}

export function evaluateProductionReadiness(
  input: ReleaseReadinessInput,
): ProductionReadinessResult {
  const blockers: string[] = [];
  const warnings = [
    ...input.pilot.warnings,
    ...input.reconciliation.warnings,
    ...input.forecast.warnings,
    ...input.nonFunctional.warnings,
    ...input.playbooks.warnings,
  ];

  for (const [name, assessment] of [
    ["pilot", input.pilot],
    ["reconciliation", input.reconciliation],
    ["forecast", input.forecast],
    ["non_functional", input.nonFunctional],
    ["playbooks", input.playbooks],
  ] as const) {
    if (assessment.state !== "pass") blockers.push(`${name}_gate_not_passed`);
    blockers.push(...assessment.blockers.map((reason) => `${name}:${reason}`));
  }

  if (!input.approvals.releaseOwner) blockers.push("release_owner_approval_missing");
  if (!input.approvals.pmo) blockers.push("pmo_approval_missing");
  if (!input.approvals.productOwner) blockers.push("product_owner_approval_missing");
  if (!input.productionEnvironmentVerified) blockers.push("production_environment_not_verified");
  if (!input.stagedActivationPlanVerified) blockers.push("staged_activation_plan_missing");
  if (!input.rollbackVerified) blockers.push("rollback_not_verified");

  return {
    state: blockers.length > 0 ? "blocked" : "pass",
    blockers,
    warnings,
    activation: blockers.length > 0 ? "prohibited" : "staged_when_authorized",
  };
}
