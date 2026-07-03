// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · Initial Snapshot Loader (server)
// ============================================================================
// Builds the INITIAL hierarchy-safe snapshot the realtime UI consumes, as a
// Task 4 HierarchicalGraphDelta (all entities "added", basedOnVersion 0 →
// producedVersion 1). It reads the CANONICAL owners (milestones / roadmap_tasks
// / task_subtasks) — the same source the Workboard shows ("different views,
// same truth") — never process_nodes, never project_event_log. Org/project
// scoped (RLS). Owner names are resolved read-only. The UI never receives raw
// DB rows: it receives the approved delta shape produced by the Task 4 builder.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { buildDeltaFromRecalculation } from "@/lib/living-graph/realtime";
import type {
  HierarchicalGraphDelta,
  LivingGraphChangedEntity,
  LivingGraphRecalculationResult,
} from "@/lib/living-graph/realtime";
import { LGRE_ENGINE_VERSION, LGRE_CONFIG_VERSION } from "@/lib/living-graph/realtime";

export interface RealtimeGraphSnapshot {
  projectId: string;
  organizationId: string;
  delta: HierarchicalGraphDelta;
  ownerNames: Record<string, string>;
  /** Milestone id → title, for scope breadcrumbs / the milestone picker. */
  milestones: { id: string; title: string }[];
}

interface MilestoneRow { id: string; title: string; status: string | null; progress_percent: number | null; order_index: number | null; }
interface TaskRow { id: string; title: string; status: string | null; priority: string | null; progress: number | null; milestone_id: string | null; assigned_to: string | null; is_blocked: boolean | null; is_critical: boolean | null; end_date: string | null; }
interface SubtaskRow { id: string; task_id: string; title: string; status: string; priority: string; progress: number; owner_id: string | null; due_date: string | null; is_critical: boolean; blocked_reason: string | null; sort_order: number; }

function added(id: string, payload: Record<string, unknown>): LivingGraphChangedEntity {
  return { id, change: "added", payload, sourceNoticeIds: [], sourceEventIds: [] };
}

/**
 * Load the initial realtime snapshot delta for a project. Returns null when the
 * project isn't in the caller's org (RBAC — fail closed). Never throws on a
 * missing subtasks table (treated as no subtasks).
 */
export async function loadRealtimeGraphSnapshot(projectId: string): Promise<RealtimeGraphSnapshot | null> {
  const org = await getOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return null;

  const [milestonesRes, tasksRes] = await Promise.all([
    supabase
      .from("milestones")
      .select("id, title, status, progress_percent, order_index")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    supabase
      .from("roadmap_tasks")
      .select("id, title, status, priority, progress, milestone_id, assigned_to, is_blocked, is_critical, end_date")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
  ]);
  const { data: subtasksData } = await supabase
    .from("task_subtasks")
    .select("id, task_id, title, status, priority, progress, owner_id, due_date, is_critical, blocked_reason, sort_order")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const milestones = (milestonesRes.data ?? []) as MilestoneRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const subtasks = (subtasksData ?? []) as SubtaskRow[];

  const subtasksByTask = new Map<string, SubtaskRow[]>();
  for (const s of subtasks) {
    if (!subtasksByTask.has(s.task_id)) subtasksByTask.set(s.task_id, []);
    subtasksByTask.get(s.task_id)!.push(s);
  }

  const nodeChanges: LivingGraphChangedEntity[] = [];
  const edgeChanges: LivingGraphChangedEntity[] = [];

  for (const m of milestones) {
    nodeChanges.push(
      added(`milestone:${m.id}`, {
        nodeKind: "milestone",
        title: m.title,
        status: m.status,
        progress: m.progress_percent,
        milestone_id: m.id,
      }),
    );
  }
  for (const t of tasks) {
    const subs = subtasksByTask.get(t.id) ?? [];
    nodeChanges.push(
      added(`task:${t.id}`, {
        nodeKind: "task",
        title: t.title,
        status: t.status,
        priority: t.priority,
        progress: t.progress,
        milestone_id: t.milestone_id,
        owner_id: t.assigned_to,
        is_blocked: t.is_blocked === true,
        is_critical: t.is_critical === true,
        due_date: t.end_date,
        subtask_total: subs.length,
        subtask_completed: subs.filter((s) => s.status === "completed").length,
        subtask_blocked: subs.filter((s) => s.status === "blocked").length,
      }),
    );
    if (t.milestone_id) {
      edgeChanges.push(
        added(`hierarchy:milestone:${t.milestone_id}:task:${t.id}`, {
          hierarchy: true,
          edgeKind: "hierarchy",
          source: `milestone:${t.milestone_id}`,
          target: `task:${t.id}`,
        }),
      );
    }
    for (const s of subs) {
      nodeChanges.push(
        added(`subtask:${s.id}`, {
          nodeKind: "subtask",
          is_subtask: true,
          parent_task_id: `task:${t.id}`,
          parent_node_id: `task:${t.id}`,
          milestone_id: t.milestone_id,
          title: s.title,
          status: s.status,
          priority: s.priority,
          progress: s.status === "completed" ? 100 : s.progress,
          owner_id: s.owner_id,
          due_date: s.due_date,
          is_critical: s.is_critical,
          blocked_reason: s.blocked_reason,
        }),
      );
      edgeChanges.push(
        added(`hierarchy:task:${t.id}:subtask:${s.id}`, {
          hierarchy: true,
          edgeKind: "hierarchy",
          source: `task:${t.id}`,
          target: `subtask:${s.id}`,
        }),
      );
    }
  }

  // Owner names (read-only; access already gated by the project-ownership check).
  const ownerIds = [
    ...new Set(
      [...tasks.map((t) => t.assigned_to), ...subtasks.map((s) => s.owner_id)].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const ownerNames: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await createAdminClient()
      .from("profiles")
      .select("id, display_name")
      .in("id", ownerIds);
    for (const p of (profiles ?? []) as { id: string; display_name: string | null }[]) {
      if (p.display_name) ownerNames[p.id] = p.display_name;
    }
  }

  const result: LivingGraphRecalculationResult = {
    resultId: `snapshot:${projectId}`,
    scope: { organizationId: org.organizationId, projectId },
    mode: "full",
    basedOnSnapshotVersion: 0,
    affectedNodeIds: nodeChanges.map((n) => n.id),
    affectedEdgeIds: edgeChanges.map((e) => e.id),
    nodeChanges,
    edgeChanges,
    reasons: ["upstream_projection_refreshed"],
    confidence: "high",
    warnings: [],
    engineVersion: LGRE_ENGINE_VERSION,
    configVersion: LGRE_CONFIG_VERSION,
    generatedAt: new Date().toISOString(),
  };

  const delta = buildDeltaFromRecalculation({
    result,
    basedOnVersion: 0,
    producedVersion: 1,
    rootScope: { type: "project", id: null },
    evidenceLayerIncluded: false,
    deltaId: `snapshot:${projectId}:v1`,
  });

  return {
    projectId,
    organizationId: org.organizationId,
    delta,
    ownerNames,
    milestones: milestones.map((m) => ({ id: m.id, title: m.title })),
  };
}
