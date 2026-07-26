// ============================================================================
// PMO Simulation — persistence serialization (CAP-049 §5)
// ============================================================================
// Pure translation between the typed contracts and the JSONB stored in
// `pmo_simulation_scenarios.interventions`.
//
// Parsing is defensive on purpose. The column is JSONB, so a row can contain
// anything a previous version wrote — or anything a bug wrote. An intervention
// that does not parse is DROPPED rather than coerced: a half-understood
// intervention that still runs would produce a number nobody can trace back to
// what the user actually asked for.
// ============================================================================

import {
  SIM_INTERVENTION_KINDS,
  type SimIntervention,
  type SimInterventionKind,
  type SimRiskAction,
  type SimScenario,
  type SimScenarioState,
  type SimTarget,
  type SimTargetKind,
} from "./contracts";

const TARGET_KINDS: readonly SimTargetKind[] = [
  "project",
  "milestone",
  "task",
  "resource",
  "risk",
];

const RISK_ACTIONS: readonly SimRiskAction[] = [
  "reduce_probability",
  "reduce_impact",
  "mitigate_partial",
  "mitigate_full",
  "materialize",
];

type Raw = Record<string, unknown>;

const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

function parseTarget(value: unknown): SimTarget | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Raw;
  const kind = str(raw.kind);
  const id = str(raw.id);
  if (!kind || !id) return null;
  if (!TARGET_KINDS.includes(kind as SimTargetKind)) return null;
  return { kind: kind as SimTargetKind, id };
}

/** One intervention, or null when it cannot be trusted. */
export function parseIntervention(value: unknown, index: number): SimIntervention | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Raw;

  const kind = str(raw.kind);
  if (!kind || !SIM_INTERVENTION_KINDS.includes(kind as SimInterventionKind)) return null;

  const target = parseTarget(raw.target);
  if (!target) return null;

  const base = {
    id: str(raw.id) ?? `intervention-${index}`,
    order: num(raw.order) ?? index,
    enabled: bool(raw.enabled, true),
    label: str(raw.label) ?? "",
    note: str(raw.note),
  };

  switch (kind as SimInterventionKind) {
    case "budget":
      return {
        ...base,
        kind: "budget",
        target,
        amountDelta: num(raw.amountDelta),
        percentDelta: num(raw.percentDelta),
        category: str(raw.category),
        effectiveDate: str(raw.effectiveDate),
      };
    case "schedule":
      return {
        ...base,
        kind: "schedule",
        target,
        delayDays: num(raw.delayDays),
        newStartDate: str(raw.newStartDate),
        newEndDate: str(raw.newEndDate),
        newDurationDays: num(raw.newDurationDays),
      };
    case "resource":
      return {
        ...base,
        kind: "resource",
        target,
        availabilityPercent: num(raw.availabilityPercent),
        weeklyHoursDelta: num(raw.weeklyHoursDelta),
        periodStart: str(raw.periodStart),
        periodEnd: str(raw.periodEnd),
      };
    case "risk": {
      const action = str(raw.action);
      if (!action || !RISK_ACTIONS.includes(action as SimRiskAction)) return null;
      return {
        ...base,
        kind: "risk",
        target,
        action: action as SimRiskAction,
        reductionPercent: num(raw.reductionPercent),
        // These stay on the intervention. They are never written to `risks`.
        assumedCostImpact: num(raw.assumedCostImpact),
        assumedDelayDays: num(raw.assumedDelayDays),
      };
    }
  }
}

/** Parse a stored intervention array, dropping entries that do not validate. */
export function parseInterventions(value: unknown): SimIntervention[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => parseIntervention(entry, index))
    .filter((entry): entry is SimIntervention => entry !== null);
}

/** A DB row as selected by the read model. */
export interface ScenarioRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  project_ids: string[] | null;
  baseline_at: string;
  horizon_days: number | null;
  state: string;
  interventions: unknown;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function rowToScenario(row: ScenarioRow): SimScenario {
  const state: SimScenarioState =
    row.state === "simulated" || row.state === "saved" ? row.state : "draft";
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    projectIds: row.project_ids ?? [],
    baselineAt: row.baseline_at,
    horizonDays: row.horizon_days,
    state,
    interventions: parseInterventions(row.interventions),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRunAt: row.last_run_at,
  };
}

/** Interventions as plain JSON for the JSONB column. */
export function interventionsToJson(interventions: readonly SimIntervention[]): unknown[] {
  return interventions.map((intervention) => ({ ...intervention }));
}

/**
 * Copy a scenario for "duplicate".
 *
 * The copy is always a fresh DRAFT with no run history. Carrying the previous
 * result across would attach numbers to a scenario that has not been run, and
 * those numbers would silently describe the original's baseline.
 */
export function duplicateScenario(
  scenario: SimScenario,
  newId: string,
  newName: string,
  baselineAt: string,
): SimScenario {
  return {
    ...scenario,
    id: newId,
    name: newName,
    state: "draft",
    baselineAt,
    interventions: scenario.interventions.map((intervention) => ({ ...intervention })),
    createdAt: null,
    updatedAt: null,
    lastRunAt: null,
  };
}
