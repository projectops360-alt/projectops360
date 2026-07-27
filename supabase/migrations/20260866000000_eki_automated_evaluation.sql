-- ============================================================================
-- EKI Macrophase 3 — Automated Evidence Intelligence
-- ============================================================================
-- Macrophase 2 built an evidence engine that answers correctly when something
-- asks it. Nothing asked it. A governance engine evaluated only when a person
-- remembers to invoke it cannot detect the lapse it exists to detect, so this
-- migration makes evaluation happen on a cadence, exactly once per due
-- execution, and observable afterwards.
--
-- Three things this must get right, because each has a failure mode that looks
-- like success:
--
--   1. CLAIMING. Two schedulers firing at once must not both evaluate the same
--      binding. Duplicate evaluations are not merely wasteful — they produce two
--      competing "latest" results and the control state starts flapping.
--
--   2. STALENESS OF THE WORKER, not just of the evidence. A worker that hangs,
--      loses its claim, and finishes later must not write. Its answer was true
--      when it started and is no longer.
--
--   3. ISOLATION OF FAILURE. One tenant's unreadable source must not stop every
--      other tenant's evaluation. A batch that aborts halfway leaves the
--      remaining controls silently unevaluated, which reads as "nothing wrong".
--
-- Applied to stage only. Additive; no existing policy is modified.
-- ============================================================================

-- ── 1. Cadence, claiming and enablement on the binding ───────────────────────

alter table public.eki_evidence_binding_runtime
  -- How often this binding is measured. Per binding, like freshness: a daily
  -- control and an annual one are not on the same clock.
  add column if not exists evaluation_interval interval not null default interval '1 day'
    check (evaluation_interval > interval '0'),

  -- When it next becomes due. `now()` by default so a newly created binding is
  -- evaluated on the next run rather than waiting a full interval to say
  -- anything at all.
  add column if not exists next_due_at timestamptz not null default now(),

  -- A binding may be paused without being retired. Retirement is terminal and
  -- says the measurement is over; disabling says "not right now" and keeps the
  -- specification and its history intact.
  add column if not exists evaluation_enabled boolean not null default true,

  -- The claim. `claim_token` identifies WHICH claim, not merely that one
  -- exists: a worker returning after its claim lapsed and was re-issued must be
  -- distinguishable from the worker that holds it now, and a timestamp cannot
  -- tell those two apart.
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_expires_at timestamptz,
  add column if not exists claimed_by_run_id uuid,

  -- Retry backoff state. Separate from `consecutive_failures`, which counts
  -- failing EVALUATIONS (a control problem); this counts failing EXECUTIONS
  -- (a system problem). Conflating them would let an unreachable source look
  -- like a failing control.
  add column if not exists execution_failures integer not null default 0
    check (execution_failures >= 0),
  add column if not exists last_execution_error text;

comment on column public.eki_evidence_binding_runtime.claim_token is
  'Identifies a specific claim. A worker whose token no longer matches is superseded and must not write.';

create index if not exists eki_binding_due_idx
  on public.eki_evidence_binding_runtime (next_due_at)
  where evaluation_enabled and binding_state <> 'retired';

-- ── 2. Sequence guard on the control ─────────────────────────────────────────
-- Which evaluation last drove this control's state. An evaluation with a lower
-- sequence number is older, whatever its timestamp says, and may not become
-- authoritative over a newer one. This is the second line of defence behind the
-- claim: the claim stops the stale worker from starting, this stops it from
-- winning if it somehow does.

alter table public.eki_control_runtime
  add column if not exists last_evaluation_sequence bigint not null default 0;

-- ── 3. Evaluator runs — observability ────────────────────────────────────────

create table if not exists public.eki_evaluation_runs (
  id uuid primary key default gen_random_uuid(),

  -- Idempotency for duplicate job delivery. A cron that fires twice in the same
  -- minute, or a retried HTTP invocation, resolves to the SAME run rather than
  -- to two runs that each claim half the work.
  run_key text not null unique,

  trigger_type text not null check (trigger_type in ('scheduled', 'manual', 'mutation')),

  -- Null for a platform-wide scheduled sweep; set when a caller scoped the run
  -- to one tenant. Never accepted from a client — the API derives it.
  organization_id uuid references public.organizations(id) on delete cascade,

  -- Null for the scheduler, which has no human actor and must not borrow one.
  requested_by uuid references auth.users(id),

  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,

  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed', 'duplicate')),

  bindings_claimed integer not null default 0 check (bindings_claimed >= 0),
  bindings_evaluated integer not null default 0 check (bindings_evaluated >= 0),
  bindings_failed integer not null default 0 check (bindings_failed >= 0),

  failure_category text,
  -- Safe error text only. `eki_safe_error` strips anything that looks like a
  -- credential before it is stored; a diagnostic that leaks a connection string
  -- is worse than no diagnostic.
  safe_error text,

  created_at timestamptz not null default now()
);

create index if not exists eki_evaluation_runs_recent_idx
  on public.eki_evaluation_runs (started_at desc);
create index if not exists eki_evaluation_runs_org_idx
  on public.eki_evaluation_runs (organization_id, started_at desc);

create table if not exists public.eki_evaluation_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.eki_evaluation_runs(id) on delete cascade,
  binding_object_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  claim_token uuid,
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,

  outcome text check (outcome in ('current', 'approaching_stale', 'stale', 'unavailable', 'invalid', 'contradictory')),
  evaluation_id uuid references public.eki_evidence_evaluations(id),
  evaluation_sequence bigint,

  -- Before and after, because a change recorded only by its result cannot be
  -- reviewed: "degraded" alone does not say whether anything moved.
  control_object_id uuid,
  control_state_before text,
  control_state_after text,

  finding_action text check (finding_action in ('created', 'recurred', 'none')),
  finding_object_id uuid,

  status text not null default 'claimed'
    check (status in ('claimed', 'succeeded', 'failed', 'superseded', 'skipped')),
  failure_category text,
  safe_error text,
  retry_count integer not null default 0 check (retry_count >= 0),

  -- How many cadence intervals were missed before this run picked the binding
  -- up. A run that silently absorbs a three-day gap looks identical to one that
  -- ran on time; this is the difference.
  missed_intervals integer not null default 0 check (missed_intervals >= 0)
);

create index if not exists eki_evaluation_run_items_run_idx
  on public.eki_evaluation_run_items (run_id);
create index if not exists eki_evaluation_run_items_binding_idx
  on public.eki_evaluation_run_items (binding_object_id, started_at desc);

-- Deliberately NOT append-only, unlike evaluations and audit records. Run items
-- are operational telemetry about the automation, not the evidence itself; the
-- immutable history lives in `eki_evidence_evaluations`,
-- `eki_control_state_transitions` and `platform_governance_audit`. Blocking
-- deletion here would make tenant offboarding impossible — the cascade from
-- `organizations` would hit the trigger and fail — which is a high price for
-- protecting a log that proves nothing on its own.

-- ── 4. Safe error text ───────────────────────────────────────────────────────

create or replace function public.eki_safe_error(p_message text)
returns text language sql immutable set search_path = public, pg_temp as $$
  -- Truncated and stripped. Postgres error text can carry a row's contents, and
  -- a run record is read by more people than the row was.
  select left(
    regexp_replace(
      coalesce(p_message, ''),
      '(?i)(password|secret|token|key|bearer|authorization)[^,;)]*',
      '\1=[redacted]',
      'g'
    ), 500);
$$;

-- ── 5. Second resolver — privileged access activity ──────────────────────────
-- The authoritative source is `public.audit_logs`, which the application
-- already writes on every membership, team and stakeholder-access change. It is
-- real data, organization-scoped and timestamped; nothing here is synthesised.
--
-- Freshness alone would be a weak control here, so this resolver also states a
-- CONTRADICTION: a privileged-access change attributed to an actor who is not an
-- active member of that organization. That is a fact the source can answer and
-- the kind of thing a privileged-access control exists to surface — an
-- attribution that cannot be true.

create or replace function public.eki_resolve_privileged_access_activity(
  p_organization_id uuid,
  p_freshness interval,
  p_warning interval
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_count bigint;
  v_latest timestamptz;
  v_contradictions bigint;
  v_outcome text;
  v_reason text;
  v_age interval;
begin
  if p_organization_id is null then
    return jsonb_build_object('outcome', 'invalid', 'reason_code', 'organization_required',
      'evidence_count', 0, 'latest_evidence_at', null, 'contradiction_count', 0,
      'detail', jsonb_build_object('source', 'audit_logs'));
  end if;

  begin
    select count(*), max(a.created_at)
      into v_count, v_latest
      from public.audit_logs a
     where a.organization_id = p_organization_id
       and a.entity_type in (
         'organization_members', 'project_team_members',
         'stakeholder_access', 'admin_authorized_users'
       );

    -- An access change whose actor holds no standing in the tenant. Counted
    -- separately rather than folded into the freshness verdict, because "the
    -- evidence is recent" and "the evidence disagrees with itself" are different
    -- problems with different owners.
    select count(*)
      into v_contradictions
      from public.audit_logs a
     where a.organization_id = p_organization_id
       and a.entity_type in (
         'organization_members', 'project_team_members',
         'stakeholder_access', 'admin_authorized_users'
       )
       and not exists (
         select 1 from public.organization_members m
          where m.organization_id = a.organization_id
            and m.user_id = a.actor_user_id
       );
  exception when others then
    -- Fails closed. The source could not be read; that is a system fault and is
    -- never reported as absent evidence and never as passing.
    return jsonb_build_object('outcome', 'unavailable', 'reason_code', 'source_unreadable',
      'evidence_count', 0, 'latest_evidence_at', null, 'contradiction_count', 0,
      'detail', jsonb_build_object('source', 'audit_logs'));
  end;

  if v_contradictions > 0 then
    v_outcome := 'contradictory';
    v_reason := 'privileged_change_by_non_member';
  elsif v_count = 0 or v_latest is null then
    v_outcome := 'stale';
    v_reason := 'no_privileged_access_records';
  else
    v_age := clock_timestamp() - v_latest;
    if v_age > p_freshness then
      v_outcome := 'stale';
      v_reason := 'privileged_access_evidence_expired';
    elsif v_age > (p_freshness - p_warning) then
      v_outcome := 'approaching_stale';
      v_reason := 'privileged_access_evidence_ageing';
    else
      v_outcome := 'current';
      v_reason := 'privileged_access_evidence_fresh';
    end if;
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'reason_code', v_reason,
    'evidence_count', coalesce(v_count, 0),
    'latest_evidence_at', v_latest,
    'contradiction_count', coalesce(v_contradictions, 0),
    -- Provenance. Which table answered, and which slice of it, so the evaluation
    -- can be reproduced by hand.
    'detail', jsonb_build_object(
      'source', 'audit_logs',
      'entity_types', array['organization_members','project_team_members','stakeholder_access','admin_authorized_users'],
      'resolver', 'privileged_access_activity')
  );
end
$$;

-- Widen the closed resolver vocabulary by exactly one. The constraint stays
-- closed: a binding still cannot name a resolver that does not exist.
alter table public.eki_evidence_binding_runtime
  drop constraint if exists eki_evidence_binding_runtime_resolver_key_check;
alter table public.eki_evidence_binding_runtime
  add constraint eki_evidence_binding_runtime_resolver_key_check
  check (resolver_key in ('governance_audit_activity', 'privileged_access_activity'));

-- ── 6. Resolver dispatch ─────────────────────────────────────────────────────
-- Replaced wholesale rather than patched, so the dispatch stays readable and the
-- unknown-resolver fallback keeps failing closed.

create or replace function public.eki_evaluate_binding(p_binding_object_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.eki_evidence_binding_runtime%rowtype;
  binding_status text;
  result jsonb;
  evaluation_id uuid;
  evaluation_sequence bigint;
  new_binding_state text;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;

  select * into b from public.eki_evidence_binding_runtime
    where binding_object_id = p_binding_object_id for update;
  if not found then raise exception 'eki_binding_not_found'; end if;

  select current_status into binding_status from public.project_knowledge_objects
    where id = p_binding_object_id;
  if binding_status is distinct from 'active' then
    raise exception 'eki_binding_specification_not_active';
  end if;

  if b.binding_state = 'retired' then raise exception 'eki_binding_retired'; end if;

  case b.resolver_key
    when 'governance_audit_activity' then
      result := public.eki_resolve_governance_audit_activity(b.organization_id, b.freshness_interval, b.warning_interval);
    when 'privileged_access_activity' then
      result := public.eki_resolve_privileged_access_activity(b.organization_id, b.freshness_interval, b.warning_interval);
    else
      result := jsonb_build_object('outcome', 'invalid', 'reason_code', 'unknown_resolver',
        'evidence_count', 0, 'latest_evidence_at', null, 'contradiction_count', 0);
  end case;

  insert into public.eki_evidence_evaluations(
    binding_object_id, organization_id, outcome, evidence_count, latest_evidence_at,
    contradiction_count, reason_code, detail, evaluated_by
  ) values (
    b.binding_object_id, b.organization_id, result->>'outcome',
    coalesce((result->>'evidence_count')::integer, 0),
    nullif(result->>'latest_evidence_at','')::timestamptz,
    coalesce((result->>'contradiction_count')::integer, 0),
    result->>'reason_code', result, 'system'
  ) returning id, sequence_no into evaluation_id, evaluation_sequence;

  new_binding_state := case result->>'outcome'
    when 'current' then 'active'
    when 'approaching_stale' then 'active'
    when 'stale' then 'stale'
    when 'contradictory' then 'stale'
    else 'broken'
  end;

  update public.eki_evidence_binding_runtime set
    binding_state = new_binding_state,
    last_evaluated_at = now(),
    last_outcome = result->>'outcome',
    last_success_at = case when result->>'outcome' in ('current','approaching_stale') then now() else last_success_at end,
    last_evidence_at = coalesce(nullif(result->>'latest_evidence_at','')::timestamptz, last_evidence_at),
    consecutive_failures = case when result->>'outcome' in ('current','approaching_stale') then 0 else consecutive_failures + 1 end,
    updated_at = now()
  where binding_object_id = b.binding_object_id;

  -- The sequence travels with the result. Everything downstream orders by it,
  -- never by the timestamp.
  return result || jsonb_build_object(
    'evaluation_id', evaluation_id,
    'evaluation_sequence', evaluation_sequence,
    'binding_state', new_binding_state);
end
$$;

-- ── 7. Control recalculation, guarded by sequence ────────────────────────────

create or replace function public.eki_recalculate_control_state(
  p_control_object_id uuid,
  p_evaluation_id uuid default null,
  p_evaluation_sequence bigint default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.eki_control_runtime%rowtype;
  gate jsonb;
  target_state text;
  reason text;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;

  select * into c from public.eki_control_runtime where control_object_id = p_control_object_id for update;
  if not found then raise exception 'eki_control_not_found'; end if;

  -- An evaluation older than the one that last drove this control is not
  -- authoritative, whatever its timestamp says. A worker delayed past its claim
  -- and finishing after a newer evaluation lands here, and is refused.
  if p_evaluation_sequence is not null and p_evaluation_sequence <= c.last_evaluation_sequence then
    return jsonb_build_object('control_state', c.control_state, 'changed', false,
      'reason', 'superseded_by_newer_evaluation', 'superseded', true);
  end if;

  if c.control_state in ('retired', 'ineffective') then
    return jsonb_build_object('control_state', c.control_state, 'changed', false, 'reason', 'terminal_state');
  end if;

  gate := public.eki_control_can_operate(p_control_object_id);

  if (gate->>'can_operate')::boolean then
    target_state := 'operating';
    reason := 'all_operating_conditions_satisfied';
  elsif c.control_state = 'operating' then
    target_state := 'degraded';
    reason := coalesce(array_to_string(array(select jsonb_array_elements_text(gate->'reasons')), ','), 'conditions_no_longer_met');
  elsif c.control_state = 'degraded' then
    target_state := 'degraded';
    reason := 'still_degraded';
  else
    target_state := c.control_state;
    reason := coalesce(array_to_string(array(select jsonb_array_elements_text(gate->'reasons')), ','), 'conditions_not_met');
  end if;

  if target_state = c.control_state then
    update public.eki_control_runtime set
      last_evaluated_at = now(),
      last_evaluation_sequence = greatest(last_evaluation_sequence, coalesce(p_evaluation_sequence, 0)),
      updated_at = now()
      where control_object_id = p_control_object_id;
    return jsonb_build_object('control_state', c.control_state, 'changed', false, 'reason', reason, 'gate', gate);
  end if;

  insert into public.eki_control_state_transitions(
    control_object_id, organization_id, from_state, to_state, driver, rationale, evaluation_id
  ) values (
    p_control_object_id, c.organization_id, c.control_state, target_state, 'evidence', reason,
    coalesce(p_evaluation_id, (select id from public.eki_evidence_evaluations
      where organization_id = c.organization_id order by sequence_no desc limit 1))
  );

  update public.eki_control_runtime set
    control_state = target_state,
    last_state_change_at = now(),
    last_evaluated_at = now(),
    last_evaluation_sequence = greatest(last_evaluation_sequence, coalesce(p_evaluation_sequence, 0)),
    updated_at = now()
  where control_object_id = p_control_object_id;

  return jsonb_build_object('control_state', target_state, 'changed', true, 'reason', reason, 'gate', gate);
end
$$;

-- The two-argument signature is retired in favour of the sequence-aware one, so
-- no caller can accidentally keep the unguarded behaviour.
drop function if exists public.eki_recalculate_control_state(uuid, uuid);

-- ── 8. eki_evaluate_and_sync, sequence-aware ─────────────────────────────────

create or replace function public.eki_evaluate_and_sync(p_binding_object_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.eki_evidence_binding_runtime%rowtype;
  v_eval jsonb;
  v_control uuid;
  v_control_state jsonb;
  v_condition text;
  v_severity text;
  v_finding jsonb;
  v_owner uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;

  select * into b from public.eki_evidence_binding_runtime where binding_object_id = p_binding_object_id;
  if not found then raise exception 'eki_binding_not_found'; end if;

  v_eval := public.eki_evaluate_binding(p_binding_object_id);

  select r.source_object_id into v_control
    from public.project_knowledge_relations r
   where r.target_object_id = p_binding_object_id and r.relation_type = 'supports'
   limit 1;

  if v_control is null then
    return v_eval || jsonb_build_object('control_object_id', null, 'finding', null);
  end if;

  v_control_state := public.eki_recalculate_control_state(
    v_control,
    (v_eval->>'evaluation_id')::uuid,
    (v_eval->>'evaluation_sequence')::bigint);

  -- A superseded evaluation changes nothing and raises nothing. Raising a
  -- finding from a result the engine has already refused to act on would be a
  -- finding nobody can reconcile with the control it names.
  if coalesce((v_control_state->>'superseded')::boolean, false) then
    return v_eval || jsonb_build_object(
      'control_object_id', v_control, 'control', v_control_state,
      'finding', null, 'condition', null);
  end if;

  select owner_user_id into v_owner from public.project_knowledge_objects where id = v_control;

  v_condition := case v_eval->>'outcome'
    when 'stale' then case when (v_eval->>'evidence_count')::integer = 0
                        then 'evidence_missing' else 'evidence_stale' end
    when 'unavailable' then 'evidence_unavailable'
    when 'invalid' then 'evidence_invalid'
    when 'contradictory' then 'evidence_contradictory'
    else null
  end;

  if v_condition is null and (v_control_state->>'control_state') = 'degraded' then
    v_condition := 'control_lost_operating';
  end if;

  if v_condition is not null then
    v_severity := case v_condition
      when 'evidence_missing' then 'high'
      when 'evidence_contradictory' then 'high'
      when 'control_lost_operating' then 'high'
      when 'evidence_unavailable' then 'medium'
      when 'evidence_invalid' then 'medium'
      else 'medium' end;
    v_finding := public.eki_upsert_finding(
      b.organization_id, v_control, v_condition, v_severity,
      'Evidence condition ' || v_condition || ' held for binding ' || p_binding_object_id::text || '.',
      v_eval, v_owner, (v_eval->>'evaluation_id')::uuid);
  end if;

  return v_eval || jsonb_build_object(
    'control_object_id', v_control, 'control', v_control_state, 'finding', v_finding, 'condition', v_condition);
end
$$;

-- ── 9. Run lifecycle ─────────────────────────────────────────────────────────

create or replace function public.eki_start_evaluation_run(
  p_run_key text,
  p_trigger_type text,
  p_organization_id uuid default null,
  p_requested_by uuid default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_existing public.eki_evaluation_runs%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;
  if nullif(btrim(p_run_key), '') is null then raise exception 'eki_run_key_required'; end if;

  -- Duplicate delivery resolves to the same run. The second caller is told it is
  -- a duplicate and claims nothing, rather than starting a parallel sweep that
  -- competes with the first for the same bindings.
  insert into public.eki_evaluation_runs(run_key, trigger_type, organization_id, requested_by)
  values (btrim(p_run_key), p_trigger_type, p_organization_id, p_requested_by)
  on conflict (run_key) do nothing
  returning id into v_id;

  if v_id is not null then
    return jsonb_build_object('run_id', v_id, 'duplicate', false);
  end if;

  select * into v_existing from public.eki_evaluation_runs where run_key = btrim(p_run_key);
  return jsonb_build_object('run_id', v_existing.id, 'duplicate', true, 'status', v_existing.status);
end
$$;

create or replace function public.eki_complete_evaluation_run(
  p_run_id uuid,
  p_failure_category text default null,
  p_error text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_eval integer; v_failed integer; v_claimed integer; v_status text;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;

  select
    count(*) filter (where status = 'succeeded'),
    count(*) filter (where status = 'failed'),
    count(*)
    into v_eval, v_failed, v_claimed
    from public.eki_evaluation_run_items where run_id = p_run_id;

  -- A run that evaluated nothing because nothing was due SUCCEEDED. A run that
  -- evaluated nothing because everything failed did not. The distinction is the
  -- difference between a quiet system and a broken one.
  v_status := case
    when p_failure_category is not null and v_eval = 0 then 'failed'
    when v_failed > 0 and v_eval > 0 then 'partial'
    when v_failed > 0 then 'failed'
    else 'succeeded'
  end;

  update public.eki_evaluation_runs set
    completed_at = clock_timestamp(),
    status = v_status,
    bindings_claimed = v_claimed,
    bindings_evaluated = v_eval,
    bindings_failed = v_failed,
    failure_category = p_failure_category,
    safe_error = public.eki_safe_error(p_error)
  where id = p_run_id;

  return jsonb_build_object('run_id', p_run_id, 'status', v_status,
    'claimed', v_claimed, 'evaluated', v_eval, 'failed', v_failed);
end
$$;

-- ── 10. Claiming due bindings ────────────────────────────────────────────────

create or replace function public.eki_claim_due_bindings(
  p_run_id uuid,
  p_limit integer default 50,
  p_organization_id uuid default null,
  p_claim_ttl interval default interval '5 minutes'
) returns setof jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then raise exception 'eki_invalid_claim_limit'; end if;

  for r in
    with due as (
      select b.binding_object_id, b.organization_id, b.next_due_at, b.evaluation_interval
        from public.eki_evidence_binding_runtime b
       where b.evaluation_enabled
         and b.binding_state <> 'retired'
         and b.next_due_at <= clock_timestamp()
         and (p_organization_id is null or b.organization_id = p_organization_id)
         -- An unclaimed binding, or one whose claim has lapsed. A lapsed claim is
         -- reclaimable precisely so a crashed worker does not park a binding
         -- forever; the old worker is fenced off by its token, not by hope.
         and (b.claim_expires_at is null or b.claim_expires_at <= clock_timestamp())
         -- A retired or ineffective control is not measured. Both are terminal
         -- human decisions and evidence does not reopen them.
         and not exists (
           select 1
             from public.project_knowledge_relations rel
             join public.eki_control_runtime c on c.control_object_id = rel.source_object_id
            where rel.target_object_id = b.binding_object_id
              and rel.relation_type = 'supports'
              and c.control_state in ('retired', 'ineffective')
         )
       -- Deterministic: oldest due first, then by id. Two workers scanning the
       -- same instant see the same order and take disjoint slices.
       order by b.next_due_at asc, b.binding_object_id asc
       limit p_limit
       -- The whole mechanism. SKIP LOCKED means a second worker steps over rows
       -- the first has taken instead of blocking behind them, so concurrent runs
       -- divide the work rather than serialising or duplicating it.
       for update of b skip locked
    )
    update public.eki_evidence_binding_runtime tgt
       set claim_token = gen_random_uuid(),
           claimed_at = clock_timestamp(),
           claim_expires_at = clock_timestamp() + p_claim_ttl,
           claimed_by_run_id = p_run_id
      from due
     where tgt.binding_object_id = due.binding_object_id
    returning tgt.binding_object_id, tgt.organization_id, tgt.claim_token,
              due.next_due_at as was_due_at, tgt.evaluation_interval as cadence
  loop
    -- How many whole cadences elapsed before this run reached the binding. Zero
    -- on a healthy schedule; anything else is a gap the operator should see.
    insert into public.eki_evaluation_run_items(
      run_id, binding_object_id, organization_id, claim_token, missed_intervals
    ) values (
      p_run_id, r.binding_object_id, r.organization_id, r.claim_token,
      greatest(0, floor(extract(epoch from (clock_timestamp() - r.was_due_at))
                        / nullif(extract(epoch from r.cadence), 0))::integer)
    );

    return next jsonb_build_object(
      'binding_object_id', r.binding_object_id,
      'organization_id', r.organization_id,
      'claim_token', r.claim_token);
  end loop;
end
$$;

-- ── 11. Evaluating a claimed binding ─────────────────────────────────────────

create or replace function public.eki_evaluate_claimed_binding(
  p_run_id uuid,
  p_binding_object_id uuid,
  p_claim_token uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.eki_evidence_binding_runtime%rowtype;
  v_control_before text;
  v_sync jsonb;
  v_item uuid;
  v_finding_action text;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;

  select * into b from public.eki_evidence_binding_runtime
    where binding_object_id = p_binding_object_id for update;
  if not found then raise exception 'eki_binding_not_found'; end if;

  -- The fence. A worker whose claim was reissued to somebody else stops here,
  -- before it reads any evidence: its answer would describe a moment that has
  -- already been superseded, and recording it would make the older reading the
  -- newest row.
  if b.claim_token is distinct from p_claim_token then
    update public.eki_evaluation_run_items
       set status = 'superseded', completed_at = clock_timestamp(),
           failure_category = 'claim_superseded'
     where run_id = p_run_id and binding_object_id = p_binding_object_id;
    return jsonb_build_object('evaluated', false, 'reason', 'claim_superseded');
  end if;

  select c.control_state into v_control_before
    from public.project_knowledge_relations rel
    join public.eki_control_runtime c on c.control_object_id = rel.source_object_id
   where rel.target_object_id = p_binding_object_id and rel.relation_type = 'supports'
   limit 1;

  begin
    v_sync := public.eki_evaluate_and_sync(p_binding_object_id);
  exception when others then
    -- One binding's failure is recorded and contained. The caller keeps going;
    -- a batch that aborts here leaves every later tenant unevaluated and the
    -- silence is indistinguishable from health.
    update public.eki_evidence_binding_runtime set
      execution_failures = execution_failures + 1,
      last_execution_error = public.eki_safe_error(sqlerrm),
      -- Backoff, capped. A source that is down stays down; retrying it every
      -- minute produces noise, not evidence.
      next_due_at = clock_timestamp() + least(
        evaluation_interval,
        (interval '1 minute') * power(2, least(execution_failures, 6))),
      claim_token = null, claimed_at = null, claim_expires_at = null,
      updated_at = now()
    where binding_object_id = p_binding_object_id;

    update public.eki_evaluation_run_items
       set status = 'failed', completed_at = clock_timestamp(),
           failure_category = 'evaluation_error',
           safe_error = public.eki_safe_error(sqlerrm),
           retry_count = retry_count + 1
     where run_id = p_run_id and binding_object_id = p_binding_object_id;

    return jsonb_build_object('evaluated', false, 'reason', 'evaluation_error',
      'error', public.eki_safe_error(sqlerrm));
  end;

  v_finding_action := case
    when v_sync->'finding' is null or v_sync->'finding' = 'null'::jsonb then 'none'
    when coalesce((v_sync->'finding'->>'created')::boolean, false) then 'created'
    else 'recurred'
  end;

  update public.eki_evaluation_run_items set
    status = 'succeeded',
    completed_at = clock_timestamp(),
    outcome = v_sync->>'outcome',
    evaluation_id = (v_sync->>'evaluation_id')::uuid,
    evaluation_sequence = (v_sync->>'evaluation_sequence')::bigint,
    control_object_id = nullif(v_sync->>'control_object_id','')::uuid,
    control_state_before = v_control_before,
    control_state_after = v_sync->'control'->>'control_state',
    finding_action = v_finding_action,
    finding_object_id = nullif(v_sync->'finding'->>'finding_object_id','')::uuid
  where run_id = p_run_id and binding_object_id = p_binding_object_id;

  -- Schedule from NOW, not from the missed due time. Advancing by interval from
  -- a due date days in the past would queue one catch-up run per missed cadence
  -- and flood the next sweep with measurements of the same instant.
  update public.eki_evidence_binding_runtime set
    next_due_at = clock_timestamp() + evaluation_interval,
    execution_failures = 0,
    last_execution_error = null,
    claim_token = null, claimed_at = null, claim_expires_at = null,
    updated_at = now()
  where binding_object_id = p_binding_object_id;

  return v_sync || jsonb_build_object('evaluated', true);
end
$$;

-- ── 12. Manual and post-mutation evaluation ──────────────────────────────────
-- An explicit, authorized request may evaluate a binding that is not due. A
-- SCHEDULED sweep may not: the cadence is the policy, and a scheduler that
-- ignores it is not measuring on a cadence at all.

create or replace function public.eki_request_evaluation(
  p_binding_object_id uuid,
  p_actor_id uuid,
  p_trigger_type text default 'manual'
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.eki_evidence_binding_runtime%rowtype;
  v_role text;
  v_run jsonb;
  v_run_id uuid;
  v_token uuid;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;
  if p_trigger_type not in ('manual', 'mutation') then raise exception 'eki_invalid_trigger_type'; end if;

  select * into b from public.eki_evidence_binding_runtime where binding_object_id = p_binding_object_id;
  if not found then raise exception 'eki_binding_not_found'; end if;

  if p_trigger_type = 'manual' then
    v_role := public.project_knowledge_actor_role(b.organization_id, p_actor_id);
    if coalesce(v_role, '') not in ('owner', 'admin', 'member') then
      -- Returned, not raised: the refusal is auditable and nothing is mutated.
      perform public.eki_record_governance_event(
        b.organization_id, 'access_denied', p_actor_id, coalesce(v_role, 'none'),
        'attempted manual evidence evaluation', 'denied', array['insufficient_role'],
        array[p_binding_object_id::text], '{}'::jsonb, null, 'human');
      return jsonb_build_object('authorized', false, 'reason', 'eki_evaluation_forbidden');
    end if;
  end if;

  if not b.evaluation_enabled then
    return jsonb_build_object('authorized', true, 'evaluated', false, 'reason', 'binding_disabled');
  end if;
  if b.binding_state = 'retired' then
    return jsonb_build_object('authorized', true, 'evaluated', false, 'reason', 'binding_retired');
  end if;

  v_run := public.eki_start_evaluation_run(
    p_trigger_type || ':' || p_binding_object_id::text || ':' || clock_timestamp()::text,
    p_trigger_type, b.organization_id,
    case when p_trigger_type = 'manual' then p_actor_id else null end);
  v_run_id := (v_run->>'run_id')::uuid;

  -- An explicit request takes the claim outright rather than waiting for the
  -- binding to become due. It still takes a claim, so a scheduled sweep running
  -- at the same moment cannot evaluate the same binding underneath it.
  v_token := gen_random_uuid();
  update public.eki_evidence_binding_runtime set
    claim_token = v_token, claimed_at = clock_timestamp(),
    claim_expires_at = clock_timestamp() + interval '5 minutes',
    claimed_by_run_id = v_run_id, updated_at = now()
  where binding_object_id = p_binding_object_id;

  insert into public.eki_evaluation_run_items(run_id, binding_object_id, organization_id, claim_token)
  values (v_run_id, p_binding_object_id, b.organization_id, v_token);

  v_result := public.eki_evaluate_claimed_binding(v_run_id, p_binding_object_id, v_token);
  perform public.eki_complete_evaluation_run(v_run_id);

  return jsonb_build_object('authorized', true, 'run_id', v_run_id) || v_result;
end
$$;

-- ── 13. Security ─────────────────────────────────────────────────────────────

alter table public.eki_evaluation_runs enable row level security;
alter table public.eki_evaluation_run_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['eki_evaluation_runs', 'eki_evaluation_run_items'] loop
    -- Members read their own tenant's runs. A platform-wide scheduled run has no
    -- organization and is therefore visible to nobody through this policy —
    -- deliberately: it belongs to the operator, not to a tenant.
    execute format(
      'create policy "Members read %1$s" on public.%1$I for select using (public.is_org_member(organization_id))', t);
    execute format(
      'create policy "Service role %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t);
    execute format('revoke insert, update, delete on public.%1$I from authenticated', t);
    execute format('grant select on public.%1$I to authenticated', t);
  end loop;
end $$;

grant execute on function public.eki_resolve_privileged_access_activity(uuid, interval, interval) to service_role;
grant execute on function public.eki_recalculate_control_state(uuid, uuid, bigint) to service_role;
grant execute on function public.eki_start_evaluation_run(text, text, uuid, uuid) to service_role;
grant execute on function public.eki_complete_evaluation_run(uuid, text, text) to service_role;
grant execute on function public.eki_claim_due_bindings(uuid, integer, uuid, interval) to service_role;
grant execute on function public.eki_evaluate_claimed_binding(uuid, uuid, uuid) to service_role;
grant execute on function public.eki_request_evaluation(uuid, uuid, text) to service_role;
grant execute on function public.eki_safe_error(text) to service_role;
