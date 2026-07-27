-- ============================================================================
-- REG-036 — Macrophase 3 functions were executable by anon and authenticated
-- ============================================================================
-- PostgreSQL grants EXECUTE to PUBLIC by default on CREATE FUNCTION. Macrophases
-- 1 and 2 revoked it explicitly; Macrophase 3 did not. Every function it added
-- was therefore callable through PostgREST by `anon` and `authenticated`.
--
-- For the write paths this was contained: `auth.role() <> 'service_role'` fires
-- for both roles and the call raises. For the READ path it was not.
--
-- `eki_resolve_privileged_access_activity` is SECURITY DEFINER and had no
-- service-role guard, because it is a resolver invoked from inside the engine.
-- With PUBLIC execute, any caller could name an arbitrary organization id and
-- read that tenant's privileged-access profile — count, most recent change
-- timestamp and contradiction count — while RLS showed them zero rows of the
-- same table. Verified in stage: as `authenticated`, `select count(*) from
-- audit_logs where organization_id = <other tenant>` returned 0 and the resolver
-- returned 31 with an exact timestamp. Reachable as `anon`, so a publishable key
-- and no session were enough.
--
-- Two corrections, because either alone leaves a way back:
--   1. REVOKE, so the functions are unreachable from the API at all. This is the
--      control.
--   2. A service-role guard on the resolver, so a grant restored by a later
--      migration does not silently reopen the disclosure. This is defence in
--      depth, not the control.
--
-- Nothing is granted that was not granted before. Every legitimate caller —
-- the evaluator (service_role) and the engine's own internal calls — is
-- unaffected.
-- ============================================================================

-- ── 1. The control: no API role may execute these ────────────────────────────

revoke all on function public.eki_safe_error(text) from public, anon, authenticated;
revoke all on function public.eki_resolve_privileged_access_activity(uuid, interval, interval) from public, anon, authenticated;
revoke all on function public.eki_recalculate_control_state(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.eki_start_evaluation_run(text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.eki_complete_evaluation_run(uuid, text, text) from public, anon, authenticated;
revoke all on function public.eki_claim_due_bindings(uuid, integer, uuid, interval) from public, anon, authenticated;
revoke all on function public.eki_evaluate_claimed_binding(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.eki_request_evaluation(uuid, uuid, text) from public, anon, authenticated;

-- Re-stated so the intended grant survives the revoke above.
grant execute on function public.eki_safe_error(text) to service_role;
grant execute on function public.eki_resolve_privileged_access_activity(uuid, interval, interval) to service_role;
grant execute on function public.eki_recalculate_control_state(uuid, uuid, bigint) to service_role;
grant execute on function public.eki_start_evaluation_run(text, text, uuid, uuid) to service_role;
grant execute on function public.eki_complete_evaluation_run(uuid, text, text) to service_role;
grant execute on function public.eki_claim_due_bindings(uuid, integer, uuid, interval) to service_role;
grant execute on function public.eki_evaluate_claimed_binding(uuid, uuid, uuid) to service_role;
grant execute on function public.eki_request_evaluation(uuid, uuid, text) to service_role;

-- ── 2. Defence in depth on the resolver ──────────────────────────────────────
-- The guard matches the pattern every other privileged EKI function uses. It is
-- deliberately NOT `coalesce(auth.role(), '')`: a NULL role means a direct
-- database connection, which is how the acceptance script and any future
-- scheduled job run, and which already requires credentials conferring more than
-- this guard protects. The REVOKE above is what closes the API surface.

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
  -- A resolver reads across RLS by design, so it must never be reachable by a
  -- caller who could choose which tenant to read.
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'eki_service_role_required';
  end if;

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
    'detail', jsonb_build_object(
      'source', 'audit_logs',
      'entity_types', array['organization_members','project_team_members','stakeholder_access','admin_authorized_users'],
      'resolver', 'privileged_access_activity')
  );
end
$$;

revoke all on function public.eki_resolve_privileged_access_activity(uuid, interval, interval) from public, anon, authenticated;
grant execute on function public.eki_resolve_privileged_access_activity(uuid, interval, interval) to service_role;
