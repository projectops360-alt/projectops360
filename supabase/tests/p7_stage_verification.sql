with expected(name) as (
  values
    ('financial_periods'),
    ('financial_operation_receipts'),
    ('financial_estimate_versions'),
    ('financial_boe_versions'),
    ('financial_baseline_versions'),
    ('financial_baseline_lines'),
    ('funding_authorizations'),
    ('funding_movements'),
    ('commitment_movements'),
    ('financial_accruals'),
    ('accrual_movements'),
    ('financial_payments'),
    ('payment_movements'),
    ('financial_changes'),
    ('financial_change_impacts'),
    ('reserve_accounts'),
    ('reserve_movements'),
    ('financial_measurement_snapshots'),
    ('financial_forecast_scenarios'),
    ('financial_reconciliations'),
    ('financial_reconciliation_items')
), checks as (
  select
    expected.name,
    to_regclass('public.' || expected.name) is not null as exists,
    coalesce(pg_class.relrowsecurity, false) as rls,
    has_table_privilege('authenticated', 'public.' || expected.name, 'SELECT')
      as authenticated_select,
    has_table_privilege('authenticated', 'public.' || expected.name, 'INSERT')
      as authenticated_insert
  from expected
  left join pg_class on pg_class.oid = to_regclass('public.' || expected.name)
)
select
  count(*) filter (where exists) as tables_present,
  count(*) filter (where rls) as tables_with_rls,
  count(*) filter (where authenticated_select) as readable_tables,
  count(*) filter (where authenticated_insert) as directly_writable_tables,
  to_regprocedure(
    'public.capture_financial_movement_atomic(text,uuid,jsonb,jsonb,text,jsonb,text,text)'
  ) is not null as atomic_rpc_present,
  has_function_privilege(
    'service_role',
    'public.capture_financial_movement_atomic(text,uuid,jsonb,jsonb,text,jsonb,text,text)',
    'EXECUTE'
  ) as service_role_execute,
  has_function_privilege(
    'authenticated',
    'public.capture_financial_movement_atomic(text,uuid,jsonb,jsonb,text,jsonb,text,text)',
    'EXECUTE'
  ) as authenticated_execute,
  (
    select count(*)
    from pg_trigger
    where tgname like '%_no_mutation'
      and not tgisinternal
  ) as append_only_triggers
from checks;
