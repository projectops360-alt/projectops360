// ============================================================================
// PMO Simulation — switching between scenarios (CAP-049 §6)
// ============================================================================
// A what-if surface holds three things that must move together: the draft being
// edited, the result on screen, and which metric is focused on the graph.
//
// Keeping them in three independent pieces of component state is how a surface
// ends up showing LAST scenario's numbers beside THIS scenario's form — and
// worse, leaving the previous run's nodes highlighted on the canvas, so the
// graph illustrates an answer nobody is looking at any more. Both transitions
// live here as pure functions precisely so that cannot drift.
//
// The panel had neither transition: once a scenario had been run you could only
// keep editing it. There was no way to start a second one, and no way to reopen
// a saved one — `listScenarios` and `getLastResult` existed on the server and
// nothing ever called them, so "Save" wrote a scenario the user could never
// open again.
// ============================================================================

import type { SimResult, SimScenario } from "./contracts";
import { EMPTY_DRAFT, draftFromScenario, type ScenarioDraft } from "./scenario-draft";

export interface SimulationSurfaceState {
  draft: ScenarioDraft;
  /** The result on screen, or null when there is nothing to show. */
  result: SimResult | null;
  /** Focused metric. Drives which nodes the graph highlights. */
  selectedMetric: string | null;
  /** Node ids the surface wants highlighted. Empty means "clear the canvas". */
  affectedNodeIds: string[];
}

/**
 * Start a blank scenario.
 *
 * Everything resets, including `affectedNodeIds`. Leaving those behind would
 * keep the previous run's nodes lit on a canvas whose panel now shows an empty
 * form — the graph asserting something the numbers no longer say.
 */
export function startNewScenario(): SimulationSurfaceState {
  return { draft: EMPTY_DRAFT, result: null, selectedMetric: null, affectedNodeIds: [] };
}

/**
 * Open a saved scenario, with the result of its last run when there is one.
 *
 * A scenario saved but never run legitimately has no result: it opens with the
 * form filled and the table empty, which is the truth. Fabricating a result by
 * re-running on load would silently measure against TODAY's baseline while the
 * user believes they are looking at what they saved.
 */
export function loadScenario(
  scenario: SimScenario,
  lastResult: SimResult | null,
): SimulationSurfaceState {
  return {
    draft: draftFromScenario(scenario),
    result: lastResult,
    selectedMetric: null,
    affectedNodeIds: lastResult?.affectedNodeIds ?? [],
  };
}

/** Label for the picker entry representing a draft that was never saved. */
export function isUnsavedDraft(draft: ScenarioDraft): boolean {
  return draft.scenarioId == null;
}

/**
 * Scenarios ordered for the picker: most recently touched first.
 *
 * A PMO comparing options wants the one they just left at the top, not the one
 * they created first. `updatedAt` falls back to `createdAt` so a row written
 * before the trigger existed still sorts sensibly instead of sinking to the end.
 */
export function orderScenariosForPicker(scenarios: readonly SimScenario[]): SimScenario[] {
  return [...scenarios].sort((a, b) => {
    const left = a.updatedAt ?? a.createdAt ?? "";
    const right = b.updatedAt ?? b.createdAt ?? "";
    if (left === right) return a.name.localeCompare(b.name);
    return right.localeCompare(left);
  });
}
