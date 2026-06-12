import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, DecisionSourceType, TraceableEntityType, LinkType, I18nField } from "@/types/database";
import { DecisionDetailClient } from "./decision-detail-client";
import type { ResolvedLink } from "@/components/links/linked-records";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; decisionId: string }>;
}) {
  const { locale, projectId, decisionId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("decisions");
  const tDetail = await getTranslations("decisions.detail");
  const tLinks = await getTranslations("links");
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

  // Fetch the decision
  const { data: decision } = await supabase
    .from("decisions")
    .select("*")
    .eq("id", decisionId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!decision) {
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

  // ── Fetch traceability links (bidirectional) ──────────────────────────────────
  const lang = locale as Locale;

  const { data: outgoingLinks } = await supabase
    .from("traceability_links")
    .select("*")
    .eq("organization_id", org.organizationId)
    .eq("source_type", "decision")
    .eq("source_id", decisionId);

  const { data: incomingLinks } = await supabase
    .from("traceability_links")
    .select("*")
    .eq("organization_id", org.organizationId)
    .eq("target_type", "decision")
    .eq("target_id", decisionId);

  const allLinks = [...(outgoingLinks ?? []), ...(incomingLinks ?? [])];

  // Collect IDs grouped by entity type for title resolution
  const idsByType: Partial<Record<TraceableEntityType, string[]>> = {};
  for (const link of allLinks) {
    if (link.source_type === "decision" && link.source_id === decisionId) {
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
    const isOutgoing = link.source_type === "decision" && link.source_id === decisionId;
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
    <DecisionDetailClient
      projectId={projectId}
      projectTitle={projectTitle}
      decision={decision}
      stakeholders={(stakeholders ?? []).map((s) => ({ id: s.id, name: s.name }))}
      locale={locale as Locale}
      links={resolvedLinks}
      availableDecisions={(allDecisions ?? []).map((d) => ({ id: d.id, title: getI18nValue(d.title_i18n as I18nField, lang) }))}
      availableMeetings={(allMeetings ?? []).map((m) => ({ id: m.id, title: getI18nValue(m.title_i18n as I18nField, lang) }))}
      availableCommunications={(allCommunications ?? []).map((c) => ({ id: c.id, title: getI18nValue(c.title_i18n as I18nField, lang) }))}
      availableDocuments={(allDocuments ?? []).map((d) => ({ id: d.id, title: getI18nValue(d.title_i18n as I18nField, lang) }))}
      translations={{
        back: tDetail("back"),
        date: tDetail("date"),
        decisionMaker: tDetail("decisionMaker"),
        source: tDetail("source"),
        noSource: tDetail("noSource"),
        evidence: tDetail("evidence"),
        description: tDetail("description"),
        noDescription: tDetail("noDescription"),
        rationale: tDetail("rationale"),
        noRationale: tDetail("noRationale"),
        linkedStakeholders: tDetail("linkedStakeholders"),
        noStakeholders: tDetail("noStakeholders"),
        linkedRecords: tDetail("linkedRecords"),
        edit: t("edit"),
        archive: t("archive"),
        archiveConfirm: t("archiveConfirm"),
        statusLabels: {
          proposed: t("status.proposed"),
          accepted: t("status.accepted"),
          rejected: t("status.rejected"),
          deferred: t("status.deferred"),
          revoked: t("status.revoked"),
        },
        impactAreaLabels: {
          scope: t("impactArea.scope"),
          schedule: t("impactArea.schedule"),
          budget: t("impactArea.budget"),
          risk: t("impactArea.risk"),
          quality: t("impactArea.quality"),
          communication: t("impactArea.communication"),
          document: t("impactArea.document"),
          other: t("impactArea.other"),
        },
        sourceTypeLabels: {
          meeting: t("sourceType.meeting"),
          communication: t("sourceType.communication"),
          document: t("sourceType.document"),
          manual: t("sourceType.manual"),
          other: t("sourceType.other"),
        } as Record<DecisionSourceType, string>,
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