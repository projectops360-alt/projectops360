// ============================================================================
// ProjectOps360° — Subtasks · Server-side Isabella facts resolver
// ============================================================================
// Resolves the DETERMINISTIC task-execution facts for an Isabella ask about a
// task or subtask. Re-validates ownership against the trusted session org
// (the client-supplied entity id is a lookup key, never authorization —
// PD-012 pattern). Returns null when the entity doesn't resolve in this org.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import { buildTaskExecutionFacts } from "./isabella-context";
import type { Subtask } from "./types";

export async function getTaskExecutionFactsForIsabella(args: {
  org: OrgContext;
  projectId: string;
  entityType: "task" | "subtask";
  entityId: string;
  language: "en" | "es";
}): Promise<string | null> {
  const supabase = createAdminClient();

  // Resolve the parent task id (a subtask ask is answered about its task).
  let taskId = args.entityId;
  if (args.entityType === "subtask") {
    const { data: sub } = await supabase
      .from("task_subtasks")
      .select("task_id")
      .eq("id", args.entityId)
      .eq("project_id", args.projectId)
      .eq("organization_id", args.org.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!sub) return null;
    taskId = (sub as { task_id: string }).task_id;
  }

  const [{ data: task }, { data: subtasks }] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select("id, title, status, progress")
      .eq("id", taskId)
      .eq("project_id", args.projectId)
      .eq("organization_id", args.org.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", taskId)
      .eq("project_id", args.projectId)
      .eq("organization_id", args.org.organizationId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);
  if (!task) return null;

  const rows = (subtasks as Subtask[] | null) ?? [];
  // Owner display names (read-only, org-validated above).
  const ownerIds = [...new Set(rows.map((s) => s.owner_id).filter((x): x is string => !!x))];
  const ownerNames: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ownerIds);
    for (const p of (profiles ?? []) as { id: string; display_name: string | null }[]) {
      if (p.display_name) ownerNames[p.id] = p.display_name;
    }
  }

  // Most recent recorded progress movement (audit-backed, never invented).
  let recentProgressChange: { from: number; to: number; occurredAt: string } | null = null;
  const { data: progressEvents } = await supabase
    .from("project_event_log")
    .select("payload, occurred_at")
    .eq("organization_id", args.org.organizationId)
    .eq("project_id", args.projectId)
    .in("event_type", ["ParentTaskProgressRecalculated", "ParentTaskProgressOverride"])
    .eq("subject_id", taskId)
    .order("occurred_at", { ascending: false })
    .limit(1);
  const latest = (progressEvents ?? [])[0] as
    | { payload: { old_value?: unknown; new_value?: unknown }; occurred_at: string }
    | undefined;
  if (
    latest &&
    typeof latest.payload?.old_value === "number" &&
    typeof latest.payload?.new_value === "number"
  ) {
    recentProgressChange = {
      from: latest.payload.old_value,
      to: latest.payload.new_value,
      occurredAt: latest.occurred_at,
    };
  }

  const t = task as { title: string; status: string; progress: number };
  return buildTaskExecutionFacts({
    taskTitle: t.title,
    taskStatus: t.status,
    manualProgress: t.progress,
    subtasks: rows,
    ownerNames,
    recentProgressChange,
    asOf: new Date(),
    language: args.language,
  });
}
