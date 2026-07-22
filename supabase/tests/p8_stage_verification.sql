select
  to_regclass('public.financial_project_cockpit') is not null as cockpit_present,
  coalesce(
    (
      select 'security_invoker=true' = any(coalesce(reloptions, array[]::text[]))
      from pg_class
      where oid = 'public.financial_project_cockpit'::regclass
    ),
    false
  ) as cockpit_security_invoker,
  has_table_privilege(
    'authenticated',
    'public.financial_project_cockpit',
    'SELECT'
  ) as authenticated_cockpit_select,
  to_regprocedure(
    'public.capture_financial_actual_atomic(text,uuid,jsonb,jsonb,text,jsonb,text,text)'
  ) is not null as actual_rpc_present,
  has_function_privilege(
    'service_role',
    'public.capture_financial_actual_atomic(text,uuid,jsonb,jsonb,text,jsonb,text,text)',
    'EXECUTE'
  ) as actual_service_execute,
  has_function_privilege(
    'authenticated',
    'public.capture_financial_actual_atomic(text,uuid,jsonb,jsonb,text,jsonb,text,text)',
    'EXECUTE'
  ) as actual_authenticated_execute,
  to_regprocedure(
    'public.transition_financial_record_atomic(text,uuid,text,text,jsonb,text,jsonb)'
  ) is not null as transition_rpc_present,
  has_function_privilege(
    'service_role',
    'public.transition_financial_record_atomic(text,uuid,text,text,jsonb,text,jsonb)',
    'EXECUTE'
  ) as transition_service_execute,
  has_function_privilege(
    'authenticated',
    'public.transition_financial_record_atomic(text,uuid,text,text,jsonb,text,jsonb)',
    'EXECUTE'
  ) as transition_authenticated_execute,
  exists (
    select 1
    from pg_trigger
    where tgname = 'cost_actuals_controlled_guard'
      and not tgisinternal
  ) as controlled_actual_guard_present;
