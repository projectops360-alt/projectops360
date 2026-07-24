// ============================================================================
// PMO Process Intelligence — What-if simulation (CAP-047 · M7)
// ============================================================================
// Pure, NON-PERSISTENT scenario layer. It never touches real data: callers
// pass current read-model snapshots, the function returns a labeled
// current-vs-simulated comparison, and NOTHING is written anywhere.
// Persisting a decision requires the normal permissioned flows outside this
// module (declared limitation). Schedule simulation is not available yet —
// declared, not faked.
// ============================================================================

import type { PmoPiFinanceRow } from "./financial-overlay";
import type { PmoPiCapacityProjectSummary, PmoPiSystemicRisk } from "./overlays";

export interface WhatIfScenario {
  /** Added to each project's baseline (BAC) — positive or negative. */
  budgetDeltaByProject: Record<string, number>;
  /** Risks assumed closed/mitigated in the simulation. */
  excludedRiskIds: string[];
  /** Percentage points added to workforce availability (e.g. +10). */
  availabilityDeltaPct: number;
}

export const EMPTY_SCENARIO: WhatIfScenario = {
  budgetDeltaByProject: {},
  excludedRiskIds: [],
  availabilityDeltaPct: 0,
};

export interface WhatIfStateSnapshot {
  label: "current" | "simulated";
  totalBaseline: number;
  totalEac: number;
  totalVac: number;
  criticalRiskCount: number;
  systemicRiskCount: number;
  avgAvailabilityPct: number | null;
}

export interface WhatIfResult {
  current: WhatIfStateSnapshot;
  simulated: WhatIfStateSnapshot;
  assumptions: string[];
  limitations: string[];
}

export interface WhatIfInputs {
  financeRows: readonly PmoPiFinanceRow[];
  criticalRiskCount: number;
  systemicRisks: readonly PmoPiSystemicRisk[];
  capacity: readonly PmoPiCapacityProjectSummary[];
}

function snapshot(
  label: WhatIfStateSnapshot["label"],
  rows: readonly PmoPiFinanceRow[],
  criticalRiskCount: number,
  systemicCount: number,
  availability: readonly (number | null)[],
): WhatIfStateSnapshot {
  const withBaseline = rows.filter((r) => r.baseline != null);
  const withEac = rows.filter((r) => r.latestEac != null);
  const avail = availability.filter((a): a is number => a != null);
  return {
    label,
    totalBaseline: withBaseline.reduce((s, r) => s + (r.baseline ?? 0), 0),
    totalEac: withEac.reduce((s, r) => s + (r.latestEac ?? 0), 0),
    totalVac: rows.reduce((s, r) => s + (r.baseline != null && r.latestEac != null ? r.baseline - r.latestEac : 0), 0),
    criticalRiskCount,
    systemicRiskCount: systemicCount,
    avgAvailabilityPct: avail.length > 0 ? avail.reduce((s, a) => s + a, 0) / avail.length : null,
  };
}

/** Pure simulation: inputs are never mutated; nothing is persisted. */
export function simulateWhatIf(inputs: WhatIfInputs, scenario: WhatIfScenario): WhatIfResult {
  const currentAvailability = inputs.capacity
    .filter((c) => c.hasCapacityInputs)
    .map((c) => c.workforceAvailabilityPercent);

  const current = snapshot(
    "current",
    inputs.financeRows,
    inputs.criticalRiskCount,
    inputs.systemicRisks.length,
    currentAvailability,
  );

  // Budget: the delta moves the BAC; EAC is NOT changed by the scenario
  // (spending forecast stays), so VAC responds — that is the honest effect.
  const simulatedRows = inputs.financeRows.map((r) => {
    const delta = scenario.budgetDeltaByProject[r.projectId] ?? 0;
    return delta === 0 || r.baseline == null ? r : { ...r, baseline: r.baseline + delta };
  });

  const excluded = new Set(scenario.excludedRiskIds);
  const simulatedSystemic = inputs.systemicRisks.filter((s) => !excluded.has(s.riskId));
  const excludedCritical = inputs.systemicRisks.filter(
    (s) => excluded.has(s.riskId) && s.severity === "critical",
  ).length;
  const simulatedCritical = Math.max(0, inputs.criticalRiskCount - excludedCritical);

  const simulatedAvailability = currentAvailability.map((a) =>
    a == null ? null : Math.min(100, Math.max(0, a + scenario.availabilityDeltaPct)),
  );

  const simulated = snapshot(
    "simulated",
    simulatedRows,
    simulatedCritical,
    simulatedSystemic.length,
    simulatedAvailability,
  );

  return {
    current,
    simulated,
    assumptions: [
      "budget_delta_moves_bac_only_eac_unchanged",
      "excluded_risks_assumed_fully_mitigated",
      "availability_delta_applied_uniformly",
    ],
    limitations: [
      "simulation_is_ephemeral_never_persisted",
      "schedule_simulation_not_available_yet",
      "benefits_simulation_not_available_no_data_model",
    ],
  };
}
