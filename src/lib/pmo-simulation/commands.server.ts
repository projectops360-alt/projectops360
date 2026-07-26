"use server";

// ============================================================================
// PMO Simulation — commands (CAP-049)
// ============================================================================
// Every action is gated independently. `canAccessPmoLivingGraph` guards the
// ROUTE; a server action reached directly from a client bundle is a second door
// into the same data and has to be gated again — route gates are not action
// gates (the same reasoning as `pmo-intelligence/commands.server.ts`).
//
// The organization ALWAYS comes from the session. No action accepts an
// organization id from the caller, so a client cannot aim a scenario at another
// tenant even before RLS and the DB trigger get their turn.
//
// None of these actions writes to an operational table. The engine is pure and
// the read model's only writes target `pmo_simulation_*`.
// ============================================================================

import { getOrgContext } from "@/lib/auth";
import { canAccessPmoLivingGraph } from "@/lib/pmo-living-graph/flags";
import type { Locale } from "@/types/database";
import { simulate } from "./engine";
import { loadSimulationBaseline, getScenario, getLastResult, listScenarios, recordRun, saveScenario, deleteScenario } from "./read-model.server";
import { duplicateScenario, parseInterventions } from "./serialization";
import type { SimResult, SimScenario } from "./contracts";

export type SimActionError =
  | "not_authenticated"
  | "not_authorized"
  | "not_found"
  | "invalid_input"
  | "unexpected";

interface Gate {
  organizationId: string;
  userId: string;
}

async function gate(): Promise<{ ok: Gate } | { error: SimActionError }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  if (!canAccessPmoLivingGraph(org.role)) return { error: "not_authorized" };
  return { ok: { organizationId: org.organizationId, userId: org.userId } };
}

// ── Run ─────────────────────────────────────────────────────────────────────

export interface RunSimulationInput {
  /** Saved scenario to run, when it already exists. */
  scenarioId?: string;
  /** Unsaved scenario definition, for a draft that has never been persisted. */
  draft?: {
    name: string;
    description: string | null;
    projectIds: string[];
    horizonDays: number | null;
    interventions: unknown;
  };
  locale: string;
}

export interface RunSimulationResult {
  error?: SimActionError;
  result?: SimResult;
  /** Echoed back so the client can show what was actually run. */
  scenario?: SimScenario;
}

/**
 * Capture a baseline and run the scenario against it.
 *
 * The baseline is read fresh on every run and stamped with the moment it was
 * captured. Reusing an older snapshot would let the comparison drift out of
 * date without anyone noticing that the "before" column had aged.
 */
export async function runSimulationAction(
  input: RunSimulationInput,
): Promise<RunSimulationResult> {
  const gated = await gate();
  if ("error" in gated) return { error: gated.error };
  const { organizationId, userId } = gated.ok;

  const locale: Locale = input.locale === "es" ? "es" : "en";
  const now = new Date().toISOString();

  try {
    let scenario: SimScenario | null = null;

    if (input.scenarioId) {
      scenario = await getScenario(organizationId, input.scenarioId);
      if (!scenario) return { error: "not_found" };
    } else if (input.draft) {
      if (!input.draft.name.trim()) return { error: "invalid_input" };
      scenario = {
        id: "draft",
        organizationId,
        name: input.draft.name,
        description: input.draft.description,
        projectIds: input.draft.projectIds,
        baselineAt: now,
        horizonDays: input.draft.horizonDays,
        state: "draft",
        // Parsed through the same defensive reader the DB path uses, so a
        // malformed intervention cannot reach the engine from the client either.
        interventions: parseInterventions(input.draft.interventions),
        createdBy: userId,
        createdAt: null,
        updatedAt: null,
        lastRunAt: null,
      };
    } else {
      return { error: "invalid_input" };
    }

    const baseline = await loadSimulationBaseline(
      organizationId,
      locale,
      now,
      scenario.projectIds,
    );

    const result = simulate(scenario, baseline, { ranAt: now });

    // Only a persisted scenario gets a run row; a draft has nothing to attach
    // history to.
    if (input.scenarioId) {
      await recordRun(organizationId, input.scenarioId, scenario, result, userId);
    }

    return { result, scenario };
  } catch (thrown) {
    // A swallowed exception with no trace is undebuggable in dev and in
    // production alike: the user sees a generic message and nobody can
    // find out what actually failed. The code returned stays generic on
    // purpose — it crosses to the client — but the cause is recorded here.
    console.error("[pmo-simulation] runSimulationAction failed", thrown);
    return { error: "unexpected" };
  }
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function listScenariosAction(): Promise<{
  error?: SimActionError;
  scenarios?: SimScenario[];
}> {
  const gated = await gate();
  if ("error" in gated) return { error: gated.error };
  try {
    return { scenarios: await listScenarios(gated.ok.organizationId) };
  } catch (thrown) {
    // A swallowed exception with no trace is undebuggable in dev and in
    // production alike: the user sees a generic message and nobody can
    // find out what actually failed. The code returned stays generic on
    // purpose — it crosses to the client — but the cause is recorded here.
    console.error("[pmo-simulation] listScenariosAction failed", thrown);
    return { error: "unexpected" };
  }
}

/**
 * Open a saved scenario, together with the result of its last run.
 *
 * Both come back from one call because they are always wanted together:
 * reopening a scenario without showing what it produced leaves the user with a
 * filled form and an empty table, unable to tell whether it was ever run.
 *
 * The result is READ, never recomputed. Re-running on open would quietly
 * measure against today's baseline while the user believes they are looking at
 * what they saved.
 */
export async function getScenarioAction(
  scenarioId: string,
): Promise<{ error?: SimActionError; scenario?: SimScenario; result?: SimResult | null }> {
  const gated = await gate();
  if ("error" in gated) return { error: gated.error };
  try {
    const scenario = await getScenario(gated.ok.organizationId, scenarioId);
    if (!scenario) return { error: "not_found" };
    const result = await getLastResult(gated.ok.organizationId, scenarioId);
    return { scenario, result };
  } catch (thrown) {
    // A swallowed exception with no trace is undebuggable in dev and in
    // production alike: the user sees a generic message and nobody can
    // find out what actually failed. The code returned stays generic on
    // purpose — it crosses to the client — but the cause is recorded here.
    console.error("[pmo-simulation] getScenarioAction failed", thrown);
    return { error: "unexpected" };
  }
}

// ── Write (simulation tables only) ──────────────────────────────────────────

export interface SaveScenarioActionInput {
  id?: string;
  name: string;
  description: string | null;
  projectIds: string[];
  horizonDays: number | null;
  interventions: unknown;
  state?: "draft" | "saved";
}

/**
 * Create or update a scenario.
 *
 * Saving stores a QUESTION. It does not touch a project, task, risk, resource
 * or budget line — there is no code path from here to any of them, and V1 has
 * no "apply to project" by design.
 */
export async function saveScenarioAction(
  input: SaveScenarioActionInput,
): Promise<{ error?: SimActionError; id?: string }> {
  const gated = await gate();
  if ("error" in gated) return { error: gated.error };
  if (!input.name.trim()) return { error: "invalid_input" };

  try {
    const saved = await saveScenario({
      id: input.id,
      organizationId: gated.ok.organizationId,
      name: input.name.trim(),
      description: input.description,
      projectIds: input.projectIds,
      horizonDays: input.horizonDays,
      interventions: parseInterventions(input.interventions),
      state: input.state ?? "saved",
      userId: gated.ok.userId,
    });
    if (!saved) return { error: "unexpected" };
    return { id: saved.id };
  } catch (thrown) {
    // A swallowed exception with no trace is undebuggable in dev and in
    // production alike: the user sees a generic message and nobody can
    // find out what actually failed. The code returned stays generic on
    // purpose — it crosses to the client — but the cause is recorded here.
    console.error("[pmo-simulation] saveScenarioAction failed", thrown);
    return { error: "unexpected" };
  }
}

export async function duplicateScenarioAction(
  scenarioId: string,
  newName: string,
): Promise<{ error?: SimActionError; id?: string }> {
  const gated = await gate();
  if ("error" in gated) return { error: gated.error };

  try {
    const original = await getScenario(gated.ok.organizationId, scenarioId);
    if (!original) return { error: "not_found" };

    // The copy is a fresh draft against a fresh baseline; carrying the previous
    // result over would attach numbers measured against another snapshot.
    const copy = duplicateScenario(
      original,
      "new",
      newName.trim() || `${original.name} (copy)`,
      new Date().toISOString(),
    );

    const saved = await saveScenario({
      organizationId: gated.ok.organizationId,
      name: copy.name,
      description: copy.description,
      projectIds: copy.projectIds,
      horizonDays: copy.horizonDays,
      interventions: copy.interventions,
      state: "draft",
      userId: gated.ok.userId,
    });
    if (!saved) return { error: "unexpected" };
    return { id: saved.id };
  } catch (thrown) {
    // A swallowed exception with no trace is undebuggable in dev and in
    // production alike: the user sees a generic message and nobody can
    // find out what actually failed. The code returned stays generic on
    // purpose — it crosses to the client — but the cause is recorded here.
    console.error("[pmo-simulation] duplicateScenarioAction failed", thrown);
    return { error: "unexpected" };
  }
}

export async function deleteScenarioAction(
  scenarioId: string,
): Promise<{ error?: SimActionError; ok?: boolean }> {
  const gated = await gate();
  if ("error" in gated) return { error: gated.error };
  try {
    const ok = await deleteScenario(gated.ok.organizationId, scenarioId);
    return ok ? { ok } : { error: "unexpected" };
  } catch (thrown) {
    // A swallowed exception with no trace is undebuggable in dev and in
    // production alike: the user sees a generic message and nobody can
    // find out what actually failed. The code returned stays generic on
    // purpose — it crosses to the client — but the cause is recorded here.
    console.error("[pmo-simulation] deleteScenarioAction failed", thrown);
    return { error: "unexpected" };
  }
}
