-- ============================================================================
-- EKI Macrophase 2 — Evidence Engine
-- ============================================================================
-- Makes the Charter's completion rule computable:
--
--   A control is complete when a query returns its evidence. Not when the
--   mechanism exists. Not when the tests pass. When the rows are there.
--
-- Three runtime surfaces, none of which is a second model of anything:
--
--   * a binding's SPECIFICATION is a knowledge object (`evidence_binding`),
--     versioned, owned and approved like any other assertion;
--   * its OPERATIONAL STATE lives in `eki_evidence_binding_runtime`, because a
--     binding going stale is an observation about the world, not a revision of
--     what the binding asserts. Versioning on every evaluation would make the
--     version history meaningless;
--   * every evaluation is appended to `eki_evidence_evaluations` and never
--     updated, so "why did this control degrade" is answerable after the fact.
--
-- The same split governs controls: the control is a knowledge object, its
-- lifecycle state is runtime.
--
-- NOTHING here copies evidence. The evidence for the one control implemented in
-- this macrophase lives in `platform_governance_audit` and is COUNTED there, in
-- place. A copy is not tamper-evident because its original was (Charter P5).
-- ============================================================================

-- ── 1. Binding runtime ──────────────────────────────────────────────────────

create table public.eki_evidence_binding_runtime (
  binding_object_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Closed resolver vocabulary. A binding names a resolver; it does not carry a
  -- query. A free-text query would be an injection surface and unreviewable.
  resolver_key text not null check (resolver_key in ('governance_audit_activity')),

  -- Freshness policy. Per binding, never global: a daily control and an annual
  -- one are not comparable, and one threshold would be wrong for both.
  freshness_interval interval not null check (freshness_interval > interval '0'),
  warning_interval interval not null check (warning_interval > interval '0'),

  -- Lifecycle from EKI gate §2.2. `stale` and `broken` are COMPUTED by the
  -- passage of time and by evaluation outcome; they are never declared.
  binding_state text not null default 'defined'
    check (binding_state in ('defined', 'active', 'stale', 'broken', 'retired')),

  last_evaluated_at timestamptz,
  last_success_at timestamptz,
  last_evidence_at timestamptz,
  last_outcome text check (last_outcome in ('current', 'approaching_stale', 'stale', 'unavailable', 'invalid', 'contradictory')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A generated constant, so the composite foreign key below can carry the
  -- scope without a trigger and without trusting the caller to supply it.
  -- Governance bindings are organization-scoped by definition (ADR-013).
  scope_type text not null generated always as ('organization') stored,

  constraint eki_binding_warning_before_stale check (warning_interval < freshness_interval),
  constraint eki_binding_object_fk
    foreign key (binding_object_id, organization_id, scope_type)
    references public.project_knowledge_objects(id, organization_id, scope_type)
    on delete cascade
);

create index eki_binding_runtime_org_idx
  on public.eki_evidence_binding_runtime (organization_id, binding_state, last_evaluated_at);

-- ── 2. Evaluations, append-only ─────────────────────────────────────────────

create table public.eki_evidence_evaluations (
  id uuid primary key default gen_random_uuid(),
  binding_object_id uuid not null references public.eki_evidence_binding_runtime(binding_object_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- clock_timestamp(), NOT now(). `now()` is the TRANSACTION timestamp, so two
  -- evaluations written in one transaction receive the identical value and
  -- "order by evaluated_at desc limit 1" becomes non-deterministic. The engine
  -- then reads a stale evaluation as the latest one and a control never reaches
  -- operating. Found by running the end-to-end flow; invisible in review.
  evaluated_at timestamptz not null default clock_timestamp(),
  sequence_no bigint generated always as identity,

  -- The six freshness states from the macrophase brief. `unavailable` and
  -- `invalid` are distinct from `stale`: a source that could not be reached is
  -- a system fault, staleness is a control fault, and conflating them
  -- misattributes the problem.
  outcome text not null check (outcome in ('current', 'approaching_stale', 'stale', 'unavailable', 'invalid', 'contradictory')),

  evidence_count integer not null default 0 check (evidence_count >= 0),
  latest_evidence_at timestamptz,
  contradiction_count integer not null default 0 check (contradiction_count >= 0),

  -- Why the outcome is what it is. Never empty: an evaluation that cannot say
  -- why it concluded something is not evidence of anything.
  reason_code text not null check (length(btrim(reason_code)) > 0),
  detail jsonb not null default '{}'::jsonb,

  -- Automated evaluation runs as the service role and has no human actor. The
  -- column records which, honestly, rather than attributing it to a person.
  evaluated_by text not null default 'system' check (evaluated_by in ('system', 'human')),
  actor_id uuid references auth.users(id)
);

create index eki_evaluations_binding_idx
  on public.eki_evidence_evaluations (binding_object_id, evaluated_at desc);

create or replace function public.eki_evaluations_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'eki_evaluations_are_append_only: % is not allowed', TG_OP;
end
$$;

create trigger eki_evaluations_no_update before update on public.eki_evidence_evaluations
  for each row execute function public.eki_evaluations_immutable();
create trigger eki_evaluations_no_delete before delete on public.eki_evidence_evaluations
  for each row execute function public.eki_evaluations_immutable();

-- ── 3. Control runtime and its lifecycle ────────────────────────────────────

create table public.eki_control_runtime (
  control_object_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope_type text not null generated always as ('organization') stored,

  control_state text not null default 'proposed'
    check (control_state in ('proposed', 'designed', 'implemented', 'operating', 'degraded', 'ineffective', 'retired')),

  -- Recorded so the transition rules can be checked without re-deriving them,
  -- and so a human override is distinguishable from an evidence-driven change.
  last_state_change_at timestamptz not null default now(),
  last_evaluated_at timestamptz,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint eki_control_object_fk
    foreign key (control_object_id, organization_id, scope_type)
    references public.project_knowledge_objects(id, organization_id, scope_type)
    on delete cascade
);

create index eki_control_runtime_org_idx
  on public.eki_control_runtime (organization_id, control_state);

create table public.eki_control_state_transitions (
  id uuid primary key default gen_random_uuid(),
  control_object_id uuid not null references public.eki_control_runtime(control_object_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  from_state text check (from_state in ('proposed', 'designed', 'implemented', 'operating', 'degraded', 'ineffective', 'retired')),
  to_state text not null check (to_state in ('proposed', 'designed', 'implemented', 'operating', 'degraded', 'ineffective', 'retired')),

  -- `evidence` means the engine moved it; `human` means a person did. Both are
  -- recorded, because the difference is exactly what an auditor asks about.
  driver text not null check (driver in ('evidence', 'human')),
  actor_id uuid references auth.users(id),
  rationale text not null check (length(btrim(rationale)) > 0),
  evaluation_id uuid references public.eki_evidence_evaluations(id),

  created_at timestamptz not null default now(),

  -- A human-driven transition names the human. An evidence-driven one names the
  -- evaluation that caused it. Neither may be anonymous.
  constraint eki_transition_attribution check (
    (driver = 'human' and actor_id is not null)
    or (driver = 'evidence' and evaluation_id is not null)
  )
);

create index eki_control_transitions_idx
  on public.eki_control_state_transitions (control_object_id, created_at desc);

create trigger eki_control_transitions_no_update before update on public.eki_control_state_transitions
  for each row execute function public.eki_evaluations_immutable();
create trigger eki_control_transitions_no_delete before delete on public.eki_control_state_transitions
  for each row execute function public.eki_evaluations_immutable();

-- ── 4. Open findings, one per condition ─────────────────────────────────────
-- A finding is a knowledge object (ADR-014). This table is the INDEX that makes
-- automatic creation idempotent: one open finding per (target, condition).
-- Without it, every evaluation of a stale binding would raise a new finding and
-- the register would become noise within a day.

create table public.eki_open_findings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_object_id uuid not null,
  condition_code text not null check (condition_code in (
    'evidence_missing', 'evidence_stale', 'evidence_unavailable',
    'evidence_invalid', 'evidence_contradictory', 'control_lost_operating'
  )),
  finding_object_id uuid not null,
  scope_type text not null generated always as ('organization') stored,

  opened_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check (occurrence_count > 0),

  primary key (organization_id, target_object_id, condition_code),

  constraint eki_open_finding_object_fk
    foreign key (finding_object_id, organization_id, scope_type)
    references public.project_knowledge_objects(id, organization_id, scope_type)
    on delete cascade
);

create index eki_open_findings_finding_idx on public.eki_open_findings (finding_object_id);

-- ── 5. The evidence resolver ────────────────────────────────────────────────
-- One resolver in this macrophase: governance audit activity.
--
-- It COUNTS records in `platform_governance_audit` for the organization. It does
-- not copy them, and it cannot: the table is append-only and hash-chained, and a
-- copy would be neither.
--
-- Fails closed. An error, an unreachable source or an ambiguous result must
-- never be interpreted as passing evidence — so every path that is not a clean
-- count returns `unavailable` or `invalid`, never `current`.

create or replace function public.eki_resolve_governance_audit_activity(
  p_organization_id uuid,
  p_freshness interval,
  p_warning interval
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
  v_latest timestamptz;
  v_age interval;
  v_outcome text;
  v_reason text;
begin
  if p_organization_id is null then
    return jsonb_build_object('outcome', 'invalid', 'reason_code', 'organization_required',
      'evidence_count', 0, 'latest_evidence_at', null, 'contradiction_count', 0);
  end if;

  begin
    select count(*), max(occurred_at)
      into v_count, v_latest
      from public.platform_governance_audit
     where organization_id = p_organization_id;
  exception when others then
    -- Fails closed. The source could not be read; that is a system fault and is
    -- reported as such, never as absent evidence and never as passing.
    return jsonb_build_object('outcome', 'unavailable', 'reason_code', 'source_unreadable',
      'evidence_count', 0, 'latest_evidence_at', null, 'contradiction_count', 0);
  end;

  if v_count = 0 or v_latest is null then
    v_outcome := 'stale';
    v_reason := 'no_governance_audit_records';
  else
    -- clock_timestamp(), not now(). Freshness measured against the transaction
    -- start time means a long-running transaction evaluates against an
    -- increasingly wrong "now", and evidence that aged during the transaction
    -- is reported as current.
    v_age := clock_timestamp() - v_latest;
    if v_age > p_freshness then
      v_outcome := 'stale';
      v_reason := 'latest_record_older_than_freshness_tolerance';
    elsif v_age > (p_freshness - p_warning) then
      v_outcome := 'approaching_stale';
      v_reason := 'latest_record_within_warning_window';
    else
      v_outcome := 'current';
      v_reason := 'recent_governance_audit_activity';
    end if;
  end if;

  return jsonb_build_object(
    'outcome', v_outcome,
    'reason_code', v_reason,
    'evidence_count', coalesce(v_count, 0),
    'latest_evidence_at', v_latest,
    'contradiction_count', 0
  );
end
$$;

-- ── 6. Evaluation and control recalculation ─────────────────────────────────

create or replace function public.eki_evaluate_binding(p_binding_object_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.eki_evidence_binding_runtime%rowtype;
  binding_status text;
  result jsonb;
  evaluation_id uuid;
  new_binding_state text;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;

  select * into b from public.eki_evidence_binding_runtime
    where binding_object_id = p_binding_object_id for update;
  if not found then raise exception 'eki_binding_not_found'; end if;

  -- A binding whose specification has not been activated as knowledge does not
  -- evaluate. Approving the assertion precedes trusting its output.
  select current_status into binding_status from public.project_knowledge_objects
    where id = p_binding_object_id;
  if binding_status is distinct from 'active' then
    raise exception 'eki_binding_specification_not_active';
  end if;

  if b.binding_state = 'retired' then raise exception 'eki_binding_retired'; end if;

  case b.resolver_key
    when 'governance_audit_activity' then
      result := public.eki_resolve_governance_audit_activity(b.organization_id, b.freshness_interval, b.warning_interval);
    else
      -- Unknown resolver fails closed rather than defaulting to a pass.
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
  ) returning id into evaluation_id;

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

  return result || jsonb_build_object('evaluation_id', evaluation_id, 'binding_state', new_binding_state);
end
$$;

-- Whether the six conditions for `operating` hold. Pure read; no side effects.
create or replace function public.eki_control_can_operate(p_control_object_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  c public.eki_control_runtime%rowtype;
  knowledge_status text;
  owner_id uuid;
  binding_count integer;
  healthy_binding_count integer;
  latest_outcome text;
  blocking_contradictions integer;
  failures text[] := array[]::text[];
begin
  select * into c from public.eki_control_runtime where control_object_id = p_control_object_id;
  if not found then
    return jsonb_build_object('can_operate', false, 'reasons', array['control_runtime_missing']);
  end if;

  select current_status, owner_user_id into knowledge_status, owner_id
    from public.project_knowledge_objects where id = p_control_object_id;

  -- 1. the implementation exists — represented by the control's knowledge
  --    object having been activated, which is the approval that says so
  if knowledge_status is distinct from 'active' then
    failures := array_append(failures, 'control_specification_not_active');
  end if;

  -- 5. required approval exists — an owner is named
  if owner_id is null then
    failures := array_append(failures, 'owner_not_assigned');
  end if;

  -- 2. an active EvidenceBinding exists
  select count(*) into binding_count
    from public.eki_evidence_binding_runtime b
    join public.project_knowledge_relations r
      on r.source_object_id = p_control_object_id
     and r.target_object_id = b.binding_object_id
     and r.relation_type = 'supports'
    where b.organization_id = c.organization_id
      and b.binding_state <> 'retired';
  if binding_count = 0 then
    failures := array_append(failures, 'no_evidence_binding');
  end if;

  -- 3 and 4. the binding has produced valid evidence, within tolerance
  select count(*), max(e.outcome) into healthy_binding_count, latest_outcome
    from public.eki_evidence_binding_runtime b
    join public.project_knowledge_relations r
      on r.source_object_id = p_control_object_id
     and r.target_object_id = b.binding_object_id
     and r.relation_type = 'supports'
    left join lateral (
      -- Ordered by the identity column, which is monotonic regardless of clock
      -- resolution. Timestamps alone are not a safe tiebreaker.
      select outcome from public.eki_evidence_evaluations
      where binding_object_id = b.binding_object_id order by sequence_no desc limit 1
    ) e on true
    where b.organization_id = c.organization_id
      and b.binding_state = 'active'
      and e.outcome in ('current', 'approaching_stale');
  if binding_count > 0 and coalesce(healthy_binding_count, 0) = 0 then
    failures := array_append(failures, 'no_fresh_evidence');
  end if;

  -- 6. no unresolved blocking contradiction
  select count(*) into blocking_contradictions
    from public.project_knowledge_relations
   where organization_id = c.organization_id
     and relation_type = 'contradicts'
     and resolution_status = 'unresolved'
     and (source_object_id = p_control_object_id or target_object_id = p_control_object_id);
  if blocking_contradictions > 0 then
    failures := array_append(failures, 'unresolved_contradiction');
  end if;

  return jsonb_build_object(
    'can_operate', array_length(failures, 1) is null,
    'reasons', coalesce(failures, array[]::text[]),
    'binding_count', binding_count,
    'healthy_binding_count', coalesce(healthy_binding_count, 0),
    'blocking_contradictions', blocking_contradictions
  );
end
$$;

create or replace function public.eki_recalculate_control_state(p_control_object_id uuid, p_evaluation_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.eki_control_runtime%rowtype;
  gate jsonb;
  target_state text;
  reason text;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;

  select * into c from public.eki_control_runtime where control_object_id = p_control_object_id for update;
  if not found then raise exception 'eki_control_not_found'; end if;

  -- Terminal by human decision. Evidence does not resurrect a retired control,
  -- and it does not overturn a human's judgement that a control is ineffective.
  if c.control_state in ('retired', 'ineffective') then
    return jsonb_build_object('control_state', c.control_state, 'changed', false, 'reason', 'terminal_state');
  end if;

  gate := public.eki_control_can_operate(p_control_object_id);

  if (gate->>'can_operate')::boolean then
    target_state := 'operating';
    reason := 'all_operating_conditions_satisfied';
  elsif c.control_state = 'operating' then
    -- It was operating and no longer qualifies. Degraded, never silently back
    -- to implemented: the difference records that it once worked.
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
    update public.eki_control_runtime set last_evaluated_at = now(), updated_at = now()
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
    control_state = target_state, last_state_change_at = now(), last_evaluated_at = now(), updated_at = now()
  where control_object_id = p_control_object_id;

  return jsonb_build_object('control_state', target_state, 'changed', true, 'reason', reason, 'gate', gate);
end
$$;

-- ── 7. RLS ──────────────────────────────────────────────────────────────────
-- Same pattern and same tenant predicate as every other knowledge table. No
-- policy on an existing table is touched.

alter table public.eki_evidence_binding_runtime enable row level security;
alter table public.eki_evidence_evaluations enable row level security;
alter table public.eki_control_runtime enable row level security;
alter table public.eki_control_state_transitions enable row level security;
alter table public.eki_open_findings enable row level security;

do $$ declare t text; begin
  foreach t in array array[
    'eki_evidence_binding_runtime','eki_evidence_evaluations','eki_control_runtime',
    'eki_control_state_transitions','eki_open_findings'
  ] loop
    execute format('create policy "Members read %1$s" on public.%1$I for select using (public.is_org_member(organization_id))', t);
    execute format('create policy "Service role %1$s" on public.%1$I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t);
    execute format('revoke insert, update, delete on public.%1$I from anon, authenticated', t);
    execute format('grant select on public.%1$I to authenticated', t);
  end loop;
end $$;

revoke all on function public.eki_resolve_governance_audit_activity(uuid, interval, interval) from public, anon, authenticated;
revoke all on function public.eki_evaluate_binding(uuid) from public, anon, authenticated;
revoke all on function public.eki_control_can_operate(uuid) from public, anon, authenticated;
revoke all on function public.eki_recalculate_control_state(uuid, uuid) from public, anon, authenticated;
revoke all on function public.eki_evaluations_immutable() from public, anon, authenticated;

grant execute on function public.eki_evaluate_binding(uuid) to service_role;
grant execute on function public.eki_control_can_operate(uuid) to service_role;
grant execute on function public.eki_recalculate_control_state(uuid, uuid) to service_role;

comment on table public.eki_evidence_binding_runtime is
  'EKI Macrophase 2. Operational state of an evidence binding. The binding''s specification is a knowledge object; this is the observation about it. stale and broken are computed, never declared.';
comment on table public.eki_evidence_evaluations is
  'EKI Macrophase 2. Append-only evaluation results. Answers "why did this control degrade" after the fact.';
comment on table public.eki_open_findings is
  'EKI Macrophase 2. One open finding per (target, condition). Without this index every evaluation of a stale binding would raise a new finding.';
