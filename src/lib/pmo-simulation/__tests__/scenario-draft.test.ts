// ============================================================================
// Scenario draft state — regression tests (CAP-049 §6)
// ============================================================================
// These protect the guarantee that motivated splitting configuration into a
// modal: the modal UNMOUNTS when it closes, so if the draft it edits were owned
// by the modal, dismissing the dialog would delete the user's scenario without
// warning. The draft is therefore plain data owned by the parent, and the tests
// below assert the two behaviours a user would notice if that broke:
//
//   1. Closing the builder without running keeps every value typed into it.
//   2. Running publishes a result and closes the builder, while the draft that
//      produced it stays intact for the next iteration.
// ============================================================================

import { beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  UNTITLED_SCENARIO,
  addIntervention,
  blankIntervention,
  draftFromScenario,
  isRunnable,
  isSaveable,
  moveIntervention,
  removeIntervention,
  resetLocalInterventionIds,
  toDraftPayload,
  updateIntervention,
  type ScenarioDraft,
} from "../scenario-draft";
import type { SimScenario, SimScheduleIntervention } from "../contracts";

beforeEach(() => {
  resetLocalInterventionIds();
});

describe("draft construction", () => {
  it("starts empty and is neither runnable nor saveable", () => {
    expect(EMPTY_DRAFT.interventions).toEqual([]);
    expect(isRunnable(EMPTY_DRAFT)).toBe(false);
    expect(isSaveable(EMPTY_DRAFT)).toBe(false);
  });

  it("creates each intervention kind with the right default target", () => {
    expect(blankIntervention("budget", 0).target.kind).toBe("project");
    expect(blankIntervention("schedule", 0).target.kind).toBe("task");
    expect(blankIntervention("resource", 0).target.kind).toBe("resource");
    expect(blankIntervention("risk", 0).target.kind).toBe("risk");
  });

  it("gives every intervention a distinct local id", () => {
    const ids = new Set(
      ["budget", "schedule", "resource", "risk"].map(
        (kind, index) => blankIntervention(kind as "budget", index).id,
      ),
    );
    expect(ids.size).toBe(4);
  });
});

describe("intervention list edits", () => {
  it("appends with a matching order", () => {
    let draft = addIntervention(EMPTY_DRAFT, "budget");
    draft = addIntervention(draft, "schedule");
    expect(draft.interventions.map((item) => item.order)).toEqual([0, 1]);
    expect(draft.interventions.map((item) => item.kind)).toEqual(["budget", "schedule"]);
  });

  it("renumbers order after a removal so the engine applies what is shown", () => {
    let draft = addIntervention(EMPTY_DRAFT, "budget");
    draft = addIntervention(draft, "schedule");
    draft = addIntervention(draft, "risk");
    draft = removeIntervention(draft, 1);
    expect(draft.interventions.map((item) => item.kind)).toEqual(["budget", "risk"]);
    expect(draft.interventions.map((item) => item.order)).toEqual([0, 1]);
  });

  it("reorders and renumbers on move", () => {
    let draft = addIntervention(EMPTY_DRAFT, "budget");
    draft = addIntervention(draft, "schedule");
    draft = moveIntervention(draft, 1, -1);
    expect(draft.interventions.map((item) => item.kind)).toEqual(["schedule", "budget"]);
    expect(draft.interventions.map((item) => item.order)).toEqual([0, 1]);
  });

  it("treats out-of-range moves and removals as no-ops", () => {
    const draft = addIntervention(EMPTY_DRAFT, "budget");
    expect(moveIntervention(draft, 0, -1)).toBe(draft);
    expect(moveIntervention(draft, 0, 1)).toBe(draft);
    expect(removeIntervention(draft, 5)).toBe(draft);
  });

  it("does not mutate the draft it is given", () => {
    const draft = addIntervention(EMPTY_DRAFT, "budget");
    const before = JSON.stringify(draft);
    addIntervention(draft, "risk");
    removeIntervention(draft, 0);
    moveIntervention(draft, 0, 1);
    expect(JSON.stringify(draft)).toBe(before);
  });

  it("only counts enabled interventions as runnable", () => {
    // A freshly added intervention has no target yet, and a target-less
    // intervention is DROPPED by the parser before it ever reaches the engine.
    // This test used to assert `isRunnable === true` right after adding one,
    // which pinned that hole in place: the run went ahead and reported a result
    // computed from zero interventions. Giving it a target first keeps the
    // question this test actually asks — does `enabled` gate the run — while no
    // longer certifying the bug. See draft-blockers.test.ts.
    const blank = addIntervention(EMPTY_DRAFT, "schedule");
    const draft = updateIntervention(blank, 0, {
      ...(blank.interventions[0] as SimScheduleIntervention),
      target: { kind: "task", id: "11111111-1111-1111-1111-111111111111" },
    });
    expect(isRunnable(draft)).toBe(true);
    const disabled = updateIntervention(draft, 0, {
      ...(draft.interventions[0] as SimScheduleIntervention),
      enabled: false,
    });
    expect(isRunnable(disabled)).toBe(false);
  });
});

// ── The behaviours the modal split is accountable for ──────────────────────

describe("the in-progress scenario survives closing the modal", () => {
  /**
   * Mirrors the component: the draft is state held ABOVE the modal, and the
   * modal is a boolean render gate over it. Closing the gate must not touch
   * the draft.
   */
  function makeHost() {
    let draft: ScenarioDraft = EMPTY_DRAFT;
    let open = false;
    return {
      get draft() {
        return draft;
      },
      get open() {
        return open;
      },
      openConfig: () => {
        open = true;
      },
      closeConfig: () => {
        open = false;
      },
      edit: (fn: (current: ScenarioDraft) => ScenarioDraft) => {
        draft = fn(draft);
      },
    };
  }

  it("keeps name, hypothesis and interventions after close and reopen", () => {
    const host = makeHost();
    host.openConfig();
    host.edit((current) => ({
      ...current,
      name: "Permit slips two weeks",
      description: "What does a delayed permit cost us?",
    }));
    host.edit((current) => addIntervention(current, "schedule"));
    host.edit((current) =>
      updateIntervention(current, 0, {
        ...(current.interventions[0] as SimScheduleIntervention),
        delayDays: 14,
      }),
    );

    // The user dismisses the dialog WITHOUT running.
    host.closeConfig();
    expect(host.open).toBe(false);

    // Nothing was lost.
    expect(host.draft.name).toBe("Permit slips two weeks");
    expect(host.draft.description).toBe("What does a delayed permit cost us?");
    expect(host.draft.interventions).toHaveLength(1);
    expect((host.draft.interventions[0] as SimScheduleIntervention).delayDays).toBe(14);

    // Reopening shows exactly the same scenario.
    host.openConfig();
    expect(host.open).toBe(true);
    expect(host.draft.interventions).toHaveLength(1);
  });
});

describe("running closes the modal and publishes results", () => {
  /** Mirrors the run transition in `simulation-panel.tsx`. */
  function makeHost(runOutcome: { ok: boolean }) {
    const state = {
      draft: addIntervention(EMPTY_DRAFT, "budget"),
      open: true,
      result: null as { affectedNodeIds: string[] } | null,
      error: null as string | null,
      published: [] as string[][],
    };
    return {
      state,
      run: () => {
        state.error = null;
        if (!runOutcome.ok) {
          // Failure keeps the builder open over the form that caused it.
          state.error = "sim_failed";
          return;
        }
        state.result = { affectedNodeIds: ["node-a", "node-b"] };
        state.open = false;
        state.published.push(state.result.affectedNodeIds);
      },
    };
  }

  it("closes the builder and pushes affected nodes on success", () => {
    const host = makeHost({ ok: true });
    host.run();
    expect(host.state.open).toBe(false);
    expect(host.state.result?.affectedNodeIds).toEqual(["node-a", "node-b"]);
    expect(host.state.published).toEqual([["node-a", "node-b"]]);
    // The scenario that produced the answer is still there to iterate on.
    expect(host.state.draft.interventions).toHaveLength(1);
  });

  it("keeps the builder open and the scenario intact on failure", () => {
    const host = makeHost({ ok: false });
    host.run();
    expect(host.state.open).toBe(true);
    expect(host.state.result).toBeNull();
    expect(host.state.error).toBe("sim_failed");
    expect(host.state.draft.interventions).toHaveLength(1);
  });
});

describe("payload sent to the server", () => {
  it("trims the name and defaults an unnamed scenario", () => {
    const draft = addIntervention({ ...EMPTY_DRAFT, name: "   " }, "budget");
    expect(toDraftPayload(draft).name).toBe(UNTITLED_SCENARIO);
    expect(toDraftPayload({ ...draft, name: "  Tight cash  " }).name).toBe("Tight cash");
  });

  it("sends null rather than an empty hypothesis", () => {
    const draft = { ...EMPTY_DRAFT, description: "   " };
    expect(toDraftPayload(draft).description).toBeNull();
    expect(toDraftPayload({ ...draft, description: "why" }).description).toBe("why");
  });

  it("carries scope and horizon through untouched", () => {
    const draft: ScenarioDraft = {
      ...EMPTY_DRAFT,
      name: "n",
      projectIds: ["p1", "p2"],
      horizonDays: 90,
    };
    const payload = toDraftPayload(draft);
    expect(payload.projectIds).toEqual(["p1", "p2"]);
    expect(payload.horizonDays).toBe(90);
  });
});

describe("rehydrating a saved scenario for editing", () => {
  it("maps a persisted scenario onto an editable draft", () => {
    const scenario = {
      id: "scenario-1",
      organizationId: "org-1",
      name: "Saved one",
      description: null,
      projectIds: ["p1"],
      baselineAt: "2026-01-01T00:00:00Z",
      horizonDays: 30,
      state: "saved",
      interventions: [],
      createdBy: null,
      createdAt: null,
      updatedAt: null,
      lastRunAt: null,
    } satisfies SimScenario;

    const draft = draftFromScenario(scenario);
    expect(draft.scenarioId).toBe("scenario-1");
    expect(draft.name).toBe("Saved one");
    // A null description becomes an empty string: a textarea cannot hold null.
    expect(draft.description).toBe("");
    expect(draft.horizonDays).toBe(30);
    expect(isSaveable(draft)).toBe(true);
  });

  it("falls back to the empty draft when there is no scenario", () => {
    expect(draftFromScenario(null)).toEqual(EMPTY_DRAFT);
    expect(draftFromScenario(undefined)).toEqual(EMPTY_DRAFT);
  });
});
