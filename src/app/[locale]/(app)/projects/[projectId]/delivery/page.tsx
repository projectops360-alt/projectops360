import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { getFrameworkByProject, mapProjectType } from "@/lib/delivery/service";
import { DeliveryClient } from "./delivery-client";

export const dynamic = "force-dynamic";

export default async function DeliveryPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ setup?: string }>;
}) {
  const { locale, projectId } = await params;
  const { setup } = await searchParams;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects").select("id, slug, title_i18n, project_type")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!project) notFound();

  const admin = createAdminClient();
  const framework = await getFrameworkByProject(admin, org.organizationId, projectId);

  const [columnsRes, eventsRes, charterRes, backlogRes, cyclesRes, alertsRes, milestonesRes, risksRes] = await Promise.all([
    framework
      ? supabase.from("project_board_columns").select("id, name, position, is_done_column").eq("framework_id", framework.id).order("position")
      : Promise.resolve({ data: [] }),
    supabase.from("project_framework_events").select("id, event_type, event_summary, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10),
    supabase.from("project_charters").select("project_goal, objectives, status").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle(),
    supabase.from("project_backlog_items").select("*").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("position"),
    supabase.from("project_execution_cycles").select("*").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("position"),
    supabase.from("project_scope_creep_alerts").select("*").eq("project_id", projectId).eq("organization_id", org.organizationId).eq("status", "open").order("created_at", { ascending: false }),
    supabase.from("milestones").select("id, title").eq("project_id", projectId).is("deleted_at", null).order("order_index"),
    supabase.from("risks").select("id, title").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(50),
  ]);

  const { data: cycleItemsData } = await supabase
    .from("project_cycle_items").select("id, cycle_id, backlog_item_id")
    .eq("project_id", projectId).eq("organization_id", org.organizationId);

  const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
  const defaultProjectType = mapProjectType(project.project_type);
  const charter = charterRes.data as { project_goal?: string; objectives?: string } | null;

  return (
    <DeliveryClient
      locale={locale}
      projectId={projectId}
      projectName={projectName}
      defaultProjectType={defaultProjectType}
      framework={framework as unknown as Record<string, unknown> | null}
      boardColumns={(columnsRes.data ?? []) as Record<string, unknown>[]}
      events={(eventsRes.data ?? []) as Record<string, unknown>[]}
      charterGoal={charter?.project_goal ?? null}
      charterObjectives={charter?.objectives ?? null}
      backlog={(backlogRes.data ?? []) as Record<string, unknown>[]}
      cycles={(cyclesRes.data ?? []) as Record<string, unknown>[]}
      cycleItems={(cycleItemsData ?? []) as Record<string, unknown>[]}
      alerts={(alertsRes.data ?? []) as Record<string, unknown>[]}
      milestones={(milestonesRes.data ?? []) as Record<string, unknown>[]}
      risks={(risksRes.data ?? []) as Record<string, unknown>[]}
      startSetup={setup === "true"}
    />
  );
}
