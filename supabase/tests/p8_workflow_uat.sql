begin;

create or replace function pg_temp.fin_event(
  event_type text,
  subject_type text,
  subject_id uuid,
  actor_id uuid,
  from_status text,
  to_status text,
  event_payload jsonb,
  operation_key text,
  importance text default 'HIGH'
) returns jsonb
language sql
as $$
  select jsonb_build_object(
    'organization_id', 'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
    'project_id', '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
    'portfolio_id', null,
    'case_id', '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
    'event_category', 'financial',
    'event_type', event_type,
    'event_schema_version', 1,
    'event_importance', importance,
    'event_lifecycle_class', 'BUSINESS_EVENT',
    'subject_type', subject_type,
    'subject_id', subject_id,
    'actor_type', 'human',
    'actor_id', actor_id,
    'occurred_at', '2026-07-22T15:00:00.000Z',
    'source_module', 'financial_control',
    'source_entity_type', subject_type,
    'source_entity_id', subject_id,
    'from_state', from_status,
    'to_state', to_status,
    'caused_by', jsonb_build_array(),
    'correlation_id', null,
    'saga_id', null,
    'provenance', jsonb_build_object(
      'idempotency_fingerprint', encode(digest(operation_key, 'sha256'), 'hex'),
      'evidenceRefs', jsonb_build_array('P8-G8-UAT')
    ),
    'confidence', null,
    'impact_schedule', null,
    'impact_cost', 'high',
    'impact_quality', null,
    'impact_risk', null,
    'impact_scope', null,
    'payload', event_payload,
    'visibility', 'normal',
    'permission_scope', jsonb_build_object(),
    'invalidation_tags', jsonb_build_array(
      'project:3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
      'scope:budget'
    ),
    'dedup_key', encode(digest('dedup:' || operation_key, 'sha256'), 'hex'),
    'is_compensating_event', false,
    'compensates_event_id', null
  );
$$;

create or replace function pg_temp.fin_refs(subject_type text, subject_id uuid)
returns jsonb
language sql
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'object_type', subject_type,
      'object_id', subject_id,
      'role', 'focal'
    ),
    jsonb_build_object(
      'object_type', 'project',
      'object_id', '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
      'role', 'context'
    )
  );
$$;

insert into public.financial_estimate_versions (
  id, organization_id, project_id, series_id, version_no, title, purpose,
  status, base_date, as_of_date, currency, total_amount, quality_status,
  source_refs, prepared_by
) values (
  'b8000000-0000-4000-8000-000000000001',
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
  '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
  'b8000000-0000-4000-8000-000000000007',
  1, 'P8 UAT Estimate', 'Controlled UAT', 'draft',
  date '2026-07-01', date '2026-07-22', 'USD', 1000, 'available',
  '[{"ref":"P8-G8-UAT"}]'::jsonb,
  'a9d44f2f-1337-426c-8cd3-84d05f4b6f4b'
);

insert into public.financial_boe_versions (
  id, organization_id, project_id, estimate_version_id, version_no, status,
  scope_statement, inclusions, exclusions, assumptions, methods,
  evidence_refs, prepared_by
) values (
  'b8000000-0000-4000-8000-000000000002',
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
  '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
  'b8000000-0000-4000-8000-000000000001',
  1, 'submitted', 'P8 UAT scope', '["included"]', '["excluded"]',
  '["assumption"]', '["bottom_up"]', '[{"ref":"P8-G8-UAT"}]',
  'a9d44f2f-1337-426c-8cd3-84d05f4b6f4b'
);

insert into public.financial_baseline_versions (
  id, organization_id, project_id, version_no, baseline_type, status,
  currency, total_amount, effective_from, source_estimate_version_id,
  prepared_by, metadata
) values (
  'b8000000-0000-4000-8000-000000000003',
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
  '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
  1, 'current_baseline', 'approved', 'USD', 1000, date '2026-07-22',
  'b8000000-0000-4000-8000-000000000001',
  'a9d44f2f-1337-426c-8cd3-84d05f4b6f4b',
  '{"evidence":"P8-G8-UAT"}'
);

insert into public.financial_baseline_lines (
  organization_id, project_id, baseline_version_id, name, amount, currency,
  source_refs
) values (
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
  '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
  'b8000000-0000-4000-8000-000000000003',
  'Base scope', 1000, 'USD', '[{"ref":"P8-G8-UAT"}]'
);

insert into public.financial_changes (
  id, organization_id, project_id, change_no, version_no, change_type,
  title, reason, status, currency, gross_impact, net_impact, requested_by,
  effective_date, evidence_refs
) values (
  'b8000000-0000-4000-8000-000000000004',
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
  '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
  'CHG-P8-001', 1, 'scope', 'Approved scope growth', 'Authorized UAT',
  'assessed', 'USD', 100, 100,
  'a9d44f2f-1337-426c-8cd3-84d05f4b6f4b', date '2026-07-22',
  '[{"ref":"P8-G8-UAT"}]'
);

insert into public.financial_change_impacts (
  organization_id, project_id, change_id, impact_domain, amount, currency,
  treatment, source_refs
) values (
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
  '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
  'b8000000-0000-4000-8000-000000000004',
  'baseline', 100, 'USD', 'potential', '[{"ref":"P8-G8-UAT"}]'
);

insert into public.budget_items (
  id, organization_id, project_id, cost_code, name, category,
  estimated_cost, currency, status
) values (
  'b8000000-0000-4000-8000-000000000005',
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
  '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
  'P8-UAT', 'P8 controlled actual', 'other', 1000, 'USD', 'approved'
);

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';

do $$
declare
  result jsonb;
  cockpit record;
  active_baseline_count integer;
  superseded_baseline_count integer;
begin
  result := public.transition_financial_record_atomic(
    'estimate', 'b8000000-0000-4000-8000-000000000001', 'draft', 'submitted',
    pg_temp.fin_event(
      'financial_estimate_prepared', 'financial_estimate',
      'b8000000-0000-4000-8000-000000000001',
      'a9d44f2f-1337-426c-8cd3-84d05f4b6f4b', 'draft', 'submitted',
      '{"version":1}'::jsonb, 'p8:estimate:submit'
    ), '{"version":1}',
    pg_temp.fin_refs('financial_estimate', 'b8000000-0000-4000-8000-000000000001')
  );
  if coalesce((result->>'ok')::boolean, false) is not true then
    raise exception 'p8_estimate_transition_failed: %', result;
  end if;

  begin
    perform public.transition_financial_record_atomic(
      'boe', 'b8000000-0000-4000-8000-000000000099', 'submitted', 'approved',
      pg_temp.fin_event(
        'financial_boe_approved', 'financial_boe',
        'b8000000-0000-4000-8000-000000000099',
        'ea453396-5351-417b-973d-0c7333241651', 'submitted', 'approved',
        '{"version":99}'::jsonb, 'p8:boe:missing'
      ), '{"version":99}',
      pg_temp.fin_refs('financial_boe', 'b8000000-0000-4000-8000-000000000099')
    );
    raise exception 'p8_missing_record_was_not_blocked';
  exception
    when others then
      if sqlerrm not like '%financial_record_not_found%' then
        raise;
      end if;
  end;

  begin
    perform public.transition_financial_record_atomic(
      'boe', 'b8000000-0000-4000-8000-000000000002', 'submitted', 'approved',
      pg_temp.fin_event(
        'financial_boe_approved', 'financial_boe',
        'b8000000-0000-4000-8000-000000000002',
        'a9d44f2f-1337-426c-8cd3-84d05f4b6f4b', 'submitted', 'approved',
        '{"version":1}'::jsonb, 'p8:boe:sod'
      ), '{"version":1}',
      pg_temp.fin_refs('financial_boe', 'b8000000-0000-4000-8000-000000000002')
    );
    raise exception 'p8_sod_was_not_blocked';
  exception
    when others then
      if sqlerrm not like '%financial_segregation_of_duties_violation%' then
        raise;
      end if;
  end;

  result := public.transition_financial_record_atomic(
    'boe', 'b8000000-0000-4000-8000-000000000002', 'submitted', 'approved',
    pg_temp.fin_event(
      'financial_boe_approved', 'financial_boe',
      'b8000000-0000-4000-8000-000000000002',
      'ea453396-5351-417b-973d-0c7333241651', 'submitted', 'approved',
      '{"version":1}'::jsonb, 'p8:boe:approve'
    ), '{"version":1}',
    pg_temp.fin_refs('financial_boe', 'b8000000-0000-4000-8000-000000000002')
  );
  if coalesce((result->>'ok')::boolean, false) is not true then
    raise exception 'p8_boe_approval_failed: %', result;
  end if;

  perform public.transition_financial_record_atomic(
    'baseline', 'b8000000-0000-4000-8000-000000000003', 'approved', 'active',
    pg_temp.fin_event(
      'financial_baseline_activated', 'financial_baseline',
      'b8000000-0000-4000-8000-000000000003',
      'ea453396-5351-417b-973d-0c7333241651', 'approved', 'active',
      '{"version":1,"amount":1000,"currency":"USD"}'::jsonb,
      'p8:baseline:activate', 'CRITICAL'
    ), '{"version":1,"amount":1000,"currency":"USD"}',
    pg_temp.fin_refs('financial_baseline', 'b8000000-0000-4000-8000-000000000003')
  );

  perform public.transition_financial_record_atomic(
    'change', 'b8000000-0000-4000-8000-000000000004', 'assessed', 'approved',
    pg_temp.fin_event(
      'financial_change_approved', 'financial_change',
      'b8000000-0000-4000-8000-000000000004',
      'ea453396-5351-417b-973d-0c7333241651', 'assessed', 'approved',
      '{"change_type":"scope"}'::jsonb, 'p8:change:approve'
    ), '{"change_type":"scope"}',
    pg_temp.fin_refs('financial_change', 'b8000000-0000-4000-8000-000000000004')
  );

  perform public.transition_financial_record_atomic(
    'change', 'b8000000-0000-4000-8000-000000000004', 'approved', 'posted',
    pg_temp.fin_event(
      'financial_change_posted', 'financial_change',
      'b8000000-0000-4000-8000-000000000004',
      'ea453396-5351-417b-973d-0c7333241651', 'approved', 'posted',
      '{"change_type":"scope"}'::jsonb, 'p8:change:post', 'CRITICAL'
    ), '{"change_type":"scope"}',
    pg_temp.fin_refs('financial_change', 'b8000000-0000-4000-8000-000000000004')
  );

  result := public.capture_financial_actual_atomic(
    'actual', 'b8000000-0000-4000-8000-000000000005',
    jsonb_build_object(
      'id', 'b8000000-0000-4000-8000-000000000006',
      'amount', 100, 'currency', 'USD', 'cost_date', '2026-07-22',
      'accounting_date', '2026-07-22', 'cost_type', 'other',
      'description', 'P8 controlled actual', 'posting_status', 'posted',
      'source_transaction_id', 'P8-UAT-ACTUAL-1', 'source_line_id', '1'
    ),
    pg_temp.fin_event(
      'actual_posted', 'actual_cost',
      'b8000000-0000-4000-8000-000000000006',
      'ea453396-5351-417b-973d-0c7333241651', null, 'posted',
      '{"amount":100,"currency":"USD"}'::jsonb, 'p8:actual:post'
    ), '{"amount":100,"currency":"USD"}',
    pg_temp.fin_refs('actual_cost', 'b8000000-0000-4000-8000-000000000006'),
    'p8:actual:post', encode(digest('p8:actual:post', 'sha256'), 'hex')
  );
  if coalesce((result->>'ok')::boolean, false) is not true then
    raise exception 'p8_actual_capture_failed: %', result;
  end if;

  select count(*) filter (where status = 'active'),
         count(*) filter (where status = 'superseded')
    into active_baseline_count, superseded_baseline_count
  from public.financial_baseline_versions
  where project_id = '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b'
    and source_estimate_version_id = 'b8000000-0000-4000-8000-000000000001';
  if active_baseline_count <> 1 or superseded_baseline_count <> 1 then
    raise exception 'p8_baseline_versioning_failed: active %, superseded %',
      active_baseline_count, superseded_baseline_count;
  end if;

  select * into cockpit
  from public.financial_project_cockpit
  where project_id = '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b';
  if cockpit.current_baseline <> 1100 or cockpit.actual_cost <> 100 then
    raise exception 'p8_cockpit_reconciliation_failed: baseline %, actual %',
      cockpit.current_baseline, cockpit.actual_cost;
  end if;

  begin
    update public.cost_actuals set amount = 999
    where id = 'b8000000-0000-4000-8000-000000000006';
    raise exception 'p8_actual_update_was_not_blocked';
  exception
    when others then
      if sqlerrm not like '%financial_actual_is_append_only%' then
        raise;
      end if;
  end;
end
$$;

rollback;

select
  'PASS' as p8_workflow_uat,
  'SoD blocked; estimate/BOE/baseline/change/actual atomic; baseline v2=1100; cockpit reconciled; test rolled back' as evidence;
