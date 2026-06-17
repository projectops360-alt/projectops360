-- ============================================================================
-- ProjectOps360° — Business Model & Billing Foundation (Phase 1)
-- Migration: 20260722000000_billing_foundation.sql
--
-- Adds the organization-level billing/seat/entitlement foundation:
--   • plans              — GLOBAL, platform-managed, EDITABLE pricing
--   • plan_entitlements  — limits + feature flags per plan
--   • subscriptions      — one active subscription per organization
--   • billing_usage_snapshots — periodic usage counts
--   • organization_members extensions — billing_seat_type, status, workspace_role…
--
-- Design rules honored:
--   - Additive only. Does NOT alter the existing organization_members.role or
--     organizations.plan CHECK constraints (kept for backward compatibility).
--   - Billing is at the ORGANIZATION level. Seats live on organization_members.
--   - plans/plan_entitlements are GLOBAL (platform owner edits prices/limits).
--   - Reuses RLS via is_org_member() and update_updated_at().
-- ============================================================================

-- ── 1. plans (global, editable pricing) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code     text UNIQUE NOT NULL,             -- personal | team | business | enterprise
  name          text NOT NULL,
  description   text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly  numeric NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'USD',
  is_enterprise boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. plan_entitlements (limits + features per plan) ───────────────────────
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                       uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  -- limits: NULL means unlimited
  max_active_projects           integer,
  max_billable_users            integer,
  max_company_teams             integer,
  max_external_contacts         integer,
  max_stakeholder_viewers       integer,
  max_ai_credits_per_month      integer,
  max_memory_storage_mb         integer,
  max_documents_indexed         integer,
  -- feature flags
  advanced_governance_enabled   boolean NOT NULL DEFAULT false,
  approval_matrix_enabled       boolean NOT NULL DEFAULT false,
  stakeholder_portal_enabled    boolean NOT NULL DEFAULT false,
  portfolio_view_enabled        boolean NOT NULL DEFAULT false,
  scope_creep_detection_enabled boolean NOT NULL DEFAULT false,
  project_memory_enabled        boolean NOT NULL DEFAULT false,
  integrations_enabled          boolean NOT NULL DEFAULT false,
  audit_logs_enabled            boolean NOT NULL DEFAULT false,
  sso_enabled                   boolean NOT NULL DEFAULT false,
  custom_roles_enabled          boolean NOT NULL DEFAULT false,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id)
);

-- ── 3. subscriptions (one per organization) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id                            uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  status                             text NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('trialing','active','past_due','canceled','suspended')),
  billing_provider                   text,           -- 'stripe' | NULL (internal)
  billing_provider_customer_id       text,
  billing_provider_subscription_id   text,
  billing_email                      text,
  billing_cycle                      text NOT NULL DEFAULT 'monthly'
                                     CHECK (billing_cycle IN ('monthly','yearly')),
  current_period_start               timestamptz,
  current_period_end                 timestamptz,
  cancel_at_period_end               boolean NOT NULL DEFAULT false,
  -- Enterprise custom limits/flags overriding the plan's entitlements.
  entitlement_overrides              jsonb NOT NULL DEFAULT '{}',
  created_at                         timestamptz NOT NULL DEFAULT now(),
  updated_at                         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- ── 4. billing_usage_snapshots ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_usage_snapshots (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date             date NOT NULL DEFAULT current_date,
  active_billable_users     integer NOT NULL DEFAULT 0,
  active_projects           integer NOT NULL DEFAULT 0,
  company_teams_count       integer NOT NULL DEFAULT 0,
  external_contacts_count   integer NOT NULL DEFAULT 0,
  stakeholder_viewers_count integer NOT NULL DEFAULT 0,
  ai_credits_used           integer NOT NULL DEFAULT 0,
  memory_storage_used_mb    numeric NOT NULL DEFAULT 0,
  documents_indexed_count   integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- ── 5. organization_members extensions (additive) ──────────────────────────
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS billing_seat_type   text,
  ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS workspace_role      text,
  ADD COLUMN IF NOT EXISTS department          text,
  ADD COLUMN IF NOT EXISTS job_title           text,
  ADD COLUMN IF NOT EXISTS skills              text[],
  ADD COLUMN IF NOT EXISTS availability_status text,
  ADD COLUMN IF NOT EXISTS default_hourly_rate numeric;

-- Value checks (idempotent: drop then add).
ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS org_members_status_chk;
ALTER TABLE public.organization_members ADD CONSTRAINT org_members_status_chk
  CHECK (status IN ('invited','active','suspended','removed'));

ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS org_members_seat_chk;
ALTER TABLE public.organization_members ADD CONSTRAINT org_members_seat_chk
  CHECK (billing_seat_type IS NULL OR billing_seat_type IN
    ('owner','admin','full_seat','contributor_seat','light_seat','viewer_free','external_free'));

-- ── 6. Seed global plans (idempotent; never overwrites edited prices) ────────
INSERT INTO public.plans (plan_code, name, description, price_monthly, price_yearly, is_enterprise, sort_order) VALUES
  ('personal',   'Personal',        'Solo founders, freelancers, students and individual PMs.', 0,    0,    false, 1),
  ('team',       'Team',            'Small teams and small companies.',                          29,   290,  false, 2),
  ('business',   'Business / PMO',  'Companies, PMOs, consulting firms and serious project teams.', 99, 990,  false, 3),
  ('enterprise', 'Enterprise',      'Large/regulated orgs, construction, ERP and enterprise PMOs.', 0,   0,    true,  4)
ON CONFLICT (plan_code) DO NOTHING;

-- ── 7. Seed entitlements per plan (idempotent) ──────────────────────────────
-- Personal
INSERT INTO public.plan_entitlements (
  plan_id, max_active_projects, max_billable_users, max_company_teams, max_external_contacts,
  max_stakeholder_viewers, max_ai_credits_per_month, max_memory_storage_mb, max_documents_indexed,
  advanced_governance_enabled, approval_matrix_enabled, stakeholder_portal_enabled, portfolio_view_enabled,
  scope_creep_detection_enabled, project_memory_enabled, integrations_enabled, audit_logs_enabled,
  sso_enabled, custom_roles_enabled)
SELECT id, 2, 1, 0, 3, 3, 100, 200, 20,
  false, false, false, false, false, false, false, false, false, false
FROM public.plans WHERE plan_code = 'personal'
ON CONFLICT (plan_id) DO NOTHING;

-- Team
INSERT INTO public.plan_entitlements (
  plan_id, max_active_projects, max_billable_users, max_company_teams, max_external_contacts,
  max_stakeholder_viewers, max_ai_credits_per_month, max_memory_storage_mb, max_documents_indexed,
  advanced_governance_enabled, approval_matrix_enabled, stakeholder_portal_enabled, portfolio_view_enabled,
  scope_creep_detection_enabled, project_memory_enabled, integrations_enabled, audit_logs_enabled,
  sso_enabled, custom_roles_enabled)
SELECT id, 10, 10, 5, 25, 25, 1000, 2000, 200,
  false, false, false, false, false, true, false, false, false, false
FROM public.plans WHERE plan_code = 'team'
ON CONFLICT (plan_id) DO NOTHING;

-- Business / PMO
INSERT INTO public.plan_entitlements (
  plan_id, max_active_projects, max_billable_users, max_company_teams, max_external_contacts,
  max_stakeholder_viewers, max_ai_credits_per_month, max_memory_storage_mb, max_documents_indexed,
  advanced_governance_enabled, approval_matrix_enabled, stakeholder_portal_enabled, portfolio_view_enabled,
  scope_creep_detection_enabled, project_memory_enabled, integrations_enabled, audit_logs_enabled,
  sso_enabled, custom_roles_enabled)
SELECT id, 50, 50, 25, 200, 200, 5000, 10000, 1000,
  true, true, true, true, true, true, false, false, false, true
FROM public.plans WHERE plan_code = 'business'
ON CONFLICT (plan_id) DO NOTHING;

-- Enterprise (NULL limit = unlimited; all features on)
INSERT INTO public.plan_entitlements (
  plan_id, max_active_projects, max_billable_users, max_company_teams, max_external_contacts,
  max_stakeholder_viewers, max_ai_credits_per_month, max_memory_storage_mb, max_documents_indexed,
  advanced_governance_enabled, approval_matrix_enabled, stakeholder_portal_enabled, portfolio_view_enabled,
  scope_creep_detection_enabled, project_memory_enabled, integrations_enabled, audit_logs_enabled,
  sso_enabled, custom_roles_enabled)
SELECT id, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  true, true, true, true, true, true, true, true, true, true
FROM public.plans WHERE plan_code = 'enterprise'
ON CONFLICT (plan_id) DO NOTHING;

-- ── 8. Backfill: one subscription per existing organization ─────────────────
INSERT INTO public.subscriptions (organization_id, plan_id, status, billing_cycle)
SELECT o.id,
  (SELECT id FROM public.plans WHERE plan_code =
    CASE o.plan WHEN 'free' THEN 'personal' WHEN 'pro' THEN 'team'
                WHEN 'enterprise' THEN 'enterprise' ELSE 'personal' END),
  'active', 'monthly'
FROM public.organizations o
WHERE o.deleted_at IS NULL
ON CONFLICT (organization_id) DO NOTHING;

-- ── 9. Backfill: seat types + workspace roles for existing members ──────────
UPDATE public.organization_members
SET billing_seat_type = CASE role
      WHEN 'owner'  THEN 'owner'
      WHEN 'admin'  THEN 'admin'
      WHEN 'member' THEN 'full_seat'
      WHEN 'viewer' THEN 'viewer_free'
      ELSE 'full_seat' END,
    workspace_role = COALESCE(workspace_role, CASE role
      WHEN 'owner'  THEN 'Owner'
      WHEN 'admin'  THEN 'Admin'
      WHEN 'member' THEN 'Team Member'
      WHEN 'viewer' THEN 'Viewer'
      ELSE 'Team Member' END)
WHERE billing_seat_type IS NULL;

-- ── 10. Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plan_entitlements_plan ON public.plan_entitlements (plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_org ON public.billing_usage_snapshots (organization_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON public.organization_members (organization_id, status);

-- ── 11. updated_at triggers ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.plans;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.plan_entitlements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.plan_entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 12. RLS ─────────────────────────────────────────────────────────────────
-- plans + plan_entitlements: GLOBAL read for any authenticated user; writes
-- only via service_role (platform owner edits through the admin client).
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads plans" ON public.plans;
CREATE POLICY "Anyone reads plans" ON public.plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role plans" ON public.plans;
CREATE POLICY "Service role plans" ON public.plans FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Anyone reads entitlements" ON public.plan_entitlements;
CREATE POLICY "Anyone reads entitlements" ON public.plan_entitlements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role entitlements" ON public.plan_entitlements;
CREATE POLICY "Service role entitlements" ON public.plan_entitlements FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- subscriptions + billing_usage_snapshots: org-scoped.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['subscriptions','billing_usage_snapshots'] LOOP
    EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Members read %1$s" ON public.%1$s FOR SELECT USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Service role %1$s" ON public.%1$s FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t);
  END LOOP;
END $$;
