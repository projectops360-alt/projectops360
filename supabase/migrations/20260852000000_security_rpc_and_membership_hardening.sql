-- ============================================================================
-- ProjectOps360 - emergency RPC and membership authorization hardening
-- ============================================================================

-- Membership is authorization only while it is active. Existing policies call
-- this helper, so the correction takes effect consistently across the schema.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = is_org_member.org_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

-- Keep the privileged traversal implementations outside the schemas exposed by
-- PostgREST. Public functions with the original signatures are recreated below
-- as authorization wrappers, preserving every current application call site.
create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated;

alter function public.find_path(uuid, uuid, uuid, integer) set schema private;
alter function public.detect_cycles(uuid, text) set schema private;
alter function public.extract_subgraph(uuid, text, uuid, integer) set schema private;
alter function public.get_process_timeline(uuid, date, date) set schema private;
alter function public.get_node_neighbors(uuid, uuid, text, text[]) set schema private;

revoke all on function private.find_path(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function private.detect_cycles(uuid, text) from public, anon, authenticated;
revoke all on function private.extract_subgraph(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function private.get_process_timeline(uuid, date, date) from public, anon, authenticated;
revoke all on function private.get_node_neighbors(uuid, uuid, text, text[]) from public, anon, authenticated;

create function public.find_path(
  p_project_id uuid,
  p_from_node_id uuid,
  p_to_node_id uuid,
  p_max_depth integer default 10
)
returns table (
  path_node_ids uuid[],
  total_weight numeric,
  path_length integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.can_access_project(p_project_id), false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_max_depth < 1 or p_max_depth > 20 then
    raise exception 'invalid traversal depth' using errcode = '22023';
  end if;

  return query
  select *
  from private.find_path(p_project_id, p_from_node_id, p_to_node_id, p_max_depth);
end;
$$;

create function public.detect_cycles(
  p_project_id uuid,
  p_node_type text default null
)
returns table (
  cycle_id integer,
  node_ids uuid[],
  node_titles text[],
  cycle_length integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.can_access_project(p_project_id), false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select * from private.detect_cycles(p_project_id, p_node_type);
end;
$$;

create function public.extract_subgraph(
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_depth integer default 2
)
returns table (
  nodes jsonb,
  edges jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.can_access_project(p_project_id), false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_depth < 0 or p_depth > 5 then
    raise exception 'invalid traversal depth' using errcode = '22023';
  end if;

  return query
  select *
  from private.extract_subgraph(p_project_id, p_entity_type, p_entity_id, p_depth);
end;
$$;

create function public.get_process_timeline(
  p_project_id uuid,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  node_id uuid,
  node_type text,
  source_entity_type text,
  source_entity_id uuid,
  title text,
  metadata jsonb,
  occurred_at timestamptz,
  in_degree integer,
  out_degree integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.can_access_project(p_project_id), false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  return query
  select *
  from private.get_process_timeline(p_project_id, p_from_date, p_to_date);
end;
$$;

create function public.get_node_neighbors(
  p_project_id uuid,
  p_node_id uuid,
  p_direction text default 'both',
  p_edge_types text[] default null
)
returns table (
  neighbor_id uuid,
  neighbor_node_type text,
  neighbor_title text,
  neighbor_source_entity_type text,
  neighbor_source_entity_id uuid,
  neighbor_occurred_at timestamptz,
  edge_id uuid,
  edge_type text,
  edge_weight numeric,
  edge_metadata jsonb,
  direction text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.can_access_project(p_project_id), false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_direction not in ('incoming', 'outgoing', 'both') then
    raise exception 'invalid direction' using errcode = '22023';
  end if;

  return query
  select *
  from private.get_node_neighbors(p_project_id, p_node_id, p_direction, p_edge_types);
end;
$$;

-- Remove implicit API execution. PostgreSQL grants function execution to
-- PUBLIC by default, which also makes it available to anon and authenticated.
revoke execute on function public.find_path(uuid, uuid, uuid, integer) from public, anon;
revoke execute on function public.detect_cycles(uuid, text) from public, anon;
revoke execute on function public.extract_subgraph(uuid, text, uuid, integer) from public, anon;
revoke execute on function public.get_process_timeline(uuid, date, date) from public, anon;
revoke execute on function public.get_node_neighbors(uuid, uuid, text, text[]) from public, anon;

grant execute on function public.find_path(uuid, uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.detect_cycles(uuid, text) to authenticated, service_role;
grant execute on function public.extract_subgraph(uuid, text, uuid, integer) to authenticated, service_role;
grant execute on function public.get_process_timeline(uuid, date, date) to authenticated, service_role;
grant execute on function public.get_node_neighbors(uuid, uuid, text, text[]) to authenticated, service_role;

-- RLS/auth helpers are available only to signed-in users and the service role.
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.can_access_project(uuid) from public, anon;
revoke execute on function public.current_user_org_role(uuid) from public, anon;
revoke execute on function public.is_pmo_level(uuid) from public, anon;
revoke execute on function public.is_project_manager_tier(uuid) from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;

grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.can_access_project(uuid) to authenticated, service_role;
grant execute on function public.current_user_org_role(uuid) to authenticated, service_role;
grant execute on function public.is_pmo_level(uuid) to authenticated, service_role;
grant execute on function public.is_project_manager_tier(uuid) to authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- Self-healing is a signed-in-user operation, never an anonymous endpoint.
revoke execute on function public.ensure_user_org() from public, anon;
grant execute on function public.ensure_user_org() to authenticated, service_role;

-- Cross-tenant administration is performed by the server after its platform
-- admin gate, so these functions are service-role only.
revoke execute on function public.admin_get_user_emails(uuid[]) from public, anon, authenticated;
revoke execute on function public.admin_list_company_users(uuid) from public, anon, authenticated;
revoke execute on function public.admin_rename_organization(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_get_user_emails(uuid[]) to service_role;
grant execute on function public.admin_list_company_users(uuid) to service_role;
grant execute on function public.admin_rename_organization(uuid, text) to service_role;

-- Mutation, sequence, observability and trigger functions are not user RPCs.
revoke execute on function public.backfill_living_graph(uuid) from public, anon, authenticated;
revoke execute on function public.compute_labor_capacity(uuid) from public, anon, authenticated;
revoke execute on function public.next_project_event_seq(uuid) from public, anon, authenticated;
revoke execute on function public.living_graph_realtime_health() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_deleted() from public, anon, authenticated;
revoke execute on function public.protect_profile_org_id() from public, anon, authenticated;

grant execute on function public.backfill_living_graph(uuid) to service_role;
grant execute on function public.compute_labor_capacity(uuid) to service_role;
grant execute on function public.next_project_event_seq(uuid) to service_role;
grant execute on function public.living_graph_realtime_health() to service_role;

-- New functions created by future migrations must be explicitly granted.
alter default privileges in schema public revoke execute on functions from public;

-- The demo credential has been used outside a secrets manager. It remains a
-- normal application account, but must not retain platform-wide authorization.
update public.admin_authorized_users
set is_active = false,
    revoked_at = coalesce(revoked_at, now()),
    updated_at = now()
where lower(trim(email)) = 'pmo@xxx-demo.io'
  and is_active = true;

comment on function public.find_path(uuid, uuid, uuid, integer) is
  'Authorized wrapper for private.find_path; requires project access.';
comment on function public.detect_cycles(uuid, text) is
  'Authorized wrapper for private.detect_cycles; requires project access.';
comment on function public.extract_subgraph(uuid, text, uuid, integer) is
  'Authorized wrapper for private.extract_subgraph; requires project access.';
comment on function public.get_process_timeline(uuid, date, date) is
  'Authorized wrapper for private.get_process_timeline; requires project access.';
comment on function public.get_node_neighbors(uuid, uuid, text, text[]) is
  'Authorized wrapper for private.get_node_neighbors; requires project access.';

notify pgrst, 'reload schema';
