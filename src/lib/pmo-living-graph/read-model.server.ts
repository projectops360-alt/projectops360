import "server-only";

// ============================================================================
// PMO Portfolio Living Graph — server read model (CAP-048)
// ============================================================================
// The only place this module talks to Supabase. Every query is scoped by the
// organization from the session — the client never supplies it — and RLS
// enforces the same boundary again in the database.
//
// A failed read returns `unavailable`, never an empty graph. An empty graph
// and an unreadable one look identical on screen, and telling a PMO there are
// no cross-project risks when the query simply failed is the worst outcome
// this screen can produce.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getI18nValue, type I18nField, type Locale } from "@/types/database";
import type { GraphDataState, GraphEdge, GraphNode } from "./contracts";
import { assertSingleOrganization, projectNodes, type CanonicalRows } from "./node-projection";
import { projectEdges, type CanonicalRelations } from "./edge-projection";
import {
  detectSharedResources,
  type ResourceAllocationRow,
  type SharedResourceLink,
} from "./shared-resources";
import {
  buildAdjacency,
  computeDegreeCentrality,
  detectCommunities,
  detectCrossProjectDependencies,
  detectOrphanNodes,
  identifyCriticalNodes,
  type CriticalNode,
} from "./graph-algorithms";
import { computePortfolioMetrics, type PortfolioMetrics } from "./portfolio-metrics";

/** Ceiling per table. A portfolio this large needs pagination, not a bigger fetch. */
const ROW_LIMIT = 5_000;

export interface PortfolioGraphModel {
  state: GraphDataState;
  organizationId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  sharedResources: SharedResourceLink[];
  criticalNodes: CriticalNode[];
  communities: Map<string, string>;
  metrics: PortfolioMetrics;
  /** Tables that could not be read. Surfaced so the UI can name what is missing. */
  unavailableSources: string[];
}

function emptyModel(
  organizationId: string,
  state: GraphDataState,
  unavailableSources: string[] = [],
): PortfolioGraphModel {
  return {
    state,
    organizationId,
    nodes: [],
    edges: [],
    sharedResources: [],
    criticalNodes: [],
    communities: new Map(),
    metrics: computePortfolioMetrics({
      nodes: [],
      edges: [],
      crossProject: [],
      sharedResources: [],
      criticalNodeCount: 0,
      orphanNodeCount: 0,
      blockedDaysByProject: null,
    }),
    unavailableSources,
  };
}

/**
 * Build the portfolio graph for one organization.
 *
 * Reads run in parallel; a single failing table degrades that slice rather than
 * the whole screen, and the failure is reported by name in `unavailableSources`.
 */
export async function loadPortfolioGraph(
  organizationId: string,
  locale: Locale,
): Promise<PortfolioGraphModel> {
  const supabase = await createClient();
  const unavailable: string[] = [];

  const live = <T>(table: string, result: { data: T[] | null; error: unknown }): T[] => {
    if (result.error) {
      unavailable.push(table);
      return [];
    }
    return result.data ?? [];
  };

  const [
    organizationResult,
    projectsResult,
    milestonesResult,
    tasksResult,
    subtasksResult,
    risksResult,
    decisionsResult,
    resourcesResult,
    stakeholdersResult,
    kpisResult,
    budgetItemsResult,
    dependenciesResult,
    traceabilityResult,
    allocationsResult,
  ] = await Promise.all([
    supabase.from("organizations").select("id, name_i18n, slug").eq("id", organizationId).maybeSingle(),
    supabase.from("projects").select("id, organization_id, title_i18n, slug, status, start_date, target_end_date, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("milestones").select("id, organization_id, project_id, title, description, status, target_date, progress_percent, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("roadmap_tasks").select("id, organization_id, project_id, milestone_id, title, description, status, priority, start_date, end_date, is_critical, slack_days, estimate_hours, actual_hours, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("task_subtasks").select("id, organization_id, project_id, task_id, title, description, status, start_date, due_date, estimated_hours, actual_hours, progress, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("risks").select("id, organization_id, project_id, title, description, status, severity, probability, impact, linked_task_id, linked_milestone_id, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("decisions").select("id, organization_id, project_id, title_i18n, status, decision_date, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("resources").select("id, organization_id, project_id, name, resource_type, status, capacity_per_day, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("stakeholders").select("id, organization_id, project_id, name, influence, interest, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("kpi_definitions").select("id, organization_id, project_id, name_en, name_es, target, unit, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("budget_items").select("id, organization_id, project_id, milestone_id, name, status, estimated_cost, actual_cost, updated_at").eq("organization_id", organizationId).is("deleted_at", null).limit(ROW_LIMIT),
    supabase.from("task_dependencies").select("id, organization_id, project_id, predecessor_id, successor_id, dependency_type, lag_days").eq("organization_id", organizationId).limit(ROW_LIMIT),
    supabase.from("traceability_links").select("id, organization_id, source_type, source_id, target_type, target_id, link_type").eq("organization_id", organizationId).limit(ROW_LIMIT),
    supabase.from("project_resource_allocations").select("id, organization_id, project_id, resource_profile_id, display_name, allocation_percent, start_date, end_date, status").eq("organization_id", organizationId).limit(ROW_LIMIT),
  ]);

  // Without the organization row there is no graph root and no anchor to hang
  // projects from — that is unavailable, not empty.
  if (organizationResult.error || !organizationResult.data) {
    return emptyModel(organizationId, "unavailable", ["organizations"]);
  }

  const projects = live("projects", projectsResult) as {
    id: string; organization_id: string; title_i18n: I18nField; slug: string;
    status: string | null; start_date: string | null; target_end_date: string | null; updated_at: string | null;
  }[];
  const milestones = live("milestones", milestonesResult) as CanonicalRows["milestones"];
  const tasks = live("roadmap_tasks", tasksResult) as (CanonicalRows["tasks"][number] & { milestone_id: string | null })[];
  const subtasks = live("task_subtasks", subtasksResult) as CanonicalRows["subtasks"];
  const risks = live("risks", risksResult) as (CanonicalRows["risks"][number] & {
    linked_task_id: string | null; linked_milestone_id: string | null;
  })[];
  const decisions = live("decisions", decisionsResult) as {
    id: string; organization_id: string; project_id: string; title_i18n: I18nField;
    status: string | null; decision_date: string | null; updated_at: string | null;
  }[];
  const resources = live("resources", resourcesResult) as CanonicalRows["resources"];
  const stakeholders = live("stakeholders", stakeholdersResult) as CanonicalRows["stakeholders"];
  const kpis = live("kpi_definitions", kpisResult) as {
    id: string; organization_id: string; project_id: string | null;
    name_en: string | null; name_es: string | null; target: number | null; unit: string | null; updated_at: string | null;
  }[];
  const budgetItems = live("budget_items", budgetItemsResult) as (CanonicalRows["budgetItems"][number] & {
    milestone_id: string | null;
  })[];
  const dependencies = live("task_dependencies", dependenciesResult) as CanonicalRelations["taskDependencies"];
  const traceability = live("traceability_links", traceabilityResult) as CanonicalRelations["traceabilityLinks"];
  const allocations = live("project_resource_allocations", allocationsResult) as ResourceAllocationRow[];

  const organizationName = getI18nValue(
    organizationResult.data.name_i18n as I18nField,
    locale,
    organizationResult.data.slug,
  );

  // ── Project ─────────────────────────────────────────────────────────────
  const rows: CanonicalRows = {
    organization: { id: organizationId, name: organizationName },
    projects: projects.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      title: getI18nValue(row.title_i18n, locale, row.slug),
      status: row.status,
      start_date: row.start_date,
      target_end_date: row.target_end_date,
      updated_at: row.updated_at,
    })),
    milestones,
    tasks,
    subtasks,
    risks,
    decisions: decisions.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      title: getI18nValue(row.title_i18n, locale, "Decision"),
      status: row.status,
      decision_date: row.decision_date,
      updated_at: row.updated_at,
    })),
    resources,
    stakeholders,
    kpis: kpis.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      name: (locale === "es" ? row.name_es : row.name_en) ?? row.name_en ?? row.name_es ?? "KPI",
      target: row.target,
      unit: row.unit,
      updated_at: row.updated_at,
    })),
    budgetItems,
  };

  const nodes = assertSingleOrganization(projectNodes(rows), organizationId);
  const sharedResources = detectSharedResources(allocations, organizationId);
  const edges = projectEdges(
    {
      projects: rows.projects,
      milestones,
      tasks,
      subtasks,
      taskDependencies: dependencies,
      risks,
      budgetItems,
      traceabilityLinks: traceability,
    },
    sharedResources,
    organizationId,
  );

  // ── Enrich with graph position ──────────────────────────────────────────
  const index = buildAdjacency(edges);
  const nodeIds = nodes.map((node) => node.id);
  const centrality = computeDegreeCentrality(index, nodeIds);
  const crossProject = detectCrossProjectDependencies(edges, nodes);
  const criticalNodes = identifyCriticalNodes(nodes, index, centrality, crossProject);
  const communities = detectCommunities(index, nodeIds);
  const orphans = detectOrphanNodes(index, nodes);

  // Criticality is only knowable once the whole graph exists, which is why the
  // projection left it at zero.
  for (const node of nodes) {
    node.criticality = centrality.get(node.id) ?? 0;
  }

  const metrics = computePortfolioMetrics({
    nodes,
    edges,
    crossProject,
    sharedResources,
    criticalNodeCount: criticalNodes.length,
    orphanNodeCount: orphans.length,
    // Reconstructing blocked-day totals needs a pass over the event log; until
    // that exists the metric says so rather than reporting a fabricated zero.
    blockedDaysByProject: null,
  });

  return {
    state: nodes.length === 0 ? "empty" : "ok",
    organizationId,
    nodes,
    edges,
    sharedResources,
    criticalNodes,
    communities,
    metrics,
    unavailableSources: unavailable,
  };
}
