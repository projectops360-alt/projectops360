import { setRequestLocale, getTranslations } from "next-intl/server";
import { localizedHref } from "@/i18n/href";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, I18nField, TraceableEntityType, Milestone, RoadmapTask } from "@/types/database";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ProjectAiSummarySection } from "./project-detail-client";
import { Link as I18nLink } from "@/i18n/navigation";
import { ProjectHeaderClient } from "./project-header-client";
import type { AiCommSummaryTranslations } from "@/components/ai";
import { ProjectDashboard } from "./dashboard-client";
import { computeRoadmapProgress } from "@/lib/roadmap/progress";
import { CHARTER_STATUS_META, CHARTER_LOCKED_STATUSES, computeCharterCompletion, CHARTER_FIELDS, type CharterStatus, type CharterFieldKey } from "@/lib/charter/fields";
import type {
  DashboardData,
  DashboardTranslations,
  RecentCommunication,
  RecentMeeting,
  RecentDecision,
  RecentDocument,
  UnresolvedActionItem,
  MissingLinkEntity,
} from "./dashboard-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("projects");
  const tAi = await getTranslations("projects.aiCommSummary");
  const tDash = await getTranslations("projects.dashboard");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch the project, scoped to the user's organization
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title_i18n, description_i18n, status, project_type, start_date, target_end_date, created_at, updated_at")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  // Charter status (governance health for the Command Center).
  const { data: charterRowRaw } = await supabase
    .from("project_charters")
    .select(`status, version, ${CHARTER_FIELDS.map((f) => f.key).join(", ")}`)
    .eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null)
    .maybeSingle();
  const charterRow = charterRowRaw as Record<string, unknown> | null;
  const charterStatus = (charterRow?.status as CharterStatus | undefined) ?? null;
  const charterMeta = charterStatus ? CHARTER_STATUS_META[charterStatus] : null;
  const charterLocked = charterStatus ? CHARTER_LOCKED_STATUSES.includes(charterStatus) : false;
  const charterCompletion = charterRow
    ? computeCharterCompletion(charterRow as Partial<Record<CharterFieldKey, string>>).pct
    : 0;

  const lang = locale as Locale;
  const title = getI18nValue(project.title_i18n, lang) || project.slug;
  const description = getI18nValue(project.description_i18n, lang);
  const statusLabel = t(`status.${project.status}` as Parameters<typeof t>[0]);

  // ── Dashboard data queries (parallel) ────────────────────────────────────────

  const [
    commResult,
    meetingResult,
    decisionResult,
    docResult,
    actionItemResult,
    allDecisions,
    allMeetings,
    allComms,
    allDocs,
    snapshotMilestonesResult,
    snapshotTasksResult,
  ] = await Promise.all([
    // 1. Communications — count + recent 5
    supabase
      .from("communication_items")
      .select("id, title_i18n, item_date, source_type, requires_follow_up", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("item_date", { ascending: false })
      .limit(5),

    // 2. Meetings — count + recent 5
    supabase
      .from("meetings")
      .select("id, title_i18n, meeting_date, status", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("meeting_date", { ascending: false })
      .limit(5),

    // 3. Decisions — count + recent 5
    supabase
      .from("decisions")
      .select("id, title_i18n, decision_date, status, impact_area", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("decision_date", { ascending: false })
      .limit(5),

    // 4. Documents — count + recent 5
    supabase
      .from("documents")
      .select("id, title_i18n, document_type, status", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),

    // 5. Unresolved action items
    supabase
      .from("action_items")
      .select("id, title_i18n, priority, due_date, status", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .in("status", ["pending", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(10),

    // 6-9. ALL entity IDs (not just recent 5) for traceability link lookup
    supabase
      .from("decisions")
      .select("id, title_i18n")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("meetings")
      .select("id, title_i18n")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("communication_items")
      .select("id, title_i18n")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
    supabase
      .from("documents")
      .select("id, title_i18n")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),

    // 10-11. Roadmap snapshot data
    supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    supabase
      .from("roadmap_tasks")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("milestone_id", { ascending: true })
      .order("order_index", { ascending: true }),
  ]);

  // Extract counts
  const commCount = commResult.count ?? 0;
  const meetingCount = meetingResult.count ?? 0;
  const decisionCount = decisionResult.count ?? 0;
  const docCount = docResult.count ?? 0;
  const actionItemCount = actionItemResult.count ?? 0;

  // Map recent items
  const recentCommunications: RecentCommunication[] = (commResult.data ?? []).map((c) => ({
    id: c.id,
    title: getI18nValue(c.title_i18n as I18nField, lang) || "Untitled",
    date: c.item_date,
    sourceType: c.source_type ?? "other",
    requiresFollowUp: c.requires_follow_up ?? false,
  }));

  const recentMeetings: RecentMeeting[] = (meetingResult.data ?? []).map((m) => ({
    id: m.id,
    title: getI18nValue(m.title_i18n as I18nField, lang) || "Untitled",
    date: m.meeting_date,
    status: m.status ?? "scheduled",
  }));

  const recentDecisions: RecentDecision[] = (decisionResult.data ?? []).map((d) => ({
    id: d.id,
    title: getI18nValue(d.title_i18n as I18nField, lang) || "Untitled",
    date: d.decision_date,
    status: d.status ?? "proposed",
    impactArea: d.impact_area ?? null,
  }));

  const recentDocuments: RecentDocument[] = (docResult.data ?? []).map((doc) => ({
    id: doc.id,
    title: getI18nValue(doc.title_i18n as I18nField, lang) || "Untitled",
    documentType: doc.document_type ?? null,
    status: doc.status ?? "draft",
  }));

  const unresolvedActionItems: UnresolvedActionItem[] = (actionItemResult.data ?? []).map((ai) => ({
    id: ai.id,
    title: getI18nValue(ai.title_i18n as I18nField, lang) || "Untitled",
    priority: ai.priority ?? "medium",
    dueDate: ai.due_date ?? null,
    status: ai.status ?? "pending",
  }));

  // ── Link stats ──────────────────────────────────────────────────────────────

  const allDecisionIds = (allDecisions.data ?? []).map((d) => d.id);
  const allMeetingIds = (allMeetings.data ?? []).map((m) => m.id);
  const allCommIds = (allComms.data ?? []).map((c) => c.id);
  const allDocIds = (allDocs.data ?? []).map((d) => d.id);

  // Query traceability_links for each entity type using .in() on source_id or target_id
  // Build queries conditionally — only include queries when there are IDs to search
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkQueryPromises: PromiseLike<any>[] = [];

  if (allDecisionIds.length > 0) {
    linkQueryPromises.push(
      supabase
        .from("traceability_links")
        .select("source_id, target_id")
        .eq("organization_id", org.organizationId)
        .eq("source_type", "decision")
        .in("source_id", allDecisionIds),
    );
    linkQueryPromises.push(
      supabase
        .from("traceability_links")
        .select("source_id, target_id")
        .eq("organization_id", org.organizationId)
        .eq("target_type", "decision")
        .in("target_id", allDecisionIds),
    );
  }
  if (allMeetingIds.length > 0) {
    linkQueryPromises.push(
      supabase
        .from("traceability_links")
        .select("source_id, target_id")
        .eq("organization_id", org.organizationId)
        .eq("source_type", "meeting")
        .in("source_id", allMeetingIds),
    );
    linkQueryPromises.push(
      supabase
        .from("traceability_links")
        .select("source_id, target_id")
        .eq("organization_id", org.organizationId)
        .eq("target_type", "meeting")
        .in("target_id", allMeetingIds),
    );
  }
  if (allCommIds.length > 0) {
    linkQueryPromises.push(
      supabase
        .from("traceability_links")
        .select("source_id, target_id")
        .eq("organization_id", org.organizationId)
        .eq("source_type", "communication")
        .in("source_id", allCommIds),
    );
    linkQueryPromises.push(
      supabase
        .from("traceability_links")
        .select("source_id, target_id")
        .eq("organization_id", org.organizationId)
        .eq("target_type", "communication")
        .in("target_id", allCommIds),
    );
  }
  if (allDocIds.length > 0) {
    linkQueryPromises.push(
      supabase
        .from("traceability_links")
        .select("source_id, target_id")
        .eq("organization_id", org.organizationId)
        .eq("source_type", "document")
        .in("source_id", allDocIds),
    );
    linkQueryPromises.push(
      supabase
        .from("traceability_links")
        .select("source_id, target_id")
        .eq("organization_id", org.organizationId)
        .eq("target_type", "document")
        .in("target_id", allDocIds),
    );
  }

  const linkResults: Array<{ data: { source_id: string; target_id: string }[] | null }> = await Promise.all(linkQueryPromises);

  // Build a set of all entity IDs that appear in any link
  const linkedEntityIds = new Set<string>();
  let totalLinkCount = 0;
  const seenLinkPairs = new Set<string>();

  for (const result of linkResults) {
    for (const link of result.data ?? []) {
      const pairKey = `${link.source_id}->${link.target_id}`;
      if (!seenLinkPairs.has(pairKey)) {
        seenLinkPairs.add(pairKey);
        totalLinkCount++;
      }
      linkedEntityIds.add(link.source_id);
      linkedEntityIds.add(link.target_id);
    }
  }

  // Compute missing link entities
  const missingLinkEntities: MissingLinkEntity[] = [];
  const entityMap: Array<{ type: TraceableEntityType; items: { id: string; title_i18n: I18nField }[] | null }> = [
    { type: "decision" as TraceableEntityType, items: allDecisions.data },
    { type: "meeting" as TraceableEntityType, items: allMeetings.data },
    { type: "communication" as TraceableEntityType, items: allComms.data },
    { type: "document" as TraceableEntityType, items: allDocs.data },
  ];

  for (const { type, items } of entityMap) {
    for (const item of items ?? []) {
      if (!linkedEntityIds.has(item.id)) {
        missingLinkEntities.push({
          id: item.id,
          type,
          title: getI18nValue(item.title_i18n as I18nField, lang) || "Untitled",
        });
      }
    }
  }

  const totalEntities = allDecisionIds.length + allMeetingIds.length + allCommIds.length + allDocIds.length;
  const linkedEntityCount = totalEntities - missingLinkEntities.length;

  // Build dashboard data
  const dashboardData: DashboardData = {
    stats: {
      communications: commCount,
      meetings: meetingCount,
      decisions: decisionCount,
      documents: docCount,
      actionItems: actionItemCount,
      links: totalLinkCount,
    },
    recentCommunications,
    recentMeetings,
    recentDecisions,
    recentDocuments,
    unresolvedActionItems,
    missingLinkEntities,
    totalEntities,
    linkedEntityCount,
  };

  // ── Roadmap snapshot data (fetched in the parallel block above) ───────────
  const snapshotMilestones = snapshotMilestonesResult.data;
  const snapshotTasks = snapshotTasksResult.data;

  const roadmapProgress = computeRoadmapProgress(
    (snapshotMilestones ?? []) as Milestone[],
    (snapshotTasks ?? []) as RoadmapTask[],
  );

  // ── Translations ────────────────────────────────────────────────────────────

  const aiCommSummaryTranslations: AiCommSummaryTranslations = {
    button: tAi("button"),
    buttonTooltip: tAi("buttonTooltip"),
    title: tAi("title"),
    empty: tAi("empty"),
    summary: tAi("summary"),
    keyPoints: tAi("keyPoints"),
    sourceRecords: tAi("sourceRecords"),
    openItems: tAi("openItems"),
    none: tAi("none"),
    recordCount: tAi("recordCount"),
    generating: tAi("generating"),
    communicationLabel: tAi("communicationLabel"),
    decisionLabel: tAi("decisionLabel"),
    errors: {
      noRecords: tAi("errors.noRecords"),
      aiFailed: tAi("errors.aiFailed"),
      noApiKey: tAi("errors.noApiKey"),
      unexpected: tAi("errors.unexpected"),
    },
  };

  const dashboardTranslations: DashboardTranslations = {
    statCards: {
      communications: tDash("statCards.communications"),
      meetings: tDash("statCards.meetings"),
      decisions: tDash("statCards.decisions"),
      documents: tDash("statCards.documents"),
      actionItems: tDash("statCards.actionItems"),
      links: tDash("statCards.links"),
    },
    recentCommunications: tDash("recentCommunications"),
    recentMeetings: tDash("recentMeetings"),
    recentDecisions: tDash("recentDecisions"),
    recentDocuments: tDash("recentDocuments"),
    unresolvedActionItems: tDash("unresolvedActionItems"),
    missingLinks: tDash("missingLinks"),
    missingLinksDescription: tDash("missingLinksDescription"),
    missingLinksCount: tDash("missingLinksCount"),
    noData: tDash("noData"),
    viewAll: tDash("viewAll"),
    traceabilityHealth: tDash("traceabilityHealth"),
    linkedEntities: tDash("linkedEntities"),
    none: tDash("none"),
    requiresFollowUp: tDash("requiresFollowUp"),
    overdue: tDash("overdue"),
    noDueDate: tDash("noDueDate"),
  };

  // Entity labels for missing links display
  const entityLabels: Record<string, string> = {
    decision: tDash("statCards.decisions"),
    meeting: tDash("statCards.meetings"),
    communication: tDash("statCards.communications"),
    document: tDash("statCards.documents"),
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={localizedHref(locale, `/projects`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.back")}
      </Link>

      {/* Project header */}
      <ProjectHeaderClient
        projectId={projectId}
        locale={locale}
        title={title}
        description={description}
        status={project.status}
        statusLabel={statusLabel}
        projectType={project.project_type ?? "general"}
        startDate={project.start_date}
        targetEndDate={project.target_end_date}
        editLabel={t("detail.edit")}
        archiveLabel={t("detail.archive")}
        archiveConfirm={t("detail.archiveConfirm")}
      />

      {/* Charter & Governance status strip */}
      <I18nLink
        href={`/projects/${projectId}/charter`}
        className={`group flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${
          charterLocked
            ? "border-green-200 bg-green-50/50 hover:bg-green-100/50 dark:border-green-900 dark:bg-green-950/20"
            : "border-amber-200 bg-amber-50/50 hover:bg-amber-100/50 dark:border-amber-900 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ShieldCheck className={`h-5 w-5 shrink-0 ${charterLocked ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {lang === "es" ? "Charter y Gobernanza" : "Charter & Governance"}
              {charterMeta && <span className="ml-2 text-xs font-normal text-muted-foreground">· {lang === "es" ? charterMeta.es : charterMeta.en} · {charterCompletion}%</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {charterLocked
                ? (lang === "es" ? "El charter está aprobado. Base del proyecto definida." : "Charter is approved. Project foundation is set.")
                : (lang === "es" ? "Completa y aprueba el charter antes de la ejecución real." : "Complete and approve the charter before real execution.")}
            </p>
          </div>
        </div>
        <ArrowLeft className="h-4 w-4 rotate-180 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </I18nLink>

      {/* AI Communication Summary */}
      <ProjectAiSummarySection
        projectId={projectId}
        locale={locale}
        translations={aiCommSummaryTranslations}
        buttonTooltip={tAi("buttonTooltip")}
      />

      {/* Command Center Dashboard */}
      <ProjectDashboard
        projectId={projectId}
        locale={locale}
        data={dashboardData}
        translations={dashboardTranslations}
        entityLabels={entityLabels}
        milestones={(snapshotMilestones ?? []) as Milestone[]}
        tasks={(snapshotTasks ?? []) as RoadmapTask[]}
        roadmapProgress={roadmapProgress}
      />
    </div>
  );
}