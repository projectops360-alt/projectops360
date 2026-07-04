// ============================================================================
// ProjectOps360° — Living Graph Observability Panel (admin route)
// ============================================================================
// Internal realtime diagnostics for the LGRE. Access is enforced SERVER-SIDE by
// the STRICT EMAIL ALLOWLIST (same gate as the Product Brain cockpit) — not a
// role, not UI hiding. Unauthorized users get a 404 (the route's existence is
// not revealed) and NO diagnostics data is loaded or serialized to the client.
// Only SAFE aggregates reach the client: infra health booleans + an org-scoped
// project list (id + display title). No payloads, no ledger rows, no secrets.
// ============================================================================

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/auth";
import { isProductBrainAllowedEmail } from "@/lib/product-brain/access.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLivingGraphEnvironmentHealth } from "@/lib/living-graph/observability/environment-health.server";
import { LivingGraphObservabilityPanel } from "@/components/admin/living-graph-observability-panel";

function resolveTitle(row: { slug: string | null; title_i18n: unknown }, locale: string): string {
  const t = row.title_i18n;
  if (t && typeof t === "object") {
    const rec = t as Record<string, unknown>;
    const v = rec[locale] ?? rec.en ?? Object.values(rec)[0];
    if (typeof v === "string" && v.trim()) return v;
  }
  return row.slug ?? "—";
}

export default async function LivingGraphObservabilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // ── Server-side access control: STRICT EMAIL ALLOWLIST ─────────────────────
  const org = await getOrgContext();
  if (!isProductBrainAllowedEmail(org.email)) {
    notFound(); // do not reveal existence; load no data
  }

  const environment = await getLivingGraphEnvironmentHealth(org.organizationId).catch(() => null);

  const supabase = createAdminClient();
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const projects = (projectRows ?? []).map((p) => ({
    id: p.id as string,
    title: resolveTitle(p as { slug: string | null; title_i18n: unknown }, locale),
  }));

  return (
    <LivingGraphObservabilityPanel
      organizationId={org.organizationId}
      userId={org.userId}
      environment={environment}
      projects={projects}
    />
  );
}
