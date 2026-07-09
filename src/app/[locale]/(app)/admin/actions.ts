"use server";

// ============================================================================
// ProjectOps360° — Admin Console server actions (server-gated, paginated)
// ============================================================================
// Drill-down actions invoked from the Admin Console client. Each re-validates
// the platform-admin gate BEFORE any business query — a client cannot bypass
// the page gate by calling these directly. On denial they return a structured
// not-authorized result (never throw notFound, which is reserved for render).
// ============================================================================

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/admin-console/access.server";
import {
  getUsersByCompany,
  getProjectTasks,
  renameOrganization,
} from "@/lib/admin-console/queries";
import { logAdminEvent, recordAdminAudit } from "@/lib/admin-console/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/product-brain/access";
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

/**
 * Rename ANY organization (platform-admin write). Validation lives in the
 * SECURITY DEFINER RPC admin_rename_organization (2–120 chars, org exists);
 * the rename is persisted to audit_logs as organization_renamed.
 */
export async function renameOrgAdminAction(
  orgId: string,
  name: string,
): Promise<
  | { ok: true; name: string }
  | { ok: false; reason: "not_authorized" | "invalid_name" | "error" }
> {
  const ctx = await getOrgContext().catch(() => null);
  if (!ctx || !(await requirePlatformAdmin(ctx.email, "/admin"))) {
    return { ok: false, reason: "not_authorized" };
  }

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 120) {
    return { ok: false, reason: "invalid_name" };
  }

  const result = await renameOrganization(orgId, trimmed);
  if (!result) return { ok: false, reason: "error" };

  await recordAdminAudit({
    action: "organization_renamed",
    organizationId: orgId,
    actorUserId: ctx.userId,
    entityType: "organization",
    entityId: orgId,
    metadata: { oldName: result.oldName, newName: result.newName, via: "admin_console" },
  });
  logAdminEvent({
    event: "organization_renamed",
    email: ctx.email,
    userId: ctx.userId,
    route: "/admin",
    result: "ok",
    extra: { orgId },
  });

  revalidatePath("/", "layout");
  return { ok: true, name: result.newName };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Grant (or re-activate) platform-admin access for an email. Inserts/updates
 * admin_authorized_users; only an already-authorized platform admin can call
 * it. Persisted to audit_logs (actor's org — the table is org-scoped).
 */
export async function grantSystemAdminAction(
  email: string,
): Promise<{ ok: true } | { ok: false; reason: "not_authorized" | "invalid_email" | "error" }> {
  const ctx = await getOrgContext().catch(() => null);
  if (!ctx || !(await requirePlatformAdmin(ctx.email, "/admin"))) {
    return { ok: false, reason: "not_authorized" };
  }

  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    return { ok: false, reason: "invalid_email" };
  }

  const supabase = createAdminClient();
  // Upsert against the lower(trim(email)) unique index: reuse an existing row
  // (re-activate a revoked admin) or insert a fresh grant.
  const { data: existing } = await supabase
    .from("admin_authorized_users")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("admin_authorized_users")
        .update({ is_active: true, revoked_at: null, role: "system_admin", granted_by: ctx.userId })
        .eq("id", (existing as { id: string }).id)
    : await supabase.from("admin_authorized_users").insert({
        email: normalized,
        role: "system_admin",
        is_active: true,
        granted_by: ctx.userId,
      });

  if (error) return { ok: false, reason: "error" };

  await recordAdminAudit({
    action: "admin_granted",
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    entityType: "admin_authorization",
    metadata: { targetEmail: normalized },
  });
  logAdminEvent({
    event: "admin_granted",
    email: ctx.email,
    userId: ctx.userId,
    route: "/admin",
    result: "ok",
    extra: { targetEmail: normalized },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Revoke platform-admin access for an email (soft: is_active=false +
 * revoked_at). The two hardcoded platform owners keep app-level access via
 * ADMIN_CONSOLE_ALLOWED_EMAILS regardless of table state — by design.
 */
export async function revokeSystemAdminAction(
  email: string,
): Promise<{ ok: true } | { ok: false; reason: "not_authorized" | "not_found" | "error" }> {
  const ctx = await getOrgContext().catch(() => null);
  if (!ctx || !(await requirePlatformAdmin(ctx.email, "/admin"))) {
    return { ok: false, reason: "not_authorized" };
  }

  const normalized = normalizeEmail(email);
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("admin_authorized_users")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (!existing) return { ok: false, reason: "not_found" };

  const { error } = await supabase
    .from("admin_authorized_users")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", (existing as { id: string }).id);

  if (error) return { ok: false, reason: "error" };

  await recordAdminAudit({
    action: "admin_revoked",
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    entityType: "admin_authorization",
    metadata: { targetEmail: normalized },
  });
  logAdminEvent({
    event: "admin_revoked",
    email: ctx.email,
    userId: ctx.userId,
    route: "/admin",
    result: "ok",
    extra: { targetEmail: normalized },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}