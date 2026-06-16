import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { CharterPrintClient } from "./charter-print-client";

export const dynamic = "force-dynamic";

export default async function CharterPrintPage({ params }: { params: Promise<{ locale: string; projectId: string }> }) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const org = await getOrgContext();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects").select("id, slug, title_i18n")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).single();
  if (!project) notFound();

  const { data: charter } = await supabase
    .from("project_charters").select("*")
    .eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle();
  if (!charter) notFound();

  const charterId = (charter as { id: string }).id;
  const [rolesRes, rulesRes, approvalsRes, signoffsRes] = await Promise.all([
    supabase.from("project_charter_roles").select("*").eq("charter_id", charterId).is("deleted_at", null).order("created_at"),
    supabase.from("project_governance_rules").select("*").eq("charter_id", charterId).is("deleted_at", null).order("created_at"),
    supabase.from("project_approval_matrix").select("*").eq("charter_id", charterId).is("deleted_at", null).order("created_at"),
    supabase.from("project_signoffs").select("*").eq("charter_id", charterId).order("created_at"),
  ]);

  const projectName = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  return (
    <CharterPrintClient
      locale={locale}
      projectId={projectId}
      projectName={projectName}
      charter={charter as Record<string, unknown>}
      roles={(rolesRes.data ?? []) as Record<string, unknown>[]}
      rules={(rulesRes.data ?? []) as Record<string, unknown>[]}
      approvals={(approvalsRes.data ?? []) as Record<string, unknown>[]}
      signoffs={(signoffsRes.data ?? []) as Record<string, unknown>[]}
    />
  );
}
