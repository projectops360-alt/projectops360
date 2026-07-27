-- ============================================================================
-- EKI Macrophase 2 — end-to-end acceptance test
-- ============================================================================
-- Runs the full Governance Audit Evidence Activation flow against a real
-- PostgreSQL engine and reports test_name / expected / actual / passed, matching
-- the convention of the other scripts in this directory.
--
-- Everything runs inside a transaction that is ROLLED BACK at the end, so the
-- script leaves no data behind and is safe to re-run. Nothing is committed.
--
-- Usage: open in the Supabase SQL editor for the target environment and run.
--        Every row must show passed = true.
-- ============================================================================

begin;

create temporary table eki_acceptance_results (
  step integer,
  test_name text,
  expected text,
  actual text,
  passed boolean
) on commit drop;

do $$
declare
  v_org uuid; v_actor uuid; v_outsider uuid;
  v_control uuid := gen_random_uuid();
  v_binding uuid := gen_random_uuid();
  v_eval jsonb; v_sync jsonb; v_gate jsonb; v_res jsonb;
  v_finding uuid; v_finding_second uuid;
  v_audit_before bigint; v_audit_after bigint;
  v_count integer; v_text text; v_bool boolean;

  procedure_check record;
begin
  select m.organization_id, m.user_id into v_org, v_actor
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
   where m.status = 'active' and m.role in ('owner','admin')
   limit 1;
  if v_org is null then raise exception 'acceptance_requires_an_active_owner_or_admin'; end if;

  -- A member without owner/admin authority, for the unauthorized-resolution step.
  select m.user_id into v_outsider from public.organization_members m
   where m.organization_id = v_org and m.role not in ('owner','admin') and m.status = 'active' limit 1;

  -- If the organization has no such member, provision one inside this
  -- transaction rather than skipping the step. A skipped denial test reports
  -- `passed` for a path that was never exercised, which is the failure mode this
  -- whole engine exists to prevent — a green result that proves nothing. The
  -- membership is discarded with the rollback.
  if v_outsider is null then
    select u.id into v_outsider from auth.users u
     where not exists (select 1 from public.organization_members m
                        where m.organization_id = v_org and m.user_id = u.id)
     limit 1;
    if v_outsider is not null then
      insert into public.organization_members(organization_id, user_id, role, status)
      values (v_org, v_outsider, 'member', 'active');
    end if;
  end if;
  if v_outsider is null then raise exception 'acceptance_requires_a_non_privileged_user'; end if;

  insert into eki_acceptance_results values (0, 'a non-privileged actor is available', 'present',
    'present', true);

  select count(*) into v_audit_before from public.platform_governance_audit where organization_id = v_org;

  -- ── 1. The governance control ─────────────────────────────────────────────
  insert into public.project_knowledge_objects(
    id, organization_id, scope_type, project_id, knowledge_type, owner_user_id,
    current_status, idempotency_key, creation_fingerprint, created_by)
  values (v_control, v_org, 'organization', null, 'control', v_actor, 'active',
          'acceptance-control-' || v_control::text, 'fp-control', v_actor);
  insert into public.project_knowledge_object_versions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no,
    title, summary, body, confidence, confidence_reason, provenance, content_hash, created_by)
  values (v_control, v_org, 'organization', null, 1,
          'Governance actions are audited',
          'Every governance action writes an immutable, hash-chained record.',
          'The assertion under test.', 'high', 'Proven by the governance audit binding.',
          '{}'::jsonb, 'hash-control', v_actor);

  insert into eki_acceptance_results values (1, 'control created at organization scope', 'control/organization',
    (select knowledge_type || '/' || scope_type from public.project_knowledge_objects where id = v_control),
    (select knowledge_type = 'control' and scope_type = 'organization' and project_id is null
       from public.project_knowledge_objects where id = v_control));

  -- ── 2. Its evidence binding, created and activated ────────────────────────
  insert into public.project_knowledge_objects(
    id, organization_id, scope_type, project_id, knowledge_type, owner_user_id,
    current_status, idempotency_key, creation_fingerprint, created_by)
  values (v_binding, v_org, 'organization', null, 'evidence_binding', v_actor, 'active',
          'acceptance-binding-' || v_binding::text, 'fp-binding', v_actor);
  insert into public.project_knowledge_object_versions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no,
    title, summary, body, confidence, confidence_reason, provenance, content_hash, created_by)
  values (v_binding, v_org, 'organization', null, 1,
          'Governance audit activity', 'Counts records in platform_governance_audit.',
          'The binding under test.', 'high', 'Deterministic count over an append-only table.',
          '{}'::jsonb, 'hash-binding', v_actor);

  insert into public.eki_control_runtime(control_object_id, organization_id, control_state, created_by)
  values (v_control, v_org, 'implemented', v_actor);
  insert into public.eki_evidence_binding_runtime(
    binding_object_id, organization_id, resolver_key, freshness_interval, warning_interval,
    binding_state, created_by)
  values (v_binding, v_org, 'governance_audit_activity', interval '7 days', interval '2 days',
          'active', v_actor);
  insert into public.project_knowledge_relations(
    organization_id, scope_type, relation_type, source_endpoint_kind, source_object_id, source_version_no,
    target_endpoint_kind, target_object_id, target_version_no, created_by)
  values (v_org, 'organization', 'supports', 'knowledge_object', v_control, 1,
          'knowledge_object', v_binding, 1, v_actor);

  insert into eki_acceptance_results values (2, 'binding created and active', 'active',
    (select binding_state from public.eki_evidence_binding_runtime where binding_object_id = v_binding),
    (select binding_state = 'active' from public.eki_evidence_binding_runtime where binding_object_id = v_binding));

  -- ── 3-5. No valid evidence: control must not operate, one finding raised ───
  -- The organization already has audit rows from the object-creation triggers,
  -- so the binding is aged past tolerance to produce a genuine no-evidence
  -- condition without mutating anything immutable.
  update public.eki_evidence_binding_runtime
     set freshness_interval = interval '2 microseconds', warning_interval = interval '1 microsecond'
   where binding_object_id = v_binding;

  v_sync := public.eki_evaluate_and_sync(v_binding);

  insert into eki_acceptance_results values (3, 'evaluation with no fresh evidence is not current', 'stale',
    v_sync->>'outcome', (v_sync->>'outcome') = 'stale');

  insert into eki_acceptance_results values (4, 'control does not reach operating', 'implemented',
    v_sync->'control'->>'control_state', (v_sync->'control'->>'control_state') <> 'operating');

  v_finding := (v_sync->'finding'->>'finding_object_id')::uuid;
  insert into eki_acceptance_results values (5, 'one finding created', 'created',
    coalesce(v_sync->'finding'->>'created', 'null'), (v_sync->'finding'->>'created')::boolean);

  -- ── 6-7. Re-evaluation must not duplicate the open finding ────────────────
  v_sync := public.eki_evaluate_and_sync(v_binding);
  v_finding_second := (v_sync->'finding'->>'finding_object_id')::uuid;

  insert into eki_acceptance_results values (6, 're-evaluation reuses the open finding', v_finding::text,
    v_finding_second::text, v_finding_second = v_finding);

  select count(*) into v_count from public.eki_open_findings
   where organization_id = v_org and target_object_id = v_control;
  insert into eki_acceptance_results values (7, 'exactly one open finding per condition', '1',
    v_count::text, v_count = 1);

  insert into eki_acceptance_results values (8, 'recurrence is counted, not duplicated', '2',
    coalesce(v_sync->'finding'->>'occurrence_count','0'),
    (v_sync->'finding'->>'occurrence_count')::integer = 2);

  -- ── 9-10. A real connected governance action ──────────────────────────────
  v_res := public.eki_assign_owner(v_control, v_actor, v_actor,
    'Acceptance test: confirming the owner of the governance audit control.');

  select count(*) into v_count from public.platform_governance_audit
   where organization_id = v_org and 'owner_assigned' = any(reason_codes);
  insert into eki_acceptance_results values (9, 'governance action writes a canonical audit record', '>=1',
    v_count::text, v_count >= 1);

  select (previous_hash is not null and record_hash ~ '^[0-9a-f]{64}$')
    into v_bool from public.platform_governance_audit
   where organization_id = v_org order by sequence_number desc limit 1;
  insert into eki_acceptance_results values (10, 'audit record participates in the hash chain', 'true',
    coalesce(v_bool::text,'null'), coalesce(v_bool, false));

  -- ── 11-12. Fresh evidence returns the control to operating ────────────────
  update public.eki_evidence_binding_runtime
     set freshness_interval = interval '7 days', warning_interval = interval '2 days'
   where binding_object_id = v_binding;

  v_sync := public.eki_evaluate_and_sync(v_binding);
  insert into eki_acceptance_results values (11, 'evidence is current', 'current',
    v_sync->>'outcome', (v_sync->>'outcome') = 'current');

  insert into eki_acceptance_results values (12, 'control reaches operating', 'operating',
    v_sync->'control'->>'control_state', (v_sync->'control'->>'control_state') = 'operating');

  -- ── 13-16. Ageing through policy, never by mutating evidence ──────────────
  update public.eki_evidence_binding_runtime
     set freshness_interval = interval '2 microseconds', warning_interval = interval '1 microsecond'
   where binding_object_id = v_binding;

  v_sync := public.eki_evaluate_and_sync(v_binding);
  insert into eki_acceptance_results values (13, 'stale evidence detected via binding policy', 'stale',
    v_sync->>'outcome', (v_sync->>'outcome') = 'stale');

  insert into eki_acceptance_results values (14, 'control becomes degraded', 'degraded',
    v_sync->'control'->>'control_state', (v_sync->'control'->>'control_state') = 'degraded');

  select count(*) into v_count from public.eki_open_findings
   where organization_id = v_org and target_object_id = v_control
     and condition_code in ('evidence_stale','evidence_missing');
  insert into eki_acceptance_results values (15, 'a stale-evidence finding exists', '>=1',
    v_count::text, v_count >= 1);

  select finding_object_id into v_finding from public.eki_open_findings
   where organization_id = v_org and target_object_id = v_control limit 1;
  insert into eki_acceptance_results values (16, 'the finding is a canonical knowledge object', 'finding',
    (select knowledge_type from public.project_knowledge_objects where id = v_finding),
    (select knowledge_type = 'finding' from public.project_knowledge_objects where id = v_finding));

  -- ── 17. Unauthorized resolution is rejected — and the refusal is recorded ──
  -- The denial is RETURNED, not raised. Raising would roll back the audit insert
  -- written in the same transaction and the refusal would leave no trace, which
  -- is the whole point of step 17b: a system that records only its successes
  -- cannot demonstrate that it refuses anything.
  select count(*) into v_count from public.platform_governance_audit
   where organization_id = v_org and decision = 'denied';

  v_res := public.eki_resolve_finding(v_finding, v_outsider, 'resolved', 'Attempt without authority.');

  insert into eki_acceptance_results values (17, 'unauthorized resolution rejected', 'rejected',
    case when coalesce((v_res->>'authorized')::boolean, true) then 'accepted' else 'rejected' end,
    coalesce((v_res->>'authorized')::boolean, true) = false);

  select count(*) into v_audit_after from public.platform_governance_audit
   where organization_id = v_org and decision = 'denied';
  insert into eki_acceptance_results values (17, 'denegacion_auditada: the refusal is recorded',
    'access_denied recorded', (v_audit_after - v_count)::text, v_audit_after > v_count);

  -- Nothing was mutated on the denied path: the finding is still open.
  select count(*) into v_count from public.eki_open_findings where finding_object_id = v_finding;
  insert into eki_acceptance_results values (17, 'denied resolution mutates nothing', '1',
    v_count::text, v_count = 1);

  -- ── 18-19. Authorized human resolution, immutably audited ─────────────────
  select count(*) into v_count from public.platform_governance_audit where organization_id = v_org;
  v_res := public.eki_resolve_finding(v_finding, v_actor, 'resolved',
    'Acceptance test: the binding tolerance was deliberately narrowed; evidence is present.',
    'acceptance-evidence-ref');

  insert into eki_acceptance_results values (18, 'authorized resolution succeeds', 'resolved',
    v_res->>'resolution', (v_res->>'resolution') = 'resolved');

  select count(*) into v_audit_after from public.platform_governance_audit
   where organization_id = v_org and 'resolved' = any(reason_codes);
  insert into eki_acceptance_results values (19, 'resolution produces an immutable audit record', '>=1',
    v_audit_after::text, v_audit_after >= 1);

  v_bool := false;
  begin
    update public.platform_governance_audit set decision = 'denied'
     where organization_id = v_org and sequence_number = (
       select max(sequence_number) from public.platform_governance_audit where organization_id = v_org);
  exception when others then v_bool := true; end;
  insert into eki_acceptance_results values (20, 'audit records cannot be modified', 'rejected',
    case when v_bool then 'rejected' else 'modified' end, v_bool);

  -- ── 21. Control state follows evidence, not the resolution ────────────────
  select control_state into v_text from public.eki_control_runtime where control_object_id = v_control;
  insert into eki_acceptance_results values (21,
    'closing a finding does not by itself restore operating', 'degraded',
    v_text, v_text = 'degraded');

  -- ── 22. Fail-closed behaviour ─────────────────────────────────────────────
  v_gate := public.eki_resolve_governance_audit_activity(null, interval '1 day', interval '1 hour');
  insert into eki_acceptance_results values (22, 'resolver fails closed on invalid input', 'invalid',
    v_gate->>'outcome', (v_gate->>'outcome') = 'invalid');

  -- Metadata safety: a forbidden key must never reach the audit table.
  perform public.eki_record_governance_event(v_org, 'policy_evaluated', v_actor, 'owner',
    'metadata safety check', 'recorded', array['probe'], array[]::text[],
    jsonb_build_object('secret', 'must-not-persist', 'safe_key', 'kept'), null, 'human');
  select metadata ? 'secret' into v_bool from public.platform_governance_audit
   where organization_id = v_org order by sequence_number desc limit 1;
  insert into eki_acceptance_results values (23, 'forbidden metadata keys are stripped', 'absent',
    case when v_bool then 'present' else 'absent' end, not v_bool);

  select metadata ? 'safe_key' into v_bool from public.platform_governance_audit
   where organization_id = v_org order by sequence_number desc limit 1;
  insert into eki_acceptance_results values (24, 'safe metadata keys are preserved', 'present',
    case when v_bool then 'present' else 'absent' end, v_bool);
end $$;

select step, test_name, expected, actual, passed from eki_acceptance_results order by step;

select
  count(*) filter (where passed) as passed,
  count(*) filter (where not passed) as failed,
  count(*) as total
from eki_acceptance_results;

-- Nothing is committed. The transaction is discarded so the environment is
-- unchanged and the script can be re-run.
rollback;
