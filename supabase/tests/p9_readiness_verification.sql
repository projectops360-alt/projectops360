-- P9/G9 read-only verification. Execute against stage only after P8/G8 UAT.
-- This script does not insert, update, delete, or change feature flags.

with expected_tables(name) as (
  values
    ('financial_baseline_versions'),
    ('financial_funding_positions'),
    ('financial_commitment_positions'),
    ('financial_accrual_positions'),
    ('financial_payment_positions'),
    ('financial_reserve_positions'),
    ('financial_measurement_snapshots'),
    ('financial_forecast_scenarios'),
    ('financial_reconciliations'),
    ('financial_reconciliation_items')
), table_checks as (
  select
    name,
    to_regclass('public.' || name) is not null as present,
    coalesce((
      select relrowsecurity
      from pg_class
      where oid = to_regclass('public.' || name)
    ), false) as rls_enabled
  from expected_tables
)
select
  count(*) filter (where present) as required_tables_present,
  count(*) filter (where rls_enabled) as required_tables_with_rls,
  to_regclass('public.financial_project_cockpit') is not null as cockpit_present,
  to_regprocedure('public.capture_financial_actual_atomic(text,uuid,jsonb,jsonb,text,jsonb,text,text)') is not null as actual_rpc_present,
  to_regprocedure('public.transition_financial_record_atomic(text,uuid,text,text,jsonb,text,jsonb)') is not null as transition_rpc_present,
  not exists (
    select 1
    from public.financial_reconciliations
    where status = 'exception'
  ) as no_open_reconciliation_exceptions,
  not exists (
    select 1
    from public.financial_forecast_scenarios
    where status in ('approved', 'published')
      and eac is null
  ) as no_invalid_published_forecasts
from table_checks;
