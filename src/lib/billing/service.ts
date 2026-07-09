// ============================================================================
// ProjectOps360° — Billing service (server-only)
// ============================================================================
// Org-level subscription, plan entitlements (with enterprise overrides),
// billable-seat counting, usage and plan-limit enforcement. Reuses the admin
// client; all reads are explicitly org-scoped.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import { BILLABLE_SEATS } from "./config";

export interface Plan {
  id: string;
  plan_code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  is_enterprise: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Entitlements {
  max_active_projects: number | null;
  max_billable_users: number | null;
  max_company_teams: number | null;
  max_external_contacts: number | null;
  max_stakeholder_viewers: number | null;
  max_ai_credits_per_month: number | null;
  max_memory_storage_mb: number | null;
  max_documents_indexed: number | null;
  advanced_governance_enabled: boolean;
  approval_matrix_enabled: boolean;
  stakeholder_portal_enabled: boolean;
  portfolio_view_enabled: boolean;
  scope_creep_detection_enabled: boolean;
  project_memory_enabled: boolean;
  integrations_enabled: boolean;
  audit_logs_enabled: boolean;
  sso_enabled: boolean;
  custom_roles_enabled: boolean;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string | null;
  status: string;
  billing_provider: string | null;
  billing_email: string | null;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  entitlement_overrides: Record<string, unknown>;
}

export interface Usage {
  activeBillableUsers: number;
  freeViewers: number;
  pendingInvites: number;
  activeProjects: number;
  companyTeams: number;
  externalContacts: number;
  stakeholderViewers: number;
  aiCreditsUsed: number;
  memoryStorageMb: number;
  documentsIndexed: number;
}

export interface OrgBilling {
  subscription: Subscription | null;
  plan: Plan | null;
  entitlements: Entitlements | null;
  usage: Usage;
}

type Admin = ReturnType<typeof createAdminClient>;

// ── Plans (global) ──────────────────────────────────────────────────────────

export interface PlanWithEntitlements extends Plan { entitlements: Entitlements | null }

export async function getPlansWithEntitlements(): Promise<PlanWithEntitlements[]> {
  const supabase = createAdminClient();
  const [{ data: plans }, { data: ents }] = await Promise.all([
    supabase.from("plans").select("*").order("sort_order"),
    supabase.from("plan_entitlements").select("*"),
  ]);
  const entByPlan = new Map((ents ?? []).map((e) => [String((e as { plan_id: string }).plan_id), e as unknown as Entitlements]));
  return ((plans ?? []) as unknown as Plan[]).map((p) => ({ ...p, entitlements: entByPlan.get(p.id) ?? null }));
}

// ── Org subscription + merged entitlements + usage ──────────────────────────

/** Merge plan entitlements with enterprise per-org overrides. */
function mergeEntitlements(base: Entitlements | null, overrides: Record<string, unknown>): Entitlements | null {
  if (!base) return null;
  if (!overrides || Object.keys(overrides).length === 0) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(overrides)) if (k in out && v !== undefined) out[k] = v;
  return out as unknown as Entitlements;
}

export async function getOrgBilling(org: OrgContext): Promise<OrgBilling> {
  const supabase = createAdminClient();
  const { data: sub } = await supabase.from("subscriptions").select("*")
    .eq("organization_id", org.organizationId).maybeSingle();
  const subscription = (sub ?? null) as unknown as Subscription | null;

  let plan: Plan | null = null;
  let entitlements: Entitlements | null = null;
  if (subscription?.plan_id) {
    const [{ data: planRow }, { data: entRow }] = await Promise.all([
      supabase.from("plans").select("*").eq("id", subscription.plan_id).maybeSingle(),
      supabase.from("plan_entitlements").select("*").eq("plan_id", subscription.plan_id).maybeSingle(),
    ]);
    plan = (planRow ?? null) as unknown as Plan | null;
    entitlements = mergeEntitlements(
      (entRow ?? null) as unknown as Entitlements | null,
      subscription.entitlement_overrides ?? {},
    );
  }

  const usage = await getUsage(org, supabase);
  return { subscription, plan, entitlements, usage };
}

// ── Usage counting ──────────────────────────────────────────────────────────

export async function getUsage(org: OrgContext, client?: Admin): Promise<Usage> {
  const supabase = client ?? createAdminClient();
  const [membersRes, projectsRes, memoryRes] = await Promise.all([
    supabase.from("organization_members").select("billing_seat_type, status").eq("organization_id", org.organizationId),
    supabase.from("projects").select("status").eq("organization_id", org.organizationId).is("deleted_at", null),
    supabase.from("project_memory_items").select("id", { count: "exact", head: true }).eq("organization_id", org.organizationId),
  ]);

  const members = (membersRes.data ?? []) as { billing_seat_type: string | null; status: string | null }[];
  let activeBillableUsers = 0, freeViewers = 0, pendingInvites = 0;
  for (const m of members) {
    if (m.status === "invited") { pendingInvites++; continue; }
    if (m.status !== "active") continue;
    if (BILLABLE_SEATS.includes((m.billing_seat_type ?? "") as never)) activeBillableUsers++;
    else if (m.billing_seat_type === "viewer_free" || m.billing_seat_type === "external_free") freeViewers++;
  }

  const projects = (projectsRes.data ?? []) as { status: string }[];
  const activeProjects = projects.filter((p) => p.status !== "completed" && p.status !== "cancelled").length;

  return {
    activeBillableUsers, freeViewers, pendingInvites,
    activeProjects,
    companyTeams: 0,          // Phase 2 (organization_teams)
    externalContacts: 0,      // Phase 2 (external_contacts)
    stakeholderViewers: freeViewers,
    aiCreditsUsed: 0,         // Phase 5 (AI metering)
    memoryStorageMb: 0,       // Phase 5 (storage metering)
    documentsIndexed: memoryRes.count ?? 0,
  };
}

/** Count active, billable internal members for the org. */
export async function countBillableSeats(org: OrgContext): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("organization_members")
    .select("billing_seat_type, status").eq("organization_id", org.organizationId).eq("status", "active");
  return ((data ?? []) as { billing_seat_type: string | null }[])
    .filter((m) => BILLABLE_SEATS.includes((m.billing_seat_type ?? "") as never)).length;
}

// ── Limit enforcement (soft) ────────────────────────────────────────────────

export interface LimitCheck {
  limit: number | null;
  current: number;
  allowed: boolean;     // adding one more is allowed
  atLimit: boolean;     // at/over the limit
  nearLimit: boolean;   // >= 80% of the limit
}

/** Soft limit check. limit === null → unlimited. */
export function checkLimit(limit: number | null | undefined, current: number): LimitCheck {
  if (limit === null || limit === undefined) {
    return { limit: null, current, allowed: true, atLimit: false, nearLimit: false };
  }
  return {
    limit, current,
    allowed: current < limit,
    atLimit: current >= limit,
    nearLimit: limit > 0 && current >= Math.floor(limit * 0.8),
  };
}

/** Has the org's plan enabled a given feature flag? */
export function hasFeature(entitlements: Entitlements | null, key: keyof Entitlements): boolean {
  return !!entitlements && entitlements[key] === true;
}

// ── Platform admin (who may edit GLOBAL plan pricing) ────────────────────────
// Prices are global. Editing them affects all orgs, so it is platform-level.

/**
 * @deprecated Do NOT use for authorization. The `org.role === "owner"`
 * fallback is a false positive: every personal org makes its user an "owner".
 * The plan catalog and the Admin Console now gate through
 * `isPlatformAdmin(email)` in `@/lib/admin-console/access.server`
 * (admin_authorized_users + hardcoded platform owners). Kept only until all
 * legacy references disappear.
 */
export function isPlatformAdmin(org: OrgContext): boolean {
  const allow = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length > 0) return allow.includes((org.email ?? "").toLowerCase());
  return org.role === "owner";
}
