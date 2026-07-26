import "server-only";

// ============================================================================
// PMO Intelligence Center — composed read model (CAP-048 Phase 2, ADR-012)
// ============================================================================
// This layer computes NOTHING. It calls the services that Dashboards 1 and 2
// already use, normalises their output into one shape, and correlates it under
// a single scope.
//
// That constraint is the whole design. A second implementation of "portfolio
// health" would not announce itself — it would surface months later as two
// screens disagreeing, with no way to tell which is right. REG-010 exists
// because that already happened once.
//
// Every field below is therefore traceable to the function that produced it,
// and the tests assert equality against those functions rather than literals.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import { getCommandCenterSummary, type CommandCenterData } from "@/lib/command-center/service";
import { loadPmoPiFlowModel } from "@/lib/pmo-process-intelligence/read-model.server";
import { loadPmoPiFinanceOverlay } from "@/lib/pmo-process-intelligence/financial-read.server";
import { loadPmoPiOverlays } from "@/lib/pmo-process-intelligence/overlays-read.server";
import { buildInsights } from "@/lib/pmo-process-intelligence/insights";
import type { PmoPiFlowModel } from "@/lib/pmo-process-intelligence/contracts";
import type { PmoPiFinanceOverlayModel } from "@/lib/pmo-process-intelligence/financial-overlay";
import type { PmoPiOverlaysData } from "@/lib/pmo-process-intelligence/overlays-read.server";
import type { PmoPiInsight } from "@/lib/pmo-process-intelligence/insights";
import { loadPortfolioGraph, type PortfolioGraphModel } from "@/lib/pmo-living-graph/read-model.server";
import { computeBlockedDays, type BlockedDaysResult, type StateTransitionRow } from "./blocked-days";
import type { PmoScope } from "./scope";

/** Cap on transition rows read for the blocked-days pass. */
const TRANSITION_LIMIT = 20_000;

export interface PmoIntelligenceModel {
  scope: PmoScope;
  /** Dashboard 1, verbatim. Health, KPIs, PMO focus, critical path monitor. */
  commandCenter: CommandCenterData | null;
  /** Dashboard 2. Null when its own gate or loader declines. */
  flow: PmoPiFlowModel | null;
  finance: PmoPiFinanceOverlayModel | null;
  overlays: PmoPiOverlaysData | null;
  insights: PmoPiInsight[];
  /** Dashboard 3 (CAP-048 Phase 1). */
  graph: PortfolioGraphModel;
  /** Gap closed in Phase 2 — see blocked-days.ts. */
  blockedDays: BlockedDaysResult | null;
  /** Named sources that failed, so the UI can say what is missing. */
  unavailableSources: string[];
  generatedAt: string;
}

/**
 * Load every source for one scope, in parallel.
 *
 * A failing source degrades its own slice and is named in `unavailableSources`
 * — it never empties the screen. An empty portfolio and an unreadable one look
 * identical otherwise, and telling a PMO there are no cross-project risks when
 * the query merely failed is the worst thing this dashboard could do.
 */
export async function loadPmoIntelligence(
  scope: PmoScope,
  locale: Locale,
  generatedAt: string,
): Promise<PmoIntelligenceModel> {
  const org = await getOrgContext();
  const unavailable: string[] = [];

  const [commandCenter, graph, flowResult] = await Promise.all([
    getCommandCenterSummary(org.organizationId, locale).catch(() => {
      unavailable.push("command-center");
      return null;
    }),
    loadPortfolioGraph(org.organizationId, locale).catch(() => {
      unavailable.push("portfolio-graph");
      return null;
    }),
    // Dashboard 2's loader takes a single focus project. A multi-project scope
    // is org-wide from its point of view, which is exactly what `null` means.
    loadPmoPiFlowModel(locale, scope.projectIds.length === 1 ? scope.projectIds[0] : null).catch(
      () => {
        unavailable.push("process-flow");
        return null;
      },
    ),
  ]);

  const flow = flowResult && flowResult.status === "ok" ? flowResult.model : null;
  if (flowResult && flowResult.status !== "ok") unavailable.push("process-flow");

  // The scope decides which projects the overlays cover. Empty means all of
  // them, taken from the graph we just loaded rather than a second query.
  const scopedProjectIds =
    scope.projectIds.length > 0
      ? scope.projectIds
      : (graph?.nodes ?? [])
          .filter((node) => node.kind === "project")
          .map((node) => node.canonicalEntityId);

  const [finance, overlays, blockedDays] = await Promise.all([
    loadPmoPiFinanceOverlay(org.organizationId, scopedProjectIds).catch(() => {
      unavailable.push("finance");
      return null;
    }),
    loadPmoPiOverlays(org, scopedProjectIds).catch(() => {
      unavailable.push("overlays");
      return null;
    }),
    loadBlockedDays(org.organizationId, scopedProjectIds, scope, generatedAt).catch(() => {
      unavailable.push("blocked-days");
      return null;
    }),
  ]);

  const projectNames: Record<string, string> = {};
  for (const node of graph?.nodes ?? []) {
    if (node.kind === "project") projectNames[node.canonicalEntityId] = node.label;
  }

  // Insights are pure over the models above — no extra reads, and the same six
  // deterministic rules Dashboard 2 shows.
  const insights = buildInsights({ flow, finance, overlays, projectNames, generatedAt });

  return {
    scope,
    commandCenter,
    flow,
    finance,
    overlays,
    insights,
    graph: graph ?? emptyGraph(org.organizationId),
    blockedDays,
    unavailableSources: [...new Set(unavailable)],
    generatedAt,
  };
}

function emptyGraph(organizationId: string): PortfolioGraphModel {
  return {
    state: "unavailable",
    organizationId,
    nodes: [],
    edges: [],
    sharedResources: [],
    criticalNodes: [],
    communities: new Map(),
    metrics: {
      totalProjects: { state: "unavailable", reason: "graph unavailable" },
      projectsAtRisk: { state: "unavailable", reason: "graph unavailable" },
      riskExposureAmount: { state: "unavailable", reason: "graph unavailable" },
      blockedDays: { state: "unavailable", reason: "graph unavailable" },
      crossProjectDependencies: { state: "unavailable", reason: "graph unavailable" },
      sharedResources: { state: "unavailable", reason: "graph unavailable" },
      overallocatedResources: { state: "unavailable", reason: "graph unavailable" },
      criticalNodes: { state: "unavailable", reason: "graph unavailable" },
      pendingDecisions: { state: "unavailable", reason: "graph unavailable" },
      orphanNodes: { state: "unavailable", reason: "graph unavailable" },
    },
    unavailableSources: ["portfolio-graph"],
  };
}

/**
 * Read the state transitions behind the blocked-days KPI.
 *
 * This is the one place Phase 2 issues a query of its own, and it exists
 * because nothing else in the codebase computes time-in-blocked-state. It reads
 * only transitions — no metric is derived here; that happens in the pure
 * function.
 */
async function loadBlockedDays(
  organizationId: string,
  projectIds: readonly string[],
  scope: PmoScope,
  generatedAt: string,
): Promise<BlockedDaysResult | null> {
  if (projectIds.length === 0) return null;
  const supabase = await createClient();

  let query = supabase
    .from("project_event_log")
    .select("project_id, subject_type, subject_id, from_state, to_state, occurred_at")
    .eq("organization_id", organizationId)
    .in("project_id", [...projectIds])
    // Only transitions that touch the blocked state can contribute.
    .or("from_state.eq.blocked,to_state.eq.blocked")
    .order("occurred_at", { ascending: true })
    .limit(TRANSITION_LIMIT);

  // The date range genuinely reaches the database here — Dashboard 2's range
  // control never did, which is why the parity matrix flagged it.
  if (scope.dateRange.from) query = query.gte("occurred_at", scope.dateRange.from);
  if (scope.dateRange.to) query = query.lte("occurred_at", `${scope.dateRange.to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;

  return computeBlockedDays((data ?? []) as StateTransitionRow[], generatedAt);
}
