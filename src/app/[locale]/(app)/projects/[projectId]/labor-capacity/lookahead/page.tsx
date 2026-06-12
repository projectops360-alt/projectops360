import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { computeLookahead } from "@/lib/labor/lookahead";
import type { LookaheadResult } from "@/lib/labor/lookahead";
import { buildLookaheadNarrative } from "@/lib/labor/lookahead-explanation";
import { computeCrewIdleRisk } from "@/lib/labor/crew-idle-risk";
import type { CrewIdleRiskResult } from "@/lib/labor/crew-idle-risk";
import { buildIdleRiskSummary } from "@/lib/labor/crew-idle-risk-explanation";
import type {
  LaborResource,
  ConstructionActivity,
  ActivityDependency,
  Milestone,
  TradeTaxonomy,
} from "@/types/database";
import { LaborCapacityNav } from "@/components/labor/labor-capacity-nav";
import { LookaheadClient } from "./lookahead-client";

export const dynamic = "force-dynamic";

export default async function LookaheadPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("lookahead");
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

  // Build narrative for both horizons
  const narrative3 = buildLookaheadNarrative(lookahead3, taxonomy, locale as Locale);
  const narrative6 = buildLookaheadNarrative(lookahead6, taxonomy, locale as Locale);

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

  // Build idle risk narrative for both horizons
  const idleRiskSummary3 = buildIdleRiskSummary(idleRisk3, taxonomy, locale as Locale);
  const idleRiskSummary6 = buildIdleRiskSummary(idleRisk6, taxonomy, locale as Locale);

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
    grid: {
      trade: t("grid.trade"),
      week: t("grid.week"),
      required: t("grid.required"),
      available: t("grid.available"),
      gap: t("grid.gap"),
      activities: t("grid.activities"),
      criticalPath: t("grid.criticalPath"),
      noActivities: t("grid.noActivities"),
      noTrades: t("grid.noTrades"),
    },
    activity: {
      readiness: t("activity.readiness"),
      blockers: t("activity.blockers"),
      assignedResources: t("activity.assignedResources"),
      noBlockers: t("activity.noBlockers"),
      onCriticalPath: t("activity.onCriticalPath"),
      offCriticalPath: t("activity.offCriticalPath"),
      progress: t("activity.progress"),
    },
    checklist: {
      title: t("checklist.title"),
    },
    blockers: {
      title: t("blockers.title"),
      unmet_dependency: t("blockers.unmet_dependency"),
      labor_shortage: t("blockers.labor_shortage"),
      vendor_unconfirmed: t("blockers.vendor_unconfirmed"),
      over_allocated: t("blockers.over_allocated"),
      blocked_status: t("blockers.blocked_status"),
      checklist_incomplete: t("blockers.checklist_incomplete"),
    },
    narrative: {
      allReady: t("narrative.allReady"),
      someAtRisk: t("narrative.someAtRisk"),
      someBlocked: t("narrative.someBlocked"),
      mostCriticalTrade: t("narrative.mostCriticalTrade"),
      criticalPathWarning: t("narrative.criticalPathWarning"),
      vendorUnconfirmed: t("narrative.vendorUnconfirmed"),
    },
    idleRisk: {
      title: t("idleRisk.title"),
      description: t("idleRisk.description"),
      crewsAtRisk: t("idleRisk.crewsAtRisk"),
      totalIdleDays: t("idleRisk.totalIdleDays"),
      criticalPathIdleDays: t("idleRisk.criticalPathIdleDays"),
      resource: t("idleRisk.resource"),
      trade: t("idleRisk.trade"),
      constraint: t("idleRisk.constraint"),
      assignedActivities: t("idleRisk.assignedActivities"),
      idleWeeks: t("idleRisk.idleWeeks"),
      worstRisk: t("idleRisk.worstRisk"),
      downstreamImpact: t("idleRisk.downstreamImpact"),
      daysAtRisk: t("idleRisk.daysAtRisk"),
      recommendedAction: t("idleRisk.recommendedAction"),
      readiness: t("idleRisk.readiness"),
      missingPrerequisites: t("idleRisk.missingPrerequisites"),
      noRisk: t("idleRisk.noRisk"),
      severity: {
        none: t("idleRisk.severity.none"),
        low: t("idleRisk.severity.low"),
        medium: t("idleRisk.severity.medium"),
        high: t("idleRisk.severity.high"),
        critical: t("idleRisk.severity.critical"),
      },
      actionType: {
        reassign: t("idleRisk.actionType.reassign"),
        stagger: t("idleRisk.actionType.stagger"),
        expedite_prerequisite: t("idleRisk.actionType.expedite_prerequisite"),
        confirm_vendor: t("idleRisk.actionType.confirm_vendor"),
        monitor: t("idleRisk.actionType.monitor"),
      },
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
    },
    empty: t("empty"),
  };

  return (
    <>
      <LaborCapacityNav projectId={projectId} locale={locale} activeView="lookahead" />
      <LookaheadClient
        projectId={projectId}
        projectTitle={projectTitle}
        lookahead3={lookahead3}
        lookahead6={lookahead6}
        narrative3={narrative3}
        narrative6={narrative6}
        idleRisk3={idleRisk3}
        idleRisk6={idleRisk6}
        idleRiskSummary3={idleRiskSummary3}
        idleRiskSummary6={idleRiskSummary6}
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