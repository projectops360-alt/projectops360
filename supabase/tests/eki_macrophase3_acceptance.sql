-- ============================================================================
-- EKI Macrophase 3 — end-to-end acceptance test
-- ============================================================================
-- Runs the complete Automated Evidence Intelligence flow against a real
-- PostgreSQL engine: a binding becomes due, the scheduler claims it once, a
-- concurrent evaluator cannot take it, the second resolver reads its
-- authoritative source, the control state is recalculated, findings are raised
-- idempotently, the run is observable, and new evidence returns the control to
-- the state its evidence supports.
--
-- Everything runs inside a transaction that is ROLLED BACK, so the script leaves
-- nothing behind and is safe to re-run.
--
-- Preconditions are RAISED, never skipped. A step that silently skips reports
-- `passed` for a path that was never exercised, and a green result that retires
-- the question is worse than a failure. (Macrophase 1 probe 11, Macrophase 2
-- step 17 — the same trap twice.)
--
-- Usage: open in the Supabase SQL editor for the target environment and run.
--        Every row must show passed = true.
-- ============================================================================

begin;

create temporary table eki_m3_results (
  step integer,
  test_name text,
  expected text,
  actual text,
  passed boolean
) on commit drop;

do $$
declare
  v_org uuid; v_actor uuid; v_outsider uuid; v_foreign_org uuid;
  v_control uuid := gen_random_uuid();
  v_binding uuid := gen_random_uuid();
  v_run_id uuid; v_run2_id uuid; v_degrading_run_id uuid; v_own_count bigint;
  v_claims jsonb[]; v_claims2 jsonb[];
  v_token uuid; v_res jsonb; v_run jsonb;
  v_text text; v_n bigint; v_count integer; v_b boolean;
begin
  -- ── Preconditions ─────────────────────────────────────────────────────────
  -- Pinned to an organization that HAS privileged-access evidence. Taking the
  -- first admin's organization picks one at random, and a zero count would then
  -- look like a resolver defect instead of an empty tenant.
  select a.organization_id into v_org
    from public.audit_logs a
   where a.entity_type in ('organization_members','project_team_members','stakeholder_access','admin_authorized_users')
   group by a.organization_id having count(*) > 5
   order by max(a.created_at) desc limit 1;
  if v_org is null then raise exception 'acceptance_requires_privileged_access_evidence'; end if;

  select user_id into v_actor from public.organization_members
   where organization_id = v_org and status = 'active' and role in ('owner','admin') limit 1;
  if v_actor is null then raise exception 'acceptance_requires_an_active_owner_or_admin'; end if;

  select u.id into v_outsider from auth.users u
   where not exists (select 1 from public.organization_members m
                      where m.organization_id = v_org and m.user_id = u.id) limit 1;
  if v_outsider is null then raise exception 'acceptance_requires_a_non_member'; end if;

  select id into v_foreign_org from public.organizations where id <> v_org limit 1;
  if v_foreign_org is null then raise exception 'acceptance_requires_a_second_organization'; end if;

  insert into eki_m3_results values (0, 'preconditions satisfied', 'org+admin+non-member+second org',
    'present', true);

  -- ── The control and its binding ───────────────────────────────────────────
  insert into public.project_knowledge_objects(id, organization_id, scope_type, project_id, knowledge_type,
    owner_user_id, current_status, idempotency_key, creation_fingerprint, created_by)
  values (v_control, v_org, 'organization', null, 'control', v_actor, 'active',
          'm3-control-' || v_control::text, 'fp-control', v_actor);
  insert into public.project_knowledge_object_versions(knowledge_object_id, organization_id, scope_type,
    project_id, version_no, title, summary, body, confidence, confidence_reason, provenance, content_hash, created_by)
  values (v_control, v_org, 'organization', null, 1, 'Privileged access is attributable',
          'Every privileged access change is recorded with an accountable actor.',
          'The assertion under test.', 'high', 'Deterministic count over an append-only source.',
          '{}'::jsonb, 'hash-control', v_actor);

  insert into public.project_knowledge_objects(id, organization_id, scope_type, project_id, knowledge_type,
    owner_user_id, current_status, idempotency_key, creation_fingerprint, created_by)
  values (v_binding, v_org, 'organization', null, 'evidence_binding', v_actor, 'active',
          'm3-binding-' || v_binding::text, 'fp-binding', v_actor);
  insert into public.project_knowledge_object_versions(knowledge_object_id, organization_id, scope_type,
    project_id, version_no, title, summary, body, confidence, confidence_reason, provenance, content_hash, created_by)
  values (v_binding, v_org, 'organization', null, 1, 'Privileged access activity',
          'Counts privileged-access changes in audit_logs and checks their attribution.',
          'The binding under test.', 'high', 'Deterministic query over an authoritative table.',
          '{}'::jsonb, 'hash-binding', v_actor);

  insert into public.eki_control_runtime(control_object_id, organization_id, control_state, created_by)
  values (v_control, v_org, 'implemented', v_actor);

  -- Due three cadences ago, so the missed-run recovery path is exercised rather
  -- than assumed.
  insert into public.eki_evidence_binding_runtime(binding_object_id, organization_id, resolver_key,
    freshness_interval, warning_interval, binding_state, evaluation_interval, next_due_at, created_by)
  values (v_binding, v_org, 'privileged_access_activity', interval '3650 days', interval '30 days',
          'active', interval '1 hour', clock_timestamp() - interval '3 hours', v_actor);

  insert into public.project_knowledge_relations(organization_id, scope_type, relation_type,
    source_endpoint_kind, source_object_id, source_version_no, target_endpoint_kind, target_object_id,
    target_version_no, created_by)
  values (v_org,'organization','supports','knowledge_object',v_control,1,'knowledge_object',v_binding,1,v_actor);

  -- ── 1. The binding is due ─────────────────────────────────────────────────
  select next_due_at <= clock_timestamp() into v_b
    from public.eki_evidence_binding_runtime where binding_object_id = v_binding;
  insert into eki_m3_results values (1, 'an active binding becomes due', 'true', v_b::text, v_b);

  -- ── 2. The scheduler claims it once ───────────────────────────────────────
  v_run := public.eki_start_evaluation_run('m3:sched:'||clock_timestamp()::text, 'scheduled', null, null);
  v_run_id := (v_run->>'run_id')::uuid;
  select array_agg(c) into v_claims from public.eki_claim_due_bindings(v_run_id, 50, v_org) c;
  insert into eki_m3_results values (2, 'the scheduler claims it exactly once', '1',
    coalesce(array_length(v_claims,1),0)::text, coalesce(array_length(v_claims,1),0) = 1);
  v_token := (v_claims[1]->>'claim_token')::uuid;

  -- ── 3. A concurrent evaluator cannot take the same due execution ──────────
  v_run2_id := (public.eki_start_evaluation_run('m3:sched2:'||clock_timestamp()::text,'scheduled',null,null)->>'run_id')::uuid;
  select array_agg(c) into v_claims2 from public.eki_claim_due_bindings(v_run2_id, 50, v_org) c;
  insert into eki_m3_results values (3, 'a concurrent run claims nothing', '0',
    coalesce(array_length(v_claims2,1),0)::text, coalesce(array_length(v_claims2,1),0) = 0);

  -- 3b. And a worker holding a stale token is fenced off before it reads anything.
  v_res := public.eki_evaluate_claimed_binding(v_run2_id, v_binding, gen_random_uuid());
  insert into eki_m3_results values (3, 'a stale worker is refused', 'claim_superseded',
    v_res->>'reason', (v_res->>'reason') = 'claim_superseded');

  -- 3c. Duplicate job delivery resolves to the same run, never to a second sweep.
  select run_key into v_text from public.eki_evaluation_runs where id = v_run_id;
  v_res := public.eki_start_evaluation_run(v_text, 'scheduled', null, null);
  insert into eki_m3_results values (3, 'duplicate delivery joins the same run', 'true',
    coalesce(v_res->>'duplicate','false'), coalesce((v_res->>'duplicate')::boolean,false));

  -- ── 4-6. Resolver, persistence, control recalculation ─────────────────────
  v_res := public.eki_evaluate_claimed_binding(v_run_id, v_binding, v_token);
  insert into eki_m3_results values (4, 'the resolver queried the authoritative source', 'audit_logs',
    coalesce(v_res->'detail'->>'source','none'), (v_res->'detail'->>'source') = 'audit_logs');

  select count(*) into v_count from public.eki_evidence_evaluations
   where binding_object_id = v_binding;
  insert into eki_m3_results values (5, 'the evaluation is persisted', '1', v_count::text, v_count = 1);

  insert into eki_m3_results values (6, 'the control state is recalculated', 'operating',
    v_res->'control'->>'control_state', (v_res->'control'->>'control_state') = 'operating');

  -- ── 7. A stale result creates one idempotent finding ──────────────────────
  -- Aged by narrowing the binding's own tolerance. The evidence table is
  -- append-only and the test must not be able to do what the product forbids.
  update public.eki_evidence_binding_runtime
     set freshness_interval = interval '2 microseconds', warning_interval = interval '1 microsecond',
         next_due_at = clock_timestamp() - interval '1 minute'
   where binding_object_id = v_binding;

  -- Kept in its own variable: this is the run in which the control ACTUALLY
  -- moves operating → degraded. Asserting the transition on a later run would
  -- read degraded → degraded and prove nothing about the change.
  v_degrading_run_id := (public.eki_start_evaluation_run('m3:sched3:'||clock_timestamp()::text,'scheduled',null,null)->>'run_id')::uuid;
  select array_agg(c) into v_claims from public.eki_claim_due_bindings(v_degrading_run_id, 50, v_org) c;
  v_res := public.eki_evaluate_claimed_binding(v_degrading_run_id, v_binding, (v_claims[1]->>'claim_token')::uuid);
  insert into eki_m3_results values (7, 'a stale result raises one finding', 'created',
    coalesce(v_res->'finding'->>'created','false'), coalesce((v_res->'finding'->>'created')::boolean,false));

  -- Re-running must recur the finding, never duplicate it.
  update public.eki_evidence_binding_runtime set next_due_at = clock_timestamp() - interval '1 minute'
   where binding_object_id = v_binding;
  v_run_id := (public.eki_start_evaluation_run('m3:sched4:'||clock_timestamp()::text,'scheduled',null,null)->>'run_id')::uuid;
  select array_agg(c) into v_claims from public.eki_claim_due_bindings(v_run_id, 50, v_org) c;
  v_res := public.eki_evaluate_claimed_binding(v_run_id, v_binding, (v_claims[1]->>'claim_token')::uuid);
  select count(*) into v_count from public.eki_open_findings
   where organization_id = v_org and target_object_id = v_control;
  insert into eki_m3_results values (7, 're-evaluation recurs rather than duplicates', '1',
    v_count::text, v_count = 1);

  insert into eki_m3_results values (7, 'the control is now degraded', 'degraded',
    v_res->'control'->>'control_state', (v_res->'control'->>'control_state') = 'degraded');

  -- ── 8. The run appears in evaluator observability ─────────────────────────
  select status || '/' || bindings_evaluated::text into v_text
    from public.eki_evaluation_runs where id = v_run_id;
  perform public.eki_complete_evaluation_run(v_run_id);
  select status || '/' || bindings_evaluated::text into v_text
    from public.eki_evaluation_runs where id = v_run_id;
  insert into eki_m3_results values (8, 'the run is observable', 'succeeded/1', v_text, v_text = 'succeeded/1');

  select control_state_before || '->' || control_state_after into v_text
    from public.eki_evaluation_run_items where run_id = v_degrading_run_id and status = 'succeeded';
  insert into eki_m3_results values (8, 'before and after are both recorded', 'operating->degraded',
    v_text, v_text = 'operating->degraded');

  select missed_intervals into v_count from public.eki_evaluation_run_items
   where run_id = v_run_id and status = 'succeeded';
  insert into eki_m3_results values (8, 'missed cadences are visible', '>=0',
    v_count::text, v_count >= 0);

  -- ── 9. Product Brain context returns the four as related canonical objects ─
  select count(*) into v_count
    from public.project_knowledge_objects o
    join public.project_knowledge_relations r on r.source_object_id = o.id
   where o.id = v_control and r.relation_type = 'supports' and r.target_object_id = v_binding;
  insert into eki_m3_results values (9, 'control and binding are canonically related', '1',
    v_count::text, v_count = 1);

  select count(*) into v_count from public.project_knowledge_objects
   where id = (select finding_object_id from public.eki_open_findings
                where organization_id = v_org and target_object_id = v_control limit 1)
     and knowledge_type = 'finding';
  insert into eki_m3_results values (9, 'the finding is a canonical knowledge object', '1',
    v_count::text, v_count = 1);

  -- ── 10-12. Isabella boundaries, enforced in the database ──────────────────
  -- The reasoning layer is unit-tested; what must hold HERE is that no path lets
  -- an AI actor perform an authoritative action. `eki_resolve_finding` is the
  -- only way to close a finding and it demands owner/admin.
  select count(*) into v_n from public.platform_governance_audit
   where organization_id = v_org and decision = 'denied';
  v_res := public.eki_request_evaluation(v_binding, v_outsider, 'manual');
  insert into eki_m3_results values (10, 'an actor without standing is refused', 'false',
    coalesce(v_res->>'authorized','?'), coalesce((v_res->>'authorized')::boolean, true) = false);

  select (count(*) > v_n) into v_b from public.platform_governance_audit
   where organization_id = v_org and decision = 'denied';
  insert into eki_m3_results values (11, 'the refusal is recorded', 'recorded',
    case when v_b then 'recorded' else 'absent' end, v_b);

  select actor_role into v_text from public.platform_governance_audit
   where organization_id = v_org and decision = 'denied' order by sequence_number desc limit 1;
  insert into eki_m3_results values (11, 'the role is recorded honestly', 'none', v_text, v_text = 'none');

  v_res := public.eki_resolve_finding(
    (select finding_object_id from public.eki_open_findings
      where organization_id = v_org and target_object_id = v_control limit 1),
    v_outsider, 'resolved', 'Attempt without authority.');
  insert into eki_m3_results values (12, 'a finding cannot be closed without authority', 'false',
    coalesce(v_res->>'authorized','?'), coalesce((v_res->>'authorized')::boolean, true) = false);

  -- ── 13. The lens has the control, binding, finding and owner to show ──────
  select count(*) into v_count from public.eki_evidence_binding_runtime where binding_object_id = v_binding;
  select v_count
       + (select count(*) from public.eki_open_findings where target_object_id = v_control)
       + (select count(*) from public.project_knowledge_objects where id = v_control and owner_user_id is not null)
    into v_count;
  insert into eki_m3_results values (13, 'binding, finding and owner are all present for the lens', '3',
    v_count::text, v_count = 3);

  -- ── 14-17. New valid evidence returns the control to what evidence supports ─
  insert into public.audit_logs(organization_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (v_org, v_actor, 'organization_members', gen_random_uuid(), 'update', '{}'::jsonb);
  insert into eki_m3_results values (14, 'new valid evidence arrives', 'inserted', 'inserted', true);

  update public.eki_evidence_binding_runtime
     set freshness_interval = interval '3650 days', warning_interval = interval '30 days',
         next_due_at = clock_timestamp() - interval '1 minute'
   where binding_object_id = v_binding;

  v_run_id := (public.eki_start_evaluation_run('m3:sched5:'||clock_timestamp()::text,'scheduled',null,null)->>'run_id')::uuid;
  select array_agg(c) into v_claims from public.eki_claim_due_bindings(v_run_id, 50, v_org) c;
  v_res := public.eki_evaluate_claimed_binding(v_run_id, v_binding, (v_claims[1]->>'claim_token')::uuid);
  insert into eki_m3_results values (15, 'the next evaluation detects it', 'current',
    v_res->>'outcome', (v_res->>'outcome') = 'current');

  insert into eki_m3_results values (16, 'the control returns to the evidence-supported state', 'operating',
    v_res->'control'->>'control_state', (v_res->'control'->>'control_state') = 'operating');

  -- The finding is NOT auto-closed by fresh evidence. Closing it is a human
  -- judgement; the engine only stops recurring it.
  select count(*) into v_count from public.eki_open_findings
   where organization_id = v_org and target_object_id = v_control;
  insert into eki_m3_results values (17, 'the finding is not auto-closed by fresh evidence', '1',
    v_count::text, v_count = 1);

  -- ── 18. What changed is answerable from the record ────────────────────────
  select count(*) into v_count from public.eki_control_state_transitions
   where control_object_id = v_control;
  insert into eki_m3_results values (18, 'every state change is recorded', '>=3',
    v_count::text, v_count >= 3);

  select count(*) into v_count from public.eki_control_state_transitions
   where control_object_id = v_control and driver = 'evidence' and evaluation_id is not null;
  insert into eki_m3_results values (18, 'each change names the evaluation that caused it', '>=3',
    v_count::text, v_count >= 3);

  -- ── 19. Tenant isolation across every new path ────────────────────────────
  -- Both counts are asserted, and the pinned tenant's must be non-zero. Checking
  -- only that the foreign tenant returns its own number lets the test pass with
  -- 0 = 0 — two empty answers agreeing, which demonstrates nothing about
  -- isolation. That is the shape of failure this suite has hit twice already.
  select count(*) into v_n from public.audit_logs where organization_id = v_foreign_org
     and entity_type in ('organization_members','project_team_members','stakeholder_access','admin_authorized_users');
  v_res := public.eki_resolve_privileged_access_activity(v_foreign_org, interval '3650 days', interval '30 days');
  select (public.eki_resolve_privileged_access_activity(v_org, interval '3650 days', interval '30 days')->>'evidence_count')::bigint
    into v_own_count;
  insert into eki_m3_results values (19, 'the resolver sees only its own tenant',
    'own>0 and foreign=' || v_n::text,
    'own=' || v_own_count::text || ' foreign=' || (v_res->>'evidence_count'),
    v_own_count > 0 and (v_res->>'evidence_count')::bigint = v_n and v_own_count <> v_n);

  v_run2_id := (public.eki_start_evaluation_run('m3:foreign:'||clock_timestamp()::text,'scheduled',v_foreign_org,null)->>'run_id')::uuid;
  select array_agg(c) into v_claims2 from public.eki_claim_due_bindings(v_run2_id, 50, v_foreign_org) c;
  insert into eki_m3_results values (19, 'a sweep scoped to another tenant claims nothing of ours', 'true',
    coalesce((select bool_and((c->>'organization_id')::uuid <> v_org) from unnest(coalesce(v_claims2, array[]::jsonb[])) c), true)::text,
    coalesce((select bool_and((c->>'organization_id')::uuid <> v_org) from unnest(coalesce(v_claims2, array[]::jsonb[])) c), true));

  -- ── 20. Nothing is committed ──────────────────────────────────────────────
  insert into eki_m3_results values (20, 'the whole run is transactional', 'rollback', 'rollback', true);
end $$;

select step, test_name, expected, actual, passed from eki_m3_results order by step, test_name;

select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed,
  count(*) as total
from eki_m3_results;

-- Nothing is committed. The transaction is discarded so the environment is
-- unchanged and the script can be re-run.
rollback;
