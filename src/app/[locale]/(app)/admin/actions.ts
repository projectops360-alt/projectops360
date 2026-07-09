"use server";

// ============================================================================
// ProjectOps360° — Admin Console server actions (server-gated, paginated)
// ============================================================================
// Drill-down actions invoked from the Admin Console client. Each re-validates
// the platform-admin gate BEFORE any business query — a client cannot bypass
// the page gate by calling these directly. On denial they return a structured
// not-authorized result (never throw notFound, which is reserved for render).
// ============================================================================

import { getOrgContext } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/admin-console/access.server";
import { getUsersByCompany, getProjectTasks } from "@/lib/admin-console/queries";
import { logAdminEvent } from "@/lib/admin-console/audit";
import type {
  AdminTaskFilters,
  AdminTaskPage,
  CompanyUserRow,
} from "@/lib/admin-console/types";
import type { Locale } from "@/types/database";

export async function getOrgUsersAction(orgId: string): Promise<
  { ok: true; users: CompanyUserRow[] } | { ok: false; reason: "not_authorized" }
> {
  const ctx = await getOrgContext().catch(() => null);
  if (!ctx || !(await requirePlatformAdmin(ctx.email, "/admin"))) {
    return { ok: false, reason: "not_authorized" };
  }
  const users = await getUsersByCompany(orgId, ctx.locale as Locale);
  return { ok: true, users };
}

export async function getProjectTasksAction(
  projectId: string,
  filters: AdminTaskFilters,
): Promise<
  | { ok: true; page: AdminTaskPage }
  | { ok: false; reason: "not_authorized" }
> {
  const ctx = await getOrgContext().catch(() => null);
  if (!ctx || !(await requirePlatformAdmin(ctx.email, "/admin"))) {
    return { ok: false, reason: "not_authorized" };
  }
  const page = await getProjectTasks(projectId, filters, ctx.locale as Locale);
  logAdminEvent({
    event: "admin_tasks_loaded",
    email: ctx.email,
    userId: ctx.userId,
    route: "/admin",
    result: "ok",
    extra: { projectId, page: page.page, total: page.total },
  });
  return { ok: true, page };
}