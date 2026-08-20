-- ============================================================================
-- ProjectOps360° — deterministic platform-admin user lookup by exact email
-- ============================================================================
-- Admin → User Integrity must be able to diagnose auth users even when they
-- have no profile or organization membership. auth.users is intentionally not
-- exposed through PostgREST, so perform the exact-email lookup inside a gated
-- SECURITY DEFINER RPC instead of enumerating users through the Auth Admin API.
-- ============================================================================

create or replace function public.admin_find_user_by_email(p_email text)
returns table (user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_platform_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select u.id, u.email::text
  from auth.users u
  where lower(trim(u.email)) = lower(trim(p_email))
  limit 1;
end;
$$;

revoke all on function public.admin_find_user_by_email(text) from public;
grant execute on function public.admin_find_user_by_email(text) to authenticated, service_role;
