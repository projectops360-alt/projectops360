-- ============================================================================
-- ProjectOps360° Budget & Cost Management Engine — additive domain foundation
-- P7-T1/T2. No destructive changes and no parallel event ledger.
-- Lifecycle evidence continues to use public.project_event_log exclusively.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  period_key text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'future'
    check (status in ('future','open','soft_close','closed','reopened','reclosed')),
  currency text not null default 'USD',
  version integer not null default 1 check (version > 0),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  reopened_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopen_reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, period_key),
  check (starts_on <= ends_on)
);

create table if not exists public.financial_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  operation_key text not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  command_type text not null,
  subject_type text not null,
  subject_id uuid,
  status text not null default 'processing'
    check (status in ('processing','completed','failed')),
  event_id uuid references public.project_event_log(event_id),
  result jsonb not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (project_id, operation_key)
);

create table if not exists public.financial_estimate_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  series_id uuid not null,
  version_no integer not null check (version_no > 0),
  title text not null,
  purpose text not null,
  status text not null default 'draft'
    check (status in ('draft','submitted','reviewed','approved_for_budget_proposal','rejected','withdrawn','superseded')),
  base_date date not null,
  as_of_date date not null,
  currency text not null default 'USD',
  total_amount numeric(18,2) not null default 0,
  classification_scheme text,
  classification_value text,
  classification_basis jsonb not null default '{}',
  quality_status text not null default 'incomplete'
    check (quality_status in ('available','provisional','incomplete','insufficient_inputs','invalid')),
  source_refs jsonb not null default '[]',
  metadata jsonb not null default '{}',
  prepared_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  supersedes_id uuid references public.financial_estimate_versions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, version_no)
);

create table if not exists public.financial_boe_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  estimate_version_id uuid not null unique references public.financial_estimate_versions(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','rejected','superseded')),
  scope_statement text not null,
  inclusions jsonb not null default '[]',
  exclusions jsonb not null default '[]',
  assumptions jsonb not null default '[]',
  methods jsonb not null default '[]',
  evidence_refs jsonb not null default '[]',
  risk_basis jsonb not null default '{}',
  contingency_basis jsonb not null default '{}',
  currency_basis jsonb not null default '{}',
  completeness jsonb not null default '{}',
  prepared_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_baseline_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  baseline_type text not null
    check (baseline_type in ('original_budget','current_baseline')),
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','active','superseded','rejected','withdrawn')),
  currency text not null default 'USD',
  total_amount numeric(18,2) not null default 0,
  effective_from date not null,
  source_estimate_version_id uuid references public.financial_estimate_versions(id),
  source_change_id uuid,
  supersedes_id uuid references public.financial_baseline_versions(id),
  approval_ref uuid,
  activated_by uuid references auth.users(id),
  activated_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, baseline_type, version_no)
);

create table if not exists public.financial_baseline_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  baseline_version_id uuid not null references public.financial_baseline_versions(id) on delete cascade,
  budget_item_id uuid references public.budget_items(id),
  control_account_ref text,
  cbs_code text,
  wbs_ref text,
  name text not null,
  amount numeric(18,2) not null,
  currency text not null default 'USD',
  time_phased_amounts jsonb not null default '[]',
  source_refs jsonb not null default '[]',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.funding_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  authorization_no text not null,
  version_no integer not null default 1 check (version_no > 0),
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','active','suspended','superseded','closed','rejected','withdrawn','revoked')),
  authorized_amount numeric(18,2) not null check (authorized_amount >= 0),
  currency text not null default 'USD',
  effective_from date not null,
  effective_to date,
  restrictions jsonb not null default '[]',
  source_refs jsonb not null default '[]',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, authorization_no, version_no),
  check (effective_to is null or effective_from <= effective_to)
);

create table if not exists public.funding_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  authorization_id uuid not null references public.funding_authorizations(id),
  movement_type text not null
    check (movement_type in ('release','return','restriction','restriction_release','transfer_in','transfer_out','suspension','revocation','reversal','adjustment')),
  amount numeric(18,2) not null check (amount <> 0),
  currency text not null,
  effective_date date not null,
  status text not null default 'posted' check (status in ('posted','reversed')),
  reason text,
  approval_ref uuid,
  reverses_movement_id uuid references public.funding_movements(id),
  idempotency_key text not null,
  source_refs jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

alter table public.procurement_items
  add column if not exists source_system text,
  add column if not exists source_document_id text,
  add column if not exists source_line_id text,
  add column if not exists source_version text,
  add column if not exists commitment_status text,
  add column if not exists commitment_effective_date date,
  add column if not exists commitment_fingerprint text;

create unique index if not exists procurement_source_identity_uq
  on public.procurement_items(project_id, source_system, source_document_id, source_line_id, source_version)
  where source_system is not null and source_document_id is not null and source_line_id is not null;

create table if not exists public.commitment_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  procurement_item_id uuid not null references public.procurement_items(id),
  movement_type text not null
    check (movement_type in ('original','amendment','cancellation','consumption','consumption_reversal','transfer','adjustment')),
  amount numeric(18,2) not null check (amount <> 0),
  quantity numeric(18,4),
  currency text not null,
  effective_date date not null,
  source_document_id text,
  source_line_id text,
  approval_ref uuid,
  reverses_movement_id uuid references public.commitment_movements(id),
  idempotency_key text not null,
  source_refs jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

alter table public.cost_actuals
  add column if not exists source_system text,
  add column if not exists source_transaction_id text,
  add column if not exists source_line_id text,
  add column if not exists incurred_date date,
  add column if not exists document_date date,
  add column if not exists accounting_date date,
  add column if not exists financial_period_id uuid references public.financial_periods(id),
  add column if not exists posting_status text default 'legacy_unverified',
  add column if not exists reversal_of_id uuid references public.cost_actuals(id),
  add column if not exists idempotency_key text,
  add column if not exists source_fingerprint text,
  add column if not exists reconciled_at timestamptz;

create unique index if not exists cost_actuals_source_identity_uq
  on public.cost_actuals(project_id, source_system, source_transaction_id, source_line_id)
  where source_system is not null and source_transaction_id is not null and source_line_id is not null;

create unique index if not exists cost_actuals_idempotency_uq
  on public.cost_actuals(project_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.financial_accruals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  budget_item_id uuid references public.budget_items(id),
  procurement_item_id uuid references public.procurement_items(id),
  period_id uuid not null references public.financial_periods(id),
  status text not null default 'draft'
    check (status in ('draft','submitted','reviewed','approved','posted','partially_matched','fully_matched','reversed','closed','rejected','withdrawn','expired')),
  basis text not null,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null,
  service_from date,
  service_to date,
  expected_reversal_date date,
  evidence_refs jsonb not null default '[]',
  prepared_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accrual_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  accrual_id uuid not null references public.financial_accruals(id),
  movement_type text not null
    check (movement_type in ('posting','match','reversal','adjustment')),
  amount numeric(18,2) not null check (amount <> 0),
  currency text not null,
  accounting_date date not null,
  period_id uuid not null references public.financial_periods(id),
  actual_cost_id uuid references public.cost_actuals(id),
  reverses_movement_id uuid references public.accrual_movements(id),
  idempotency_key text not null,
  source_refs jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create table if not exists public.financial_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  procurement_item_id uuid references public.procurement_items(id),
  source_document_id text,
  payee_ref text,
  status text not null default 'draft'
    check (status in ('draft','submitted','validated','approved','scheduled','instructed','partially_settled','settled','reconciled','closed','rejected','withdrawn','held','cancelled','returned','reversed','exception')),
  gross_amount numeric(18,2) not null check (gross_amount >= 0),
  net_amount numeric(18,2) not null check (net_amount >= 0),
  currency text not null,
  due_date date,
  scheduled_date date,
  evidence_refs jsonb not null default '[]',
  prepared_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  payment_id uuid not null references public.financial_payments(id),
  movement_type text not null
    check (movement_type in ('instruction','settlement','partial_settlement','return','reversal','reissue','adjustment')),
  amount numeric(18,2) not null check (amount <> 0),
  currency text not null,
  value_date date not null,
  source_transaction_id text,
  reverses_movement_id uuid references public.payment_movements(id),
  idempotency_key text not null,
  source_refs jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create table if not exists public.financial_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  change_no text not null,
  version_no integer not null default 1 check (version_no > 0),
  change_type text not null,
  title text not null,
  reason text not null,
  status text not null default 'draft'
    check (status in ('draft','submitted','triaged','assessed','recommended','approved','authorized_for_posting','posted','implemented','verified','closed','rejected','withdrawn','deferred','superseded','emergency_authorized','approved_not_posted','posting_failed')),
  urgency text not null default 'normal' check (urgency in ('normal','urgent','emergency')),
  currency text not null default 'USD',
  gross_impact numeric(18,2) not null default 0,
  net_impact numeric(18,2) not null default 0,
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  effective_date date,
  evidence_refs jsonb not null default '[]',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, change_no, version_no)
);

alter table public.financial_baseline_versions
  drop constraint if exists financial_baseline_versions_source_change_id_fkey,
  add constraint financial_baseline_versions_source_change_id_fkey
    foreign key (source_change_id) references public.financial_changes(id);

create table if not exists public.financial_change_impacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  change_id uuid not null references public.financial_changes(id) on delete cascade,
  impact_domain text not null
    check (impact_domain in ('scope','schedule','baseline','forecast','funding','commitment','reserve','cash','resource','risk')),
  control_account_ref text,
  amount numeric(18,2),
  currency text,
  schedule_days integer,
  treatment text not null default 'potential'
    check (treatment in ('potential','approved_not_posted','posted','rejected','withdrawn')),
  source_refs jsonb not null default '[]',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.reserve_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  reserve_type text not null check (reserve_type in ('contingency','management_reserve')),
  status text not null default 'draft'
    check (status in ('draft','approved','active','suspended','closed','revoked')),
  opening_amount numeric(18,2) not null check (opening_amount >= 0),
  currency text not null,
  effective_from date not null,
  effective_to date,
  risk_basis jsonb not null default '[]',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, reserve_type, effective_from),
  check (effective_to is null or effective_from <= effective_to)
);

create table if not exists public.reserve_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  reserve_account_id uuid not null references public.reserve_accounts(id),
  change_id uuid references public.financial_changes(id),
  risk_id uuid references public.risks(id),
  movement_type text not null
    check (movement_type in ('increase','decrease','drawdown','release','transfer_in','transfer_out','return','revocation','reversal','adjustment')),
  amount numeric(18,2) not null check (amount <> 0),
  currency text not null,
  effective_date date not null,
  reason text not null,
  approval_ref uuid,
  reverses_movement_id uuid references public.reserve_movements(id),
  idempotency_key text not null,
  source_refs jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, idempotency_key)
);

create table if not exists public.financial_measurement_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  baseline_version_id uuid references public.financial_baseline_versions(id),
  data_date date not null,
  formula_version text not null,
  currency text not null,
  bac numeric(18,2),
  pv numeric(18,2),
  ev numeric(18,2),
  ac numeric(18,2),
  cv numeric(18,2),
  sv numeric(18,2),
  cpi numeric(18,8),
  spi numeric(18,8),
  quality_status text not null
    check (quality_status in ('available','provisional','incomplete','insufficient_inputs','invalid')),
  limitations text[] not null default '{}',
  provenance jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, data_date, formula_version)
);

create table if not exists public.financial_forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  snapshot_id uuid references public.financial_measurement_snapshots(id),
  scenario_type text not null
    check (scenario_type in ('bottom_up','cpi','cpi_spi','pm_forecast','p50','p80')),
  formula_version text not null,
  status text not null default 'draft'
    check (status in ('draft','calculated','reviewed','approved','published','superseded','unavailable')),
  etc numeric(18,2),
  eac numeric(18,2),
  vac numeric(18,2),
  confidence numeric(5,4),
  assumptions jsonb not null default '[]',
  source_refs jsonb not null default '[]',
  unavailable_reason text,
  override_reason text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  period_id uuid references public.financial_periods(id),
  domain text not null
    check (domain in ('funding','baseline','commitment','actual','accrual','payment','cash','reserve','event_coverage','project')),
  as_of_date date not null,
  policy_version text not null,
  tolerance numeric(18,6) not null default 0 check (tolerance >= 0),
  expected_total numeric(18,2),
  actual_total numeric(18,2),
  difference numeric(18,2),
  status text not null
    check (status in ('draft','reconciled','within_tolerance','exception','approved')),
  source_refs jsonb not null default '[]',
  prepared_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  reconciliation_id uuid not null references public.financial_reconciliations(id) on delete cascade,
  item_type text not null,
  source_ref text,
  expected_amount numeric(18,2),
  actual_amount numeric(18,2),
  difference numeric(18,2),
  status text not null
    check (status in ('reconciled','within_tolerance','exception','excluded')),
  reason text,
  evidence_refs jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists financial_periods_scope_idx on public.financial_periods(project_id, starts_on, ends_on);
create index if not exists financial_estimates_scope_idx on public.financial_estimate_versions(project_id, series_id, version_no desc);
create index if not exists financial_baselines_scope_idx on public.financial_baseline_versions(project_id, status, version_no desc);
create index if not exists financial_baseline_lines_scope_idx on public.financial_baseline_lines(project_id, baseline_version_id);
create index if not exists funding_authorizations_scope_idx on public.funding_authorizations(project_id, status);
create index if not exists funding_movements_scope_idx on public.funding_movements(project_id, authorization_id, effective_date);
create index if not exists commitment_movements_scope_idx on public.commitment_movements(project_id, procurement_item_id, effective_date);
create index if not exists accruals_scope_idx on public.financial_accruals(project_id, period_id, status);
create index if not exists accrual_movements_scope_idx on public.accrual_movements(project_id, accrual_id, accounting_date);
create index if not exists payments_scope_idx on public.financial_payments(project_id, status);
create index if not exists payment_movements_scope_idx on public.payment_movements(project_id, payment_id, value_date);
create index if not exists financial_changes_scope_idx on public.financial_changes(project_id, status);
create index if not exists reserve_movements_scope_idx on public.reserve_movements(project_id, reserve_account_id, effective_date);
create index if not exists financial_snapshots_scope_idx on public.financial_measurement_snapshots(project_id, data_date desc);
create index if not exists financial_scenarios_scope_idx on public.financial_forecast_scenarios(project_id, scenario_type, created_at desc);
create index if not exists financial_reconciliations_scope_idx on public.financial_reconciliations(project_id, domain, as_of_date desc);

comment on table public.financial_operation_receipts is
  'Idempotency receipts for controlled financial commands; not an event ledger.';
comment on table public.financial_measurement_snapshots is
  'Immutable derived measurement snapshots with explicit formula version and quality.';
