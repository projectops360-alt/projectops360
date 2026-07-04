-- ============================================================================
-- Living Graph Observability Panel — read-only realtime infra health function
-- Phase 4B / Task 3
-- ============================================================================
-- Returns GLOBAL, non-tenant infrastructure facts the admin observability panel
-- surfaces: whether project_event_log is in the supabase_realtime publication,
-- and whether RLS is enabled (+ policy count). It exposes NO tenant/project/task
-- data and NO payloads. SECURITY DEFINER so it can read pg_catalog; read-only.
-- ============================================================================

create or replace function public.living_graph_realtime_health()
returns table (
  realtime_publication_ok boolean,
  rls_enabled boolean,
  rls_policy_count int
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'project_event_log'
    ) as realtime_publication_ok,
    coalesce(
      (select relrowsecurity from pg_class where oid = 'public.project_event_log'::regclass),
      false
    ) as rls_enabled,
    (select count(*)::int from pg_policies
       where schemaname = 'public' and tablename = 'project_event_log') as rls_policy_count;
$$;

grant execute on function public.living_graph_realtime_health() to authenticated;
