-- ============================================================================
-- REG-037 — TRUNCATE on the EKI tables was left granted to anon and authenticated
-- ============================================================================
-- Found by a production security probe immediately after the Macrophase 4
-- migration, and confirmed against production rather than inferred.
--
-- Supabase grants ALL on new tables in `public` to `anon` and `authenticated` by
-- default. Migrations 20260864 and 20260866 revoked only
-- `insert, update, delete` and only `from authenticated`. Two gaps remained:
--
--   * TRUNCATE survived for BOTH roles on all seven EKI tables.
--   * insert/update/delete survived for `anon` on eki_evaluation_runs and
--     eki_evaluation_run_items.
--
-- The second gap is contained by RLS: no policy grants `anon` anything, so a row
-- write is refused. The first is not.
--
-- TRUNCATE does not go through RLS, and it does not fire row-level triggers. The
-- append-only guards on eki_evidence_evaluations and
-- eki_control_state_transitions are BEFORE DELETE triggers, so they would never
-- run. A holder of the publishable key could therefore erase the immutable
-- evidence and transition history — the exact record the whole programme exists
-- to make tamper-evident — and the guards designed to prevent that are
-- structurally unable to see it.
--
-- The fix is to revoke everything and re-grant only what is needed, rather than
-- enumerate privileges to remove. Enumerating is what produced this gap: the
-- list was written against the privileges that seemed relevant, and TRUNCATE was
-- not one of them.
--
-- `project_knowledge_relations` is included: it was created by the same
-- macrophase set and carries the same default grants.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'eki_evidence_binding_runtime',
    'eki_evidence_evaluations',
    'eki_control_runtime',
    'eki_control_state_transitions',
    'eki_open_findings',
    'eki_evaluation_runs',
    'eki_evaluation_run_items',
    'project_knowledge_relations'
  ] loop
    -- Revoke ALL, then grant back only SELECT. Anything not named here is denied
    -- by construction, including privileges added by future PostgreSQL versions.
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    -- The service role is the only writer; every mutation is a database function
    -- that refuses any other role.
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
