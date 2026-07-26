// ============================================================================
// CAP-049 — an intervention is never silently dropped
// Guard: PMO-SIM-NO-SILENT-DROP
// ============================================================================
// A blank intervention starts with `target.id === ""`. `parseInterventions`
// drops any entry whose target does not resolve, so running in that state used
// to produce a result computed from ZERO interventions while the form still
// showed one on screen — the user's change looked like it had had no effect.
//
// That is the exact outcome this module refuses everywhere else: a
// non-computable intervention is KEPT and explained, never removed. The Run
// button now blocks instead, and these tests pin both halves of the claim —
// that the parser really does drop it, and that the UI really does refuse.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  addIntervention,
  draftBlockers,
  interventionsWithoutTarget,
  isRunnable,
  isSaveable,
  updateIntervention,
  type ScenarioDraft,
} from "../scenario-draft";
import { parseInterventions } from "../serialization";
import { actionErrorKey } from "../presentation";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

/** A draft with one enabled schedule intervention and no target chosen. */
function draftWithBlankSchedule(): ScenarioDraft {
  return addIntervention({ ...EMPTY_DRAFT, name: "Retraso en tarea" }, "schedule");
}

describe("draft blockers (PMO-SIM-NO-SILENT-DROP)", () => {
  it("the parser really does drop a target-less intervention", () => {
    // The premise. If this ever stops being true the blocker is still correct,
    // but the justification in the comments would be stale.
    const draft = draftWithBlankSchedule();
    expect(draft.interventions).toHaveLength(1);
    expect(parseInterventions(draft.interventions)).toHaveLength(0);
  });

  it("a target-less intervention blocks the run", () => {
    const draft = draftWithBlankSchedule();
    expect(interventionsWithoutTarget(draft)).toEqual([draft.interventions[0].id]);
    expect(draftBlockers(draft)).toContain("intervention_without_target");
    expect(isRunnable(draft)).toBe(false);
  });

  it("choosing a target unblocks it", () => {
    const draft = draftWithBlankSchedule();
    const intervention = draft.interventions[0];
    const ready = updateIntervention(draft, 0, {
      ...intervention,
      target: { kind: "task", id: "11111111-1111-1111-1111-111111111111" },
    });
    expect(draftBlockers(ready)).toEqual([]);
    expect(isRunnable(ready)).toBe(true);
    expect(parseInterventions(ready.interventions)).toHaveLength(1);
  });

  it("a disabled intervention with no target does not block", () => {
    // It will not be sent to the engine, so an unfinished one is not an error.
    const draft = draftWithBlankSchedule();
    const off = updateIntervention(draft, 0, { ...draft.interventions[0], enabled: false });
    // Still blocked, but for the other reason: nothing enabled left to run.
    expect(draftBlockers(off)).toEqual(["no_enabled_intervention"]);
  });

  it("an empty draft reports only the missing intervention", () => {
    expect(draftBlockers(EMPTY_DRAFT)).toEqual(["no_enabled_intervention"]);
  });

  it("saving an incomplete draft is still allowed", () => {
    // Saving work in progress is legitimate; only RUNNING needs completeness.
    expect(isSaveable(draftWithBlankSchedule())).toBe(true);
  });
});

describe("action errors are translated (PMO-SIM-NO-RAW-ERROR-CODES)", () => {
  it("every action error code maps to a message key", () => {
    // The codes come from SimActionError in commands.server.ts.
    for (const code of ["not_authenticated", "not_authorized", "not_found", "invalid_input"]) {
      expect(actionErrorKey(code)).not.toBe("errors.unexpected");
    }
    expect(actionErrorKey("unexpected")).toBe("errors.unexpected");
  });

  it("an unknown code falls back rather than leaking the identifier", () => {
    expect(actionErrorKey("some_future_code")).toBe("errors.unexpected");
    expect(actionErrorKey(null)).toBe("errors.unexpected");
  });

  it("both surfaces translate instead of printing the raw code", () => {
    // The panel and the modal each rendered `{error}` directly, so a user saw
    // the literal word "unexpected" — a developer's string in a red box.
    for (const file of [
      "src/components/pmo-simulation/simulation-panel.tsx",
      "src/components/pmo-simulation/scenario-config-modal.tsx",
    ]) {
      expect(source(file)).toContain("t(actionErrorKey(error))");
    }
  });

  it("the server records the cause it does not send to the client", () => {
    // The generic code is correct at the boundary; losing the cause is not.
    const commands = source("src/lib/pmo-simulation/commands.server.ts");
    expect(commands).not.toMatch(/\} catch \{\s*\n\s*return \{ error: "unexpected" \}/);
    expect(commands).toContain("[pmo-simulation]");
  });

  it("the messages exist in both locales", () => {
    const en = JSON.parse(source("messages/en.json")) as Record<string, Record<string, unknown>>;
    const es = JSON.parse(source("messages/es.json")) as Record<string, Record<string, unknown>>;
    const enErrors = en.pmoSimulation.errors as Record<string, string>;
    const esErrors = es.pmoSimulation.errors as Record<string, string>;
    expect(Object.keys(enErrors).sort()).toEqual(Object.keys(esErrors).sort());
    expect(Object.keys(enErrors)).toContain("unexpected");
    for (const key of ["blockerNoIntervention", "blockerMissingTarget", "missingTarget"]) {
      expect(en.pmoSimulation[key]).toBeTruthy();
      expect(es.pmoSimulation[key]).toBeTruthy();
    }
  });
});
