import "server-only";

// ============================================================================
// PMO Simulation — server read model (CAP-049)
// ============================================================================
// The only place this module talks to Supabase, and it only ever READS. There
// is no write path from the simulator to an operational table, by construction:
// the sole mutations in this file target `pmo_simulation_*`.
//
// Every query is scoped by the organization from the session — the client never
// supplies it — and RLS enforces the same boundary again in the database.
//
// A failed read is recorded in `unavailableSources` rather than treated as an
// empty table. Simulating against a budget that failed to load would report a
// confident $0 baseline, and the delta against it would be pure fiction.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getI18nValue, type I18nField, type Locale } from "@/types/database";
import type { SimBaseline } from "./baseline";
import type { SimResult, SimScenario } from "./contracts";
import {
  interventionsToJson,
  rowToScenario,
  type ScenarioRow,
} from "./serialization";

const ROW_LIMIT = 5_000;

const SCENARIO_COLUMNS =
  "id, organization_id, name, description, project_ids, baseline_at, horizon_days, state, interventions, last_run_at, created_by, created_at, updated_at";

/**
 * Capture an immutable baseline for one organization.
 *
 * `projectIds` narrows the scope when a scenario targets specific projects.
 * Passing an empty array means the whole portfolio.
 */
export async function loadSimulationBaseline(
  organizationId: string,
  locale: Locale,
  capturedAt: string,
  projectIds: readonly string[] = [],
): Promise<SimBaseline> {
  const supabase = await createClient();
  const unavailable: string[] = [];

  const live = <T>(table: string, result: { data: T[] | null; error: unknown }): T[] => {
    if (result.error) {
      unavailable.push(table);
      return [];
    }
    return result.data ?? [];
  };

  const scoped = <T extends { eq: (col: string, val: string) => T; in: (col: string, vals: readonly string[]) => T }>(
    query: T,
  ): T => (projectIds.length > 0 ? query.in("project_id", projectIds) : query);

  const [
    projectsResult,
    milestonesResult,
    tasksResult,
    dependenciesResult,
    budgetResult,
    risksResult,
    allocationsResult,
    assignmentsResult,
    measurementsResult,
  ] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("projects").select("id, title_i18n, slug, status, start_date, target_end_date").eq("organization_id", organizationId).in("id", projectIds).is("deleted_at", null).limit(ROW_LIMIT)
      : supabase.from("projects").select("id, title_i18n, slug, status, start_date, target_end_date").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    scoped(supabase.from("milestones").select("id, project_id, title, status, target_date").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT)),
    scoped(supabase.from("roadmap_tasks").select("id, project_id, milestone_id, title, status, start_date, end_date, duration_days, estimate_hours, assigned_to, assigned_resource_id").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT)),
    scoped(supabase.from("task_dependencies").select("id, project_id, predecessor_id, successor_id, dependency_type, lag_days").eq("organization_id", organizationId).limit(ROW_LIMIT)),
    scoped(supabase.from("budget_items").select("id, project_id, milestone_id, name, category, estimated_cost, committed_cost, actual_cost, forecast_cost").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT)),
    scoped(supabase.from("risks").select("id, project_id, title, status, probability, impact, severity, linked_task_id, linked_milestone_id").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT)),
    scoped(supabase.from("project_resource_allocations").select("id, project_id, resource_profile_id, user_id, display_name, allocation_percent, weekly_capacity_hours, availability_percent, overhead_percent, start_date, end_date, status").eq("organization_id", organizationId).limit(ROW_LIMIT)),
    scoped(supabase.from("resource_assignments").select("id, project_id, task_id, resource_id, planned_hours, actual_hours").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT)),
    // EVM measurements. Ordered so the newest data_date per project wins the
    // de-duplication below — a project accumulates one row per reporting cycle.
    scoped(supabase.from("financial_measurement_snapshots").select("project_id, data_date, bac, pv, ev, ac, quality_status").eq("organization_id", organizationId).order("data_date", { ascending: false }).limit(ROW_LIMIT)),
  ]);

  const projects = live("projects", projectsResult) as {
    id: string; title_i18n: I18nField; slug: string; status: string | null;
    start_date: string | null; target_end_date: string | null;
  }[];

  const budgetItems = live("budget_items", budgetResult) as SimBaseline["budgetItems"][number][];

  // ── EVM inputs ──────────────────────────────────────────────────────────
  // BAC always comes from the budget lines, because BAC is what a budget
  // intervention MOVES. Reading it from a measurement snapshot would freeze it
  // at the reporting date and the simulated column would never differ from the
  // baseline one.
  //
  // EV and PV come from `financial_measurement_snapshots`, the canonical EVM
  // measurement the financial module already writes. This read used to omit
  // that table and leave EV null, so every forecast reported "unavailable" even
  // for projects that had a perfectly good measurement on file.
  //
  // AC comes from the SAME snapshot when one exists. Pairing an EV measured at
  // a data date with an AC summed from today's budget lines would give a CPI
  // that describes neither moment.
  const measurements = live("financial_measurement_snapshots", measurementsResult) as {
    project_id: string; data_date: string;
    bac: number | null; pv: number | null; ev: number | null; ac: number | null;
    quality_status: string;
  }[];

  // Newest measurement per project. The query is already sorted by data_date
  // descending, so the first row seen for a project is its latest.
  const latestMeasurement = new Map<string, (typeof measurements)[number]>();
  for (const row of measurements) {
    if (!latestMeasurement.has(row.project_id)) latestMeasurement.set(row.project_id, row);
  }

  const evmByProject = new Map<string, { bac: number; ac: number }>();
  for (const item of budgetItems) {
    const entry = evmByProject.get(item.project_id) ?? { bac: 0, ac: 0 };
    entry.bac += Number(item.estimated_cost ?? 0);
    entry.ac += Number(item.actual_cost ?? 0);
    evmByProject.set(item.project_id, entry);
  }

  return {
    organizationId,
    capturedAt,
    projects: projects.map((row) => ({
      id: row.id,
      title: getI18nValue(row.title_i18n, locale, row.slug),
      status: row.status,
      start_date: row.start_date,
      target_end_date: row.target_end_date,
    })),
    milestones: live("milestones", milestonesResult) as SimBaseline["milestones"][number][],
    tasks: live("roadmap_tasks", tasksResult) as SimBaseline["tasks"][number][],
    dependencies: live("task_dependencies", dependenciesResult) as SimBaseline["dependencies"][number][],
    budgetItems,
    risks: live("risks", risksResult) as SimBaseline["risks"][number][],
    allocations: live("project_resource_allocations", allocationsResult) as SimBaseline["allocations"][number][],
    assignments: live("resource_assignments", assignmentsResult) as SimBaseline["assignments"][number][],
    evm: [...evmByProject.entries()].map(([project_id, entry]) => {
      const measured = latestMeasurement.get(project_id);
      // A snapshot the financial module itself flagged as unusable is not a
      // better source than nothing — it is the same "unavailable" wearing a
      // number. Only `available` and `provisional` readings are trusted here.
      const usable =
        measured != null &&
        measured.ev != null &&
        (measured.quality_status === "available" || measured.quality_status === "provisional");

      return {
        project_id,
        // Always the mutable budget total — see the note above.
        bac: entry.bac,
        ev: usable ? Number(measured.ev) : null,
        pv: usable && measured.pv != null ? Number(measured.pv) : null,
        // Paired with EV when measured, so CPI compares two figures from the
        // same reading; otherwise the budget-line sum, which is all we have.
        ac: usable && measured.ac != null ? Number(measured.ac) : entry.ac,
        source: usable ? ("measurement_snapshot" as const) : ("budget_items" as const),
      };
    }),
    unavailableSources: unavailable,
  };
}

// ── Scenario CRUD ───────────────────────────────────────────────────────────
// Writes here touch `pmo_simulation_*` and nothing else. Saving a scenario
// cannot alter a project, task, risk, resource or budget line.

export async function listScenarios(organizationId: string): Promise<SimScenario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pmo_simulation_scenarios")
    .select(SCENARIO_COLUMNS)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return (data as ScenarioRow[]).map(rowToScenario);
}

export async function getScenario(
  organizationId: string,
  scenarioId: string,
): Promise<SimScenario | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pmo_simulation_scenarios")
    .select(SCENARIO_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("id", scenarioId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return rowToScenario(data as ScenarioRow);
}

export async function getLastResult(
  organizationId: string,
  scenarioId: string,
): Promise<SimResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pmo_simulation_scenarios")
    .select("last_result")
    .eq("organization_id", organizationId)
    .eq("id", scenarioId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data?.last_result) return null;
  return data.last_result as SimResult;
}

export interface SaveScenarioInput {
  id?: string;
  organizationId: string;
  name: string;
  description: string | null;
  projectIds: string[];
  horizonDays: number | null;
  interventions: SimScenario["interventions"];
  state: SimScenario["state"];
  userId: string;
}

export async function saveScenario(input: SaveScenarioInput): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const payload = {
    organization_id: input.organizationId,
    name: input.name,
    description: input.description,
    project_ids: input.projectIds,
    horizon_days: input.horizonDays,
    state: input.state,
    interventions: interventionsToJson(input.interventions),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("pmo_simulation_scenarios")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .select("id")
      .maybeSingle();
    // Returning null loses WHY. That is how a missing table in one environment
    // surfaced to the user as the bare word "unexpected" with nothing to go on.
    if (error) console.error("[pmo-simulation] update scenario failed", error);
    if (error || !data) return null;
    return { id: data.id as string };
  }

  const { data, error } = await supabase
    .from("pmo_simulation_scenarios")
    .insert({ ...payload, created_by: input.userId })
    .select("id")
    .maybeSingle();
  if (error) console.error("[pmo-simulation] insert scenario failed", error);
  if (error || !data) return null;
  return { id: data.id as string };
}

/** Store a run, and cache it on the scenario for fast reopen. */
export async function recordRun(
  organizationId: string,
  scenarioId: string,
  scenario: SimScenario,
  result: SimResult,
  userId: string,
): Promise<void> {
  const supabase = await createClient();

  await supabase.from("pmo_simulation_runs").insert({
    organization_id: organizationId,
    scenario_id: scenarioId,
    baseline_at: result.baselineAt,
    interventions: interventionsToJson(scenario.interventions),
    result: result as unknown as Record<string, unknown>,
    ran_by: userId,
  });

  await supabase
    .from("pmo_simulation_scenarios")
    .update({
      state: "simulated",
      last_result: result as unknown as Record<string, unknown>,
      last_run_at: result.ranAt,
    })
    .eq("id", scenarioId)
    .eq("organization_id", organizationId);
}

/** Soft delete — the run history stays readable for anything that cited it. */
export async function deleteScenario(
  organizationId: string,
  scenarioId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pmo_simulation_scenarios")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", scenarioId)
    .eq("organization_id", organizationId);
  return !error;
}
