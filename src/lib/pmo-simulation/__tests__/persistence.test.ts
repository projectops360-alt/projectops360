// ============================================================================
// PMO Simulation — persistence guards (PMO-SIM-PERSIST-*)
// ============================================================================
// Serialization is pure, so it is tested directly. The DB-level guarantees
// (RLS, cross-org rejection) are enforced by the migration and asserted here
// against the migration text — a policy that is deleted or weakened in a future
// edit fails these tests rather than silently opening a tenant boundary.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  duplicateScenario,
  interventionsToJson,
  parseIntervention,
  parseInterventions,
  rowToScenario,
  type ScenarioRow,
} from "../serialization";
import type { SimIntervention, SimScenario } from "../contracts";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/20260862000000_pmo_simulation.sql"),
  "utf8",
);

const budgetIntervention: SimIntervention = {
  id: "i1",
  order: 0,
  enabled: true,
  label: "Add contingency",
  note: null,
  kind: "budget",
  target: { kind: "project", id: "p1" },
  amountDelta: 50_000,
  percentDelta: null,
  category: "contingency",
  effectiveDate: "2026-08-01",
};

const riskIntervention: SimIntervention = {
  id: "i2",
  order: 1,
  enabled: true,
  label: "Mitigate permit risk",
  note: "Assumed from vendor quote",
  kind: "risk",
  target: { kind: "risk", id: "r1" },
  action: "mitigate_partial",
  reductionPercent: 40,
  assumedCostImpact: 80_000,
  assumedDelayDays: 12,
};

function row(overrides: Partial<ScenarioRow> = {}): ScenarioRow {
  return {
    id: "s1",
    organization_id: "org1",
    name: "Scenario",
    description: "Hypothesis",
    project_ids: ["p1"],
    baseline_at: "2026-07-26T09:00:00.000Z",
    horizon_days: 90,
    state: "draft",
    interventions: [budgetIntervention, riskIntervention],
    last_run_at: null,
    created_by: "u1",
    created_at: "2026-07-26T09:00:00.000Z",
    updated_at: "2026-07-26T09:00:00.000Z",
    ...overrides,
  };
}

// ── PMO-SIM-PERSIST-ROUNDTRIP ───────────────────────────────────────────────

describe("PMO-SIM-PERSIST-ROUNDTRIP", () => {
  it("survives a save/reopen cycle without losing a field", () => {
    const json = interventionsToJson([budgetIntervention, riskIntervention]);
    const parsed = parseInterventions(json);
    expect(parsed).toEqual([budgetIntervention, riskIntervention]);
  });

  it("preserves assumed risk figures across the round trip", () => {
    const parsed = parseInterventions(interventionsToJson([riskIntervention]));
    const risk = parsed[0];
    expect(risk.kind).toBe("risk");
    if (risk.kind !== "risk") throw new Error("expected risk");
    expect(risk.assumedCostImpact).toBe(80_000);
    expect(risk.assumedDelayDays).toBe(12);
  });

  it("maps a DB row onto the typed scenario", () => {
    const scenario = rowToScenario(row());
    expect(scenario.id).toBe("s1");
    expect(scenario.projectIds).toEqual(["p1"]);
    expect(scenario.interventions).toHaveLength(2);
    expect(scenario.state).toBe("draft");
  });

  it("defaults an unknown state to draft rather than trusting it", () => {
    expect(rowToScenario(row({ state: "nonsense" })).state).toBe("draft");
  });

  it("treats a null project scope as the whole organization", () => {
    expect(rowToScenario(row({ project_ids: null })).projectIds).toEqual([]);
  });
});

// ── PMO-SIM-PERSIST-DEFENSIVE ───────────────────────────────────────────────

describe("PMO-SIM-PERSIST-DEFENSIVE", () => {
  it("drops an intervention with an unknown kind", () => {
    expect(parseIntervention({ kind: "telepathy", target: { kind: "task", id: "t1" } }, 0)).toBeNull();
  });

  it("drops an intervention with no resolvable target", () => {
    expect(parseIntervention({ kind: "budget", target: null }, 0)).toBeNull();
    expect(parseIntervention({ kind: "budget", target: { kind: "galaxy", id: "x" } }, 0)).toBeNull();
  });

  it("drops a risk intervention with an unknown action", () => {
    expect(
      parseIntervention(
        { kind: "risk", target: { kind: "risk", id: "r1" }, action: "wish_away" },
        0,
      ),
    ).toBeNull();
  });

  it("keeps the good interventions when one entry is corrupt", () => {
    const parsed = parseInterventions([budgetIntervention, { kind: "nonsense" }, riskIntervention]);
    expect(parsed.map((i) => i.id)).toEqual(["i1", "i2"]);
  });

  it("returns an empty list for a non-array payload", () => {
    expect(parseInterventions(null)).toEqual([]);
    expect(parseInterventions({ not: "an array" })).toEqual([]);
  });

  it("rejects a non-finite number rather than storing NaN", () => {
    const parsed = parseIntervention(
      { kind: "budget", target: { kind: "project", id: "p1" }, amountDelta: Number.NaN },
      0,
    );
    expect(parsed?.kind).toBe("budget");
    if (parsed?.kind !== "budget") throw new Error("expected budget");
    expect(parsed.amountDelta).toBeNull();
  });
});

// ── PMO-SIM-PERSIST-DUPLICATE ───────────────────────────────────────────────

describe("PMO-SIM-PERSIST-DUPLICATE", () => {
  const original: SimScenario = {
    ...rowToScenario(row()),
    state: "simulated",
    lastRunAt: "2026-07-26T10:00:00.000Z",
  };

  it("copies the interventions", () => {
    const copy = duplicateScenario(original, "s2", "Scenario (copy)", "2026-07-27T00:00:00.000Z");
    expect(copy.id).toBe("s2");
    expect(copy.name).toBe("Scenario (copy)");
    expect(copy.interventions).toEqual(original.interventions);
  });

  it("resets the copy to a draft with no run history", () => {
    const copy = duplicateScenario(original, "s2", "Copy", "2026-07-27T00:00:00.000Z");
    // Carrying the old result over would attach numbers from another baseline.
    expect(copy.state).toBe("draft");
    expect(copy.lastRunAt).toBeNull();
    expect(copy.baselineAt).toBe("2026-07-27T00:00:00.000Z");
  });

  it("deep-copies interventions so editing the copy cannot touch the original", () => {
    const copy = duplicateScenario(original, "s2", "Copy", "2026-07-27T00:00:00.000Z");
    const first = copy.interventions[0];
    if (first.kind !== "budget") throw new Error("expected budget");
    first.amountDelta = 1;

    const originalFirst = original.interventions[0];
    if (originalFirst.kind !== "budget") throw new Error("expected budget");
    expect(originalFirst.amountDelta).toBe(50_000);
  });
});

// ── PMO-SIM-PERSIST-RLS ─────────────────────────────────────────────────────

describe("PMO-SIM-PERSIST-RLS: the migration keeps the tenant boundary", () => {
  it("enables row level security on both tables", () => {
    expect(MIGRATION).toContain("ALTER TABLE public.pmo_simulation_scenarios ENABLE ROW LEVEL SECURITY");
    expect(MIGRATION).toContain("ALTER TABLE public.pmo_simulation_runs ENABLE ROW LEVEL SECURITY");
  });

  it("scopes every scenario policy through is_org_member", () => {
    for (const verb of ["read", "insert", "update", "delete"]) {
      expect(MIGRATION).toContain(`"Members ${verb} pmo_simulation_scenarios"`);
    }
    // Every member policy is gated on membership, never on a client-supplied id.
    const policyBlock = MIGRATION.slice(MIGRATION.indexOf("-- ── RLS"));
    const memberPolicies = policyBlock.match(/CREATE POLICY "Members [^"]+"/g) ?? [];
    expect(memberPolicies.length).toBeGreaterThanOrEqual(7);
    expect(policyBlock).toContain("public.is_org_member(organization_id)");
  });

  it("keeps a service_role escape hatch on both tables", () => {
    expect(MIGRATION).toContain('"Service role full access on pmo_simulation_scenarios"');
    expect(MIGRATION).toContain('"Service role full access on pmo_simulation_runs"');
  });

  it("rejects a scenario scoped to a project in another organization", () => {
    expect(MIGRATION).toContain("pmo_simulation_scenario_guard");
    expect(MIGRATION).toContain(
      "Simulation scope references a project outside the organization",
    );
    // The guard must run on UPDATE too — otherwise a scenario can be created
    // clean and then edited across the boundary.
    expect(MIGRATION).toContain("BEFORE INSERT OR UPDATE ON public.pmo_simulation_scenarios");
  });

  it("rejects a run whose organization differs from its scenario", () => {
    expect(MIGRATION).toContain("pmo_simulation_run_guard");
    expect(MIGRATION).toContain("Simulation run organization does not match its scenario");
  });
});

// ── PMO-SIM-PERSIST-READONLY ────────────────────────────────────────────────

describe("PMO-SIM-PERSIST-READONLY: saving never touches operational data", () => {
  it("creates no table other than the two simulation tables", () => {
    const created = [...MIGRATION.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map(
      (match) => match[1],
    );
    expect(created.sort()).toEqual(["pmo_simulation_runs", "pmo_simulation_scenarios"]);
  });

  it("adds no column to risks — assumed figures stay on the intervention", () => {
    // The whole hybrid exposure policy rests on `risks` gaining no cost or
    // duration column. A future ALTER here would make one user's assumption
    // look like everybody's data.
    //
    // Comments are stripped first: the migration DOCUMENTS this rule in prose,
    // and matching on the prose would fail the test for stating the very thing
    // it is enforcing.
    const executable = MIGRATION.replace(/^\s*--.*$/gm, "");
    expect(executable).not.toMatch(/ALTER TABLE\s+public\.risks/i);
    expect(executable.toLowerCase()).not.toContain("assumedcostimpact");
    expect(executable.toLowerCase()).not.toContain("assumeddelaydays");
  });

  it("writes to no operational table at all", () => {
    for (const table of [
      "projects",
      "roadmap_tasks",
      "milestones",
      "budget_items",
      "resources",
      "project_resource_allocations",
      "task_dependencies",
    ]) {
      expect(MIGRATION).not.toMatch(new RegExp(`ALTER TABLE\\s+public\\.${table}\\b`, "i"));
      expect(MIGRATION).not.toMatch(new RegExp(`UPDATE\\s+public\\.${table}\\b`, "i"));
      expect(MIGRATION).not.toMatch(new RegExp(`INSERT INTO\\s+public\\.${table}\\b`, "i"));
    }
  });
});
