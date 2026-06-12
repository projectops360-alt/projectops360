import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, TraceableEntityType, LinkType, ImpactArea, ActionItemPriority, I18nField } from "@/types/database";
import { MeetingDetailClient } from "./meeting-detail-client";
import type { ResolvedLink } from "@/components/links/linked-records";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; meetingId: string }>;
}) {
  const { locale, projectId, meetingId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("meetings");
  const tDetail = await getTranslations("meetings.detail");
  const tLinks = await getTranslations("links");
  const tAi = await getTranslations("meetings.aiExtraction");
  const tAiActions = await getTranslations("meetings.aiActionExtraction");
  const tDecisions = await getTranslations("decisions");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch the project
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

  // Fetch the meeting
  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!meeting) {
    notFound();
  }

  const projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  // Fetch stakeholders for resolving linked names
  const { data: stakeholders } = await supabase
    .from("stakeholders")
    .select("id, name")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const stakeholderMap = new Map(
    (stakeholders ?? []).map((s) => [s.id, s.name] as [string, string]),
  );

  // ── Fetch traceability links (bidirectional) ──────────────────────────────────
  const lang = locale as Locale;

  const { data: outgoingLinks } = await supabase
    .from("traceability_links")
    .select("*")
    .eq("organization_id", org.organizationId)
    .eq("source_type", "meeting")
    .eq("source_id", meetingId);

  const { data: incomingLinks } = await supabase
    .from("traceability_links")
    .select("*")
    .eq("organization_id", org.organizationId)
    .eq("target_type", "meeting")
    .eq("target_id", meetingId);

  const allLinks = [...(outgoingLinks ?? []), ...(incomingLinks ?? [])];

  // Collect IDs grouped by entity type for title resolution
  const idsByType: Partial<Record<TraceableEntityType, string[]>> = {};
  for (const link of allLinks) {
    if (link.source_type === "meeting" && link.source_id === meetingId) {
      const tt = link.target_type as TraceableEntityType;
      if (!idsByType[tt]) idsByType[tt] = [];
      idsByType[tt]!.push(link.target_id);
    } else {
      const st = link.source_type as TraceableEntityType;
      if (!idsByType[st]) idsByType[st] = [];
      idsByType[st]!.push(link.source_id);
    }
  }

  // Resolve titles for each entity type
  const titleMap = new Map<string, string>();

  if (idsByType.decision?.length) {
    const { data } = await supabase.from("decisions").select("id, title_i18n").in("id", idsByType.decision).is("deleted_at", null);
    (data ?? []).forEach((r) => titleMap.set(r.id, getI18nValue(r.title_i18n as I18nField, lang)));
  }
  if (idsByType.meeting?.length) {
    const { data } = await supabase.from("meetings").select("id, title_i18n").in("id", idsByType.meeting).is("deleted_at", null);
    (data ?? []).forEach((r) => titleMap.set(r.id, getI18nValue(r.title_i18n as I18nField, lang)));
  }
  if (idsByType.communication?.length) {
    const { data } = await supabase.from("communication_items").select("id, title_i18n").in("id", idsByType.communication).is("deleted_at", null);
    (data ?? []).forEach((r) => titleMap.set(r.id, getI18nValue(r.title_i18n as I18nField, lang)));
  }
  if (idsByType.document?.length) {
    const { data } = await supabase.from("documents").select("id, title_i18n").in("id", idsByType.document).is("deleted_at", null);
    (data ?? []).forEach((r) => titleMap.set(r.id, getI18nValue(r.title_i18n as I18nField, lang)));
  }

  // Build resolved links
  const resolvedLinks: ResolvedLink[] = allLinks.map((link) => {
    const isOutgoing = link.source_type === "meeting" && link.source_id === meetingId;
    return {
      id: link.id,
      linkType: link.link_type as LinkType,
      contextI18n: link.context_i18n as I18nField,
      createdAt: link.created_at,
      otherType: (isOutgoing ? link.target_type : link.source_type) as TraceableEntityType,
      otherId: isOutgoing ? link.target_id : link.source_id,
      otherTitle: titleMap.get(isOutgoing ? link.target_id : link.source_id) ?? "Unknown",
      direction: isOutgoing ? "outgoing" : "incoming",
    };
  });

  // ── Fetch entity catalogs for the link dialog ──────────────────────────────────
  const { data: allDecisions } = await supabase
    .from("decisions")
    .select("id, title_i18n")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: allMeetings } = await supabase
    .from("meetings")
    .select("id, title_i18n")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: allCommunications } = await supabase
    .from("communication_items")
    .select("id, title_i18n")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: allDocuments } = await supabase
    .from("documents")
    .select("id, title_i18n")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <MeetingDetailClient
      projectId={projectId}
      projectTitle={projectTitle}
      meeting={meeting}
      stakeholders={stakeholders ?? []}
      stakeholderMap={stakeholderMap}
      locale={locale as Locale}
      links={resolvedLinks}
      availableDecisions={(allDecisions ?? []).map((d) => ({ id: d.id, title: getI18nValue(d.title_i18n as I18nField, lang) }))}
      availableMeetings={(allMeetings ?? []).map((m) => ({ id: m.id, title: getI18nValue(m.title_i18n as I18nField, lang) }))}
      availableCommunications={(allCommunications ?? []).map((c) => ({ id: c.id, title: getI18nValue(c.title_i18n as I18nField, lang) }))}
      availableDocuments={(allDocuments ?? []).map((d) => ({ id: d.id, title: getI18nValue(d.title_i18n as I18nField, lang) }))}
      translations={{
        back: tDetail("back"),
        date: tDetail("date"),
        duration: tDetail("duration"),
        durationValue: tDetail("durationValue"),
        location: tDetail("location"),
        attendees: tDetail("attendees"),
        agenda: tDetail("agenda"),
        summary: tDetail("summary"),
        notes: tDetail("notes"),
        noNotes: tDetail("noNotes"),
        linkedStakeholders: tDetail("linkedStakeholders"),
        noStakeholders: tDetail("noStakeholders"),
        linkedRecords: tDetail("linkedRecords"),
        extractDecisions: tDetail("extractDecisions"),
        extractDecisionsTooltip: tDetail("extractDecisionsTooltip"),
        extractActionItems: tDetail("extractActionItems"),
        extractActionItemsTooltip: tDetail("extractActionItemsTooltip"),
        edit: t("edit"),
        archive: t("archive"),
        archiveConfirm: t("archiveConfirm"),
        statusLabels: {
          scheduled: t("status.scheduled"),
          in_progress: t("status.in_progress"),
          completed: t("status.completed"),
          cancelled: t("status.cancelled"),
        },
        aiExtractionTranslations: {
          title: tAi("title"),
          description: tAi("description"),
          empty: tAi("empty"),
          confidence: tAi("confidence"),
          sourceExcerpt: tAi("sourceExcerpt"),
          impactArea: tAi("impactArea"),
          decisionDate: tAi("decisionDate"),
          decisionMaker: tAi("decisionMaker"),
          approve: tAi("approve"),
          approved: tAi("approved"),
          reject: tAi("reject"),
          rejected: tAi("rejected"),
          edit: tAi("edit"),
          save: tAi("save"),
          cancel: tAi("cancel"),
          extracting: tAi("extracting"),
          extractedOn: tAi("extractedOn"),
          aiRunId: tAi("aiRunId"),
          allReviewed: tAi("allReviewed"),
          impactAreaLabels: {
            scope: tDecisions("impactArea.scope"),
            schedule: tDecisions("impactArea.schedule"),
            budget: tDecisions("impactArea.budget"),
            risk: tDecisions("impactArea.risk"),
            quality: tDecisions("impactArea.quality"),
            communication: tDecisions("impactArea.communication"),
            document: tDecisions("impactArea.document"),
            other: tDecisions("impactArea.other"),
          } as Record<ImpactArea, string>,
          errors: {
            noNotes: tAi("errors.noNotes"),
            noContent: tAi("errors.noContent"),
            aiFailed: tAi("errors.aiFailed"),
            noApiKey: tAi("errors.noApiKey"),
            approvalFailed: tAi("errors.approvalFailed"),
            unexpected: tAi("errors.unexpected"),
          },
        },
        aiActionExtractionTranslations: {
          title: tAiActions("title"),
          description: tAiActions("description"),
          empty: tAiActions("empty"),
          confidence: tAiActions("confidence"),
          sourceExcerpt: tAiActions("sourceExcerpt"),
          priority: tAiActions("priority"),
          dueDate: tAiActions("dueDate"),
          ownerName: tAiActions("ownerName"),
          approve: tAiActions("approve"),
          approved: tAiActions("approved"),
          reject: tAiActions("reject"),
          rejected: tAiActions("rejected"),
          edit: tAiActions("edit"),
          save: tAiActions("save"),
          cancel: tAiActions("cancel"),
          extracting: tAiActions("extracting"),
          extractedOn: tAiActions("extractedOn"),
          aiRunId: tAiActions("aiRunId"),
          allReviewed: tAiActions("allReviewed"),
          priorityLabels: {
            low: tAiActions("priorityLabels.low"),
            medium: tAiActions("priorityLabels.medium"),
            high: tAiActions("priorityLabels.high"),
            critical: tAiActions("priorityLabels.critical"),
          } as Record<ActionItemPriority, string>,
          errors: {
            noContent: tAiActions("errors.noContent"),
            aiFailed: tAiActions("errors.aiFailed"),
            noApiKey: tAiActions("errors.noApiKey"),
            approvalFailed: tAiActions("errors.approvalFailed"),
            unexpected: tAiActions("errors.unexpected"),
          },
        },
        linksTranslations: {
          title: tLinks("title"),
          empty: tLinks("empty"),
          emptyDescription: tLinks("emptyDescription"),
          addLink: tLinks("addLink"),
          removeLink: tLinks("removeLink"),
          removeConfirm: tLinks("removeConfirm"),
          context: tLinks("context"),
          createdAt: tLinks("createdAt"),
          entityTypeLabels: {
            decision: tLinks("entityType.decision"),
            meeting: tLinks("entityType.meeting"),
            communication: tLinks("entityType.communication"),
            document: tLinks("entityType.document"),
            action_item: tLinks("entityType.action_item"),
            stakeholder: tLinks("entityType.stakeholder"),
            project: tLinks("entityType.project"),
          },
          linkTypeLabels: {
            related_to: tLinks("linkType.related_to"),
            caused_by: tLinks("linkType.caused_by"),
            depends_on: tLinks("linkType.depends_on"),
            supersedes: tLinks("linkType.supersedes"),
            derived_from: tLinks("linkType.derived_from"),
            contradicts: tLinks("linkType.contradicts"),
          },
          dialogTranslations: {
            title: tLinks("dialog.title"),
            targetType: tLinks("dialog.targetType"),
            targetRecord: tLinks("dialog.targetRecord"),
            linkType: tLinks("dialog.linkType"),
            contextNotes: tLinks("dialog.contextNotes"),
            contextNotesPlaceholder: tLinks("dialog.contextNotesPlaceholder"),
            submit: tLinks("dialog.submit"),
            cancel: tLinks("dialog.cancel"),
            entityTypeLabels: {
              decision: tLinks("entityType.decision"),
              meeting: tLinks("entityType.meeting"),
              communication: tLinks("entityType.communication"),
              document: tLinks("entityType.document"),
              action_item: tLinks("entityType.action_item"),
              stakeholder: tLinks("entityType.stakeholder"),
              project: tLinks("entityType.project"),
            },
            linkTypeLabels: {
              related_to: tLinks("linkType.related_to"),
              caused_by: tLinks("linkType.caused_by"),
              depends_on: tLinks("linkType.depends_on"),
              supersedes: tLinks("linkType.supersedes"),
              derived_from: tLinks("linkType.derived_from"),
              contradicts: tLinks("linkType.contradicts"),
            },
            errors: {
              targetRequired: tLinks("dialog.errors.targetRequired"),
              linkTypeRequired: tLinks("dialog.errors.linkTypeRequired"),
              contextTooLong: tLinks("dialog.errors.contextTooLong"),
              duplicate: tLinks("dialog.errors.duplicate"),
              unexpected: tLinks("dialog.errors.unexpected"),
            },
          },
        },
      }}
    />
  );
}