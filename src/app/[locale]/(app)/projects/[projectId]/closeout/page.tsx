import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { computeCloseoutMetrics, computeCloseoutReadiness, computeMilestoneDurations, computeArchive } from "@/lib/rhythm/closeout";
import type { CloseoutNarrative } from "@/lib/rhythm/closeout";
import { CloseoutReportClient } from "./closeout-client";

export const dynamic = "force-dynamic";

export default async function CloseoutPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects").select("id, slug, title_i18n")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!project) notFound();

  const admin = createAdminClient();
  const [metrics, milestoneDurations, archive, closingRes] = await Promise.all([
    computeCloseoutMetrics(admin, org.organizationId, projectId),
    computeMilestoneDurations(admin, org.organizationId, projectId, locale as Locale),
    computeArchive(admin, org.organizationId, projectId, locale as Locale),
    supabase.from("meetings")
      .select("ai_summary, updated_at")
      .eq("project_id", projectId).eq("organization_id", org.organizationId)
      .eq("meeting_type", "closing").eq("meeting_status", "completed").is("deleted_at", null)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const readiness = computeCloseoutReadiness(metrics);

  const closeout = ((closingRes.data?.ai_summary as Record<string, unknown> | null)?.closeout) as
    { executiveSummary?: string; generatedAt?: string; narrative?: CloseoutNarrative } | undefined;

  const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  return (
    <CloseoutReportClient
      locale={locale}
      projectName={projectName}
      metrics={metrics}
      readiness={readiness}
      milestoneDurations={milestoneDurations}
      archive={archive}
      narrative={closeout?.narrative ?? null}
      executiveSummary={closeout?.executiveSummary ?? null}
      generatedAt={closeout?.generatedAt ?? null}
    />
  );
}
