import { describe, expect, it } from "vitest";
import {
  commitmentPosition,
  costExposure,
  fundingPosition,
  reconcileAmount,
} from "../reconciliation";

describe("financial reconciliation primitives", () => {
  it("distinguishes exact, within-tolerance and exception results", () => {
    expect(reconcileAmount(100, 100, 0).status).toBe("reconciled");
    expect(reconcileAmount(100, 100.005, 0.01).status).toBe("within_tolerance");
    expect(reconcileAmount(100, 100.02, 0.01).status).toBe("exception");
  });

  it("keeps funding positions separate", () => {
    expect(fundingPosition({
      authorized: 1000,
      released: 400,
      restricted: 50,
      governedUses: 100,
    })).toEqual({
      authorized: 1000,
      released: 400,
      restricted: 50,
      remainingAuthorization: 600,
      availableReleased: 250,
    });
  });

  it("reconciles commitment original/current/consumed/outstanding", () => {
    expect(commitmentPosition({
      original: 100,
      amendments: 20,
      cancellations: 5,
      consumed: 70,
    })).toEqual({
      original: 100,
      current: 115,
      consumed: 70,
      cancelled: 5,
      outstanding: 45,
      status: "available",
    });
  });

  it("exposes every cost component instead of a blind total", () => {
    expect(costExposure({
      actual: 400,
      eligibleAccrual: 50,
      openCommitment: 300,
      uncommittedForecast: 200,
    })).toEqual({
      actual: 400,
      eligibleAccrual: 50,
      openCommitment: 300,
      uncommittedForecast: 200,
      total: 950,
    });
  });
});
