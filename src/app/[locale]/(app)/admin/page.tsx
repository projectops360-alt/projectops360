// ============================================================================
// ProjectOps360° — Admin Console (platform-wide, read-only, server-gated)
// ============================================================================
// Internal administration surface giving platform-wide visibility over
// companies, users, projects and tasks. Access is a STRICT server-side check:
// only authorized platform admins (the emergency owner, plus any active row
// in admin_authorized_users) may reach it. Unauthorized users get a 404 — the
// route existence is not revealed and NO data is loaded before the gate.
//
// Gate order is load-bearing: getOrgContext → requirePlatformAdmin → notFound
// (if denied) → only then run admin queries. A denied user never causes a
// single business-table read.
// ============================================================================

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/auth";
import { requirePlatformAdmin, getAuthorizedAdmins } from "@/lib/admin-console/access.server";
import {
  getAdminMetrics,
  getCompaniesWithCounts,
  getProjectsByUser,
  getProjectTaskAggregates,
  getPlanCatalog,
} from "@/lib/admin-console/queries";
import { logAdminEvent } from "@/lib/admin-console/audit";
import type { Locale } from "@/types/database";
import { AdminConsole } from "@/components/admin-console/admin-console";

export default async function AdminConsolePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getOrgContext().catch(() => null);
  const route = "/admin";
  const allowed = ctx ? await requirePlatformAdmin(ctx.email, route) : false;
  if (!ctx || !allowed) {
    logAdminEvent({
      event: "admin_access_denied",
      email: ctx?.email ?? null,
      route,
      result: "denied",
    });
    notFound();
  }

  logAdminEvent({ event: "admin_page_viewed", email: ctx.email, userId: ctx.userId, route, result: "ok" });

  const [metrics, companies, projectsByUser, projectTasks, admins, planCatalog] = await Promise.all([
    getAdminMetrics(),
    getCompaniesWithCounts(locale as Locale),
    getProjectsByUser(locale as Locale),
    getProjectTaskAggregates(locale as Locale),
    getAuthorizedAdmins(),
    getPlanCatalog(),
  ]);

  logAdminEvent({
    event: "admin_metrics_loaded",
    email: ctx.email,
    userId: ctx.userId,
    route,
    result: "ok",
    extra: {
      companies: metrics.totalCompanies,
      users: metrics.totalUsers,
      projects: metrics.totalProjects,
      tasks: metrics.totalTasks,
    },
  });

  let pendingKnowledgeChunks = 0;
  try {
    const client = await createClient();
    const { count } = await client
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .is("embedding", null)
      .is("deleted_at", null);
    pendingKnowledgeChunks = count ?? 0;
  } catch {
    pendingKnowledgeChunks = 0;
  }

  const isEs = locale === "es";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={`/${locale}/admin/user-integrity`}
          className="inline-flex items-center rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/30 dark:text-brand-300"
        >
          {isEs ? "Diagnóstico de usuarios" : "User integrity"}
        </Link>
      </div>
      <AdminConsole
        pendingKnowledgeChunks={pendingKnowledgeChunks}
        locale={locale as Locale}
        metrics={metrics}
        companies={companies}
        projectsByUser={projectsByUser}
        projectTasks={projectTasks}
        admins={admins}
        planCatalog={planCatalog}
        fallbackEmail="efrain.pradas@gmail.com"
      />
    </div>
  );
}
