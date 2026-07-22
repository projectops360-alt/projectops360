// ============================================================================
// ProjectOps360° — Living Graph page (server component)
// ============================================================================
// Fetches process nodes/edges + timeline events through Supabase, enriches
// them with roadmap task / milestone data, normalizes everything into the
// LivingGraphData contract and renders the client visualization.
// ============================================================================

import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Radio } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeOrphanGraphNodes } from "@/lib/roadmap/living-graph-sync";
import { resolveCanonicalNodeLabel } from "@/lib/graph/node-label";
import { loadRealtimeGraphSignature } from "@/lib/living-graph-realtime-ui/load-snapshot";
import { LivingGraphAutoRefresh } from "@/components/graph/living-graph-auto-refresh";
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
import { computeResourceCapacity } from "@/lib/capacity/service";
import type { ResourceCapacityResult } from "@/lib/capacity/service";
import { isEventRelationshipsEnabled } from "@/lib/graph/event-relationships-flag";
import { loadCanonicalEventProjection } from "@/lib/graph/event-relationship-loader";
import type { TaskAttachmentRef } from "@/lib/graph/task-case-analysis";
import { loadKnowledgeGraphProjection } from "@/lib/graph/knowledge-graph-loader";
import { adaptCanonicalKnowledgeGraph } from "@/lib/graph/canonical-graph-living-adapter";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Terminal task statuses — a completed task has no ACTIVE impediment, so a stale
// is_blocked flag on it must never read as blocked in the graph (REG-008 / ADR-006).
const TASK_COMPLETED_STATUSES = new Set(["done", "tested"]);

type TaskEnrichment = Pick<
  RoadmapTask,
  | "id"
  | "title"
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
    // "Different views, same truth" (REG-018 / CAP-001): the node label comes
    // from the CANONICAL owner (roadmap_tasks / milestones) so the graph shows
    // the same title as the Workboard — never a stale process_node snapshot
    // captured at event time. See resolveCanonicalNodeLabel (unit-tested).
    label: resolveCanonicalNodeLabel({
      processTitle: row.title,
      taskTitle: task?.title,
      milestoneTitle: milestone?.title,
    }),
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
    // A completed task is never blocked, even with a stale is_blocked flag (REG-008).
    isBlocked:
      !(task != null && TASK_COMPLETED_STATUSES.has(task.status)) &&
      (row.node_type === "blocker_event" ||
        (task?.is_blocked ?? false) ||
        meta.is_blocked === true),
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

  // Full task rows for the WHOLE project — the canonical owner (roadmap_tasks).
  // CAP-001 / REG-018: the milestone task census must include tasks that never
  // materialized a process_node (e.g. still `not_started`), so the Living Graph
  // counts + UX-008 tooltip agree with the Workboard. Also powers enrichment and
  // in-graph editing (TaskFormDialog needs the full rows).
  const tasksResult = await supabase
    .from("roadmap_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });

  const fullTasks = (tasksResult.data ?? []) as RoadmapTask[];
  const fullMilestones = (milestonesResult.data ?? []) as Milestone[];

  // ── Subtask visibility layer (Task Execution Map) ───────────────────────────
  // Fetch project subtasks for the NotebookLM-style progressive expansion.
  // RBAC is already enforced above (org-scoped project ownership check + RLS on
  // task_subtasks). The table may not exist before its migration — treat errors
  // as no subtasks (the graph simply shows no expansion affordances). Never
  // written; presentation-only. Deleted rows filtered out client-side too.
  const subtasksResult = await supabase
    .from("task_subtasks")
    .select("id, task_id, title, status, priority, progress, owner_id, due_date, is_critical, blocked_reason, sort_order, created_at, deleted_at")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  const subtasks = (subtasksResult.data ?? []) as {
    id: string; task_id: string; title: string; status: string; priority: string;
    progress: number; owner_id: string | null; due_date: string | null;
    is_critical: boolean; blocked_reason: string | null; sort_order: number;
    created_at: string; deleted_at: string | null;
  }[];

  // Case Explorer evidence context. Read-only and project/org scoped; storage
  // paths are deliberately not sent to the client because the story only needs
  // the safe display metadata.
  const attachmentsResult = await supabase
    .from("project_task_attachments")
    .select("id, task_id, subtask_id, file_name, mime_type, created_at")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const taskAttachments: TaskAttachmentRef[] = (attachmentsResult.data ?? []).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    subtaskId: row.subtask_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }));

  // Resolve subtask owner display names (read-only team context for the
  // inspector). Uses the admin client only to read names — access is already
  // gated by the project-ownership check above (same pattern as the Workboard).
  const subtaskOwnerIds = [...new Set(subtasks.map((s) => s.owner_id).filter((x): x is string => !!x))];
  const subtaskOwnerNames: Record<string, string> = {};
  if (subtaskOwnerIds.length > 0) {
    const { data: ownerProfiles } = await createAdminClient()
      .from("profiles")
      .select("id, display_name")
      .in("id", subtaskOwnerIds);
    for (const p of (ownerProfiles ?? []) as { id: string; display_name: string | null }[]) {
      if (p.display_name) subtaskOwnerNames[p.id] = p.display_name;
    }
  }

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
    // Always record the project this payload was built for so the client view
    // can scope every layer to it (defense-in-depth against cross-project leaks
    // when data is reused across mounts).
    requestedProjectId: projectId,
  };

  // ── Canonical-event Relationships view (CAP-045 extension) ───────────────────
  // A READ-ONLY PROJECTION over the canonical event store, enabled by default
  // for every project. An explicit global kill switch or
  // project denylist can disable it server-side for rollback/quarantine.
  //
  // Status contract (Part B): the page ALWAYS sets `canonicalEventProjectionStatus`
  // so the "events" view can render an explicit banner instead of silently
  // falling back to operational process_nodes/process_edges:
  //   * explicit OFF        → "disabled"  (the three projection arrays stay
  //                                    UNDEFINED — preserves the byte-identical
  //                                    invariant for disabled behavior).
  //   * flag ON, 0 events   → "empty".
  //   * flag ON, ≥1 event    → "ready" (or "truncated" if the log exceeded the limit).
  //   * loader error/throw   → "error".
  //
  // Coexists with the operational projection: process_nodes/process_edges are
  // NOT substituted and the milestones/activities views are untouched. The
  // events read uses the AUTHENTICATED client (RLS) — never the admin/service
  // role for an ordinary read — and is scoped to this project + organization.
  if (!isEventRelationshipsEnabled(projectId)) {
    data.canonicalEventProjectionStatus = "disabled";
  } else {
    try {
      // Uses the AUTHENTICATED client (RLS) via the extracted loader — never an
      // admin/service role for this ordinary read. Scoped to org + project.
      const projection = await loadCanonicalEventProjection(
        supabase,
        org.organizationId,
        projectId,
      );
      if (projection.status === "error") {
        // Log read failed — surface explicitly, do not fall back silently.
        data.canonicalEventProjectionStatus = "error";
      } else {
        data.canonicalEvents = projection.canonicalEvents;
        data.eventRelationships = projection.eventRelationships;
        data.eventsTruncated = projection.eventsTruncated;
        if (projection.eventsTruncated) {
          data.canonicalEventProjectionStatus = "truncated";
        } else if (projection.canonicalEvents.length === 0) {
          data.canonicalEventProjectionStatus = "empty";
        } else {
          data.canonicalEventProjectionStatus = "ready";
        }
      }
    } catch (err) {
      // Non-fatal to the page, but EXPLICIT in the status — the events view
      // shows an error banner rather than falling back to operational nodes.
      console.error("Living Graph canonical-event projection failed:", err);
      data.canonicalEventProjectionStatus = "error";
    }
  }

  // Canonical Knowledge layer: authenticated, tenant/project-scoped, read-only
  // projection over P3-T2. It never writes process_nodes/process_edges and
  // never changes lifecycle, confidence, provenance or evidence.
  try {
    const knowledgeProjection = await loadKnowledgeGraphProjection(supabase, org.organizationId, projectId);
    data.knowledgeGraphProjectionStatus = knowledgeProjection.status;
    if (knowledgeProjection.projection) {
      const adapted = adaptCanonicalKnowledgeGraph(knowledgeProjection.projection);
      data.knowledgeGraphNodes = adapted.nodes;
      data.knowledgeGraphEdges = adapted.edges;
      data.canonicalGraphSpecVersion = knowledgeProjection.projection.specVersion;
    }
  } catch (error) {
    console.error("Living Graph knowledge projection failed:", error);
    data.knowledgeGraphProjectionStatus = "error";
  }

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

  // Generic Resource Capacity (Workforce Intelligence Layer) — non-fatal.
  let resourceCapacity: ResourceCapacityResult | undefined;
  try {
    resourceCapacity = await computeResourceCapacity(org, projectId, { weeks: 4 });
  } catch {
    // No capacity data — the workforce overlay simply stays empty.
  }

  // Auto-refresh baseline: the content signature the client compares against to
  // decide when to router.refresh() (on a live event notice or a poll). Cheap;
  // never fatal.
  let autoRefreshSignature = "";
  try {
    autoRefreshSignature = (await loadRealtimeGraphSignature(projectId)) ?? "";
  } catch {
    // Fall through with an empty signature — the first poll will set it.
  }

  return (
    <div className="space-y-2">
      {/* Sprint #2 — slim, single-row header so the graph owns the viewport.
          Title stays; the subtitle becomes a compact inline hint (hidden on
          narrow screens). The graph canvas below is the protagonist. */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="hidden truncate text-xs text-muted-foreground md:block">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <LivingGraphAutoRefresh
            projectId={projectId}
            organizationId={org.organizationId}
            userId={org.userId}
            initialSignature={autoRefreshSignature}
          />
          <Link
            href={`/projects/${projectId}/execution-map/realtime`}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
          >
            <Radio className="h-3.5 w-3.5" aria-hidden />
            {t("realtimeCta")}
          </Link>
          <Link
            href={`/projects/${projectId}/execution-map`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t("backToExecutionMap")}
          </Link>
        </div>
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
        resourceCapacity={resourceCapacity}
        subtasks={subtasks}
        subtaskOwnerNames={subtaskOwnerNames}
        taskAttachments={taskAttachments}
      />
    </div>
  );
}
