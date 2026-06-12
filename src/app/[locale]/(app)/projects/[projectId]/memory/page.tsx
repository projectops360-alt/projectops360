import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, I18nField } from "@/types/database";
import { ProjectMemoryClient } from "./memory-client";

export default async function ProjectMemoryPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();
  const lang = locale as Locale;

  // Verify the project exists
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  // Fetch counts + recent items in parallel
  const [commResult, meetingResult, decisionResult, docResult] = await Promise.all([
    supabase
      .from("communication_items")
      .select("id, title_i18n, item_date, source_type, requires_follow_up", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("item_date", { ascending: false })
      .limit(20),

    supabase
      .from("meetings")
      .select("id, title_i18n, meeting_date, status", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("meeting_date", { ascending: false })
      .limit(20),

    supabase
      .from("decisions")
      .select("id, title_i18n, decision_date, status, impact_area", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("decision_date", { ascending: false })
      .limit(20),

    supabase
      .from("documents")
      .select("id, title_i18n, document_type, status", { count: "exact" })
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const communications = (commResult.data ?? []).map((c) => ({
    id: c.id,
    title: getI18nValue(c.title_i18n as I18nField, lang) || "Untitled",
    date: c.item_date,
    sourceType: c.source_type ?? "other",
    requiresFollowUp: c.requires_follow_up ?? false,
  }));

  const meetings = (meetingResult.data ?? []).map((m) => ({
    id: m.id,
    title: getI18nValue(m.title_i18n as I18nField, lang) || "Untitled",
    date: m.meeting_date,
    status: m.status ?? "scheduled",
  }));

  const decisions = (decisionResult.data ?? []).map((d) => ({
    id: d.id,
    title: getI18nValue(d.title_i18n as I18nField, lang) || "Untitled",
    date: d.decision_date,
    status: d.status ?? "proposed",
    impactArea: d.impact_area ?? null,
  }));

  const documents = (docResult.data ?? []).map((doc) => ({
    id: doc.id,
    title: getI18nValue(doc.title_i18n as I18nField, lang) || "Untitled",
    documentType: doc.document_type ?? null,
    status: doc.status ?? "draft",
  }));

  const counts = {
    communications: commResult.count ?? 0,
    meetings: meetingResult.count ?? 0,
    decisions: decisionResult.count ?? 0,
    documents: docResult.count ?? 0,
  };

  return (
    <ProjectMemoryClient
      projectId={projectId}
      locale={locale}
      communications={communications}
      meetings={meetings}
      decisions={decisions}
      documents={documents}
      counts={counts}
    />
  );
}
