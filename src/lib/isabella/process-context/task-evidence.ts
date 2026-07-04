// ============================================================================
// ProjectOps360° — Isabella Process Context · task/subtask evidence
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL
//
// Produces sanitized task/subtask summaries, aggregate counts, evidence packets
// and citations from RBAC-scoped rows (reuses the Task 1B `retrieveTaskRows`
// gate). PURE builders + a thin server retrieval. Task evidence is VERIFIED and
// supports factual_project_data/status_summary — NEVER root_cause_claim by
// default (that needs separate process evidence).
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { TaskReportRow } from "@/lib/isabella/task-report";
import { retrieveTaskRows } from "@/lib/isabella/task-report-service";
import type { IsabellaEvidencePacket, IsabellaCitation } from "@/lib/isabella/process-intelligence/types";
import { buildIsabellaCitation, buildIsabellaEvidencePacket, safeRef } from "./evidence-builder";
import type { IsabellaProjectScope, IsabellaTaskContext, IsabellaTaskSummary } from "./types";

const TERMINAL = new Set(["done", "tested"]);
const DEFAULT_ITEM_LIMIT = 100;

/** Minimal subtask row this layer reads (never a raw payload). */
export interface SubtaskLite {
  id: string;
  task_id: string;
  title: string | null;
  status: string;
  priority: string | null;
  owner_id: string | null;
  ownerName?: string | null;
  due_date: string | null;
  blocked_reason: string | null;
  updated_at: string | null;
}

function taskSummary(r: TaskReportRow): IsabellaTaskSummary {
  return {
    taskId: r.id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    milestoneId: r.milestoneId,
    milestoneTitle: r.milestoneTitle,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    dueDate: r.dueDate,
    parentTaskId: null,
    isSubtask: false,
    blockedReason: r.blockerReason,
    updatedAt: r.updatedAt,
    citationRef: safeRef("task", r.id),
  };
}

function subtaskSummary(s: SubtaskLite): IsabellaTaskSummary {
  return {
    taskId: s.id,
    title: s.title ?? "",
    status: s.status,
    priority: s.priority,
    milestoneId: null,
    milestoneTitle: null,
    ownerId: s.owner_id,
    ownerName: s.ownerName ?? null,
    dueDate: s.due_date,
    parentTaskId: s.task_id,
    isSubtask: true,
    blockedReason: s.blocked_reason,
    updatedAt: s.updated_at,
    citationRef: safeRef("subtask", s.id),
  };
}

/** Map already-retrieved task rows to sanitized summaries. Pure. */
export function mapTaskRowsToSummaries(rows: TaskReportRow[]): IsabellaTaskSummary[] {
  return rows.map(taskSummary);
}

function inc(map: Record<string, number>, key: string | null | undefined): void {
  const k = key ?? "unknown";
  map[k] = (map[k] ?? 0) + 1;
}

/** Deterministic aggregate context from already-retrieved rows. Pure. */
export function buildTaskContext(
  tasks: TaskReportRow[],
  subtasks: SubtaskLite[],
  asOf: string,
): IsabellaTaskContext {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let withoutMilestoneCount = 0;
  let withoutOwnerCount = 0;
  let overdueCount = 0;
  let blockedCount = 0;
  const day = asOf.slice(0, 10);

  for (const t of tasks) {
    inc(byStatus, t.status);
    inc(byPriority, t.priority);
    if (t.milestoneId == null) withoutMilestoneCount += 1;
    if (t.ownerId == null) withoutOwnerCount += 1;
    if (t.isBlocked) blockedCount += 1;
    if (t.dueDate && t.dueDate.slice(0, 10) < day && !TERMINAL.has(t.status)) overdueCount += 1;
  }

  return {
    totalVisibleTasks: tasks.length,
    tasks: tasks.slice(0, DEFAULT_ITEM_LIMIT).map(taskSummary),
    subtasks: subtasks.slice(0, DEFAULT_ITEM_LIMIT).map(subtaskSummary),
    byStatus,
    byPriority,
    withoutMilestoneCount,
    withoutOwnerCount,
    overdueCount,
    blockedCount,
  };
}

function summarize(s: IsabellaTaskSummary, es: boolean): string {
  const parts = es
    ? [
        `Estado: ${s.status}`,
        s.priority ? `prioridad ${s.priority.toUpperCase()}` : null,
        s.milestoneTitle ? `hito ${s.milestoneTitle}` : "sin hito",
        s.ownerName ? `responsable ${s.ownerName}` : "sin responsable",
        s.dueDate ? `vence ${s.dueDate.slice(0, 10)}` : null,
        s.blockedReason ? `bloqueada: ${s.blockedReason}` : null,
      ]
    : [
        `Status: ${s.status}`,
        s.priority ? `priority ${s.priority.toUpperCase()}` : null,
        s.milestoneTitle ? `milestone ${s.milestoneTitle}` : "no milestone",
        s.ownerName ? `owner ${s.ownerName}` : "no owner",
        s.dueDate ? `due ${s.dueDate.slice(0, 10)}` : null,
        s.blockedReason ? `blocked: ${s.blockedReason}` : null,
      ];
  return parts.filter(Boolean).join("; ");
}

/**
 * Build verified evidence packets + citations from task/subtask summaries. Task
 * evidence supports factual data + status summaries, and explicitly DISALLOWS
 * root_cause_claim (that requires separate process evidence). Pure.
 */
export function buildTaskEvidence(
  summaries: IsabellaTaskSummary[],
  scope: IsabellaProjectScope,
): { packets: IsabellaEvidencePacket[]; citations: IsabellaCitation[] } {
  const es = scope.locale === "es";
  const packets: IsabellaEvidencePacket[] = [];
  const citations: IsabellaCitation[] = [];
  for (const s of summaries) {
    const kind = s.isSubtask ? "subtask" : "task";
    packets.push(
      buildIsabellaEvidencePacket({
        evidenceId: s.citationRef,
        evidenceType: s.isSubtask ? "subtask" : "task",
        sourceKind: "deterministic_project_data",
        sourceId: s.citationRef,
        projectId: scope.projectId,
        organizationId: scope.organizationId,
        title: s.title,
        summary: summarize(s, es),
        citationLabel: es ? (s.isSubtask ? "Subtarea" : "Tarea del Workboard") : s.isSubtask ? "Subtask" : "Workboard task",
        citationRef: s.citationRef,
        updatedAt: s.updatedAt ?? null,
        confidence: "verified",
        allowedClaims: ["factual_project_data", "status_summary"],
        disallowedClaims: ["root_cause_claim"],
      }),
    );
    citations.push(
      buildIsabellaCitation({
        sourceLabel: es ? (s.isSubtask ? "Subtarea" : "Tarea del Workboard") : s.isSubtask ? "Subtask" : "Workboard task",
        entityType: s.isSubtask ? "subtask" : "task",
        entityTitle: s.title,
        safeRef: s.citationRef,
        confidence: "verified",
      }),
    );
    void kind;
  }
  return { packets, citations };
}

// ── Server retrieval (RBAC-scoped) ───────────────────────────────────────────

async function retrieveSubtaskRows(org: OrgContext, projectId: string): Promise<SubtaskLite[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("task_subtasks")
    .select("id, task_id, title, status, priority, owner_id, due_date, blocked_reason, updated_at")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .limit(2000);
  if (error) return [];
  const rows = (data ?? []) as SubtaskLite[];
  // Resolve owner names within the caller's org (no cross-org leak).
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter((v): v is string => !!v))];
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("organization_id", org.organizationId)
      .in("id", ownerIds);
    const nameById = new Map((profiles ?? []).filter((p) => p.display_name).map((p) => [p.id, p.display_name as string]));
    for (const r of rows) r.ownerName = r.owner_id ? nameById.get(r.owner_id) ?? null : null;
  }
  return rows;
}

export interface TaskEvidenceOptions {
  includeSubtasks?: boolean;
  asOf?: string;
  itemLimit?: number;
}

export type TaskEvidenceOutcome =
  | {
      ok: true;
      projectName: string;
      context: IsabellaTaskContext;
      packets: IsabellaEvidencePacket[];
      citations: IsabellaCitation[];
    }
  | { ok: false; reason: "no_project" | "not_authorized" | "unavailable" };

/** RBAC-scoped task/subtask evidence for a project. Never throws. */
export async function getIsabellaTaskEvidence(
  org: OrgContext,
  scope: IsabellaProjectScope,
  options: TaskEvidenceOptions = {},
): Promise<TaskEvidenceOutcome> {
  const lang = scope.locale === "es" ? "es" : "en";
  const retrieved = await retrieveTaskRows({ org, projectId: scope.projectId, language: lang });
  if (!retrieved.ok) return { ok: false, reason: retrieved.reason };

  const subtasks = options.includeSubtasks ? await retrieveSubtaskRows(org, scope.projectId) : [];
  const asOf = options.asOf ?? new Date().toISOString();
  const context = buildTaskContext(retrieved.rows, subtasks, asOf);
  const summaries = [...context.tasks, ...context.subtasks];
  const { packets, citations } = buildTaskEvidence(summaries, scope);
  return { ok: true, projectName: retrieved.projectName, context, packets, citations };
}
