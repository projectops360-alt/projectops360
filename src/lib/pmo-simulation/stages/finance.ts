// ============================================================================
// PMO Simulation — Stage: Finance / EVM (CAP-049 · stage 4)
// ============================================================================
// Turns the budget stage's new BAC into forecast consequences, using the pure
// EVM functions the financial module already owns. No EVM arithmetic is
// reimplemented here — CPI, EAC and VAC have exactly one definition in this
// product, and a second one living in the simulator would eventually disagree
// with the finance screens on the same project.
//
// The stage only speaks when it has something to say. `computeEvmSnapshot`
// already returns `unavailable` with a reason when EV or AC is missing, and
// that state is passed straight through: a portfolio with no earned value gets
// "EAC unavailable — missing earned value", not a number derived from a budget
// total pretending to be a forecast.
//
// Note what does NOT happen here: a bigger BAC does not shrink a duration.
// This stage has no access to tasks. See `stages/budget.ts`.
// ============================================================================

import { computeDeterministicForecasts, computeEvmSnapshot } from "@/lib/financial/calculations";
import type { SimBaseline, SimWorkingCopy } from "../baseline";
import type { SimMetric } from "../contracts";

/** BAC per project after the budget stage, from the working copy's lines. */
function bacByProject(items: readonly { project_id: string; estimated_cost: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.project_id, (map.get(item.project_id) ?? 0) + (item.estimated_cost ?? 0));
  }
  return map;
}

/**
 * Portfolio EVM comparison.
 *
 * Only projects whose BAC actually moved are recomputed — an untouched project
 * contributes identically to both sides and would add noise to the delta.
 *
 * A project's EVM row supplies EV/AC/PV. Where `evm` has no row for a project
 * with a changed budget, that project is counted in `projectsWithoutEvm` and
 * excluded from the forecast metrics rather than defaulted to zero.
 */
export function financeMetrics(
  baseline: SimBaseline,
  working: SimWorkingCopy,
): { metrics: SimMetric[]; assumptions: string[] } {
  const assumptions: string[] = [];

  const baseBac = bacByProject(baseline.budgetItems);
  const simBac = bacByProject(working.budgetItems);

  const changed = [...simBac.keys()].filter(
    (projectId) => (baseBac.get(projectId) ?? 0) !== (simBac.get(projectId) ?? 0),
  );

  const metrics: SimMetric[] = [];

  // ── BAC: always knowable, it is a sum of rows we hold ───────────────────
  const baseTotal = [...baseBac.values()].reduce((sum, value) => sum + value, 0);
  const simTotal = [...simBac.values()].reduce((sum, value) => sum + value, 0);
  metrics.push({
    key: "portfolio_bac",
    unit: "currency",
    baseline: round2(baseTotal),
    simulated: round2(simTotal),
    delta: round2(simTotal - baseTotal),
    engine: "evm",
    provenance: "OBSERVED",
    unavailableReason: null,
  });

  if (changed.length === 0) {
    return { metrics, assumptions };
  }

  // ── EAC / VAC: only where earned value exists ───────────────────────────
  const evmByProject = new Map(baseline.evm.map((row) => [row.project_id, row]));
  const withoutEvm = changed.filter((projectId) => {
    const row = evmByProject.get(projectId);
    return row == null || row.ev == null || row.ac == null;
  });

  let baseEacTotal = 0;
  let simEacTotal = 0;
  let baseVacTotal = 0;
  let simVacTotal = 0;
  let computed = 0;

  for (const projectId of changed) {
    const row = evmByProject.get(projectId);
    if (!row || row.ev == null || row.ac == null) continue;

    const baseForecast = computeDeterministicForecasts({
      bac: baseBac.get(projectId) ?? null,
      ev: row.ev,
      ac: row.ac,
      pv: row.pv,
    });
    const simForecast = computeDeterministicForecasts({
      bac: simBac.get(projectId) ?? null,
      ev: row.ev,
      ac: row.ac,
      pv: row.pv,
    });

    // CPI-based EAC is the standard deterministic forecast and the only one
    // available without a bottom-up ETC, which this data set does not carry.
    if (baseForecast.cpiEac.status === "available" && simForecast.cpiEac.status === "available") {
      baseEacTotal += baseForecast.cpiEac.value;
      simEacTotal += simForecast.cpiEac.value;
      baseVacTotal += (baseBac.get(projectId) ?? 0) - baseForecast.cpiEac.value;
      simVacTotal += (simBac.get(projectId) ?? 0) - simForecast.cpiEac.value;
      computed += 1;
    }
  }

  if (computed === 0) {
    const reason = "no_project_with_changed_budget_has_earned_value";
    metrics.push(
      {
        key: "portfolio_eac",
        unit: "currency",
        baseline: null,
        simulated: null,
        delta: null,
        engine: "evm",
        provenance: "UNAVAILABLE",
        unavailableReason: reason,
      },
      {
        key: "portfolio_vac",
        unit: "currency",
        baseline: null,
        simulated: null,
        delta: null,
        engine: "evm",
        provenance: "UNAVAILABLE",
        unavailableReason: reason,
      },
    );
    return { metrics, assumptions };
  }

  assumptions.push("evm_forecast_uses_cpi_based_eac");
  if (withoutEvm.length > 0) {
    assumptions.push("evm_excluded_projects_without_earned_value");
  }
  // Where the earned value came from is not a detail: a forecast built on a
  // reporting-date measurement carries that date's assumptions with it.
  if (
    changed.some((projectId) => evmByProject.get(projectId)?.source === "measurement_snapshot")
  ) {
    assumptions.push("evm_inputs_read_from_financial_measurement_snapshot");
  }

  metrics.push(
    {
      key: "portfolio_eac",
      unit: "currency",
      baseline: round2(baseEacTotal),
      simulated: round2(simEacTotal),
      delta: round2(simEacTotal - baseEacTotal),
      engine: "evm",
      provenance: "OBSERVED",
      unavailableReason: null,
      // computeDeterministicForecasts returns four EAC variants; this stage
      // reads cpiEac. Reporting which one lets the glossary say "this is the
      // formula the engine used" instead of showing a default it cannot vouch
      // for. Same string as the assumption above, structured.
      formulaId: "eac_cpi",
    },
    {
      key: "portfolio_vac",
      unit: "currency",
      baseline: round2(baseVacTotal),
      simulated: round2(simVacTotal),
      delta: round2(simVacTotal - baseVacTotal),
      engine: "evm",
      provenance: "OBSERVED",
      unavailableReason: null,
      // VAC = BAC − EAC, so it inherits whichever EAC variant was used.
      formulaId: "vac_standard",
    },
  );

  // CPI itself is unchanged by a budget move — EV and AC are historical facts.
  // Reporting it makes that explicit, because the intuitive expectation is that
  // "more budget" improves the index, and it does not.
  const cpiInputs = changed
    .map((projectId) => evmByProject.get(projectId))
    .filter((row): row is NonNullable<typeof row> => row != null && row.ev != null && row.ac != null);
  if (cpiInputs.length > 0) {
    const totalEv = cpiInputs.reduce((sum, row) => sum + (row.ev ?? 0), 0);
    const totalAc = cpiInputs.reduce((sum, row) => sum + (row.ac ?? 0), 0);
    const snapshot = computeEvmSnapshot({ bac: simTotal, ev: totalEv, ac: totalAc, pv: null });
    if (snapshot.cpi.status === "available") {
      metrics.push({
        key: "portfolio_cpi",
        unit: "ratio",
        baseline: round2(snapshot.cpi.value),
        simulated: round2(snapshot.cpi.value),
        delta: 0,
        engine: "evm",
        provenance: "OBSERVED",
        unavailableReason: null,
      });
      assumptions.push("cpi_unchanged_budget_change_does_not_alter_past_performance");
    }
  }

  return { metrics, assumptions };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
