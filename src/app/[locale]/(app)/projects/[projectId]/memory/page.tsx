import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, I18nField } from "@/types/database";
import { ProjectMemoryClient } from "./memory-client";
import type { MemoryItemView, LinkableEntities } from "@/components/memory";

export default async function ProjectMemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const { locale, projectId } = await params;
  const { item: initialItemId } = await searchParams;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();
  const lang = locale as Locale;

  // Verify the project exists & belongs to the org.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) notFound();

  // Fetch everything in parallel: memory items, their links, linkable entities,
  // and the aggregation counts for the secondary tabs.
  const [
    memoryResult,
    commResult, meetingResult, decisionResult, docResult,
    tasksResult, milestonesResult, risksResult, stakeholdersResult,
  ] = await Promise.all([
    supabase
      .from("project_memory_items")
      .select("id, title, content, summary, source_type, source_system, author_name, author_email, participants, occurred_at, created_at, importance_level, sentiment, ai_classification, tags, visibility, ai_status, index_status")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500),

    supabase.from("communication_items").select("id, title_i18n, item_date, source_type, requires_follow_up", { count: "exact" }).eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("item_date", { ascending: false }).limit(20),
    supabase.from("meetings").select("id, title_i18n, meeting_date, status", { count: "exact" }).eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("meeting_date", { ascending: false }).limit(20),
    supabase.from("decisions").select("id, title_i18n, decision_date, status, impact_area", { count: "exact" }).eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("decision_date", { ascending: false }).limit(20),
    supabase.from("documents").select("id, title_i18n, document_type, status", { count: "exact" }).eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(20),

    // Linkable entities (project-scoped, lightweight label fetches)
    supabase.from("roadmap_tasks").select("id, title").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(500),
    supabase.from("milestones").select("id, title").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(200),
    supabase.from("risks").select("id, title").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(200),
    supabase.from("stakeholders").select("id, name").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).limit(200),
  ]);

  // ── Build linkable entity maps (for the link selector + label resolution) ──
  const decisionsForLink = (decisionResult.data ?? []).map((d) => ({ id: d.id, label: getI18nValue(d.title_i18n as I18nField, lang) || "Untitled" }));
  const docsForLink = (docResult.data ?? []).map((d) => ({ id: d.id, label: getI18nValue(d.title_i18n as I18nField, lang) || "Untitled" }));
  const commsForLink = (commResult.data ?? []).map((c) => ({ id: c.id, label: getI18nValue(c.title_i18n as I18nField, lang) || "Untitled" }));
  const meetingsForLink = (meetingResult.data ?? []).map((m) => ({ id: m.id, label: getI18nValue(m.title_i18n as I18nField, lang) || "Untitled" }));

  const entities: LinkableEntities = {
    task: (tasksResult.data ?? []).map((t) => ({ id: t.id, label: t.title || "Untitled" })),
    milestone: (milestonesResult.data ?? []).map((m) => ({ id: m.id, label: m.title || "Untitled" })),
    risk: (risksResult.data ?? []).map((r) => ({ id: r.id, label: r.title || "Untitled" })),
    stakeholder: (stakeholdersResult.data ?? []).map((s) => ({ id: s.id, label: s.name || "Untitled" })),
    decision: decisionsForLink,
    document: docsForLink,
    communication: commsForLink,
    meeting: meetingsForLink,
  };

  // Flat id→label lookup for resolving existing link target labels.
  const labelById = new Map<string, string>();
  for (const list of Object.values(entities)) for (const e of list) labelById.set(e.id, e.label);

  // ── Fetch existing memory links ────────────────────────────────────────────
  const memoryIds = (memoryResult.data ?? []).map((m) => m.id);
  let linksByItem = new Map<string, MemoryItemView["links"]>();
  if (memoryIds.length > 0) {
    const { data: links } = await supabase
      .from("traceability_links")
      .select("id, source_id, target_type, target_id, link_type")
      .eq("organization_id", org.organizationId)
      .eq("source_type", "memory")
      .in("source_id", memoryIds);

    linksByItem = (links ?? []).reduce((acc, l) => {
      const arr = acc.get(l.source_id) ?? [];
      arr.push({
        linkId: l.id,
        targetType: l.target_type,
        targetId: l.target_id,
        linkType: l.link_type,
        label: labelById.get(l.target_id) ?? "—",
      });
      acc.set(l.source_id, arr);
      return acc;
    }, new Map<string, MemoryItemView["links"]>());
  }

  // ── Build memory item view models ──────────────────────────────────────────
  const memoryItems: MemoryItemView[] = (memoryResult.data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    content: m.content,
    summary: m.summary,
    sourceType: m.source_type,
    sourceSystem: m.source_system,
    authorName: m.author_name,
    authorEmail: m.author_email,
    participants: Array.isArray(m.participants) ? (m.participants as string[]) : [],
    occurredAt: m.occurred_at,
    createdAt: m.created_at,
    importanceLevel: m.importance_level,
    sentiment: m.sentiment,
    aiClassification: (m.ai_classification ?? {}) as MemoryItemView["aiClassification"],
    tags: Array.isArray(m.tags) ? (m.tags as string[]) : [],
    visibility: m.visibility,
    aiStatus: m.ai_status,
    indexStatus: m.index_status,
    links: linksByItem.get(m.id) ?? [],
  }));

  // ── Aggregation views for the secondary tabs (unchanged) ───────────────────
  const communications = (commResult.data ?? []).map((c) => ({
    id: c.id, title: getI18nValue(c.title_i18n as I18nField, lang) || "Untitled",
    date: c.item_date, sourceType: c.source_type ?? "other", requiresFollowUp: c.requires_follow_up ?? false,
  }));
  const meetings = (meetingResult.data ?? []).map((m) => ({
    id: m.id, title: getI18nValue(m.title_i18n as I18nField, lang) || "Untitled", date: m.meeting_date, status: m.status ?? "scheduled",
  }));
  const decisions = (decisionResult.data ?? []).map((d) => ({
    id: d.id, title: getI18nValue(d.title_i18n as I18nField, lang) || "Untitled", date: d.decision_date, status: d.status ?? "proposed", impactArea: d.impact_area ?? null,
  }));
  const documents = (docResult.data ?? []).map((doc) => ({
    id: doc.id, title: getI18nValue(doc.title_i18n as I18nField, lang) || "Untitled", documentType: doc.document_type ?? null, status: doc.status ?? "draft",
  }));

  const counts = {
    memory: memoryItems.length,
    communications: commResult.count ?? 0,
    meetings: meetingResult.count ?? 0,
    decisions: decisionResult.count ?? 0,
    documents: docResult.count ?? 0,
  };

  return (
    <ProjectMemoryClient
      projectId={projectId}
      locale={locale}
      memoryItems={memoryItems}
      entities={entities}
      initialItemId={initialItemId}
      communications={communications}
      meetings={meetings}
      decisions={decisions}
      documents={documents}
      counts={counts}
    />
  );
}
