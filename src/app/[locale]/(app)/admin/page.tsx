// ============================================================================
// ProjectOps360° — Admin Console (platform-wide, read-only, server-gated)
// ============================================================================
// Internal administration surface giving platform-wide visibility over
// companies, users, projects and tasks. Access is a STRICT server-side check:
// only authorized platform admins (today: pmo@xxx-demo.io, plus any active row
// in admin_authorized_users) may reach it. Unauthorized users get a 404 — the
// route existence is not revealed and NO data is loaded before the gate.
//
// Gate order is load-bearing: getOrgContext → requirePlatformAdmin → notFound
// (if denied) → only then run admin queries. A denied user never causes a
// single business-table read.
// ============================================================================

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

  // 1) Authenticated + org context (the (app) layout already redirects the
  //    unauthenticated; this re-resolves the caller for the gate + logging).
  const ctx = await getOrgContext().catch(() => null);

  // 2) Platform-admin gate (table first, then pmo@xxx-demo.io fallback). The
  //    fallback email is the ONLY authorized address until the allowlist table
  //    is populated from this same console.
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

  // 3) Admin queries — only run AFTER the gate. Cross-org via service role.
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

  return (
    <AdminConsole
      locale={locale as Locale}
      metrics={metrics}
      companies={companies}
      projectsByUser={projectsByUser}
      projectTasks={projectTasks}
      admins={admins}
      planCatalog={planCatalog}
      fallbackEmail="pmo@xxx-demo.io"
    />
  );
}