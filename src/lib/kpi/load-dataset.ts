// ============================================================================
// ProjectOps360° — KPI Calculation Engine · Read-only dataset adapter
// ============================================================================
// CAP-046 F3. Builds the allow-listed KPI dataset for one project from
// canonical tables (RLS-scoped, SELECT only, deny-by-default). Flags follow
// REG-010 canonical helpers — this loader NEVER re-derives blocker/overdue
// semantics its own way (one source of metrics, REG-010).
//
// It now also returns one dataset PER MILESTONE, so the same expression the
// user wrote for the project can be asked of a single phase. The arithmetic
// lives in build-dataset.ts (pure); this file only fetches rows.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import type { KpiDataset } from "./evaluate";
import {
  buildKpiDataset,
  buildMilestoneDatasets,
  type KpiCostInputs,
  type KpiMilestoneRow,
  type KpiTaskRow,
  type MilestoneScopedDataset,
} from "./build-dataset";

export { weeklyCompletedSeries } from "./build-dataset";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A milestone's dataset plus what the UI needs to label it. */
export interface KpiMilestoneScope extends MilestoneScopedDataset {
  title: string;
  orderIndex: number;
}

export type KpiDatasetLoadResult =
  | {
      status: "ok";
      dataset: KpiDataset;
      /** Same shape, one per milestone — the milestone dimension. */
      milestoneScopes: KpiMilestoneScope[];
      projectTitle: string;
      taskCount: number;
      milestoneCount: number;
      /** ISO 4217 of the project's budget lines; drives currency formatting. */
      currency: string;
    }
  | { status: "unauthorized" }
  | { status: "error" };

function normalizeName(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export async function loadKpiDataset(projectId: string, locale: Locale): Promise<KpiDatasetLoadResult> {
  if (!UUID_RE.test(projectId)) return { status: "unauthorized" };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "unauthorized" };
  }

  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (projectError || !project) return { status: "unauthorized" };

  const [tasksResult, milestonesResult, budgetResult, rateResult] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select(
        "id, milestone_id, status, is_blocked, is_critical, assigned_to, assigned_resource_id, estimate_hours, actual_hours, progress, duration_days, end_date, completed_at, baseline_start_date, baseline_end_date, baseline_estimate_hours",
      )
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("milestones")
      .select("id, title, status, target_date, completed_date, order_index")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    // Cost inputs. Both are optional: without them the cost KPIs answer "not
    // computable", which is the honest result, so a failure here must never
    // fail the whole dataset.
    supabase
      .from("budget_items")
      .select("name, estimated_cost, milestone_id, currency")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("resources")
      .select("id, cost_rate, cost_unit")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .not("cost_rate", "is", null),
  ]);
  if (tasksResult.error || milestonesResult.error) return { status: "error" };

  const tasks = (tasksResult.data ?? []) as KpiTaskRow[];
  const milestoneRows = (milestonesResult.data ?? []) as Array<
    KpiMilestoneRow & { title: string; order_index: number | null }
  >;
  const budgetLines = (budgetResult.data ?? []) as Array<{
    name: string | null;
    estimated_cost: number | null;
    milestone_id: string | null;
    currency: string | null;
  }>;
  const rates = (rateResult.data ?? []) as Array<{
    id: string;
    cost_rate: number | null;
    cost_unit: string | null;
  }>;

  // Only hourly rates: pricing hours from a daily rate would mean assuming the
  // length of a working day, and inventing that assumption is how a cost
  // figure stops being a fact.
  const rateByResource = new Map<string, number>();
  for (const r of rates) {
    if (r.cost_rate != null && r.cost_rate > 0 && (r.cost_unit ?? "hour") === "hour") {
      rateByResource.set(r.id, Number(r.cost_rate));
    }
  }

  // budget_items HAS a milestone_id FK, but no importer populates it — plans
  // express the link by sharing a name. Honour the FK first so the day
  // something does populate it, the name stops mattering.
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
  for (const m of milestoneRows) {
    if (budgetByMilestone.has(m.id)) continue;
    const matched = byName.get(normalizeName(m.title));
    if (matched != null) budgetByMilestone.set(m.id, matched);
  }

  const cost: KpiCostInputs = { rateByResource, budgetByMilestone };
  const nowIso = new Date().toISOString();
  const milestones: KpiMilestoneRow[] = milestoneRows.map((m) => ({
    id: m.id,
    status: m.status,
    target_date: m.target_date,
    completed_date: m.completed_date,
  }));

  const scopes = buildMilestoneDatasets(tasks, milestones, nowIso, cost);
  const titleById = new Map(milestoneRows.map((m) => [m.id, m.title]));
  const orderById = new Map(milestoneRows.map((m, i) => [m.id, m.order_index ?? i]));

  return {
    status: "ok",
    dataset: buildKpiDataset(tasks, milestones, nowIso, cost),
    milestoneScopes: scopes.map((s) => ({
      ...s,
      title: titleById.get(s.milestoneId) ?? "",
      orderIndex: orderById.get(s.milestoneId) ?? 0,
    })),
    projectTitle: getI18nValue(project.title_i18n, locale) || project.slug,
    taskCount: tasks.length,
    milestoneCount: milestones.length,
    currency: budgetLines.find((b) => b.currency)?.currency ?? "USD",
  };
}
