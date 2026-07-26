// ============================================================================
// CAP-049 — a what-if surface holds more than one scenario
// Guard: PMO-SIM-MULTIPLE-SCENARIOS
// ============================================================================
// Reported: after running a scenario there was no way to start another one. The
// panel offered Edit, Re-run, Duplicate and Delete — every path led back to the
// same scenario. Comparing options is the entire activity of a what-if surface.
//
// The deeper half of the same defect: `listScenarios` and `getLastResult`
// existed on the server, the tables stored the rows, and NOTHING in the UI ever
// called them. "Save" wrote a scenario the user could never open again, and
// every run wrote a `last_result` nothing ever read.
//
// The transitions are pure so the failure they prevent cannot come back: a
// surface showing the previous scenario's numbers, or leaving its nodes lit on
// the canvas, beside a form that now holds something else.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SimResult, SimScenario } from "../contracts";
import {
  isUnsavedDraft,
  loadScenario,
  orderScenariosForPicker,
  startNewScenario,
} from "../surface-state";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

function scenario(overrides: Partial<SimScenario> = {}): SimScenario {
  return {
    id: "s1",
    organizationId: "org1",
    name: "Retraso del permiso",
    description: null,
    projectIds: [],
    baselineAt: "2026-07-26T00:00:00.000Z",
    horizonDays: null,
    state: "saved",
    interventions: [],
    createdBy: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    lastRunAt: null,
    ...overrides,
  };
}

const storedResult = {
  scenarioId: "s1",
  baselineAt: "2026-07-26T00:00:00.000Z",
  ranAt: "2026-07-26T10:00:00.000Z",
  metrics: [],
  outcomes: [],
  issues: [],
  assumptions: [],
  causalChains: [],
  coverage: { availableSources: [], unavailableSources: [], unresolvedTargets: [] },
  affectedNodeIds: ["task:t1", "milestone:m1"],
} as SimResult;

describe("scenario switching (PMO-SIM-MULTIPLE-SCENARIOS)", () => {
  it("a new scenario clears the result", () => {
    const next = startNewScenario();
    expect(next.result).toBeNull();
    expect(next.draft.interventions).toHaveLength(0);
    expect(next.draft.scenarioId).toBeNull();
    expect(next.draft.name).toBe("");
  });

  it("a new scenario also clears the canvas", () => {
    // The failure this prevents: an empty form beside a graph still lit with
    // the previous run's blast radius, asserting something nothing says.
    expect(startNewScenario().affectedNodeIds).toEqual([]);
    expect(startNewScenario().selectedMetric).toBeNull();
  });

  it("opening a saved scenario restores its last result", () => {
    const next = loadScenario(scenario(), storedResult);
    expect(next.draft.scenarioId).toBe("s1");
    expect(next.draft.name).toBe("Retraso del permiso");
    expect(next.result).toBe(storedResult);
  });

  it("opening a scenario relights exactly the nodes its run touched", () => {
    expect(loadScenario(scenario(), storedResult).affectedNodeIds).toEqual([
      "task:t1",
      "milestone:m1",
    ]);
  });

  it("a saved but never-run scenario opens with no result", () => {
    // The truth, and better than fabricating one by re-running on open: that
    // would measure against today's baseline while the user believes they are
    // looking at what they saved.
    const next = loadScenario(scenario({ lastRunAt: null }), null);
    expect(next.result).toBeNull();
    expect(next.affectedNodeIds).toEqual([]);
    expect(next.draft.name).toBe("Retraso del permiso");
  });

  it("the picker lists the most recently touched scenario first", () => {
    const ordered = orderScenariosForPicker([
      scenario({ id: "old", name: "A", updatedAt: "2026-07-01T00:00:00.000Z" }),
      scenario({ id: "new", name: "B", updatedAt: "2026-07-26T00:00:00.000Z" }),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(["new", "old"]);
  });

  it("a scenario with no updatedAt falls back to createdAt rather than sinking", () => {
    const ordered = orderScenariosForPicker([
      scenario({ id: "a", updatedAt: "2026-07-10T00:00:00.000Z" }),
      scenario({ id: "b", updatedAt: null, createdAt: "2026-07-20T00:00:00.000Z" }),
    ]);
    expect(ordered[0].id).toBe("b");
  });

  it("ordering does not mutate the input", () => {
    const input = [scenario({ id: "a" }), scenario({ id: "b", updatedAt: "2027-01-01T00:00:00Z" })];
    const before = input.map((entry) => entry.id);
    orderScenariosForPicker(input);
    expect(input.map((entry) => entry.id)).toEqual(before);
  });

  it("an unsaved draft is recognisable", () => {
    expect(isUnsavedDraft(startNewScenario().draft)).toBe(true);
    expect(isUnsavedDraft(loadScenario(scenario(), null).draft)).toBe(false);
  });

  it("the panel actually offers a new scenario and opens saved ones", () => {
    // The whole point. Without these the pure transitions above are dead code.
    const panel = source("src/components/pmo-simulation/simulation-panel.tsx");
    expect(panel).toContain("listScenariosAction");
    expect(panel).toContain("getScenarioAction");
    expect(panel).toContain("startNewScenario");
    expect(panel).toContain("loadScenario");
  });

  it("the server hands back the stored result when a scenario is opened", () => {
    const commands = source("src/lib/pmo-simulation/commands.server.ts");
    expect(commands).toContain("getLastResult");
  });
});
