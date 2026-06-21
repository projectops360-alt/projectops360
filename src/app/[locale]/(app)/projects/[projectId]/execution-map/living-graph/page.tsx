// ============================================================================
// ProjectOps360° — Living Graph page (server component)
// ============================================================================
// Fetches process nodes/edges + timeline events through Supabase, enriches
// them with roadmap task / milestone data, normalizes everything into the
// LivingGraphData contract and renders the client visualization.
// ============================================================================

import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeOrphanGraphNodes } from "@/lib/roadmap/living-graph-sync";
import { getOrgContext } from "@/lib/auth";
import type {
  ProcessNode,
  ProcessEdge,
  ProcessTimelineEntry,
  RoadmapTask,
  Milestone,
  LaborResource,
  ConstructionActivity,
  ActivityDependency,
  TradeTaxonomy,
} from "@/types/database";
import type {
  LivingGraphData,
  LivingGraphNode,
  LivingGraphEdge,
  LivingGraphEvent,
  LivingGraphRiskLevel,
} from "@/types/living-graph";
import { LivingGraphView } from "@/components/graph/living-graph-dynamic";
import { computeLaborCapacity } from "@/lib/labor/capacity";
import type { LaborCapacityResult } from "@/lib/labor/capacity";
import { computeLookahead } from "@/lib/labor/lookahead";
import type { LookaheadResult } from "@/lib/labor/lookahead";
import { computeLaborVariance } from "@/lib/labor/labor-variance";
import type { LaborVarianceResult } from "@/lib/labor/labor-variance";
import { computeProductivityVariance } from "@/lib/labor/productivity-variance";
import type { ProductivityVarianceResult } from "@/lib/labor/productivity-variance";
import { classifyAllVarianceCauses } from "@/lib/labor/variance-cause-classification";
import type { VarianceCauseResult } from "@/lib/labor/variance-cause-classification";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TaskEnrichment = Pick<
  RoadmapTask,
  | "id"
  | "milestone_id"
  | "status"
  | "priority"
  | "progress"
  | "start_date"
  | "end_date"
  | "duration_days"
  | "is_blocked"
  | "is_critical"
>;

type MilestoneEnrichment = Pick<
  Milestone,
  | "id"
  | "title"
  | "status"
  | "progress_percent"
  | "start_date"
  | "target_date"
  | "order_index"
  | "icon_key"
>;

function taskRisk(task: TaskEnrichment): LivingGraphRiskLevel {
  if (task.is_blocked) return "high";
  if (task.priority === "p1" && task.status !== "done") return "medium";
  return "low";
}

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" ? value : null;
}

function metaNumber(meta: Record<string, unknown>, key: string): number | null {
  const value = meta[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeNode(
  row: ProcessNode,
  tasks: Map<string, TaskEnrichment>,
  milestones: Map<string, MilestoneEnrichment>,
): LivingGraphNode {
  const meta = row.metadata ?? {};
  const task =
    row.source_entity_type === "roadmap_tasks"
      ? tasks.get(row.source_entity_id)
      : undefined;
  const milestone =
    row.source_entity_type === "milestones"
      ? milestones.get(row.source_entity_id)
      : undefined;

  const metaRisk = metaString(meta, "risk_level");
  const riskLevel: LivingGraphRiskLevel | null =
    metaRisk === "low" || metaRisk === "medium" || metaRisk === "high"
      ? metaRisk
      : task
        ? taskRisk(task)
        : null;

  const milestoneId =
    row.source_entity_type === "milestones"
      ? row.source_entity_id
      : (task?.milestone_id ?? null);
  const milestoneRecord = milestoneId ? milestones.get(milestoneId) : undefined;
  const milestoneLabel = milestoneRecord?.title ?? null;

  return {
    id: row.id,
    projectId: row.project_id,
    nodeType: row.node_type,
    sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id,
    label: row.title,
    description: row.description,
    status:
      task?.status ??
      milestone?.status ??
      metaString(meta, "new_status") ??
      metaString(meta, "to_status") ??
      metaString(meta, "status"),
    progress: task?.progress ?? milestone?.progress_percent ?? metaNumber(meta, "progress"),
    startDate: task?.start_date ?? milestone?.start_date ?? null,
    endDate: task?.end_date ?? milestone?.target_date ?? null,
    durationDays: task?.duration_days ?? null,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    riskLevel,
    isBlocked:
      row.node_type === "blocker_event" ||
      (task?.is_blocked ?? false) ||
      meta.is_blocked === true,
    isCritical: task?.is_critical ?? false,
    milestoneId,
    milestoneLabel,
    milestoneOrder: milestoneRecord?.order_index ?? null,
    traceabilityScore: null, // computed client-side from evidence edges
    metadata: milestoneRecord?.icon_key
      ? { ...meta, milestone_icon: milestoneRecord.icon_key }
      : meta,
  };
}

function normalizeEdge(row: ProcessEdge): LivingGraphEdge {
  const meta = row.metadata ?? {};
  const metaRisk = metaString(meta, "risk_level");
  return {
    id: row.id,
    projectId: row.project_id,
    sourceNodeId: row.from_node_id,
    targetNodeId: row.to_node_id,
    edgeType: row.edge_type,
    weight: row.weight,
    lagDays: metaNumber(meta, "lag_days"),
    isCritical: false, // computed client-side via longest-path approximation
    riskLevel:
      metaRisk === "low" || metaRisk === "medium" || metaRisk === "high"
        ? metaRisk
        : row.edge_type === "blocked"
          ? "high"
          : null,
    metadata: meta,
  };
}

export default async function LivingGraphPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  if (!UUID_RE.test(projectId)) {
    notFound();
  }

  const t = await getTranslations("livingGraph");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Validate the project belongs to the user's organization
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  // Auto-clean orphan graph nodes (milestones/tasks deleted earlier) before
  // reading, so the graph never shows entities that no longer exist. Cheap and
  // best-effort — the heavier full rebuild stays behind the "Recalculate" button.
  try {
    await removeOrphanGraphNodes(createAdminClient(), org.organizationId, projectId);
  } catch (err) {
    console.error("Living Graph auto-clean failed:", err);
  }

  // Graph data + project-scoped enrichment, all in one parallel wave.
  // Only the roadmap_tasks fetch depends on node contents (see below).
  const [
    nodesResult,
    edgesResult,
    milestonesResult,
    timelineResult,
    laborResourcesResult,
    laborActivitiesResult,
    laborDepsResult,
    laborTaxonomyResult,
  ] = await Promise.all([
    supabase
      .from("process_nodes")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: true })
      .limit(1000),
    supabase
      .from("process_edges")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .limit(3000),
    // All project milestones — labeling/grouping + in-graph editing
    supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    // Recent process events for timeline playback (RPC failure is non-fatal)
    supabase.rpc("get_process_timeline", { p_project_id: projectId }),
    // Labor capacity data (non-fatal — absence just means no labor overlay)
    supabase
      .from("labor_resources")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index"),
    supabase
      .from("construction_activities")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index"),
    supabase
      .from("activity_dependencies")
      .select("*")
      .eq("project_id", projectId),
    supabase
      .from("trade_taxonomy")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index"),
  ]);

  if (nodesResult.error || edgesResult.error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5 py-20 text-center">
        <AlertTriangle className="mb-4 h-10 w-10 text-destructive" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">{t("errorState.title")}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("errorState.description")}
        </p>
      </div>
    );
  }

  const rawNodes = (nodesResult.data ?? []) as ProcessNode[];
  const rawEdges = (edgesResult.data ?? []) as ProcessEdge[];

  // Enrichment: roadmap tasks + milestones referenced by the graph
  const taskIds = [
    ...new Set(
      rawNodes
        .filter((n) => n.source_entity_type === "roadmap_tasks")
        .map((n) => n.source_entity_id),
    ),
  ];
  // Full task rows: enrichment + in-graph editing (TaskFormDialog needs them all)
  const tasksResult =
    taskIds.length > 0
      ? await supabase.from("roadmap_tasks").select("*").in("id", taskIds)
      : { data: [] as RoadmapTask[], error: null };

  const fullTasks = (tasksResult.data ?? []) as RoadmapTask[];
  const fullMilestones = (milestonesResult.data ?? []) as Milestone[];

  const taskMap = new Map<string, TaskEnrichment>(
    fullTasks.map((task) => [task.id, task]),
  );
  const milestoneMap = new Map<string, MilestoneEnrichment>(
    fullMilestones.map((m) => [m.id, m]),
  );

  const nodes = rawNodes.map((row) => normalizeNode(row, taskMap, milestoneMap));
  const edges = rawEdges.map(normalizeEdge);

  const events: LivingGraphEvent[] = timelineResult.error
    ? // Graceful fallback: derive events from node occurrence order
      nodes.map((n) => ({
        id: `node-event:${n.id}`,
        projectId: n.projectId,
        eventType: n.nodeType,
        entityType: n.sourceEntityType,
        entityId: n.sourceEntityId,
        nodeId: n.id,
        label: n.label,
        occurredAt: n.occurredAt,
        inDegree: 0,
        outDegree: 0,
        metadata: n.metadata,
      }))
    : ((timelineResult.data ?? []) as ProcessTimelineEntry[]).map((entry) => ({
        id: `timeline:${entry.node_id}`,
        projectId,
        eventType: entry.node_type,
        entityType: entry.source_entity_type,
        entityId: entry.source_entity_id,
        nodeId: entry.node_id,
        label: entry.title,
        occurredAt: entry.occurred_at,
        inDegree: entry.in_degree,
        outDegree: entry.out_degree,
        metadata: entry.metadata ?? {},
      }));

  const data: LivingGraphData = {
    nodes,
    edges,
    events,
    generatedAt: new Date().toISOString(),
  };

  // Compute labor capacity (non-fatal — errors just mean no labor overlay)
  let laborCapacity: LaborCapacityResult | undefined;
  let lookaheadResult: LookaheadResult | undefined;
  const laborResources = (laborResourcesResult.data ?? []) as LaborResource[];
  const laborActivities = (laborActivitiesResult.data ?? []) as ConstructionActivity[];
  const laborDependencies = (laborDepsResult.data ?? []) as ActivityDependency[];
  const laborTaxonomy = (laborTaxonomyResult.data ?? []) as TradeTaxonomy[];

  if (
    !laborResourcesResult.error &&
    !laborActivitiesResult.error &&
    !laborDepsResult.error &&
    laborResources.length > 0 &&
    laborActivities.length > 0
  ) {
    try {
      laborCapacity = computeLaborCapacity(
        laborResources,
        laborActivities,
        laborDependencies,
        fullMilestones,
      );
      lookaheadResult = computeLookahead(
        laborResources,
        laborActivities,
        laborDependencies,
        fullMilestones,
        laborTaxonomy,
        6
      );
    } catch {
      // Labor capacity computation failed — skip silently
    }
  }

  // Compute productivity variance and cause classification
  let laborVariance: LaborVarianceResult | undefined;
  let varianceResult: ProductivityVarianceResult | undefined;
  let varianceCauses: VarianceCauseResult[] = [];
  if (
    !laborResourcesResult.error &&
    !laborActivitiesResult.error &&
    !laborDepsResult.error &&
    laborActivities.length > 0
  ) {
    try {
      laborVariance = computeLaborVariance(laborActivities);
      varianceResult = computeProductivityVariance(
        laborActivities,
        laborDependencies,
        laborTaxonomy,
      );
      // Compute readiness results for cause classification
      const { computeWorkfaceReadiness } = await import("@/lib/labor/workface-readiness");
      const readinessMap = new Map(
        laborActivities.map((a) => [
          a.activity_key,
          computeWorkfaceReadiness(a.activity_key, a.readiness_checklist),
        ]),
      );
      varianceCauses = classifyAllVarianceCauses(
        laborActivities,
        laborVariance,
        readinessMap,
        [], // blockers not computed at this level — causes will use variance metrics only
        laborResources,
        laborDependencies,
        laborCapacity?.weeklyGaps ?? [],
        laborTaxonomy,
      );
    } catch {
      // Variance computation failed — skip silently
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href={`/projects/${projectId}/execution-map`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("backToExecutionMap")}
        </Link>
      </div>

      <LivingGraphView
        projectId={projectId}
        data={data}
        milestones={fullMilestones}
        tasks={fullTasks}
        laborCapacity={laborCapacity}
        laborResources={laborResources}
        laborActivities={laborActivities}
        tradeTaxonomy={laborTaxonomy}
        lookaheadActivities={lookaheadResult?.allActivities}
        laborVariance={laborVariance}
        varianceResult={varianceResult}
        varianceCauses={varianceCauses}
      />
    </div>
  );
}
