import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { buildStatusReport } from "@/lib/execution/status-report";
import { StatusReportClient } from "./status-report-client";

export default async function ProjectStatusPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title_i18n, project_type, start_date, target_end_date")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) notFound();

  const [milestonesRes, tasksRes, depsRes, materialsRes, budgetRes, peopleRes, resourcesRes] = await Promise.all([
    supabase
      .from("milestones")
      .select("id, title, order_index")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("order_index"),
    supabase
      .from("roadmap_tasks")
      .select("id, title, status, milestone_id, start_date, end_date, assigned_to, assigned_resource_id, blocker_reason")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("order_index"),
    supabase
      .from("task_dependencies")
      .select("predecessor_id, successor_id, dependency_type")
      .eq("project_id", projectId),
    supabase
      .from("material_requirements")
      .select("name, status, quantity")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("budget_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("deleted_at", null),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("organization_id", org.organizationId),
    supabase
      .from("resources")
      .select("id, name")
      .eq("organization_id", org.organizationId)
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);

  const peopleNames: Record<string, string> = {};
  for (const p of peopleRes.data ?? []) peopleNames[p.id] = p.display_name || "—";
  const resourceNames: Record<string, string> = {};
  for (const r of resourcesRes.data ?? []) resourceNames[r.id] = r.name;

  const report = buildStatusReport({
    project: {
      title: getI18nValue(project.title_i18n, locale as Locale) || "Project",
      project_type: project.project_type ?? "general",
      start_date: project.start_date,
      target_end_date: project.target_end_date,
    },
    milestones: milestonesRes.data ?? [],
    tasks: (tasksRes.data ?? []) as Parameters<typeof buildStatusReport>[0]["tasks"],
    dependencies: depsRes.data ?? [],
    peopleNames,
    resourceNames,
    materials: materialsRes.data ?? [],
    budgetItemCount: budgetRes.count ?? 0,
  });

  return <StatusReportClient report={report} locale={locale as Locale} />;
}
