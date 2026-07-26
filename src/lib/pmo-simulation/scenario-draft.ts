// ============================================================================
// PMO Simulation — scenario draft state (CAP-049 §6, UI layer)
// ============================================================================
// The scenario a user is BUILDING, expressed as pure data plus pure transitions.
//
// This module exists because configuration moved out of the right rail and into
// a modal. A modal unmounts its contents when it closes, so if the draft lived
// in the modal's own component state, closing the dialog without running would
// silently destroy the user's work. The draft therefore lives OUTSIDE the modal
// and the modal only renders it.
//
// Nothing here decides what a number means: the engine in `engine.ts` validates
// and computes. These functions only rearrange the user's intent so the two
// concerns — "what am I asking?" and "what is the answer?" — can live on two
// different surfaces without one clobbering the other.
// ============================================================================

import type {
  SimIntervention,
  SimInterventionKind,
  SimScenario,
} from "./contracts";

/**
 * A scenario in construction.
 *
 * Deliberately NOT a `SimScenario`: a draft has no baseline, no run and no
 * server identity until it is saved. Conflating the two is how a half-typed
 * form ends up looking like a persisted, trustworthy scenario.
 */
export interface ScenarioDraft {
  /** Server id once saved; null while the draft has never been persisted. */
  scenarioId: string | null;
  name: string;
  description: string;
  /** Empty means the whole portfolio — the engine reads it that way. */
  projectIds: string[];
  horizonDays: number | null;
  interventions: SimIntervention[];
}

export const EMPTY_DRAFT: ScenarioDraft = {
  scenarioId: null,
  name: "",
  description: "",
  projectIds: [],
  horizonDays: null,
  interventions: [],
};

/** Fallback name used when a user runs an unnamed scenario. */
export const UNTITLED_SCENARIO = "Untitled scenario";

/**
 * Local ids for interventions that exist only in the browser.
 *
 * A counter, not a random uuid, so a test can assert on the produced shape.
 * The engine never reads these ids as domain identity — it re-derives outcome
 * ids from the persisted rows once a scenario is saved.
 */
let localIdCounter = 0;
export function nextLocalInterventionId(): string {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

/** Test seam: resets the counter so ids are predictable per test case. */
export function resetLocalInterventionIds(): void {
  localIdCounter = 0;
}

/** A new, empty intervention of the requested kind, ready to be filled in. */
export function blankIntervention(
  kind: SimInterventionKind,
  order: number,
): SimIntervention {
  const base = {
    id: nextLocalInterventionId(),
    order,
    enabled: true,
    label: "",
    note: null,
  };
  switch (kind) {
    case "budget":
      return {
        ...base,
        kind,
        target: { kind: "project", id: "" },
        amountDelta: null,
        percentDelta: null,
        category: null,
        effectiveDate: null,
      };
    case "schedule":
      return {
        ...base,
        kind,
        target: { kind: "task", id: "" },
        delayDays: null,
        newStartDate: null,
        newEndDate: null,
        newDurationDays: null,
      };
    case "resource":
      return {
        ...base,
        kind,
        target: { kind: "resource", id: "" },
        availabilityPercent: null,
        weeklyHoursDelta: null,
        periodStart: null,
        periodEnd: null,
      };
    case "risk":
      return {
        ...base,
        kind,
        target: { kind: "risk", id: "" },
        action: "mitigate_partial",
        reductionPercent: null,
        assumedCostImpact: null,
        assumedDelayDays: null,
      };
  }
}

/**
 * Renumbers `order` to match array position.
 *
 * `order` is what the engine applies interventions by, so it must never drift
 * from what the user sees on screen after a move or a delete.
 */
function reindex(interventions: SimIntervention[]): SimIntervention[] {
  return interventions.map((item, index) => ({ ...item, order: index }));
}

export function addIntervention(
  draft: ScenarioDraft,
  kind: SimInterventionKind,
): ScenarioDraft {
  return {
    ...draft,
    interventions: [
      ...draft.interventions,
      blankIntervention(kind, draft.interventions.length),
    ],
  };
}

export function updateIntervention(
  draft: ScenarioDraft,
  index: number,
  next: SimIntervention,
): ScenarioDraft {
  if (index < 0 || index >= draft.interventions.length) return draft;
  return {
    ...draft,
    interventions: draft.interventions.map((item, i) => (i === index ? next : item)),
  };
}

export function removeIntervention(draft: ScenarioDraft, index: number): ScenarioDraft {
  if (index < 0 || index >= draft.interventions.length) return draft;
  return {
    ...draft,
    interventions: reindex(draft.interventions.filter((_, i) => i !== index)),
  };
}

/** Moves one intervention up (-1) or down (+1). Out-of-range moves are no-ops. */
export function moveIntervention(
  draft: ScenarioDraft,
  index: number,
  direction: -1 | 1,
): ScenarioDraft {
  const target = index + direction;
  if (
    index < 0 ||
    index >= draft.interventions.length ||
    target < 0 ||
    target >= draft.interventions.length
  ) {
    return draft;
  }
  const next = [...draft.interventions];
  [next[index], next[target]] = [next[target], next[index]];
  return { ...draft, interventions: reindex(next) };
}

/**
 * Why a draft cannot be run yet. Empty means it can.
 *
 * `intervention_without_target` is here because of a genuine hole: a blank
 * intervention starts with `target.id === ""`, and `parseInterventions` DROPS
 * an entry whose target does not resolve. Running in that state produced a
 * result computed from zero interventions while the form still showed one —
 * the user's change appeared to have had no effect, which is precisely the
 * outcome this module refuses to produce elsewhere (see `SimInterventionOutcome`,
 * kept and marked not-computable rather than dropped).
 *
 * Blocking here rather than in the engine is the right place for THIS case:
 * an unset dropdown is an unfinished sentence, not a scenario the engine could
 * have an opinion about. Genuine conflicts between two complete interventions
 * still go to the engine, which names what contradicts what.
 */
export type DraftBlocker = "no_enabled_intervention" | "intervention_without_target";

/** Ids of enabled interventions whose target has not been chosen. */
export function interventionsWithoutTarget(draft: ScenarioDraft): string[] {
  return draft.interventions
    .filter((intervention) => intervention.enabled && intervention.target.id.trim() === "")
    .map((intervention) => intervention.id);
}

export function draftBlockers(draft: ScenarioDraft): DraftBlocker[] {
  const blockers: DraftBlocker[] = [];
  if (!draft.interventions.some((intervention) => intervention.enabled)) {
    blockers.push("no_enabled_intervention");
  }
  if (interventionsWithoutTarget(draft).length > 0) {
    blockers.push("intervention_without_target");
  }
  return blockers;
}

/** A draft with nothing in it is not worth running, and the Run button says so. */
export function isRunnable(draft: ScenarioDraft): boolean {
  return draftBlockers(draft).length === 0;
}

/** Saving requires a name: an unnamed saved scenario cannot be found again. */
export function isSaveable(draft: ScenarioDraft): boolean {
  return draft.name.trim().length > 0;
}

/**
 * The payload the run/save server actions expect.
 *
 * The name is trimmed and defaulted here rather than in the component so that
 * "what gets sent" is a tested fact rather than an inline expression.
 */
export function toDraftPayload(draft: ScenarioDraft) {
  return {
    name: draft.name.trim() || UNTITLED_SCENARIO,
    description: draft.description.trim() ? draft.description : null,
    projectIds: draft.projectIds,
    horizonDays: draft.horizonDays,
    interventions: draft.interventions,
  };
}

/** Rehydrates a draft from a persisted scenario, for "edit an existing one". */
export function draftFromScenario(scenario: SimScenario | null | undefined): ScenarioDraft {
  if (!scenario) return EMPTY_DRAFT;
  return {
    scenarioId: scenario.id,
    name: scenario.name,
    description: scenario.description ?? "",
    projectIds: [...scenario.projectIds],
    horizonDays: scenario.horizonDays,
    interventions: [...scenario.interventions],
  };
}
