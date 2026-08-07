// ============================================================================
// The pinned KPIs of a project, loaded once for whichever screen asks
// ============================================================================
// A KPI pinned to a milestone in the Living Graph has to read identically in
// the Gantt — it is the same pin on the same phase, and two screens computing
// it separately is how they start disagreeing (PD-019, metric drift).
//
// So the loading, the budget matching, the rate filtering and the evaluation
// all live here, and every screen calls the same function. The values are
// always computed LIVE from the canonical tables; nothing is cached, so there
// is no second source to drift (REG-010).
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMilestoneDatasets, type KpiTaskRow, type KpiMilestoneRow } from "./build-dataset";
import {
  evaluatePinnedKpi,
  pinnableKpis,
  type PinnableKpi,
  type ResolvedPinnedKpi,
} from "./milestone-pins";
import type { CustomKpiDefinition } from "./custom";

export interface MilestoneKpiBundle {
  /** milestoneId → its pinned KPIs, already evaluated in that scope. */
  pinnedKpisByMilestone: Record<string, ResolvedPinnedKpi[]>;
  /** Everything the user may pin: built-ins + this project's custom KPIs. */
  pinnableKpis: PinnableKpi[];
  /** ISO 4217 from the project's budget lines. */
  currency: string;
  /** resource id → hourly rate, reused by cash flow and cost rollups. */
  rateByResource: Record<string, number>;
}

function normalizeName(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>;

/**
 * Load and evaluate every KPI pinned to a milestone in this project.
 *
 * Degrades rather than fails: budget lines, rates and even the pins table are
 * optional, and without them the KPIs answer "not computable" — which is the
 * honest result and must never take a whole page down with it.
 */
export async function loadMilestoneKpis(
  supabase: Client,
  organizationId: string,
  projectId: string,
  tasks: readonly KpiTaskRow[],
  milestones: readonly (KpiMilestoneRow & { title: string })[],
): Promise<MilestoneKpiBundle> {
  const [pinsResult, customResult, budgetResult, rateResult] = await Promise.all([
    supabase
      .from("milestone_kpi_pins")
      .select("milestone_id, kpi_slug, order_index")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId)
      .order("order_index", { ascending: true }),
    supabase
      .from("kpi_definitions")
      .select(
        "id, slug, name_en, name_es, description_en, description_es, expression, unit, precision, target, target_direction, version, project_id",
      )
      .eq("organization_id", organizationId)
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .is("deleted_at", null),
    supabase
      .from("budget_items")
      .select("name, estimated_cost, milestone_id, currency")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("resources")
      .select("id, cost_rate, cost_unit")
      .eq("project_id", projectId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .not("cost_rate", "is", null),
  ]);

  const customKpis: CustomKpiDefinition[] = ((customResult.data ?? []) as any[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameEs: row.name_es,
    descriptionEn: row.description_en ?? null,
    descriptionEs: row.description_es ?? null,
    expression: row.expression,
    unit: row.unit ?? null,
    precision: row.precision ?? 2,
    target: row.target ?? null,
    targetDirection: row.target_direction ?? null,
    nlSource: null,
    version: row.version ?? 1,
    projectId: row.project_id ?? null,
  }));

  // Only hourly rates: pricing hours from a daily rate would mean assuming the
  // length of a working day.
  const rateByResource: Record<string, number> = {};
  for (const r of (rateResult.data ?? []) as any[]) {
    if (r.cost_rate != null && r.cost_rate > 0 && (r.cost_unit ?? "hour") === "hour") {
      rateByResource[r.id] = Number(r.cost_rate);
    }
  }

  // budget_items HAS a milestone_id FK that no importer populates; plans express
  // the link by sharing a name. FK first, so the day something populates it the
  // name stops mattering.
  const budgetLines = (budgetResult.data ?? []) as any[];
  const budgetByMilestone = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const line of budgetLines) {
    const amount = Number(line.estimated_cost) || 0;
    if (line.milestone_id) {
      budgetByMilestone.set(line.milestone_id, (budgetByMilestone.get(line.milestone_id) ?? 0) + amount);
    } else {
      const key = normalizeName(line.name);
      if (key) byName.set(key, (byName.get(key) ?? 0) + amount);
    }
  }
  for (const m of milestones) {
    if (budgetByMilestone.has(m.id)) continue;
    const matched = byName.get(normalizeName(m.title));
    if (matched != null) budgetByMilestone.set(m.id, matched);
  }

  const pinnedKpisByMilestone: Record<string, ResolvedPinnedKpi[]> = {};
  const pins = (pinsResult.data ?? []) as { milestone_id: string; kpi_slug: string }[];

  if (pins.length > 0) {
    const scopes = buildMilestoneDatasets(
      tasks,
      milestones.map((m) => ({
        id: m.id,
        status: m.status,
        target_date: m.target_date,
        completed_date: m.completed_date,
      })),
      new Date().toISOString(),
      { rateByResource: new Map(Object.entries(rateByResource)), budgetByMilestone },
    );
    const scopeById = new Map(scopes.map((s) => [s.milestoneId, s]));

    for (const pin of pins) {
      const scope = scopeById.get(pin.milestone_id);
      if (!scope) continue;
      const list = pinnedKpisByMilestone[pin.milestone_id] ?? [];
      list.push(evaluatePinnedKpi(pin.kpi_slug, customKpis, scope.dataset, scope.taskCount));
      pinnedKpisByMilestone[pin.milestone_id] = list;
    }
  }

  return {
    pinnedKpisByMilestone,
    pinnableKpis: pinnableKpis(customKpis),
    currency: budgetLines.find((b) => b.currency)?.currency ?? "USD",
    rateByResource,
  };
}
