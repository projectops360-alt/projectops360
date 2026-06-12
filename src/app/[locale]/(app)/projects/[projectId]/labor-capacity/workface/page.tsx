import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { computeLookahead } from "@/lib/labor/lookahead";
import type { LookaheadResult } from "@/lib/labor/lookahead";
import { computeCrewIdleRisk } from "@/lib/labor/crew-idle-risk";
import type { CrewIdleRiskResult } from "@/lib/labor/crew-idle-risk";
import type {
  LaborResource,
  ConstructionActivity,
  ActivityDependency,
  Milestone,
  TradeTaxonomy,
} from "@/types/database";
import { LaborCapacityNav } from "@/components/labor/labor-capacity-nav";
import { WorkfaceClient } from "./workface-client";

export const dynamic = "force-dynamic";

export default async function WorkfacePage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("workface");
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

  // Compute both 3-week and 6-week lookahead results
  const lookahead3: LookaheadResult = computeLookahead(
    resources,
    activities,
    dependencies,
    milestones,
    taxonomy,
    3
  );

  const lookahead6: LookaheadResult = computeLookahead(
    resources,
    activities,
    dependencies,
    milestones,
    taxonomy,
    6
  );

  // Compute crew idle risk for both horizons
  const idleRisk3: CrewIdleRiskResult = computeCrewIdleRisk(
    resources,
    activities,
    dependencies,
    3
  );
  const idleRisk6: CrewIdleRiskResult = computeCrewIdleRisk(
    resources,
    activities,
    dependencies,
    6
  );

  // Build translations object
  const translations = {
    title: t("title"),
    description: t("description"),
    horizon3Week: t("horizon3Week"),
    horizon6Week: t("horizon6Week"),
    summary: {
      totalActivities: t("summary.totalActivities"),
      readyActivities: t("summary.readyActivities"),
      atRiskActivities: t("summary.atRiskActivities"),
      blockedActivities: t("summary.blockedActivities"),
      overallReadiness: t("summary.overallReadiness"),
    },
    readiness: {
      ready: t("readiness.ready"),
      at_risk: t("readiness.at_risk"),
      not_ready: t("readiness.not_ready"),
      blocked: t("readiness.blocked"),
    },
    filters: {
      trade: t("filters.trade"),
      week: t("filters.week"),
      readiness: t("filters.readiness"),
      all: t("filters.all"),
      criticalPathOnly: t("filters.criticalPathOnly"),
      blockedOnly: t("filters.blockedOnly"),
      clear: t("filters.clear"),
    },
    table: {
      activity: t("table.activity"),
      trade: t("table.trade"),
      weeks: t("table.weeks"),
      readinessPct: t("table.readinessPct"),
      status: t("table.status"),
      missingPrerequisites: t("table.missingPrerequisites"),
      blockerTypes: t("table.blockerTypes"),
      idleRisk: t("table.idleRisk"),
      daysAtRisk: t("table.daysAtRisk"),
      downstream: t("table.downstream"),
      criticalPath: t("table.criticalPath"),
      noActivities: t("table.noActivities"),
    },
    detail: {
      checklist: t("detail.checklist"),
      assignedResources: t("detail.assignedResources"),
      recommendedAction: t("detail.recommendedAction"),
      downstreamImpact: t("detail.downstreamImpact"),
      blockers: t("detail.blockers"),
      none: t("detail.none"),
      completed: t("detail.completed"),
      incomplete: t("detail.incomplete"),
    },
    severity: {
      none: t("severity.none"),
      low: t("severity.low"),
      medium: t("severity.medium"),
      high: t("severity.high"),
      critical: t("severity.critical"),
    },
    actionType: {
      reassign: t("actionType.reassign"),
      stagger: t("actionType.stagger"),
      expedite_prerequisite: t("actionType.expedite_prerequisite"),
      confirm_vendor: t("actionType.confirm_vendor"),
      monitor: t("actionType.monitor"),
    },
    readinessExplanation: {
      title: t("readinessExplanation.title"),
      whatIsMissing: t("readinessExplanation.whatIsMissing"),
      whyItMatters: t("readinessExplanation.whyItMatters"),
      crewAffected: t("readinessExplanation.crewAffected"),
      downstreamAtRisk: t("readinessExplanation.downstreamAtRisk"),
      recommendedAction: t("readinessExplanation.recommendedAction"),
      showInsight: t("readinessExplanation.showInsight"),
      hideInsight: t("readinessExplanation.hideInsight"),
    },
    nav: {
      matrix: t("nav.matrix"),
      lookahead: t("nav.lookahead"),
      workface: t("nav.workface"),
    },
    empty: t("empty"),
  };

  return (
    <>
      <LaborCapacityNav projectId={projectId} locale={locale} activeView="workface" />
      <WorkfaceClient
        projectId={projectId}
        projectTitle={projectTitle}
        lookahead3={lookahead3}
        lookahead6={lookahead6}
        idleRisk3={idleRisk3}
        idleRisk6={idleRisk6}
        resources={resources}
        activities={activities}
        dependencies={dependencies}
        taxonomy={taxonomy}
        milestones={milestones}
        locale={locale as Locale}
        translations={translations}
      />
    </>
  );
}