// ============================================================================
// ProjectOps360° — Backfill Administration Console (secure, admin-only)
// ============================================================================
// The single approved surface for executing Historical Backfill. Gated
// server-side: only org owners/admins (or a platform-admin allowlist) may reach
// it — everyone else gets a 404 (no data, no nav leak). See
// docs/product-brain/historical-backfill-service.md.
// ============================================================================

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canRunBackfill } from "@/lib/events/backfill-access";
import { getI18nValue, type I18nField, type Locale } from "@/types/database";
import { BackfillConsole } from "./backfill-console";

export default async function BackfillAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext().catch(() => null);
  if (!ctx || !canRunBackfill({ role: ctx.role, email: ctx.email })) notFound();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("projects")
    .select("id, slug, title_i18n, project_type, status")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  const projects = (data ?? []).map((p) => ({
    id: p.id as string,
    title: getI18nValue((p as { title_i18n: I18nField }).title_i18n, locale as Locale) || (p.slug as string),
    type: (p as { project_type?: string }).project_type ?? "general",
    status: (p as { status?: string }).status ?? "",
  }));

  return <BackfillConsole projects={projects} locale={locale} />;
}
