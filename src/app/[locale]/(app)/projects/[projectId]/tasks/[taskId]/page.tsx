import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import type { Subtask } from "@/lib/subtasks/types";
import type { ExternalDependencyInfo, ParentTaskInfo } from "@/lib/subtasks/map-model";
import { ExecutionMapClient } from "@/components/task-execution-map/execution-map-client";

// Task Execution Map — the task-level execution mind map (subtasks, blockers,
// dependencies, calculated progress). The Living Graph stays the project-level
// visualization; this page is the drill-down for ONE task.
export const dynamic = "force-dynamic";

export default async function TaskExecutionMapPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; taskId: string }>;
}) {
  const { locale, projectId, taskId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("taskExecutionMap");
  const org = await getOrgContext();
  const supabase = await createClient();

  const [taskRes, subtasksRes, depsRes] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select("id, title, status, progress, assigned_to, estimate_hours, actual_hours, is_critical, is_blocked, blocker_reason")
      .eq("id", taskId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", taskId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("task_dependencies")
      .select("predecessor_id")
      .eq("successor_id", taskId)
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId),
  ]);

  const task = taskRes.data;
  if (!task) notFound();

  const subtasks = ((subtasksRes.data as Subtask[] | null) ?? []).map((s) => s);

  // External predecessor tasks (dotted dependency nodes on the map).
  const predecessorIds = ((depsRes.data as { predecessor_id: string }[] | null) ?? []).map(
    (d) => d.predecessor_id,
  );
  let dependencies: ExternalDependencyInfo[] = [];
  if (predecessorIds.length > 0) {
    const { data: predTasks } = await supabase
      .from("roadmap_tasks")
      .select("id, title, status")
      .in("id", predecessorIds)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null);
    dependencies = ((predTasks as { id: string; title: string; status: string }[] | null) ?? []).map(
      (p) => ({ id: p.id, title: p.title, status: p.status, gatesSubtaskId: null }),
    );
  }

  // Owner names for avatars/filters (read-only; access already gated above).
  const admin = createAdminClient();
  const ownerIds = [
    ...new Set([
      ...subtasks.map((s) => s.owner_id).filter((x): x is string => !!x),
      ...(task.assigned_to ? [task.assigned_to] : []),
    ]),
  ];
  const ownerNames: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", ownerIds);
    for (const p of (profiles ?? []) as { id: string; display_name: string | null }[]) {
      if (p.display_name) ownerNames[p.id] = p.display_name;
    }
  }
  // Assignable people: project team members (existing convention).
  const { data: teamRows } = await admin
    .from("project_team_members")
    .select("user_id, display_name")
    .eq("project_id", projectId)
    .not("user_id", "is", null);
  const owners = [
    ...new Map(
      [
        ...((teamRows ?? []) as { user_id: string | null; display_name: string | null }[])
          .filter((m): m is { user_id: string; display_name: string | null } => !!m.user_id)
          .map((m) => [m.user_id, { id: m.user_id, name: m.display_name ?? ownerNames[m.user_id] ?? m.user_id.slice(0, 8) }] as const),
        ...ownerIds.map((id) => [id, { id, name: ownerNames[id] ?? id.slice(0, 8) }] as const),
      ],
    ).values(),
  ];

  const parent: ParentTaskInfo = {
    id: task.id,
    title: task.title,
    status: task.status,
    progress: task.progress,
    ownerId: task.assigned_to,
    ownerName: task.assigned_to ? (ownerNames[task.assigned_to] ?? null) : null,
    isCritical: !!task.is_critical,
    estimateHours: task.estimate_hours,
    actualHours: task.actual_hours,
  };

  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[560px] flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        <Link
          href={`/${locale}/projects/${projectId}/workboard`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("backToWorkboard")}
        </Link>
        <h1 className="truncate text-sm font-semibold text-foreground">
          {t("pageTitle")} · {task.title}
        </h1>
      </div>
      <div className="min-h-0 flex-1 rounded-lg border border-border bg-background">
        <ExecutionMapClient
          projectId={projectId}
          parent={parent}
          subtasks={subtasks}
          dependencies={dependencies}
          ownerNames={ownerNames}
          owners={owners}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
