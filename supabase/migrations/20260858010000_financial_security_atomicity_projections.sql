-- ============================================================================
-- ProjectOps360° Budget & Cost Management Engine — security, atomicity, views
-- P7-T3/T4/T5. Uses the existing _append_event_atomic/project_event_log path.
-- ============================================================================

create or replace function public.reject_financial_movement_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'financial_movement_is_append_only';
end
$$;

do $$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'funding_movements',
    'commitment_movements',
    'accrual_movements',
    'payment_movements',
    'reserve_movements'
  ] loop
    trigger_name := table_name || '_no_mutation';
    execute format('drop trigger if exists %I on public.%I', trigger_name, table_name);
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function public.reject_financial_movement_mutation()',
      trigger_name,
      table_name
    );
  end loop;
end
$$;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'financial_periods',
    'financial_operation_receipts',
    'financial_estimate_versions',
    'financial_boe_versions',
    'financial_baseline_versions',
    'financial_baseline_lines',
    'funding_authorizations',
    'funding_movements',
    'commitment_movements',
    'financial_accruals',
    'accrual_movements',
    'financial_payments',
    'payment_movements',
    'financial_changes',
    'financial_change_impacts',
    'reserve_accounts',
    'reserve_movements',
    'financial_measurement_snapshots',
    'financial_forecast_scenarios',
    'financial_reconciliations',
    'financial_reconciliation_items'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    policy_name := 'Financial project members read ' || table_name;
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id) and public.can_access_project(project_id))',
      policy_name,
      table_name
    );
    execute format('revoke insert, update, delete on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end
$$;

create or replace view public.financial_funding_positions
with (security_invoker = true)
as
with authorization_totals as (
  select organization_id, project_id, currency,
         sum(authorized_amount) filter (
           where status in ('approved','active','suspended','closed')
         )::numeric(18,2) as authorized
  from public.funding_authorizations
  group by organization_id, project_id, currency
),
movement as (
  select organization_id, project_id, currency,
    sum(case
      when movement_type in ('release','transfer_in') then abs(amount)
      when movement_type in ('return','transfer_out','revocation','reversal') then -abs(amount)
      when movement_type = 'adjustment' then amount
      else 0
    end)::numeric(18,2) as released,
    sum(case
      when movement_type in ('restriction','suspension') then abs(amount)
      when movement_type = 'restriction_release' then -abs(amount)
      else 0
    end)::numeric(18,2) as restricted
  from public.funding_movements
  where status = 'posted'
  group by organization_id, project_id, currency
)
select
  coalesce(a.organization_id, m.organization_id) as organization_id,
  coalesce(a.project_id, m.project_id) as project_id,
  coalesce(a.currency, m.currency) as currency,
  coalesce(a.authorized, 0)::numeric(18,2) as authorized,
  coalesce(m.released, 0)::numeric(18,2) as released,
  coalesce(m.restricted, 0)::numeric(18,2) as restricted,
  (coalesce(a.authorized, 0) - coalesce(m.released, 0))::numeric(18,2) as remaining_authorization,
  (coalesce(m.released, 0) - coalesce(m.restricted, 0))::numeric(18,2) as available_released
from authorization_totals a
full outer join movement m
  on m.organization_id = a.organization_id
 and m.project_id = a.project_id
 and m.currency = a.currency;

create or replace view public.financial_commitment_positions
with (security_invoker = true)
as
select organization_id, project_id, procurement_item_id, currency,
  sum(case when movement_type = 'original' then abs(amount) else 0 end)::numeric(18,2) as original_commitment,
  sum(case when movement_type = 'amendment' then amount else 0 end)::numeric(18,2) as amendments,
  sum(case when movement_type = 'cancellation' then abs(amount) else 0 end)::numeric(18,2) as cancellations,
  sum(case
    when movement_type = 'consumption' then abs(amount)
    when movement_type = 'consumption_reversal' then -abs(amount)
    else 0
  end)::numeric(18,2) as consumed,
  (
    sum(case when movement_type = 'original' then abs(amount) else 0 end)
    + sum(case when movement_type = 'amendment' then amount else 0 end)
    - sum(case when movement_type = 'cancellation' then abs(amount) else 0 end)
  )::numeric(18,2) as current_commitment,
  (
    sum(case when movement_type = 'original' then abs(amount) else 0 end)
    + sum(case when movement_type = 'amendment' then amount else 0 end)
    - sum(case when movement_type = 'cancellation' then abs(amount) else 0 end)
    - sum(case
        when movement_type = 'consumption' then abs(amount)
        when movement_type = 'consumption_reversal' then -abs(amount)
        else 0
      end)
  )::numeric(18,2) as outstanding_commitment
from public.commitment_movements
group by organization_id, project_id, procurement_item_id, currency;

create or replace view public.financial_accrual_positions
with (security_invoker = true)
as
select organization_id, project_id, accrual_id, currency,
  sum(case
    when movement_type = 'posting' then abs(amount)
    when movement_type in ('match','reversal') then -abs(amount)
    when movement_type = 'adjustment' then amount
    else 0
  end)::numeric(18,2) as open_accrual
from public.accrual_movements
group by organization_id, project_id, accrual_id, currency;

create or replace view public.financial_payment_positions
with (security_invoker = true)
as
select organization_id, project_id, payment_id, currency,
  sum(case
    when movement_type in ('settlement','partial_settlement') then abs(amount)
    when movement_type in ('return','reversal') then -abs(amount)
    when movement_type = 'adjustment' then amount
    else 0
  end)::numeric(18,2) as settled_amount
from public.payment_movements
group by organization_id, project_id, payment_id, currency;

create or replace view public.financial_reserve_positions
with (security_invoker = true)
as
select a.organization_id, a.project_id, a.id as reserve_account_id,
       a.reserve_type, a.currency, a.opening_amount,
       (
         a.opening_amount + coalesce(sum(case
           when m.movement_type in ('increase','transfer_in','return') then abs(m.amount)
           when m.movement_type in ('decrease','drawdown','release','transfer_out','revocation','reversal') then -abs(m.amount)
           when m.movement_type = 'adjustment' then m.amount
           else 0
         end), 0)
       )::numeric(18,2) as ending_amount
from public.reserve_accounts a
left join public.reserve_movements m on m.reserve_account_id = a.id
group by a.organization_id, a.project_id, a.id, a.reserve_type, a.currency, a.opening_amount;

grant select on public.financial_funding_positions to authenticated, service_role;
grant select on public.financial_commitment_positions to authenticated, service_role;
grant select on public.financial_accrual_positions to authenticated, service_role;
grant select on public.financial_payment_positions to authenticated, service_role;
grant select on public.financial_reserve_positions to authenticated, service_role;

create or replace function public.capture_financial_movement_atomic(
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
  v_movement_id uuid := (p_movement->>'id')::uuid;
  v_receipt_id uuid;
  v_existing_fingerprint text;
  v_existing_result jsonb;
  v_event_result jsonb;
  v_allowed_types text[];
begin
  if auth.role() <> 'service_role' then
    raise exception 'financial_service_role_required';
  end if;
  if p_domain not in ('funding','commitment','accrual','payment','reserve') then
    raise exception 'financial_domain_not_allowed';
  end if;
  if nullif(btrim(p_operation_key), '') is null
     or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'financial_idempotency_invalid';
  end if;
  if coalesce(p_event->'provenance'->>'idempotency_fingerprint', '') <> p_fingerprint then
    raise exception 'idempotency_payload_conflict';
  end if;
  if coalesce(p_event->>'subject_id', '') <> v_movement_id::text then
    raise exception 'financial_subject_scope_conflict';
  end if;
  if not exists (
    select 1 from public.projects
    where id = v_project_id and organization_id = v_org_id and deleted_at is null
  ) then
    raise exception 'financial_project_scope_conflict';
  end if;

  insert into public.financial_operation_receipts (
    organization_id, project_id, operation_key, fingerprint,
    command_type, subject_type, subject_id, status
  ) values (
    v_org_id, v_project_id, p_operation_key, p_fingerprint,
    'capture_' || p_domain || '_movement', p_event->>'subject_type',
    v_movement_id, 'processing'
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

  case p_domain
    when 'funding' then
      if not exists (
        select 1 from public.funding_authorizations
        where id = p_parent_id and organization_id = v_org_id and project_id = v_project_id
      ) then raise exception 'financial_parent_scope_conflict'; end if;
      insert into public.funding_movements (
        id, organization_id, project_id, authorization_id, movement_type,
        amount, currency, effective_date, status, reason, approval_ref,
        reverses_movement_id, idempotency_key, source_refs, created_by
      ) values (
        v_movement_id, v_org_id, v_project_id, p_parent_id,
        p_movement->>'movement_type', (p_movement->>'amount')::numeric,
        p_movement->>'currency', (p_movement->>'effective_date')::date,
        coalesce(p_movement->>'status', 'posted'), p_movement->>'reason',
        nullif(p_movement->>'approval_ref','')::uuid,
        nullif(p_movement->>'reverses_movement_id','')::uuid,
        p_operation_key, coalesce(p_movement->'source_refs','[]'::jsonb),
        nullif(p_movement->>'created_by','')::uuid
      );
      v_allowed_types := array['funding_released','financial_record_reversed'];
    when 'commitment' then
      if not exists (
        select 1 from public.procurement_items
        where id = p_parent_id and organization_id = v_org_id and project_id = v_project_id
      ) then raise exception 'financial_parent_scope_conflict'; end if;
      insert into public.commitment_movements (
        id, organization_id, project_id, procurement_item_id, movement_type,
        amount, quantity, currency, effective_date, source_document_id,
        source_line_id, approval_ref, reverses_movement_id, idempotency_key,
        source_refs, created_by
      ) values (
        v_movement_id, v_org_id, v_project_id, p_parent_id,
        p_movement->>'movement_type', (p_movement->>'amount')::numeric,
        nullif(p_movement->>'quantity','')::numeric, p_movement->>'currency',
        (p_movement->>'effective_date')::date, p_movement->>'source_document_id',
        p_movement->>'source_line_id', nullif(p_movement->>'approval_ref','')::uuid,
        nullif(p_movement->>'reverses_movement_id','')::uuid,
        p_operation_key, coalesce(p_movement->'source_refs','[]'::jsonb),
        nullif(p_movement->>'created_by','')::uuid
      );
      v_allowed_types := array['commitment_posted','financial_record_reversed'];
    when 'accrual' then
      if not exists (
        select 1 from public.financial_accruals
        where id = p_parent_id and organization_id = v_org_id and project_id = v_project_id
      ) then raise exception 'financial_parent_scope_conflict'; end if;
      insert into public.accrual_movements (
        id, organization_id, project_id, accrual_id, movement_type, amount,
        currency, accounting_date, period_id, actual_cost_id,
        reverses_movement_id, idempotency_key, source_refs, created_by
      ) values (
        v_movement_id, v_org_id, v_project_id, p_parent_id,
        p_movement->>'movement_type', (p_movement->>'amount')::numeric,
        p_movement->>'currency', (p_movement->>'accounting_date')::date,
        (p_movement->>'period_id')::uuid,
        nullif(p_movement->>'actual_cost_id','')::uuid,
        nullif(p_movement->>'reverses_movement_id','')::uuid,
        p_operation_key, coalesce(p_movement->'source_refs','[]'::jsonb),
        nullif(p_movement->>'created_by','')::uuid
      );
      v_allowed_types := array['accrual_posted','financial_record_reversed'];
    when 'payment' then
      if not exists (
        select 1 from public.financial_payments
        where id = p_parent_id and organization_id = v_org_id and project_id = v_project_id
      ) then raise exception 'financial_parent_scope_conflict'; end if;
      insert into public.payment_movements (
        id, organization_id, project_id, payment_id, movement_type, amount,
        currency, value_date, source_transaction_id, reverses_movement_id,
        idempotency_key, source_refs, created_by
      ) values (
        v_movement_id, v_org_id, v_project_id, p_parent_id,
        p_movement->>'movement_type', (p_movement->>'amount')::numeric,
        p_movement->>'currency', (p_movement->>'value_date')::date,
        p_movement->>'source_transaction_id',
        nullif(p_movement->>'reverses_movement_id','')::uuid,
        p_operation_key, coalesce(p_movement->'source_refs','[]'::jsonb),
        nullif(p_movement->>'created_by','')::uuid
      );
      v_allowed_types := array['payment_settled','financial_record_reversed'];
    when 'reserve' then
      if not exists (
        select 1 from public.reserve_accounts
        where id = p_parent_id and organization_id = v_org_id and project_id = v_project_id
      ) then raise exception 'financial_parent_scope_conflict'; end if;
      insert into public.reserve_movements (
        id, organization_id, project_id, reserve_account_id, change_id,
        risk_id, movement_type, amount, currency, effective_date, reason,
        approval_ref, reverses_movement_id, idempotency_key, source_refs, created_by
      ) values (
        v_movement_id, v_org_id, v_project_id, p_parent_id,
        nullif(p_movement->>'change_id','')::uuid,
        nullif(p_movement->>'risk_id','')::uuid,
        p_movement->>'movement_type', (p_movement->>'amount')::numeric,
        p_movement->>'currency', (p_movement->>'effective_date')::date,
        p_movement->>'reason', nullif(p_movement->>'approval_ref','')::uuid,
        nullif(p_movement->>'reverses_movement_id','')::uuid,
        p_operation_key, coalesce(p_movement->'source_refs','[]'::jsonb),
        nullif(p_movement->>'created_by','')::uuid
      );
      v_allowed_types := array['reserve_released','financial_record_reversed'];
  end case;

  v_event_result := public._append_event_atomic(
    p_event,
    p_payload_text,
    coalesce(p_refs, '[]'::jsonb),
    v_allowed_types,
    true
  );

  update public.financial_operation_receipts
  set status = 'completed',
      event_id = (v_event_result->>'event_id')::uuid,
      result = v_event_result || jsonb_build_object('movement_id', v_movement_id),
      completed_at = now()
  where id = v_receipt_id;

  return v_event_result || jsonb_build_object('movement_id', v_movement_id, 'deduped', false);
end
$$;

revoke execute on function public.capture_financial_movement_atomic(
  text, uuid, jsonb, jsonb, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.capture_financial_movement_atomic(
  text, uuid, jsonb, jsonb, text, jsonb, text, text
) to service_role;

revoke execute on function public.reject_financial_movement_mutation() from public, anon, authenticated, service_role;

comment on function public.capture_financial_movement_atomic is
  'Service-only atomic financial movement + canonical project_event_log append with idempotency fingerprint enforcement.';
