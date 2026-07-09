-- ============================================================================
-- ProjectOps360° — admin_get_user_emails (batch email lookup for admins)
-- ============================================================================
-- Companion to 20260841 (admin platform foundation). The Admin Console's
-- "Users & Projects" tab shows owner emails; auth.users is not reachable via
-- PostgREST .from() even with the service role, so emails must be resolved
-- inside the database. Same gate as the other admin RPCs: service role or an
-- active platform admin (admin_authorized_users via is_platform_admin()).
-- ============================================================================

create or replace function public.admin_get_user_emails(p_user_ids uuid[])
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
  where u.id = any(p_user_ids);
end;
$$;

revoke all on function public.admin_get_user_emails(uuid[]) from public;
grant execute on function public.admin_get_user_emails(uuid[]) to authenticated, service_role;
