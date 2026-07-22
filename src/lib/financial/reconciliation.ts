import type { ReconciliationResult } from "./types";

export function reconcileAmount(
  expected: number,
  actual: number,
  tolerance = 0,
): ReconciliationResult {
  if (![expected, actual, tolerance].every(Number.isFinite) || tolerance < 0) {
    throw new Error("invalid_reconciliation_input");
  }
  const difference = actual - expected;
  const absolute = Math.abs(difference);
  return {
    status:
      absolute === 0 ? "reconciled" :
      absolute <= tolerance ? "within_tolerance" :
      "exception",
    expected,
    actual,
    difference,
    tolerance,
  };
}

export function fundingPosition(input: {
  authorized: number;
  released: number;
  restricted: number;
  governedUses: number;
}) {
  const values = Object.values(input);
  if (!values.every(Number.isFinite) || values.some((value) => value < 0)) {
    throw new Error("invalid_funding_position");
  }
  return {
    authorized: input.authorized,
    released: input.released,
    restricted: input.restricted,
    remainingAuthorization: input.authorized - input.released,
    availableReleased: input.released - input.restricted - input.governedUses,
  };
}

export function commitmentPosition(input: {
  original: number;
  amendments: number;
  cancellations: number;
  consumed: number;
}) {
  const values = Object.values(input);
  if (!values.every(Number.isFinite)) throw new Error("invalid_commitment_position");
  const current = input.original + input.amendments - input.cancellations;
  return {
    original: input.original,
    current,
    consumed: input.consumed,
    cancelled: input.cancellations,
    outstanding: current - input.consumed,
    status: current - input.consumed < 0 ? "exception" : "available",
  };
}

export function costExposure(input: {
  actual: number;
  eligibleAccrual: number;
  openCommitment: number;
  uncommittedForecast: number;
}) {
  const values = Object.values(input);
  if (!values.every(Number.isFinite)) throw new Error("invalid_cost_exposure");
  return {
    ...input,
    total:
      input.actual +
      input.eligibleAccrual +
      input.openCommitment +
      input.uncommittedForecast,
  };
}
