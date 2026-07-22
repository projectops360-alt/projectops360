begin;

insert into public.funding_authorizations (
  id,
  organization_id,
  project_id,
  authorization_no,
  version_no,
  status,
  authorized_amount,
  currency,
  effective_from,
  source_refs,
  approved_by,
  approved_at,
  metadata
) values (
  'a7000000-0000-4000-8000-000000000001',
  'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
  '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
  'P7-SMOKE-001',
  1,
  'active',
  1000,
  'USD',
  date '2026-07-22',
  '[{"type":"test_evidence","ref":"P7-G7"}]'::jsonb,
  'ea453396-5351-417b-973d-0c7333241651',
  now(),
  '{"purpose":"P7 atomic rollback smoke test"}'::jsonb
);

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';

do $$
declare
  first_result jsonb;
  retry_result jsonb;
  movement_count integer;
  event_count integer;
begin
  first_result := public.capture_financial_movement_atomic(
    'funding',
    'a7000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'id', 'a7000000-0000-4000-8000-000000000002',
      'movement_type', 'release',
      'amount', 250,
      'currency', 'USD',
      'effective_date', '2026-07-22',
      'status', 'posted',
      'reason', 'P7 controlled smoke validation',
      'created_by', 'ea453396-5351-417b-973d-0c7333241651',
      'source_refs', jsonb_build_array(jsonb_build_object('type', 'test_evidence', 'ref', 'P7-G7'))
    ),
    jsonb_build_object(
      'organization_id', 'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
      'project_id', '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
      'portfolio_id', null,
      'case_id', '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
      'event_category', 'financial',
      'event_type', 'funding_released',
      'event_schema_version', 1,
      'event_importance', 'HIGH',
      'event_lifecycle_class', 'BUSINESS_EVENT',
      'subject_type', 'funding_movement',
      'subject_id', 'a7000000-0000-4000-8000-000000000002',
      'actor_type', 'human',
      'actor_id', 'ea453396-5351-417b-973d-0c7333241651',
      'occurred_at', '2026-07-22T12:00:00.000Z',
      'source_module', 'financial_control',
      'source_entity_type', 'funding_authorization',
      'source_entity_id', 'a7000000-0000-4000-8000-000000000001',
      'from_state', null,
      'to_state', 'posted',
      'caused_by', jsonb_build_array(),
      'correlation_id', null,
      'saga_id', null,
      'provenance', jsonb_build_object(
        'idempotency_fingerprint', repeat('a', 64),
        'evidenceRefs', jsonb_build_array('P7-G7')
      ),
      'confidence', null,
      'impact_schedule', null,
      'impact_cost', 'high',
      'impact_quality', null,
      'impact_risk', null,
      'impact_scope', null,
      'payload', jsonb_build_object('amount', 250, 'currency', 'USD'),
      'visibility', 'normal',
      'permission_scope', jsonb_build_object(),
      'invalidation_tags', jsonb_build_array(
        'project:3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
        'scope:budget'
      ),
      'dedup_key', repeat('b', 64),
      'is_compensating_event', false,
      'compensates_event_id', null
    ),
    '{"amount":250,"currency":"USD"}',
    jsonb_build_array(
      jsonb_build_object(
        'object_type', 'funding_authorization',
        'object_id', 'a7000000-0000-4000-8000-000000000001',
        'role', 'parent'
      ),
      jsonb_build_object(
        'object_type', 'project',
        'object_id', '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
        'role', 'context'
      )
    ),
    'p7-smoke:funding-release:1',
    repeat('a', 64)
  );

  if coalesce((first_result->>'ok')::boolean, false) is not true
     or coalesce((first_result->>'deduped')::boolean, false) is true then
    raise exception 'p7_first_capture_failed: %', first_result;
  end if;

  retry_result := public.capture_financial_movement_atomic(
    'funding',
    'a7000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'id', 'a7000000-0000-4000-8000-000000000002',
      'movement_type', 'release',
      'amount', 250,
      'currency', 'USD',
      'effective_date', '2026-07-22'
    ),
    jsonb_build_object(
      'organization_id', 'dc8205c1-c4a2-4f3c-83b9-0e1589590c13',
      'project_id', '3cfbabbf-d6eb-4ac1-bf52-402b37af2e9b',
      'event_type', 'funding_released',
      'subject_type', 'funding_movement',
      'subject_id', 'a7000000-0000-4000-8000-000000000002',
      'provenance', jsonb_build_object('idempotency_fingerprint', repeat('a', 64))
    ),
    '{"amount":250,"currency":"USD"}',
    '[]'::jsonb,
    'p7-smoke:funding-release:1',
    repeat('a', 64)
  );

  if coalesce((retry_result->>'ok')::boolean, false) is not true
     or coalesce((retry_result->>'deduped')::boolean, false) is not true then
    raise exception 'p7_retry_dedup_failed: %', retry_result;
  end if;

  select count(*) into movement_count
  from public.funding_movements
  where id = 'a7000000-0000-4000-8000-000000000002';

  select count(*) into event_count
  from public.project_event_log
  where subject_id = 'a7000000-0000-4000-8000-000000000002';

  if movement_count <> 1 or event_count <> 1 then
    raise exception 'p7_atomic_cardinality_failed: movement %, event %', movement_count, event_count;
  end if;

  begin
    update public.funding_movements
    set amount = 999
    where id = 'a7000000-0000-4000-8000-000000000002';
    raise exception 'p7_append_only_update_was_not_blocked';
  exception
    when others then
      if sqlerrm not like '%financial_movement_is_append_only%' then
        raise;
      end if;
  end;
end
$$;

rollback;

select
  'PASS' as p7_atomic_capture,
  'first write + event atomic, retry deduped, update blocked, transaction rolled back' as evidence;
