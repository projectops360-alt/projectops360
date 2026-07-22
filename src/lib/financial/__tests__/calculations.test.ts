import { describe, expect, it } from "vitest";
import golden from "../../../../Project360/Budget_Cost_Management/reference/P4_Golden_Financial_Calculations_v1.json";
import {
  computeDeterministicForecasts,
  computeEvmSnapshot,
  computeTcpi,
  weightedMean,
  weightedQuantile,
} from "../calculations";

const closeTo = (actual: number, expected: number) =>
  expect(actual).toBeCloseTo(expected, 6);

describe("financial calculation primitives", () => {
  it("reproduces the normal golden EVM and forecast results", () => {
    const testCase = golden.cases.find((item) => item.id === "normal-performance");
    if (!testCase) throw new Error("missing_golden_case");
    const input = testCase.inputs as {
      bac: number;
      pv: number;
      ev: number;
      ac: number;
      bottom_up_etc: number;
      pm_etc: number;
    };
    const expected = testCase.expected as unknown as Record<string, number>;
    const snapshot = computeEvmSnapshot(input);
    const forecasts = computeDeterministicForecasts({
      ...input,
      bottomUpEtc: input.bottom_up_etc,
      pmEtc: input.pm_etc,
    });
    expect(snapshot.cpi.status).toBe("available");
    expect(snapshot.spi.status).toBe("available");
    expect(snapshot.cv.status).toBe("available");
    expect(snapshot.sv.status).toBe("available");
    if (
      snapshot.cpi.status !== "available" ||
      snapshot.spi.status !== "available" ||
      snapshot.cv.status !== "available" ||
      snapshot.sv.status !== "available" ||
      forecasts.cpiEac.status !== "available" ||
      forecasts.cpiSpiEac.status !== "available" ||
      forecasts.bottomUpEac.status !== "available" ||
      forecasts.pmEac.status !== "available"
    ) throw new Error("expected_available_metrics");
    closeTo(snapshot.cpi.value, expected.cpi);
    closeTo(snapshot.spi.value, expected.spi);
    closeTo(snapshot.cv.value, expected.cv);
    closeTo(snapshot.sv.value, expected.sv);
    closeTo(forecasts.cpiEac.value, expected.cpi_eac);
    closeTo(forecasts.cpiSpiEac.value, expected.cpi_spi_eac);
    closeTo(forecasts.bottomUpEac.value, expected.bottom_up_eac);
    closeTo(forecasts.pmEac.value, expected.pm_eac);
  });

  it("keeps missing EV unavailable instead of coercing it to zero", () => {
    const result = computeEvmSnapshot({ bac: 1000, pv: 250, ev: null, ac: 100 });
    expect(result.quality).toBe("incomplete");
    expect(result.cpi).toEqual({
      status: "unavailable",
      value: null,
      reason: "missing_ev_evidence",
    });
  });

  it("does not produce infinite CPI or SPI for zero denominators", () => {
    const result = computeEvmSnapshot({ bac: 1000, pv: 0, ev: 0, ac: 0 });
    expect(result.cpi).toMatchObject({ status: "unavailable", reason: "ac_not_positive" });
    expect(result.spi).toMatchObject({ status: "unavailable", reason: "pv_not_positive" });
  });

  it("marks TCPI to BAC unavailable when the target cost is already consumed", () => {
    expect(computeTcpi(1000, 800, 1100, 1000)).toMatchObject({
      status: "unavailable",
      reason: "target_cost_not_positive",
    });
  });

  it("reproduces approved weighted P50, P80 and mean", () => {
    const testCase = golden.cases.find((item) => item.id === "weighted-probabilistic-eac");
    if (!testCase) throw new Error("missing_golden_case");
    const raw = testCase.inputs as {
      joint_outcomes: Array<{ probability: number; eac: number }>;
    };
    const expected = testCase.expected as {
      p50_eac: number;
      p80_eac: number;
      mean_eac: number;
    };
    expect(weightedQuantile(raw.joint_outcomes, 0.5)).toEqual({
      status: "available",
      value: expected.p50_eac,
    });
    expect(weightedQuantile(raw.joint_outcomes, 0.8)).toEqual({
      status: "available",
      value: expected.p80_eac,
    });
    expect(weightedMean(raw.joint_outcomes)).toEqual({
      status: "available",
      value: expected.mean_eac,
    });
  });

  it("rejects undocumented probability totals", () => {
    expect(weightedQuantile([{ probability: 0.5, eac: 100 }], 0.8)).toMatchObject({
      status: "unavailable",
      reason: "probability_total_not_one",
    });
  });
});
