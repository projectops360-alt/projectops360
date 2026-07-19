-- ProjectOps360° membership catalog refresh.
-- Data-only and idempotent: existing plan IDs and organization subscriptions stay unchanged.

WITH catalog (
  plan_code,
  name,
  description,
  price_monthly,
  price_yearly,
  is_enterprise,
  sort_order
) AS (
  VALUES
    (
      'personal',
      'Personal',
      'Perfect for freelancers, students and individual project managers.',
      9,
      96,
      false,
      1
    ),
    (
      'team',
      'Team',
      'Ideal for growing teams and small companies managing multiple projects.',
      16,
      192,
      false,
      2
    ),
    (
      'business',
      'Business / PMO',
      'Designed for companies, PMOs, consulting firms and organizations managing multiple teams and strategic portfolios.',
      29,
      348,
      false,
      3
    ),
    (
      'enterprise',
      'Enterprise',
      'Built for enterprise organizations requiring governance, security, compliance and unlimited scalability.',
      0,
      0,
      true,
      4
    )
)
UPDATE public.plans AS plan
SET
  name = catalog.name,
  description = catalog.description,
  price_monthly = catalog.price_monthly,
  price_yearly = catalog.price_yearly,
  is_enterprise = catalog.is_enterprise,
  is_active = true,
  sort_order = catalog.sort_order
FROM catalog
WHERE plan.plan_code = catalog.plan_code;

WITH catalog (
  plan_code,
  max_active_projects,
  max_billable_users,
  max_company_teams,
  max_external_contacts,
  max_stakeholder_viewers,
  max_ai_credits_per_month,
  max_memory_storage_mb,
  max_documents_indexed,
  advanced_governance_enabled,
  approval_matrix_enabled,
  stakeholder_portal_enabled,
  portfolio_view_enabled,
  scope_creep_detection_enabled,
  project_memory_enabled,
  integrations_enabled,
  audit_logs_enabled,
  sso_enabled,
  custom_roles_enabled
) AS (
  VALUES
    (
      'personal',
      5,
      1,
      0,
      5,
      5,
      25,
      500,
      100,
      false,
      false,
      true,
      false,
      true,
      false,
      false,
      false,
      false,
      false
    ),
    (
      'team',
      NULL,
      10,
      5,
      25,
      25,
      300,
      5120,
      500,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      true,
      false,
      true
    ),
    (
      'business',
      NULL,
      50,
      25,
      250,
      250,
      5000,
      51200,
      5000,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      true
    ),
    (
      'enterprise',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true
    )
)
INSERT INTO public.plan_entitlements (
  plan_id,
  max_active_projects,
  max_billable_users,
  max_company_teams,
  max_external_contacts,
  max_stakeholder_viewers,
  max_ai_credits_per_month,
  max_memory_storage_mb,
  max_documents_indexed,
  advanced_governance_enabled,
  approval_matrix_enabled,
  stakeholder_portal_enabled,
  portfolio_view_enabled,
  scope_creep_detection_enabled,
  project_memory_enabled,
  integrations_enabled,
  audit_logs_enabled,
  sso_enabled,
  custom_roles_enabled
)
SELECT
  plan.id,
  catalog.max_active_projects,
  catalog.max_billable_users,
  catalog.max_company_teams,
  catalog.max_external_contacts,
  catalog.max_stakeholder_viewers,
  catalog.max_ai_credits_per_month,
  catalog.max_memory_storage_mb,
  catalog.max_documents_indexed,
  catalog.advanced_governance_enabled,
  catalog.approval_matrix_enabled,
  catalog.stakeholder_portal_enabled,
  catalog.portfolio_view_enabled,
  catalog.scope_creep_detection_enabled,
  catalog.project_memory_enabled,
  catalog.integrations_enabled,
  catalog.audit_logs_enabled,
  catalog.sso_enabled,
  catalog.custom_roles_enabled
FROM catalog
JOIN public.plans AS plan ON plan.plan_code = catalog.plan_code
ON CONFLICT (plan_id) DO UPDATE
SET
  max_active_projects = EXCLUDED.max_active_projects,
  max_billable_users = EXCLUDED.max_billable_users,
  max_company_teams = EXCLUDED.max_company_teams,
  max_external_contacts = EXCLUDED.max_external_contacts,
  max_stakeholder_viewers = EXCLUDED.max_stakeholder_viewers,
  max_ai_credits_per_month = EXCLUDED.max_ai_credits_per_month,
  max_memory_storage_mb = EXCLUDED.max_memory_storage_mb,
  max_documents_indexed = EXCLUDED.max_documents_indexed,
  advanced_governance_enabled = EXCLUDED.advanced_governance_enabled,
  approval_matrix_enabled = EXCLUDED.approval_matrix_enabled,
  stakeholder_portal_enabled = EXCLUDED.stakeholder_portal_enabled,
  portfolio_view_enabled = EXCLUDED.portfolio_view_enabled,
  scope_creep_detection_enabled = EXCLUDED.scope_creep_detection_enabled,
  project_memory_enabled = EXCLUDED.project_memory_enabled,
  integrations_enabled = EXCLUDED.integrations_enabled,
  audit_logs_enabled = EXCLUDED.audit_logs_enabled,
  sso_enabled = EXCLUDED.sso_enabled,
  custom_roles_enabled = EXCLUDED.custom_roles_enabled;
