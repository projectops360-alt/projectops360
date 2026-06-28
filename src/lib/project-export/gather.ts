// ============================================================================
// ProjectOps360° — Project Export — data gathering (server, READ-ONLY)
// ============================================================================
// Reads every project entity needed for an export. Strictly read-only: it issues
// SELECTs only and never writes, so an export can never mutate the source
// project (TASK 7). All queries are org+project scoped with deleted_at IS NULL.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

type Supabase = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

export interface ProjectBundle {
  project: Row | null;
  milestones: Row[];
  tasks: Row[];
  dependencies: Row[];
  risks: Row[];
  decisions: Row[];
  actionItems: Row[];
  communications: Row[];
  meetings: Row[];
  memory: Row[];
  documents: Row[];
  stakeholders: Row[];
  budget: Row[];
  /** The generated closeout block stored on the latest completed closing meeting. */
  closeout: Row | null;
  warnings: string[];
}

export async function gatherProjectBundle(
  organizationId: string,
  projectId: string,
): Promise<ProjectBundle> {
  const supabase: Supabase = createAdminClient();
  const warnings: string[] = [];

  const scoped = (table: string, cols = "*") =>
    supabase.from(table).select(cols).eq("organization_id", organizationId).eq("project_id", projectId).is("deleted_at", null);

  // Each query is wrapped so one missing/empty table never fails the whole export.
  const safe = async (label: string, q: PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> => {
    try {
      const { data, error } = await q;
      if (error) { warnings.push(`Could not read ${label}`); return []; }
      return (data ?? []) as Row[];
    } catch {
      warnings.push(`Could not read ${label}`);
      return [];
    }
  };

  const [
    projectRes, milestones, tasks, dependencies, risks, decisions,
    actionItems, communications, meetings, memory, documents, stakeholders, budget,
    closingRes,
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle(),
    safe("milestones", scoped("milestones").order("order_index", { ascending: true })),
    safe("tasks", scoped("roadmap_tasks").order("order_index", { ascending: true })),
    safe("dependencies", scoped("task_dependencies")),
    safe("risks", scoped("risks")),
    safe("decisions", scoped("decisions")),
    safe("action items", scoped("action_items")),
    safe("communications", scoped("communication_items")),
    safe("meetings", scoped("meetings")),
    safe("project memory", scoped("project_memory_items")),
    safe("documents", scoped("documents")),
    safe("stakeholders", scoped("stakeholders")),
    safe("budget", scoped("budget_items")),
    supabase.from("meetings")
      .select("ai_summary")
      .eq("project_id", projectId).eq("organization_id", organizationId)
      .eq("meeting_type", "closing").eq("meeting_status", "completed").is("deleted_at", null)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (projectRes.error || !projectRes.data) warnings.push("Could not read project profile");
  const closeout = ((closingRes.data?.ai_summary as Row | null)?.closeout as Row | undefined) ?? null;
  if (!closeout) warnings.push("No generated Closeout Report found");

  return {
    project: (projectRes.data as Row | null) ?? null,
    milestones, tasks, dependencies, risks, decisions, actionItems,
    communications, meetings, memory, documents, stakeholders, budget,
    closeout, warnings,
  };
}
