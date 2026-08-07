// ============================================================================
// A KPI pinned to a milestone — and the three answers it can give
// ============================================================================
// Guard: MILESTONE-KPI-PINS
//
// A pin stores a slug, so resolution has three outcomes and each must stay
// distinguishable on a card:
//
//   ok              → the number
//   not_computable  → the scope cannot answer (no rate, no budget, no tasks)
//   missing         → the custom KPI behind the slug was deleted
//
// Collapsing any two of these is how a card starts lying: "not computable"
// rendered as 0 says the phase scored zero, and "missing" rendered as nothing
// silently drops a measure the PM chose to be held to.
// ============================================================================

import { describe, it, expect } from "vitest";
import { evaluatePinnedKpi, pinnableKpis, resolvePinnedKpi, MAX_PINS_PER_MILESTONE } from "../milestone-pins";
import { buildKpiDataset, type KpiTaskRow } from "../build-dataset";
import type { CustomKpiDefinition } from "../custom";

const NOW = "2026-08-06T00:00:00.000Z";

function task(over: Partial<KpiTaskRow> = {}): KpiTaskRow {
  return {
    milestone_id: "m1",
    status: "not_started",
    is_blocked: false,
    is_critical: false,
    assigned_to: null,
    assigned_resource_id: null,
    estimate_hours: null,
    actual_hours: null,
    progress: null,
    duration_days: null,
    end_date: null,
    completed_at: null,
    ...over,
  };
}

const MILESTONE = { id: "m1", status: "planned", target_date: null, completed_date: null };

function custom(over: Partial<CustomKpiDefinition> = {}): CustomKpiDefinition {
  return {
    id: "k1",
    slug: "my_overrun",
    nameEn: "My overrun",
    nameEs: "Mi sobreesfuerzo",
    descriptionEn: null,
    descriptionEs: null,
    expression: "100 * SUM(actual_hours) / SUM(estimate_hours)",
    unit: "%",
    precision: 1,
    target: null,
    targetDirection: null,
    nlSource: null,
    version: 1,
    projectId: "p1",
    ...over,
  };
}

describe("what can be pinned", () => {
  it("offers the built-ins and the project's own KPIs together", () => {
    const all = pinnableKpis([custom()]);
    expect(all.some((k) => k.slug === "overall_progress" && k.source === "catalog")).toBe(true);
    expect(all.some((k) => k.slug === "my_overrun" && k.source === "custom")).toBe(true);
  });

  it("does not let a custom KPI shadow a built-in slug", () => {
    // Two screens quietly disagreeing about what "progress" means is the
    // metric drift PD-019 exists to prevent.
    const impostor = custom({ slug: "overall_progress", expression: "42" });
    const all = pinnableKpis([impostor]);
    const matches = all.filter((k) => k.slug === "overall_progress");
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toBe("catalog");
    expect(resolvePinnedKpi("overall_progress", [impostor])!.source).toBe("catalog");
  });

  it("finds a custom KPI by slug", () => {
    expect(resolvePinnedKpi("my_overrun", [custom()])!.source).toBe("custom");
  });

  it("resolves nothing for a slug that names nothing", () => {
    expect(resolvePinnedKpi("ghost", [])).toBeNull();
  });
});

describe("the three answers", () => {
  const worked = buildKpiDataset(
    [task({ actual_hours: 10, estimate_hours: 8 })],
    [MILESTONE],
    NOW,
  );

  it("returns the value when the scope can answer", () => {
    const r = evaluatePinnedKpi("my_overrun", [custom()], worked, 1);
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.value).toBe(125);
      expect(r.nameEs).toBe("Mi sobreesfuerzo");
      expect(r.taskCount).toBe(1);
    }
  });

  it("says NOT COMPUTABLE — never 0 — when the scope has no data", () => {
    const empty = buildKpiDataset([], [MILESTONE], NOW);
    const r = evaluatePinnedKpi("my_overrun", [custom()], empty, 0);
    expect(r.status).toBe("not_computable");
    if (r.status === "not_computable") {
      // The card needs the task count to say "no tasks" rather than "no data".
      expect(r.taskCount).toBe(0);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it("reports a slug whose KPI was deleted instead of dropping it", () => {
    // Silently vanishing would take away a measure the PM chose, with nothing
    // to explain where it went.
    const r = evaluatePinnedKpi("deleted_kpi", [], worked, 1);
    expect(r).toEqual({ status: "missing", slug: "deleted_kpi" });
  });

  it("evaluates a built-in by slug, not by re-parsing a copy of it", () => {
    const r = evaluatePinnedKpi("effort_consumed_pct", [], worked, 1);
    expect(r.status === "ok" && r.value).toBe(125);
  });
});

describe("targets", () => {
  const dataset = buildKpiDataset([task({ actual_hours: 10, estimate_hours: 8 })], [MILESTONE], NOW);

  it("flags a value that misses an at-or-below target", () => {
    const kpi = custom({ target: 100, targetDirection: "at_or_below" });
    const r = evaluatePinnedKpi("my_overrun", [kpi], dataset, 1);
    expect(r.status === "ok" && r.offTarget).toBe(true); // 125 > 100
  });

  it("does not flag a value that meets it", () => {
    const kpi = custom({ target: 130, targetDirection: "at_or_below" });
    const r = evaluatePinnedKpi("my_overrun", [kpi], dataset, 1);
    expect(r.status === "ok" && r.offTarget).toBe(false);
  });

  it("flags a value under an at-or-above target", () => {
    const kpi = custom({ target: 200, targetDirection: "at_or_above" });
    const r = evaluatePinnedKpi("my_overrun", [kpi], dataset, 1);
    expect(r.status === "ok" && r.offTarget).toBe(true);
  });

  it("never flags a KPI that declares no target", () => {
    const r = evaluatePinnedKpi("my_overrun", [custom()], dataset, 1);
    expect(r.status === "ok" && r.offTarget).toBe(false);
  });
});

describe("the same pin on different milestones", () => {
  it("gives each milestone its own number", () => {
    // The whole point of the milestone dimension: one KPI definition, many
    // scopes, no duplicated expressions to drift apart.
    const kpi = custom({ slug: "hours", expression: "SUM(actual_hours)", unit: "hours" });
    const prep = buildKpiDataset([task({ actual_hours: 332 })], [MILESTONE], NOW);
    const explore = buildKpiDataset([task({ actual_hours: 0 })], [MILESTONE], NOW);
    const a = evaluatePinnedKpi("hours", [kpi], prep, 1);
    const b = evaluatePinnedKpi("hours", [kpi], explore, 1);
    expect(a.status === "ok" && a.value).toBe(332);
    expect(b.status === "ok" && b.value).toBe(0);
  });
});

// ============================================================================
// The cap, and pins whose KPI was deleted
// ============================================================================
// Both were reported together, and they compound: a milestone at the 8-pin cap
// could not accept a new KPI, the click failed SILENTLY, and one of the eight
// slots was held by a pin whose custom KPI had been deleted — which the menu
// showed on the card but offered no way to remove, because it only listed KPIs
// that still existed.
// ============================================================================

describe("a pin whose KPI was deleted", () => {
  it("is still reported, so the card does not quietly lose a measure", () => {
    const r = evaluatePinnedKpi("budget_cost", [], buildKpiDataset([task()], [MILESTONE], NOW), 1);
    expect(r).toEqual({ status: "missing", slug: "budget_cost" });
  });

  it("is NOT offered as pinnable — which is why it needs its own removal path", () => {
    // The menu builds its checkbox list from this. An orphan can never appear
    // in it, so removing one has to be handled separately or it is permanent.
    expect(pinnableKpis([]).some((k) => k.slug === "budget_cost")).toBe(false);
  });

  it("keeps its slug, the only handle available to unpin it", () => {
    const r = evaluatePinnedKpi("budget_cost", [], buildKpiDataset([], [MILESTONE], NOW), 0);
    expect(r.status === "missing" && r.slug).toBe("budget_cost");
  });
});

describe("the cap", () => {
  it("is a real number the UI can show before it bites", () => {
    // Silent enforcement is what made the click look like a dead button.
    expect(MAX_PINS_PER_MILESTONE).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_PINS_PER_MILESTONE)).toBe(true);
  });
});
