import type {
  DeterministicForecastInput,
  DeterministicForecastResult,
  EvmSnapshotInput,
  EvmSnapshotResult,
  MetricResult,
  WeightedOutcome,
} from "./types";

const unavailable = (reason: string): MetricResult => ({
  status: "unavailable",
  value: null,
  reason,
});

const available = (value: number): MetricResult =>
  Number.isFinite(value) ? { status: "available", value } : unavailable("non_finite_result");

function validNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export function computeEvmSnapshot(input: EvmSnapshotInput): EvmSnapshotResult {
  if (!validNumber(input.ev)) {
    const missing = unavailable("missing_ev_evidence");
    return {
      cv: missing,
      sv: missing,
      cpi: missing,
      spi: missing,
      quality: "incomplete",
      limitations: ["earned_value_unavailable"],
    };
  }

  const cv = validNumber(input.ac) ? available(input.ev - input.ac) : unavailable("missing_ac");
  const sv = validNumber(input.pv) ? available(input.ev - input.pv) : unavailable("missing_pv");
  const cpi =
    !validNumber(input.ac) ? unavailable("missing_ac") :
    input.ac <= 0 ? unavailable("ac_not_positive") :
    available(input.ev / input.ac);
  const spi =
    !validNumber(input.pv) ? unavailable("missing_pv") :
    input.pv <= 0 ? unavailable("pv_not_positive") :
    available(input.ev / input.pv);

  return {
    cv,
    sv,
    cpi,
    spi,
    quality: validNumber(input.bac) && validNumber(input.pv) && validNumber(input.ac) ? "available" : "incomplete",
    limitations: ["spi_is_not_calendar_delay", "evm_does_not_establish_causality"],
  };
}

export function computeDeterministicForecasts(
  input: DeterministicForecastInput,
): DeterministicForecastResult {
  const snapshot = computeEvmSnapshot(input);
  const missingBase =
    !validNumber(input.bac) || !validNumber(input.ev) || !validNumber(input.ac);

  const bottomUpEac =
    validNumber(input.ac) && validNumber(input.bottomUpEtc ?? null)
      ? available(input.ac + (input.bottomUpEtc as number))
      : unavailable("missing_bottom_up_etc");
  const pmEac =
    validNumber(input.ac) && validNumber(input.pmEtc ?? null)
      ? available(input.ac + (input.pmEtc as number))
      : unavailable("missing_pm_etc");

  if (missingBase) {
    const missing = unavailable("missing_forecast_inputs");
    return {
      bottomUpEac,
      cpiEtc: missing,
      cpiEac: missing,
      cpiSpiEtc: missing,
      cpiSpiEac: missing,
      pmEac,
    };
  }

  const remaining = (input.bac as number) - (input.ev as number);
  const cpiEtc =
    snapshot.cpi.status === "available" && snapshot.cpi.value > 0
      ? available(remaining / snapshot.cpi.value)
      : unavailable("cpi_not_positive");
  const cpiEac =
    cpiEtc.status === "available"
      ? available((input.ac as number) + cpiEtc.value)
      : unavailable(cpiEtc.reason);
  const efficiency =
    snapshot.cpi.status === "available" && snapshot.spi.status === "available"
      ? snapshot.cpi.value * snapshot.spi.value
      : null;
  const cpiSpiEtc =
    efficiency !== null && efficiency > 0
      ? available(remaining / efficiency)
      : unavailable("cpi_spi_not_positive");
  const cpiSpiEac =
    cpiSpiEtc.status === "available"
      ? available((input.ac as number) + cpiSpiEtc.value)
      : unavailable(cpiSpiEtc.reason);

  return { bottomUpEac, cpiEtc, cpiEac, cpiSpiEtc, cpiSpiEac, pmEac };
}

export function computeTcpi(
  bac: number | null,
  ev: number | null,
  ac: number | null,
  targetCost: number | null,
): MetricResult {
  if (![bac, ev, ac, targetCost].every(validNumber)) return unavailable("missing_tcpi_inputs");
  const denominator = (targetCost as number) - (ac as number);
  if (denominator <= 0) return unavailable("target_cost_not_positive");
  return available(((bac as number) - (ev as number)) / denominator);
}

export function weightedQuantile(outcomes: WeightedOutcome[], quantile: number): MetricResult {
  if (!(quantile >= 0 && quantile <= 1) || outcomes.length === 0) {
    return unavailable("invalid_quantile_inputs");
  }
  if (outcomes.some((item) => item.probability < 0 || !Number.isFinite(item.eac))) {
    return unavailable("invalid_distribution");
  }
  const total = outcomes.reduce((sum, item) => sum + item.probability, 0);
  if (Math.abs(total - 1) > 0.000001) return unavailable("probability_total_not_one");

  let cumulative = 0;
  for (const item of [...outcomes].sort((left, right) => left.eac - right.eac)) {
    cumulative += item.probability;
    if (cumulative + Number.EPSILON >= quantile) return available(item.eac);
  }
  return unavailable("quantile_not_reached");
}

export function weightedMean(outcomes: WeightedOutcome[]): MetricResult {
  const total = outcomes.reduce((sum, item) => sum + item.probability, 0);
  if (outcomes.length === 0 || Math.abs(total - 1) > 0.000001) {
    return unavailable("probability_total_not_one");
  }
  return available(outcomes.reduce((sum, item) => sum + item.probability * item.eac, 0));
}
