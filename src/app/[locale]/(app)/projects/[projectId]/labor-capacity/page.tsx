import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { computeLaborCapacity } from "@/lib/labor/capacity";
import type { LaborCapacityResult } from "@/lib/labor/capacity";
import type {
  LaborResource,
  ConstructionActivity,
  ActivityDependency,
  Milestone,
  TradeTaxonomy,
} from "@/types/database";
import { LaborCapacityClient } from "./labor-capacity-client";
import { LaborCapacityNav } from "@/components/labor/labor-capacity-nav";

export const dynamic = "force-dynamic";

export default async function LaborCapacityPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("laborCapacity");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch the project, scoped to the user's organization
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  const projectTitle =
    getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  // Fetch all labor data in parallel
  const [
    resourcesResult,
    activitiesResult,
    depsResult,
    milestonesResult,
    taxonomyResult,
  ] = await Promise.all([
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
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index"),
    supabase
      .from("trade_taxonomy")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index"),
  ]);

  const resources = (resourcesResult.data ?? []) as LaborResource[];
  const activities = (activitiesResult.data ?? []) as ConstructionActivity[];
  const dependencies = (depsResult.data ?? []) as ActivityDependency[];
  const milestones = (milestonesResult.data ?? []) as Milestone[];
  const taxonomy = (taxonomyResult.data ?? []) as TradeTaxonomy[];

  // Compute labor capacity using the pure function
  const capacity: LaborCapacityResult = computeLaborCapacity(
    resources,
    activities,
    dependencies,
    milestones
  );

  // Build translations object
  const translations = {
    title: t("title"),
    description: t("description"),
    summary: {
      totalTrades: t("summary.totalTrades"),
      shortageWeeks: t("summary.shortageWeeks"),
      criticalTrades: t("summary.criticalTrades"),
      maxUtilization: t("summary.maxUtilization"),
    },
    filters: {
      trade: t("filters.trade"),
      week: t("filters.week"),
      milestone: t("filters.milestone"),
      location: t("filters.location"),
      criticalOnly: t("filters.criticalOnly"),
      all: t("filters.all"),
      clear: t("filters.clear"),
    },
    table: {
      trade: t("table.trade"),
      week: t("table.week"),
      zone: t("table.zone"),
      requiredHC: t("table.requiredHC"),
      availableHC: t("table.availableHC"),
      gapHC: t("table.gapHC"),
      requiredHrs: t("table.requiredHrs"),
      availableHrs: t("table.availableHrs"),
      gapHrs: t("table.gapHrs"),
      utilization: t("table.utilization"),
      risk: t("table.risk"),
      criticalPath: t("table.criticalPath"),
      activities: t("table.activities"),
      resources: t("table.resources"),
    },
    skills: {
      title: t("skills.title"),
      type: t("skills.type"),
      skillLevel: t("skills.skillLevel"),
      constraint: t("skills.constraint"),
      availability: t("skills.availability"),
    },
    risk: {
      none: t("risk.none"),
      low: t("risk.low"),
      medium: t("risk.medium"),
      high: t("risk.high"),
      critical: t("risk.critical"),
    },
    empty: t("empty"),
  };

  return (
    <>
      <LaborCapacityNav projectId={projectId} locale={locale} activeView="matrix" />
      <LaborCapacityClient
      projectId={projectId}
      projectTitle={projectTitle}
      capacity={capacity}
      resources={resources}
      activities={activities}
      taxonomy={taxonomy}
      milestones={milestones}
      locale={locale as Locale}
      translations={translations}
    />
    </>
  );
}