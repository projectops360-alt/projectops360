-- ============================================================================
-- EKI Macrophase 2 — governance audit writes, automatic findings, human resolution
-- ============================================================================
-- Three things, all of which write through paths that already exist:
--
--   1. Governance actions write to `platform_governance_audit`. That table is
--      the canonical governance surface and no second audit table is created.
--      It has been sitting empty since it was built; this is the wiring the
--      Charter's completion rule was written about.
--
--   2. Findings are `finding` knowledge objects (ADR-014), not a second
--      compliance-finding system. `eki_open_findings` is only the index that
--      makes creation idempotent.
--
--   3. Resolution is human, authorized, and audited. The engine may raise a
--      finding; only a person may close one (ADR-019).
--
-- Actor identity always comes from the caller's authenticated context passed by
-- the server layer, and every function runs as the service role. No client
-- supplies its own actor, and no client supplies a hash-chain field.
-- ============================================================================

-- ── 1. Governance audit writer ──────────────────────────────────────────────
-- Sequence and hash chain are computed here, never accepted from a caller.
-- Metadata is filtered against the same forbidden-key list the table's own
-- CHECK constraint enforces, so a caller cannot even attempt to store a secret.

create or replace function public.eki_safe_metadata(p_metadata jsonb)
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select coalesce(
    (select jsonb_object_agg(key, value)
       from jsonb_each(coalesce(p_metadata, '{}'::jsonb))
      where key not in (
        'access_token','authorization','body','content','password',
        'payload','raw_payload','secret','transcript'
      )),
    '{}'::jsonb
  );
$$;

create or replace function public.eki_record_governance_event(
  p_organization_id uuid,
  p_event_type text,
  p_actor_id uuid,
  p_actor_role text,
  p_purpose text,
  p_decision text,
  p_reason_codes text[],
  p_evidence_refs text[] default array[]::text[],
  p_metadata jsonb default '{}'::jsonb,
  p_project_id uuid default null,
  p_actor_type text default 'human'
) returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_seq bigint;
  v_prev text;
  v_hash text;
  v_event_id text;
  v_occurred timestamptz := clock_timestamp();
  v_metadata jsonb := public.eki_safe_metadata(p_metadata);
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;
  if p_organization_id is null then raise exception 'eki_audit_organization_required'; end if;
  if p_actor_id is null then raise exception 'eki_audit_actor_required'; end if;
  if nullif(btrim(p_purpose), '') is null then raise exception 'eki_audit_purpose_required'; end if;

  -- Serialise the chain per organization. Without the lock two concurrent
  -- writers can read the same previous hash and produce a fork that validates
  -- individually and breaks as a chain.
  perform pg_advisory_xact_lock(hashtext('eki_governance_audit'), hashtext(p_organization_id::text));

  select coalesce(max(sequence_number), 0) + 1 into v_seq
    from public.platform_governance_audit where organization_id = p_organization_id;

  select record_hash into v_prev
    from public.platform_governance_audit
   where organization_id = p_organization_id
   order by sequence_number desc limit 1;

  v_event_id := 'eki-' || p_organization_id::text || '-' || v_seq::text;

  v_hash := encode(digest(
    coalesce(p_organization_id::text,'') || '|' || v_seq::text || '|' || p_event_type || '|' ||
    p_actor_id::text || '|' || p_actor_type || '|' || p_actor_role || '|' || p_decision || '|' ||
    v_occurred::text || '|' || v_metadata::text || '|' || coalesce(v_prev,''),
    'sha256'), 'hex');

  insert into public.platform_governance_audit(
    event_id, organization_id, project_id, sequence_number, event_type,
    actor_id, actor_type, actor_role, purpose, policy_version, decision,
    reason_codes, evidence_refs, metadata, previous_hash, record_hash, occurred_at
  ) values (
    v_event_id, p_organization_id, p_project_id, v_seq, p_event_type,
    p_actor_id::text, p_actor_type, p_actor_role, p_purpose, '1.0.0', p_decision,
    coalesce(p_reason_codes, array[]::text[]), coalesce(p_evidence_refs, array[]::text[]),
    v_metadata, v_prev, v_hash, v_occurred
  );

  return jsonb_build_object('event_id', v_event_id, 'sequence_number', v_seq, 'record_hash', v_hash);
end
$$;

-- ── 2. Automatic findings ───────────────────────────────────────────────────
-- A finding is a knowledge object. `eki_open_findings` guarantees ONE open
-- finding per (organization, target, condition): a stale binding evaluated every
-- hour must not produce a finding every hour, or the register becomes noise
-- within a day and stops being read.

create or replace function public.eki_upsert_finding(
  p_organization_id uuid,
  p_target_object_id uuid,
  p_condition_code text,
  p_severity text,
  p_summary text,
  p_detail jsonb,
  p_owner_user_id uuid,
  p_evaluation_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_existing public.eki_open_findings%rowtype;
  v_finding uuid := gen_random_uuid();
  v_actor uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;
  if p_severity not in ('low','medium','high','critical') then raise exception 'eki_finding_invalid_severity'; end if;

  select * into v_existing from public.eki_open_findings
   where organization_id = p_organization_id
     and target_object_id = p_target_object_id
     and condition_code = p_condition_code
   for update;

  if found then
    -- Recurrence, not a new finding. The count and last_seen record that the
    -- condition persists, which is what a remediation owner needs to know.
    update public.eki_open_findings
       set last_seen_at = clock_timestamp(), occurrence_count = occurrence_count + 1
     where organization_id = p_organization_id
       and target_object_id = p_target_object_id
       and condition_code = p_condition_code;
    return jsonb_build_object('finding_object_id', v_existing.finding_object_id,
      'created', false, 'occurrence_count', v_existing.occurrence_count + 1);
  end if;

  -- The finding is attributed to the target's owner, because a finding with no
  -- owner is a complaint. Provenance records that the engine derived it, so the
  -- record never claims a person noticed.
  v_actor := coalesce(p_owner_user_id,
    (select owner_user_id from public.project_knowledge_objects where id = p_target_object_id),
    (select created_by from public.project_knowledge_objects where id = p_target_object_id));
  if v_actor is null then raise exception 'eki_finding_owner_unresolvable'; end if;

  insert into public.project_knowledge_objects(
    id, organization_id, scope_type, project_id, knowledge_type, owner_user_id,
    current_status, idempotency_key, creation_fingerprint, created_by
  ) values (
    v_finding, p_organization_id, 'organization', null, 'finding', v_actor,
    'proposed', 'eki-finding:' || p_target_object_id::text || ':' || p_condition_code,
    encode(digest(p_target_object_id::text || p_condition_code, 'sha256'), 'hex'), v_actor
  );

  insert into public.project_knowledge_object_versions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no,
    title, summary, body, structured_content, confidence, confidence_reason, provenance, content_hash, created_by
  ) values (
    v_finding, p_organization_id, 'organization', null, 1,
    'Finding: ' || p_condition_code, p_summary,
    'Raised by the evidence engine from a stated condition. ' || p_summary,
    jsonb_build_object('condition_code', p_condition_code, 'severity', p_severity,
      'target_object_id', p_target_object_id, 'evaluation_id', p_evaluation_id, 'detail', p_detail),
    'high',
    'Derived from a deterministic condition over evidence state, not from judgement.',
    jsonb_build_object('capture_method','derived','source_kind','evidence_engine',
      'source_ref', coalesce(p_evaluation_id::text, p_condition_code), 'engine_name','eki_evidence_engine'),
    encode(digest(v_finding::text, 'sha256'), 'hex'), v_actor
  );

  insert into public.project_knowledge_object_evidence(
    knowledge_object_id, organization_id, scope_type, project_id, version_no,
    evidence_type, evidence_ref, role, confidence, note, metadata, created_by
  ) values (
    v_finding, p_organization_id, 'organization', null, 1,
    'engine_finding', coalesce(p_evaluation_id::text, p_condition_code), 'supports', 'high',
    'The evaluation whose outcome satisfied the condition.', p_detail, v_actor
  );

  insert into public.project_knowledge_object_transitions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no,
    from_status, to_status, actor_id, rationale
  ) values (
    v_finding, p_organization_id, 'organization', null, 1, null, 'proposed', v_actor,
    'Raised automatically: condition ' || p_condition_code || ' held on evaluation.'
  );

  insert into public.eki_open_findings(
    organization_id, target_object_id, condition_code, finding_object_id
  ) values (p_organization_id, p_target_object_id, p_condition_code, v_finding);

  perform public.eki_record_governance_event(
    p_organization_id, 'policy_evaluated', v_actor, 'service', 'automatic finding raised by the evidence engine',
    'recorded', array[p_condition_code],
    array[v_finding::text], jsonb_build_object('severity', p_severity, 'target', p_target_object_id),
    null, 'system');

  return jsonb_build_object('finding_object_id', v_finding, 'created', true, 'occurrence_count', 1);
end
$$;

-- ── 3. Human-authorized resolution ──────────────────────────────────────────
-- The engine may raise; only a person may close. The rationale, the resolving
-- evidence and the resulting control state are all recorded, and the record is
-- immutable because it lands in the append-only governance audit.

create or replace function public.eki_resolve_finding(
  p_finding_object_id uuid,
  p_actor_id uuid,
  p_resolution text,
  p_rationale text,
  p_evidence_ref text default null
) returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_open public.eki_open_findings%rowtype;
  v_org uuid;
  v_role text;
  v_version integer;
  v_control_state jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;
  if p_resolution not in ('resolved','accepted') then raise exception 'eki_finding_invalid_resolution'; end if;
  if nullif(btrim(p_rationale), '') is null then raise exception 'eki_finding_rationale_required'; end if;

  select * into v_open from public.eki_open_findings
   where finding_object_id = p_finding_object_id for update;
  if not found then raise exception 'eki_finding_not_open'; end if;

  select organization_id, current_version_no into v_org, v_version
    from public.project_knowledge_objects where id = p_finding_object_id;

  -- Authorization is checked here, not only in the service layer. A finding
  -- closed by someone without authority is worse than an open one, because it
  -- looks resolved.
  v_role := public.project_knowledge_actor_role(v_org, p_actor_id);
  if coalesce(v_role, '') not in ('owner','admin') then
    -- Returned, NOT raised. Raising would roll back the audit insert in the same
    -- transaction and the denial would never be recorded — which defeats the
    -- point: a denial is evidence of a working control, and a system that logs
    -- only successes cannot demonstrate that it refuses anything (Charter P7).
    -- Nothing is mutated on this path, and the service layer turns the denial
    -- into an error for the caller.
    perform public.eki_record_governance_event(
      v_org, 'access_denied', p_actor_id, coalesce(v_role, 'none'),
      'attempted finding resolution', 'denied', array['insufficient_role'],
      array[p_finding_object_id::text], '{}'::jsonb, null, 'human');
    return jsonb_build_object('authorized', false, 'reason', 'eki_finding_resolution_forbidden',
      'finding_object_id', p_finding_object_id);
  end if;

  insert into public.project_knowledge_object_transitions(
    knowledge_object_id, organization_id, scope_type, project_id, version_no,
    from_status, to_status, actor_id, rationale
  ) values (
    p_finding_object_id, v_org, 'organization', null, v_version,
    (select current_status from public.project_knowledge_objects where id = p_finding_object_id),
    'validated', p_actor_id,
    p_resolution || ': ' || p_rationale || coalesce(' [evidence: ' || p_evidence_ref || ']', '')
  );

  update public.project_knowledge_objects
     set current_status = 'validated', updated_at = now()
   where id = p_finding_object_id;

  delete from public.eki_open_findings where finding_object_id = p_finding_object_id;

  perform public.eki_record_governance_event(
    v_org, 'human_override_recorded', p_actor_id, v_role,
    'finding resolution', 'recorded', array[p_resolution, v_open.condition_code],
    array[p_finding_object_id::text] || case when p_evidence_ref is null then array[]::text[] else array[p_evidence_ref] end,
    jsonb_build_object('condition', v_open.condition_code, 'target', v_open.target_object_id),
    null, 'human');

  -- The control is recalculated from evidence, not from the resolution. A human
  -- closing a finding does not by itself restore `operating`: that requires the
  -- evidence conditions to hold. Moving to a less conservative state requires
  -- evidence, which is the asymmetry the Charter states.
  if exists (select 1 from public.eki_control_runtime where control_object_id = v_open.target_object_id) then
    v_control_state := public.eki_recalculate_control_state(v_open.target_object_id);
  end if;

  return jsonb_build_object('authorized', true, 'finding_object_id', p_finding_object_id,
    'resolution', p_resolution, 'control_state', v_control_state);
end
$$;

-- ── 4. Orchestrator ─────────────────────────────────────────────────────────
-- Evaluate, recalculate, and reconcile findings in one call, so the three can
-- never drift apart. A caller that could do one without the others would be a
-- way to have a degraded control with no finding.

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

  v_control_state := public.eki_recalculate_control_state(v_control, (v_eval->>'evaluation_id')::uuid);
  select owner_user_id into v_owner from public.project_knowledge_objects where id = v_control;

  -- The condition is derived from the outcome, never chosen by a caller.
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

-- ── 5. Audit on knowledge mutations ─────────────────────────────────────────
-- Owner assignment is the one governance action with no existing write path, so
-- it gets a function. Creation, transition, relation and contradiction
-- resolution are audited by triggers on the tables they already write, which
-- means no existing call site has to remember to audit.

create or replace function public.eki_assign_owner(
  p_object_id uuid, p_owner_user_id uuid, p_actor_id uuid, p_rationale text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_role text; v_previous uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'eki_service_role_required'; end if;
  if nullif(btrim(p_rationale), '') is null then raise exception 'eki_owner_rationale_required'; end if;

  select organization_id, owner_user_id into v_org, v_previous
    from public.project_knowledge_objects where id = p_object_id for update;
  if v_org is null then raise exception 'eki_object_not_found'; end if;

  v_role := public.project_knowledge_actor_role(v_org, p_actor_id);
  if coalesce(v_role,'') not in ('owner','admin') then
    -- Returned rather than raised, for the same reason as resolution: a raised
    -- exception discards the audit record that proves the refusal happened.
    perform public.eki_record_governance_event(v_org, 'access_denied', p_actor_id, coalesce(v_role,'none'),
      'attempted owner assignment', 'denied', array['insufficient_role'], array[p_object_id::text],
      '{}'::jsonb, null, 'human');
    return jsonb_build_object('authorized', false, 'reason', 'eki_owner_assignment_forbidden',
      'object_id', p_object_id);
  end if;

  if coalesce(public.project_knowledge_actor_role(v_org, p_owner_user_id), '') = '' then
    raise exception 'eki_owner_not_a_member';
  end if;

  update public.project_knowledge_objects
     set owner_user_id = p_owner_user_id, updated_at = now() where id = p_object_id;

  perform public.eki_record_governance_event(
    v_org, 'human_override_recorded', p_actor_id, v_role, 'owner assignment', 'recorded',
    array['owner_assigned'], array[p_object_id::text],
    -- Before and after, because a change that records only its result cannot be
    -- reviewed.
    jsonb_build_object('object', p_object_id, 'previous_owner', v_previous, 'new_owner', p_owner_user_id),
    null, 'human');

  return jsonb_build_object('authorized', true, 'object_id', p_object_id,
    'owner_user_id', p_owner_user_id, 'previous_owner', v_previous);
end
$$;

create or replace function public.eki_audit_knowledge_mutation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid; v_actor uuid; v_type text; v_reasons text[]; v_refs text[]; v_meta jsonb;
  -- Resolved inside the per-table branch. A shared expression referencing
  -- `new.knowledge_type` is evaluated for every table this trigger serves, and
  -- the relation table has no such column — the reference fails at runtime even
  -- when the branch that needs it is not taken.
  v_actor_type text := 'human';
begin
  if TG_TABLE_NAME = 'project_knowledge_objects' then
    v_org := new.organization_id; v_actor := new.created_by;
    v_type := 'knowledge_transition_reviewed';
    v_reasons := array['knowledge_object_created', new.knowledge_type];
    v_refs := array[new.id::text];
    v_meta := jsonb_build_object('knowledge_type', new.knowledge_type, 'scope', new.scope_type);
    -- A finding is raised by the engine, so the record must not claim a person
    -- noticed it.
    if new.knowledge_type = 'finding' then v_actor_type := 'system'; end if;
  elsif TG_TABLE_NAME = 'project_knowledge_object_transitions' then
    v_org := new.organization_id; v_actor := new.actor_id;
    v_type := 'knowledge_transition_reviewed';
    v_reasons := array['lifecycle_transition', coalesce(new.from_status,'none') || '->' || new.to_status];
    v_refs := array[new.knowledge_object_id::text];
    v_meta := jsonb_build_object('from', new.from_status, 'to', new.to_status);
  elsif TG_TABLE_NAME = 'project_knowledge_relations' then
    v_org := new.organization_id; v_actor := new.created_by;
    if TG_OP = 'INSERT' then
      v_type := 'policy_evaluated';
      v_reasons := array['relation_created', new.relation_type];
      v_meta := jsonb_build_object('relation_type', new.relation_type, 'basis', new.basis);
    else
      if new.resolution_status = old.resolution_status then return new; end if;
      v_type := 'human_override_recorded';
      v_reasons := array['contradiction_' || new.resolution_status];
      v_actor := coalesce(new.approved_by, new.created_by);
      v_meta := jsonb_build_object('relation_type', new.relation_type,
        'from', old.resolution_status, 'to', new.resolution_status);
    end if;
    v_refs := array[new.id::text];
  else
    return new;
  end if;

  -- Audit failure must not silently pass, but it must also not roll back the
  -- operation it observes. It raises only if the audit path itself is broken,
  -- which is a condition that should stop the write.
  perform public.eki_record_governance_event(
    v_org, v_type, v_actor,
    coalesce(public.project_knowledge_actor_role(v_org, v_actor), 'service'),
    'knowledge mutation', 'recorded', v_reasons, v_refs, v_meta, null, v_actor_type);

  return new;
end
$$;

create trigger eki_audit_knowledge_object_created
  after insert on public.project_knowledge_objects
  for each row execute function public.eki_audit_knowledge_mutation();

create trigger eki_audit_knowledge_transition
  after insert on public.project_knowledge_object_transitions
  for each row execute function public.eki_audit_knowledge_mutation();

create trigger eki_audit_relation_created
  after insert on public.project_knowledge_relations
  for each row execute function public.eki_audit_knowledge_mutation();

create trigger eki_audit_relation_resolved
  after update on public.project_knowledge_relations
  for each row execute function public.eki_audit_knowledge_mutation();

-- Control lifecycle transitions are audited from their own table, so both
-- evidence-driven and human-driven changes land in the governance record.
create or replace function public.eki_audit_control_transition()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid;
begin
  v_actor := coalesce(new.actor_id,
    (select owner_user_id from public.project_knowledge_objects where id = new.control_object_id),
    (select created_by from public.eki_control_runtime where control_object_id = new.control_object_id));
  perform public.eki_record_governance_event(
    new.organization_id, 'policy_evaluated', v_actor,
    coalesce(public.project_knowledge_actor_role(new.organization_id, v_actor), 'service'),
    'control lifecycle transition', 'recorded',
    array['control_' || coalesce(new.from_state,'none') || '_to_' || new.to_state, new.driver],
    array[new.control_object_id::text],
    jsonb_build_object('from', new.from_state, 'to', new.to_state, 'driver', new.driver),
    null, case when new.driver = 'evidence' then 'system' else 'human' end);
  return new;
end
$$;

create trigger eki_audit_control_state_transition
  after insert on public.eki_control_state_transitions
  for each row execute function public.eki_audit_control_transition();

-- ── 6. Grants ───────────────────────────────────────────────────────────────

revoke all on function public.eki_safe_metadata(jsonb) from public, anon, authenticated;
revoke all on function public.eki_record_governance_event(uuid, text, uuid, text, text, text, text[], text[], jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.eki_upsert_finding(uuid, uuid, text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function public.eki_resolve_finding(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.eki_evaluate_and_sync(uuid) from public, anon, authenticated;
revoke all on function public.eki_assign_owner(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.eki_audit_knowledge_mutation() from public, anon, authenticated;
revoke all on function public.eki_audit_control_transition() from public, anon, authenticated;

grant execute on function public.eki_record_governance_event(uuid, text, uuid, text, text, text, text[], text[], jsonb, uuid, text) to service_role;
grant execute on function public.eki_upsert_finding(uuid, uuid, text, text, text, jsonb, uuid, uuid) to service_role;
grant execute on function public.eki_resolve_finding(uuid, uuid, text, text, text) to service_role;
grant execute on function public.eki_evaluate_and_sync(uuid) to service_role;
grant execute on function public.eki_assign_owner(uuid, uuid, uuid, text) to service_role;

comment on function public.eki_record_governance_event(uuid, text, uuid, text, text, text, text[], text[], jsonb, uuid, text) is
  'EKI Macrophase 2. The only write path into platform_governance_audit. Sequence and hash chain are computed, never accepted from a caller; metadata is filtered before it reaches the table.';
comment on function public.eki_evaluate_and_sync(uuid) is
  'Evaluate, recalculate the control, reconcile findings. One call so the three cannot drift apart.';
