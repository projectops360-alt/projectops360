-- ============================================================================
-- ProjectOps360° Budget & Cost Management Engine — P8 workflows + cockpit
-- Additive only. Uses project_event_log through _append_event_atomic.
-- ============================================================================

alter table public.financial_baseline_versions
  add column if not exists prepared_by uuid references auth.users(id);

alter table public.funding_authorizations
  add column if not exists prepared_by uuid references auth.users(id);

create or replace function public.protect_controlled_actual_cost()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.source_system = 'financial_control' and auth.role() <> 'service_role' then
      raise exception 'financial_service_role_required';
    end if;
    return new;
  end if;
  if old.source_system = 'financial_control' then
    raise exception 'financial_actual_is_append_only';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists cost_actuals_controlled_guard on public.cost_actuals;
create trigger cost_actuals_controlled_guard
before insert or update or delete on public.cost_actuals
for each row execute function public.protect_controlled_actual_cost();

create or replace function public.capture_financial_actual_atomic(
  p_domain text,
  p_parent_id uuid,
  p_movement jsonb,
  p_event jsonb,
  p_payload_text text,
  p_refs jsonb,
  p_operation_key text,
  p_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org_id uuid := (p_event->>'organization_id')::uuid;
  v_project_id uuid := (p_event->>'project_id')::uuid;
  v_actual_id uuid := (p_movement->>'id')::uuid;
  v_receipt_id uuid;
  v_existing_fingerprint text;
  v_existing_result jsonb;
  v_event_result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'financial_service_role_required';
  end if;
  if p_domain <> 'actual' then
    raise exception 'financial_domain_not_allowed';
  end if;
  if nullif(btrim(p_operation_key), '') is null
     or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'financial_idempotency_invalid';
  end if;
  if coalesce(p_event->'provenance'->>'idempotency_fingerprint', '') <> p_fingerprint then
    raise exception 'idempotency_payload_conflict';
  end if;
  if coalesce(p_event->>'subject_id', '') <> v_actual_id::text then
    raise exception 'financial_subject_scope_conflict';
  end if;
  if not exists (
    select 1 from public.projects
    where id = v_project_id and organization_id = v_org_id and deleted_at is null
  ) then
    raise exception 'financial_project_scope_conflict';
  end if;
  if not exists (
    select 1 from public.budget_items
    where id = p_parent_id and organization_id = v_org_id
      and project_id = v_project_id and deleted_at is null
  ) then
    raise exception 'financial_parent_scope_conflict';
  end if;

  insert into public.financial_operation_receipts (
    organization_id, project_id, operation_key, fingerprint,
    command_type, subject_type, subject_id, status
  ) values (
    v_org_id, v_project_id, p_operation_key, p_fingerprint,
    'capture_actual', p_event->>'subject_type', v_actual_id, 'processing'
  )
  on conflict (project_id, operation_key) do nothing
  returning id into v_receipt_id;

  if v_receipt_id is null then
    select fingerprint, result
      into v_existing_fingerprint, v_existing_result
    from public.financial_operation_receipts
    where project_id = v_project_id and operation_key = p_operation_key;
    if coalesce(v_existing_fingerprint, '') <> p_fingerprint then
      raise exception 'idempotency_payload_conflict';
    end if;
    return coalesce(v_existing_result, jsonb_build_object('ok', false, 'error', 'financial_operation_in_progress'))
      || jsonb_build_object('deduped', true);
  end if;

  insert into public.cost_actuals (
    id, organization_id, project_id, budget_item_id, task_id, resource_id,
    amount, currency, cost_date, cost_type, description, source, metadata,
    source_system, source_transaction_id, source_line_id, incurred_date,
    document_date, accounting_date, financial_period_id, posting_status,
    reversal_of_id, idempotency_key, source_fingerprint
  ) values (
    v_actual_id, v_org_id, v_project_id, p_parent_id,
    nullif(p_movement->>'task_id','')::uuid,
    nullif(p_movement->>'resource_id','')::uuid,
    (p_movement->>'amount')::numeric, p_movement->>'currency',
    coalesce(nullif(p_movement->>'cost_date','')::date, current_date),
    coalesce(nullif(p_movement->>'cost_type',''), 'other'),
    p_movement->>'description', 'manual',
    coalesce(p_movement->'metadata','{}'::jsonb),
    'financial_control', p_movement->>'source_transaction_id',
    p_movement->>'source_line_id',
    nullif(p_movement->>'incurred_date','')::date,
    nullif(p_movement->>'document_date','')::date,
    nullif(p_movement->>'accounting_date','')::date,
    nullif(p_movement->>'period_id','')::uuid,
    coalesce(nullif(p_movement->>'posting_status',''), 'posted'),
    nullif(p_movement->>'reversal_of_id','')::uuid,
    p_operation_key, p_fingerprint
  );

  v_event_result := public._append_event_atomic(
    p_event,
    p_payload_text,
    coalesce(p_refs, '[]'::jsonb),
    array['actual_posted','financial_record_reversed'],
    true
  );

  update public.financial_operation_receipts
  set status = 'completed',
      event_id = (v_event_result->>'event_id')::uuid,
      result = v_event_result || jsonb_build_object('movement_id', v_actual_id),
      completed_at = now()
  where id = v_receipt_id;

  return v_event_result || jsonb_build_object(
    'movement_id', v_actual_id,
    'deduped', false
  );
end
$$;

revoke execute on function public.capture_financial_actual_atomic(
  text, uuid, jsonb, jsonb, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.capture_financial_actual_atomic(
  text, uuid, jsonb, jsonb, text, jsonb, text, text
) to service_role;
revoke execute on function public.protect_controlled_actual_cost()
  from public, anon, authenticated, service_role;

create or replace function public.transition_financial_record_atomic(
  p_domain text,
  p_record_id uuid,
  p_expected_status text,
  p_target_status text,
  p_event jsonb,
  p_payload_text text,
  p_refs jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org_id uuid := (p_event->>'organization_id')::uuid;
  v_project_id uuid := (p_event->>'project_id')::uuid;
  v_actor_id uuid := nullif(p_event->>'actor_id','')::uuid;
  v_current_status text;
  v_prepared_by uuid;
  v_allowed_types text[];
  v_event_result jsonb;
  v_baseline_type text;
  v_baseline_currency text;
  v_baseline_id uuid;
  v_new_baseline_id uuid;
  v_next_version integer;
  v_change_no text;
  v_change_title text;
  v_change_type text;
  v_change_amount numeric;
begin
  if auth.role() <> 'service_role' then
    raise exception 'financial_service_role_required';
  end if;
  if p_event->>'actor_type' <> 'human' or v_actor_id is null then
    raise exception 'financial_human_authority_required';
  end if;
  if coalesce(p_event->>'subject_id', '') <> p_record_id::text
     or coalesce(p_event->>'source_entity_id', '') <> p_record_id::text then
    raise exception 'financial_subject_scope_conflict';
  end if;
  if not exists (
    select 1 from public.projects
    where id = v_project_id and organization_id = v_org_id and deleted_at is null
  ) then
    raise exception 'financial_project_scope_conflict';
  end if;

  case p_domain
    when 'estimate' then
      select status, prepared_by into v_current_status, v_prepared_by
      from public.financial_estimate_versions
      where id = p_record_id and organization_id = v_org_id and project_id = v_project_id
      for update;
      if p_expected_status <> 'draft' or p_target_status <> 'submitted'
         or p_event->>'event_type' <> 'financial_estimate_prepared' then
        raise exception 'financial_transition_not_allowed';
      end if;
      v_allowed_types := array['financial_estimate_prepared'];
    when 'boe' then
      select status, prepared_by into v_current_status, v_prepared_by
      from public.financial_boe_versions
      where id = p_record_id and organization_id = v_org_id and project_id = v_project_id
      for update;
      if p_expected_status <> 'submitted' or p_target_status <> 'approved'
         or p_event->>'event_type' <> 'financial_boe_approved' then
        raise exception 'financial_transition_not_allowed';
      end if;
      v_allowed_types := array['financial_boe_approved'];
    when 'baseline' then
      select status, prepared_by, baseline_type, currency
        into v_current_status, v_prepared_by, v_baseline_type, v_baseline_currency
      from public.financial_baseline_versions
      where id = p_record_id and organization_id = v_org_id and project_id = v_project_id
      for update;
      if p_expected_status <> 'approved' or p_target_status <> 'active'
         or p_event->>'event_type' <> 'financial_baseline_activated' then
        raise exception 'financial_transition_not_allowed';
      end if;
      v_allowed_types := array['financial_baseline_activated'];
    when 'funding' then
      select status, prepared_by into v_current_status, v_prepared_by
      from public.funding_authorizations
      where id = p_record_id and organization_id = v_org_id and project_id = v_project_id
      for update;
      if p_expected_status <> 'submitted' or p_target_status <> 'approved'
         or p_event->>'event_type' <> 'funding_authorized' then
        raise exception 'financial_transition_not_allowed';
      end if;
      v_allowed_types := array['funding_authorized'];
    when 'accrual' then
      select status, prepared_by into v_current_status, v_prepared_by
      from public.financial_accruals
      where id = p_record_id and organization_id = v_org_id and project_id = v_project_id
      for update;
      if p_expected_status not in ('submitted','reviewed') or p_target_status <> 'approved'
         or p_event->>'event_type' <> 'financial_accrual_approved' then
        raise exception 'financial_transition_not_allowed';
      end if;
      v_allowed_types := array['financial_accrual_approved'];
    when 'payment' then
      select status, prepared_by into v_current_status, v_prepared_by
      from public.financial_payments
      where id = p_record_id and organization_id = v_org_id and project_id = v_project_id
      for update;
      if p_expected_status <> 'validated' or p_target_status <> 'approved'
         or p_event->>'event_type' <> 'financial_payment_approved' then
        raise exception 'financial_transition_not_allowed';
      end if;
      v_allowed_types := array['financial_payment_approved'];
    when 'change' then
      select status, requested_by, change_no, title, change_type, net_impact
        into v_current_status, v_prepared_by, v_change_no, v_change_title,
             v_change_type, v_change_amount
      from public.financial_changes
      where id = p_record_id and organization_id = v_org_id and project_id = v_project_id
      for update;
      if p_target_status = 'approved'
         and p_expected_status in ('assessed','recommended')
         and p_event->>'event_type' = 'financial_change_approved' then
        v_allowed_types := array['financial_change_approved'];
      elsif p_target_status = 'posted'
         and p_expected_status in ('approved','authorized_for_posting')
         and p_event->>'event_type' = 'financial_change_posted' then
        v_allowed_types := array['financial_change_posted'];
      else
        raise exception 'financial_transition_not_allowed';
      end if;
    when 'period' then
      select status into v_current_status
      from public.financial_periods
      where id = p_record_id and organization_id = v_org_id and project_id = v_project_id
      for update;
      if p_target_status in ('closed','reclosed')
         and p_expected_status in ('open','reopened')
         and p_event->>'event_type' = 'financial_period_closed' then
        v_allowed_types := array['financial_period_closed'];
      elsif p_target_status = 'reopened'
         and p_expected_status = 'closed'
         and p_event->>'event_type' = 'financial_period_reopened' then
        v_allowed_types := array['financial_period_reopened'];
      else
        raise exception 'financial_transition_not_allowed';
      end if;
    else
      raise exception 'financial_domain_not_allowed';
  end case;

  if v_current_status is null then
    raise exception 'financial_record_not_found';
  end if;
  if v_current_status <> p_expected_status and v_current_status <> p_target_status then
    raise exception 'financial_state_conflict';
  end if;
  if p_target_status in ('approved','active')
     and v_prepared_by is not null and v_prepared_by = v_actor_id then
    raise exception 'financial_segregation_of_duties_violation';
  end if;

  if v_current_status = p_expected_status then
    case p_domain
      when 'estimate' then
        update public.financial_estimate_versions
        set status = p_target_status, updated_at = now()
        where id = p_record_id;
      when 'boe' then
        update public.financial_boe_versions
        set status = p_target_status, approved_by = v_actor_id,
            approved_at = now(), updated_at = now()
        where id = p_record_id;
      when 'baseline' then
        update public.financial_baseline_versions
        set status = 'superseded', updated_at = now()
        where project_id = v_project_id and baseline_type = v_baseline_type
          and status = 'active' and id <> p_record_id;
        update public.financial_baseline_versions
        set status = 'active', activated_by = v_actor_id,
            activated_at = now(), updated_at = now()
        where id = p_record_id;
      when 'funding' then
        update public.funding_authorizations
        set status = p_target_status, approved_by = v_actor_id,
            approved_at = now(), updated_at = now()
        where id = p_record_id;
      when 'accrual' then
        update public.financial_accruals
        set status = p_target_status, approved_by = v_actor_id,
            approved_at = now(), updated_at = now()
        where id = p_record_id;
      when 'payment' then
        update public.financial_payments
        set status = p_target_status, approved_by = v_actor_id,
            approved_at = now(), updated_at = now()
        where id = p_record_id;
      when 'change' then
        if p_target_status = 'approved' then
          update public.financial_changes
          set status = 'approved', approved_by = v_actor_id,
              approved_at = now(), updated_at = now()
          where id = p_record_id;
          update public.financial_change_impacts
          set treatment = 'approved_not_posted'
          where change_id = p_record_id and treatment = 'potential';
        else
          select id, currency into v_baseline_id, v_baseline_currency
          from public.financial_baseline_versions
          where project_id = v_project_id and baseline_type = 'current_baseline'
            and status = 'active'
          order by version_no desc
          limit 1
          for update;
          if v_baseline_id is null then
            raise exception 'financial_active_baseline_required';
          end if;
          select coalesce(max(version_no), 0) + 1 into v_next_version
          from public.financial_baseline_versions
          where project_id = v_project_id and baseline_type = 'current_baseline';
          v_new_baseline_id := gen_random_uuid();
          insert into public.financial_baseline_versions (
            id, organization_id, project_id, version_no, baseline_type,
            status, currency, total_amount, effective_from,
            source_estimate_version_id, source_change_id, supersedes_id,
            activated_by, activated_at, prepared_by, metadata
          )
          select
            v_new_baseline_id, organization_id, project_id, v_next_version,
            baseline_type, 'active', currency, total_amount + v_change_amount,
            coalesce((select effective_date from public.financial_changes where id = p_record_id), current_date),
            source_estimate_version_id, p_record_id, id, v_actor_id, now(), v_actor_id,
            metadata || jsonb_build_object('change_no', v_change_no)
          from public.financial_baseline_versions
          where id = v_baseline_id;
          insert into public.financial_baseline_lines (
            organization_id, project_id, baseline_version_id, budget_item_id,
            control_account_ref, cbs_code, wbs_ref, name, amount, currency,
            time_phased_amounts, source_refs, metadata
          )
          select
            organization_id, project_id, v_new_baseline_id, budget_item_id,
            control_account_ref, cbs_code, wbs_ref, name, amount, currency,
            time_phased_amounts, source_refs, metadata
          from public.financial_baseline_lines
          where baseline_version_id = v_baseline_id;
          insert into public.financial_baseline_lines (
            organization_id, project_id, baseline_version_id, name, amount,
            currency, source_refs, metadata
          ) values (
            v_org_id, v_project_id, v_new_baseline_id,
            'Change ' || v_change_no || ': ' || v_change_title,
            v_change_amount, v_baseline_currency,
            jsonb_build_array(jsonb_build_object('change_id', p_record_id)),
            jsonb_build_object('change_type', v_change_type)
          );
          update public.financial_baseline_versions
          set status = 'superseded', updated_at = now()
          where id = v_baseline_id;
          update public.financial_changes
          set status = 'posted', updated_at = now()
          where id = p_record_id;
          update public.financial_change_impacts
          set treatment = 'posted'
          where change_id = p_record_id
            and treatment in ('potential','approved_not_posted');
        end if;
      when 'period' then
        if p_target_status = 'reopened' then
          update public.financial_periods
          set status = 'reopened', reopened_by = v_actor_id,
              reopened_at = now(), reopen_reason = p_event->'payload'->>'reason',
              version = version + 1, updated_at = now()
          where id = p_record_id;
        else
          update public.financial_periods
          set status = p_target_status, closed_by = v_actor_id,
              closed_at = now(), updated_at = now()
          where id = p_record_id;
        end if;
    end case;
  end if;

  v_event_result := public._append_event_atomic(
    p_event,
    p_payload_text,
    coalesce(p_refs, '[]'::jsonb),
    v_allowed_types,
    true
  );
  return v_event_result || jsonb_build_object(
    'record_id', p_record_id,
    'status', p_target_status
  );
end
$$;

revoke execute on function public.transition_financial_record_atomic(
  text, uuid, text, text, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.transition_financial_record_atomic(
  text, uuid, text, text, jsonb, text, jsonb
) to service_role;

create or replace view public.financial_project_cockpit
with (security_invoker = true)
as
select
  project.organization_id,
  project.id as project_id,
  coalesce(current_baseline.currency, original_budget.currency, 'USD') as currency,
  original_budget.total_amount as original_budget,
  current_baseline.total_amount as current_baseline,
  coalesce(funding.authorized, 0)::numeric(18,2) as authorized_funding,
  coalesce(funding.released, 0)::numeric(18,2) as released_funding,
  coalesce(commitment.current_commitment, 0)::numeric(18,2) as current_commitment,
  coalesce(commitment.outstanding_commitment, 0)::numeric(18,2) as outstanding_commitment,
  coalesce(actual.actual_cost, 0)::numeric(18,2) as actual_cost,
  coalesce(accrual.open_accrual, 0)::numeric(18,2) as open_accrual,
  coalesce(payment.settled_payments, 0)::numeric(18,2) as settled_payments,
  coalesce(reserve.remaining_reserve, 0)::numeric(18,2) as remaining_reserve,
  coalesce(change_queue.approved_not_posted, 0)::numeric(18,2) as approved_changes_not_posted,
  forecast.latest_eac,
  forecast.p50_eac,
  forecast.p80_eac,
  snapshot.cpi,
  snapshot.spi,
  case
    when current_baseline.id is null then 'insufficient_inputs'
    when coalesce(actual.unverified_actuals, 0) > 0 then 'provisional'
    else coalesce(snapshot.quality_status, 'incomplete')
  end as quality_status,
  (
    coalesce(approval_queue.estimates, 0)
    + coalesce(approval_queue.boes, 0)
    + coalesce(approval_queue.baselines, 0)
    + coalesce(approval_queue.funding, 0)
    + coalesce(approval_queue.accruals, 0)
    + coalesce(approval_queue.payments, 0)
    + coalesce(approval_queue.changes, 0)
  )::integer as pending_approvals,
  coalesce(reconciliation.exceptions, 0)::integer as reconciliation_exceptions,
  coalesce(actual.unverified_actuals, 0)::integer as unverified_actuals,
  (
    coalesce(funding.currency_mismatches, 0)
    + coalesce(commitment.currency_mismatches, 0)
    + coalesce(actual.currency_mismatches, 0)
    + coalesce(accrual.currency_mismatches, 0)
    + coalesce(payment.currency_mismatches, 0)
    + coalesce(reserve.currency_mismatches, 0)
  )::integer as currency_mismatches,
  snapshot.data_date
from public.projects project
left join lateral (
  select id, currency, total_amount
  from public.financial_baseline_versions
  where project_id = project.id and organization_id = project.organization_id
    and baseline_type = 'original_budget' and status in ('active','superseded')
  order by version_no asc
  limit 1
) original_budget on true
left join lateral (
  select id, currency, total_amount
  from public.financial_baseline_versions
  where project_id = project.id and organization_id = project.organization_id
    and baseline_type = 'current_baseline' and status = 'active'
  order by version_no desc
  limit 1
) current_baseline on true
left join lateral (
  select
    sum(authorized) filter (where currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')) as authorized,
    sum(released) filter (where currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')) as released,
    count(*) filter (where currency <> coalesce(current_baseline.currency, original_budget.currency, 'USD')) as currency_mismatches
  from public.financial_funding_positions
  where project_id = project.id and organization_id = project.organization_id
) funding on true
left join lateral (
  select
    sum(current_commitment) filter (where currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')) as current_commitment,
    sum(outstanding_commitment) filter (where currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')) as outstanding_commitment,
    count(*) filter (where currency <> coalesce(current_baseline.currency, original_budget.currency, 'USD')) as currency_mismatches
  from public.financial_commitment_positions
  where project_id = project.id and organization_id = project.organization_id
) commitment on true
left join lateral (
  select
    sum(amount) filter (where currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')) as actual_cost,
    count(*) filter (where posting_status = 'legacy_unverified') as unverified_actuals,
    count(*) filter (where currency <> coalesce(current_baseline.currency, original_budget.currency, 'USD')) as currency_mismatches
  from public.cost_actuals
  where project_id = project.id and organization_id = project.organization_id
    and deleted_at is null
) actual on true
left join lateral (
  select
    sum(open_accrual) filter (where currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')) as open_accrual,
    count(*) filter (where currency <> coalesce(current_baseline.currency, original_budget.currency, 'USD')) as currency_mismatches
  from public.financial_accrual_positions
  where project_id = project.id and organization_id = project.organization_id
) accrual on true
left join lateral (
  select
    sum(settled_amount) filter (where currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')) as settled_payments,
    count(*) filter (where currency <> coalesce(current_baseline.currency, original_budget.currency, 'USD')) as currency_mismatches
  from public.financial_payment_positions
  where project_id = project.id and organization_id = project.organization_id
) payment on true
left join lateral (
  select
    sum(ending_amount) filter (where currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')) as remaining_reserve,
    count(*) filter (where currency <> coalesce(current_baseline.currency, original_budget.currency, 'USD')) as currency_mismatches
  from public.financial_reserve_positions
  where project_id = project.id and organization_id = project.organization_id
) reserve on true
left join lateral (
  select sum(net_impact) as approved_not_posted
  from public.financial_changes
  where project_id = project.id and organization_id = project.organization_id
    and status in ('approved','authorized_for_posting','approved_not_posted')
    and currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')
) change_queue on true
left join lateral (
  select id, data_date, cpi, spi, quality_status
  from public.financial_measurement_snapshots
  where project_id = project.id and organization_id = project.organization_id
    and currency = coalesce(current_baseline.currency, original_budget.currency, 'USD')
  order by data_date desc, created_at desc
  limit 1
) snapshot on true
left join lateral (
  select
    max(eac) filter (where scenario_type in ('bottom_up','pm_forecast') and status in ('approved','published')) as latest_eac,
    max(eac) filter (where scenario_type = 'p50' and status in ('approved','published')) as p50_eac,
    max(eac) filter (where scenario_type = 'p80' and status in ('approved','published')) as p80_eac
  from public.financial_forecast_scenarios
  where project_id = project.id and organization_id = project.organization_id
    and (snapshot.id is null or snapshot_id = snapshot.id)
) forecast on true
left join lateral (
  select
    (select count(*) from public.financial_estimate_versions where project_id = project.id and status = 'submitted') as estimates,
    (select count(*) from public.financial_boe_versions where project_id = project.id and status = 'submitted') as boes,
    (select count(*) from public.financial_baseline_versions where project_id = project.id and status = 'approved') as baselines,
    (select count(*) from public.funding_authorizations where project_id = project.id and status = 'submitted') as funding,
    (select count(*) from public.financial_accruals where project_id = project.id and status in ('submitted','reviewed')) as accruals,
    (select count(*) from public.financial_payments where project_id = project.id and status = 'validated') as payments,
    (select count(*) from public.financial_changes where project_id = project.id and status in ('assessed','recommended','approved','authorized_for_posting')) as changes
) approval_queue on true
left join lateral (
  select count(*) as exceptions
  from public.financial_reconciliations
  where project_id = project.id and organization_id = project.organization_id
    and status = 'exception'
) reconciliation on true
where project.deleted_at is null;

grant select on public.financial_project_cockpit to authenticated, service_role;

comment on view public.financial_project_cockpit is
  'PMO-first read model derived from canonical financial owners; currencies remain separated and quality gaps remain explicit.';
comment on function public.transition_financial_record_atomic is
  'Service-only approved lifecycle transition + canonical event append in one transaction; enforces scope, evidence path and segregation of duties.';
comment on function public.capture_financial_actual_atomic is
  'Service-only append of controlled cost actual + canonical event with idempotency; legacy actuals remain compatible.';
